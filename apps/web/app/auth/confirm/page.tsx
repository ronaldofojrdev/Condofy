"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function handleConfirm() {
      // Error in query params
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      if (errorParam) {
        setErrorMessage(errorDescription ?? "Link de acesso inválido ou expirado.");
        setStatus("error");
        return;
      }

      const type = searchParams.get("type") ?? "";

      // PKCE code flow: ?code=...
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMessage("Não foi possível validar o link de acesso.");
          setStatus("error");
          return;
        }
        router.replace(type === "recovery" || type === "invite" ? "/auth/reset-password" : "/dashboard");
        return;
      }

      // token_hash flow: ?token_hash=...&type=...
      const tokenHash = searchParams.get("token_hash");
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"]
        });
        if (error) {
          setErrorMessage("Não foi possível validar o link de acesso.");
          setStatus("error");
          return;
        }
        router.replace(type === "recovery" || type === "invite" ? "/auth/reset-password" : "/dashboard");
        return;
      }

      // Hash / implicit flow: #access_token=...&refresh_token=...&type=...
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hash.get("error");
      const hashErrorDescription = hash.get("error_description");
      if (hashError) {
        setErrorMessage(hashErrorDescription ?? "Link de acesso inválido ou expirado.");
        setStatus("error");
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const hashType = hash.get("type") ?? "";
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          setErrorMessage("Não foi possível estabelecer a sessão.");
          setStatus("error");
          return;
        }
        router.replace(hashType === "recovery" || hashType === "invite" ? "/auth/reset-password" : "/dashboard");
        return;
      }

      setErrorMessage("Link de acesso inválido ou expirado. Solicite um novo link.");
      setStatus("error");
    }

    void handleConfirm();
  }, [searchParams, router]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1A3A5C] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-black/20 ring-1 ring-black/5 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1A3A5C]">Condofy</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Confirmando acesso</h1>
          <p className="mt-2 text-sm text-slate-600">Aguarde enquanto validamos seu link.</p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#1A3A5C]/40" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A3A5C] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-black/20 ring-1 ring-black/5 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1A3A5C]">Condofy</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Link inválido</h1>
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-4 py-3 font-medium text-white transition hover:bg-[#15314d]"
        >
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#1A3A5C] px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-black/20 ring-1 ring-black/5 sm:p-10">
            <p className="text-sm text-slate-500">Carregando...</p>
          </div>
        </main>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
