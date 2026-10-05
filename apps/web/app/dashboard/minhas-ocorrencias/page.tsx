"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type OcorrenciaStatus = "ABERTA" | "EM_ANDAMENTO" | "RESOLVIDA";
type OcorrenciaTipo = "BARULHO" | "DANO" | "SEGURANCA" | "MANUTENCAO" | "OUTRO";

type Ocorrencia = {
  id: string;
  tipo: OcorrenciaTipo;
  descricao: string;
  status: OcorrenciaStatus;
  anonima: boolean;
  observacao_sindico: string | null;
  criado_em: string;
  atualizado_em: string;
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

export default function MinhasOcorrenciasPage() {
  const router = useRouter();
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form state
  const [tipo, setTipo] = useState<OcorrenciaTipo>("OUTRO");
  const [descricao, setDescricao] = useState("");
  const [anonima, setAnonima] = useState(false);

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

      if (profile?.role !== "MORADOR") { router.replace("/dashboard"); return; }

      try {
        await loadOcorrencias(sessionData.session.access_token);
      } catch {
        setError("Erro ao carregar ocorrências. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  async function loadOcorrencias(token: string) {
    const res = await fetch("/api/ocorrencias", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json() as Ocorrencia[];
      setOcorrencias(data);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!descricao.trim()) {
      setError("Descrição é obrigatória.");
      return;
    }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setSubmitting(false); return; }

    const res = await fetch("/api/ocorrencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({ tipo, descricao: descricao.trim(), anonima })
    });

    setSubmitting(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao registrar ocorrência.");
      return;
    }

    setDescricao("");
    setTipo("OUTRO");
    setAnonima(false);
    setShowForm(false);
    setSuccessMsg("Ocorrência registrada! O síndico foi notificado.");
    await loadOcorrencias(sessionData.session.access_token);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Mural</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Minhas Ocorrências</h1>
              <p className="mt-2 text-sm text-slate-500">Registre e acompanhe ocorrências no condomínio.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(true); setError(""); setSuccessMsg(""); }}
              className="shrink-0 rounded-xl bg-[#1A3A5C] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#15314d]"
            >
              + Nova
            </button>
          </div>
        </div>

        {/* Mensagens */}
        {successMsg && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMsg}</p>
        )}
        {error && !showForm && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {/* Formulário */}
        {showForm && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Nova ocorrência</h2>
            <p className="mt-1 text-sm text-slate-500">Descreva o que aconteceu. O síndico será notificado.</p>

            {error && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as OcorrenciaTipo)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                >
                  <option value="BARULHO">🔊 Barulho</option>
                  <option value="DANO">🔨 Dano</option>
                  <option value="SEGURANCA">🔒 Segurança</option>
                  <option value="MANUTENCAO">🔧 Manutenção</option>
                  <option value="OUTRO">📋 Outro</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Descrição</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  required
                  placeholder="Descreva a ocorrência com o máximo de detalhes..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                />
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={anonima}
                  onChange={(e) => setAnonima(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1A3A5C]"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Registrar anonimamente</p>
                  <p className="text-xs text-slate-400 mt-0.5">Seu nome não será exibido para o síndico.</p>
                </div>
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(""); }}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#1A3A5C] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Registrar ocorrência"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : ocorrencias.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-400">Você ainda não registrou nenhuma ocorrência.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ocorrencias.map((o) => (
              <article key={o.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{TIPO_LABELS[o.tipo]}</span>
                  {o.anonima && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Anônimo</span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[o.status]}`}>
                    {STATUS_LABELS[o.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{o.descricao}</p>
                {o.observacao_sindico && (
                  <div className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <span className="font-medium">Resposta do síndico:</span> {o.observacao_sindico}
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-400">{formatDate(o.criado_em)}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
