import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { getSupabaseClient } from "../lib/supabase.js";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

function getSupabaseAdminClient() {
  const supabaseUrl = env.supabaseUrl || process.env.SUPABASE_URL || "";
  const supabaseServiceRoleKey = env.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export const dashboardRouter = Router();

async function getAuthenticatedContext(request: Parameters<typeof dashboardRouter.get>[1] extends (
  request: infer R,
  response: infer S,
  next: infer N
) => unknown
  ? R
  : never) {
  const authorizationHeader = request.header("authorization");
  const accessToken = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";

  if (!accessToken) {
    return null;
  }

  const supabaseAuth = getSupabaseClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return null;
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id || !profile.role) {
    return null;
  }

  return {
    userId: userData.user.id,
    profile
  };
}

dashboardRouter.get("/avisos", async (request, response) => {
  const context = await getAuthenticatedContext(request);
  const supabaseAdmin = getSupabaseAdminClient();

  if (!context || !supabaseAdmin) {
    return response.status(503).json({ error: "Serviço indisponível." });
  }

  const { data, error } = await supabaseAdmin
    .from("avisos")
    .select("id, titulo, conteudo, categoria, fixado, criado_em, autor:usuarios(nome)")
    .eq("condominio_id", context.profile.condominio_id)
    .order("fixado", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) {
    return response.status(400).json({ error: error.message });
  }

  return response.status(200).json(data ?? []);
});

dashboardRouter.get("/reservas-salao", async (request, response) => {
  const context = await getAuthenticatedContext(request);
  const supabaseAdmin = getSupabaseAdminClient();

  if (!context || !supabaseAdmin) {
    return response.status(503).json({ error: "Serviço indisponível." });
  }

  let query = supabaseAdmin
    .from("reservas_salao")
    .select("id, salao_id, data_reserva, horario_inicio, horario_fim, status, motivo_rejeicao, criado_em, salao:saloes(nome), solicitante:usuarios(nome)")
    .eq("condominio_id", context.profile.condominio_id)
    .order("data_reserva", { ascending: false })
    .order("horario_inicio", { ascending: false });

  if (context.profile.role === "MORADOR") {
    query = query.eq("solicitante_id", context.userId);
  }

  const { data, error } = await query;

  if (error) {
    return response.status(400).json({ error: error.message });
  }

  return response.status(200).json(data ?? []);
});