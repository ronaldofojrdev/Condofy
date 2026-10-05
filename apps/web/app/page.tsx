"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DEMO_LINK =
  "https://wa.me/5500000000000?text=Olá%2C+gostaria+de+agendar+uma+demonstração+do+Condofy.";

const MODULES = [
  {
    name: "Cadastro e Unidades",
    profile: ["Síndico"],
    description:
      "Estrutura hierárquica do condomínio: blocos, unidades e moradores. Controle de status por unidade, histórico de ocupação e cadastro de veículos vinculados.",
  },
  {
    name: "Portaria Digital",
    profile: ["Síndico", "Porteiro"],
    description:
      "Registro de encomendas com notificação automática ao morador, controle de entrada e saída de visitantes e consulta de moradores por unidade. Substituição completa do caderno físico.",
  },
  {
    name: "Módulo Financeiro",
    profile: ["Síndico", "Morador"],
    description:
      "Lançamento de cobranças individuais ou em lote, controle de status (pendente, pago, atrasado), painel de inadimplência consolidado e extrato individual acessível pelo morador.",
  },
  {
    name: "Comunicação",
    profile: ["Síndico", "Morador"],
    description:
      "Mural de avisos com publicação para todo o condomínio ou por unidade específica. Notificação automática a cada novo comunicado. Histórico completo de avisos publicados.",
  },
  {
    name: "Enquetes e Votações",
    profile: ["Síndico", "Morador"],
    description:
      "Criação de enquetes com prazo configurável, votação individual por morador e apuração automática do resultado ao encerramento do prazo.",
  },
  {
    name: "Reservas de Espaços",
    profile: ["Síndico", "Morador"],
    description:
      "Cadastro de áreas comuns (salão, churrasqueira, academia), solicitação de reserva pelo morador, aprovação ou recusa pelo síndico e histórico completo de reservas.",
  },
  {
    name: "Ocorrências",
    profile: ["Síndico", "Morador"],
    description:
      "Canal estruturado para registro de reclamações e incidentes. Categorização por tipo, opção de anonimato, acompanhamento de status e histórico por condomínio.",
  },
  {
    name: "Documentos",
    profile: ["Síndico", "Morador"],
    description:
      "Biblioteca digital de documentos do condomínio: convenção, regulamento interno, atas e comunicados formais. Acessível a todos os moradores.",
  },
  {
    name: "Manutenção Preventiva",
    profile: ["Síndico"],
    description:
      "Calendário de manutenções programadas com data prevista e alertas de vencimento. Registro do histórico de manutenções concluídas.",
  },
  {
    name: "Relatórios",
    profile: ["Síndico"],
    description:
      "Exportação de relatórios em Excel e PDF: moradores ativos, cobranças por período, inadimplência, entregas, ocorrências e reservas. Filtrável por período.",
  },
];

const FAQS = [
  {
    q: "Como funciona o processo de implementação?",
    a: "A implementação é conduzida pela nossa equipe. Um consultor configura o ambiente junto ao síndico: blocos, unidades e acessos. Não há necessidade de TI interno. O processo leva em média uma sessão de trabalho.",
  },
  {
    q: "Os moradores precisam criar conta ou instalar aplicativo?",
    a: "Não. O síndico cadastra os moradores no sistema, definindo e-mail e senha. O acesso é feito pelo navegador, sem confirmação de e-mail e sem instalação de aplicativo.",
  },
  {
    q: "Como funciona o controle de acesso entre os perfis?",
    a: "Cada perfil tem acesso apenas aos módulos pertinentes à sua função. O síndico tem visão e controle total. O porteiro acessa os módulos operacionais da portaria. O morador acessa somente dados e serviços vinculados à sua unidade.",
  },
  {
    q: "O sistema suporta condomínios com múltiplos blocos?",
    a: "Sim. A plataforma suporta múltiplos blocos e torres com organização hierárquica. O plano Pro é indicado para condomínios de maior porte.",
  },
  {
    q: "Como os dados são protegidos?",
    a: "O sistema opera com autenticação segura, banco de dados com políticas de controle de acesso por linha (RLS) e hospedagem com backups automáticos. Tratamento de dados em conformidade com a LGPD.",
  },
  {
    q: "É possível cancelar a qualquer momento?",
    a: "Sim. Não há contrato de fidelidade, multa ou carência.",
  },
];

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0Z" />
    </svg>
  );
}

