"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type BackofficeRole = "ADMIN" | "IMPLEMENTACAO" | "COMERCIAL" | "FINANCEIRO" | "JURIDICO" | "DEV";

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  role: BackofficeRole;
  ativo: boolean;
  criado_em: string;
}

const ROLE_LABELS: Record<BackofficeRole, string> = {
  ADMIN: "Admin",
  IMPLEMENTACAO: "Implementação",
  COMERCIAL: "Comercial",
  FINANCEIRO: "Financeiro",
  JURIDICO: "Jurídico",
  DEV: "Dev",
};

const ROLE_COLORS: Record<BackofficeRole, string> = {
  ADMIN: "bg-red-100 text-red-700",
  IMPLEMENTACAO: "bg-blue-100 text-blue-700",
  COMERCIAL: "bg-violet-100 text-violet-700",
  FINANCEIRO: "bg-emerald-100 text-emerald-700",
  JURIDICO: "bg-amber-100 text-amber-700",
  DEV: "bg-teal-100 text-teal-700",
};

const ROLES: BackofficeRole[] = ["ADMIN", "IMPLEMENTACAO", "COMERCIAL", "FINANCEIRO", "JURIDICO", "DEV"];

export default function EquipePage() {
  const router = useRouter();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", email: "", role: "IMPLEMENTACAO", senha: "" });

  const fetchColaboradores = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const res = await fetch("/api/equipe", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) { const j = await res.json(); setColaboradores(j.data ?? []); }
    } catch (err) {
      console.error("[equipe] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchColaboradores(); }, [fetchColaboradores]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/equipe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    if (!res.ok) { setErro(j.error ?? "Erro ao criar colaborador."); setSalvando(false); return; }
    setSalvando(false);
    setShowForm(false);
    setForm({ nome: "", email: "", role: "IMPLEMENTACAO", senha: "" });
    await fetchColaboradores();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    setAtualizando(id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/equipe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ativo }),
    });
    setAtualizando(null);
    await fetchColaboradores();
  }

  async function alterarRole(id: string, role: BackofficeRole) {
    setAtualizando(id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/equipe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ role }),
    });
    setAtualizando(null);
    await fetchColaboradores();
  }

  const ativos = colaboradores.filter(c => c.ativo).length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Equipe</p>
          <h1 className="text-2xl font-bold text-gray-900">Colaboradores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ativos} ativo{ativos !== 1 ? "s" : ""} · {colaboradores.length} total</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setErro(""); }}
          className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] transition"
        >
          + Novo colaborador
        </button>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#1A3A5C]/20 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Novo colaborador</h3>
          {erro && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</div>
          )}
          <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="colaborador@condofy.com.br"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Senha inicial *</label>
              <input required type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={salvando}
                className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] disabled:opacity-50">
                {salvando ? "Criando..." : "Criar colaborador"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : colaboradores.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum colaborador cadastrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Alterar role</th>
                <th className="text-left px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map(c => (
                <tr key={c.id} className={`border-b border-gray-50 ${!c.ativo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.nome}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[c.role]}`}>
                      {ROLE_LABELS[c.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={c.role}
                      onChange={e => alterarRole(c.id, e.target.value as BackofficeRole)}
                      disabled={atualizando === c.id || !c.ativo}
                      className="px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none disabled:opacity-40"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAtivo(c.id, !c.ativo)}
                      disabled={atualizando === c.id}
                      className={`px-3 py-1 text-xs rounded-lg disabled:opacity-50 transition ${
                        c.ativo
                          ? "border border-gray-200 text-gray-500 hover:bg-gray-50"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {atualizando === c.id ? "..." : c.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
