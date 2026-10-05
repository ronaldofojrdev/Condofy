"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  unidade_id: string | null;
  role: DashboardRole;
};

type CobrancaStatus = "PENDENTE" | "PAGO" | "ATRASADO";
type CobrancaTipo = "TAXA_MENSAL" | "MULTA" | "EXTRA";

type CobrancaRow = {
  id: string;
  descricao: string;
  tipo: CobrancaTipo;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
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

const TIPO_LABEL: Record<CobrancaTipo, string> = {
  TAXA_MENSAL: "Taxa Mensal",
  MULTA: "Multa",
  EXTRA: "Taxa Extra"
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

export default function MeuExtratoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [unidadeNumero, setUnidadeNumero] = useState("");
  const [cobrancas, setCobrancas] = useState<CobrancaRow[]>([]);

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

      const { data: profile, error: profileError } = await supabase
        .from("perfis_usuario")
        .select("condominio_id, unidade_id, role")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<ProfileRow>();

      if (profileError || !profile?.condominio_id || !profile.role) {
        setError("Nenhum condomínio ativo encontrado para este usuário.");
        setLoading(false);
        return;
      }

      if (profile.role !== "MORADOR") {
        router.replace("/dashboard/entregas");
        return;
      }

      if (!profile.unidade_id) {
        setError("Nenhuma unidade vinculada ao seu perfil.");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      const [{ data: unitData, error: unitError }, { data: cobrancasData, error: cobrancasError }] =
        await Promise.all([
          supabase.from("unidades").select("numero").eq("id", profile.unidade_id).single(),
          supabase
            .from("cobrancas")
            .select("id, descricao, tipo, valor, vencimento, status")
            .eq("condominio_id", profile.condominio_id)
            .eq("unidade_id", profile.unidade_id)
            .order("vencimento", { ascending: false })
        ]);

      if (unitError) {
        setError(unitError.message);
        setLoading(false);
        return;
      }

      if (cobrancasError) {
        setError(cobrancasError.message);
        setLoading(false);
        return;
      }

      setUnidadeNumero(unitData?.numero ?? "");
      setCobrancas((cobrancasData ?? []) as CobrancaRow[]);
      setLoading(false);
    }

    void loadPage();
  }, []);

  const totalPendente = useMemo(() => {
    return cobrancas
      .filter((cobranca) => cobranca.status === "PENDENTE" || cobranca.status === "ATRASADO")
      .reduce((accumulator, cobranca) => accumulator + Number(cobranca.valor), 0);
  }, [cobrancas]);

  if (role !== "MORADOR") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Financeiro</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Meu extrato</h1>
              <p className="mt-2 text-sm text-slate-600">Unidade {unidadeNumero ? `• ${unidadeNumero}` : ""}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Total pendente</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : formatCurrency(totalPendente)}</p>
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Carregando cobranças...
              </div>
            ) : cobrancas.length ? (
              cobrancas.map((cobranca) => (
                <article key={cobranca.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{cobranca.descricao}</h2>
                      <p className="mt-2 text-sm text-slate-600">{formatDate(cobranca.vencimento)}</p>
                      <p className="mt-1 text-sm text-slate-600">{TIPO_LABEL[cobranca.tipo] ?? cobranca.tipo}</p>
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[cobranca.status]}`}>
                        {STATUS_LABEL[cobranca.status] ?? cobranca.status}
                      </span>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(Number(cobranca.valor))}</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                Nenhuma cobrança encontrada.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
