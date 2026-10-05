"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import NotificationBell from "./notification-bell";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type SidebarProfile = {
  role: DashboardRole;
};

type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// Flat map of all href → label used to derive the active page title
const ALL_NAV_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/unidades": "Unidades",
  "/dashboard/moradores": "Moradores",
  "/dashboard/porteiros": "Porteiros",
  "/dashboard/avisos": "Mural de Avisos",
  "/dashboard/entregas": "Entregas",
  "/dashboard/entregas/registrar": "Registrar Entrega",
  "/dashboard/salao": "Salão de Festas",
  "/dashboard/salao/minhas-reservas": "Reservas",
  "/dashboard/salao/gerenciar": "Gerenciar Salões",
  "/dashboard/financeiro": "Financeiro",
  "/dashboard/financeiro/lancar": "Lançar Cobrança",
  "/dashboard/financeiro/meu-extrato": "Meu Extrato",
  "/dashboard/financeiro/relatorio": "Relatório",
  "/dashboard/financeiro/inadimplentes": "Inadimplência",
  "/dashboard/minhas-entregas": "Minhas Entregas",
  "/dashboard/configuracoes": "Configurações",
  "/dashboard/configuracoes/senha": "Alterar Senha",
  "/dashboard/assistente": "Assistente IA",
  "/dashboard/ocorrencias": "Ocorrências",
  "/dashboard/minhas-ocorrencias": "Minhas Ocorrências",
  "/dashboard/veiculos": "Veículos",
  "/dashboard/veiculos/registrar": "Registrar Veículo",
  "/dashboard/meus-veiculos": "Meus Veículos",
  "/dashboard/visitantes": "Visitantes",
  "/dashboard/visitantes/registrar": "Registrar Visita",
  "/dashboard/minhas-visitas": "Minhas Visitas",
  "/dashboard/porteiro": "Painel de Controle",
  "/dashboard/enquetes": "Enquetes",
  "/dashboard/enquetes/nova": "Nova Enquete",
  "/dashboard/documentos": "Documentos",
  "/dashboard/manutencoes": "Manutenção Preventiva",
  "/dashboard/morador": "Meu Painel",
  "/dashboard/relatorios": "Relatórios"
};

