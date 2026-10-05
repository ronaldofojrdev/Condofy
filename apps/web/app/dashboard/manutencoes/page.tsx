"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Manutencao = {
  id: string;
  titulo: string;
  descricao: string | null;
  responsavel: string | null;
  prevista_em: string;
  concluida: boolean;
  concluida_em: string | null;
  criado_em: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value.slice(0, 10) + "T12:00:00"));
}

function isVencida(prevista_em: string, concluida: boolean) {
  if (concluida) return false;
  return new Date(prevista_em + "T23:59:59") < new Date();
}

function AddForm({ onAdd }: { onAdd: (m: Manutencao) => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [previstaEm, setPrevistaEm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!titulo.trim()) { setError("Título é obrigatório."); return; }
    if (!previstaEm) { setError("Data prevista é obrigatória."); return; }

    setSubmitting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch("/api/manutencoes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        responsavel: responsavel.trim() || null,
        prevista_em: previstaEm,
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; manutencaoId?: string; error?: string };
    if (!res.ok) { setError(payload.error ?? "Erro ao criar."); setSubmitting(false); return; }

    onAdd({
      id: payload.manutencaoId ?? crypto.randomUUID(),
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      responsavel: responsavel.trim() || null,
      prevista_em: previstaEm,
      concluida: false,
      concluida_em: null,
      criado_em: new Date().toISOString(),
    });

    setTitulo(""); setDescricao(""); setResponsavel(""); setPrevistaEm(""); setOpen(false);
    setSubmitting(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-[#1A3A5C] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#15314d]"
      >
        Agendar manutenção
      </button>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Nova manutenção</h2>
      {error ? <p className="mb-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="space-y-3">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Revisão do elevador"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
        />
        <div className="flex gap-3">
          <input
            type="text"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Responsável (opcional)"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
          />
          <input
            type="date"
            value={previstaEm}
            onChange={(e) => setPrevistaEm(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
          />
        </div>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição (opcional)"
          rows={2}
          className="w-full resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
        />
      </div>

      <div className="mt-4 flex gap-3">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancelar</button>
        <button type="submit" disabled={submitting} className="flex-1 rounded-2xl bg-[#1A3A5C] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60">{submitting ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}

export default function ManutencoesPage() {
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch("/api/manutencoes", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const p = (await res.json().catch(() => ({}))) as { error?: string };
      setError(p.error ?? "Erro ao carregar.");
      setLoading(false);
      return;
    }
    setManutencoes((await res.json()) as Manutencao[]);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  async function toggleConcluida(m: Manutencao) {
    setActionId(m.id);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch(`/api/manutencoes/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ concluida: !m.concluida }),
    });

    if (res.ok) {
      setManutencoes((prev) =>
        prev.map((item) =>
          item.id === m.id ? { ...item, concluida: !m.concluida, concluida_em: !m.concluida ? new Date().toISOString() : null } : item
        )
      );
    }
    setActionId(null);
  }

  async function handleDelete(id: string) {
    setActionId(id);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch(`/api/manutencoes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setManutencoes((prev) => prev.filter((m) => m.id !== id));
    setActionId(null);
  }

  const pendentes = manutencoes.filter((m) => !m.concluida);
  const concluidas = manutencoes.filter((m) => m.concluida);

  function ManutencaoRow({ m }: { m: Manutencao }) {
    const vencida = isVencida(m.prevista_em, m.concluida);
    return (
      <div className="flex items-start gap-4 px-5 py-4 border-t border-slate-100 first:border-t-0">
        <button
          type="button"
          onClick={() => void toggleConcluida(m)}
          disabled={actionId === m.id}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
            m.concluida
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 hover:border-[#1A3A5C]"
          } disabled:opacity-50`}
          aria-label={m.concluida ? "Marcar como pendente" : "Marcar como concluída"}
        >
          {m.concluida ? (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${m.concluida ? "line-through text-slate-400" : "text-slate-900"}`}>{m.titulo}</p>
          {m.descricao ? <p className="mt-0.5 text-xs text-slate-500">{m.descricao}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
            <span className={`font-medium ${vencida ? "text-rose-500" : m.concluida ? "text-emerald-600" : "text-slate-600"}`}>
              {m.concluida ? `Concluída em ${formatDate((m.concluida_em ?? "").slice(0, 10))}` : vencida ? `Vencida — ${formatDate(m.prevista_em)}` : `Prevista: ${formatDate(m.prevista_em)}`}
            </span>
            {m.responsavel ? <span>• {m.responsavel}</span> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleDelete(m.id)}
          disabled={actionId === m.id}
          className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          {actionId === m.id ? "..." : "Remover"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Condomínio</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Manutenção Preventiva</h1>
            <p className="mt-1 text-sm text-slate-500">Agende e acompanhe as manutenções do condomínio.</p>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mb-6">
          <AddForm onAdd={(m) => setManutencoes((prev) => [m, ...prev].sort((a, b) => a.prevista_em.localeCompare(b.prevista_em)))} />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Carregando...</div>
        ) : manutencoes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Nenhuma manutenção agendada.</div>
        ) : (
          <div className="space-y-6">
            {pendentes.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Pendentes</h2>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {pendentes.map((m) => <ManutencaoRow key={m.id} m={m} />)}
                </div>
              </section>
            ) : null}

            {concluidas.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Concluídas</h2>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {concluidas.map((m) => <ManutencaoRow key={m.id} m={m} />)}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
