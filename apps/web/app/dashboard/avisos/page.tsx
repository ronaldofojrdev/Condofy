"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type AvisoCategoria = "GERAL" | "MANUTENCAO" | "SEGURANCA" | "FINANCEIRO" | "EVENTO";

type AvisoRow = {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: AvisoCategoria;
  fixado: boolean;
  criado_em: string;
  autor_nome: string | null;
  unidade_id: string | null;
  unidade_numero: string | null;
};

const CATEGORIA_STYLES: Record<AvisoCategoria, string> = {
  GERAL: "bg-blue-100 text-blue-800",
  MANUTENCAO: "bg-orange-100 text-orange-800",
  SEGURANCA: "bg-red-100 text-red-800",
  FINANCEIRO: "bg-emerald-100 text-emerald-800",
  EVENTO: "bg-violet-100 text-violet-800"
};

const CATEGORIA_LABEL: Record<AvisoCategoria, string> = {
  GERAL: "Geral",
  MANUTENCAO: "Manutenção",
  SEGURANCA: "Segurança",
  FINANCEIRO: "Financeiro",
  EVENTO: "Evento"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function AvisosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [avisos, setAvisos] = useState<AvisoRow[]>([]);

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

      const accessToken = sessionData.session.access_token;

      if (!accessToken) {
        setError("Não foi possível autenticar a sessão do usuário.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/avisos", {
          headers: { authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? "Não foi possível carregar os avisos.");
        } else {
          const avisosData = (await response.json()) as AvisoRow[];
          setAvisos(avisosData);
        }
      } catch {
        setError("Não foi possível carregar os avisos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    void loadPage();
  }, []);

  const canCreateAviso = role === "SINDICO";

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Carregando avisos...
        </div>
      );
    }

    if (!avisos.length) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          Nenhum aviso encontrado.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {avisos.map((aviso) => {
          const categoriaStyle = CATEGORIA_STYLES[aviso.categoria];

          return (
            <article
              key={aviso.id}
              className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ${
                aviso.fixado ? "border-2 border-[#1A3A5C] ring-[#1A3A5C]/20" : "border border-slate-200 ring-slate-200"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {aviso.fixado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        📌 Fixado
                      </span>
                    ) : null}
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoriaStyle}`}>
                      {CATEGORIA_LABEL[aviso.categoria] ?? aviso.categoria}
                    </span>
                    {aviso.unidade_numero ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1A3A5C]/10 px-3 py-1 text-xs font-semibold text-[#1A3A5C]">
                        📍 Unidade {aviso.unidade_numero}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
                    {aviso.titulo}
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {aviso.conteudo}
                  </p>
                </div>

                <div className="shrink-0 text-sm text-slate-500 sm:text-right">
                  <p className="font-medium text-slate-700">{formatDate(aviso.criado_em)}</p>
                  <p className="mt-1">{aviso.autor_nome ?? "Autor não informado"}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }, [avisos, loading]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">
                Avisos
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Mural do condomínio
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Comunicados para moradores, porteiros e síndico.
              </p>
            </div>

            {canCreateAviso ? (
              <Link
                href="/dashboard/avisos/novo"
                className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
              >
                Novo aviso
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
