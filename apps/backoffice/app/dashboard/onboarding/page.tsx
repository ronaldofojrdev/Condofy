"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type StatusImpl = "AGUARDANDO" | "CONFIGURANDO" | "TREINAMENTO" | "ATIVO" | "CANCELADO";

type Cliente = {
  id: string;
  nome: string;
  cidade: string;
  plano: string;
  status: StatusImpl;
  responsavel: string;
  sindico: { nome: string; email: string } | null;
  criado_em: string;
};

const COLUNAS: { key: StatusImpl; label: string; cor: string; corCard: string }[] = [
  { key: "AGUARDANDO",   label: "Aguardando",   cor: "bg-slate-100 text-slate-600",  corCard: "border-l-slate-300" },
  { key: "CONFIGURANDO", label: "Configurando", cor: "bg-blue-100 text-blue-700",    corCard: "border-l-blue-400" },
  { key: "TREINAMENTO",  label: "Treinamento",  cor: "bg-amber-100 text-amber-700",  corCard: "border-l-amber-400" },
  { key: "ATIVO",        label: "Ativo",        cor: "bg-emerald-100 text-emerald-700", corCard: "border-l-emerald-400" },
];

const PROXIMO: Record<StatusImpl, StatusImpl | null> = {
  AGUARDANDO:   "CONFIGURANDO",
  CONFIGURANDO: "TREINAMENTO",
  TREINAMENTO:  "ATIVO",
  ATIVO:        null,
  CANCELADO:    null,
};

const PLANO_LABEL: Record<string, string> = {
  ESSENCIAL: "Essencial", CRESCIMENTO: "Crescimento", PRO: "Pro",
};

export default function OnboardingPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [avancando, setAvancando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { return; }

      const res = await fetch("/api/condominios", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setErro("Erro ao carregar condomínios."); return; }
      const json = await res.json();
      const todos = (json.data ?? []) as Cliente[];
      // Filtra cancelados para o kanban
      setClientes(todos.filter((c) => c.status !== "CANCELADO"));
    } catch (err) {
      console.error("[onboarding] load error", err);
      setErro("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  async function avancarStatus(cliente: Cliente) {
    const proximo = PROXIMO[cliente.status];
    if (!proximo) return;

    setAvancando(cliente.id);
    setErro("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAvancando(null); return; }

    const res = await fetch(`/api/condominios/${cliente.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status_implementacao: proximo }),
    });

    setAvancando(null);

    if (!res.ok) {
      const json = await res.json();
      setErro(json.error ?? "Erro ao atualizar status.");
      return;
    }

    // Atualiza localmente sem refetch
    setClientes((prev) =>
      prev.map((c) => c.id === cliente.id ? { ...c, status: proximo } : c)
    );
  }

  const total = clientes.length;
  const ativos = clientes.filter((c) => c.status === "ATIVO").length;

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Implementação</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Kanban de Onboarding</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ativos} de {total} condomínio{total !== 1 ? "s" : ""} ativo{ativos !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/dashboard/condominios/novo"
          className="shrink-0 rounded-lg bg-[#1A3A5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15314d]"
        >
          + Novo condomínio
        </Link>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {COLUNAS.map((col) => (
            <div key={col.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="h-4 w-24 rounded bg-slate-200 animate-pulse mb-4" />
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-slate-200 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((col) => {
            const items = clientes.filter((c) => c.status === col.key);
            return (
              <div key={col.key} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                {/* Coluna header */}
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${col.cor}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{items.length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2.5">
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center">
                      <p className="text-xs text-slate-400">Nenhum</p>
                    </div>
                  )}
                  {items.map((c) => {
                    const proximo = PROXIMO[c.status];
                    const isAvancando = avancando === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`rounded-lg border border-slate-200 border-l-4 bg-white p-3.5 shadow-sm ${col.corCard}`}
                      >
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{c.nome}</p>
                        {c.cidade && (
                          <p className="text-xs text-slate-400 mt-0.5">{c.cidade}</p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            {PLANO_LABEL[c.plano] ?? c.plano}
                          </span>
                          {c.responsavel && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              {c.responsavel.split(" ")[0]}
                            </span>
                          )}
                        </div>

                        {c.sindico && (
                          <p className="mt-2 text-xs text-slate-500">
                            Síndico: <span className="font-medium">{c.sindico.nome}</span>
                          </p>
                        )}

                        <p className="mt-1 text-[10px] text-slate-400">
                          {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                        </p>

                        {proximo && (
                          <button
                            type="button"
                            onClick={() => avancarStatus(c)}
                            disabled={isAvancando}
                            className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                          >
                            {isAvancando ? "Salvando..." : `Mover para ${COLUNAS.find((col) => col.key === proximo)?.label}`}
                          </button>
                        )}

                        {col.key === "ATIVO" && (
                          <div className="mt-3 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-semibold text-emerald-600">Online</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
