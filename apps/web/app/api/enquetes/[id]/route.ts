import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  condominio_id: string;
  role: "SINDICO" | "PORTEIRO" | "MORADOR";
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Apenas o síndico pode encerrar enquetes." }, { status: 403 });
  }

  const { data: enquete, error: fetchError } = await supabaseAdmin
    .from("enquetes")
    .select("id, condominio_id")
    .eq("id", params.id)
    .single<{ id: string; condominio_id: string }>();

  if (fetchError || !enquete || enquete.condominio_id !== profile.condominio_id) {
    return NextResponse.json({ error: "Enquete não encontrada." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { encerrada?: boolean } | null;
  if (body?.encerrada !== true) {
    return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("enquetes")
    .update({ encerrada: true })
    .eq("id", params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
