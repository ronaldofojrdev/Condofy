import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
  unidade_id: string | null;
};

type AvisoResponseRow = {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  fixado: boolean;
  criado_em: string;
  autor_nome: string | null;
  unidade_id: string | null;
  unidade_numero: string | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const accessToken = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role, unidade_id")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id || !profile.role) {
    return NextResponse.json({ error: "Nenhum condomínio ativo encontrado para este usuário." }, { status: 403 });
  }

  let query = supabaseAdmin
    .from("avisos")
    .select("id, titulo, conteudo, categoria, fixado, criado_em, unidade_id, unidade:unidades(numero), autor:usuarios(nome)")
    .eq("condominio_id", profile.condominio_id)
    .order("fixado", { ascending: false })
    .order("criado_em", { ascending: false });

  // Moradores só veem avisos globais + avisos direcionados para a sua unidade
  if (profile.role === "MORADOR") {
    if (profile.unidade_id) {
      query = query.or(`unidade_id.is.null,unidade_id.eq.${profile.unidade_id}`);
    } else {
      query = query.is("unidade_id", null);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const avisos = (data ?? []).map((row) => {
    const autor = Array.isArray(row.autor) ? row.autor[0] ?? null : row.autor;
    const unidade = Array.isArray(row.unidade) ? row.unidade[0] ?? null : row.unidade;

    return {
      id: row.id,
      titulo: row.titulo,
      conteudo: row.conteudo,
      categoria: row.categoria,
      fixado: row.fixado,
      criado_em: row.criado_em,
      autor_nome: autor?.nome ?? null,
      unidade_id: (row.unidade_id as string | null) ?? null,
      unidade_numero: unidade?.numero ?? null
    } satisfies AvisoResponseRow;
  });

  return NextResponse.json(avisos);
}

type AvisoCreateBody = {
  titulo?: string;
  conteudo?: string;
  categoria?: string;
  fixado?: boolean;
  unidade_id?: string | null;
};

type MoradorEmailRow = {
  id: string;
  email: string;
  nome: string;
};

const CATEGORIAS_VALIDAS = ["GERAL", "MANUTENCAO", "SEGURANCA", "FINANCEIRO", "EVENTO"] as const;

export async function POST(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const accessToken = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id || !profile.role) {
    return NextResponse.json({ error: "Nenhum condomínio ativo encontrado para este usuário." }, { status: 403 });
  }

  if (profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Apenas o síndico pode publicar avisos." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as AvisoCreateBody | null;
  const titulo = body?.titulo?.trim();
  const conteudo = body?.conteudo?.trim();
  const categoria = body?.categoria?.trim() ?? "GERAL";
  const fixado = body?.fixado ?? false;
  const unidadeId = body?.unidade_id ?? null;

  if (!titulo || !conteudo) {
    return NextResponse.json({ error: "Título e conteúdo são obrigatórios." }, { status: 400 });
  }

  if (!CATEGORIAS_VALIDAS.includes(categoria as typeof CATEGORIAS_VALIDAS[number])) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }

  // Validate unidade_id belongs to this condominio if provided
  if (unidadeId) {
    const { data: unidade } = await supabaseAdmin
      .from("unidades")
      .select("id")
      .eq("id", unidadeId)
      .eq("condominio_id", profile.condominio_id)
      .single();
    if (!unidade) {
      return NextResponse.json({ error: "Unidade não encontrada." }, { status: 400 });
    }
  }

  const { data: aviso, error: insertError } = await supabaseAdmin
    .from("avisos")
    .insert({
      condominio_id: profile.condominio_id,
      autor_id: userData.user.id,
      titulo,
      conteudo,
      categoria,
      fixado,
      unidade_id: unidadeId
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !aviso) {
    return NextResponse.json({ error: insertError?.message ?? "Não foi possível publicar o aviso." }, { status: 400 });
  }

  // Enviar email/notificação (fire-and-forget)
  void (async () => {
    try {
      const brevoApiKey = process.env.BREVO_API_KEY ?? "";
      if (!brevoApiKey) return;

      // Se direcionado para uma unidade, notifica só os moradores dessa unidade
      let moradorQuery = supabaseAdmin
        .from("perfis_usuario")
        .select("usuario_id")
        .eq("condominio_id", profile.condominio_id)
        .eq("role", "MORADOR")
        .eq("ativo", true);

      if (unidadeId) {
        moradorQuery = moradorQuery.eq("unidade_id", unidadeId);
      }

      const { data: moradorProfiles } = await moradorQuery;

      const moradorIds = (moradorProfiles ?? []).map((p) => p.usuario_id);
      if (!moradorIds.length) return;

      // Notificações in-app
      void supabaseAdmin.from("notificacoes").insert(
        moradorIds.map((uid) => ({
          usuario_id: uid,
          tipo: "AVISO",
          titulo,
          mensagem: conteudo.length > 120 ? conteudo.slice(0, 117) + "..." : conteudo,
        }))
      );

      const { data: moradores } = await supabaseAdmin
        .from("usuarios")
        .select("id, email, nome")
        .in("id", moradorIds);

      const CATEGORIA_LABELS: Record<string, string> = {
        GERAL: "📢 Geral",
        MANUTENCAO: "🔧 Manutenção",
        SEGURANCA: "🔒 Segurança",
        FINANCEIRO: "💰 Financeiro",
        EVENTO: "🎉 Evento"
      };

      const categoriaLabel = CATEGORIA_LABELS[categoria] ?? categoria;

      for (const morador of (moradores ?? []) as MoradorEmailRow[]) {
        if (!morador.email) continue;

        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sender: { name: "Condofy", email: "suportecondofy@gmail.com" },
            to: [{ email: morador.email, name: morador.nome }],
            subject: `${categoriaLabel} — ${titulo}`,
            htmlContent: `<p>Olá ${morador.nome}!</p><p>O síndico publicou um novo aviso no condomínio.</p><p><strong>${titulo}</strong></p><p>${conteudo.replace(/\n/g, "<br/>")}</p><p style="margin-top:16px;color:#64748b;font-size:13px;">Acesse o Condofy para ver todos os avisos.</p>`
          })
        }).catch((err) => {
          console.error(`[api/avisos] Falha ao enviar email para ${morador.email}:`, err);
        });
      }
    } catch (err) {
      console.error("[api/avisos] Erro ao enviar emails de aviso:", err);
    }
  })();

  return NextResponse.json({ ok: true, avisoId: aviso.id });
}