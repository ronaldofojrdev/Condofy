import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { env } from "../config/env.js";

type PendingDelivery = {
  id: string;
  remetente: string | null;
  criado_em: string;
  unidade_id: string;
  condominio_id: string;
};

type CondoRow = {
  nome: string;
};

type UnitRow = {
  numero: string;
};

type ResidentProfile = {
  usuario_id: string;
};

type UserRow = {
  id: string;
  email: string;
  nome: string;
};

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(new Date(value));
}

export async function alertaEntregasPendentes() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    console.log("[alertaEntregasPendentes] Configuração do Supabase incompleta.");
    return;
  }

  if (!resend) {
    console.log("[alertaEntregasPendentes] RESEND_API_KEY não configurada.");
    return;
  }

  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: deliveries, error: deliveriesError } = await supabase
    .from("entregas")
    .select("id, remetente, criado_em, unidade_id, condominio_id")
    .eq("status", "AGUARDANDO")
    .lt("criado_em", cutoff)
    .order("criado_em", { ascending: true });

  if (deliveriesError) {
    console.log("[alertaEntregasPendentes] Erro ao buscar entregas pendentes:", deliveriesError.message);
    return;
  }

  if (!deliveries?.length) {
    console.log("[alertaEntregasPendentes] Nenhuma entrega pendente encontrada.");
    return;
  }

  for (const delivery of deliveries as PendingDelivery[]) {
    const [{ data: condoData, error: condoError }, { data: unitData, error: unitError }] = await Promise.all([
      supabase.from("condominios").select("nome").eq("id", delivery.condominio_id).single<CondoRow>(),
      supabase.from("unidades").select("numero").eq("id", delivery.unidade_id).single<UnitRow>()
    ]);

    if (condoError || unitError || !condoData?.nome || !unitData?.numero) {
      console.log(`[alertaEntregasPendentes] Dados base ausentes para entrega ${delivery.id}.`);
      continue;
    }

    const { data: residentProfiles, error: residentProfilesError } = await supabase
      .from("perfis_usuario")
      .select("usuario_id")
      .eq("unidade_id", delivery.unidade_id)
      .eq("condominio_id", delivery.condominio_id)
      .eq("role", "MORADOR")
      .eq("ativo", true);

    if (residentProfilesError) {
      console.log(
        `[alertaEntregasPendentes] Erro ao buscar perfis de moradores da unidade ${delivery.unidade_id}:`,
        residentProfilesError.message
      );
      continue;
    }

    const userIds = (residentProfiles ?? []).map((profile) => (profile as ResidentProfile).usuario_id);

    if (!userIds.length) {
      console.log(`[alertaEntregasPendentes] Nenhum morador encontrado para a unidade ${unitData.numero}.`);
      continue;
    }

    const { data: users, error: usersError } = await supabase
      .from("usuarios")
      .select("id, email, nome")
      .in("id", userIds);

    if (usersError) {
      console.log(
        `[alertaEntregasPendentes] Erro ao buscar usuários da unidade ${unitData.numero}:`,
        usersError.message
      );
      continue;
    }

    for (const user of users ?? []) {
      const resident = user as UserRow;
      const subject = "Você tem uma entrega aguardando na portaria — Condofy";
      const body = [
        `Olá ${resident.nome},`,
        `Você tem uma entrega aguardando na portaria do ${condoData.nome} desde ${formatDate(delivery.criado_em)}.`,
        delivery.remetente ? `Remetente: ${delivery.remetente}` : null,
        "Por favor, retire o quanto antes.",
        "— Condofy"
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const result = await resend.emails.send({
          from: "Condofy <onboarding@resend.dev>",
          to: resident.email,
          subject,
          text: body
        });

        console.log(
          `[alertaEntregasPendentes] Email enviado para ${resident.email} (entrega ${delivery.id}):`,
          result.data?.id ?? "sem id"
        );
      } catch (error) {
        console.log(
          `[alertaEntregasPendentes] Falha ao enviar email para ${resident.email} (entrega ${delivery.id}):`,
          error
        );
      }
    }
  }

  console.log(`[alertaEntregasPendentes] Processamento concluído para ${deliveries.length} entrega(s).`);
}