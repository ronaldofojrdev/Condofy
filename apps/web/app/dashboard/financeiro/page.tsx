"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type CobrancaStatus = "PENDENTE" | "PAGO" | "ATRASADO";
type CobrancaTipo = "TAXA_MENSAL" | "MULTA" | "EXTRA";

type CobrancaRow = {
  id: string;
  unidade_id: string;
  descricao: string;
  tipo: CobrancaTipo;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
  pago_em: string | null;
  unidade: {
    numero: string;
  } | null;
};

type Summary = {
  totalAReceber: number;
  totalRecebidoMes: number;
  unidadesInadimplentes: number;
};

const STATUS_STYLE: Record<CobrancaStatus, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  PAGO: "bg-emerald-100 text-emerald-800",
  ATRASADO: "bg-red-100 text-red-800"
};

const STATUS_LABEL: Record<CobrancaStatus, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado"
};

const TIPO_STYLE: Record<CobrancaTipo, string> = {
  TAXA_MENSAL: "bg-blue-100 text-blue-800",
  MULTA: "bg-rose-100 text-rose-800",
  EXTRA: "bg-violet-100 text-violet-800"
};

const TIPO_COBRANCA_LABELS: Record<string, string> = {
  TAXA_MENSAL: "Taxa Mensal",
  TAXA_EXTRA: "Taxa Extra",
  EXTRA: "Taxa Extra",
  MULTA: "Multa",
  RESERVA: "Reserva de Salão",
  OUTRO: "Outro"
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(new Date(year, month - 1, day));
}

function startOfMonthIso() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
}

function toLocalMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function calculateSummary(charges: Array<Pick<CobrancaRow, "valor" | "status" | "unidade_id" | "pago_em">>) {
  return {
    totalAReceber: charges
      .filter((cobranca) => cobranca.status === "PENDENTE" || cobranca.status === "ATRASADO")
      .reduce((accumulator, cobranca) => accumulator + Number(cobranca.valor), 0),
    totalRecebidoMes: charges
      .filter((cobranca) => cobranca.status === "PAGO" && cobranca.pago_em && cobranca.pago_em >= startOfMonthIso())
      .reduce((accumulator, cobranca) => accumulator + Number(cobranca.valor), 0),
    unidadesInadimplentes: new Set(
      charges.filter((cobranca) => cobranca.status === "ATRASADO").map((cobranca) => cobranca.unidade_id)
    ).size
  };
}

function isCurrentMonthDate(value: string) {
  return toLocalMonthValue(value) === toLocalMonthValue(new Date().toISOString().slice(0, 10));
}

