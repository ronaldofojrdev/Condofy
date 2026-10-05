"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Visitante = {
  id: string;
  nome: string;
  unidade_numero: string | null;
  entrada_em: string;
};

type Metricas = {
  entregasPendentes: number;
  veiculosCadastrados: number;
  visitantesAtivos: number;
  visitantesHoje: number;
  visitantesNoCondominio: Visitante[];
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(value));
}

export default function PorteiroDashboardPage() {
  const router = useRouter();
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("perfis_usuario")
        .select("role")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<{ role: string }>();

      if (profile?.role !== "PORTEIRO" && profile?.role !== "SINDICO") {
        router.replace("/dashboard");
        return;
      }

      setToken(sessionData.session.access_token);

      try {
        const res = await fetch("/api/porteiro/metricas", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        if (res.ok) {
          setMetricas(await res.json() as Metricas);
        }
      } catch {
        // silently fail — dashboard still renders without metrics
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  const cards = metricas ? [
    {
      label: "Entregas pendentes",
      value: metricas.entregasPendentes,
      detail: "aguardando retirada",
      href: "/dashboard/entregas",
      urgent: metricas.entregasPendentes > 0,
    },
    {
      label: "Visitantes hoje",
      value: metricas.visitantesHoje,
      detail: `${metricas.visitantesAtivos} no condomínio agora`,
      href: "/dashboard/visitantes",
      urgent: false,
    },
    {
      label: "Veículos cadastrados",
      value: metricas.veiculosCadastrados,
      detail: "ativos no condomínio",
      href: "/dashboard/veiculos",
      urgent: false,
    },
  ] : [];

  const acoes = [
    { label: "Registrar entrega", href: "/dashboard/entregas/registrar", icon: "📦" },
    { label: "Registrar visita", href: "/dashboard/visitantes/registrar", icon: "🚶" },
    { label: "Registrar veículo", href: "/dashboard/veiculos/registrar", icon: "🚗" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Portaria</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Painel de Controle</h1>
          <p className="mt-2 text-sm text-slate-500">
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date())}
          </p>
        </div>

        {/* Métricas */}
        <div className="grid gap-4 sm:grid-cols-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 animate-pulse">
                <div className="h-4 w-24 rounded bg-slate-100" />
                <div className="mt-3 h-8 w-12 rounded bg-slate-100" />
                <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
              </div>
            ))
          ) : (
            cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition hover:shadow-md ${
                  card.urgent ? "ring-amber-300 bg-amber-50" : "ring-slate-200"
                }`}
              >
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className={`mt-3 text-3xl font-semibold tracking-tight ${card.urgent ? "text-amber-700" : "text-slate-900"}`}>
                  {card.value}
                </p>
                <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
              </Link>
            ))
          )}
        </div>

        {/* Ações rápidas */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Ações rápidas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {acoes.map((acao) => (
              <Link
                key={acao.href}
                href={acao.href}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
              >
                <span className="text-xl">{acao.icon}</span>
                {acao.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Visitantes no condomínio agora */}
        {!loading && metricas && metricas.visitantesNoCondominio.length > 0 && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">No condomínio agora</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {metricas.visitantesAtivos} presente{metricas.visitantesAtivos !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="mt-4 divide-y divide-slate-100">
              {metricas.visitantesNoCondominio.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{v.nome}</p>
                    {v.unidade_numero && (
                      <p className="text-xs text-slate-400">Unidade {v.unidade_numero}</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">desde {formatTime(v.entrada_em)}</p>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/visitantes"
              className="mt-4 block text-center text-sm font-medium text-[#1A3A5C] hover:underline"
            >
              Ver todos →
            </Link>
          </div>
        )}

      </div>
    </main>
  );
}
