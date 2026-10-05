"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function translateError(msg: string): string {
  if (msg.includes("User already registered") || msg.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("Password should be at least") || msg.includes("password") || msg.includes("weak password")) return "A senha deve ter no mínimo 8 caracteres.";
  if (msg.includes("Too many requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  return "Erro ao criar conta. Tente novamente.";
}

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    await supabase.auth.signOut();

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome
        }
      }
    });
    setLoading(false);

    if (signUpError) {
      setError(translateError(signUpError.message));
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div>
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Criar conta</h2>
        <p className="mt-2 text-sm text-slate-600">Crie sua conta grátis e configure seu condomínio em minutos.</p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="nome" className="mb-2 block text-sm font-medium text-slate-700">
            Nome completo
          </label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
            placeholder="Nome completo"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
            placeholder="voce@dominio.com"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
            placeholder="Crie uma senha"
            required
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
            placeholder="Repita a senha"
            required
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-4 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Aguarde...
            </>
          ) : "Criar conta"}
        </button>

        <p className="text-center text-sm font-medium text-slate-500">Grátis para começar · Sem cartão de crédito</p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-[#1A3A5C] hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
