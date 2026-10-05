import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
  unidade_id: string | null;
};

type OcorrenciaCreateBody = {
  tipo?: string;
  descricao?: string;
  anonima?: boolean;
  fotoUrl?: string | null;
};

const TIPOS_VALIDOS = ["BARULHO", "DANO", "SEGURANCA", "MANUTENCAO", "OUTRO"] as const;

export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role, unidade_id")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  let query = supabaseAdmin
    .from("ocorrencias")
    .select(`
      id, tipo, descricao, status, foto_url, anonima, observacao_sindico, criado_em, atualizado_em,
      unidade:unidade_id ( numero ),
      reporter:reporter_id ( nome, email )
    `)
    .eq("condominio_id", profile.condominio_id)
    .order("criado_em", { ascending: false });

  if (profile.role === "MORADOR") {
    query = query.eq("reporter_id", userData.user.id);
  } else if (profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Para síndico: oculta nome do reporter se ocorrência for anônima
  const isSindico = profile.role === "SINDICO";
  const ocorrencias = (data ?? []).map((row: any) => {
    const unidade = Array.isArray(row.unidade) ? row.unidade[0] ?? null : row.unidade;
    const reporter = Array.isArray(row.reporter) ? row.reporter[0] ?? null : row.reporter;

    return {
      id: row.id,
      tipo: row.tipo,
      descricao: row.descricao,
      status: row.status,
      foto_url: row.foto_url,
      anonima: row.anonima,
      observacao_sindico: row.observacao_sindico,
      criado_em: row.criado_em,
      atualizado_em: row.atualizado_em,
      unidade_numero: unidade?.numero ?? null,
      reporter_nome: isSindico && row.anonima ? "Anônimo" : (reporter?.nome ?? null)
    };
  });

  return NextResponse.json(ocorrencias);
}

export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role, unidade_id")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  if (profile.role !== "MORADOR") {
    return NextResponse.json({ error: "Apenas moradores podem registrar ocorrências." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as OcorrenciaCreateBody | null;
  const tipo = body?.tipo?.trim().toUpperCase() ?? "OUTRO";
  const descricao = body?.descricao?.trim() ?? "";
  const anonima = body?.anonima ?? false;
  const fotoUrl = body?.fotoUrl?.trim() ?? null;

  if (!descricao) return NextResponse.json({ error: "Descrição é obrigatória." }, { status: 400 });
  if (!TIPOS_VALIDOS.includes(tipo as typeof TIPOS_VALIDOS[number])) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const { data: ocorrencia, error: insertError } = await supabaseAdmin
    .from("ocorrencias")
    .insert({
      condominio_id: profile.condominio_id,
      unidade_id: profile.unidade_id ?? null,
      reporter_id: userData.user.id,
      tipo,
      descricao,
      anonima,
      foto_url: fotoUrl,
      status: "ABERTA"
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !ocorrencia) {
    return NextResponse.json({ error: insertError?.message ?? "Erro ao registrar ocorrência." }, { status: 400 });
  }

  // Notificar síndico por email
  void (async () => {
    try {
      const brevoApiKey = process.env.BREVO_API_KEY ?? "";
      if (!brevoApiKey) return;

      const { data: sindicoProfiles } = await supabaseAdmin
        .from("perfis_usuario")
        .select("usuario_id")
        .eq("condominio_id", profile.condominio_id)
        .eq("role", "SINDICO")
        .eq("ativo", true);

      const sindicoIds = (sindicoProfiles ?? []).map((p: any) => p.usuario_id);
      if (!sindicoIds.length) return;

      const { data: sindicos } = await supabaseAdmin
        .from("usuarios")
        .select("email, nome")
        .in("id", sindicoIds);

      const TIPO_LABELS: Record<string, string> = {
        BARULHO: "🔊 Barulho",
        DANO: "🔨 Dano",
        SEGURANCA: "🔒 Segurança",
        MANUTENCAO: "🔧 Manutenção",
        OUTRO: "📋 Outro"
      };

      const tipoLabel = TIPO_LABELS[tipo] ?? tipo;
      const autorLabel = anonima ? "Anônimo" : "Morador";

      for (const sindico of (sindicos ?? []) as { email: string; nome: string }[]) {
        if (!sindico.email) continue;
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoApiKey, "content-type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Condofy", email: "suportecondofy@gmail.com" },
            to: [{ email: sindico.email, name: sindico.nome }],
            subject: `${tipoLabel} — Nova ocorrência registrada`,
            htmlContent: `<p>Olá ${sindico.nome}!</p><p>Uma nova ocorrência foi registrada por <strong>${autorLabel}</strong>.</p><p><strong>Tipo:</strong> ${tipoLabel}<br/><strong>Descrição:</strong> ${descricao}</p><p>Acesse o Condofy para acompanhar e responder.</p>`
          })
        }).catch(() => {});
      }
    } catch (err) {
      console.error("[api/ocorrencias] Erro ao notificar síndico:", err);
    }
  })();

  return NextResponse.json({ ok: true, ocorrenciaId: ocorrencia.id });
}
