"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface Inadimplente {
  id: string;
  cliente_id: string;
  competencia: string;
  valor: number;
  status: string;
  vencimento: string;
  dias_atraso: number;
  condominio: { nome: string; cidade: string } | null;
}

interface Cliente {
  id: string;
  plano: string;
  valor_mensal: number | null;
  status_implementacao: string;
  cancelado_em: string | null;
  criado_em: string;
  condominio: { nome: string; cidade: string; estado: string } | null;
}

interface Pagamento {
  id: string;
  cliente_id: string;
  competencia: string;
  valor: number;
  status: string;
  metodo: string | null;
  pago_em: string | null;
  vencimento: string;
}

interface Metricas {
  mrr: number;
  arr: number;
  total_ativos: number;
  total_cancelados: number;
  churn_mes: number;
  receita_mes: number;
  inadimplentes: Inadimplente[];
  clientes: Cliente[];
  pagamentos_mes: Pagamento[];
}

const STATUS_COLORS: Record<string, string> = {
  PAGO: "bg-green-100 text-green-700",
  PENDENTE: "bg-yellow-100 text-yellow-700",
  ATRASADO: "bg-red-100 text-red-700",
  CANCELADO: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  PAGO: "Pago",
  PENDENTE: "Pendente",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
};

const IMPL_STATUS_COLORS: Record<string, string> = {
  AGUARDANDO: "bg-gray-100 text-gray-500",
  CONFIGURANDO: "bg-blue-100 text-blue-700",
  TREINAMENTO: "bg-yellow-100 text-yellow-700",
  ATIVO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
};

