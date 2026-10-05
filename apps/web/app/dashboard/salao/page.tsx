"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type SalaoRow = {
  id: string;
  nome: string;
  capacidade: number;
  descricao: string | null;
  taxa_reserva: number | null;
  ativo: boolean;
};

export default function SalaoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [saloes, setSaloes] = useState<SalaoRow[]>([]);

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
        .select("condominio_id, role")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<ProfileRow>();

      if (profileError || !profile?.condominio_id || !profile?.role) {
        setError("Nenhum condomínio ativo encontrado para este usuário.");
        setLoading(false);
        return;
      }

      setCondominioId(profile.condominio_id);
      setRole(profile.role);

      const { data: saloesData, error: saloesError } = await supabase
        .from("saloes")
        .select("id, nome, capacidade, descricao, taxa_reserva, ativo")
        .eq("condominio_id", profile.condominio_id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (saloesError) {
        setError(saloesError.message);
        setLoading(false);
        return;
      }

      setSaloes((saloesData ?? []) as SalaoRow[]);
      setLoading(false);
    }

    void loadPage();
  }, []);

  const canManage = role === "SINDICO";

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Carregando salões...
        </div>
      );
    }

    if (!saloes.length) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          Nenhum salão ativo encontrado.
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {saloes.map((salao) => (
          <article key={salao.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{salao.nome}</h2>
                <p className="mt-2 text-sm text-slate-600">Capacidade: {salao.capacidade} pessoas</p>
                <p className="mt-1 text-sm text-slate-600">
                  Taxa: {salao.taxa_reserva != null ? `R$ ${Number(salao.taxa_reserva).toFixed(2)}` : "Sem taxa"}
                </p>
              </div>
              <span className="rounded-full bg-[#1A3A5C]/10 px-3 py-1 text-xs font-semibold text-[#1A3A5C]">
                Ativo
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700">
              {salao.descricao ?? "Sem descrição informada."}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/dashboard/salao/${salao.id}/reservar`}
                className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
              >
                Reservar
              </Link>
            </div>
          </article>
        ))}
      </div>
    );
  }, [loading, saloes]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Salão</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Salões de festa
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Reserve um salão para eventos do condomínio.
              </p>
            </div>

            {canManage ? (
              <Link
                href="/dashboard/salao/gerenciar"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Gerenciar salões
              </Link>
            ) : null}
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6">{content}</div>
        </div>
      </div>
    </main>
  );
}
