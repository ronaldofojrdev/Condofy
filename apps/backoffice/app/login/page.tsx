"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error || !data.session) {
      setErro("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    // Verifica se é colaborador do backoffice
    const { data: colaborador } = await supabase
      .from("backoffice_colaboradores")
      .select("id, role")
      .eq("usuario_id", data.session.user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (!colaborador) {
      await supabase.auth.signOut();
      setErro("Acesso não autorizado. Somente equipe interna da Condofy.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Lado esquerdo — branding */}
      <div className="hidden lg:flex lg:w-[420px] lg:shrink-0 flex-col justify-between bg-[#0f172a] p-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#1A3A5C] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4">
                <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">Condofy</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
              BACKOFFICE
            </span>
          </div>

          <div className="mt-16">
            <h1 className="text-2xl font-bold text-white">
              Sistema interno
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Acesso exclusivo para a equipe Condofy. Implementação, Comercial, Financeiro, Jurídico e Dev.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {[
              { role: "Implementação", desc: "Criar condomínios e onboarding" },
              { role: "Comercial", desc: "Pipeline e funil de vendas" },
              { role: "Financeiro", desc: "MRR, cobranças e churn" },
              { role: "Jurídico", desc: "Contratos e compliance" },
              { role: "Dev", desc: "Monitoramento e feature flags" },
            ].map((item) => (
              <div key={item.role} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                <span className="text-xs font-semibold text-slate-300">{item.role}</span>
                <span className="text-xs text-slate-500">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600">
          © 2026 Condofy Tecnologia — uso interno
        </p>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-lg bg-[#1A3A5C] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4">
                <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-900">Condofy Backoffice</span>
          </div>

          <h2 className="text-xl font-bold text-slate-900">Entrar no backoffice</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Acesso restrito à equipe interna.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@condofy.com.br"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#1A3A5C] focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#1A3A5C] focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
              />
            </div>

            {erro && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#1A3A5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15314d] disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Sem acesso? Fale com o administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
