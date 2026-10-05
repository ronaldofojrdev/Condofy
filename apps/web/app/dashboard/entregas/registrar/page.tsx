"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type UnitOption = {
  id: string;
  numero: string;
};

export default function RegistrarEntregaPage() {
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<UnitOption | null>(null);
  const [sender, setSender] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadCondominium() {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        setError("Não foi possível identificar a sessão do usuário.");
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("perfis_usuario")
        .select("condominio_id, ativo")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1);

      if (!profiles?.length) {
        setError("Nenhum condomínio ativo encontrado para este usuário.");
        setLoading(false);
        return;
      }

      setCondominioId(profiles[0].condominio_id);
      setLoading(false);
    }

    void loadCondominium();
  }, []);

  async function searchUnits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

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

    const options = (data ?? []) as UnitOption[];
    setUnitOptions(options);
    setSelectedUnit(options.length === 1 ? options[0] : null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!condominioId) {
      setError("Condomínio não carregado.");
      return;
    }

    if (!selectedUnit) {
      setError("Selecione uma unidade antes de registrar a entrega.");
      return;
    }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setSubmitting(false);
      setError("Sessão inválida. Faça login novamente.");
      return;
    }

    let fotoUrl: string | null = null;

    if (photoFile) {
      const filePath = `${condominioId}/${Date.now()}-${photoFile.name}`;
      const { error: uploadError } = await supabase.storage.from("entregas").upload(filePath, photoFile, {
        cacheControl: "3600",
        upsert: false
      });

      if (uploadError) {
        setSubmitting(false);
        setError(uploadError.message);
        return;
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("entregas")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (signedUrlError) {
        setSubmitting(false);
        setError(signedUrlError.message);
        return;
      }

      fotoUrl = signedUrlData.signedUrl;
    }

    const response = await fetch("/api/entregas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({
        unidadeId: selectedUnit.id,
        remetente: sender || null,
        fotoUrl
      })
    });

    setSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Não foi possível registrar a entrega.");
      return;
    }

    setSuccess("Entrega registrada com sucesso.");
    setSearch("");
    setUnitOptions([]);
    setSelectedUnit(null);
    setSender("");
    setPhotoFile(null);
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setPhotoFile(event.target.files?.[0] ?? null);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">
            Entregas
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Registrar entrega
          </h1>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}

          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <form className="space-y-3" onSubmit={searchUnits}>
                <label htmlFor="search" className="block text-sm font-medium text-slate-700">
                  Buscar unidade
                </label>
                <p className="text-sm text-slate-500">Clique na unidade para selecioná-la. Se houver só um resultado, ela será selecionada automaticamente.</p>
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
                    type="submit"
                    disabled={searching || loading}
                    className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {searching ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </form>

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
                    <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                      Unidade
                    </span>
                    <span className="block text-lg font-semibold">{unit.numero}</span>
                  </button>
                ))}
              </div>

              {selectedUnit ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Unidade selecionada: <span className="font-semibold">{selectedUnit.numero}</span>
                </p>
              ) : null}
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="sender" className="mb-2 block text-sm font-medium text-slate-700">
                  Nome do remetente <span className="text-slate-400">(opcional)</span>
                </label>
                <input
                  id="sender"
                  type="text"
                  value={sender}
                  onChange={(event) => setSender(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  placeholder="Nome do remetente"
                />
              </div>

              <div>
                <label htmlFor="photo" className="mb-2 block text-sm font-medium text-slate-700">
                  Foto da encomenda <span className="text-slate-400">(opcional)</span>
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Registrando..." : "Registrar Entrega"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}