export default function FinanceiroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDENTE" | "ATRASADO" | "PAGO">("ALL");
  const [cobrancas, setCobrancas] = useState<CobrancaRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalAReceber: 0,
    totalRecebidoMes: 0,
    unidadesInadimplentes: 0
  });
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
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

      const [cobrancasResponse, summaryResponse] = await Promise.all([
        supabase
          .from("cobrancas")
          .select("id, unidade_id, descricao, tipo, valor, vencimento, status, pago_em, unidade:unidades(numero)")
          .eq("condominio_id", profile.condominio_id)
          .order("vencimento", { ascending: false }),
        supabase
          .from("cobrancas")
          .select("valor, status, unidade_id, pago_em")
          .eq("condominio_id", profile.condominio_id)
      ]);

      if (cobrancasResponse.error) {
        setError(cobrancasResponse.error.message);
        setLoading(false);
        return;
      }

      if (summaryResponse.error) {
        setError(summaryResponse.error.message);
        setLoading(false);
        return;
      }

      const charges = (cobrancasResponse.data ?? []) as unknown as CobrancaRow[];
      const summaryCharges = (summaryResponse.data ?? []) as Array<{
        valor: number;
        status: CobrancaStatus;
        pago_em: string | null;
        unidade_id: string;
      }>;

      setCobrancas(charges);
      setSummary(calculateSummary(summaryCharges));

      setLoading(false);
    }

    void loadPage();
  }, [router]);

  const filteredCobrancas = useMemo(() => {
    if (filter === "ALL") {
      return cobrancas;
    }

    return cobrancas.filter((cobranca) => cobranca.status === filter);
  }, [cobrancas, filter]);

  async function markAsPaid(cobrancaId: string) {
    if (!condominioId) {
      return;
    }

    setSavingId(cobrancaId);

    const { error: updateError } = await supabase
      .from("cobrancas")
      .update({ status: "PAGO", pago_em: new Date().toISOString() })
      .eq("id", cobrancaId)
      .eq("condominio_id", condominioId);

    setSavingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCobrancas((current) =>
      current.map((cobranca) =>
        cobranca.id === cobrancaId
          ? {
              ...cobranca,
              status: "PAGO",
              pago_em: new Date().toISOString()
            }
          : cobranca
      )
    );


    const { data: refreshedCharges } = await supabase
      .from("cobrancas")
      .select("valor, status, unidade_id, pago_em")
      .eq("condominio_id", condominioId);

    setSummary(calculateSummary((refreshedCharges ?? []) as Array<{
      valor: number;
      status: CobrancaStatus;
      unidade_id: string;
      pago_em: string | null;
    }>));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-56 rounded bg-slate-200" />
            <div className="mt-3 h-3 w-72 rounded bg-slate-200" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="h-20 rounded-2xl bg-slate-100" />
              <div className="h-20 rounded-2xl bg-slate-100" />
              <div className="h-20 rounded-2xl bg-slate-100" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-10 rounded-xl bg-slate-100" />
              <div className="h-10 rounded-xl bg-slate-100" />
              <div className="h-10 rounded-xl bg-slate-100" />
            </div>
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
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Financeiro</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Painel financeiro</h1>
              <p className="mt-2 text-sm text-slate-600">Acompanhe cobranças, inadimplência e pagamentos do condomínio.</p>
            </div>

            <Link
              href="/dashboard/financeiro/lancar"
              className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
            >
              Lançar cobrança
            </Link>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total a receber</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {loading ? "..." : formatCurrency(summary.totalAReceber)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total recebido este mês</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {loading ? "..." : formatCurrency(summary.totalRecebidoMes)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Unidades inadimplentes</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "..." : summary.unidadesInadimplentes}</p>
            </div>
          </div>

          <div className="mt-6 inline-flex rounded-2xl bg-slate-100 p-1">
            {[
              { key: "ALL", label: "Todas" },
              { key: "PENDENTE", label: "Pendentes" },
              { key: "ATRASADO", label: "Atrasadas" },
              { key: "PAGO", label: "Pagas" }
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

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Carregando cobranças...</div>
            ) : filteredCobrancas.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Unidade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Vencimento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredCobrancas.map((cobranca) => {
                      const canMark = cobranca.status === "PENDENTE" || cobranca.status === "ATRASADO";

                      return (
                        <tr key={cobranca.id}>
                          <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900">{cobranca.unidade?.numero ?? "-"}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{cobranca.descricao}</td>
                          <td className="px-4 py-4 text-sm">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${TIPO_STYLE[cobranca.tipo]}`}>
                              {TIPO_COBRANCA_LABELS[cobranca.tipo] ?? cobranca.tipo}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{formatCurrency(Number(cobranca.valor))}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{formatDate(cobranca.vencimento)}</td>
                          <td className="px-4 py-4 text-sm">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[cobranca.status]}`}>
                              {STATUS_LABEL[cobranca.status] ?? cobranca.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {canMark ? (
                              <button
                                type="button"
                                onClick={() => void markAsPaid(cobranca.id)}
                                disabled={savingId === cobranca.id}
                                className="inline-flex items-center justify-center rounded-xl border border-[#1A3A5C] px-4 py-2 font-medium text-[#1A3A5C] transition hover:bg-[#1A3A5C] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingId === cobranca.id ? "Salvando..." : "Marcar como pago"}
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma cobrança encontrada.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
