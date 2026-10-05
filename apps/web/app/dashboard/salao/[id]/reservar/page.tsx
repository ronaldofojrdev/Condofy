"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type SalaoRow = {
  id: string;
  nome: string;
  regras: string | null;
  condominio_id: string;
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function ReservarSalaoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const salaoId = params.id;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [salao, setSalao] = useState<SalaoRow | null>(null);
  const [dataReserva, setDataReserva] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        router.push("/dashboard/salao");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("perfis_usuario")
        .select("condominio_id, role")
        .eq("usuario_id", sessionData.session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<ProfileRow>();

      if (profileError || !profile?.condominio_id || !profile?.role) {
        router.push("/dashboard/salao");
        return;
      }

      if (profile.role !== "MORADOR") {
        router.push("/dashboard/salao");
        return;
      }

      setCondominioId(profile.condominio_id);
      setRole(profile.role);

      const { data: salaoData, error: salaoError } = await supabase
        .from("saloes")
        .select("id, nome, regras, condominio_id")
        .eq("id", salaoId)
        .eq("condominio_id", profile.condominio_id)
        .eq("ativo", true)
        .single<SalaoRow>();

      if (salaoError || !salaoData) {
        setError("Salão não encontrado.");
        setLoading(false);
        return;
      }

      setSalao(salaoData);
      setLoading(false);
    }

    void loadPage();
  }, [router, salaoId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!condominioId || role !== "MORADOR" || !salao) {
      router.push("/dashboard/salao");
      return;
    }

    if (!dataReserva || !horarioInicio || !horarioFim) {
      setError("Preencha data e horários.");
      return;
    }

    if (toMinutes(horarioFim) <= toMinutes(horarioInicio)) {
      setError("O horário final deve ser maior que o horário inicial.");
      return;
    }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setSubmitting(false);
      router.push("/dashboard/salao");
      return;
    }

    const response = await fetch("/api/reservas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({
        salaoId: salao.id,
        dataReserva,
        horarioInicio,
        horarioFim
      })
    });

    setSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Não foi possível registrar a reserva.");
      return;
    }

    router.push("/dashboard/salao/minhas-reservas");
    router.refresh();
  }

  const regrasTexto = useMemo(() => salao?.regras ?? "Sem regras informadas.", [salao]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm text-slate-500">Carregando salão...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!salao || role !== "MORADOR") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Salão</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Reservar {salao.nome}
          </h1>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Regras</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{regrasTexto}</p>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="dataReserva" className="mb-2 block text-sm font-medium text-slate-700">
                Data
              </label>
              <input
                id="dataReserva"
                type="date"
                value={dataReserva}
                onChange={(event) => setDataReserva(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="horarioInicio" className="mb-2 block text-sm font-medium text-slate-700">
                  Horário início
                </label>
                <input
                  id="horarioInicio"
                  type="time"
                  value={horarioInicio}
                  onChange={(event) => setHorarioInicio(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  required
                />
              </div>

              <div>
                <label htmlFor="horarioFim" className="mb-2 block text-sm font-medium text-slate-700">
                  Horário fim
                </label>
                <input
                  id="horarioFim"
                  type="time"
                  value={horarioFim}
                  onChange={(event) => setHorarioFim(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Solicitar reserva"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
