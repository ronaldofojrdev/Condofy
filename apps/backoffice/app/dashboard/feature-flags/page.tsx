"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface FeatureFlag {
  id: string;
  chave: string;
  descricao: string | null;
  ativo: boolean;
  planos: string[];
  atualizado_em: string;
}

export default function FeatureFlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ chave: "", descricao: "" });
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // Verificar role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: colab } = await supabase
          .from("backoffice_colaboradores")
          .select("role")
          .eq("usuario_id", user.id)
          .maybeSingle();
        setIsAdmin(colab?.role === "ADMIN");
      }

      const res = await fetch("/api/feature-flags", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) { const j = await res.json(); setFlags(j.data ?? []); }
    } catch (err) {
      console.error("[feature-flags] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  async function toggleFlag(id: string, ativo: boolean) {
    setToggling(id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/feature-flags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ativo }),
    });
    setToggling(null);
    await fetchFlags();
  }

  async function criarFlag(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...form, ativo: false }),
    });
    setSalvando(false);
    setShowForm(false);
    setForm({ chave: "", descricao: "" });
    await fetchFlags();
  }

  function formatData(d: string) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const ativos = flags.filter(f => f.ativo).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Dev</p>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ativos} ativa{ativos !== 1 ? "s" : ""} · {flags.length} total</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] transition">
            + Nova flag
          </button>
        )}
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
            <span className="text-green-600 text-lg font-bold">{ativos}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Ativas</p>
            <p className="text-xs text-gray-400">flags habilitadas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center">
            <span className="text-gray-500 text-lg font-bold">{flags.length - ativos}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Inativas</p>
            <p className="text-xs text-gray-400">flags desabilitadas</p>
          </div>
        </div>
      </div>

      {/* Form nova flag */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#1A3A5C]/20 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nova feature flag</h3>
          <form onSubmit={criarFlag} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chave * (snake_case)</label>
              <input required value={form.chave} onChange={e => setForm(f => ({ ...f, chave: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                placeholder="ex: modulo_xyz"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="O que essa flag controla?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={salvando}
                className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] disabled:opacity-50">
                {salvando ? "Criando..." : "Criar flag (inativa)"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de flags */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhuma feature flag cadastrada</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {flags.map(flag => (
              <div key={flag.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-semibold text-gray-800">{flag.chave}</code>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      flag.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {flag.ativo ? "ON" : "OFF"}
                    </span>
                  </div>
                  {flag.descricao && <p className="text-xs text-gray-400 mt-0.5">{flag.descricao}</p>}
                  <p className="text-xs text-gray-300 mt-0.5">Atualizado {formatData(flag.atualizado_em)}</p>
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => toggleFlag(flag.id, !flag.ativo)}
                  disabled={toggling === flag.id}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                    flag.ativo ? "bg-[#1A3A5C]" : "bg-gray-200"
                  }`}
                  aria-label={flag.ativo ? "Desativar" : "Ativar"}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    flag.ativo ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
