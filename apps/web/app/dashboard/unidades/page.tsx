"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type BlocoRow = {
  id: string;
  nome: string;
};

type UnidadeStatus = "OCUPADA" | "VAZIA";

type UnidadeRow = {
  id: string;
  condominio_id: string;
  bloco_id: string | null;
  numero: string;
  andar: number | null;
  status: UnidadeStatus;
};

type GroupedBlock = {
  id: string;
  nome: string;
  unidades: UnidadeRow[];
};

type VisibleFormState = {
  blocoId: string | null;
  kind: "BLOCO" | "UNIDADE" | null;
};

const STATUS_STYLE: Record<UnidadeStatus, string> = {
  OCUPADA: "bg-rose-100 text-rose-800",
  VAZIA: "bg-emerald-100 text-emerald-800"
};

export default function UnidadesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [blocos, setBlocos] = useState<BlocoRow[]>([]);
  const [unidades, setUnidades] = useState<UnidadeRow[]>([]);
  const [visibleForm, setVisibleForm] = useState<VisibleFormState>({
    blocoId: null,
    kind: null
  });
  const [novoBlocoNome, setNovoBlocoNome] = useState("");
  const [novaUnidadeNumero, setNovaUnidadeNumero] = useState("");
  const [novaUnidadeAndar, setNovaUnidadeAndar] = useState("");
  const [savingKey, setSavingKey] = useState("");

  async function loadPage() {
    setLoading(true);
    setError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      router.replace("/dashboard");
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
      router.replace("/dashboard");
      return;
    }

    if (profile.role !== "SINDICO") {
      router.replace("/dashboard");
      return;
    }

    setCondominioId(profile.condominio_id);
    setRole(profile.role);

    const [blocosResponse, unidadesResponse] = await Promise.all([
      supabase
        .from("blocos")
        .select("id, nome")
        .eq("condominio_id", profile.condominio_id)
        .order("nome", { ascending: true }),
      supabase
        .from("unidades")
        .select("id, condominio_id, bloco_id, numero, andar, status")
        .eq("condominio_id", profile.condominio_id)
        .order("numero", { ascending: true })
    ]);

    if (blocosResponse.error) {
      setError(blocosResponse.error.message);
      setLoading(false);
      return;
    }

    if (unidadesResponse.error) {
      setError(unidadesResponse.error.message);
      setLoading(false);
      return;
    }

    setBlocos((blocosResponse.data ?? []) as BlocoRow[]);
    setUnidades((unidadesResponse.data ?? []) as UnidadeRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadPage();
  }, []);

  const groupedBlocks = useMemo<GroupedBlock[]>(() => {
    const blocksById = new Map(blocos.map((bloco) => [bloco.id, bloco]));
    const grouped = blocos.map<GroupedBlock>((bloco) => ({
      id: bloco.id,
      nome: bloco.nome,
      unidades: unidades.filter((unidade) => unidade.bloco_id === bloco.id)
    }));

    const semBloco = unidades.filter((unidade) => unidade.bloco_id === null);

    if (semBloco.length || !blocksById.size) {
      grouped.push({
        id: "sem-bloco",
        nome: "Unidades sem bloco",
        unidades: semBloco
      });
    }

    return grouped;
  }, [blocos, unidades]);

  async function handleNewBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!condominioId) {
      return;
    }

    setSavingKey("novo-bloco");

    const { error: insertError } = await supabase.from("blocos").insert({
      condominio_id: condominioId,
      nome: novoBlocoNome.trim()
    });

    setSavingKey("");

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNovoBlocoNome("");
    setVisibleForm({ blocoId: null, kind: null });
    await loadPage();
    router.refresh();
  }

  async function handleNewUnit(event: FormEvent<HTMLFormElement>, blocoId: string | null) {
    event.preventDefault();

    if (!condominioId) {
      return;
    }

    setSavingKey(blocoId ?? "sem-bloco");

    const { error: insertError } = await supabase.from("unidades").insert({
      condominio_id: condominioId,
      bloco_id: blocoId,
      numero: novaUnidadeNumero.trim(),
      andar: novaUnidadeAndar.trim() ? Number(novaUnidadeAndar) : null,
      tipo: "APARTAMENTO",
      status: "VAZIA"
    });

    setSavingKey("");

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNovaUnidadeNumero("");
    setNovaUnidadeAndar("");
    setVisibleForm({ blocoId: null, kind: null });
    await loadPage();
    router.refresh();
  }

  async function toggleStatus(unidade: UnidadeRow) {
    setSavingKey(unidade.id);

    const nextStatus: UnidadeStatus = unidade.status === "OCUPADA" ? "VAZIA" : "OCUPADA";

    const { error: updateError } = await supabase
      .from("unidades")
      .update({ status: nextStatus })
      .eq("id", unidade.id);

    setSavingKey("");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadPage();
    router.refresh();
  }

  if (role !== "SINDICO") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Unidades</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Blocos e unidades</h1>
              <p className="mt-2 text-sm text-slate-600">Gerencie blocos, unidades e status de ocupação.</p>
            </div>

            <button
              type="button"
              onClick={() => setVisibleForm({ blocoId: null, kind: visibleForm.kind === "BLOCO" && visibleForm.blocoId === null ? null : "BLOCO" })}
              className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
            >
              + Novo bloco
            </button>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {visibleForm.kind === "BLOCO" ? (
            <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5" onSubmit={handleNewBlock}>
              <label htmlFor="novoBlocoNome" className="mb-2 block text-sm font-medium text-slate-700">
                Nome do bloco
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="novoBlocoNome"
                  type="text"
                  value={novoBlocoNome}
                  onChange={(event) => setNovoBlocoNome(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  required
                />
                <button
                  type="submit"
                  disabled={savingKey === "novo-bloco"}
                  className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingKey === "novo-bloco" ? "Salvando..." : "Salvar bloco"}
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Carregando unidades...
              </div>
            ) : groupedBlocks.length ? (
              groupedBlocks.map((bloco) => (
                <section key={bloco.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{bloco.nome}</h2>
                      <p className="mt-1 text-sm text-slate-600">{bloco.unidades.length} unidade(s)</p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setVisibleForm((current) => ({
                          blocoId: bloco.id,
                          kind: current.kind === "UNIDADE" && current.blocoId === bloco.id ? null : "UNIDADE"
                        }))
                      }
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      + Nova unidade
                    </button>
                  </div>

                  {visibleForm.kind === "UNIDADE" && visibleForm.blocoId === bloco.id ? (
                    <form
                      className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                      onSubmit={(event) => void handleNewUnit(event, bloco.id)}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`numero-${bloco.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                            Número
                          </label>
                          <input
                            id={`numero-${bloco.id}`}
                            type="text"
                            value={novaUnidadeNumero}
                            onChange={(event) => setNovaUnidadeNumero(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor={`andar-${bloco.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                            Andar <span className="text-slate-400">(opcional)</span>
                          </label>
                          <input
                            id={`andar-${bloco.id}`}
                            type="number"
                            min={0}
                            value={novaUnidadeAndar}
                            onChange={(event) => setNovaUnidadeAndar(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex gap-3">
                        <button
                          type="submit"
                          disabled={savingKey === bloco.id}
                          className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingKey === bloco.id ? "Salvando..." : "Salvar unidade"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibleForm({ blocoId: null, kind: null })}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="mt-6 space-y-3">
                    {bloco.unidades.length ? (
                      bloco.unidades.map((unidade) => (
                        <article key={unidade.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">Unidade {unidade.numero}</h3>
                              <p className="mt-1 text-sm text-slate-600">{unidade.andar != null ? `Andar ${unidade.andar}` : "Sem andar informado"}</p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[unidade.status]}`}>
                                {unidade.status === "OCUPADA" ? "Ocupada" : "Vaga"}
                              </span>
                              <button
                                type="button"
                                onClick={() => void toggleStatus(unidade)}
                                disabled={savingKey === unidade.id}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingKey === unidade.id ? "Salvando..." : unidade.status === "OCUPADA" ? "Marcar vaga" : "Marcar ocupada"}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Nenhuma unidade neste bloco.
                      </p>
                    )}
                  </div>
                </section>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                Nenhum bloco ou unidade encontrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}