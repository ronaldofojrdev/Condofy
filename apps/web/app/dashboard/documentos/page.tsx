"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Documento = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  url: string;
  criado_em: string;
};

type Role = "SINDICO" | "PORTEIRO" | "MORADOR" | null;

const CATEGORIA_LABELS: Record<string, string> = {
  GERAL: "Geral",
  ATA: "Ata de Assembleia",
  REGULAMENTO: "Regulamento",
  FINANCEIRO: "Financeiro",
  MANUTENCAO: "Manutenção",
  OUTRO: "Outro",
};

const CATEGORIA_STYLES: Record<string, string> = {
  GERAL: "bg-slate-100 text-slate-600",
  ATA: "bg-blue-100 text-blue-700",
  REGULAMENTO: "bg-violet-100 text-violet-700",
  FINANCEIRO: "bg-amber-100 text-amber-700",
  MANUTENCAO: "bg-orange-100 text-orange-700",
  OUTRO: "bg-slate-100 text-slate-600",
};

const CATEGORIAS = ["GERAL", "ATA", "REGULAMENTO", "FINANCEIRO", "MANUTENCAO", "OUTRO"] as const;

function AddForm({ onAdd }: { onAdd: (doc: Documento) => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("GERAL");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!titulo.trim()) { setError("Título é obrigatório."); return; }
    if (!url.trim()) { setError("URL é obrigatória."); return; }

    setSubmitting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch("/api/documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ titulo: titulo.trim(), descricao: descricao.trim() || null, categoria, url: url.trim() }),
    });

    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; documentoId?: string; error?: string };
    if (!res.ok) { setError(payload.error ?? "Erro ao adicionar."); setSubmitting(false); return; }

    onAdd({
      id: payload.documentoId ?? crypto.randomUUID(),
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      categoria,
      url: url.trim(),
      criado_em: new Date().toISOString(),
    });

    setTitulo(""); setDescricao(""); setCategoria("GERAL"); setUrl(""); setOpen(false);
    setSubmitting(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-[#1A3A5C] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#15314d]"
      >
        Adicionar documento
      </button>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Novo documento</h2>

      {error ? <p className="mb-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="space-y-3">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título do documento"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
        />

        <div className="flex gap-3">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
        />

        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição (opcional)"
          rows={2}
          className="w-full resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1A3A5C] focus:ring-4 focus:ring-[#1A3A5C]/10"
        />
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-2xl bg-[#1A3A5C] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#15314d] disabled:opacity-60"
        >
          {submitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch("/api/documentos", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Erro ao carregar documentos.");
      setLoading(false);
      return;
    }

    const payload = (await res.json()) as { documentos: Documento[]; role: Role };
    setDocumentos(payload.documentos);
    setRole(payload.role);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    const res = await fetch(`/api/documentos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setDocumentos((prev) => prev.filter((d) => d.id !== id));
    }
    setDeletingId(null);
  }

  // Group by categoria
  const grouped = documentos.reduce<Record<string, Documento[]>>((acc, doc) => {
    const key = doc.categoria;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const categoriaOrder = ["ATA", "REGULAMENTO", "FINANCEIRO", "MANUTENCAO", "GERAL", "OUTRO"];
  const sortedCategorias = categoriaOrder.filter((c) => grouped[c]?.length);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Condomínio</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Documentos</h1>
            <p className="mt-1 text-sm text-slate-500">Regulamentos, atas e arquivos do condomínio.</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {role === "SINDICO" ? (
          <div className="mb-6">
            <AddForm onAdd={(doc) => setDocumentos((prev) => [doc, ...prev])} />
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Carregando documentos...
          </div>
        ) : documentos.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Nenhum documento disponível ainda.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCategorias.map((cat) => (
              <section key={cat}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {CATEGORIA_LABELS[cat] ?? cat}
                </h2>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {grouped[cat].map((doc, i) => (
                    <div
                      key={doc.id}
                      className={`flex items-start gap-4 px-5 py-4 ${
                        i !== 0 ? "border-t border-slate-100" : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${CATEGORIA_STYLES[doc.categoria] ?? "bg-slate-100 text-slate-600"}`}>
                            {CATEGORIA_LABELS[doc.categoria] ?? doc.categoria}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(doc.criado_em))}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900">{doc.titulo}</p>
                        {doc.descricao ? (
                          <p className="mt-0.5 text-xs text-slate-500">{doc.descricao}</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-[#1A3A5C] transition hover:bg-slate-50"
                        >
                          Abrir
                        </a>
                        {role === "SINDICO" ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                          >
                            {deletingId === doc.id ? "..." : "Remover"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
