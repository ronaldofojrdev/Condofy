import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  condominio_id: string;
  role: "SINDICO" | "PORTEIRO" | "MORADOR";
};

type PatchBody = {
  status?: "ABERTA" | "EM_ANDAMENTO" | "RESOLVIDA";
  observacao_sindico?: string | null;
};

const STATUS_VALIDOS = ["ABERTA", "EM_ANDAMENTO", "RESOLVIDA"] as const;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  if (profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Apenas o síndico pode atualizar ocorrências." }, { status: 403 });
  }

  // Verificar que a ocorrência pertence ao condomínio do síndico
  const { data: ocorrencia, error: fetchError } = await supabaseAdmin
    .from("ocorrencias")
    .select("id, condominio_id, reporter_id, anonima, status, tipo")
    .eq("id", params.id)
    .single<{ id: string; condominio_id: string; reporter_id: string; anonima: boolean; status: string; tipo: string }>();

  if (fetchError || !ocorrencia || ocorrencia.condominio_id !== profile.condominio_id) {
    return NextResponse.json({ error: "Ocorrência não encontrada." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const newStatus = body?.status;
  const observacao = body?.observacao_sindico?.trim() ?? null;

  if (newStatus && !STATUS_VALIDOS.includes(newStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (newStatus) updatePayload.status = newStatus;
  if (observacao !== undefined) updatePayload.observacao_sindico = observacao;

  const { error: updateError } = await supabaseAdmin
    .from("ocorrencias")
    .update(updatePayload)
    .eq("id", params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  // Notificação in-app (fire-and-forget)
  if (newStatus && !ocorrencia.anonima) {
    const STATUS_LABELS_NOTIF: Record<string, string> = {
      ABERTA: "Aberta",
      EM_ANDAMENTO: "Em andamento",
      RESOLVIDA: "Resolvida"
    };
    void supabaseAdmin.from("notificacoes").insert({
      usuario_id: ocorrencia.reporter_id,
      tipo: "OCORRENCIA",
      titulo: `Ocorrência ${STATUS_LABELS_NOTIF[newStatus] ?? newStatus}`,
      mensagem: observacao
        ? `Status atualizado pelo síndico. Observação: ${observacao}`
        : "O síndico atualizou o status da sua ocorrência.",
    });
  }

  // Notificar morador da atualização por email (exceto se anônima)
  if (newStatus && !ocorrencia.anonima) {
    void (async () => {
      try {
        const brevoApiKey = process.env.BREVO_API_KEY ?? "";
        if (!brevoApiKey) return;

        const { data: reporter } = await supabaseAdmin
          .from("usuarios")
          .select("email, nome")
          .eq("id", ocorrencia.reporter_id)
          .single<{ email: string; nome: string }>();

        if (!reporter?.email) return;

        const STATUS_LABELS: Record<string, string> = {
          ABERTA: "🔴 Aberta",
          EM_ANDAMENTO: "🟡 Em andamento",
          RESOLVIDA: "✅ Resolvida"
        };

        const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;

        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoApiKey, "content-type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Condofy", email: "suportecondofy@gmail.com" },
            to: [{ email: reporter.email, name: reporter.nome }],
            subject: `Ocorrência atualizada — ${statusLabel}`,
            htmlContent: `<p>Olá ${reporter.nome}!</p><p>O síndico atualizou o status da sua ocorrência para <strong>${statusLabel}</strong>.</p>${observacao ? `<p><strong>Observação do síndico:</strong> ${observacao}</p>` : ""}<p>Acesse o Condofy para acompanhar.</p>`
          })
        }).catch(() => {});
      } catch (err) {
        console.error("[api/ocorrencias/[id]] Erro ao notificar morador:", err);
      }
    })();
  }

  return NextResponse.json({ ok: true });
}
