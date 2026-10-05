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

// GET — lista leads
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // COMERCIAL e acima podem ver leads
  const allowed: BackofficeRole[] = ["ADMIN", "COMERCIAL"];
  if (!allowed.includes(colab.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  let query = supabaseAdmin
    .from("backoffice_leads")
    .select(`
      id,
      nome,
      cidade,
      estado,
      total_unidades,
      origem,
      status_pipeline,
      plano_esperado,
      valor_proposta,
      follow_up_em,
      motivo_perda,
      criado_em,
      atualizado_em,
      responsavel:backoffice_colaboradores!backoffice_leads_responsavel_id_fkey (id, nome)
    `)
    .order("atualizado_em", { ascending: false });

  if (status) query = query.eq("status_pipeline", status);
  if (q) query = query.ilike("nome", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []).map((d: any) => {
    const responsavel = Array.isArray(d.responsavel) ? d.responsavel[0] : d.responsavel;
    return { ...d, responsavel: responsavel ?? null };
  });

  return NextResponse.json({ data: rows });
}

// POST — cria lead
export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const allowed: BackofficeRole[] = ["ADMIN", "COMERCIAL"];
  if (!allowed.includes(colab.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { nome, cidade, estado, total_unidades, origem, plano_esperado, valor_proposta, follow_up_em, responsavelId } = body;

  if (!nome || !cidade) {
    return NextResponse.json({ error: "Nome e cidade são obrigatórios." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;

  const { data: lead, error } = await supabaseAdmin
    .from("backoffice_leads")
    .insert({
      nome,
      cidade,
      estado: estado || null,
      total_unidades: total_unidades ? Number(total_unidades) : null,
      origem: origem || "OUTRO",
      plano_esperado: plano_esperado || null,
      valor_proposta: valor_proposta ? Number(valor_proposta) : null,
      follow_up_em: follow_up_em || null,
      responsavel_id: responsavelId || colab.id,
      criado_por_id: colab.id,
      status_pipeline: "LEAD",
    })
    .select("id")
    .single();

  if (error || !lead) return NextResponse.json({ error: error?.message ?? "Erro ao criar lead." }, { status: 400 });

  // Audit log
  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: "CRIAR_LEAD",
    recurso: "lead",
    recurso_id: lead.id,
    detalhes: { nome, cidade, origem },
  });

  return NextResponse.json({ success: true, leadId: lead.id });
}
