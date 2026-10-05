"use client";

import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type PorteiroProfileRow = {
  id: string;
  ativo: boolean;
  usuario: {
    nome: string;
    email: string;
  } | null;
  unidade: {
    numero: string;
  } | null;
};

type PorteiroCard = {
  perfilId: string;
  nome: string;
  email: string;
  unidade: string;
  ativo: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const MEMBER_ROLE = "PORTEIRO";

export default function PorteirosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [porteiros, setPorteiros] = useState<PorteiroCard[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; porteiro: PorteiroCard | null }>({ open: false, porteiro: null });

  async function loadPage() {
    setLoading(true);
    setError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      router.replace("/dashboard");
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
      router.replace("/dashboard");
      return;
    }

    if (profile.role !== "SINDICO") {
      router.replace("/dashboard");
      return;
    }

    setCondominioId(profile.condominio_id);
    setRole(profile.role);

    const { data, error: porteirosError } = await supabase
      .from("perfis_usuario")
      .select(`
        id,
        ativo,
        usuario:usuarios (
          nome,
          email
        ),
        unidade:unidades (
          numero
        )
      `)
      .eq("condominio_id", profile.condominio_id)
      .eq("role", "PORTEIRO")
      .order("id", { ascending: false });

    if (porteirosError) {
      setError(porteirosError.message);
      setLoading(false);
      return;
    }

    setPorteiros(
      ((data ?? []) as unknown as PorteiroProfileRow[]).map((porteiro) => ({
        perfilId: porteiro.id,
        nome: porteiro.usuario?.nome ?? "Sem nome",
        email: porteiro.usuario?.email ?? "Sem e-mail",
        unidade: porteiro.unidade?.numero ?? "Sem unidade",
        ativo: porteiro.ativo
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    void loadPage();
  }, []);

  const activeCount = useMemo(() => porteiros.filter((porteiro) => porteiro.ativo).length, [porteiros]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!condominioId) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? "";

    const response = await fetch("/api/criar-usuario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ email, password: senha, nome, condominioId, role: MEMBER_ROLE, unidadeId: null })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Erro ao criar usuário.");
      return;
    }

    setSuccess("Porteiro cadastrado com sucesso.");
    setNome("");
    setEmail("");
    setSenha("");
    setShowForm(false);
    await loadPage();
    router.refresh();
  }

  async function handleDeactivate(porteiro: PorteiroCard) {
    setSavingId(porteiro.perfilId);
    setError("");

    const response = await fetch(`${API_BASE_URL}/membros/${porteiro.perfilId}/desativar`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setSavingId(null);

    if (!response.ok) {
      setError(payload.error ?? "Erro ao desativar porteiro.");
      return;
    }

    await loadPage();
    router.refresh();
  }

  if (role !== "SINDICO") {
    return null;
  }

  return (
    <>
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Porteiros</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Gestão de porteiros</h1>
              <p className="mt-2 text-sm text-slate-600">Cadastre, desative e acompanhe os porteiros do condomínio.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ativos</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{loading ? "..." : activeCount}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm((current) => !current)}
                className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
              >
                Novo porteiro
              </button>
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}

          {showForm ? (
            <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="nome" className="mb-2 block text-sm font-medium text-slate-700">
                    Nome
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
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    required
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="senha" className="mb-2 block text-sm font-medium text-slate-700">
                  Senha de acesso
                </label>
                <div className="relative">
                  <input
                    id="senha"
                    type={showSenha ? "text" : "password"}
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                    aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Aguarde...
                    </>
                  ) : "Salvar porteiro"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Carregando porteiros...
              </div>
            ) : porteiros.length ? (
              porteiros.map((porteiro) => (
                <article key={porteiro.perfilId} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{porteiro.nome}</h2>
                      <p className="mt-2 text-sm text-slate-600">{porteiro.email}</p>
                      <p className="mt-1 text-sm text-slate-600">{porteiro.unidade}</p>
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          porteiro.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {porteiro.ativo ? "Ativo" : "Inativo"}
                      </span>

                      {porteiro.ativo ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDialog({ open: true, porteiro })}
                          disabled={savingId === porteiro.perfilId}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingId === porteiro.perfilId ? "Salvando..." : "Desativar"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
                <p className="text-sm text-slate-600">Nenhum porteiro cadastrado. Adicione um porteiro para ativar a portaria digital.</p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#15314d]"
                >
                  Adicionar porteiro
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>

    <ConfirmDialog
      isOpen={confirmDialog.open}
      title="Desativar porteiro"
      message={`Tem certeza que deseja desativar ${confirmDialog.porteiro?.nome ?? "este porteiro"}? O acesso será revogado imediatamente.`}
      confirmLabel="Desativar"
      onCancel={() => setConfirmDialog({ open: false, porteiro: null })}
      onConfirm={() => {
        const porteiro = confirmDialog.porteiro;
        setConfirmDialog({ open: false, porteiro: null });
        if (porteiro) void handleDeactivate(porteiro);
      }}
    />
    </>
  );
}