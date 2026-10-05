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

// GET — log de auditoria (somente ADMIN)
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (colab.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_audit_log")
    .select(`
      id, acao, recurso, recurso_id, detalhes, criado_em,
      colaborador:backoffice_colaboradores (nome, role)
    `)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    colaborador: Array.isArray(r.colaborador) ? r.colaborador[0] : r.colaborador,
  }));

  return NextResponse.json({ data: rows });
}
