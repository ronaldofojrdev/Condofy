"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pipeline = "LEAD" | "DEMO" | "PROPOSTA" | "FECHADO" | "PERDIDO";

interface Lead {
  id: string;
  nome: string;
  cidade: string;
  estado: string | null;
  total_unidades: number | null;
  origem: string;
  status_pipeline: Pipeline;
  plano_esperado: string | null;
  valor_proposta: number | null;
  follow_up_em: string | null;
  criado_em: string;
  atualizado_em: string;
  responsavel: { id: string; nome: string } | null;
}

const PIPELINE_LABELS: Record<Pipeline, string> = {
  LEAD: "Lead",
  DEMO: "Demo",
  PROPOSTA: "Proposta",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

const PIPELINE_COLORS: Record<Pipeline, string> = {
  LEAD: "bg-blue-100 text-blue-700",
  DEMO: "bg-purple-100 text-purple-700",
  PROPOSTA: "bg-yellow-100 text-yellow-700",
  FECHADO: "bg-green-100 text-green-700",
  PERDIDO: "bg-red-100 text-red-700",
};

const ORIGEM_LABELS: Record<string, string> = {
  INDICACAO: "Indicação",
  SITE: "Site",
  WHATSAPP: "WhatsApp",
  COLD_OUTREACH: "Outreach",
  EVENTO: "Evento",
  OUTRO: "Outro",
};

const PIPELINE_ORDER: Pipeline[] = ["LEAD", "DEMO", "PROPOSTA", "FECHADO", "PERDIDO"];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function isAtrasado(follow_up_em: string | null) {
  if (!follow_up_em) return false;
  return new Date(follow_up_em) < new Date();
}

export default function LeadsPage() {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Pipeline | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (q) params.set("q", q);

      const res = await fetch(`/api/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setLeads(json.data ?? []);
      }
    } catch (err) {
      console.error("[leads] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router, statusFilter, q]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Contagens por status
  const counts = PIPELINE_ORDER.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status_pipeline === s).length;
    return acc;
  }, {} as Record<Pipeline, number>);

  // Leads com follow-up atrasado
  const atrasados = leads.filter(l => isAtrasado(l.follow_up_em) && l.status_pipeline !== "FECHADO" && l.status_pipeline !== "PERDIDO");

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Comercial</p>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} lead{leads.length !== 1 ? "s" : ""} cadastrado{leads.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => router.push("/dashboard/leads/novo")}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] transition"
        >
          + Novo lead
        </button>
      </div>

      {/* Alerta de follow-ups atrasados */}
      {atrasados.length > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
          <span>⚠️</span>
          <span><strong>{atrasados.length}</strong> lead{atrasados.length > 1 ? "s" : ""} com follow-up atrasado</span>
        </div>
      )}

      {/* Cards de status */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {PIPELINE_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`rounded-xl p-4 text-left border-2 transition ${
              statusFilter === s ? "border-[#1A3A5C] bg-white" : "border-transparent bg-white"
            } shadow-sm hover:shadow`}
          >
            <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
            <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${PIPELINE_COLORS[s]}`}>
              {PIPELINE_LABELS[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome do lead..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20 bg-white"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum lead encontrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Lead</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Responsável</th>
                <th className="text-left px-4 py-3">Follow-up</th>
                <th className="text-left px-4 py-3">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lead.nome}</p>
                    <p className="text-gray-400 text-xs">{lead.cidade}{lead.estado ? `, ${lead.estado}` : ""}{lead.total_unidades ? ` · ${lead.total_unidades} un.` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{ORIGEM_LABELS[lead.origem] ?? lead.origem}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PIPELINE_COLORS[lead.status_pipeline]}`}>
                      {PIPELINE_LABELS[lead.status_pipeline]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.responsavel?.nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    {lead.follow_up_em ? (
                      <span className={isAtrasado(lead.follow_up_em) ? "text-orange-600 font-semibold" : "text-gray-600"}>
                        {isAtrasado(lead.follow_up_em) ? "⚠️ " : ""}{formatDate(lead.follow_up_em)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(lead.atualizado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
