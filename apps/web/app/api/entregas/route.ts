import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  unidade_id: string | null;
  role: DashboardRole;
};

type ResidentProfileRow = {
  usuario_id: string;
};

type UserRow = {
  id: string;
  email: string;
  nome: string;
};

type RequestBody = {
  unidadeId?: string;
  remetente?: string | null;
  fotoUrl?: string | null;
};

export const dynamic = "force-dynamic";

function formatDeliveryTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
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
    .select("condominio_id, unidade_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id || !profile.role) {
    return NextResponse.json({ error: "Nenhum condomínio ativo encontrado para este usuário." }, { status: 403 });
  }

  if (profile.role !== "SINDICO" && profile.role !== "PORTEIRO") {
    return NextResponse.json({ error: "Você não tem permissão para registrar entregas." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const unidadeId = body?.unidadeId?.trim();
  const remetente = body?.remetente?.trim() ?? "";
  const fotoUrl = body?.fotoUrl?.trim() ?? "";

  if (!unidadeId) {
    return NextResponse.json({ error: "Selecione uma unidade antes de registrar a entrega." }, { status: 400 });
  }

  const { data: unitData, error: unitError } = await supabaseAdmin
    .from("unidades")
    .select("id, numero")
    .eq("id", unidadeId)
    .eq("condominio_id", profile.condominio_id)
    .single<{ id: string; numero: string }>();

  if (unitError || !unitData?.id) {
    return NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 });
  }

  const { data: delivery, error: insertError } = await supabaseAdmin
    .from("entregas")
    .insert({
      condominio_id: profile.condominio_id,
      unidade_id: unitData.id,
      registrado_por: userData.user.id,
      remetente: remetente || null,
      foto_url: fotoUrl || null
    })
    .select("id, criado_em, remetente")
    .single<{ id: string; criado_em: string; remetente: string | null }>();

  if (insertError || !delivery) {
    return NextResponse.json({ error: insertError?.message ?? "Não foi possível registrar a entrega." }, { status: 400 });
  }

  const { data: residentProfiles, error: residentProfilesError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("usuario_id")
    .eq("condominio_id", profile.condominio_id)
    .eq("unidade_id", unitData.id)
    .eq("role", "MORADOR")
    .eq("ativo", true);

  if (residentProfilesError) {
    console.log("[api/entregas] Erro ao buscar perfis de moradores:", residentProfilesError.message);
  }

  const residentUserIds = (residentProfiles ?? []).map((residentProfile) => residentProfile.usuario_id);

  if (!residentUserIds.length) {
    console.log(`[api/entregas] Nenhum morador cadastrado para a unidade ${unitData.numero}.`);
    return NextResponse.json({ ok: true, deliveryId: delivery.id });
  }

  // Notificações in-app (fire-and-forget)
  void supabaseAdmin.from("notificacoes").insert(
    residentUserIds.map((uid) => ({
      usuario_id: uid,
      tipo: "ENTREGA",
      titulo: "Nova encomenda na portaria",
      mensagem: `Chegou uma encomenda para a Unidade ${unitData.numero}${delivery.remetente ? ` de ${delivery.remetente}` : ""}. Retire na portaria.`,
    }))
  );

  const { data: users, error: usersError } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, nome")
    .in("id", residentUserIds);

  if (usersError) {
    console.log("[api/entregas] Erro ao buscar emails dos moradores:", usersError.message);
    return NextResponse.json({ ok: true, deliveryId: delivery.id });
  }

  const sentAt = formatDeliveryTime(delivery.criado_em);
  const senderName = delivery.remetente?.trim() || "não informado";
  const emailErrors: string[] = [];
  const brevoApiKey = process.env.BREVO_API_KEY ?? "";

  for (const user of (users ?? []) as UserRow[]) {
    try {
      const emailResp = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "Condofy", email: "suportecondofy@gmail.com" },
          to: [{ email: user.email, name: user.nome }],
          subject: "📦 Nova encomenda na portaria",
          htmlContent: `<p>Olá ${user.nome}! Chegou uma encomenda para a Unidade ${unitData.numero}.<br/><strong>Remetente:</strong> ${senderName}</p><p>Retire na portaria. Registrada às ${sentAt}.</p>`,
          textContent: `Olá! Encomenda para Unidade ${unitData.numero}. Remetente: ${senderName}. Retire na portaria. Registrada às ${sentAt}.`
        })
      });

      if (!emailResp.ok) {
        const errText = await emailResp.text();
        emailErrors.push(`${user.email}: Brevo error ${emailResp.status} — ${errText}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[api/entregas] Falha ao enviar email para ${user.email}:`, message);
      emailErrors.push(`${user.email}: ${message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    deliveryId: delivery.id,
    ...(emailErrors.length ? { emailError: emailErrors.join(" | ") } : {})
  });
}