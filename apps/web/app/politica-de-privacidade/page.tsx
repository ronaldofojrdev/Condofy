import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade | Condofy",
  description: "Política de privacidade da Condofy para tratamento de dados pessoais em conformidade com a LGPD."
};

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <Link href="/" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
            ← Voltar para a página inicial
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Esta Política de Privacidade descreve como a Condofy Tecnologia trata dados pessoais ao disponibilizar sua plataforma
            SaaS para gestão de condomínios, em conformidade com a Lei nº 13.709/2018 (LGPD) e demais normas aplicáveis.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Dados coletados</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Podemos coletar dados fornecidos pelo usuário no cadastro e uso da plataforma, como nome, e-mail, telefone,
            unidade, bloco, perfil de acesso, registros de reservas, entregas, comunicados, ocorrências e demais informações
            inseridas voluntariamente no sistema. Também podemos coletar dados técnicos de navegação, como IP, data e hora de acesso,
            navegador, sistema operacional e identificadores de sessão.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Uso dos dados</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Os dados pessoais são utilizados para autenticação, administração de condomínios, gestão de moradores e unidades,
            controle de reservas, entregas, comunicados, suporte ao cliente, prevenção a fraudes, manutenção da segurança da
            plataforma, melhoria de funcionalidades e cumprimento de obrigações legais ou regulatórias.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Cookies</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Utilizamos cookies e tecnologias semelhantes para manter sessões autenticadas, lembrar preferências, melhorar a
            experiência de navegação e analisar desempenho da plataforma. O usuário pode ajustar as configurações do navegador
            para bloquear cookies, mas algumas funcionalidades podem não funcionar corretamente.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Direitos do titular</h2>
          <p className="mt-4 leading-7 text-slate-600">
            O titular dos dados pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação,
            portabilidade, informação sobre compartilhamento e revogação do consentimento, quando aplicável, observadas as bases
            legais e os prazos previstos em lei.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">Contato</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Para exercer seus direitos, esclarecer dúvidas ou falar com o encarregado pelo tratamento de dados pessoais, entre em
            contato pelo e-mail <a href="mailto:contato@condofy.com.br" className="font-semibold text-blue-600 hover:text-blue-700">contato@condofy.com.br</a>.
          </p>
        </article>
      </section>
    </main>
  );
}