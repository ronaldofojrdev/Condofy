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

// PATCH — toggle ativo ou atualizar descricao (ADMIN + DEV)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const allowed: BackofficeRole[] = ["ADMIN", "DEV"];
  if (!allowed.includes(colab.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;
  const updates: Record<string, any> = { atualizado_por_id: colab.id };
  if (body.ativo !== undefined) updates.ativo = body.ativo;
  if (body.descricao !== undefined) updates.descricao = body.descricao;
  if (body.planos !== undefined) updates.planos = body.planos;

  const { error } = await supabaseAdmin
    .from("backoffice_feature_flags")
    .update(updates)
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: body.ativo !== undefined ? `FEATURE_FLAG_${body.ativo ? "ON" : "OFF"}` : "EDITAR_FEATURE_FLAG",
    recurso: "feature_flag",
    recurso_id: params.id,
    detalhes: { ativo: body.ativo },
  });

  return NextResponse.json({ success: true });
}
