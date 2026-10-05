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

// PATCH — atualiza status de implementação
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!["ADMIN", "IMPLEMENTACAO"].includes(colab.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { status_implementacao, notas } = body;

  const VALID_STATUS = ["AGUARDANDO", "CONFIGURANDO", "TREINAMENTO", "ATIVO", "CANCELADO"];
  if (status_implementacao && !VALID_STATUS.includes(status_implementacao)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;

  const updates: Record<string, any> = { atualizado_em: new Date().toISOString() };
  if (status_implementacao) updates.status_implementacao = status_implementacao;
  if (notas !== undefined) updates.notas = notas;

  const { error } = await supabaseAdmin
    .from("backoffice_clientes")
    .update(updates)
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Audit log
  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: "ATUALIZAR_STATUS_IMPLEMENTACAO",
    recurso: "backoffice_clientes",
    recurso_id: params.id,
    detalhes: updates,
  });

  return NextResponse.json({ success: true });
}
