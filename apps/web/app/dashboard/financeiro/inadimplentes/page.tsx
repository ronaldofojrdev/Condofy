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
  usuarios: { nome: string }[] | { nome: string } | null;
};

type CobrancaRow = {
  id: string;
  unidade_id: string;
  descricao: string;
  tipo: CobrancaTipo;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
  pago_em: string | null;
  // Supabase returns many-to-one FK joins as a single object, not an array
  unidade: {
    id: string;
    numero: string;
    bloco_id: string | null;
    bloco: { nome: string } | null;
    perfis_usuario: RelatedProfileRow[] | null;
  } | null;
};

type DevedorCobranca = {
  id: string;
  descricao: string;
  tipo: CobrancaTipo;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
};

type Devedor = {
  unidade_id: string;
  morador: string;
  unidadeLabel: string;
  totalEmAtraso: number;
  cobrancas: DevedorCobranca[];
};

const TIPO_LABELS: Record<string, string> = {
  TAXA_MENSAL: "Taxa Mensal",
  EXTRA: "Taxa Extra",
  MULTA: "Multa"
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(year, month - 1, day)
  );
}

function resolveUsuarioNome(usuarios: { nome: string }[] | { nome: string } | null | undefined): string | null {
  if (!usuarios) return null;
  if (Array.isArray(usuarios)) return usuarios[0]?.nome ?? null;
  return usuarios.nome ?? null;
}

function getMoradorNome(perfis: RelatedProfileRow[] | null): string {
  if (!perfis) return "Sem morador";
  const morador =
    perfis.find((p) => p.ativo && p.role === "MORADOR") ?? perfis[0] ?? null;
  return resolveUsuarioNome(morador?.usuarios) ?? "Sem morador";
}

function getUnidadeLabel(
  numero: string,
  bloco: { nome: string } | null
): string {
  const blocoNome = bloco?.nome;
  // blocoNome already contains "Bloco X" from the DB, so don't prefix again
  if (blocoNome) return `${blocoNome} — Unidade ${numero}`;
  return `Unidade ${numero}`;
}

function buildDevedores(cobrancas: CobrancaRow[]): Devedor[] {
  const map = new Map<string, Devedor>();

  for (const c of cobrancas) {
    if (c.status !== "ATRASADO") continue;

    const unidade = c.unidade ?? null;
    if (!unidade) continue;

    const existing = map.get(c.unidade_id);

    if (existing) {
      existing.totalEmAtraso += Number(c.valor);
      existing.cobrancas.push({
        id: c.id,
        descricao: c.descricao,
        tipo: c.tipo,
        valor: Number(c.valor),
        vencimento: c.vencimento,
        status: c.status
      });
    } else {
      map.set(c.unidade_id, {
        unidade_id: c.unidade_id,
        morador: getMoradorNome(unidade.perfis_usuario),
        unidadeLabel: getUnidadeLabel(unidade.numero, unidade.bloco),
        totalEmAtraso: Number(c.valor),
        cobrancas: [
          {
            id: c.id,
            descricao: c.descricao,
            tipo: c.tipo,
            valor: Number(c.valor),
            vencimento: c.vencimento,
            status: c.status
          }
        ]
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.totalEmAtraso - a.totalEmAtraso
  );
}

export default function InadimplentesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [cobrancas, setCobrancas] = useState<CobrancaRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedUnidades, setExpandedUnidades] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

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
            id, unidade_id, descricao, tipo, valor, vencimento, status, pago_em,
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
        .eq("status", "ATRASADO")
        .order("vencimento", { ascending: true });

      if (cobrancasError) {
        setError(cobrancasError.message);
        setLoading(false);
        return;
      }

      setCobrancas((data ?? []) as unknown as CobrancaRow[]);
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  const devedores = useMemo(() => buildDevedores(cobrancas), [cobrancas]);

  const totalGeral = useMemo(
    () => devedores.reduce((acc, d) => acc + d.totalEmAtraso, 0),
    [devedores]
  );

  function toggleExpand(unidadeId: string) {
    setExpandedUnidades((prev) => {
      const next = new Set(prev);
      if (next.has(unidadeId)) {
        next.delete(unidadeId);
      } else {
        next.add(unidadeId);
      }
      return next;
    });
  }

  async function markAsPaid(cobrancaId: string, unidadeId: string) {
    if (!condominioId) return;
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

    // Remove this charge from local state
    setCobrancas((prev) => prev.filter((c) => c.id !== cobrancaId));
  }

  if (role !== "SINDICO") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-600">
                Financeiro
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Inadimplência
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Moradores com cobranças em atraso.
              </p>
            </div>

            <Link
              href="/dashboard/financeiro"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Voltar ao financeiro
            </Link>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {!loading && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <p className="text-sm text-rose-600">Unidades inadimplentes</p>
                <p className="mt-2 text-3xl font-semibold text-rose-700">
                  {devedores.length}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <p className="text-sm text-rose-600">Total em atraso</p>
                <p className="mt-2 text-3xl font-semibold text-rose-700">
                  {formatCurrency(totalGeral)}
                </p>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 text-center text-sm text-slate-500">
            Carregando inadimplentes...
          </div>
        ) : devedores.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 shadow-sm ring-1 ring-slate-200 text-center">
            <div className="text-4xl">🎉</div>
            <p className="mt-3 text-base font-semibold text-slate-900">
              Nenhuma inadimplência!
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Todas as cobranças estão em dia.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {devedores.map((devedor) => {
              const expanded = expandedUnidades.has(devedor.unidade_id);
              return (
                <div
                  key={devedor.unidade_id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(devedor.unidade_id)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {devedor.morador}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {devedor.unidadeLabel}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total em atraso</p>
                        <p className="font-semibold text-rose-600">
                          {formatCurrency(devedor.totalEmAtraso)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {devedor.cobrancas.length} cobrança
                          {devedor.cobrancas.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Descrição
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Tipo
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Valor
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Vencimento
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Ação
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {devedor.cobrancas.map((c) => (
                            <tr key={c.id}>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {c.descricao}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-500">
                                {TIPO_LABELS[c.tipo] ?? c.tipo}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-rose-600">
                                {formatCurrency(c.valor)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                                {formatDate(c.vencimento)}
                              </td>
                              <td className="px-4 py-4 text-sm">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void markAsPaid(c.id, devedor.unidade_id)
                                  }
                                  disabled={savingId === c.id}
                                  className="inline-flex items-center rounded-xl border border-emerald-600 px-4 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingId === c.id
                                    ? "Salvando..."
                                    : "Marcar como pago"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