const NAVIGATION: Record<DashboardRole, NavGroup[]> = {
  SINDICO: [
    {
      label: "",
      items: [
        { label: "Dashboard", href: "/dashboard" }
      ]
    },
    {
      label: "Condomínio",
      items: [
        { label: "Unidades", href: "/dashboard/unidades" },
        { label: "Moradores", href: "/dashboard/moradores" },
        { label: "Porteiros", href: "/dashboard/porteiros" },
        { label: "Ocorrências", href: "/dashboard/ocorrencias" }
      ]
    },
    {
      label: "Comunicação",
      items: [
        { label: "Mural de Avisos", href: "/dashboard/avisos" },
        { label: "Enquetes", href: "/dashboard/enquetes" },
        { label: "Documentos", href: "/dashboard/documentos" }
      ]
    },
    {
      label: "Portaria",
      items: [
        { label: "Entregas", href: "/dashboard/entregas" },
        { label: "Registrar Entrega", href: "/dashboard/entregas/registrar" },
        { label: "Salão de Festas", href: "/dashboard/salao" },
        { label: "Reservas do Salão", href: "/dashboard/salao/minhas-reservas" },
        { label: "Visitantes", href: "/dashboard/visitantes" },
        { label: "Registrar Visita", href: "/dashboard/visitantes/registrar" },
        { label: "Veículos", href: "/dashboard/veiculos" },
        { label: "Registrar Veículo", href: "/dashboard/veiculos/registrar" }
      ]
    },
    {
      label: "Financeiro",
      items: [
        { label: "Painel Financeiro", href: "/dashboard/financeiro" },
        { label: "Lançar Cobrança", href: "/dashboard/financeiro/lancar" },
        { label: "Relatório", href: "/dashboard/financeiro/relatorio" },
        { label: "Inadimplência", href: "/dashboard/financeiro/inadimplentes" }
      ]
    },
    {
      label: "Gestão",
      items: [
        { label: "Manutenção", href: "/dashboard/manutencoes" },
        { label: "Relatórios", href: "/dashboard/relatorios" }
      ]
    },
    {
      label: "Sistema",
      items: [
        { label: "Configurações", href: "/dashboard/configuracoes" },
        { label: "Assistente IA", href: "/dashboard/assistente" }
      ]
    }
  ],
  PORTEIRO: [
    {
      label: "",
      items: [
        { label: "Painel de Controle", href: "/dashboard/porteiro" }
      ]
    },
    {
      label: "Portaria",
      items: [
        { label: "Entregas", href: "/dashboard/entregas" },
        { label: "Registrar Entrega", href: "/dashboard/entregas/registrar" },
        { label: "Veículos", href: "/dashboard/veiculos" },
        { label: "Registrar Veículo", href: "/dashboard/veiculos/registrar" },
        { label: "Visitantes", href: "/dashboard/visitantes" },
        { label: "Registrar Visita", href: "/dashboard/visitantes/registrar" }
      ]
    },
    {
      label: "Comunicação",
      items: [
        { label: "Mural de Avisos", href: "/dashboard/avisos" }
      ]
    },
    {
      label: "Sistema",
      items: [
        { label: "Alterar Senha", href: "/dashboard/configuracoes/senha" }
      ]
    }
  ],
  MORADOR: [
    {
      label: "",
      items: [
        { label: "Meu Painel", href: "/dashboard/morador" }
      ]
    },
    {
      label: "Minha Área",
      items: [
        { label: "Minhas Entregas", href: "/dashboard/minhas-entregas" },
        { label: "Meu Extrato", href: "/dashboard/financeiro/meu-extrato" },
        { label: "Minhas Ocorrências", href: "/dashboard/minhas-ocorrencias" },
        { label: "Meus Veículos", href: "/dashboard/meus-veiculos" },
        { label: "Minhas Visitas", href: "/dashboard/minhas-visitas" }
      ]
    },
    {
      label: "Condomínio",
      items: [
        { label: "Mural de Avisos", href: "/dashboard/avisos" },
        { label: "Salão de Festas", href: "/dashboard/salao" },
        { label: "Minhas Reservas", href: "/dashboard/salao/minhas-reservas" },
        { label: "Enquetes", href: "/dashboard/enquetes" },
        { label: "Documentos", href: "/dashboard/documentos" }
      ]
    },
    {
      label: "Sistema",
      items: [
        { label: "Alterar Senha", href: "/dashboard/configuracoes/senha" }
      ]
    }
  ]
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadRole() {
      setLoadingRole(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setLoadingRole(false);
        setRole(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("perfis_usuario")
        .select("role")
        .eq("usuario_id", userData.user.id)
        .eq("ativo", true)
        .limit(1)
        .single<SidebarProfile>();

      if (profileError || !profile?.role) {
        setLoadingRole(false);
        setRole(null);
        return;
      }

      setRole(profile.role);
      setLoadingRole(false);
    }

    void loadRole();
  }, []);

  const navGroups = useMemo(() => {
    if (!role) return [];
    return NAVIGATION[role];
  }, [role]);

  // Auto-expand the group that contains the current page; collapses others
  useEffect(() => {
    if (!navGroups.length) return;
    const activeGroupLabel = navGroups.find((g) =>
      g.items.some((item) => item.href === pathname)
    )?.label ?? "";
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.add(activeGroupLabel);
      return next;
    });
  }, [pathname, navGroups]);

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href;
  }

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <img src="/logo.png" alt="Condofy" className="h-7 w-auto" />
          <h1 className="mt-1 truncate text-base font-semibold text-slate-900">
            {ALL_NAV_LABELS[pathname] ?? "Dashboard"}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell compact />
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sair
          </button>
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setIsOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
          >
            <span className="space-y-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <img src="/logo.png" alt="Condofy" className="h-8 w-auto" />
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {loadingRole ? "Carregando perfil..." : role ? `Perfil: ${role}` : "Perfil não encontrado"}
                </p>
              </div>

              <NotificationBell />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-1">
              {navGroups.map((group, groupIndex) => {
                const isGroupExpanded = expandedGroups.has(group.label);
                const hasActiveItem = group.items.some((item) => isActive(item.href));

                // Groups with no label (Dashboard) always show without a toggle
                if (!group.label) {
                  return (
                    <div key={groupIndex} className="mb-2">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMenu}
                          className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive(item.href)
                              ? "bg-[#1A3A5C] text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={groupIndex}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        hasActiveItem && !isGroupExpanded
                          ? "bg-[#1A3A5C]/10 text-[#1A3A5C]"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                        {group.label}
                      </span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isGroupExpanded ? "rotate-180" : ""}`}
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {isGroupExpanded && (
                      <div className="mt-0.5 space-y-0.5 pl-2">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeMenu}
                            className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                              isActive(item.href)
                                ? "bg-[#1A3A5C] text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      ) : null}
    </>
  );
}
