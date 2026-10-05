"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AlterarSenhaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setEmail(data.session.user.email ?? "");
      setLoading(false);
    }
    void loadSession();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (novaSenha.length < 6) {
      setError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError("As senhas não conferem.");
      return;
    }

    setSaving(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: senhaAtual
    });

    if (signInError) {
      setError("Senha atual incorreta.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });

    setSaving(false);

    if (updateError) {
      setError("Não foi possível atualizar a senha. Tente novamente.");
      return;
    }

    setSuccess("Senha alterada com sucesso.");
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm text-slate-500">Carregando...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <Link
            href="/dashboard/configuracoes"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Configurações
          </Link>

          <div className="mt-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Segurança</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Alterar senha</h1>
            <p className="mt-2 text-sm text-slate-600">Atualize a senha da sua conta.</p>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="senhaAtual" className="mb-2 block text-sm font-medium text-slate-700">
                Senha atual
              </label>
              <input
                id="senhaAtual"
                type="password"
                value={senhaAtual}
                onChange={(event) => setSenhaAtual(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                required
              />
            </div>

            <div>
              <label htmlFor="novaSenha" className="mb-2 block text-sm font-medium text-slate-700">
                Nova senha
              </label>
              <input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(event) => setNovaSenha(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="mb-2 block text-sm font-medium text-slate-700">
                Confirmar nova senha
              </label>
              <input
                id="confirmarSenha"
                type="password"
                value={confirmarSenha}
                onChange={(event) => setConfirmarSenha(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                placeholder="Repita a nova senha"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
