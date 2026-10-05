"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type StatusImpl = "AGUARDANDO" | "CONFIGURANDO" | "TREINAMENTO" | "ATIVO" | "CANCELADO";

type Cliente = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  plano: string;
  status: StatusImpl;
  responsavel: string;
  sindico: { nome: string; email: string } | null;
  criado_em: string;
  condominio_id: string;
};

const STATUS_CONFIG: Record<StatusImpl, { label: string; className: string }> = {
  AGUARDANDO:   { label: "Aguardando",   className: "bg-slate-100 text-slate-600" },
  CONFIGURANDO: { label: "Configurando", className: "bg-blue-100 text-blue-700" },
  TREINAMENTO:  { label: "Treinamento",  className: "bg-amber-100 text-amber-700" },
  ATIVO:        { label: "Ativo",        className: "bg-emerald-100 text-emerald-700" },
  CANCELADO:    { label: "Cancelado",    className: "bg-rose-100 text-rose-700" },
};

const PLANO_LABEL: Record<string, string> = {
  ESSENCIAL:   "Essencial",
  CRESCIMENTO: "Crescimento",
  PRO:         "Pro",
};

export default function CondomíniosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setErro("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErro("Sessão expirada."); return; }

      const res = await fetch("/api/condominios", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Erro ao carregar."); return; }

      setClientes(json.data ?? []);
    } catch (err) {
      console.error("[condominios] load error", err);
      setErro("Erro ao carregar condomínios.");
    } finally {
      setLoading(false);
    }
  }

  const filtrados = clientes.filter((c) => {
    const matchBusca = !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.sindico?.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.cidade.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "TODOS" || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const counts = clientes.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Implementação</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Condomínios</h1>
          <p className="mt-1 text-sm text-slate-500">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} cadastrado{clientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/dashboard/condominios/novo"
          className="shrink-0 rounded-lg bg-[#1A3A5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15314d]"
        >
          + Novo condomínio
        </Link>
      </div>

      {/* Resumo de status */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["AGUARDANDO", "CONFIGURANDO", "TREINAMENTO", "ATIVO", "CANCELADO"] as StatusImpl[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFiltroStatus(filtroStatus === s ? "TODOS" : s)}
              className={`rounded-xl border p-3 text-left transition ${
                filtroStatus === s ? "border-[#1A3A5C] ring-1 ring-[#1A3A5C]" : "border-slate-200 hover:border-slate-300"
              } bg-white shadow-sm`}
            >
              <p className="text-lg font-bold text-slate-900">{counts[s] ?? 0}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`}>
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Buscar por nome, síndico ou cidade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#1A3A5C] focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
        />
      </div>

      {/* Erro */}
      {erro && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-400">Nenhum condomínio encontrado</p>
          {clientes.length === 0 && (
            <Link href="/dashboard/condominios/novo" className="mt-3 inline-block text-sm font-semibold text-[#1A3A5C] hover:underline">
              Criar o primeiro
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Condomínio</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Síndico</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Plano</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Responsável</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((c) => {
                const status = STATUS_CONFIG[c.status];
                return (
                  <tr key={c.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">{c.nome}</p>
                      {c.cidade && (
                        <p className="text-xs text-slate-400">{c.cidade}{c.estado ? `, ${c.estado}` : ""}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {c.sindico ? (
                        <>
                          <p className="text-sm text-slate-700">{c.sindico.nome}</p>
                          <p className="text-xs text-slate-400">{c.sindico.email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Não definido</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-slate-700">{PLANO_LABEL[c.plano] ?? c.plano}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{c.responsavel || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
