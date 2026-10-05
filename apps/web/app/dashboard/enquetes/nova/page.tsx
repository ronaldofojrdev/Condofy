"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function NovaEnquetePage() {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [encerraEm, setEncerraEm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addOpcao() {
    if (opcoes.length < 6) setOpcoes((prev) => [...prev, ""]);
  }

  function removeOpcao(index: number) {
    if (opcoes.length <= 2) return;
    setOpcoes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOpcao(index: number, value: string) {
    setOpcoes((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const opcoesFiltradas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (!titulo.trim()) {
      setError("Título é obrigatório.");
      return;
    }
    if (opcoesFiltradas.length < 2) {
      setError("Preencha ao menos 2 opções.");
      return;
    }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch("/api/enquetes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        opcoes: opcoesFiltradas,
        encerra_em: encerraEm || null,
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Erro ao criar enquete.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard/enquetes");
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Enquetes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Nova enquete</h1>
          <p className="mt-1 text-sm text-slate-500">Crie uma votação para os moradores do condomínio.</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Cor da pintura da fachada"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Descrição <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto adicional para os moradores..."
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Opções de voto</label>
            <div className="space-y-2">
              {opcoes.map((opcao, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opcao}
                    onChange={(e) => updateOpcao(i, e.target.value)}
                    placeholder={`Opção ${i + 1}`}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  />
                  {opcoes.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => removeOpcao(i)}
                      className="shrink-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-rose-600"
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {opcoes.length < 6 ? (
              <button
                type="button"
                onClick={addOpcao}
                className="mt-2 text-sm font-medium text-[#1A3A5C] hover:underline"
              >
                + Adicionar opção
              </button>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Data de encerramento <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="datetime-local"
              value={encerraEm}
              onChange={(e) => setEncerraEm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-[#1A3A5C] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60"
            >
              {submitting ? "Publicando..." : "Publicar enquete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
