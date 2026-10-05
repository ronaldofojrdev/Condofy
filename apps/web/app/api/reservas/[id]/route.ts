import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type RequestBody = {
  status?: "APROVADO" | "REJEITADO" | "CANCELADO";
  motivo_rejeicao?: string | null;
};

type ReservaOwnershipRow = {
  id: string;
  status: string;
  solicitante_id: string;
  saloes: { condominio_id: string } | { condominio_id: string }[] | null;
};

type ReservaEmailRow = {
  data_reserva: string;
  horario_inicio: string;
  horario_fim: string;
  solicitante: { email: string; nome: string } | { email: string; nome: string }[] | null;
  salao: { nome: string } | { nome: string }[] | null;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("role, condominio_id")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Nenhum condomínio ativo encontrado para este usuário." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const status = body?.status;
  const motivoRejeicao = body?.motivo_rejeicao?.trim() ?? null;

  if (status !== "APROVADO" && status !== "REJEITADO" && status !== "CANCELADO") {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const { data: reserva, error: reservaError } = await supabaseAdmin
    .from("reservas_salao")
    .select("id, status, solicitante_id, saloes!inner(condominio_id)")
    .eq("id", params.id)
    .single<ReservaOwnershipRow>();

  if (reservaError || !reserva) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const salao = Array.isArray(reserva.saloes) ? reserva.saloes[0] ?? null : reserva.saloes;

  if (!salao || salao.condominio_id !== profile.condominio_id) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const isSindico = profile.role === "SINDICO";
  const isMoradorCancelingOwnReserva = profile.role === "MORADOR" && status === "CANCELADO";

  if (!isSindico && !isMoradorCancelingOwnReserva) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (isMoradorCancelingOwnReserva) {
    if (reserva.solicitante_id !== userData.user.id || reserva.status !== "PENDENTE") {
      return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
    }
  } else if (reserva.status === "CANCELADO") {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const updatePayload = {
    status,
    motivo_rejeicao: status === "REJEITADO" ? motivoRejeicao : null
  };

  const { error } = await supabaseAdmin
    .from("reservas_salao")
    .update(updatePayload)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    const { data: det } = await supabaseAdmin
      .from("reservas_salao")
      .select(`
        data_reserva,
        horario_inicio,
        horario_fim,
        solicitante:solicitante_id ( email, nome ),
        salao:salao_id ( nome )
      `)
      .eq("id", params.id)
      .single<ReservaEmailRow>();

    const sol = (det as any)?.solicitante;
    const sal = (det as any)?.salao;

    if (status === "CANCELADO") {
      const { data: syndicoProfiles } = await supabaseAdmin
        .from("perfis_usuario")
        .select("usuario_id")
        .eq("condominio_id", profile.condominio_id)
        .eq("role", "SINDICO")
        .eq("ativo", true);

      const syndicoUserIds = (syndicoProfiles ?? []).map((syndicoProfile) => syndicoProfile.usuario_id);

      if (syndicoUserIds.length) {
        const { data: syndicos } = await supabaseAdmin
          .from("usuarios")
          .select("email, nome")
          .in("id", syndicoUserIds);

        const sentAt = new Date(det!.data_reserva).toLocaleDateString("pt-BR");

        for (const sindico of syndicos ?? []) {
          if (!sindico.email) {
            continue;
          }

          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": process.env.BREVO_API_KEY ?? "",
              "content-type": "application/json"
            },
            body: JSON.stringify({
              sender: { name: "Condofy", email: "suportecondofy@gmail.com" },
              to: [{ email: sindico.email, name: sindico.nome }],
              subject: `🚫 Reserva cancelada — ${sal?.nome} ${sentAt}`,
              htmlContent: `<p>Olá ${sindico.nome}! O morador cancelou a reserva do <strong>${sal?.nome}</strong> para <strong>${sentAt}</strong> (${det!.horario_inicio}–${det!.horario_fim}).</p>`
            })
          });
        }
      }
    } else if (sol?.email) {
      const data = new Date(det!.data_reserva).toLocaleDateString("pt-BR");
      const isAprov = status === "APROVADO";

      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY ?? "",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "Condofy", email: "suportecondofy@gmail.com" },
          to: [{ email: sol.email, name: sol.nome }],
          subject: isAprov
            ? `✅ Reserva aprovada — ${sal?.nome} ${data}`
            : `❌ Reserva rejeitada — ${sal?.nome} ${data}`,
          htmlContent: isAprov
            ? `<p>Olá ${sol.nome}! Sua reserva do <strong>${sal?.nome}</strong> para <strong>${data}</strong> (${det!.horario_inicio}–${det!.horario_fim}) foi <strong>aprovada</strong>. 🎉</p>`
            : `<p>Olá ${sol.nome}! Sua reserva do <strong>${sal?.nome}</strong> para <strong>${data}</strong> foi <strong>rejeitada</strong>.<br/><strong>Motivo:</strong> ${motivoRejeicao ?? "não informado"}</p>`
        })
      });
    }
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : String(emailError);
    console.log(`[api/reservas] Falha ao enviar email de status para a reserva ${params.id}:`, message);
  }

  return NextResponse.json({ ok: true });
}