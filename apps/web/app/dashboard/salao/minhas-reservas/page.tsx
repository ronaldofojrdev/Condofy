"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type ReservaStatus = "PENDENTE" | "APROVADO" | "REJEITADO" | "CANCELADO";

type ReservaRow = {
  id: string;
  salao_id: string;
  data_reserva: string;
  horario_inicio: string;
  horario_fim: string;
  status: ReservaStatus;
  motivo_rejeicao: string | null;
  criado_em: string;
  salao_nome: string | null;
  solicitante_nome: string | null;
};

const STATUS_STYLES: Record<ReservaStatus, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  REJEITADO: "bg-red-100 text-red-800",
  CANCELADO: "bg-slate-200 text-slate-700"
};

const STATUS_LABELS: Record<ReservaStatus, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovada",
  REJEITADO: "Rejeitada",
  CANCELADO: "Cancelada"
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(new Date(year, month - 1, day));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function MinhasReservasSalaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [reservas, setReservas] = useState<ReservaRow[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
          setError("Não foi possível carregar a sessão do usuário.");
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
          setError("Nenhum condomínio ativo encontrado para este usuário.");
          return;
        }

        setCondominioId(profile.condominio_id);
        setRole(profile.role);

        if (profile.role !== "MORADOR" && profile.role !== "SINDICO") {
          router.replace("/dashboard/entregas");
          return;
        }

        const accessToken = sessionData.session.access_token;

        if (!accessToken) {
          setError("Não foi possível autenticar a sessão do usuário.");
          return;
        }

        const response = await fetch("/api/reservas", {
          cache: "no-store",
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? "Não foi possível carregar as reservas.");
          return;
        }

        const reservasData = (await response.json()) as ReservaRow[];
        setReservas(reservasData);
      } catch {
        setError("Erro ao carregar reservas. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    void loadPage();
  }, []);

  async function refreshReservas() {
    if (!condominioId || !role) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      return;
    }

    const response = await fetch("/api/reservas", {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ReservaRow[];
    setReservas(data);
  }

  async function updateReservaStatus(
    reservaId: string,
    status: "APROVADO" | "REJEITADO" | "CANCELADO",
    motivoRejeicao?: string
  ) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError("Não foi possível autenticar a sessão do usuário.");
      return false;
    }

    const response = await fetch(`/api/reservas/${reservaId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        status,
        motivo_rejeicao: motivoRejeicao ?? null
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Não foi possível atualizar a reserva.");
      return false;
    }

    await refreshReservas();
    return true;
  }

  async function cancelReserva(reservaId: string) {
    await updateReservaStatus(reservaId, "CANCELADO");
  }

  async function approveReserva(reservaId: string) {
    await updateReservaStatus(reservaId, "APROVADO");
  }

  async function rejectReserva(reservaId: string) {
    if (!motivoRejeicao.trim()) {
      setError("Informe o motivo da rejeição.");
      return;
    }

    const updated = await updateReservaStatus(reservaId, "REJEITADO", motivoRejeicao.trim());

    if (updated) {
      setRejectingId(null);
      setMotivoRejeicao("");
    }
  }

  const visibleReservas = useMemo(() => reservas, [reservas]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm text-slate-500">Carregando reservas...</p>
          </div>
        </div>
      </main>
    );
  }

  if (role !== "MORADOR" && role !== "SINDICO") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Salão</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {role === "SINDICO" ? "Todas as reservas" : "Minhas reservas"}
              </h1>
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 space-y-4">
            {visibleReservas.length ? (
              visibleReservas.map((reserva) => {
                const isPending = reserva.status === "PENDENTE";
                const canCancel = role === "MORADOR" && isPending;

                return (
                  <article key={reserva.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                          {reserva.salao_nome ?? "Salão"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDate(reserva.data_reserva)} • {reserva.horario_inicio} - {reserva.horario_fim}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Solicitante: {reserva.solicitante_nome ?? "Não informado"}
                        </p>
                        {reserva.motivo_rejeicao ? (
                          <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            Motivo da rejeição: {reserva.motivo_rejeicao}
                          </p>
                        ) : null}
                      </div>

                      <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[reserva.status]}`}>
                        {STATUS_LABELS[reserva.status] ?? reserva.status}
                      </span>
                    </div>

                    {role === "SINDICO" && isPending ? (
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <button
                          type="button"
                          onClick={() => void approveReserva(reserva.id)}
                          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                          Aprovar
                        </button>

                        {rejectingId === reserva.id ? (
                          <div className="flex flex-1 flex-col gap-3">
                            <textarea
                              value={motivoRejeicao}
                              onChange={(event) => setMotivoRejeicao(event.target.value)}
                              className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                              placeholder="Motivo da rejeição"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void rejectReserva(reserva.id)}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                              >
                                Rejeitar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(null);
                                  setMotivoRejeicao("");
                                }}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRejectingId(reserva.id)}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            Rejeitar
                          </button>
                        )}
                      </div>
                    ) : null}

                    {canCancel ? (
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <button
                          type="button"
                          onClick={() => void cancelReserva(reserva.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                Nenhuma reserva encontrada.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
