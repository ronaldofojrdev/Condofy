"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import * as XLSX from "xlsx";

const REPORT_TYPES = [
  { value: "moradores", label: "Moradores Ativos", hasPeriod: false },
  { value: "cobrancas", label: "Cobranças por Período", hasPeriod: true },
  { value: "inadimplencia", label: "Inadimplência Atual", hasPeriod: false },
  { value: "entregas", label: "Entregas por Período", hasPeriod: true },
  { value: "ocorrencias", label: "Ocorrências por Período", hasPeriod: true },
  { value: "reservas", label: "Reservas do Salão", hasPeriod: true },
];

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState("moradores");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedReport = REPORT_TYPES.find((r) => r.value === tipo)!;

  async function fetchData() {
    setLoading(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return null;
    }

    const params = new URLSearchParams({ tipo });
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);

    let res: Response;
    try {
      res = await fetch(`/api/relatorios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
    } catch (fetchErr) {
      setError(`Erro de rede: ${String(fetchErr)}`);
      setLoading(false);
      return null;
    }

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      setError(`Resposta inesperada do servidor (${res.status}): ${text.slice(0, 200)}`);
      setLoading(false);
      return null;
    }

    if (!res.ok) {
      setError(json.error ?? "Erro ao gerar relatório.");
      setLoading(false);
      return null;
    }

    setLoading(false);
    return json as { rows: Record<string, string>[]; filename: string };
  }

  async function handleExcel() {
    const data = await fetchData();
    if (!data) return;

    if (data.rows.length === 0) {
      setError("Nenhum dado encontrado para o período selecionado.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");

    // Auto-fit column widths
    const colWidths = Object.keys(data.rows[0]).map((key) => ({
      wch: Math.max(
        key.length,
        ...data.rows.map((r) => String(r[key] ?? "").length)
      ) + 2,
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `condofy-${data.filename}.xlsx`);
  }

  async function handlePdf() {
    const data = await fetchData();
    if (!data) return;

    if (data.rows.length === 0) {
      setError("Nenhum dado encontrado para o período selecionado.");
      return;
    }

    const headers = Object.keys(data.rows[0]);
    const dateRange = inicio && fim
      ? ` &nbsp;•&nbsp; ${inicio.split("-").reverse().join("/")} a ${fim.split("-").reverse().join("/")}`
      : "";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${selectedReport.label} — Condofy</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #1e293b;
    padding: 28px 32px;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2px solid #1A3A5C;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  header h1 { font-size: 16px; font-weight: 700; color: #1A3A5C; }
  header p { font-size: 10px; color: #64748b; margin-top: 3px; }
  .badge {
    background: #1A3A5C;
    color: white;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th {
    background: #1A3A5C;
    color: white;
    padding: 7px 9px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  tbody td { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot td {
    padding: 8px 9px 0;
    font-size: 10px;
    color: #94a3b8;
  }
  @media print {
    body { padding: 16px 20px; }
    @page { margin: 1cm; }
  }
</style>
</head>
<body>
<header>
  <div>
    <h1>Condofy &mdash; ${selectedReport.label}</h1>
    <p>Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}${dateRange}</p>
  </div>
  <div class="badge">${data.rows.length} registro${data.rows.length !== 1 ? "s" : ""}</div>
</header>
<table>
  <thead>
    <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
  </thead>
  <tbody>
    ${data.rows
      .map(
        (row) =>
          `<tr>${headers
            .map((h) => `<td>${row[h] ?? ""}</td>`)
            .join("")}</tr>`
      )
      .join("\n    ")}
  </tbody>
  <tfoot>
    <tr><td colspan="${headers.length}">Relatório gerado pelo sistema Condofy &mdash; uso interno</td></tr>
  </tfoot>
</table>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Pop-up bloqueado. Permita pop-ups para este site e tente novamente.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Gestão</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Relatórios</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Exporte dados do condomínio em Excel ou PDF.
          </p>

          <div className="mt-8 space-y-5">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tipo de relatório
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-[#1A3A5C] focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Período */}
            {selectedReport.hasPeriod && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-[#1A3A5C] focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-[#1A3A5C] focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20"
                  />
                </div>
              </div>
            )}

            {/* Info sobre período opcional */}
            {selectedReport.hasPeriod && (
              <p className="text-xs text-slate-400">
                Deixe as datas em branco para exportar todos os registros.
              </p>
            )}

            {/* Erro */}
            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleExcel}
                disabled={loading}
                className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Gerando..." : "↓ Baixar Excel"}
              </button>
              <button
                type="button"
                onClick={handlePdf}
                disabled={loading}
                className="flex-1 rounded-xl bg-[#1A3A5C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#15314d] disabled:opacity-50"
              >
                {loading ? "Gerando..." : "↓ Baixar PDF"}
              </button>
            </div>
          </div>
        </div>

        {/* Legenda dos relatórios */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            O que cada relatório contém
          </p>
          <ul className="space-y-2">
            {REPORT_TYPES.map((r) => (
              <li key={r.value} className="flex items-start gap-2 text-sm text-slate-600">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    r.hasPeriod
                      ? "bg-slate-100 text-slate-500"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {r.hasPeriod ? "período" : "geral"}
                </span>
                <span>
                  <strong className="text-slate-800">{r.label}</strong>
                  {r.value === "moradores" && " — nome, e-mail, unidade e bloco de todos os moradores ativos"}
                  {r.value === "cobrancas" && " — todas as cobranças com valor, vencimento e status de pagamento"}
                  {r.value === "inadimplencia" && " — cobranças com status ATRASADO, agrupadas por unidade"}
                  {r.value === "entregas" && " — registro de encomendas recebidas e retiradas"}
                  {r.value === "ocorrencias" && " — reclamações e incidentes registrados no condomínio"}
                  {r.value === "reservas" && " — solicitações de salão com status e horários"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
