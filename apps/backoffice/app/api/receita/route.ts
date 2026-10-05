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

// GET — métricas financeiras (MRR, ARR, churn, inadimplentes)
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const allowed: BackofficeRole[] = ["ADMIN", "FINANCEIRO"];
  if (!allowed.includes(colab.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;

  // Clientes ativos
  const { data: clientes } = await supabaseAdmin
    .from("backoffice_clientes")
    .select(`
      id,
      plano,
      valor_mensal,
      status_implementacao,
      cancelado_em,
      criado_em,
      condominio:condominios (nome, cidade, estado)
    `)
    .order("criado_em", { ascending: false });

  const clientesFormatted = (clientes ?? []).map((c: any) => {
    const condo = Array.isArray(c.condominio) ? c.condominio[0] : c.condominio;
    return { ...c, condominio: condo ?? null };
  });

  const ativos = clientesFormatted.filter((c: any) => !c.cancelado_em && c.status_implementacao === "ATIVO");
  const cancelados = clientesFormatted.filter((c: any) => c.cancelado_em);

  // MRR = soma dos valores mensais dos clientes ativos
  const mrr = ativos.reduce((acc: number, c: any) => acc + (Number(c.valor_mensal) || 0), 0);
  const arr = mrr * 12;

  // Churn do mês atual
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const churnadosMes = cancelados.filter((c: any) => new Date(c.cancelado_em) >= inicioMes);

  // Pagamentos do mês atual
  const competenciaAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: pagamentosMes } = await supabaseAdmin
    .from("backoffice_pagamentos")
    .select(`
      id,
      cliente_id,
      competencia,
      valor,
      status,
      metodo,
      pago_em,
      vencimento,
      notas,
      criado_em
    `)
    .eq("competencia", competenciaAtual)
    .order("vencimento", { ascending: true });

  // Inadimplentes: pagamentos ATRASADOS ou PENDENTES com vencimento passado
  const hoje = new Date().toISOString().split("T")[0];
  const { data: inadimplentes } = await supabaseAdmin
    .from("backoffice_pagamentos")
    .select(`
      id,
      cliente_id,
      competencia,
      valor,
      status,
      vencimento,
      cliente:backoffice_clientes (
        plano,
        condominio:condominios (nome, cidade)
      )
    `)
    .in("status", ["ATRASADO", "PENDENTE"])
    .lt("vencimento", hoje)
    .order("vencimento", { ascending: true });

  const inadimplentesFormatted = (inadimplentes ?? []).map((p: any) => {
    const cliente = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente;
    const condo = cliente ? (Array.isArray(cliente.condominio) ? cliente.condominio[0] : cliente.condominio) : null;
    const diasAtraso = Math.floor((new Date().getTime() - new Date(p.vencimento).getTime()) / (1000 * 60 * 60 * 24));
    return { ...p, cliente: cliente ?? null, condominio: condo ?? null, dias_atraso: diasAtraso };
  });

  // Receita recebida no mês
  const receitaMes = (pagamentosMes ?? [])
    .filter((p: any) => p.status === "PAGO")
    .reduce((acc: number, p: any) => acc + Number(p.valor), 0);

  return NextResponse.json({
    data: {
      mrr,
      arr,
      total_ativos: ativos.length,
      total_cancelados: cancelados.length,
      churn_mes: churnadosMes.length,
      receita_mes: receitaMes,
      inadimplentes: inadimplentesFormatted,
      clientes: clientesFormatted,
      pagamentos_mes: pagamentosMes ?? [],
    },
  });
}
