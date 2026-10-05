import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  condominio_id: string;
  role: "SINDICO" | "PORTEIRO" | "MORADOR";
};

type EnqueteRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  opcoes: string[];
  encerrada: boolean;
  encerra_em: string | null;
  criado_em: string;
};

type VotoRow = {
  enquete_id: string;
  usuario_id: string;
  opcao_index: number;
};

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
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  const { data: enquetes, error: enquetesError } = await supabaseAdmin
    .from("enquetes")
    .select("id, titulo, descricao, opcoes, encerrada, encerra_em, criado_em")
    .eq("condominio_id", profile.condominio_id)
    .order("criado_em", { ascending: false });

  if (enquetesError) return NextResponse.json({ error: enquetesError.message }, { status: 400 });

  if (!enquetes?.length) return NextResponse.json([]);

  const enqueteIds = enquetes.map((e) => e.id);

  const { data: votos } = await supabaseAdmin
    .from("votos_enquete")
    .select("enquete_id, usuario_id, opcao_index")
    .in("enquete_id", enqueteIds);

  const userId = userData.user.id;

  const result = (enquetes as EnqueteRow[]).map((enquete) => {
    const enqueteVotos = (votos ?? []) as VotoRow[];
    const votosEnquete = enqueteVotos.filter((v) => v.enquete_id === enquete.id);
    const totalVotos = votosEnquete.length;

    const contagem = enquete.opcoes.map((_: string, i: number) =>
      votosEnquete.filter((v) => v.opcao_index === i).length
    );

    const meuVoto = votosEnquete.find((v) => v.usuario_id === userId);

    return {
      id: enquete.id,
      titulo: enquete.titulo,
      descricao: enquete.descricao,
      opcoes: enquete.opcoes,
      encerrada: enquete.encerrada,
      encerra_em: enquete.encerra_em,
      criado_em: enquete.criado_em,
      total_votos: totalVotos,
      contagem,
      meu_voto: meuVoto?.opcao_index ?? null,
    };
  });

  return NextResponse.json(result);
}

type CreateBody = {
  titulo?: string;
  descricao?: string | null;
  opcoes?: string[];
  encerra_em?: string | null;
};

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
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  if (profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Apenas o síndico pode criar enquetes." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const titulo = body?.titulo?.trim();
  const descricao = body?.descricao?.trim() ?? null;
  const opcoes = body?.opcoes?.map((o) => o.trim()).filter(Boolean) ?? [];
  const encerra_em = body?.encerra_em ?? null;

  if (!titulo) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  if (opcoes.length < 2) return NextResponse.json({ error: "Mínimo de 2 opções." }, { status: 400 });
  if (opcoes.length > 6) return NextResponse.json({ error: "Máximo de 6 opções." }, { status: 400 });

  const { data: enquete, error: insertError } = await supabaseAdmin
    .from("enquetes")
    .insert({
      condominio_id: profile.condominio_id,
      criado_por: userData.user.id,
      titulo,
      descricao,
      opcoes,
      encerra_em,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !enquete) {
    return NextResponse.json({ error: insertError?.message ?? "Erro ao criar enquete." }, { status: 400 });
  }

  // Notificações in-app para moradores (fire-and-forget)
  void (async () => {
    try {
      const { data: moradorProfiles } = await supabaseAdmin
        .from("perfis_usuario")
        .select("usuario_id")
        .eq("condominio_id", profile.condominio_id)
        .eq("role", "MORADOR")
        .eq("ativo", true);

      const moradorIds = (moradorProfiles ?? []).map((p: { usuario_id: string }) => p.usuario_id);
      if (!moradorIds.length) return;

      await supabaseAdmin.from("notificacoes").insert(
        moradorIds.map((uid: string) => ({
          usuario_id: uid,
          tipo: "AVISO",
          titulo: "Nova enquete disponível",
          mensagem: `O síndico criou uma nova enquete: "${titulo}". Acesse para votar.`,
        }))
      );
    } catch (err) {
      console.error("[api/enquetes] Erro ao notificar moradores:", err);
    }
  })();

  return NextResponse.json({ ok: true, enqueteId: enquete.id });
}
