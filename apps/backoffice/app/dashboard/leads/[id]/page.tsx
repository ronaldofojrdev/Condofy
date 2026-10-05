"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pipeline = "LEAD" | "DEMO" | "PROPOSTA" | "FECHADO" | "PERDIDO";
type InteracaoTipo = "LIGACAO" | "WHATSAPP" | "REUNIAO" | "EMAIL" | "OUTRO";

interface Interacao {
  id: string;
  tipo: InteracaoTipo;
  descricao: string;
  criado_em: string;
  colaborador: { nome: string } | null;
}

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
  motivo_perda: string | null;
  criado_em: string;
  atualizado_em: string;
  responsavel: { id: string; nome: string } | null;
  interacoes: Interacao[];
}

const PIPELINE_ORDER: Pipeline[] = ["LEAD", "DEMO", "PROPOSTA", "FECHADO", "PERDIDO"];
const PIPELINE_NEXT: Partial<Record<Pipeline, Pipeline>> = {
  LEAD: "DEMO",
  DEMO: "PROPOSTA",
  PROPOSTA: "FECHADO",
};
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

const INTERACAO_ICONS: Record<InteracaoTipo, string> = {
  LIGACAO: "📞",
  WHATSAPP: "💬",
  REUNIAO: "🤝",
  EMAIL: "✉️",
  OUTRO: "📝",
};
const INTERACAO_LABELS: Record<InteracaoTipo, string> = {
  LIGACAO: "Ligação",
  WHATSAPP: "WhatsApp",
  REUNIAO: "Reunião",
  EMAIL: "E-mail",
  OUTRO: "Outro",
};

