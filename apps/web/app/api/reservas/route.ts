import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type ReservaCreateBody = {
  salaoId?: string;
  dataReserva?: string;
  horarioInicio?: string;
  horarioFim?: string;
};

type ReservaEmailRow = {
  nome: string;
};

type ReservaResponseRow = {
  id: string;
  salao_id: string;
  data_reserva: string;
  horario_inicio: string;
  horario_fim: string;
  status: string;
  motivo_rejeicao: string | null;
  criado_em: string;
  salao_nome: string | null;
  solicitante_nome: string | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const accessToken = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id || !profile.role) {
    return NextResponse.json({ error: "Nenhum condomínio ativo encontrado para este usuário." }, { status: 403 });
  }

  let query = supabaseAdmin
    .from("reservas_salao")
    .select("id, salao_id, data_reserva, horario_inicio, horario_fim, status, motivo_rejeicao, criado_em, salao:saloes(nome), solicitante:usuarios(nome)")
    .eq("condominio_id", profile.condominio_id)
    .order("data_reserva", { ascending: false })
    .order("horario_inicio", { ascending: false });

  if (profile.role === "MORADOR") {
    query = query.eq("solicitante_id", userData.user.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const reservas = (data ?? []).map((row) => {
    const salao = Array.isArray(row.salao) ? row.salao[0] ?? null : row.salao;
    const solicitante = Array.isArray(row.solicitante) ? row.solicitante[0] ?? null : row.solicitante;

    return {
      id: row.id,
      salao_id: row.salao_id,
      data_reserva: row.data_reserva,
      horario_inicio: row.horario_inicio,
      horario_fim: row.horario_fim,
      status: row.status,
      motivo_rejeicao: row.motivo_rejeicao,
      criado_em: row.criado_em,
      salao_nome: salao?.nome ?? null,
      solicitante_nome: solicitante?.nome ?? null
    } satisfies ReservaResponseRow;
  });

  return NextResponse.json(reservas);
}

export async function POST(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const accessToken = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id || !profile.role) {
    return NextResponse.json({ error: "Nenhum condomínio ativo encontrado para este usuário." }, { status: 403 });
  }

  if (profile.role !== "MORADOR") {
    return NextResponse.json({ error: "Você não tem permissão para reservar o salão." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ReservaCreateBody | null;
  const salaoId = body?.salaoId?.trim();
  const dataReserva = body?.dataReserva?.trim();
  const horarioInicio = body?.horarioInicio?.trim();
  const horarioFim = body?.horarioFim?.trim();

  if (!salaoId || !dataReserva || !horarioInicio || !horarioFim) {
    return NextResponse.json({ error: "Preencha os campos obrigatórios." }, { status: 400 });
  }

  const { data: salao, error: salaoError } = await supabaseAdmin
    .from("saloes")
    .select("id, nome")
    .eq("id", salaoId)
    .eq("condominio_id", profile.condominio_id)
    .eq("ativo", true)
    .single<{ id: string; nome: string }>();

  if (salaoError || !salao?.id) {
    return NextResponse.json({ error: "Salão não encontrado." }, { status: 404 });
  }

  const { data: reserva, error: insertError } = await supabaseAdmin
    .from("reservas_salao")
    .insert({
      salao_id: salao.id,
      condominio_id: profile.condominio_id,
      solicitante_id: userData.user.id,
      data_reserva: dataReserva,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      status: "PENDENTE"
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !reserva) {
    return NextResponse.json({ error: insertError?.message ?? "Não foi possível registrar a reserva." }, { status: 400 });
  }

  try {
    const data = new Date(dataReserva).toLocaleDateString("pt-BR");
    const brevoApiKey = process.env.BREVO_API_KEY ?? "";
    const sessionUserName = userData.user.user_metadata?.full_name ?? userData.user.user_metadata?.name ?? userData.user.email ?? "Morador";

    if (userData.user.email) {
      const emailResp = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "Condofy", email: "suportecondofy@gmail.com" },
          to: [{ email: userData.user.email, name: sessionUserName }],
          subject: `📅 Reserva recebida — ${salao.nome} ${data}`,
          htmlContent: `<p>Olá! Sua reserva do <strong>${salao.nome}</strong> para <strong>${data}</strong> (${horarioInicio}–${horarioFim}) foi recebida e está aguardando aprovação do síndico.</p><p>Você será notificado por email assim que a reserva for aprovada ou rejeitada.</p>`
        })
      });

      if (!emailResp.ok) {
        const errText = await emailResp.text();
        return NextResponse.json({ ok: true, reservationId: reserva.id, emailError: `Brevo error ${emailResp.status} — ${errText}` });
      }
    }
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : String(emailError);
    console.log(`[api/reservas] Falha ao enviar email de confirmação para a reserva ${reserva.id}:`, message);
  }

  return NextResponse.json({ ok: true, reservationId: reserva.id });
}