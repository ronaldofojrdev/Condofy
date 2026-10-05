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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const allowed: BackofficeRole[] = ["ADMIN", "JURIDICO"];
  if (!allowed.includes(colab.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;
  const allowed_fields = ["titulo", "tipo", "status", "data_inicio", "data_vencimento", "url_arquivo", "notas", "cliente_id"];
  const updates: Record<string, any> = {};
  for (const f of allowed_fields) {
    if (f in body) updates[f] = body[f];
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });

  const { error } = await supabaseAdmin.from("backoffice_contratos").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
