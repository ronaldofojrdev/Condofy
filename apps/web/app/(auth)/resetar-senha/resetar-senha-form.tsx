"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ResetarSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function initializeSession() {
      setLoadingSession(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        setSessionReady(true);
        setLoadingSession(false);
        return;
      }

      const code = searchParams.get("code")?.trim() ?? "";

      if (!code) {
        setError("Seu link de redefinição é inválido ou expirou.");
        setLoadingSession(false);
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError("Não foi possível validar o link de redefinição.");
        setLoadingSession(false);
        return;
      }

      const { data: refreshedSession } = await supabase.auth.getSession();
      if (!refreshedSession.session) {
        setError("Não foi possível validar o link de redefinição.");
        setLoadingSession(false);
        return;
      }

      setSessionReady(true);
      setLoadingSession(false);
    }

    void initializeSession();
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Não foi possível atualizar a senha. Tente novamente.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Criar nova senha</h2>
        <p className="mt-2 text-sm text-slate-600">Escolha uma nova senha para continuar.</p>
      </div>

      {loadingSession ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Validando seu link de redefinição...
        </div>
      ) : sessionReady ? (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              Nova senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              placeholder="Digite a nova senha"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
              Confirmar nova senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              placeholder="Repita a nova senha"
              required
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
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
            ) : "Salvar nova senha"}
          </button>
        </form>
      ) : (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          {error}
          <div className="mt-4">
            <Link href="/login" className="font-medium text-[#1A3A5C] hover:underline">
              Voltar para o login
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}