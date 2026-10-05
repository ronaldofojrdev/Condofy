"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Veiculo = {
  id: string;
  placa: string;
  modelo: string;
  cor: string | null;
  criado_em: string;
  unidade_numero: string | null;
  morador_nome: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

export default function VeiculosPage() {
  const router = useRouter();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
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

      if (profile?.role !== "SINDICO" && profile?.role !== "PORTEIRO") {
        router.replace("/dashboard");
        return;
      }

      setToken(sessionData.session.access_token);
      try {
        await load(sessionData.session.access_token);
      } catch {
        setError("Erro ao carregar veículos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  async function load(tk: string) {
    const res = await fetch("/api/veiculos", {
      headers: { Authorization: `Bearer ${tk}` },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao carregar.");
      return;
    }
    const data = await res.json() as Veiculo[];
    setVeiculos(data);
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover este veículo?")) return;
    setRemoving(id);
    const res = await fetch(`/api/veiculos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setRemoving(null);
    if (res.ok) {
      setVeiculos((prev) => prev.filter((v) => v.id !== id));
    } else {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Erro ao remover.");
    }
  }

  const filtered = veiculos.filter((v) => {
    const q = busca.toLowerCase();
    return (
      v.placa.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q) ||
      (v.unidade_numero ?? "").toLowerCase().includes(q) ||
      (v.morador_nome ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Controle</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Veículos</h1>
          <p className="mt-2 text-sm text-slate-500">Todos os veículos cadastrados no condomínio.</p>

          <div className="mt-4 flex items-center gap-4">
            <span className="text-2xl font-bold text-slate-900">{veiculos.length}</span>
            <span className="text-sm text-slate-500">veículo{veiculos.length !== 1 ? "s" : ""} cadastrado{veiculos.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Busca */}
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por placa, modelo, unidade ou morador..."
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
              {busca ? "Nenhum veículo encontrado para essa busca." : "Nenhum veículo cadastrado ainda."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Placa</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Modelo</th>
                  <th className="hidden px-5 py-3 text-left font-semibold text-slate-600 sm:table-cell">Cor</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Unidade</th>
                  <th className="hidden px-5 py-3 text-left font-semibold text-slate-600 md:table-cell">Morador</th>
                  <th className="hidden px-5 py-3 text-left font-semibold text-slate-600 lg:table-cell">Cadastrado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono font-semibold tracking-wide text-slate-800">{v.placa}</td>
                    <td className="px-5 py-4 text-slate-700">{v.modelo}</td>
                    <td className="hidden px-5 py-4 text-slate-500 sm:table-cell">{v.cor ?? "—"}</td>
                    <td className="px-5 py-4 text-slate-700">{v.unidade_numero ? `Unidade ${v.unidade_numero}` : "—"}</td>
                    <td className="hidden px-5 py-4 text-slate-500 md:table-cell">{v.morador_nome ?? "—"}</td>
                    <td className="hidden px-5 py-4 text-slate-400 lg:table-cell">{formatDate(v.criado_em)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRemove(v.id)}
                        disabled={removing === v.id}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {removing === v.id ? "Removendo..." : "Remover"}
                      </button>
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
