"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type LgpdStatus = "PENDENTE" | "EM_ANALISE" | "CONCLUIDO" | "REJEITADO";
type LgpdTipo = "ACESSO" | "RETIFICACAO" | "EXCLUSAO" | "PORTABILIDADE" | "OPOSICAO" | "OUTRO";

interface Solicitacao {
  id: string;
  tipo: LgpdTipo;
  status: LgpdStatus;
  solicitante_nome: string;
  solicitante_email: string;
  descricao: string | null;
  prazo_legal: string;
  resolvido_em: string | null;
  notas_internas: string | null;
  criado_em: string;
  dias_restantes: number;
  condominio: { nome: string; cidade: string } | null;
  resolvido_por: { nome: string } | null;
}

const STATUS_COLORS: Record<LgpdStatus, string> = {
  PENDENTE: "bg-yellow-100 text-yellow-700",
  EM_ANALISE: "bg-blue-100 text-blue-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  REJEITADO: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<LgpdStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANALISE: "Em análise",
  CONCLUIDO: "Concluído",
  REJEITADO: "Rejeitado",
};
const TIPO_LABELS: Record<LgpdTipo, string> = {
  ACESSO: "Acesso aos dados",
  RETIFICACAO: "Retificação",
  EXCLUSAO: "Exclusão",
  PORTABILIDADE: "Portabilidade",
  OPOSICAO: "Oposição",
  OUTRO: "Outro",
};

function formatData(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function LgpdPage() {
  const router = useRouter();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [form, setForm] = useState({
    tipo: "ACESSO", solicitante_nome: "", solicitante_email: "", descricao: "",
  });

  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const res = await fetch("/api/lgpd", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) { const j = await res.json(); setSolicitacoes(j.data ?? []); }
    } catch (err) {
      console.error("[lgpd] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchSolicitacoes(); }, [fetchSolicitacoes]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/lgpd", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    setSalvando(false);
    setShowForm(false);
    setForm({ tipo: "ACESSO", solicitante_nome: "", solicitante_email: "", descricao: "" });
    await fetchSolicitacoes();
  }

  async function atualizarStatus(id: string, status: LgpdStatus) {
    setAtualizando(id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/lgpd/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ status }),
    });
    setAtualizando(null);
    await fetchSolicitacoes();
  }

  const pendentes = solicitacoes.filter(s => s.status === "PENDENTE" || s.status === "EM_ANALISE");
  const vencendo = pendentes.filter(s => s.dias_restantes <= 5 && s.dias_restantes >= 0);
  const vencidas = pendentes.filter(s => s.dias_restantes < 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Jurídico</p>
          <h1 className="text-2xl font-bold text-gray-900">Solicitações LGPD</h1>
          <p className="text-sm text-gray-500 mt-0.5">{solicitacoes.length} solicitaç{solicitacoes.length !== 1 ? "ões" : "ão"}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] transition">
          + Nova solicitação
        </button>
      </div>

      {/* Cards de contagem */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {(["PENDENTE", "EM_ANALISE", "CONCLUIDO", "REJEITADO"] as LgpdStatus[]).map(s => {
          const count = solicitacoes.filter(x => x.status === s).length;
          return (
            <div key={s} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</span>
            </div>
          );
        })}
      </div>

      {/* Alertas */}
      {vencidas.length > 0 && (
        <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          🔴 <strong>{vencidas.length}</strong> solicitaç{vencidas.length > 1 ? "ões" : "ão"} com prazo vencido (15 dias LGPD)
        </div>
      )}
      {vencendo.length > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
          🟠 <strong>{vencendo.length}</strong> solicitaç{vencendo.length > 1 ? "ões" : "ão"} vence{vencendo.length > 1 ? "m" : ""} em até 5 dias
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#1A3A5C]/20 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nova solicitação LGPD</h3>
          <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select required value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none">
                {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do solicitante *</label>
              <input required value={form.solicitante_nome} onChange={e => setForm(f => ({ ...f, solicitante_nome: e.target.value }))}
                placeholder="Nome completo"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail *</label>
              <input required type="email" value={form.solicitante_email} onChange={e => setForm(f => ({ ...f, solicitante_email: e.target.value }))}
                placeholder="email@exemplo.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes da solicitação"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={salvando}
                className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] disabled:opacity-50">
                {salvando ? "Salvando..." : "Registrar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : solicitacoes.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhuma solicitação LGPD registrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Solicitante</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Prazo legal</th>
                <th className="text-left px-4 py-3">Recebida em</th>
                <th className="text-left px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map(s => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.solicitante_nome}</p>
                    <p className="text-xs text-gray-400">{s.solicitante_email}</p>
                    {s.condominio && <p className="text-xs text-gray-400">{s.condominio.nome}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{TIPO_LABELS[s.tipo]}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status]}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className={s.dias_restantes < 0 ? "text-red-600 font-semibold" : s.dias_restantes <= 5 ? "text-orange-600 font-semibold" : "text-gray-600"}>
                      {formatData(s.prazo_legal)}
                    </p>
                    {s.status !== "CONCLUIDO" && s.status !== "REJEITADO" && (
                      <p className="text-xs text-gray-400">
                        {s.dias_restantes < 0 ? `${Math.abs(s.dias_restantes)}d vencido` : `${s.dias_restantes}d restantes`}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatData(s.criado_em)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {s.status === "PENDENTE" && (
                        <button onClick={() => atualizarStatus(s.id, "EM_ANALISE")} disabled={atualizando === s.id}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {atualizando === s.id ? "..." : "Analisar"}
                        </button>
                      )}
                      {(s.status === "PENDENTE" || s.status === "EM_ANALISE") && (
                        <button onClick={() => atualizarStatus(s.id, "CONCLUIDO")} disabled={atualizando === s.id}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50">
                          {atualizando === s.id ? "..." : "Concluir"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
