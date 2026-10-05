"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type AvisoCategoria = "GERAL" | "MANUTENCAO" | "SEGURANCA" | "FINANCEIRO" | "EVENTO";

type UnitOption = {
  id: string;
  numero: string;
};

export default function NovoAvisoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<AvisoCategoria>("GERAL");
  const [conteudo, setConteudo] = useState("");
  const [fixado, setFixado] = useState(false);
  const [error, setError] = useState("");

  // Targeted unit state
  const [direcionado, setDirecionado] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<UnitOption | null>(null);

  useEffect(() => {
    async function loadRole() {
      setLoading(true);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        router.push("/dashboard/avisos");
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
        router.push("/dashboard/avisos");
        return;
      }

      setCondominioId(profile.condominio_id);
      setRole(profile.role);

      if (profile.role !== "SINDICO") {
        router.push("/dashboard/avisos");
        return;
      }

      setLoading(false);
    }

    void loadRole();
  }, [router]);

  async function searchUnits() {
    if (!condominioId) return;
    setSearching(true);
    setError("");

    const { data, error: searchError } = await supabase
      .from("unidades")
      .select("id, numero")
      .eq("condominio_id", condominioId)
      .ilike("numero", `%${search}%`)
      .order("numero", { ascending: true });

    setSearching(false);
    if (searchError) { setError(searchError.message); return; }
    setUnitOptions((data ?? []) as UnitOption[]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!condominioId || role !== "SINDICO") {
      router.push("/dashboard/avisos");
      return;
    }

    if (direcionado && !selectedUnit) {
      setError("Selecione uma unidade ou desmarque a opção de comunicado direcionado.");
      return;
    }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setSubmitting(false);
      router.push("/dashboard/avisos");
      return;
    }

    const response = await fetch("/api/avisos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({
        titulo,
        conteudo,
        categoria,
        fixado,
        unidade_id: direcionado && selectedUnit ? selectedUnit.id : null
      })
    });

    setSubmitting(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao publicar aviso. Tente novamente.");
      return;
    }

    router.push("/dashboard/avisos");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
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
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">
            Avisos
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Novo aviso
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Crie comunicados para o mural do condomínio.
          </p>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="titulo" className="mb-2 block text-sm font-medium text-slate-700">
                Título
              </label>
              <input
                id="titulo"
                type="text"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                placeholder="Ex.: Manutenção do elevador"
                required
              />
            </div>

            <div>
              <label htmlFor="categoria" className="mb-2 block text-sm font-medium text-slate-700">
                Categoria
              </label>
              <select
                id="categoria"
                value={categoria}
                onChange={(event) => setCategoria(event.target.value as AvisoCategoria)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              >
                <option value="GERAL">Geral</option>
                <option value="MANUTENCAO">Manutenção</option>
                <option value="SEGURANCA">Segurança</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="EVENTO">Evento</option>
              </select>
            </div>

            <div>
              <label htmlFor="conteudo" className="mb-2 block text-sm font-medium text-slate-700">
                Conteúdo
              </label>
              <textarea
                id="conteudo"
                value={conteudo}
                onChange={(event) => setConteudo(event.target.value)}
                className="min-h-40 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                placeholder="Escreva o aviso completo..."
                required
              />
            </div>

            {/* Targeted unit toggle */}
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={direcionado}
                onChange={(e) => {
                  setDirecionado(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedUnit(null);
                    setSearch("");
                    setUnitOptions([]);
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-[#1A3A5C] focus:ring-[#1A3A5C]"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Comunicado direcionado para uma unidade</span>
                <p className="mt-0.5 text-xs text-slate-500">Apenas o morador da unidade selecionada verá este aviso</p>
              </div>
            </label>

            {direcionado && (
              <div className="rounded-2xl border border-[#1A3A5C]/20 bg-[#1A3A5C]/5 p-5">
                <p className="mb-3 text-sm font-medium text-[#1A3A5C]">Selecionar unidade</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchUnits(); } }}
                    placeholder="Número da unidade"
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  />
                  <button
                    type="button"
                    onClick={() => void searchUnits()}
                    disabled={searching}
                    className="rounded-xl bg-[#1A3A5C] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60"
                  >
                    {searching ? "..." : "Buscar"}
                  </button>
                </div>

                {unitOptions.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {unitOptions.map((unit) => (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => setSelectedUnit(unit)}
                        className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                          selectedUnit?.id === unit.id
                            ? "border-[#1A3A5C] bg-[#1A3A5C] text-white"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        Unidade {unit.numero}
                      </button>
                    ))}
                  </div>
                )}

                {selectedUnit && (
                  <p className="mt-3 text-sm font-medium text-[#1A3A5C]">
                    ✓ Unidade {selectedUnit.numero} selecionada
                  </p>
                )}
              </div>
            )}

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4">
              <input
                type="checkbox"
                checked={fixado}
                onChange={(event) => setFixado(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#1A3A5C] focus:ring-[#1A3A5C]"
              />
              <span className="text-sm font-medium text-slate-700">Fixar aviso</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Publicar aviso"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
