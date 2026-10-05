"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { supabase } from "@/lib/supabase/client";

type DeliveryStatus = "AGUARDANDO" | "RETIRADO";

type DeliveryRow = {
  id: string;
  unidade_id: string;
  unidade: {
    numero: string;
  } | null;
  remetente: string | null;
  foto_url: string | null;
  status: DeliveryStatus;
  criado_em: string;
  retirado_em: string | null;
};

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type SummaryCounts = {
  today: number;
  awaiting: number;
  retiredThisMonth: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function EntregasPage() {
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDENTES" | "RETIRADAS">("ALL");
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [summary, setSummary] = useState<SummaryCounts>({
    today: 0,
    awaiting: 0,
    retiredThisMonth: 0
  });
  const [deliveryToConfirm, setDeliveryToConfirm] = useState<DeliveryRow | null>(null);

  const canMarkAsCollected = role === "SINDICO" || role === "PORTEIRO";

  function getTodayStart() {
    return new Date().toISOString().split("T")[0] + "T00:00:00";
  }

  function getMonthStart() {
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  }

  function updateSummaryAfterCollection(delivery: DeliveryRow) {
    if (role !== "SINDICO") {
      return;
    }

    const todayStart = getTodayStart();
    const monthStart = getMonthStart();
    const isToday = delivery.criado_em >= todayStart;
    const isThisMonth = delivery.criado_em >= monthStart;

    setSummary((current) => ({
      ...current,
      awaiting: Math.max(0, current.awaiting - 1),
      retiredThisMonth: isThisMonth ? current.retiredThisMonth + 1 : current.retiredThisMonth,
      today: current.today
    }));

    if (isToday) {
      setSummary((current) => ({
        ...current,
        today: current.today
      }));
    }
  }

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        setError("Não foi possível carregar a sessão do usuário.");
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("perfis_usuario")
        .select("condominio_id, role, ativo")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<ProfileRow>();

      if (profilesError || !profiles?.condominio_id || !profiles?.role) {
        setError("Nenhum condomínio ativo encontrado para este usuário.");
        setLoading(false);
        return;
      }

      setCondominioId(profiles.condominio_id);
      setRole(profiles.role);

      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from("entregas")
        .select("id, unidade_id, unidade:unidades(numero), remetente, foto_url, status, criado_em, retirado_em")
        .eq("condominio_id", profiles.condominio_id)
        .order("criado_em", { ascending: false });

      if (deliveriesError) {
        setError(deliveriesError.message);
        setLoading(false);
        return;
      }

      setDeliveries((deliveriesData ?? []) as unknown as DeliveryRow[]);

      if (profiles.role === "SINDICO") {
        const todayStart = getTodayStart();
        const monthStart = getMonthStart();

        const [todayCount, awaitingCount, retiredCount] = await Promise.all([
          supabase
            .from("entregas")
            .select("id", { count: "exact", head: true })
            .eq("condominio_id", profiles.condominio_id)
            .gte("criado_em", todayStart),
          supabase
            .from("entregas")
            .select("id", { count: "exact", head: true })
            .eq("condominio_id", profiles.condominio_id)
            .eq("status", "AGUARDANDO"),
          supabase
            .from("entregas")
            .select("id", { count: "exact", head: true })
            .eq("condominio_id", profiles.condominio_id)
            .eq("status", "RETIRADO")
            .gte("criado_em", monthStart)
        ]);

        setSummary({
          today: todayCount.count ?? 0,
          awaiting: awaitingCount.count ?? 0,
          retiredThisMonth: retiredCount.count ?? 0
        });
      }

      setLoading(false);
    }

    void loadPage();
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

  async function markAsCollected(deliveryId: string) {
    if (!condominioId) {
      return;
    }

    setSavingId(deliveryId);
    const deliveryToUpdate = deliveries.find((item) => item.id === deliveryId);

    const { error: updateError } = await supabase
      .from("entregas")
      .update({ status: "RETIRADO", retirado_em: new Date().toISOString() })
      .eq("id", deliveryId)
      .eq("condominio_id", condominioId);

    setSavingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (deliveryToUpdate) {
      setDeliveries((currentDeliveries) =>
        currentDeliveries.map((delivery) =>
          delivery.id === deliveryId
            ? {
                ...delivery,
                status: "RETIRADO",
                retirado_em: new Date().toISOString()
              }
            : delivery
        )
      );
      updateSummaryAfterCollection(deliveryToUpdate);
    }
  }

  function openConfirmDialog(deliveryId: string) {
    const delivery = deliveries.find((item) => item.id === deliveryId) ?? null;
    setDeliveryToConfirm(delivery);
  }

  async function confirmMarkAsCollected() {
    if (!deliveryToConfirm) {
      return;
    }

    const deliveryId = deliveryToConfirm.id;
    setDeliveryToConfirm(null);
    await markAsCollected(deliveryId);
  }

  function isToday(value: string) {
    return value >= getTodayStart();
  }

  function isThisMonth(value: string) {
    return value >= getMonthStart();
  }

  return (
    <>
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">
                Entregas
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Lista de entregas do condomínio
              </h1>
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

          {role === "SINDICO" ? (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-[#1A3A5C] p-5 text-white shadow-sm">
                <p className="text-sm font-medium text-white/75">Total de entregas hoje</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">{summary.today}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
                <p className="text-sm font-medium text-amber-700">Total aguardando retirada</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">{summary.awaiting}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
                <p className="text-sm font-medium text-emerald-700">Total retiradas este mês</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">{summary.retiredThisMonth}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Foto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Unidade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Remetente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={5}>
                      Carregando entregas...
                    </td>
                  </tr>
                ) : filteredDeliveries.length ? (
                  filteredDeliveries.map((delivery) => {
                    const isPending = delivery.status === "AGUARDANDO";

                    return (
                      <tr key={delivery.id}>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {delivery.foto_url ? (
                            <a href={delivery.foto_url} target="_blank" rel="noreferrer" className="inline-block">
                              <img
                                src={delivery.foto_url}
                                alt="Foto da entrega"
                                className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                              />
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-900">
                          {delivery.unidade?.numero ?? "-"}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">{delivery.remetente ?? "-"}</td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              isPending
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isPending ? "Aguardando" : "Retirado"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatDate(delivery.criado_em)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {isPending && canMarkAsCollected ? (
                            <button
                              type="button"
                              onClick={() => openConfirmDialog(delivery.id)}
                              disabled={savingId === delivery.id}
                              className="rounded-xl bg-[#1A3A5C] px-4 py-2 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingId === delivery.id ? "Salvando..." : "Marcar como retirado"}
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                      Nenhuma entrega encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </main>

    <ConfirmDialog
      isOpen={deliveryToConfirm !== null}
      title="Confirmar retirada"
      message={`Confirmar retirada da encomenda da Unidade ${deliveryToConfirm?.unidade?.numero ?? "-"}?`}
      confirmLabel="Confirmar"
      danger={false}
      onCancel={() => setDeliveryToConfirm(null)}
      onConfirm={() => void confirmMarkAsCollected()}
    />
    </>
  );
}