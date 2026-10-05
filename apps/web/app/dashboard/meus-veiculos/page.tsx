"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Veiculo = {
  id: string;
  placa: string;
  modelo: string;
  cor: string | null;
  criado_em: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

export default function MeusVeiculosPage() {
  const router = useRouter();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
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
        const res = await fetch("/api/veiculos", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json() as Veiculo[];
          setVeiculos(data);
        } else {
          setError("Erro ao carregar veículos.");
        }
      } catch {
        setError("Erro ao carregar veículos. Tente novamente.");
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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Meus Veículos</h1>
          <p className="mt-2 text-sm text-slate-500">Veículos cadastrados na sua unidade.</p>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : veiculos.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl">🚗</p>
            <p className="mt-3 text-slate-500">Nenhum veículo cadastrado na sua unidade.</p>
            <p className="mt-1 text-sm text-slate-400">Solicite ao porteiro para realizar o cadastro.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {veiculos.map((v) => (
              <article key={v.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    🚗
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-lg font-bold tracking-widest text-slate-900">{v.placa}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{v.modelo}{v.cor ? ` · ${v.cor}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-400">Cadastrado em {formatDate(v.criado_em)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