const IMPL_STATUS_LABELS: Record<string, string> = {
  AGUARDANDO: "Aguardando",
  CONFIGURANDO: "Configurando",
  TREINAMENTO: "Treinamento",
  ATIVO: "Ativo",
  CANCELADO: "Cancelado",
};

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatCompetencia(iso: string) {
  const [ano, mes] = iso.split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

type Tab = "visao-geral" | "clientes" | "inadimplentes" | "pagamentos";

export default function ReceitaPage() {
  const router = useRouter();
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("visao-geral");
  const [marcandoPago, setMarcandoPago] = useState<string | null>(null);

  const fetchMetricas = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const res = await fetch("/api/receita", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setMetricas(json.data);
      }
    } catch (err) {
      console.error("[receita] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchMetricas(); }, [fetchMetricas]);

  async function marcarPago(pagamentoId: string, metodo = "PIX") {
    setMarcandoPago(pagamentoId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`/api/pagamentos/${pagamentoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ status: "PAGO", metodo }),
    });

    setMarcandoPago(null);
    await fetchMetricas();
  }

  if (loading || !metricas) return <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>;

  const m = metricas;
  const taxaChurn = m.total_ativos > 0 ? ((m.churn_mes / (m.total_ativos + m.churn_mes)) * 100).toFixed(1) : "0.0";

  const TABS: { key: Tab; label: string }[] = [
    { key: "visao-geral", label: "Visão Geral" },
    { key: "clientes", label: `Clientes (${m.clientes.length})` },
    { key: "inadimplentes", label: `Inadimplentes (${m.inadimplentes.length})` },
    { key: "pagamentos", label: `Cobranças do Mês (${m.pagamentos_mes.length})` },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Financeiro</p>
        <h1 className="text-2xl font-bold text-gray-900">Receita</h1>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">MRR</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoeda(m.mrr)}</p>
          <p className="text-xs text-gray-400 mt-1">{m.total_ativos} cliente{m.total_ativos !== 1 ? "s" : ""} ativos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">ARR</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoeda(m.arr)}</p>
          <p className="text-xs text-gray-400 mt-1">Receita anual projetada</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Recebido este mês</p>
          <p className="text-2xl font-bold text-green-600">{formatMoeda(m.receita_mes)}</p>
          <p className="text-xs text-gray-400 mt-1">Pagamentos confirmados</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Churn (mês)</p>
          <p className="text-2xl font-bold text-red-500">{taxaChurn}%</p>
          <p className="text-xs text-gray-400 mt-1">{m.churn_mes} cancelamento{m.churn_mes !== 1 ? "s" : ""} no mês</p>
        </div>
      </div>

      {/* Alerta inadimplentes */}
      {m.inadimplentes.length > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>⚠️</span>
          <span><strong>{m.inadimplentes.length}</strong> pagamento{m.inadimplentes.length > 1 ? "s" : ""} em atraso · Total: {formatMoeda(m.inadimplentes.reduce((a, i) => a + i.valor, 0))}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Visão Geral */}
      {tab === "visao-geral" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Clientes por plano</h3>
            {["Essencial", "Profissional", "Enterprise"].map(plano => {
              const count = m.clientes.filter(c => c.plano === plano && !c.cancelado_em).length;
              const mrr_plano = m.clientes.filter(c => c.plano === plano && !c.cancelado_em).reduce((a, c) => a + (Number(c.valor_mensal) || 0), 0);
              return (
                <div key={plano} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{plano}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">{count} cliente{count !== 1 ? "s" : ""}</span>
                    {mrr_plano > 0 && <p className="text-xs text-gray-400">{formatMoeda(mrr_plano)}/mês</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Status das cobranças do mês</h3>
            {["PAGO", "PENDENTE", "ATRASADO", "CANCELADO"].map(s => {
              const count = m.pagamentos_mes.filter(p => p.status === s).length;
              const total = m.pagamentos_mes.filter(p => p.status === s).reduce((a, p) => a + Number(p.valor), 0);
              return (
                <div key={s} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                    {total > 0 && <p className="text-xs text-gray-400">{formatMoeda(total)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clientes */}
      {tab === "clientes" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Condomínio</th>
                <th className="text-left px-4 py-3">Plano</th>
                <th className="text-left px-4 py-3">Valor/mês</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Cliente desde</th>
              </tr>
            </thead>
            <tbody>
              {m.clientes.map(c => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.condominio?.nome ?? "—"}</p>
                    <p className="text-xs text-gray-400">{c.condominio?.cidade}{c.condominio?.estado ? `, ${c.condominio.estado}` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.plano}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {c.valor_mensal ? formatMoeda(c.valor_mensal) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${IMPL_STATUS_COLORS[c.status_implementacao]}`}>
                      {IMPL_STATUS_LABELS[c.status_implementacao] ?? c.status_implementacao}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatData(c.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inadimplentes */}
      {tab === "inadimplentes" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {m.inadimplentes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">✅ Nenhum pagamento em atraso</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Condomínio</th>
                  <th className="text-left px-4 py-3">Competência</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Vencimento</th>
                  <th className="text-left px-4 py-3">Dias em atraso</th>
                  <th className="text-left px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {m.inadimplentes.map(p => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.condominio?.nome ?? "—"}</p>
                      <p className="text-xs text-gray-400">{p.condominio?.cidade}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatCompetencia(p.competencia)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatMoeda(p.valor)}</td>
                    <td className="px-4 py-3 text-red-600">{formatData(p.vencimento)}</td>
                    <td className="px-4 py-3">
                      <span className="text-red-600 font-semibold">{p.dias_atraso}d</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => marcarPago(p.id)}
                        disabled={marcandoPago === p.id}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {marcandoPago === p.id ? "..." : "Marcar pago"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagamentos do mês */}
      {tab === "pagamentos" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {m.pagamentos_mes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Nenhuma cobrança registrada para este mês</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Vencimento</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Pago em</th>
                  <th className="text-left px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {m.pagamentos_mes.map(p => {
                  const cliente = m.clientes.find(c => c.id === p.cliente_id);
                  return (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{cliente?.condominio?.nome ?? "—"}</p>
                        <p className="text-xs text-gray-400">{cliente?.plano}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{formatMoeda(p.valor)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatData(p.vencimento)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{formatData(p.pago_em)}</td>
                      <td className="px-4 py-3">
                        {p.status !== "PAGO" && p.status !== "CANCELADO" && (
                          <button
                            onClick={() => marcarPago(p.id)}
                            disabled={marcandoPago === p.id}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {marcandoPago === p.id ? "..." : "Marcar pago"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
