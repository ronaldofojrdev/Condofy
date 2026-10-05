"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type BackofficeRole = "ADMIN" | "IMPLEMENTACAO" | "COMERCIAL" | "FINANCEIRO" | "JURIDICO" | "DEV";

type Metric = {
  label: string;
  value: string | number;
  sub?: string;
  soon?: boolean;
};

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-400">{metric.label}</p>
      {metric.soon ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-200">—</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            em breve
          </span>
        </div>
      ) : (
        <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
      )}
      {metric.sub && !metric.soon && (
        <p className="mt-1 text-xs text-slate-400">{metric.sub}</p>
      )}
    </div>
  );
}

function SoonBadge({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-400">{label}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          fase 2+
        </span>
      </div>
      <div className="mt-3 h-16 rounded-lg bg-slate-100/50" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
        <div className="mt-2 h-7 w-48 rounded bg-slate-100 animate-pulse" />
        <div className="mt-1 h-4 w-64 rounded bg-slate-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="mt-3 h-7 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<BackofficeRole | null>(null);
  const [nome, setNome] = useState("");
  const [metrics, setMetrics] = useState<{
    condominios: number;
    sindicos: number;
    moradores: number;
    porteiros: number;
    colaboradores: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    setMounted(true);

    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
    setDateStr(
      now.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: colab } = await supabase
        .from("backoffice_colaboradores")
        .select("nome, role")
        .eq("usuario_id", user.id)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (colab) {
        setNome(colab.nome);
        setRole(colab.role as BackofficeRole);
      }

      const [condRes, sindRes, morRes, portRes, colabRes] = await Promise.all([
        supabase.from("condominios").select("id", { count: "exact", head: true }),
        supabase
          .from("perfis_usuario")
          .select("id", { count: "exact", head: true })
          .eq("role", "SINDICO")
          .eq("ativo", true),
        supabase
          .from("perfis_usuario")
          .select("id", { count: "exact", head: true })
          .eq("role", "MORADOR")
          .eq("ativo", true),
        supabase
          .from("perfis_usuario")
          .select("id", { count: "exact", head: true })
          .eq("role", "PORTEIRO")
          .eq("ativo", true),
        supabase
          .from("backoffice_colaboradores")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true),
      ]);

      setMetrics({
        condominios: condRes.count ?? 0,
        sindicos: sindRes.count ?? 0,
        moradores: morRes.count ?? 0,
        porteiros: portRes.count ?? 0,
        colaboradores: colabRes.count ?? 0,
      });

      setLoading(false);
    }
    void load();
  }, []);

  // SSR e hydration inicial renderizam o skeleton — sem mismatch possível
  if (!mounted) return <PageSkeleton />;

  const ROLE_METRICS: Record<BackofficeRole, Metric[]> = {
    ADMIN: [
      { label: "Condomínios ativos", value: metrics?.condominios ?? "..." },
      { label: "Síndicos", value: metrics?.sindicos ?? "..." },
      { label: "Moradores", value: metrics?.moradores ?? "..." },
      { label: "Equipe interna", value: metrics?.colaboradores ?? "..." },
      { label: "MRR", value: "—", soon: true },
      { label: "Churn mensal", value: "—", soon: true },
      { label: "Leads no funil", value: "—", soon: true },
      { label: "Contratos ativos", value: "—", soon: true },
    ],
    IMPLEMENTACAO: [
      { label: "Condomínios ativos", value: metrics?.condominios ?? "..." },
      { label: "Síndicos cadastrados", value: metrics?.sindicos ?? "..." },
      { label: "Porteiros cadastrados", value: metrics?.porteiros ?? "..." },
      { label: "Em implementação", value: "—", soon: true },
    ],
    COMERCIAL: [
      { label: "Leads ativos", value: "—", soon: true },
      { label: "Demos agendadas", value: "—", soon: true },
      { label: "Taxa de conversão", value: "—", soon: true },
      { label: "Receita no mês", value: "—", soon: true },
    ],
    FINANCEIRO: [
      { label: "MRR", value: "—", soon: true },
      { label: "ARR", value: "—", soon: true },
      { label: "Clientes ativos", value: metrics?.condominios ?? "..." },
      { label: "Inadimplentes", value: "—", soon: true },
    ],
    JURIDICO: [
      { label: "Contratos ativos", value: "—", soon: true },
      { label: "Vencendo em 30 dias", value: "—", soon: true },
      { label: "Solicitações LGPD", value: "—", soon: true },
      { label: "Pendentes de assinatura", value: "—", soon: true },
    ],
    DEV: [
      { label: "Condomínios na plataforma", value: metrics?.condominios ?? "..." },
      {
        label: "Usuários ativos",
        value: metrics
          ? metrics.sindicos + metrics.moradores + metrics.porteiros
          : "...",
        sub: "síndicos + moradores + porteiros",
      },
      { label: "Uptime", value: "—", soon: true },
      { label: "Erros hoje", value: "—", soon: true },
    ],
  };

  const ROLE_SOON: Record<BackofficeRole, string[]> = {
    ADMIN: ["Pipeline comercial", "Histórico de atividades"],
    IMPLEMENTACAO: ["Kanban de onboarding", "Checklist por cliente"],
    COMERCIAL: ["Funil de vendas", "Follow-ups atrasados"],
    FINANCEIRO: ["Projeção de receita", "Inadimplência detalhada"],
    JURIDICO: ["Repositório de contratos", "Solicitações LGPD"],
    DEV: ["Log de erros", "Feature flags"],
  };

  return (
    <div className="px-6 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Backoffice Condofy
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {greeting}{nome ? `, ${nome.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{dateStr}</p>
      </div>

      {/* Métricas */}
      {role && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            {ROLE_METRICS[role].map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>

          {/* Painéis em breve */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROLE_SOON[role].map((label) => (
              <SoonBadge key={label} label={label} />
            ))}
          </div>
        </>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse"
            >
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-3 h-7 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
