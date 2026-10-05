import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  condominio_id: string;
  role: "SINDICO" | "PORTEIRO" | "MORADOR";
};

type EnqueteRow = {
  id: string;
  condominio_id: string;
  opcoes: string[];
  encerrada: boolean;
  encerra_em: string | null;
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

  const { data: enquete, error: enqueteError } = await supabaseAdmin
    .from("enquetes")
    .select("id, condominio_id, opcoes, encerrada, encerra_em")
    .eq("id", params.id)
    .single<EnqueteRow>();

  if (enqueteError || !enquete || enquete.condominio_id !== profile.condominio_id) {
    return NextResponse.json({ error: "Enquete não encontrada." }, { status: 404 });
  }

  if (enquete.encerrada) {
    return NextResponse.json({ error: "Esta enquete está encerrada." }, { status: 400 });
  }

  if (enquete.encerra_em && new Date(enquete.encerra_em) < new Date()) {
    return NextResponse.json({ error: "Esta enquete está encerrada." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { opcao_index?: number } | null;
  const opcaoIndex = body?.opcao_index;

  if (opcaoIndex === undefined || opcaoIndex === null || !Number.isInteger(opcaoIndex)) {
    return NextResponse.json({ error: "Opção inválida." }, { status: 400 });
  }

  if (opcaoIndex < 0 || opcaoIndex >= enquete.opcoes.length) {
    return NextResponse.json({ error: "Opção inválida." }, { status: 400 });
  }

  const { error: insertError } = await supabaseAdmin.from("votos_enquete").insert({
    enquete_id: enquete.id,
    usuario_id: userData.user.id,
    opcao_index: opcaoIndex,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Você já votou nesta enquete." }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
