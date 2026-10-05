import type { ReactNode } from "react";
import DashboardSidebar from "./sidebar";
import AssistenteWidget from "@/components/AssistenteWidget";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <DashboardSidebar />
      <main className="ml-0 min-w-0 flex-1 overflow-x-hidden pt-16 lg:ml-72 lg:pt-0">{children}</main>
      <AssistenteWidget />
    </div>
  );
}
