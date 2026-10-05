"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ContratoStatus = "PENDENTE_ASSINATURA" | "ATIVO" | "SUSPENSO" | "ENCERRADO";
type ContratoTipo = "CONTRATO_SERVICO" | "ADITIVO" | "DISTRATO" | "TERMO_USO";

interface Contrato {
  id: string;
  titulo: string;
  tipo: ContratoTipo;
  status: ContratoStatus;
  data_inicio: string | null;
  data_vencimento: string | null;
  url_arquivo: string | null;
  notas: string | null;
  criado_em: string;
  dias_para_vencer: number | null;
  condominio: { nome: string; cidade: string } | null;
  cliente: { plano: string } | null;
}

const STATUS_COLORS: Record<ContratoStatus, string> = {
  PENDENTE_ASSINATURA: "bg-yellow-100 text-yellow-700",
  ATIVO: "bg-green-100 text-green-700",
  SUSPENSO: "bg-orange-100 text-orange-700",
  ENCERRADO: "bg-gray-100 text-gray-500",
};
const STATUS_LABELS: Record<ContratoStatus, string> = {
  PENDENTE_ASSINATURA: "Pendente",
  ATIVO: "Ativo",
  SUSPENSO: "Suspenso",
  ENCERRADO: "Encerrado",
};
const TIPO_LABELS: Record<ContratoTipo, string> = {
  CONTRATO_SERVICO: "Contrato de Serviço",
  ADITIVO: "Aditivo",
  DISTRATO: "Distrato",
  TERMO_USO: "Termo de Uso",
};

function formatData(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function ContratosPage() {
  const router = useRouter();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState({
    titulo: "", tipo: "CONTRATO_SERVICO", cliente_id: "",
    data_inicio: "", data_vencimento: "", url_arquivo: "", notas: "",
  });

  const fetchContratos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const [resC, resCl] = await Promise.all([
        fetch("/api/contratos", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/condominios", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);

      if (resC.ok) { const j = await resC.json(); setContratos(j.data ?? []); }
      if (resCl.ok) {
        const j = await resCl.json();
        setClientes((j.data ?? []).map((c: { id: string; nome: string }) => ({ id: c.id, nome: c.nome })));
      }
    } catch (err) {
      console.error("[contratos] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchContratos(); }, [fetchContratos]);

  async function salvarContrato(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/contratos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...form, cliente_id: form.cliente_id || undefined }),
    });
    setSalvando(false);
    setShowForm(false);
    setForm({ titulo: "", tipo: "CONTRATO_SERVICO", cliente_id: "", data_inicio: "", data_vencimento: "", url_arquivo: "", notas: "" });
    await fetchContratos();
  }

  async function atualizarStatus(id: string, status: ContratoStatus) {
    setAtualizando(id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/contratos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ status }),
    });
    setAtualizando(null);
    await fetchContratos();
  }

  const alertas30 = contratos.filter(c => c.status === "ATIVO" && c.dias_para_vencer !== null && c.dias_para_vencer <= 30 && c.dias_para_vencer >= 0);
  const alertas60 = contratos.filter(c => c.status === "ATIVO" && c.dias_para_vencer !== null && c.dias_para_vencer > 30 && c.dias_para_vencer <= 60);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Jurídico</p>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contratos.length} contrato{contratos.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] transition"
        >
          + Novo contrato
        </button>
      </div>

      {/* Alertas de vencimento */}
      {alertas30.length > 0 && (
        <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          🔴 <strong>{alertas30.length}</strong> contrato{alertas30.length > 1 ? "s" : ""} vence{alertas30.length > 1 ? "m" : ""} em até 30 dias: {alertas30.map(c => c.titulo).join(", ")}
        </div>
      )}
      {alertas60.length > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
          🟠 <strong>{alertas60.length}</strong> contrato{alertas60.length > 1 ? "s" : ""} vence{alertas60.length > 1 ? "m" : ""} em 30–60 dias
        </div>
      )}

      {/* Formulário inline */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#1A3A5C]/20 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Novo contrato</h3>
          <form onSubmit={salvarContrato} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
              <input required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Contrato de Serviço — Residencial Teste"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none">
                {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
              <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none">
                <option value="">Sem cliente específico</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Início</label>
              <input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vencimento</label>
              <input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">URL do arquivo (PDF)</label>
              <input type="url" value={form.url_arquivo} onChange={e => setForm(f => ({ ...f, url_arquivo: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={salvando}
                className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] disabled:opacity-50">
                {salvando ? "Salvando..." : "Criar contrato"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : contratos.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum contrato cadastrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Contrato</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Vencimento</th>
                <th className="text-left px-4 py-3">Arquivo</th>
                <th className="text-left px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map(c => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.titulo}</p>
                    {c.condominio && <p className="text-xs text-gray-400">{c.condominio.nome} · {c.condominio.cidade}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{TIPO_LABELS[c.tipo]}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.data_vencimento ? (
                      <div>
                        <p className={c.dias_para_vencer !== null && c.dias_para_vencer <= 30 ? "text-red-600 font-semibold" : c.dias_para_vencer !== null && c.dias_para_vencer <= 60 ? "text-orange-600" : "text-gray-600"}>
                          {formatData(c.data_vencimento)}
                        </p>
                        {c.dias_para_vencer !== null && c.dias_para_vencer >= 0 && c.status === "ATIVO" && (
                          <p className="text-xs text-gray-400">{c.dias_para_vencer}d restantes</p>
                        )}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.url_arquivo ? (
                      <a href={c.url_arquivo} target="_blank" rel="noopener noreferrer"
                        className="text-[#1A3A5C] text-xs hover:underline">📄 Ver PDF</a>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "PENDENTE_ASSINATURA" && (
                      <button onClick={() => atualizarStatus(c.id, "ATIVO")} disabled={atualizando === c.id}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {atualizando === c.id ? "..." : "Ativar"}
                      </button>
                    )}
                    {c.status === "ATIVO" && (
                      <button onClick={() => atualizarStatus(c.id, "ENCERRADO")} disabled={atualizando === c.id}
                        className="px-3 py-1 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50">
                        {atualizando === c.id ? "..." : "Encerrar"}
                      </button>
                    )}
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
