"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Visitante = {
  id: string;
  nome: string;
  documento: string | null;
  motivo: string | null;
  entrada_em: string;
  saida_em: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MinhasVisitasPage() {
  const router = useRouter();
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("perfis_usuario")
        .select("role")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<{ role: string }>();

      if (profile?.role !== "MORADOR") { router.replace("/dashboard"); return; }

      try {
        const res = await fetch("/api/visitantes", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        if (res.ok) {
          setVisitantes(await res.json() as Visitante[]);
        } else {
          setError("Erro ao carregar visitas.");
        }
      } catch {
        setError("Erro ao carregar visitas. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Portaria</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Minhas Visitas</h1>
          <p className="mt-2 text-sm text-slate-500">Visitantes registrados na sua unidade.</p>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : visitantes.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl">🚶</p>
            <p className="mt-3 text-slate-500">Nenhuma visita registrada na sua unidade.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visitantes.map((v) => (
              <article key={v.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{v.nome}</p>
                    {v.documento && <p className="text-xs text-slate-400 mt-0.5">Doc: {v.documento}</p>}
                    {v.motivo && <p className="mt-1 text-sm text-slate-500">{v.motivo}</p>}
                    <p className="mt-2 text-xs text-slate-400">
                      Entrada: {formatDateTime(v.entrada_em)}
                      {v.saida_em ? ` · Saída: ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(v.saida_em))}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                    v.saida_em
                      ? "bg-slate-50 text-slate-500 ring-slate-200"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${v.saida_em ? "bg-slate-400" : "bg-emerald-500"}`} />
                    {v.saida_em ? "Saiu" : "No condomínio"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
