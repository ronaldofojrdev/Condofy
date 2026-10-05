"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Colaborador = { id: string; nome: string; role: string };

export default function NovoCondominioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [showSenha, setShowSenha] = useState(false);

  // Campos do condomínio
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [plano, setPlano] = useState("ESSENCIAL");

  // Campos do síndico
  const [sindicoNome, setSindicoNome] = useState("");
  const [sindicoEmail, setSindicoEmail] = useState("");
  const [sindicoSenha, setSindicoSenha] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  useEffect(() => {
    async function loadColabs() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("backoffice_colaboradores")
        .select("id, nome, role")
        .eq("ativo", true)
        .in("role", ["ADMIN", "IMPLEMENTACAO"])
        .order("nome");
      setColaboradores((data ?? []) as Colaborador[]);
      const me = (data ?? []).find((c: any) => true);
      if (me) setResponsavelId(me.id);
    }
    void loadColabs();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setSucesso("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErro("Sessão expirada."); setLoading(false); return; }

    const res = await fetch("/api/condominios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        nome, endereco, cidade, estado, cep, plano,
        sindicoNome, sindicoEmail, sindicoSenha,
        responsavelId: responsavelId || null,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setErro(json.error ?? "Erro ao criar condomínio.");
      return;
    }

    setSucesso("Condomínio criado com sucesso!");
    setTimeout(() => router.push("/dashboard/condominios"), 1500);
  }

  return (
    <div className="px-6 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/condominios" className="text-xs font-medium text-slate-400 hover:text-slate-600">
          ← Condomínios
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Implementação</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Novo condomínio</h1>
        <p className="mt-1 text-sm text-slate-500">Cria o condomínio e a conta do síndico no sistema.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Dados do condomínio */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold text-slate-700">Dados do condomínio</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome *</label>
              <input
                required value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Condomínio Residencial das Flores"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Endereço</label>
              <input
                value={endereco} onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro"
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade</label>
                <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Rio de Janeiro" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label>
                <input value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="RJ" maxLength={2} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">CEP</label>
                <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Plano *</label>
                <select required value={plano} onChange={(e) => setPlano(e.target.value)} className="input">
                  <option value="ESSENCIAL">Essencial — até 40 unidades</option>
                  <option value="CRESCIMENTO">Crescimento — até 100 unidades</option>
                  <option value="PRO">Pro — até 200 unidades</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Conta do síndico */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Conta do síndico</h2>
          <p className="mb-5 text-xs text-slate-400">Credenciais de acesso que o síndico vai usar no app principal.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome completo *</label>
              <input
                required value={sindicoNome} onChange={(e) => setSindicoNome(e.target.value)}
                placeholder="Ex: João Silva"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail *</label>
              <input
                required type="email" value={sindicoEmail} onChange={(e) => setSindicoEmail(e.target.value)}
                placeholder="sindico@condominio.com.br"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha inicial *</label>
              <div className="relative">
                <input
                  required type={showSenha ? "text" : "password"} value={sindicoSenha}
                  onChange={(e) => setSindicoSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  {showSenha ? "ocultar" : "mostrar"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">O síndico pode alterar a senha após o primeiro acesso.</p>
            </div>
          </div>
        </div>

        {/* Responsável pela implementação */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold text-slate-700">Responsável pela implementação</h2>
          <select
            value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}
            className="input"
          >
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} ({c.role})</option>
            ))}
          </select>
        </div>

        {/* Erro / Sucesso */}
        {erro && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>
        )}
        {sucesso && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{sucesso}</div>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#1A3A5C] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15314d] disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar condomínio"}
          </button>
          <Link
            href="/dashboard/condominios"
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
          background: white;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          color: #0f172a;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: #1A3A5C;
          box-shadow: 0 0 0 3px rgb(26 58 92 / 0.12);
        }
      `}</style>
    </div>
  );
}
