"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DeliveryStatus = "AGUARDANDO" | "RETIRADO";

type DeliveryRow = {
  id: string;
  remetente: string | null;
  foto_url: string | null;
  status: DeliveryStatus;
  criado_em: string;
};

type ProfileRow = {
  unidade_id: string | null;
  condominio_id: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function MinhasEntregasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unidadeNumero, setUnidadeNumero] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDENTES" | "RETIRADAS">("PENDENTES");
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);

  useEffect(() => {
    async function loadDeliveries() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        setError("Não foi possível carregar a sessão do usuário.");
        setLoading(false);
        return;
      }

      const user = sessionData.session.user;

      const { data: activeProfile, error: profileError } = await supabase
        .from("perfis_usuario")
        .select("unidade_id, condominio_id")
        .eq("usuario_id", user.id)
        .eq("ativo", true)
        .limit(1)
        .single<ProfileRow>();

      if (profileError || !activeProfile?.unidade_id) {
        setError("Nenhuma unidade encontrada para este usuário.");
        setLoading(false);
        return;
      }

      const [{ data: deliveriesData, error: deliveriesError }, { data: unitData, error: unitError }] =
        await Promise.all([
          supabase
            .from("entregas")
            .select("id, remetente, foto_url, status, criado_em")
            .eq("unidade_id", activeProfile.unidade_id)
            .order("criado_em", { ascending: false }),
          supabase.from("unidades").select("numero").eq("id", activeProfile.unidade_id).single()
        ]);

      if (deliveriesError) {
        setError(deliveriesError.message);
        setLoading(false);
        return;
      }

      if (unitError) {
        setError(unitError.message);
        setLoading(false);
        return;
      }

      setUnidadeNumero(unitData?.numero ?? "");
      setDeliveries((deliveriesData ?? []) as DeliveryRow[]);
      setLoading(false);
    }

    void loadDeliveries();
  }, []);

  const filteredDeliveries = useMemo(() => {
    if (filter === "PENDENTES") {
      return deliveries.filter((delivery) => delivery.status === "AGUARDANDO");
    }

    if (filter === "RETIRADAS") {
      return deliveries.filter((delivery) => delivery.status === "RETIRADO");
    }

    return deliveries;
  }, [deliveries, filter]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">
                Entregas
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Minhas entregas
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Unidade {unidadeNumero ? `• ${unidadeNumero}` : ""}
              </p>
            </div>

            <div className="inline-flex rounded-2xl bg-slate-100 p-1">
              {[
                { key: "ALL", label: "Todas" },
                { key: "PENDENTES", label: "Pendentes" },
                { key: "RETIRADAS", label: "Retiradas" }
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key as typeof filter)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    filter === option.key ? "bg-[#1A3A5C] text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Carregando entregas...
              </div>
            ) : filteredDeliveries.length ? (
              filteredDeliveries.map((delivery) => {
                const isPending = delivery.status === "AGUARDANDO";

                return (
                  <article key={delivery.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                        {delivery.foto_url ? (
                          <a href={delivery.foto_url} target="_blank" rel="noreferrer" className="block h-full w-full">
                            <img
                              src={delivery.foto_url}
                              alt="Foto da entrega"
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                            Sem foto
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Remetente</p>
                            <h2 className="mt-1 text-lg font-semibold text-slate-900">
                              {delivery.remetente ?? "Não informado"}
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                              {formatDate(delivery.criado_em)}
                            </p>
                          </div>

                          <span
                            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                              isPending
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isPending ? "AGUARDANDO" : "RETIRADO"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma entrega registrada para sua unidade
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
