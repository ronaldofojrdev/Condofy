"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type SalaoRow = {
  id: string;
  nome: string;
  capacidade: number;
  ativo: boolean;
};

export default function GerenciarSalaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [nome, setNome] = useState("");
  const [capacidade, setCapacidade] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [regras, setRegras] = useState("");
  const [taxaReserva, setTaxaReserva] = useState("");
  const [saloes, setSaloes] = useState<SalaoRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        router.push("/dashboard/salao");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("perfis_usuario")
        .select("condominio_id, role")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<ProfileRow>();

      if (profileError || !profile?.condominio_id || !profile?.role) {
        router.push("/dashboard/salao");
        return;
      }

      if (profile.role !== "SINDICO") {
        router.push("/dashboard/salao");
        return;
      }

      setCondominioId(profile.condominio_id);
      setRole(profile.role);

      const { data: saloesData, error: saloesError } = await supabase
        .from("saloes")
        .select("id, nome, capacidade, ativo")
        .eq("condominio_id", profile.condominio_id)
        .order("nome", { ascending: true });

      if (saloesError) {
        setError(saloesError.message);
        setLoading(false);
        return;
      }

      setSaloes((saloesData ?? []) as SalaoRow[]);
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!condominioId || role !== "SINDICO") {
      router.push("/dashboard/salao");
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await supabase.from("saloes").insert({
      condominio_id: condominioId,
      nome,
      capacidade,
      descricao: descricao || null,
      regras: regras || null,
      taxa_reserva: taxaReserva.trim() ? Number(taxaReserva) : null
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/dashboard/salao");
    router.refresh();
  }

  async function deactivateSalao(salaoId: string) {
    const { error: updateError } = await supabase
      .from("saloes")
      .update({ ativo: false })
      .eq("id", salaoId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaloes((current) => current.filter((salao) => salao.id !== salaoId));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm text-slate-500">Carregando permissões...</p>
          </div>
        </div>
      </main>
    );
  }

  if (role !== "SINDICO") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Salão</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Gerenciar salões
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Cadastre e desative salões de festa do condomínio.
          </p>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="nome" className="mb-2 block text-sm font-medium text-slate-700">
                Nome
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                placeholder="Ex.: Salão Principal"
                required
              />
            </div>

            <div>
              <label htmlFor="capacidade" className="mb-2 block text-sm font-medium text-slate-700">
                Capacidade
              </label>
              <input
                id="capacidade"
                type="number"
                min={1}
                value={capacidade}
                onChange={(event) => setCapacidade(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                required
              />
            </div>

            <div>
              <label htmlFor="descricao" className="mb-2 block text-sm font-medium text-slate-700">
                Descrição <span className="text-slate-400">(opcional)</span>
              </label>
              <textarea
                id="descricao"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                className="min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              />
            </div>

            <div>
              <label htmlFor="regras" className="mb-2 block text-sm font-medium text-slate-700">
                Regras <span className="text-slate-400">(opcional)</span>
              </label>
              <textarea
                id="regras"
                value={regras}
                onChange={(event) => setRegras(event.target.value)}
                className="min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              />
            </div>

            <div>
              <label htmlFor="taxaReserva" className="mb-2 block text-sm font-medium text-slate-700">
                Taxa de reserva <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                id="taxaReserva"
                type="number"
                step="0.01"
                min="0"
                value={taxaReserva}
                onChange={(event) => setTaxaReserva(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                placeholder="Deixe em branco para sem cobrança"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Cadastrar salão"}
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Salões existentes</h2>

          <div className="mt-6 space-y-4">
            {saloes.length ? (
              saloes.map((salao) => (
                <article key={salao.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{salao.nome}</h3>
                      <p className="mt-1 text-sm text-slate-600">Capacidade: {salao.capacidade}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void deactivateSalao(salao.id)}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                    >
                      Desativar
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhum salão cadastrado ainda.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
