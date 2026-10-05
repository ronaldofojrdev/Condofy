import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type BackofficeRole = "ADMIN" | "IMPLEMENTACAO" | "COMERCIAL" | "FINANCEIRO" | "JURIDICO" | "DEV";

async function getColaborador(token: string) {
  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return null;
  const { data: userData, error } = await supabaseAuth.auth.getUser(token);
  if (error || !userData.user) return null;
  const { data: colab } = await supabaseAdmin
    .from("backoffice_colaboradores")
    .select("id, role, nome")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  return colab as { id: string; role: BackofficeRole; nome: string } | null;
}

// PATCH — atualizar role ou ativo (somente ADMIN)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (colab.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  // Não pode editar a si mesmo (segurança)
  if (params.id === colab.id) {
    return NextResponse.json({ error: "Não é possível editar sua própria conta." }, { status: 400 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;
  const updates: Record<string, any> = {};
  if (body.role !== undefined) updates.role = body.role;
  if (body.ativo !== undefined) updates.ativo = body.ativo;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("backoffice_colaboradores")
    .update(updates)
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: "EDITAR_COLABORADOR",
    recurso: "colaborador",
    recurso_id: params.id,
    detalhes: updates,
  });

  return NextResponse.json({ success: true });
}
