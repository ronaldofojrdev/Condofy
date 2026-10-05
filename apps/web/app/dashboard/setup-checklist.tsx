import Link from "next/link";

type SetupChecklistProps = {
  condominioConfigured: boolean;
  hasPorteiro: boolean;
  hasMorador: boolean;
};

type ChecklistStep = {
  label: string;
  done: boolean;
  href?: string;
};

export default function SetupChecklist({
  condominioConfigured,
  hasPorteiro,
  hasMorador
}: SetupChecklistProps) {
  const steps: ChecklistStep[] = [
    { label: "Conta criada", done: true },
    { label: "Configure seu condomínio", done: condominioConfigured, href: "/dashboard/condominio" },
    { label: "Adicione um porteiro", done: hasPorteiro, href: "/dashboard/porteiros" },
    { label: "Convide o primeiro morador", done: hasMorador, href: "/dashboard/moradores" }
  ];

  const completedCount = steps.filter((step) => step.done).length;

  if (completedCount === steps.length) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-[#1A3A5C]/15 bg-white p-6 shadow-sm ring-1 ring-[#1A3A5C]/5 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1A3A5C]">Primeiros passos</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Finalize a configuração inicial</h2>
          <p className="mt-2 text-sm text-slate-600">
            {completedCount} de {steps.length} concluído
          </p>
        </div>

        <div className="w-full max-w-sm rounded-full bg-slate-100 p-1">
          <div
            className="h-2 rounded-full bg-[#1A3A5C] transition-all"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  step.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                }`}
              >
                {step.done ? "✓" : ""}
              </span>
              <span className={`text-sm font-medium ${step.done ? "text-slate-500 line-through" : "text-slate-800"}`}>
                {step.label}
              </span>
            </div>

            {step.href && !step.done ? (
              <Link href={step.href} className="text-sm font-medium text-[#1A3A5C] hover:underline">
                Ir agora
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}