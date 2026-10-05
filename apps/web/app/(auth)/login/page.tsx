import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div>
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Entrar</h2>
        <p className="mt-2 text-sm text-slate-600">Acesse a área administrativa do síndico.</p>
      </div>

      {searchParams?.error ? (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          color: "#dc2626",
          fontSize: "0.875rem"
        }}>
          Link inválido ou expirado. Solicite um novo convite ao síndico do seu condomínio.
        </div>
      ) : null}

      <LoginForm />

      <p className="mt-6 text-center text-sm text-slate-600">
        Precisa de acesso?{" "}
        <a
          href="https://wa.me/5500000000000?text=Olá%2C+gostaria+de+agendar+uma+demonstração+do+Condofy."
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#1A3A5C] hover:underline"
        >
          Fale com nossa equipe
        </a>
      </p>
    </div>
  );
}
