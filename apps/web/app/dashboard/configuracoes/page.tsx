"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type CondominiumType = "VERTICAL" | "HORIZONTAL";

type CondominiumRow = {
  id: string;
  nome: string;
  tipo: CondominiumType;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  total_unidades: number;
};

type AccountRow = {
  nome: string;
  email: string;
};

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [conta, setConta] = useState<AccountRow | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<CondominiumType>("VERTICAL");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [totalUnidades, setTotalUnidades] = useState(1);

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      const userId = sessionData.session.user.id;

      const [{ data: profile, error: profileError }, { data: account, error: accountError }] = await Promise.all([
        supabase
          .from("perfis_usuario")
          .select("condominio_id, role")
          .eq("usuario_id", userId)
          .eq("ativo", true)
          .limit(1)
          .single<ProfileRow>(),
        supabase.from("usuarios").select("nome, email").eq("id", userId).single<AccountRow>()
      ]);

      if (profileError || !profile?.condominio_id || !profile?.role) {
        router.replace("/dashboard");
        return;
      }

      if (profile.role !== "SINDICO") {
        router.replace("/dashboard");
        return;
      }

      if (accountError) {
        setError(accountError.message);
        setLoading(false);
        return;
      }

      const { data: condomino, error: condominioError } = await supabase
        .from("condominios")
        .select("id, nome, tipo, endereco, cidade, estado, cep, total_unidades")
        .eq("id", profile.condominio_id)
        .single<CondominiumRow>();

      if (condominioError || !condomino) {
        setError(condominioError?.message ?? "Condomínio não encontrado.");
        setLoading(false);
        return;
      }

      setRole(profile.role);
      setCondominioId(profile.condominio_id);
      setConta(account ?? null);
      setNome(condomino.nome);
      setTipo(condomino.tipo);
      setEndereco(condomino.endereco);
      setCidade(condomino.cidade);
      setEstado(condomino.estado);
      setCep(condomino.cep);
      setTotalUnidades(condomino.total_unidades);
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!condominioId) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("condominios")
      .update({
        nome,
        tipo,
        endereco,
        cidade,
        estado,
        cep,
        total_unidades: totalUnidades
      })
      .eq("id", condominioId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Configurações atualizadas com sucesso.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm text-slate-500">Carregando configurações...</p>
          </div>
        </div>
      </main>
    );
  }

  if (role !== "SINDICO") {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Configurações</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Perfil do condomínio</h1>
              <p className="mt-2 text-sm text-slate-600">Atualize os dados cadastrais do condomínio após o onboarding.</p>
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : null}

          {success ? (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="nome" className="mb-2 block text-sm font-medium text-slate-700">
                Nome do condomínio
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                required
              />
            </div>

            <div>
              <label htmlFor="tipo" className="mb-2 block text-sm font-medium text-slate-700">
                Tipo
              </label>
              <select
                id="tipo"
                value={tipo}
                onChange={(event) => setTipo(event.target.value as CondominiumType)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
              >
                <option value="VERTICAL">Prédio (Vertical)</option>
                <option value="HORIZONTAL">Condomínio de Casas (Horizontal)</option>
              </select>
            </div>

            <div>
              <label htmlFor="endereco" className="mb-2 block text-sm font-medium text-slate-700">
                Endereço
              </label>
              <input
                id="endereco"
                type="text"
                value={endereco}
                onChange={(event) => setEndereco(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cidade" className="mb-2 block text-sm font-medium text-slate-700">
                  Cidade
                </label>
                <input
                  id="cidade"
                  type="text"
                  value={cidade}
                  onChange={(event) => setCidade(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  required
                />
              </div>

              <div>
                <label htmlFor="estado" className="mb-2 block text-sm font-medium text-slate-700">
                  Estado
                </label>
                <input
                  id="estado"
                  type="text"
                  maxLength={2}
                  value={estado}
                  onChange={(event) => setEstado(event.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  placeholder="SP"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cep" className="mb-2 block text-sm font-medium text-slate-700">
                  CEP
                </label>
                <input
                  id="cep"
                  type="text"
                  value={cep}
                  onChange={(event) => setCep(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  placeholder="00000-000"
                  required
                />
              </div>

              <div>
                <label htmlFor="totalUnidades" className="mb-2 block text-sm font-medium text-slate-700">
                  Total de unidades
                </label>
                <input
                  id="totalUnidades"
                  type="number"
                  min={1}
                  value={totalUnidades}
                  onChange={(event) => setTotalUnidades(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Informações da conta</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Nome</p>
                <p className="mt-1 text-base font-medium text-slate-900">{conta?.nome ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="mt-1 text-base font-medium text-slate-900">{conta?.email ?? "-"}</p>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <Link
                href="/dashboard/configuracoes/senha"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Alterar senha
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}