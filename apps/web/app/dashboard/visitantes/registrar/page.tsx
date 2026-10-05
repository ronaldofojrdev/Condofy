"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Unidade = { id: string; numero: string };

export default function RegistrarVisitantePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeId, setUnidadeId] = useState("");
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("perfis_usuario")
        .select("role, condominio_id")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<{ role: string; condominio_id: string }>();

      if (profile?.role !== "SINDICO" && profile?.role !== "PORTEIRO") {
        router.replace("/dashboard");
        return;
      }

      setToken(sessionData.session.access_token);

      const { data: unidadesData } = await supabase
        .from("unidades")
        .select("id, numero")
        .eq("condominio_id", profile.condominio_id)
        .order("numero");

      setUnidades((unidadesData ?? []) as Unidade[]);
    }
    void init();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unidadeId || !nome.trim()) { setError("Unidade e nome são obrigatórios."); return; }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/visitantes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ unidade_id: unidadeId, nome: nome.trim(), documento, motivo }),
    });

    setSubmitting(false);

    if (res.ok) {
      setSuccess("Entrada registrada com sucesso!");
      setUnidadeId("");
      setNome("");
      setDocumento("");
      setMotivo("");
    } else {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao registrar.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-6">

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Portaria</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Registrar Visita</h1>
          <p className="mt-2 text-sm text-slate-500">Registre a entrada de um visitante.</p>
        </div>

        {success && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {success}
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8 space-y-5">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unidade visitada</label>
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
            >
              <option value="">Selecione a unidade...</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>Unidade {u.numero}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do visitante</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Nome completo"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Documento <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="RG, CPF ou outro"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motivo <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Visita familiar, Entregador, Prestador de serviço..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[#1A3A5C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#15314d] disabled:opacity-60"
          >
            {submitting ? "Registrando..." : "Registrar entrada"}
          </button>
        </form>
      </div>
    </main>
  );
}
