"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type CondominiumType = "VERTICAL" | "HORIZONTAL";

function parseUnits(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ProgressBar({ step }: { step: number }) {
  const steps = [
    { n: 1, label: "Condomínio" },
    { n: 2, label: "Unidades" },
    { n: 3, label: "Concluído" }
  ];

  return (
    <div className="mb-8">
      <div className="relative flex items-center justify-between">
        <div className="absolute inset-x-8 top-4 h-0.5 bg-slate-200" />
        {steps.map(({ n, label }) => (
          <div key={n} className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                n < step
                  ? "bg-[#1A3A5C] text-white"
                  : n === step
                  ? "bg-[#1A3A5C] text-white ring-4 ring-[#1A3A5C]/20"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {n < step ? "✓" : n}
            </div>
            <span className={`text-xs font-medium ${n <= step ? "text-[#1A3A5C]" : "text-slate-400"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">Passo {step} de 3</p>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [createdUnits, setCreatedUnits] = useState<string[]>([]);

  // Step 1
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<CondominiumType>("VERTICAL");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [totalUnidades, setTotalUnidades] = useState<number | "">(1);

  // Step 2
  const [batchInput, setBatchInput] = useState("");
  const [unitList, setUnitList] = useState<string[]>([]);
  const [singleUnit, setSingleUnit] = useState("");

  const parsedFromBatch = useMemo(() => parseUnits(batchInput), [batchInput]);
  const previewUnits = useMemo(
    () => [...new Set([...parsedFromBatch, ...unitList])],
    [parsedFromBatch, unitList]
  );

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getUser();
      if (!sessionData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("perfis_usuario")
        .select("id, condominio_id")
        .eq("usuario_id", sessionData.user.id)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (profile?.id) {
        const { data: condo } = await supabase
          .from("condominios")
          .select("onboarding_completo, nome, tipo, endereco, cidade, estado, cep, cnpj, total_unidades")
          .eq("id", profile.condominio_id)
          .maybeSingle();

        if (!condo || condo.onboarding_completo !== false) {
          router.replace("/dashboard");
          return;
        }

        setCondominioId(profile.condominio_id);
        setNome(condo.nome ?? "");
        setTipo((condo.tipo ?? "VERTICAL") as CondominiumType);
        setEndereco(condo.endereco ?? "");
        setCidade(condo.cidade ?? "");
        setEstado(condo.estado ?? "");
        setCep(condo.cep ?? "");
        setCnpj(condo.cnpj ?? "");
        setTotalUnidades(condo.total_unidades ?? 1);
        setStep(2);
      }

      setLoading(false);
    }

    void init();
  }, [router]);

  async function handleStep1(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getUser();
    if (!sessionData.user) {
      router.replace("/login");
      return;
    }

    const user = sessionData.user;
    const condoFields = {
      nome,
      tipo,
      endereco,
      cidade,
      estado,
      cep,
      ...(cnpj ? { cnpj } : {}),
      total_unidades: Number(totalUnidades) || 1,
      onboarding_completo: false
    };

    if (condominioId) {
      const { error: updateError } = await supabase
        .from("condominios")
        .update(condoFields)
        .eq("id", condominioId);

      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }
    } else {
      const newId = crypto.randomUUID();

      const { error: condoError } = await supabase
        .from("condominios")
        .insert({ id: newId, ...condoFields });

      if (condoError) {
        setError(condoError.message);
        setSubmitting(false);
        return;
      }

      const nomeUsuario =
        (user.user_metadata?.nome as string | undefined) ?? user.email ?? "";

      await supabase
        .from("usuarios")
        .upsert({ id: user.id, nome: nomeUsuario, email: user.email ?? "" }, { onConflict: "id" });

      const { error: perfilError } = await supabase.from("perfis_usuario").insert({
        usuario_id: user.id,
        condominio_id: newId,
        role: "SINDICO",
        ativo: true
      });

      if (perfilError) {
        setError(perfilError.message);
        setSubmitting(false);
        return;
      }

      setCondominioId(newId);
    }

    setSubmitting(false);
    setStep(2);
  }

  async function handleStep2(skip: boolean) {
    if (!condominioId) return;
    setError("");

    if (!skip && previewUnits.length > 0) {
      setSubmitting(true);

      const { error: unitsError } = await supabase.from("unidades").insert(
        previewUnits.map((numero) => ({
          numero,
          condominio_id: condominioId,
          status: "VAZIA"
        }))
      );

      setSubmitting(false);

      if (unitsError) {
        setError(unitsError.message);
        return;
      }

      setCreatedUnits(previewUnits);
      setBatchInput("");
      setUnitList([]);
    }

    setStep(3);
  }

  async function handleFinish() {
    if (!condominioId) return;
    setSubmitting(true);

    const { error: updateError } = await supabase
      .from("condominios")
      .update({ onboarding_completo: true })
      .eq("id", condominioId);

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function addSingleUnit() {
    const trimmed = singleUnit.trim();
    if (!trimmed) return;
    if (!unitList.includes(trimmed) && !parsedFromBatch.includes(trimmed)) {
      setUnitList((prev) => [...prev, trimmed]);
    }
    setSingleUnit("");
  }

  function removeUnit(unit: string) {
    setUnitList((prev) => prev.filter((u) => u !== unit));
    setBatchInput(parsedFromBatch.filter((u) => u !== unit).join(", "));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <p className="text-sm text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Condofy" className="mx-auto h-8 w-auto" />
        </div>

        <ProgressBar step={step} />

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          {/* ── PASSO 1 ── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Configure seu condomínio
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Informações básicas sobre o seu condomínio.
              </p>

              {error && (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <form className="mt-6 space-y-4" onSubmit={handleStep1}>
                <div>
                  <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nome do condomínio
                  </label>
                  <input
                    id="nome"
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  />
                </div>

                <div>
                  <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    id="tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as CondominiumType)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  >
                    <option value="VERTICAL">Prédio (Vertical)</option>
                    <option value="HORIZONTAL">Condomínio de Casas (Horizontal)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="endereco" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Endereço completo
                  </label>
                  <input
                    id="endereco"
                    type="text"
                    required
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label htmlFor="cidade" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Cidade
                    </label>
                    <input
                      id="cidade"
                      type="text"
                      required
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    />
                  </div>
                  <div>
                    <label htmlFor="estado" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Estado
                    </label>
                    <input
                      id="estado"
                      type="text"
                      required
                      maxLength={2}
                      value={estado}
                      onChange={(e) => setEstado(e.target.value.toUpperCase())}
                      placeholder="SP"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    />
                  </div>
                  <div>
                    <label htmlFor="cep" className="mb-1.5 block text-sm font-medium text-slate-700">
                      CEP
                    </label>
                    <input
                      id="cep"
                      type="text"
                      required
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="00000-000"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cnpj" className="mb-1.5 block text-sm font-medium text-slate-700">
                      CNPJ{" "}
                      <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                      id="cnpj"
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    />
                  </div>
                  <div>
                    <label htmlFor="totalUnidades" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Número de unidades total
                    </label>
                    <input
                      id="totalUnidades"
                      type="number"
                      required
                      min={1}
                      value={totalUnidades}
                      onChange={(e) =>
                        setTotalUnidades(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Salvando..." : "Continuar →"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── PASSO 2 ── */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Crie as unidades
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Adicione os números das unidades. Você pode pular e fazer isso depois.
              </p>

              {error && (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="batchInput" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Adicionar em lote{" "}
                    <span className="font-normal text-slate-400">(separados por vírgula)</span>
                  </label>
                  <input
                    id="batchInput"
                    type="text"
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    placeholder="101, 102, 103, 201, 202, 203"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Ou adicionar uma por uma
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={singleUnit}
                      onChange={(e) => setSingleUnit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSingleUnit();
                        }
                      }}
                      placeholder="ex: 501"
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    />
                    <button
                      type="button"
                      onClick={addSingleUnit}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>

                {previewUnits.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      {previewUnits.length} unidade{previewUnits.length !== 1 ? "s" : ""} para criar:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewUnits.map((unit) => (
                        <span
                          key={unit}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                        >
                          {unit}
                          <button
                            type="button"
                            onClick={() => removeUnit(unit)}
                            aria-label={`Remover unidade ${unit}`}
                            className="ml-1 text-slate-400 hover:text-slate-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  ← Voltar
                </button>
                <button
                  type="button"
                  onClick={() => void handleStep2(true)}
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Pular
                </button>
                <button
                  type="button"
                  onClick={() => void handleStep2(previewUnits.length === 0)}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Salvando..."
                    : previewUnits.length > 0
                    ? `Criar ${previewUnits.length} unidade${previewUnits.length !== 1 ? "s" : ""} →`
                    : "Continuar →"}
                </button>
              </div>
            </>
          )}

          {/* ── PASSO 3 ── */}
          {step === 3 && (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                  🎉
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                  Tudo pronto!
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Seu condomínio foi configurado com sucesso.
                </p>
              </div>

              <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">Condomínio</span>
                  <span className="font-medium text-slate-900">{nome}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">Unidades criadas</span>
                  <span className="font-medium text-slate-900">
                    {createdUnits.length > 0 ? createdUnits.length : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">Próximo passo sugerido</span>
                  <span className="font-medium text-slate-900">Adicionar porteiros e moradores</span>
                </div>
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  ← Voltar
                </button>
                <button
                  type="button"
                  onClick={() => void handleFinish()}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Finalizando..." : "Ir para o dashboard →"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
