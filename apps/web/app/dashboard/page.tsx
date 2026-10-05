"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import SetupChecklist from "./setup-checklist";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type CondominiumRow = {
  nome: string | null;
  tipo: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  total_unidades: number | null;
};

type UnidadeStatus = "OCUPADA" | "VAZIA";

type ReservaStatus = "PENDENTE" | "APROVADO" | "REJEITADO" | "CANCELADO";

type ReservaRow = {
  data_reserva: string;
  horario_inicio: string;
  horario_fim: string;
  salao: {
    nome: string;
  } | null;
};

type ManutencaoRow = {
  titulo: string;
  prevista_em: string;
};

type DashboardMetrics = {
  unidadesTotal: number;
  unidadesOcupadas: number;
  unidadesVazias: number;
  moradoresAtivos: number;
  porteirosAtivos: number;
  entregasPendentes: number;
  cobrancasAtraso: number;
  proximaReserva: ReservaRow | null;
  ocorrenciasAbertas: number;
  veiculosCadastrados: number;
  proximaManutencao: ManutencaoRow | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(new Date(value));
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    unidadesTotal: 0,
    unidadesOcupadas: 0,
    unidadesVazias: 0,
    moradoresAtivos: 0,
    porteirosAtivos: 0,
    entregasPendentes: 0,
    cobrancasAtraso: 0,
    proximaReserva: null,
    ocorrenciasAbertas: 0,
    veiculosCadastrados: 0,
    proximaManutencao: null
  });
  const [condominioConfigured, setCondominioConfigured] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        router.replace("/login");
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
        router.replace("/onboarding");
        return;
      }

      setRole(profile.role);

      if (profile.role === "PORTEIRO") {
        router.replace("/dashboard/porteiro");
        return;
      }

      if (profile.role === "MORADOR") {
        router.replace("/dashboard/morador");
        return;
      }

      const todayIso = new Date().toISOString().split("T")[0];

      const [
        condoResponse,
        unitsResponse,
        residentsResponse,
        porteirosResponse,
        deliveriesResponse,
        chargesResponse,
        reservationResponse,
        ocorrenciasResponse,
        veiculosResponse,
        manutencaoResponse
      ] = await Promise.all([
        supabase
          .from("condominios")
          .select("nome, tipo, endereco, cidade, estado, cep, total_unidades")
          .eq("id", profile.condominio_id)
          .maybeSingle<CondominiumRow>(),
        supabase
          .from("unidades")
          .select("status")
          .eq("condominio_id", profile.condominio_id),
        supabase
          .from("perfis_usuario")
          .select("id", { count: "exact", head: true })
          .eq("condominio_id", profile.condominio_id)
          .eq("role", "MORADOR")
          .eq("ativo", true),
        supabase
          .from("perfis_usuario")
          .select("id", { count: "exact", head: true })
          .eq("condominio_id", profile.condominio_id)
          .eq("role", "PORTEIRO")
          .eq("ativo", true),
        supabase
          .from("entregas")
          .select("id", { count: "exact", head: true })
          .eq("condominio_id", profile.condominio_id)
          .eq("status", "AGUARDANDO"),
        supabase
          .from("cobrancas")
          .select("id", { count: "exact", head: true })
          .eq("condominio_id", profile.condominio_id)
          .eq("status", "ATRASADO"),
        supabase
          .from("reservas_salao")
          .select("data_reserva, horario_inicio, horario_fim, salao:saloes(nome)")
          .eq("condominio_id", profile.condominio_id)
          .eq("status", "APROVADO")
          .gte("data_reserva", todayIso)
          .order("data_reserva", { ascending: true })
          .order("horario_inicio", { ascending: true })
          .limit(1)
          .maybeSingle<ReservaRow>(),
        supabase
          .from("ocorrencias")
          .select("id", { count: "exact", head: true })
          .eq("condominio_id", profile.condominio_id)
          .eq("status", "ABERTA"),
        supabase
          .from("veiculos")
          .select("id", { count: "exact", head: true })
          .eq("condominio_id", profile.condominio_id)
          .eq("ativo", true),
        supabase
          .from("manutencoes")
          .select("titulo, prevista_em")
          .eq("condominio_id", profile.condominio_id)
          .eq("concluida", false)
          .gte("prevista_em", todayIso)
          .order("prevista_em", { ascending: true })
          .limit(1)
          .maybeSingle<ManutencaoRow>()
      ]);

      if (condoResponse.error) {
        setError(condoResponse.error.message);
        setLoading(false);
        return;
      }

      if (unitsResponse.error) {
        setError(unitsResponse.error.message);
        setLoading(false);
        return;
      }

      if (residentsResponse.error) {
        setError(residentsResponse.error.message);
        setLoading(false);
        return;
      }

      if (deliveriesResponse.error) {
        setError(deliveriesResponse.error.message);
        setLoading(false);
        return;
      }

      if (chargesResponse.error) {
        setError(chargesResponse.error.message);
        setLoading(false);
        return;
      }

      if (reservationResponse.error) {
        setError(reservationResponse.error.message);
        setLoading(false);
        return;
      }

      const unitRows = (unitsResponse.data ?? []) as Array<{ status: UnidadeStatus }>;
      const unidadesOcupadas = unitRows.filter((unit) => unit.status === "OCUPADA").length;
      const unidadesVazias = unitRows.filter((unit) => unit.status === "VAZIA").length;

      setMetrics({
        unidadesTotal: unitRows.length,
        unidadesOcupadas,
        unidadesVazias,
        moradoresAtivos: residentsResponse.count ?? 0,
        porteirosAtivos: porteirosResponse.count ?? 0,
        entregasPendentes: deliveriesResponse.count ?? 0,
        cobrancasAtraso: chargesResponse.count ?? 0,
        proximaReserva: reservationResponse.data ?? null,
        ocorrenciasAbertas: ocorrenciasResponse.count ?? 0,
        veiculosCadastrados: veiculosResponse.count ?? 0,
        proximaManutencao: manutencaoResponse.data ?? null
      });

      const condo = condoResponse.data;
      setCondominioConfigured(
        Boolean(
          condo?.nome &&
            condo?.tipo &&
            condo?.endereco &&
            condo?.cidade &&
            condo?.estado &&
            condo?.cep &&
            (condo?.total_unidades ?? 0) > 0
        )
      );

      setLoading(false);
    }

    void loadDashboard();
  }, [router]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Unidades",
        value: metrics.unidadesTotal,
        detail: `${metrics.unidadesOcupadas} ocupadas • ${metrics.unidadesVazias} vagas`
      },
      {
        label: "Moradores",
        value: metrics.moradoresAtivos,
        detail: "ativos no condomínio"
      },
      {
        label: "Porteiros",
        value: metrics.porteirosAtivos,
        detail: "ativos no condomínio"
      },
      {
        label: "Entregas pendentes",
        value: metrics.entregasPendentes,
        detail: "aguardando retirada"
      },
      {
        label: "Cobranças em atraso",
        value: metrics.cobrancasAtraso,
        detail: "com status ATRASADO"
      },
      {
        label: "Ocorrências abertas",
        value: metrics.ocorrenciasAbertas,
        detail: "aguardando resolução"
      },
      {
        label: "Veículos cadastrados",
        value: metrics.veiculosCadastrados,
        detail: "ativos no condomínio"
      },
      {
        label: "Próxima reserva do salão",
        value: metrics.proximaReserva ? formatDate(metrics.proximaReserva.data_reserva) : "—",
        detail: metrics.proximaReserva
          ? `${metrics.proximaReserva.horario_inicio} - ${metrics.proximaReserva.horario_fim}${metrics.proximaReserva.salao?.nome ? ` • ${metrics.proximaReserva.salao.nome}` : ""}`
          : "Nenhuma reserva confirmada futura"
      },
      {
        label: "Próxima manutenção",
        value: metrics.proximaManutencao ? formatDate(metrics.proximaManutencao.prevista_em) : "—",
        detail: metrics.proximaManutencao ? metrics.proximaManutencao.titulo : "Nenhuma manutenção agendada"
      }
    ],
    [metrics]
  );

  const setupIncomplete =
    !condominioConfigured || metrics.porteirosAtivos === 0 || metrics.moradoresAtivos === 0;

  const showWelcomeBanner =
    setupIncomplete && metrics.unidadesTotal === 0 && metrics.porteirosAtivos === 0 && metrics.moradoresAtivos === 0;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {showWelcomeBanner ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-medium text-emerald-900 shadow-sm">
            👋 Bem-vindo ao Condofy! Comece configurando seu condomínio — leva menos de 2 minutos.
          </div>
        ) : null}

        <SetupChecklist
          condominioConfigured={condominioConfigured}
          hasPorteiro={metrics.porteirosAtivos > 0}
          hasMorador={metrics.moradoresAtivos > 0}
        />

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Visão geral do condomínio</h1>
              <p className="mt-2 text-sm text-slate-600">
                {role ? `Perfil: ${role}` : "Carregando perfil..."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d]"
            >
              Sair
            </button>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => (
              <article key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                  {loading ? "..." : card.value}
                </p>
                <p className="mt-2 text-sm text-slate-600">{loading ? "Carregando métricas..." : card.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
