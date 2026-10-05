import Link from "next/link";

export const metadata = {
  title: "Termos de Uso | Condofy",
  description: "Termos de uso da Condofy para utilização da plataforma SaaS de gestão de condomínios."
};

export default function TermosDeUsoPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <Link href="/" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
            ← Voltar para a página inicial
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">Termos de Uso</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Estes Termos regulam o acesso e o uso da plataforma Condofy, um SaaS brasileiro para gestão de condomínios, seus
            recursos, responsabilidades, condições de contratação e limitações aplicáveis ao serviço.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Objeto do serviço</h2>
          <p className="mt-4 leading-7 text-slate-600">
            A Condofy disponibiliza uma plataforma online para apoio à administração de condomínios, incluindo funcionalidades
            como cadastro de unidades e moradores, portaria digital, reservas de espaços, avisos, registros operacionais e
            relatórios administrativos.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Responsabilidades do usuário</h2>
          <p className="mt-4 leading-7 text-slate-600">
            O usuário se compromete a fornecer informações verdadeiras, manter a confidencialidade de suas credenciais, usar a
            plataforma em conformidade com a lei e zelar pela correta gestão dos dados inseridos. É vedado utilizar a plataforma
            para fins ilícitos, ofensivos ou que prejudiquem terceiros.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Cancelamento</h2>
          <p className="mt-4 leading-7 text-slate-600">
            O plano pode ser cancelado a qualquer momento, observadas as condições contratadas. Após o cancelamento, o acesso
            poderá ser mantido até o fim do ciclo vigente, sem prejuízo das obrigações já vencidas e dos dados que precisem ser
            preservados por obrigação legal.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Pagamento</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Os valores, periodicidade, tributos e eventuais reajustes são informados na contratação ou na proposta comercial.
            A inadimplência poderá resultar em suspensão parcial ou total do acesso, conforme previsto no plano contratado e na
            legislação aplicável.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Limitação de responsabilidade</h2>
          <p className="mt-4 leading-7 text-slate-600">
            A Condofy envida esforços razoáveis para manter a disponibilidade e a segurança da plataforma, mas não se
            responsabiliza por indisponibilidades causadas por terceiros, falhas de internet, mau uso da conta, informações
            inseridas incorretamente pelo usuário ou eventos fora de seu controle razoável.
          </p>
        </article>
      </section>
    </main>
  );
}