import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

type MemberRole = "MORADOR" | "PORTEIRO";

type MemberCreateBody = {
  condominioId?: string;
  nome?: string;
  email?: string;
  role?: MemberRole;
  unidadeId?: string;
};

type MemberDeactivateBody = {
  unidadeId?: string | null;
};

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export const membrosRouter = Router();

function isMemberRole(role: string | undefined): role is MemberRole {
  return role === "MORADOR" || role === "PORTEIRO";
}

membrosRouter.post("/", async (request, response) => {
  const body = request.body as MemberCreateBody;
  const condominioId = body.condominioId?.trim();
  const nome = body.nome?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role?.trim();
  const unidadeId = body.unidadeId?.trim();

  if (!condominioId || !nome || !email || !isMemberRole(role)) {
    return response.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  if (role === "MORADOR" && !unidadeId) {
    return response.status(400).json({ error: "Selecione uma unidade para o morador." });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nome }
  });

  if (authError) {
    return response.status(400).json({ error: authError.message });
  }

  if (!authData.user) {
    return response.status(400).json({ error: "Não foi possível criar o usuário no Supabase Auth." });
  }

  const userId = authData.user.id;

  const { error: usuarioError } = await supabaseAdmin.from("usuarios").insert({
    id: userId,
    nome,
    email
  });

  if (usuarioError) {
    return response.status(400).json({ error: usuarioError.message });
  }

  const perfilPayload: {
    usuario_id: string;
    condominio_id: string;
    unidade_id?: string | null;
    role: MemberRole;
    ativo: boolean;
  } = {
    usuario_id: userId,
    condominio_id: condominioId,
    role,
    ativo: true
  };

  if (role === "MORADOR") {
    perfilPayload.unidade_id = unidadeId;
  }

  const { error: perfilInsertError } = await supabaseAdmin.from("perfis_usuario").insert(perfilPayload);

  if (perfilInsertError) {
    return response.status(400).json({ error: perfilInsertError.message });
  }

  const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.WEB_URL ?? "http://localhost:3000"}/auth/confirm`
    }
  });

  if (linkError) {
    console.error("Erro ao enviar convite:", linkError.message);
  }

  if (role === "MORADOR" && unidadeId) {
    const { error: unidadeUpdateError } = await supabaseAdmin
      .from("unidades")
      .update({ status: "OCUPADA" })
      .eq("id", unidadeId);

    if (unidadeUpdateError) {
      return response.status(400).json({ error: unidadeUpdateError.message });
    }
  }

  return response.status(201).json({ success: true, conviteEnviado: !linkError });
});

membrosRouter.patch("/:perfilId/desativar", async (request, response) => {
  const perfilId = request.params.perfilId?.trim();
  const body = request.body as MemberDeactivateBody;
  const unidadeId = body.unidadeId?.trim();

  if (!perfilId) {
    return response.status(400).json({ error: "Perfil inválido." });
  }

  const { error: perfilUpdateError } = await supabaseAdmin
    .from("perfis_usuario")
    .update({ ativo: false })
    .eq("id", perfilId);

  if (perfilUpdateError) {
    return response.status(400).json({ error: perfilUpdateError.message });
  }

  if (unidadeId) {
    const { error: unidadeUpdateError } = await supabaseAdmin
      .from("unidades")
      .update({ status: "VAZIA" })
      .eq("id", unidadeId);

    if (unidadeUpdateError) {
      return response.status(400).json({ error: unidadeUpdateError.message });
    }
  }

  return response.status(200).json({ ok: true });
});