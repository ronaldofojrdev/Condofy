import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

type CreateUsuarioBody = {
  email: string;
  password: string;
  nome: string;
  condominioId: string;
  role: "PORTEIRO" | "MORADOR";
  unidadeId: string | null;
};

export const dynamic = "force-dynamic";

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

  if (profileError || !profile?.condominio_id || profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: CreateUsuarioBody;
  try {
    body = (await request.json()) as CreateUsuarioBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { email, password, nome, condominioId, role, unidadeId } = body;

  if (!email || !password || !nome || !condominioId || !role) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  if (condominioId !== profile.condominio_id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { nome },
    email_confirm: true
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Erro ao criar usuário." }, { status: 400 });
  }

  const newUserId = authData.user.id;

  const { error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .upsert({ id: newUserId, nome, email });

  if (usuarioError) {
    return NextResponse.json({ error: usuarioError.message }, { status: 400 });
  }

  const { error: perfilError } = await supabaseAdmin.from("perfis_usuario").insert({
    usuario_id: newUserId,
    condominio_id: condominioId,
    role,
    ativo: true,
    unidade_id: unidadeId ?? null
  });

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
