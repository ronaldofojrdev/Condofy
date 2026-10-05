"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type BackofficeRole = "ADMIN" | "IMPLEMENTACAO" | "COMERCIAL" | "FINANCEIRO" | "JURIDICO" | "DEV";

type NavItem = {
  label: string;
  href: string;
  soon?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAVIGATION: Record<BackofficeRole, NavGroup[]> = {
  ADMIN: [
    { label: "", items: [{ label: "Dashboard", href: "/dashboard" }] },
    {
      label: "Clientes",
      items: [
        { label: "Condomínios", href: "/dashboard/condominios" },
        { label: "Onboarding", href: "/dashboard/onboarding" },
      ],
    },
    {
      label: "Comercial",
      items: [{ label: "Leads", href: "/dashboard/leads" }],
    },
    {
      label: "Financeiro",
      items: [{ label: "Receita", href: "/dashboard/receita" }],
    },
    {
      label: "Jurídico",
      items: [
        { label: "Contratos", href: "/dashboard/contratos" },
        { label: "LGPD", href: "/dashboard/lgpd" },
      ],
    },
    {
      label: "Dev",
      items: [
        { label: "Monitoramento", href: "/dashboard/monitoramento", soon: true },
        { label: "Feature Flags", href: "/dashboard/feature-flags" },
      ],
    },
    {
      label: "Equipe",
      items: [
        { label: "Colaboradores", href: "/dashboard/equipe" },
        { label: "Auditoria", href: "/dashboard/auditoria" },
      ],
    },
  ],
  IMPLEMENTACAO: [
    { label: "", items: [{ label: "Dashboard", href: "/dashboard" }] },
    {
      label: "Clientes",
      items: [
        { label: "Condomínios", href: "/dashboard/condominios" },
        { label: "Onboarding", href: "/dashboard/onboarding" },
      ],
    },
  ],
  COMERCIAL: [
    { label: "", items: [{ label: "Dashboard", href: "/dashboard" }] },
    {
      label: "Vendas",
      items: [{ label: "Leads", href: "/dashboard/leads" }],
    },
  ],
  FINANCEIRO: [
    { label: "", items: [{ label: "Dashboard", href: "/dashboard" }] },
    {
      label: "Financeiro",
      items: [
        { label: "Clientes", href: "/dashboard/clientes", soon: true },
        { label: "Receita", href: "/dashboard/receita" },
      ],
    },
  ],
  JURIDICO: [
    { label: "", items: [{ label: "Dashboard", href: "/dashboard" }] },
    {
      label: "Jurídico",
      items: [
        { label: "Contratos", href: "/dashboard/contratos" },
        { label: "LGPD", href: "/dashboard/lgpd" },
      ],
    },
  ],
  DEV: [
    { label: "", items: [{ label: "Dashboard", href: "/dashboard" }] },
    {
      label: "Plataforma",
      items: [
        { label: "Monitoramento", href: "/dashboard/monitoramento", soon: true },
        { label: "Feature Flags", href: "/dashboard/feature-flags" },
        { label: "Métricas", href: "/dashboard/metricas", soon: true },
      ],
    },
  ],
};

const ROLE_LABELS: Record<BackofficeRole, string> = {
  ADMIN: "Admin",
  IMPLEMENTACAO: "Implementação",
  COMERCIAL: "Comercial",
  FINANCEIRO: "Financeiro",
  JURIDICO: "Jurídico",
  DEV: "Dev",
};

const ROLE_COLORS: Record<BackofficeRole, string> = {
  ADMIN: "bg-red-500/20 text-red-300",
  IMPLEMENTACAO: "bg-blue-500/20 text-blue-300",
  COMERCIAL: "bg-violet-500/20 text-violet-300",
  FINANCEIRO: "bg-emerald-500/20 text-emerald-300",
  JURIDICO: "bg-amber-500/20 text-amber-300",
  DEV: "bg-teal-500/20 text-teal-300",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<BackofficeRole | null>(null);
  const [nome, setNome] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("backoffice_colaboradores")
        .select("nome, role")
        .eq("usuario_id", user.id)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (data) {
        setNome(data.nome);
        setRole(data.role as BackofficeRole);
      }
    }
    void load();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navGroups = role ? NAVIGATION[role] : [];

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div className="h-7 w-7 rounded-lg bg-[#1A3A5C] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4">
            <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold text-white leading-none">Condofy</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">BACKOFFICE</p>
        </div>
      </div>

      {/* Perfil */}
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-semibold text-white truncate">{nome || "..."}</p>
        {role && (
          <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[role]}`}>
            {ROLE_LABELS[role]}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "pt-4" : ""}>
            {group.label && (
              <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href;
              if (item.soon) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center justify-between rounded-lg px-3 py-2 cursor-default"
                  >
                    <span className="text-xs font-medium text-slate-600">{item.label}</span>
                    <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                      em breve
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center rounded-lg px-3 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sair */}
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-300 text-left"
        >
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-[#1A3A5C] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="h-3.5 w-3.5">
              <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-900">Backoffice</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="h-8 w-8 flex flex-col items-center justify-center gap-1.5 rounded-lg"
          aria-label="Menu"
        >
          <span className="h-px w-4 bg-slate-600" />
          <span className="h-px w-4 bg-slate-600" />
          <span className="h-px w-4 bg-slate-600" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col">
        <div className="fixed top-0 h-screen w-56">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