function ProductScreenshot() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60">
      {/* browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        <span className="ml-3 flex-1 rounded-md bg-white px-3 py-1.5 text-[11px] text-slate-400 shadow-sm ring-1 ring-slate-200/80">
          app.condofy.com.br/dashboard
        </span>
      </div>
      {/* app ui */}
      <div className="flex" style={{ minHeight: 340 }}>
        {/* sidebar */}
        <aside className="w-44 shrink-0 border-r border-slate-100 bg-[#f8fafc] py-5">
          <div className="px-4 pb-4">
            <img src="/logo.png" alt="Condofy" className="h-5 w-auto opacity-80" />
          </div>
          <div className="px-3">
            <p className="px-2 pb-1.5 pt-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              Principal
            </p>
            {["Dashboard", "Moradores", "Financeiro"].map((item, i) => (
              <div
                key={item}
                className={`mb-0.5 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
                  i === 0
                    ? "bg-[#1A3A5C] text-white"
                    : "text-slate-500"
                }`}
              >
                {item}
              </div>
            ))}
            <p className="px-2 pb-1.5 pt-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              Operação
            </p>
            {["Portaria", "Reservas", "Ocorrências", "Documentos"].map((item) => (
              <div key={item} className="mb-0.5 rounded-lg px-2.5 py-2 text-[11px] font-medium text-slate-500">
                {item}
              </div>
            ))}
          </div>
        </aside>
        {/* main */}
        <main className="flex-1 bg-[#f8fafc] p-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Síndico</p>
              <h3 className="mt-0.5 text-base font-bold text-slate-900">Visão geral</h3>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-100">
              3 ações pendentes
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { l: "Unidades", v: "48" },
              { l: "Inadimplentes", v: "3" },
              { l: "Entregas", v: "7" },
              { l: "Reservas", v: "2" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[9px] text-slate-400">{s.l}</p>
                <p className="mt-1 text-xl font-bold text-[#1A3A5C]">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Cobranças em atraso</p>
              {["Apto 204 · R$ 450,00", "Apto 312 · R$ 900,00", "Apto 108 · R$ 450,00"].map((item) => (
                <div key={item} className="mb-1.5 flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2">
                  <span className="text-[10px] text-slate-700">{item}</span>
                  <span className="text-[9px] font-semibold text-rose-600">Atrasado</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Entregas recentes</p>
              {[
                { apt: "Apto 101", rem: "Correios" },
                { apt: "Apto 203", rem: "Amazon" },
                { apt: "Apto 305", rem: "Mercado Livre" },
              ].map((d) => (
                <div key={d.apt} className="mb-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[10px] text-slate-700">{d.apt} · {d.rem}</span>
                  <span className="text-[9px] font-semibold text-amber-600">Aguardando</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 4);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">

      {/* ─── Navbar ────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 bg-white transition-all duration-200 ${
          scrolled ? "border-b border-slate-200 shadow-sm" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="/" className="shrink-0">
            <img src="/logo.png" alt="Condofy" className="h-7 w-auto" />
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {[
              { label: "Plataforma", href: "#plataforma" },
              { label: "Módulos", href: "#modulos" },
              { label: "Planos", href: "#planos" },
              { label: "FAQ", href: "#faq" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-slate-500 transition hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/login"
              className="text-sm text-slate-500 transition hover:text-slate-900"
            >
              Acessar
            </Link>
            <a
              href={DEMO_LINK}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-[#1A3A5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15314d]"
            >
              Agendar demonstração
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg md:hidden"
            aria-label="Menu"
          >
            <span className="h-px w-5 bg-slate-600" />
            <span className="h-px w-5 bg-slate-600" />
            <span className="h-px w-5 bg-slate-600" />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-100 bg-white px-6 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {["Plataforma", "Módulos", "Planos", "FAQ"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {item}
                </a>
              ))}
              <div className="mt-2 border-t border-slate-100 pt-3">
                <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm text-slate-600">
                  Acessar plataforma
                </Link>
                <a
                  href={DEMO_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block rounded-lg bg-[#1A3A5C] px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Agendar demonstração
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─── Hero ──────────────────────────────────────────── */}
      <section className="border-b border-slate-100 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 lg:text-5xl lg:leading-tight">
              Plataforma de gestão condominial para síndicos, porteiros e moradores
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500">
              O Condofy centraliza moradores, portaria, financeiro, comunicados e reservas em um único sistema web. Sem aplicativo para instalar, sem planilha, sem papel.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href={DEMO_LINK}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[#1A3A5C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#15314d]"
              >
                Agendar demonstração
              </a>
              <a
                href="#modulos"
                className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Ver módulos da plataforma
              </a>
            </div>
          </div>
          <ProductScreenshot />
        </div>
      </section>

      {/* ─── Visão geral ───────────────────────────────────── */}
      <section id="plataforma" className="border-b border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
            {/* Síndico */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Para o síndico
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-500">
                O síndico tem acesso à plataforma completa: cadastros, financeiro, comunicação, portaria, relatórios e configuração de espaços. O painel central exibe métricas em tempo real e alertas de ações pendentes.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Visão geral do condomínio com métricas em tempo real",
                  "Gestão de moradores, porteiros e unidades",
                  "Controle financeiro com painel de inadimplência",
                  "Aprovação de reservas e gestão de ocorrências",
                  "Exportação de relatórios em Excel e PDF",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A3A5C]/10 text-[#1A3A5C]">
                      <CheckIcon />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Porteiro + Morador */}
            <div className="space-y-10">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Para o porteiro
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-500">
                  Painel simplificado focado nas operações de portaria. Registro de encomendas, controle de visitantes e consulta de moradores. Sem papel.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    "Registro de encomendas com notificação ao morador",
                    "Controle de entrada e saída de visitantes",
                    "Consulta de moradores e veículos por unidade",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A3A5C]/10 text-[#1A3A5C]">
                        <CheckIcon />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Para o morador
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-500">
                  Acesso pelo navegador, sem instalação. O morador visualiza avisos, acompanha entregas, consulta extratos, solicita reservas e registra ocorrências.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    "Painel pessoal com cobranças e entregas",
                    "Solicitação e acompanhamento de reservas",
                    "Registro de ocorrências e comunicação com o síndico",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A3A5C]/10 text-[#1A3A5C]">
                        <CheckIcon />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Módulos ───────────────────────────────────────── */}
      <section id="modulos" className="border-b border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Módulos da plataforma
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-500">
              Cada área do condomínio tem um módulo dedicado. Todos os módulos estão incluídos. O acesso de cada perfil é definido conforme a função.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Módulo
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Descrição
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Perfis
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {MODULES.map((mod) => (
                  <tr key={mod.name} className="transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                      {mod.name}
                    </td>
                    <td className="px-6 py-4 text-sm leading-6 text-slate-500">
                      {mod.description}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {mod.profile.map((p) => (
                          <span
                            key={p}
                            className="inline-block rounded-full bg-[#1A3A5C]/8 px-2.5 py-0.5 text-xs font-medium text-[#1A3A5C]"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Implementação ─────────────────────────────────── */}
      <section className="border-b border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Processo de implementação
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-500">
              A implementação é conduzida pela nossa equipe, sem necessidade de TI interno ou treinamento prolongado.
            </p>
          </div>

          <div className="grid gap-px bg-slate-200 rounded-xl overflow-hidden lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "Demonstração",
                text: "Apresentação da plataforma e levantamento das necessidades do condomínio: porte, blocos, processos e perfis envolvidos.",
              },
              {
                n: "02",
                title: "Configuração",
                text: "Nossa equipe configura o ambiente: estrutura de blocos e unidades, espaços comuns e acessos iniciais do síndico e porteiros.",
              },
              {
                n: "03",
                title: "Cadastro de moradores",
                text: "O síndico cadastra os moradores diretamente no sistema, definindo credenciais de acesso. Sem fluxo de convite ou confirmação.",
              },
              {
                n: "04",
                title: "Operação",
                text: "O condomínio entra em operação. Suporte disponível para acompanhar o período inicial e responder dúvidas ao longo do uso.",
              },
            ].map((item) => (
              <div key={item.n} className="bg-white p-8">
                <p className="text-3xl font-bold text-slate-100">{item.n}</p>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Planos ────────────────────────────────────────── */}
      <section id="planos" className="border-b border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Planos</h2>
            <p className="mt-3 max-w-2xl text-base text-slate-500">
              Todos os planos incluem implementação assistida, acesso a todos os módulos e suporte. Sem contrato de fidelidade.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Plano
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Capacidade
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Valor mensal
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Diferenciais
                  </th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {[
                  {
                    name: "Essencial",
                    cap: "Até 40 unidades",
                    price: "R$ 97/mês",
                    diff: "Operação completa para condomínios menores",
                    highlight: false,
                  },
                  {
                    name: "Crescimento",
                    cap: "Até 100 unidades",
                    price: "R$ 167/mês",
                    diff: "Relatórios, módulo financeiro e suporte WhatsApp",
                    highlight: true,
                  },
                  {
                    name: "Pro",
                    cap: "Até 200 unidades",
                    price: "R$ 267/mês",
                    diff: "Múltiplos blocos e prioridade no suporte",
                    highlight: false,
                  },
                ].map((plan) => (
                  <tr
                    key={plan.name}
                    className={plan.highlight ? "bg-[#1A3A5C]/[0.03]" : ""}
                  >
                    <td className="px-6 py-5">
                      <span className="text-sm font-semibold text-slate-900">{plan.name}</span>
                      {plan.highlight && (
                        <span className="ml-2 rounded-full bg-[#1A3A5C] px-2 py-0.5 text-[10px] font-semibold text-white">
                          Mais contratado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">{plan.cap}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-900">{plan.price}</td>
                    <td className="px-6 py-5 text-sm text-slate-500">{plan.diff}</td>
                    <td className="px-6 py-5 text-right">
                      <a
                        href={DEMO_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-[#1A3A5C] hover:underline"
                      >
                        Falar com consultor
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────── */}
      <section id="faq" className="border-b border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-16 lg:grid-cols-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Perguntas frequentes
              </h2>
              <p className="mt-3 text-base text-slate-500">
                Dúvidas sobre a plataforma e o processo de implementação.
              </p>
              <div className="mt-8">
                <a
                  href={DEMO_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-[#1A3A5C] hover:underline"
                >
                  Falar com nossa equipe
                </a>
              </div>
            </div>

            <div className="lg:col-span-2">
              <dl className="divide-y divide-slate-100">
                {FAQS.map((item, i) => (
                  <div key={item.q} className="py-5">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full items-start justify-between gap-6 text-left"
                    >
                      <span className="text-sm font-semibold text-slate-900">{item.q}</span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                          openFaq === i ? "rotate-180" : ""
                        }`}
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    {openFaq === i && (
                      <p className="mt-3 text-sm leading-7 text-slate-500">{item.a}</p>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────── */}
      <section className="border-b border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl bg-[#1A3A5C] px-10 py-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Pronto para modernizar a gestão do seu condomínio?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
              Agende uma demonstração. Nossa equipe apresenta a plataforma e define o plano de implementação adequado ao seu condomínio.
            </p>
            <a
              href={DEMO_LINK}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block rounded-lg bg-white px-7 py-3 text-sm font-semibold text-[#1A3A5C] transition hover:bg-slate-100"
            >
              Agendar demonstração
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────── */}
      <footer className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <img src="/logo.png" alt="Condofy" className="h-6 w-auto" />
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Plataforma de gestão condominial para síndicos, porteiros e moradores de condomínios residenciais.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Produto</p>
                <ul className="mt-4 space-y-2.5">
                  {[
                    { label: "Plataforma", href: "#plataforma" },
                    { label: "Módulos", href: "#modulos" },
                    { label: "Planos", href: "#planos" },
                    { label: "FAQ", href: "#faq" },
                  ].map((item) => (
                    <li key={item.label}>
                      <a href={item.href} className="text-sm text-slate-500 transition hover:text-slate-900">
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Acesso</p>
                <ul className="mt-4 space-y-2.5">
                  <li>
                    <Link href="/login" className="text-sm text-slate-500 transition hover:text-slate-900">
                      Entrar na plataforma
                    </Link>
                  </li>
                  <li>
                    <a href={DEMO_LINK} target="_blank" rel="noreferrer" className="text-sm text-slate-500 transition hover:text-slate-900">
                      Agendar demonstração
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Legal</p>
                <ul className="mt-4 space-y-2.5">
                  <li>
                    <Link href="/politica-de-privacidade" className="text-sm text-slate-500 transition hover:text-slate-900">
                      Política de Privacidade
                    </Link>
                  </li>
                  <li>
                    <Link href="/termos-de-uso" className="text-sm text-slate-500 transition hover:text-slate-900">
                      Termos de Uso
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-1 border-t border-slate-100 pt-8 text-xs text-slate-400 sm:flex-row sm:justify-between">
            <p>© 2026 Condofy Tecnologia · CNPJ 60.074.758/0001-04</p>
            <p>Dados tratados em conformidade com a LGPD</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp flutuante */}
      <a
        href={DEMO_LINK}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com consultor"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1ebe5a]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.553 4.104 1.522 5.832L.054 23.447a.5.5 0 0 0 .607.607l5.653-1.476A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.655-.523-5.168-1.432l-.372-.22-3.853 1.006 1.028-3.758-.241-.386A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
        Falar com consultor
      </a>
    </div>
  );
}
