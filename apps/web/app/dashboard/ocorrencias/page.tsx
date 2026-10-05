"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type OcorrenciaStatus = "ABERTA" | "EM_ANDAMENTO" | "RESOLVIDA";
type OcorrenciaTipo = "BARULHO" | "DANO" | "SEGURANCA" | "MANUTENCAO" | "OUTRO";

type Ocorrencia = {
  id: string;
  tipo: OcorrenciaTipo;
  descricao: string;
  status: OcorrenciaStatus;
  foto_url: string | null;
  anonima: boolean;
  observacao_sindico: string | null;
  criado_em: string;
  atualizado_em: string;
  unidade_numero: string | null;
  reporter_nome: string | null;
};

const TIPO_LABELS: Record<OcorrenciaTipo, string> = {
  BARULHO: "🔊 Barulho",
  DANO: "🔨 Dano",
  SEGURANCA: "🔒 Segurança",
  MANUTENCAO: "🔧 Manutenção",
  OUTRO: "📋 Outro"
};

const STATUS_LABELS: Record<OcorrenciaStatus, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDA: "Resolvida"
};

const STATUS_COLORS: Record<OcorrenciaStatus, string> = {
  ABERTA: "bg-rose-100 text-rose-700",
  EM_ANDAMENTO: "bg-amber-100 text-amber-700",
  RESOLVIDA: "bg-emerald-100 text-emerald-700"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function OcorrenciasPage() {
  const router = useRouter();
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<OcorrenciaStatus | "TODAS">("TODAS");
  const [filtroTipo, setFiltroTipo] = useState<OcorrenciaTipo | "TODOS">("TODOS");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novoStatus, setNovoStatus] = useState<OcorrenciaStatus>("ABERTA");
  const [observacao, setObservacao] = useState("");
  const [updating, setUpdating] = useState(false);

  async function fetchOcorrencias(token: string) {
    const res = await fetch("/api/ocorrencias", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error ?? "Erro ao carregar ocorrências.");
    }
    return res.json() as Promise<Ocorrencia[]>;
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("perfis_usuario")
        .select("role")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<{ role: string }>();

      if (profile?.role !== "SINDICO") { router.replace("/dashboard"); return; }

      try {
        const data = await fetchOcorrencias(sessionData.session.access_token);
        setOcorrencias(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar.");
      }
      setLoading(false);
    }
    void init();
  }, [router]);

  const filtered = ocorrencias.filter((o) => {
    const matchStatus = filtroStatus === "TODAS" || o.status === filtroStatus;
    const matchTipo = filtroTipo === "TODOS" || o.tipo === filtroTipo;
    return matchStatus && matchTipo;
  });

  const selected = ocorrencias.find((o) => o.id === selectedId) ?? null;

  async function handleUpdate() {
    if (!selectedId) return;
    setUpdating(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setUpdating(false); return; }

    const res = await fetch(`/api/ocorrencias/${selectedId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({ status: novoStatus, observacao_sindico: observacao || null })
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao atualizar.");
      setUpdating(false);
      return;
    }

    // Atualizar localmente
    setOcorrencias((prev) =>
      prev.map((o) =>
        o.id === selectedId
          ? { ...o, status: novoStatus, observacao_sindico: observacao || null, atualizado_em: new Date().toISOString() }
          : o
      )
    );
    setSelectedId(null);
    setUpdating(false);
  }

  function openModal(o: Ocorrencia) {
    setSelectedId(o.id);
    setNovoStatus(o.status);
    setObservacao(o.observacao_sindico ?? "");
  }

  const counts = {
    ABERTA: ocorrencias.filter((o) => o.status === "ABERTA").length,
    EM_ANDAMENTO: ocorrencias.filter((o) => o.status === "EM_ANDAMENTO").length,
    RESOLVIDA: ocorrencias.filter((o) => o.status === "RESOLVIDA").length
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Gestão</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Livro de Ocorrências</h1>
          <p className="mt-2 text-sm text-slate-500">Acompanhe e responda às ocorrências do condomínio.</p>

          {/* Contadores */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center">
              <p className="text-2xl font-bold text-rose-700">{counts.ABERTA}</p>
              <p className="mt-1 text-xs font-medium text-rose-600">Abertas</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{counts.EM_ANDAMENTO}</p>
              <p className="mt-1 text-xs font-medium text-amber-600">Em andamento</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{counts.RESOLVIDA}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600">Resolvidas</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as OcorrenciaStatus | "TODAS")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
          >
            <option value="TODAS">Todos os status</option>
            <option value="ABERTA">Abertas</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="RESOLVIDA">Resolvidas</option>
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as OcorrenciaTipo | "TODOS")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
          >
            <option value="TODOS">Todos os tipos</option>
            <option value="BARULHO">Barulho</option>
            <option value="DANO">Dano</option>
            <option value="SEGURANCA">Segurança</option>
            <option value="MANUTENCAO">Manutenção</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>

        {/* Erro */}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-slate-400">Carregando ocorrências...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-400">Nenhuma ocorrência encontrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((o) => (
              <article key={o.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{TIPO_LABELS[o.tipo]}</span>
                      {o.anonima && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Anônimo</span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 line-clamp-2">{o.descricao}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      {o.unidade_numero && <span>Unidade {o.unidade_numero}</span>}
                      <span>{o.reporter_nome}</span>
                      <span>{formatDate(o.criado_em)}</span>
                    </div>
                    {o.observacao_sindico && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <span className="font-medium">Obs. síndico:</span> {o.observacao_sindico}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal(o)}
                    className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Gerenciar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modal de atualização */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Atualizar ocorrência</h2>
            <p className="mt-1 text-sm text-slate-500">{TIPO_LABELS[selected.tipo]}</p>
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{selected.descricao}</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value as OcorrenciaStatus)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                >
                  <option value="ABERTA">Aberta</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="RESOLVIDA">Resolvida</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Observação <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={3}
                  placeholder="Informe o morador sobre as providências tomadas..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleUpdate()}
                disabled={updating}
                className="flex-1 rounded-xl bg-[#1A3A5C] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60"
              >
                {updating ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
