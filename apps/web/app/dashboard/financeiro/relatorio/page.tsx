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

type RelatedProfileRow = {
  unidade_id: string | null;
  role: DashboardRole;
  ativo: boolean;
  usuarios: {
    nome: string;
  }[] | null;
};

type ReportCobrancaRow = {
  id: string;
  unidade_id: string;
  descricao: string;
  tipo: CobrancaTipo;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
  pago_em: string | null;
  criado_em: string;
  unidade: {
    id: string;
    numero: string;
    bloco_id: string | null;
    bloco: {
      nome: string;
    }[] | null;
    perfis_usuario: RelatedProfileRow[] | null;
  }[] | null;
};

type Summary = {
  totalLancado: number;
  totalPago: number;
  totalPendente: number;
  totalAtrasado: number;
};

type ReportRow = {
  id: string;
  morador: string;
  unidade: string;
  tipo: CobrancaTipo;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
  pagoEm: string | null;
};

const STATUS_OPTIONS: Array<{ value: "ALL" | CobrancaStatus; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "PAGO", label: "Pago" },
  { value: "ATRASADO", label: "Atrasado" }
];

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

const TIPO_LABEL: Record<CobrancaTipo, string> = {
  TAXA_MENSAL: "Taxa Mensal",
  MULTA: "Multa",
  EXTRA: "Taxa Extra"
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  })
    .format(date)
    .replace(/^./, (character) => character.toUpperCase());
}

function isSameMonth(dateValue: string, selectedMonth: string) {
  const [year, month] = dateValue.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}` === selectedMonth;
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsv(rows: ReportRow[]) {
  const headers = ["Morador", "Unidade", "Tipo", "Valor", "Vencimento", "Status", "Pago em"];
  const lines = [headers.join(";")];

  rows.forEach((row) => {
    lines.push(
      [
        escapeCsv(row.morador),
        escapeCsv(row.unidade),
        escapeCsv(row.tipo),
        escapeCsv(row.valor.toFixed(2).replace(".", ",")),
        escapeCsv(row.vencimento),
        escapeCsv(row.status),
        escapeCsv(row.pagoEm ? formatDate(row.pagoEm) : "-")
      ].join(";")
    );
  });

  return lines.join("\n");
}

function resolveJoin<T>(field: T[] | T | null | undefined): T | null {
  if (field == null) return null;
  return Array.isArray(field) ? (field[0] ?? null) : field;
}

function getResidentFromCharge(cobranca: ReportCobrancaRow) {
  const unidade = resolveJoin(cobranca.unidade);
  const moradores = unidade?.perfis_usuario ?? [];
  const morador = moradores.find((perfil) => perfil.ativo && perfil.role === "MORADOR") ?? moradores[0] ?? null;
  return resolveJoin(morador?.usuarios)?.nome ?? "Sem morador";
}

function getUnitLabel(cobranca: ReportCobrancaRow) {
  const unidade = resolveJoin(cobranca.unidade);
  if (!unidade) {
    return "-";
  }

  const blocoNome = resolveJoin(unidade.bloco)?.nome;

  if (blocoNome) {
    return `Bloco ${blocoNome} — Unidade ${unidade.numero}`;
  }

  return `Unidade ${unidade.numero}`;
}

function flattenCharge(cobranca: ReportCobrancaRow): ReportRow {
  const unidade = resolveJoin(cobranca.unidade);

  return {
    id: cobranca.id,
    morador: getResidentFromCharge(cobranca),
    unidade: unidade ? getUnitLabel(cobranca) : "-",
    tipo: cobranca.tipo,
    valor: Number(cobranca.valor),
    vencimento: cobranca.vencimento,
    status: cobranca.status,
    pagoEm: cobranca.pago_em
  };
}

function calculateSummary(rows: ReportRow[]): Summary {
  return rows.reduce<Summary>(
    (accumulator, row) => {
      const valor = Number(row.valor);
      accumulator.totalLancado += valor;

      if (row.status === "PAGO") {
        accumulator.totalPago += valor;
      }

      if (row.status === "PENDENTE") {
        accumulator.totalPendente += valor;
      }

      if (row.status === "ATRASADO") {
        accumulator.totalAtrasado += valor;
      }

      return accumulator;
    },
    {
      totalLancado: 0,
      totalPago: 0,
      totalPendente: 0,
      totalAtrasado: 0
    }
  );
}

export default function RelatorioFinanceiroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | CobrancaStatus>("ALL");
  const [selectedMonth, setSelectedMonth] = useState(monthValue(new Date()));

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      return {
        value: monthValue(date),
        label: monthLabel(date)
      };
    });
  }, []);

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

      const { data, error: cobrancasError } = await supabase
        .from("cobrancas")
        .select(
          `
            *,
            unidade:unidades(
              id,
              numero,
              bloco_id,
              bloco:blocos(nome),
              perfis_usuario(
                unidade_id,
                role,
                ativo,
                usuarios(nome)
              )
            )
          `
        )
        .eq("condominio_id", profile.condominio_id)
        .order("vencimento", { ascending: false });

      if (cobrancasError) {
        setError(cobrancasError.message);
        setLoading(false);
        return;
      }

      setRows(((data ?? []) as unknown as ReportCobrancaRow[]).map(flattenCharge));
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  const monthRows = useMemo(() => rows.filter((row) => isSameMonth(row.vencimento, selectedMonth)), [rows, selectedMonth]);

  const summary = useMemo(() => calculateSummary(monthRows), [monthRows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "ALL") {
      return monthRows;
    }

    return monthRows.filter((row) => row.status === statusFilter);
  }, [monthRows, statusFilter]);

  function handleExportCsv() {
    const csv = buildCsv(filteredRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = `relatorio-financeiro-${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Relatório financeiro</h1>
              <p className="mt-2 text-sm text-slate-600">Visão consolidada das cobranças do condomínio com filtros por mês e status.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/financeiro"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Voltar ao financeiro
              </Link>
              <Link
                href="/dashboard/financeiro/lancar"
                className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
              >
                Lançar cobrança
              </Link>
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total lançado</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "..." : formatCurrency(summary.totalLancado)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total pago</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "..." : formatCurrency(summary.totalPago)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total pendente</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "..." : formatCurrency(summary.totalPendente)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total em atraso</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "..." : formatCurrency(summary.totalAtrasado)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    statusFilter === option.value ? "bg-[#1A3A5C] text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-60">
                <label htmlFor="month" className="mb-2 block text-sm font-medium text-slate-700">
                  Mês
                </label>
                <select
                  id="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center justify-center rounded-xl border border-[#1A3A5C] px-5 py-3 text-sm font-medium text-[#1A3A5C] transition hover:bg-[#1A3A5C] hover:text-white"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Carregando relatório...</div>
            ) : filteredRows.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Morador</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Unidade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Vencimento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-4 text-sm text-slate-700">{row.morador}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{row.unidade}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${TIPO_STYLE[row.tipo]}`}>
                            {TIPO_LABEL[row.tipo]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{formatCurrency(row.valor)}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{formatDate(row.vencimento)}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[row.status]}`}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma cobrança encontrada para os filtros selecionados.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}