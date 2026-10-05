"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const ORIGENS = [
  { value: "INDICACAO", label: "Indicação" },
  { value: "SITE", label: "Site" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "COLD_OUTREACH", label: "Cold Outreach" },
  { value: "EVENTO", label: "Evento" },
  { value: "OUTRO", label: "Outro" },
];

const PLANOS = ["Essencial", "Profissional", "Enterprise"];

export default function NovoLeadPage() {
  const router = useRouter();


  const [form, setForm] = useState({
    nome: "",
    cidade: "",
    estado: "",
    total_unidades: "",
    origem: "OUTRO",
    plano_esperado: "",
    valor_proposta: "",
    follow_up_em: "",
    responsavelId: "",
  });
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadColabs() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const res = await fetch("/api/colaboradores", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setColaboradores(json.data ?? []);
      }
    }
    void loadColabs();
  }, [router]);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        nome: form.nome,
        cidade: form.cidade,
        estado: form.estado || undefined,
        total_unidades: form.total_unidades ? Number(form.total_unidades) : undefined,
        origem: form.origem,
        plano_esperado: form.plano_esperado || undefined,
        valor_proposta: form.valor_proposta ? Number(form.valor_proposta) : undefined,
        follow_up_em: form.follow_up_em || undefined,
        responsavelId: form.responsavelId || undefined,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) { setError(json.error ?? "Erro ao criar lead."); return; }
    router.push(`/dashboard/leads/${json.leadId}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1">
          ← Voltar
        </button>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Comercial</p>
        <h1 className="text-2xl font-bold text-gray-900">Novo lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do condomínio / lead *</label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              placeholder="Ex: Residencial das Flores"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
            <input
              type="text"
              required
              value={form.cidade}
              onChange={e => set("cidade", e.target.value)}
              placeholder="Ex: São Paulo"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <input
              type="text"
              value={form.estado}
              onChange={e => set("estado", e.target.value.toUpperCase().slice(0, 2))}
              placeholder="SP"
              maxLength={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total de unidades</label>
            <input
              type="number"
              min={0}
              value={form.total_unidades}
              onChange={e => set("total_unidades", e.target.value)}
              placeholder="Ex: 80"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
            <select
              value={form.origem}
              onChange={e => set("origem", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20 bg-white"
            >
              {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano esperado</label>
            <select
              value={form.plano_esperado}
              onChange={e => set("plano_esperado", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20 bg-white"
            >
              <option value="">Não definido</option>
              {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor da proposta (R$)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.valor_proposta}
              onChange={e => set("valor_proposta", e.target.value)}
              placeholder="Ex: 299.90"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up</label>
            <input
              type="date"
              value={form.follow_up_em}
              onChange={e => set("follow_up_em", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
            <select
              value={form.responsavelId}
              onChange={e => set("responsavelId", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20 bg-white"
            >
              <option value="">Eu mesmo</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#15304f] transition disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Criar lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
