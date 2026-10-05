"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface AuditEntry {
  id: string;
  acao: string;
  recurso: string;
  recurso_id: string | null;
  detalhes: Record<string, any> | null;
  criado_em: string;
  colaborador: { nome: string; role: string } | null;
}

function formatData(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const RECURSO_COLORS: Record<string, string> = {
  condominio: "bg-blue-100 text-blue-700",
  colaborador: "bg-red-100 text-red-700",
  lead: "bg-violet-100 text-violet-700",
  pagamento: "bg-emerald-100 text-emerald-700",
  contrato: "bg-amber-100 text-amber-700",
  feature_flag: "bg-teal-100 text-teal-700",
};

export default function AuditoriaPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchAuditoria = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const res = await fetch("/api/auditoria?limit=200", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) { const j = await res.json(); setEntries(j.data ?? []); }
    } catch (err) {
      console.error("[auditoria] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Log de Auditoria</h1>
          <p className="text-sm text-gray-500 mt-0.5">{entries.length} eventos recentes</p>
        </div>
        <button onClick={fetchAuditoria}
          className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum evento registrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Data/hora</th>
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-4 py-3">Ação</th>
                <th className="text-left px-4 py-3">Recurso</th>
                <th className="text-left px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <React.Fragment key={e.id}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatData(e.criado_em)}</td>
                    <td className="px-4 py-3">
                      {e.colaborador ? (
                        <div>
                          <p className="font-medium text-gray-800 text-xs">{e.colaborador.nome}</p>
                          <p className="text-xs text-gray-400">{e.colaborador.role}</p>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{e.acao}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RECURSO_COLORS[e.recurso] ?? "bg-gray-100 text-gray-600"}`}>
                        {e.recurso}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {e.detalhes ? (
                        <span className="text-[#1A3A5C] underline-offset-2 hover:underline">
                          {expanded === e.id ? "Ocultar ▲" : "Ver detalhes ▼"}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                  {expanded === e.id && e.detalhes && (
                    <tr key={`${e.id}-detail`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-gray-600 bg-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(e.detalhes, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
