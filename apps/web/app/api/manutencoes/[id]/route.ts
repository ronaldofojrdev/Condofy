import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = { condominio_id: string; role: "SINDICO" | "PORTEIRO" | "MORADOR" };

async function getProfileAndAdmin(token: string) {
  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return null;

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id || profile.role !== "SINDICO") return null;

  return { profile, supabaseAdmin };
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const ctx = await getProfileAndAdmin(token);
  if (!ctx) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { profile, supabaseAdmin } = ctx;

  const { data: manutencao } = await supabaseAdmin
    .from("manutencoes")
    .select("id, condominio_id")
    .eq("id", params.id)
    .single<{ id: string; condominio_id: string }>();

  if (!manutencao || manutencao.condominio_id !== profile.condominio_id) {
    return NextResponse.json({ error: "Manutenção não encontrada." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { concluida?: boolean } | null;
  const concluida = body?.concluida === true;

  const { error: updateError } = await supabaseAdmin
    .from("manutencoes")
    .update({ concluida, concluida_em: concluida ? new Date().toISOString() : null })
    .eq("id", params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const ctx = await getProfileAndAdmin(token);
  if (!ctx) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { profile, supabaseAdmin } = ctx;

  const { data: manutencao } = await supabaseAdmin
    .from("manutencoes")
    .select("id, condominio_id")
    .eq("id", params.id)
    .single<{ id: string; condominio_id: string }>();

  if (!manutencao || manutencao.condominio_id !== profile.condominio_id) {
    return NextResponse.json({ error: "Manutenção não encontrada." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin.from("manutencoes").delete().eq("id", params.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
