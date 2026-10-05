"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  unidade_id: string | null;
  role: DashboardRole;
};

type CobrancaStatus = "PENDENTE" | "PAGO" | "ATRASADO";

type CobrancaRow = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
};

type EntregaRow = {
  id: string;
  remetente: string | null;
  criado_em: string;
};

type ReservaRow = {
  id: string;
  data_reserva: string;
  horario_inicio: string;
  horario_fim: string;
  status: string;
  salao: { nome: string } | null;
};

type AvisoRow = {
  id: string;
  titulo: string;
  categoria: string;
  criado_em: string;
};

type OcorrenciaRow = {
  id: string;
  status: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(year, month - 1, day));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const CATEGORIA_ICONS: Record<string, string> = {
  GERAL: "📢",
  MANUTENCAO: "🔧",
  SEGURANCA: "🔒",
  FINANCEIRO: "💰",
  EVENTO: "🎉"
};

export default function MoradorDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [unidadeNumero, setUnidadeNumero] = useState<string | null>(null);

  const [cobrancasPendentes, setCobrancasPendentes] = useState<CobrancaRow[]>([]);
  const [entregasPendentes, setEntregasPendentes] = useState<EntregaRow[]>([]);
  const [proximaReserva, setProximaReserva] = useState<ReservaRow | null>(null);
  const [ultimosAvisos, setUltimosAvisos] = useState<AvisoRow[]>([]);
  const [ocorrenciasAbertas, setOcorrenciasAbertas] = useState<OcorrenciaRow[]>([]);

  useEffect(() => {
    async function loadPage() {
      setLoading(true);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      const userId = sessionData.session.user.id;

      // Get user name from metadata or usuarios table
      const userName =
        sessionData.session.user.user_metadata?.full_name ??
        sessionData.session.user.user_metadata?.name ??
        sessionData.session.user.email ??
        "Morador";

      const { data: profile, error: profileError } = await supabase
        .from("perfis_usuario")
        .select("condominio_id, unidade_id, role")
        .eq("usuario_id", userId)
        .eq("ativo", true)
        .limit(1)
        .single<ProfileRow>();

      if (profileError || !profile?.condominio_id || !profile.role) {
        router.replace("/dashboard/avisos");
        return;
      }

      if (profile.role !== "MORADOR") {
        router.replace("/dashboard");
        return;
      }

      // Get user name from usuarios table
      const { data: usuarioRow } = await supabase
        .from("usuarios")
        .select("nome")
        .eq("id", userId)
        .single<{ nome: string }>();

      setNomeUsuario(usuarioRow?.nome ?? userName);

      const { condominio_id: condominioId, unidade_id: unidadeId } = profile;

      // Unidade number
      if (unidadeId) {
        const { data: unidadeRow } = await supabase
          .from("unidades")
          .select("numero")
          .eq("id", unidadeId)
          .single<{ numero: string }>();
        setUnidadeNumero(unidadeRow?.numero ?? null);
      }

      const today = new Date().toISOString().split("T")[0];

      // Run all queries in parallel
      const [
        cobrancasResult,
        entregasResult,
        reservasResult,
        avisosResult,
        ocorrenciasResult
      ] = await Promise.all([
        // Cobranças pendentes/atrasadas da unidade
        unidadeId
          ? supabase
              .from("cobrancas")
              .select("id, descricao, valor, vencimento, status")
              .eq("condominio_id", condominioId)
              .eq("unidade_id", unidadeId)
              .in("status", ["PENDENTE", "ATRASADO"])
              .order("vencimento", { ascending: true })
          : Promise.resolve({ data: [], error: null }),

        // Entregas pendentes (não retiradas)
        unidadeId
          ? supabase
              .from("entregas")
              .select("id, remetente, criado_em")
              .eq("condominio_id", condominioId)
              .eq("unidade_id", unidadeId)
              .eq("status", "PENDENTE")
              .order("criado_em", { ascending: false })
          : Promise.resolve({ data: [], error: null }),

        // Próxima reserva futura (PENDENTE ou APROVADO)
        supabase
          .from("reservas_salao")
          .select("id, data_reserva, horario_inicio, horario_fim, status, salao:saloes(nome)")
          .eq("condominio_id", condominioId)
          .eq("solicitante_id", userId)
          .in("status", ["PENDENTE", "APROVADO"])
          .gte("data_reserva", today)
          .order("data_reserva", { ascending: true })
          .limit(1),

        // Últimos 3 avisos (globais + da unidade)
        unidadeId
          ? supabase
              .from("avisos")
              .select("id, titulo, categoria, criado_em")
              .eq("condominio_id", condominioId)
              .or(`unidade_id.is.null,unidade_id.eq.${unidadeId}`)
              .order("criado_em", { ascending: false })
              .limit(3)
          : supabase
              .from("avisos")
              .select("id, titulo, categoria, criado_em")
              .eq("condominio_id", condominioId)
              .is("unidade_id", null)
              .order("criado_em", { ascending: false })
              .limit(3),

        // Ocorrências abertas/em andamento do morador
        supabase
          .from("ocorrencias")
          .select("id, status")
          .eq("condominio_id", condominioId)
          .eq("morador_id", userId)
          .in("status", ["ABERTA", "EM_ANDAMENTO"])
      ]);

      setCobrancasPendentes((cobrancasResult.data ?? []) as CobrancaRow[]);
      setEntregasPendentes((entregasResult.data ?? []) as EntregaRow[]);

      const reservaRaw = (reservasResult.data ?? [])[0] as any;
      if (reservaRaw) {
        const salao = Array.isArray(reservaRaw.salao) ? reservaRaw.salao[0] ?? null : reservaRaw.salao;
        setProximaReserva({
          id: reservaRaw.id,
          data_reserva: reservaRaw.data_reserva,
          horario_inicio: reservaRaw.horario_inicio,
          horario_fim: reservaRaw.horario_fim,
          status: reservaRaw.status,
          salao: salao
        });
      }

      setUltimosAvisos((avisosResult.data ?? []) as AvisoRow[]);
      setOcorrenciasAbertas((ocorrenciasResult.data ?? []) as OcorrenciaRow[]);
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  const totalEmAberto = cobrancasPendentes.reduce((acc, c) => acc + Number(c.valor), 0);
  const temAtrasado = cobrancasPendentes.some((c) => c.status === "ATRASADO");

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 text-center text-sm text-slate-500">
            Carregando seu painel...
          </div>
        </div>
      </main>
    );
  }

  const primeiroNome = nomeUsuario.split(" ")[0];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Painel</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Olá, {primeiroNome}! 👋
          </h1>
          {unidadeNumero ? (
            <p className="mt-2 text-sm text-slate-500">Unidade {unidadeNumero}</p>
          ) : null}
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Entregas */}
          <Link
            href="/dashboard/minhas-entregas"
            className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#1A3A5C]/30"
          >
            <p className="text-2xl">📦</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{entregasPendentes.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              {entregasPendentes.length === 1 ? "entrega aguardando" : "entregas aguardando"}
            </p>
            {entregasPendentes.length > 0 && (
              <p className="mt-2 text-xs text-[#1A3A5C] group-hover:underline">Ver entregas →</p>
            )}
          </Link>

          {/* Cobranças */}
          <Link
            href="/dashboard/financeiro/meu-extrato"
            className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#1A3A5C]/30"
          >
            <p className="text-2xl">💰</p>
            <p className={`mt-3 text-2xl font-semibold ${temAtrasado ? "text-rose-600" : cobrancasPendentes.length > 0 ? "text-amber-600" : "text-slate-900"}`}>
              {cobrancasPendentes.length > 0 ? formatCurrency(totalEmAberto) : "Em dia"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {cobrancasPendentes.length === 0
                ? "nenhuma cobrança pendente"
                : temAtrasado
                ? `${cobrancasPendentes.length} cobrança(s) — há atrasos!`
                : `${cobrancasPendentes.length} cobrança(s) pendente(s)`}
            </p>
            {cobrancasPendentes.length > 0 && (
              <p className="mt-2 text-xs text-[#1A3A5C] group-hover:underline">Ver extrato →</p>
            )}
          </Link>

          {/* Próxima reserva */}
          <Link
            href="/dashboard/salao/minhas-reservas"
            className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#1A3A5C]/30"
          >
            <p className="text-2xl">🎉</p>
            {proximaReserva ? (
              <>
                <p className="mt-3 text-lg font-semibold text-slate-900">
                  {proximaReserva.salao?.nome ?? "Salão"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDate(proximaReserva.data_reserva)} • {proximaReserva.horario_inicio}–{proximaReserva.horario_fim}
                </p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  proximaReserva.status === "APROVADO"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {proximaReserva.status === "APROVADO" ? "Aprovada" : "Pendente"}
                </span>
              </>
            ) : (
              <>
                <p className="mt-3 text-lg font-semibold text-slate-900">Sem reservas</p>
                <p className="mt-1 text-sm text-slate-500">nenhuma reserva futura</p>
                <p className="mt-2 text-xs text-[#1A3A5C] group-hover:underline">Reservar salão →</p>
              </>
            )}
          </Link>

          {/* Ocorrências abertas */}
          <Link
            href="/dashboard/minhas-ocorrencias"
            className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#1A3A5C]/30"
          >
            <p className="text-2xl">📋</p>
            <p className={`mt-3 text-2xl font-semibold ${ocorrenciasAbertas.length > 0 ? "text-amber-600" : "text-slate-900"}`}>
              {ocorrenciasAbertas.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {ocorrenciasAbertas.length === 1 ? "ocorrência aberta" : "ocorrências abertas"}
            </p>
            {ocorrenciasAbertas.length > 0 && (
              <p className="mt-2 text-xs text-[#1A3A5C] group-hover:underline">Ver ocorrências →</p>
            )}
          </Link>

        </div>

        {/* Cobranças em atraso — alerta */}
        {temAtrasado && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5">
            <p className="font-semibold text-rose-700">⚠️ Você tem cobranças em atraso</p>
            <div className="mt-3 space-y-2">
              {cobrancasPendentes
                .filter((c) => c.status === "ATRASADO")
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-rose-700">{c.descricao}</span>
                    <span className="font-medium text-rose-700">
                      {formatCurrency(c.valor)} · venc. {formatDate(c.vencimento)}
                    </span>
                  </div>
                ))}
            </div>
            <Link
              href="/dashboard/financeiro/meu-extrato"
              className="mt-4 inline-flex items-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              Ver extrato completo
            </Link>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Últimas entregas */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Entregas aguardando</h2>
              <Link href="/dashboard/minhas-entregas" className="text-xs text-[#1A3A5C] hover:underline">
                Ver todas →
              </Link>
            </div>
            <div className="mt-4">
              {entregasPendentes.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma entrega pendente.</p>
              ) : (
                <div className="space-y-3">
                  {entregasPendentes.slice(0, 3).map((e) => (
                    <div key={e.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                      <span className="text-lg">📦</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{e.remetente ?? "Remetente não informado"}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(e.criado_em)}</p>
                      </div>
                    </div>
                  ))}
                  {entregasPendentes.length > 3 && (
                    <p className="text-xs text-slate-400">+{entregasPendentes.length - 3} mais entregas</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Últimos avisos */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Últimos avisos</h2>
              <Link href="/dashboard/avisos" className="text-xs text-[#1A3A5C] hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="mt-4">
              {ultimosAvisos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum aviso recente.</p>
              ) : (
                <div className="space-y-3">
                  {ultimosAvisos.map((a) => (
                    <Link
                      key={a.id}
                      href="/dashboard/avisos"
                      className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3 transition hover:bg-slate-50"
                    >
                      <span className="text-lg">{CATEGORIA_ICONS[a.categoria] ?? "📢"}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{a.titulo}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(a.criado_em)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Ações rápidas */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Ações rápidas</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/salao"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              🎉 Reservar salão
            </Link>
            <Link
              href="/dashboard/minhas-ocorrencias"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              📋 Registrar ocorrência
            </Link>
            <Link
              href="/dashboard/meus-veiculos"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              🚗 Meus veículos
            </Link>
            <Link
              href="/dashboard/minhas-visitas"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              👥 Autorizar visita
            </Link>
            <Link
              href="/dashboard/enquetes"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              🗳️ Enquetes
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
