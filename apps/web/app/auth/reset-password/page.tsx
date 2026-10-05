"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
      } else {
        setError("Sessão inválida. Solicite um novo link de redefinição.");
      }
      setLoadingSession(false);
    }
    void checkSession();
  }, []);

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
    <main className="min-h-screen bg-[#1A3A5C] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between text-white">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Condofy
            </Link>
            <Link href="/login" className="text-sm font-medium text-white/80 transition hover:text-white hover:underline">
              Entrar
            </Link>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-black/20 ring-1 ring-black/5 sm:p-10">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Criar nova senha</h1>
              <p className="mt-2 text-sm text-slate-600">Escolha uma senha segura para continuar.</p>
            </div>

            {loadingSession ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Verificando sessão...
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
                    placeholder="Mínimo 8 caracteres"
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
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </button>
              </form>
            ) : (
              <div className="mt-8 space-y-4">
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
                <Link
                  href="/esqueci-senha"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-4 py-3 font-medium text-white transition hover:bg-[#15314d]"
                >
                  Solicitar novo link
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