const ORIGEM_LABELS: Record<string, string> = {
  INDICACAO: "Indicação",
  SITE: "Site",
  WHATSAPP: "WhatsApp",
  COLD_OUTREACH: "Outreach",
  EVENTO: "Evento",
  OUTRO: "Outro",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params?.id as string;


  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [movendo, setMovendo] = useState(false);
  const [showInteracaoForm, setShowInteracaoForm] = useState(false);
  const [interacaoForm, setInteracaoForm] = useState({ tipo: "LIGACAO" as InteracaoTipo, descricao: "" });
  const [salvandoInteracao, setSalvandoInteracao] = useState(false);
  const [showPerdidoModal, setShowPerdidoModal] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");

  const fetchLead = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const res = await fetch(`/api/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setLead(json.data);
      }
    } catch (err) {
      console.error("[lead-detail] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router, leadId]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  async function moverPipeline(novoStatus: Pipeline) {
    setMovendo(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ status_pipeline: novoStatus, motivo_perda: novoStatus === "PERDIDO" ? motivoPerda : null }),
    });

    setMovendo(false);
    setShowPerdidoModal(false);
    await fetchLead();
  }

  async function salvarInteracao(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoInteracao(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`/api/leads/${leadId}/interacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(interacaoForm),
    });

    setSalvandoInteracao(false);
    setShowInteracaoForm(false);
    setInteracaoForm({ tipo: "LIGACAO", descricao: "" });
    await fetchLead();
  }

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>;
  if (!lead) return <div className="p-8 text-center text-gray-400 text-sm">Lead não encontrado.</div>;

  const proximoStatus = PIPELINE_NEXT[lead.status_pipeline];
  const isTerminal = lead.status_pipeline === "FECHADO" || lead.status_pipeline === "PERDIDO";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
        ← Leads
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Comercial</p>
          <h1 className="text-2xl font-bold text-gray-900">{lead.nome}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{lead.cidade}{lead.estado ? `, ${lead.estado}` : ""}</p>
        </div>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${PIPELINE_COLORS[lead.status_pipeline]}`}>
          {PIPELINE_LABELS[lead.status_pipeline]}
        </span>
      </div>

      {/* Pipeline progress */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-1">
          {PIPELINE_ORDER.filter(s => s !== "PERDIDO").map((s, i) => {
            const filteredOrder = PIPELINE_ORDER.filter(x => x !== "PERDIDO") as Pipeline[];
            const idx = filteredOrder.indexOf(lead.status_pipeline as Pipeline);
            const current = s === lead.status_pipeline;
            const done = filteredOrder.indexOf(s as Pipeline) < idx && lead.status_pipeline !== "PERDIDO";
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                  current ? "bg-[#1A3A5C] text-white" : done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}>
                  {done ? "✓ " : ""}{PIPELINE_LABELS[s]}
                </div>
                {i < 3 && <div className={`w-4 h-0.5 ${done ? "bg-green-300" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>
        {lead.status_pipeline === "PERDIDO" && (
          <div className="mt-3 text-sm text-red-600">
            ❌ Lead perdido{lead.motivo_perda ? ` — ${lead.motivo_perda}` : ""}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Info */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Informações</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Origem</p>
              <p className="text-gray-800">{ORIGEM_LABELS[lead.origem] ?? lead.origem}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Unidades</p>
              <p className="text-gray-800">{lead.total_unidades ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Plano esperado</p>
              <p className="text-gray-800">{lead.plano_esperado ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Valor proposta</p>
              <p className="text-gray-800">
                {lead.valor_proposta ? `R$ ${Number(lead.valor_proposta).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Responsável</p>
              <p className="text-gray-800">{lead.responsavel?.nome ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Follow-up</p>
              <p className={`${lead.follow_up_em && new Date(lead.follow_up_em) < new Date() ? "text-orange-600 font-semibold" : "text-gray-800"}`}>
                {formatDate(lead.follow_up_em)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Cadastrado em</p>
              <p className="text-gray-800">{formatDate(lead.criado_em)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Última atualização</p>
              <p className="text-gray-800">{formatDate(lead.atualizado_em)}</p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="space-y-3">
          {!isTerminal && proximoStatus && (
            <button
              onClick={() => moverPipeline(proximoStatus)}
              disabled={movendo}
              className="w-full px-4 py-3 bg-[#1A3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#15304f] transition disabled:opacity-50"
            >
              {movendo ? "Movendo..." : `Mover para ${PIPELINE_LABELS[proximoStatus]}`}
            </button>
          )}
          {!isTerminal && (
            <button
              onClick={() => setShowPerdidoModal(true)}
              className="w-full px-4 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition"
            >
              Marcar como perdido
            </button>
          )}
          <button
            onClick={() => setShowInteracaoForm(true)}
            className="w-full px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            + Registrar interação
          </button>
        </div>
      </div>

      {/* Formulário de interação */}
      {showInteracaoForm && (
        <div className="bg-white rounded-xl border border-[#1A3A5C]/20 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nova interação</h3>
          <form onSubmit={salvarInteracao} className="space-y-3">
            <div className="flex gap-2">
              {(["LIGACAO", "WHATSAPP", "REUNIAO", "EMAIL", "OUTRO"] as InteracaoTipo[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInteracaoForm(f => ({ ...f, tipo: t }))}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    interacaoForm.tipo === t ? "bg-[#1A3A5C] text-white border-[#1A3A5C]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {INTERACAO_ICONS[t]} {INTERACAO_LABELS[t]}
                </button>
              ))}
            </div>
            <textarea
              required
              value={interacaoForm.descricao}
              onChange={e => setInteracaoForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descreva o contato..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowInteracaoForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoInteracao}
                className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] transition disabled:opacity-50"
              >
                {salvandoInteracao ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Histórico de interações */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Histórico de interações</h2>
        {lead.interacoes.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma interação registrada.</p>
        ) : (
          <div className="space-y-3">
            {lead.interacoes.map(i => (
              <div key={i.id} className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-base">
                  {INTERACAO_ICONS[i.tipo]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-gray-700">{INTERACAO_LABELS[i.tipo]}</span>
                    <span className="text-gray-400 text-xs">{i.colaborador?.nome ?? ""}</span>
                    <span className="text-gray-300 text-xs ml-auto">{formatDateTime(i.criado_em)}</span>
                  </div>
                  <p className="text-gray-600">{i.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal perdido */}
      {showPerdidoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Marcar como perdido</h3>
            <p className="text-sm text-gray-500 mb-4">Informe o motivo da perda (opcional).</p>
            <textarea
              value={motivoPerda}
              onChange={e => setMotivoPerda(e.target.value)}
              placeholder="Ex: Preço, concorrência, não tinha interesse..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPerdidoModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => moverPipeline("PERDIDO")}
                disabled={movendo}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {movendo ? "Salvando..." : "Confirmar perda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
