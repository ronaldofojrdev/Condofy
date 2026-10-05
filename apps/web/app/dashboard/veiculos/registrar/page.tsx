"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Unidade = {
  id: string;
  numero: string;
};

type Morador = {
  id: string;
  nome: string;
};

export default function RegistrarVeiculoPage() {
  const router = useRouter();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [loadingMoradores, setLoadingMoradores] = useState(false);

  const [unidadeId, setUnidadeId] = useState("");
  const [moradorId, setMoradorId] = useState("");
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

      if (profile?.role !== "PORTEIRO" && profile?.role !== "SINDICO") {
        router.replace("/dashboard");
        return;
      }

      // Carregar unidades
      const { data: unidadesData } = await supabase
        .from("unidades")
        .select("id, numero")
        .eq("condominio_id", profile.condominio_id)
        .order("numero");

      setUnidades(unidadesData ?? []);
    }
    void init();
  }, [router]);

  async function loadMoradores(unId: string) {
    setMoradorId("");
    setMoradores([]);
    if (!unId) return;

    setLoadingMoradores(true);
    const { data } = await supabase
      .from("perfis_usuario")
      .select("usuario_id, usuarios ( id, nome )")
      .eq("unidade_id", unId)
      .eq("role", "MORADOR")
      .eq("ativo", true);

    setLoadingMoradores(false);

    if (data) {
      const list = data
        .map((p: any) => p.usuarios)
        .filter(Boolean)
        .map((u: any) => ({ id: u.id, nome: u.nome }));
      setMoradores(list);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!placa.trim()) { setError("Placa é obrigatória."); return; }
    if (!modelo.trim()) { setError("Modelo é obrigatório."); return; }
    if (!unidadeId) { setError("Selecione a unidade."); return; }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setSubmitting(false); return; }

    const res = await fetch("/api/veiculos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        placa: placa.trim().toUpperCase(),
        modelo: modelo.trim(),
        cor: cor.trim() || null,
        unidade_id: unidadeId,
        morador_id: moradorId || null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao cadastrar veículo.");
      return;
    }

    setPlaca("");
    setModelo("");
    setCor("");
    setUnidadeId("");
    setMoradorId("");
    setMoradores([]);
    setSuccessMsg("Veículo cadastrado com sucesso!");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-6">

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Portaria</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Registrar Veículo</h1>
          <p className="mt-2 text-sm text-slate-500">Cadastre a placa e dados do veículo de um morador.</p>
        </div>

        {successMsg && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMsg}</p>
        )}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          {error && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Unidade */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Unidade</label>
              <select
                value={unidadeId}
                onChange={(e) => { setUnidadeId(e.target.value); void loadMoradores(e.target.value); }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              >
                <option value="">Selecione a unidade...</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>Unidade {u.numero}</option>
                ))}
              </select>
            </div>

            {/* Morador (opcional) */}
            {unidadeId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Morador <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <select
                  value={moradorId}
                  onChange={(e) => setMoradorId(e.target.value)}
                  disabled={loadingMoradores}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10 disabled:opacity-60"
                >
                  <option value="">
                    {loadingMoradores ? "Carregando..." : "Selecione o morador..."}
                  </option>
                  {moradores.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Placa */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Placa</label>
              <input
                type="text"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="ABC-1234 ou BRA2E19"
                maxLength={8}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-mono uppercase outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              />
            </div>

            {/* Modelo */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Modelo</label>
              <input
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Ex: Honda Civic, Fiat Uno..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              />
            </div>

            {/* Cor */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Cor <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                placeholder="Ex: Prata, Preto, Branco..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#1A3A5C] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60"
            >
              {submitting ? "Cadastrando..." : "Cadastrar veículo"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
