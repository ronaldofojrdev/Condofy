import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#1A3A5C] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between text-white">
            <Link href="/">
              <img src="/logo.png" alt="Condofy" className="h-8 w-auto brightness-0 invert" />
            </Link>
            <Link href="/" className="text-sm font-medium text-white/80 transition hover:text-white hover:underline">
              Voltar
            </Link>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-black/20 ring-1 ring-black/5 sm:p-10">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
