import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <img src="/logo.png" alt="Condofy" className="h-8 w-auto mb-8" />
      <p className="text-8xl font-bold tracking-tight text-[#1A3A5C]">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Página não encontrada
      </h1>
      <p className="mt-3 text-sm text-slate-500">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
      >
        Voltar ao início
      </Link>
    </main>
  );
}