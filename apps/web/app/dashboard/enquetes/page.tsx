"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Enquete = {
  id: string;
  titulo: string;
  descricao: string | null;
  opcoes: string[];
  encerrada: boolean;
  encerra_em: string | null;
  criado_em: string;
  total_votos: number;
  contagem: number[];
  meu_voto: number | null;
};

type Role = "SINDICO" | "PORTEIRO" | "MORADOR" | null;

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-[#1A3A5C] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium text-slate-600">
        {value} ({pct}%)
      </span>
    </div>
  );
}

function EnqueteCard({
  enquete,
  role,
  onVote,
  onClose,
}: {
  enquete: Enquete;
  role: Role;
  onVote: (enqueteId: string, opcaoIndex: number) => Promise<void>;
  onClose: (enqueteId: string) => Promise<void>;
}) {
  const [votando, setVotando] = useState(false);
  const [encerrandoLocal, setEncerrandoLocal] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");

  const isEncerrada =
    enquete.encerrada ||
    (enquete.encerra_em !== null && new Date(enquete.encerra_em) < new Date());

  const jaVotou = enquete.meu_voto !== null;
  const mostrarResultados = jaVotou || isEncerrada || role === "SINDICO";

  async function handleVote(index: number) {
    setVotando(true);
    setErrorLocal("");
    try {
      await onVote(enquete.id, index);
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : "Erro ao votar.");
    }
    setVotando(false);
  }

  async function handleClose() {
    setEncerrandoLocal(true);
    setErrorLocal("");
    try {
      await onClose(enquete.id);
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : "Erro ao encerrar.");
    }
    setEncerrandoLocal(false);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                isEncerrada
                  ? "bg-slate-100 text-slate-500"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isEncerrada ? "Encerrada" : "Aberta"}
            </span>
            <span className="text-xs text-slate-400">
              {enquete.total_votos} voto{enquete.total_votos !== 1 ? "s" : ""}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-900">{enquete.titulo}</h3>
          {enquete.descricao ? (
            <p className="mt-1 text-sm text-slate-500">{enquete.descricao}</p>
          ) : null}
          {enquete.encerra_em && !enquete.encerrada ? (
            <p className="mt-1 text-xs text-slate-400">
              Encerra em{" "}
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                new Date(enquete.encerra_em)
              )}
            </p>
          ) : null}
        </div>

        {role === "SINDICO" && !isEncerrada ? (
          <button
            type="button"
            onClick={handleClose}
            disabled={encerrandoLocal}
            className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {encerrandoLocal ? "Encerrando..." : "Encerrar"}
          </button>
        ) : null}
      </div>

      {errorLocal ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{errorLocal}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {enquete.opcoes.map((opcao, i) => (
          <div key={i}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm text-slate-700">
                {opcao}
                {enquete.meu_voto === i ? (
                  <span className="ml-1.5 text-xs font-medium text-[#1A3A5C]">(seu voto)</span>
                ) : null}
              </span>

              {!jaVotou && !isEncerrada && role === "MORADOR" ? (
                <button
                  type="button"
                  onClick={() => void handleVote(i)}
                  disabled={votando}
                  className="shrink-0 rounded-xl bg-[#1A3A5C] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60"
                >
                  Votar
                </button>
              ) : null}
            </div>

            {mostrarResultados ? (
              <ProgressBar value={enquete.contagem[i] ?? 0} total={enquete.total_votos} />
            ) : (
              <div className="h-2 rounded-full bg-slate-100" />
            )}
          </div>
        ))}
      </div>

      {!jaVotou && !isEncerrada && role === "MORADOR" ? (
        <p className="mt-3 text-xs text-slate-400">
          Clique em uma opção para votar. Os resultados serão exibidos após seu voto.
        </p>
      ) : null}
    </div>
  );
}

export default function EnquetesPage() {
  const [enquetes, setEnquetes] = useState<Enquete[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    // Load role
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = await supabase
        .from("perfis_usuario")
        .select("role")
        .eq("usuario_id", userData.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<{ role: Role }>();
      setRole(profile?.role ?? null);
    }

    const res = await fetch("/api/enquetes", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Erro ao carregar enquetes.");
      setLoading(false);
      return;
    }

    const data = (await res.json()) as Enquete[];
    setEnquetes(data);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleVote(enqueteId: string, opcaoIndex: number) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch(`/api/enquetes/${enqueteId}/votar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ opcao_index: opcaoIndex }),
    });

    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(payload.error ?? "Erro ao votar.");

    // Update local state optimistically
    setEnquetes((current) =>
      current.map((e) => {
        if (e.id !== enqueteId) return e;
        const newContagem = [...e.contagem];
        newContagem[opcaoIndex] = (newContagem[opcaoIndex] ?? 0) + 1;
        return {
          ...e,
          meu_voto: opcaoIndex,
          total_votos: e.total_votos + 1,
          contagem: newContagem,
        };
      })
    );
  }

  async function handleClose(enqueteId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch(`/api/enquetes/${enqueteId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ encerrada: true }),
    });

    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(payload.error ?? "Erro ao encerrar.");

    setEnquetes((current) =>
      current.map((e) => (e.id === enqueteId ? { ...e, encerrada: true } : e))
    );
  }

  const abertas = enquetes.filter(
    (e) => !e.encerrada && (e.encerra_em === null || new Date(e.encerra_em) >= new Date())
  );
  const encerradas = enquetes.filter(
    (e) => e.encerrada || (e.encerra_em !== null && new Date(e.encerra_em) < new Date())
  );

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Enquetes
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Votações do condomínio
            </h1>
          </div>

          {role === "SINDICO" ? (
            <Link
              href="/dashboard/enquetes/nova"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1A3A5C] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#15314d]"
            >
              Nova enquete
            </Link>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Carregando enquetes...
          </div>
        ) : enquetes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">Nenhuma enquete criada ainda.</p>
            {role === "SINDICO" ? (
              <Link
                href="/dashboard/enquetes/nova"
                className="mt-3 inline-flex items-center text-sm font-medium text-[#1A3A5C] hover:underline"
              >
                Criar primeira enquete
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            {abertas.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Abertas
                </h2>
                <div className="space-y-4">
                  {abertas.map((e) => (
                    <EnqueteCard
                      key={e.id}
                      enquete={e}
                      role={role}
                      onVote={handleVote}
                      onClose={handleClose}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {encerradas.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Encerradas
                </h2>
                <div className="space-y-4">
                  {encerradas.map((e) => (
                    <EnqueteCard
                      key={e.id}
                      enquete={e}
                      role={role}
                      onVote={handleVote}
                      onClose={handleClose}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
