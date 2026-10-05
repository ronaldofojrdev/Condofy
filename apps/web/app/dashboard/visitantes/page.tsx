"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Visitante = {
  id: string;
  nome: string;
  documento: string | null;
  motivo: string | null;
  entrada_em: string;
  saida_em: string | null;
  unidade: { numero: string } | null;
  registrado_por_usuario: { nome: string } | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(value));
}

export default function VisitantesPage() {
  const router = useRouter();
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [token, setToken] = useState("");
  const [registrandoSaida, setRegistrandoSaida] = useState<string | null>(null);

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

      if (profile?.role !== "SINDICO" && profile?.role !== "PORTEIRO") {
        router.replace("/dashboard");
        return;
      }

      setToken(sessionData.session.access_token);
      try {
        await load(sessionData.session.access_token);
      } catch {
        setError("Erro ao carregar visitantes. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  async function load(tk: string) {
    const res = await fetch("/api/visitantes", {
      headers: { Authorization: `Bearer ${tk}` },
    });
    if (res.ok) {
      const data = await res.json() as Visitante[];
      setVisitantes(data);
    } else {
      setError("Erro ao carregar visitantes.");
    }
  }

  async function handleSaida(id: string) {
    setRegistrandoSaida(id);
    const res = await fetch(`/api/visitantes/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setRegistrandoSaida(null);
    if (res.ok) {
      const updated = await res.json() as { saida_em: string };
      setVisitantes((prev) =>
        prev.map((v) => (v.id === id ? { ...v, saida_em: updated.saida_em } : v))
      );
    } else {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao registrar saída.");
    }
  }

  const filtered = visitantes.filter((v) => {
    const q = busca.toLowerCase();
    return (
      v.nome.toLowerCase().includes(q) ||
      (v.documento ?? "").toLowerCase().includes(q) ||
      (v.unidade?.numero ?? "").toLowerCase().includes(q) ||
      (v.motivo ?? "").toLowerCase().includes(q)
    );
  });

  const emVisita = filtered.filter((v) => !v.saida_em).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Portaria</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Visitantes</h1>
          <p className="mt-2 text-sm text-slate-500">Controle de entrada e saída de visitantes.</p>

          <div className="mt-4 flex items-center gap-6">
            <div>
              <span className="text-2xl font-bold text-slate-900">{visitantes.length}</span>
              <span className="ml-2 text-sm text-slate-500">visita{visitantes.length !== 1 ? "s" : ""} hoje</span>
            </div>
            {emVisita > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-emerald-700">{emVisita} no condomínio agora</span>
              </div>
            )}
          </div>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, documento, unidade ou motivo..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
        />

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-400">
              {busca ? "Nenhum visitante encontrado." : "Nenhum visitante registrado hoje."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Visitante</th>
                  <th className="hidden px-5 py-3 text-left font-semibold text-slate-600 sm:table-cell">Documento</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Unidade</th>
                  <th className="hidden px-5 py-3 text-left font-semibold text-slate-600 md:table-cell">Entrada</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Saída</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{v.nome}</p>
                      {v.motivo && <p className="text-xs text-slate-400">{v.motivo}</p>}
                    </td>
                    <td className="hidden px-5 py-4 text-slate-500 sm:table-cell">{v.documento ?? "—"}</td>
                    <td className="px-5 py-4 text-slate-700">
                      {v.unidade?.numero ? `Unid. ${v.unidade.numero}` : "—"}
                    </td>
                    <td className="hidden px-5 py-4 text-slate-500 md:table-cell">
                      {formatDateTime(v.entrada_em)}
                    </td>
                    <td className="px-5 py-4">
                      {v.saida_em ? (
                        <span className="text-slate-500">{formatTime(v.saida_em)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          No condomínio
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!v.saida_em && (
                        <button
                          type="button"
                          onClick={() => void handleSaida(v.id)}
                          disabled={registrandoSaida === v.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#1A3A5C] transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          {registrandoSaida === v.id ? "..." : "Registrar saída"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
