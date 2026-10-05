export const dynamic = "force-dynamic";

import Sidebar from "./sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-56">
        {children}
      </main>
    </div>
  );
}
