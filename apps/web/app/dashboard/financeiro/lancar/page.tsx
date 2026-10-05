"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type UnitOption = {
  id: string;
  numero: string;
};

type CobrancaTipo = "TAXA_MENSAL" | "MULTA" | "EXTRA";

const TIPO_COBRANCA_LABELS: Record<string, string> = {
  TAXA_MENSAL: "Taxa Mensal",
  TAXA_EXTRA: "Taxa Extra",
  EXTRA: "Taxa Extra",
  MULTA: "Multa",
  RESERVA: "Reserva de Salão",
  OUTRO: "Outro"
};

export default function LancarCobrancaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [search, setSearch] = useState("");
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<UnitOption | null>(null);
  const [lancarParaTodas, setLancarParaTodas] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<CobrancaTipo>("TAXA_MENSAL");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        router.replace("/dashboard/financeiro");
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
        router.replace("/dashboard/financeiro");
        return;
      }

      if (profile.role !== "SINDICO") {
        router.replace("/dashboard/financeiro");
        return;
      }

      setCondominioId(profile.condominio_id);
      setRole(profile.role);
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  async function searchUnits() {
    setError("");

    if (!condominioId) {
      setError("Condomínio não carregado.");
      return;
    }

    setSearching(true);

    const { data, error: searchError } = await supabase
      .from("unidades")
      .select("id, numero")
      .eq("condominio_id", condominioId)
      .ilike("numero", `%${search}%`)
      .order("numero", { ascending: true });

    setSearching(false);

    if (searchError) {
      setError(searchError.message);
      return;
    }

    setUnitOptions((data ?? []) as UnitOption[]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!condominioId || role !== "SINDICO") {
      router.replace("/dashboard/financeiro");
      return;
    }

    if (!descricao.trim()) {
      setError("Informe a descrição da cobrança.");
      return;
    }

    if (!valor.trim()) {
      setError("Informe o valor da cobrança.");
      return;
    }

    if (!vencimento) {
      setError("Informe o vencimento.");
      return;
    }

    setSubmitting(true);

    const payload = {
      condominio_id: condominioId,
      descricao: descricao.trim(),
      tipo,
      valor: Number(valor),
      vencimento,
      status: "PENDENTE" as const
    };

    let insertError: { message: string } | null = null;

    if (lancarParaTodas) {
      const { data: unitsData, error: unitsError } = await supabase
        .from("unidades")
        .select("id")
        .eq("condominio_id", condominioId);

      if (unitsError) {
        setSubmitting(false);
        setError(unitsError.message);
        return;
      }

      if (!unitsData?.length) {
        setSubmitting(false);
        setError("Nenhuma unidade encontrada para lançar a cobrança.");
        return;
      }

      const insertPayload = unitsData.map((unit) => ({
        ...payload,
        unidade_id: unit.id
      }));

      const { error } = await supabase.from("cobrancas").insert(insertPayload);
      insertError = error;
    } else {
      if (!selectedUnit) {
        setSubmitting(false);
        setError("Selecione uma unidade ou marque a opção para todas as unidades.");
        return;
      }

      const { error } = await supabase.from("cobrancas").insert({
        ...payload,
        unidade_id: selectedUnit.id
      });
      insertError = error;
    }

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/dashboard/financeiro");
    router.refresh();
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
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Financeiro</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Lançar cobrança</h1>
          <p className="mt-2 text-sm text-slate-600">Cadastre cobranças individuais ou para todas as unidades do condomínio.</p>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : null}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={lancarParaTodas}
                onChange={(event) => {
                  setLancarParaTodas(event.target.checked);
                  if (event.target.checked) {
                    setSelectedUnit(null);
                    setSearch("");
                    setUnitOptions([]);
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-[#1A3A5C] focus:ring-[#1A3A5C]"
              />
              <span className="text-sm font-medium text-slate-700">Lançar para todas as unidades</span>
            </label>

            {!lancarParaTodas ? (
              <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="space-y-3">
                  <label htmlFor="search" className="block text-sm font-medium text-slate-700">Buscar unidade</label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      id="search"
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                      placeholder="Digite o número da unidade"
                    />
                    <button
                      type="button"
                      onClick={() => void searchUnits()}
                      disabled={searching}
                      className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {searching ? "Buscando..." : "Buscar"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {unitOptions.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => setSelectedUnit(unit)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        selectedUnit?.id === unit.id
                          ? "border-[#1A3A5C] bg-[#1A3A5C]/5 text-[#1A3A5C]"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">Unidade</span>
                      <span className="block text-lg font-semibold">{unit.numero}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <label htmlFor="descricao" className="mb-2 block text-sm font-medium text-slate-700">Descrição</label>
              <input
                id="descricao"
                type="text"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                placeholder="Ex.: Taxa condominial de maio"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tipo" className="mb-2 block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  id="tipo"
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value as CobrancaTipo)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                >
                  {Object.entries(TIPO_COBRANCA_LABELS)
                    .filter(([value]) => value === "TAXA_MENSAL" || value === "MULTA" || value === "EXTRA")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="valor" className="mb-2 block text-sm font-medium text-slate-700">Valor</label>
                <input
                  id="valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="vencimento" className="mb-2 block text-sm font-medium text-slate-700">Vencimento</label>
              <input
                id="vencimento"
                type="date"
                value={vencimento}
                onChange={(event) => setVencimento(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Lançar cobrança"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
