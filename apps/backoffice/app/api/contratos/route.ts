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

export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const allowed: BackofficeRole[] = ["ADMIN", "JURIDICO"];
  if (!allowed.includes(colab.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_contratos")
    .select(`
      id, tipo, status, titulo, url_arquivo,
      data_inicio, data_vencimento, notas, criado_em,
      cliente:backoffice_clientes (
        plano,
        condominio:condominios (nome, cidade)
      )
    `)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const hoje = new Date();
  const rows = (data ?? []).map((c: any) => {
    const cliente = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente;
    const condo = cliente ? (Array.isArray(cliente.condominio) ? cliente.condominio[0] : cliente.condominio) : null;
    const diasParaVencer = c.data_vencimento
      ? Math.ceil((new Date(c.data_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return { ...c, cliente: cliente ?? null, condominio: condo ?? null, dias_para_vencer: diasParaVencer };
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
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

  const { titulo, tipo, cliente_id, data_inicio, data_vencimento, url_arquivo, notas } = body;
  if (!titulo) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_contratos")
    .insert({
      titulo,
      tipo: tipo || "CONTRATO_SERVICO",
      cliente_id: cliente_id || null,
      data_inicio: data_inicio || null,
      data_vencimento: data_vencimento || null,
      url_arquivo: url_arquivo || null,
      notas: notas || null,
      status: "PENDENTE_ASSINATURA",
      criado_por_id: colab.id,
    })
    .select("id")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erro ao criar contrato." }, { status: 400 });

  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: "CRIAR_CONTRATO",
    recurso: "contrato",
    recurso_id: data.id,
    detalhes: { titulo, tipo },
  });

  return NextResponse.json({ success: true, contratoId: data.id });
}
