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

// GET — busca lead por id com interações
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const allowed: BackofficeRole[] = ["ADMIN", "COMERCIAL"];
  if (!allowed.includes(colab.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;

  const { data: lead, error } = await supabaseAdmin
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
    .eq("id", params.id)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });

  const { data: interacoes } = await supabaseAdmin
    .from("backoffice_interacoes")
    .select(`
      id,
      tipo,
      descricao,
      criado_em,
      colaborador:backoffice_colaboradores (nome)
    `)
    .eq("lead_id", params.id)
    .order("criado_em", { ascending: false });

  const responsavel = Array.isArray(lead.responsavel) ? lead.responsavel[0] : lead.responsavel;
  const interacoesFormatted = (interacoes ?? []).map((i: any) => {
    const colab = Array.isArray(i.colaborador) ? i.colaborador[0] : i.colaborador;
    return { ...i, colaborador: colab ?? null };
  });

  return NextResponse.json({ data: { ...lead, responsavel: responsavel ?? null, interacoes: interacoesFormatted } });
}

// PATCH — atualiza lead (status, dados, follow-up)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

  const supabaseAdmin = getSupabaseAdminClient()!;

  const allowedFields = [
    "nome", "cidade", "estado", "total_unidades", "origem",
    "status_pipeline", "plano_esperado", "valor_proposta",
    "follow_up_em", "motivo_perda", "responsavel_id",
  ];

  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("backoffice_leads")
    .update(updates)
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Se fechou, registra no audit
  if (updates.status_pipeline === "FECHADO") {
    await supabaseAdmin.from("backoffice_audit_log").insert({
      colaborador_id: colab.id,
      acao: "FECHAR_LEAD",
      recurso: "lead",
      recurso_id: params.id,
      detalhes: { status_pipeline: "FECHADO" },
    });
  }

  return NextResponse.json({ success: true });
}
