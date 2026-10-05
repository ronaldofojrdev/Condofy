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

// GET — listar feature flags (ADMIN + DEV)
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const allowed: BackofficeRole[] = ["ADMIN", "DEV"];
  if (!allowed.includes(colab.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_feature_flags")
    .select("id, chave, descricao, ativo, planos, atualizado_em, atualizado_por_id")
    .order("chave", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — criar nova feature flag (somente ADMIN)
export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (colab.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { chave, descricao, ativo } = body;
  if (!chave) return NextResponse.json({ error: "Chave é obrigatória." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_feature_flags")
    .insert({ chave, descricao: descricao || null, ativo: ativo ?? false, atualizado_por_id: colab.id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: "CRIAR_FEATURE_FLAG",
    recurso: "feature_flag",
    recurso_id: data.id,
    detalhes: { chave, ativo: ativo ?? false },
  });

  return NextResponse.json({ success: true, flagId: data.id });
}
