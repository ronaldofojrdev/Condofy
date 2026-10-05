import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type BackofficeRole = "ADMIN" | "IMPLEMENTACAO" | "COMERCIAL" | "FINANCEIRO" | "JURIDICO" | "DEV";

async function getColaborador(token: string) {
  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return null;

  const { data: userData, error } = await supabaseAuth.auth.getUser(token);
  if (error || !userData.user) return null;

  const { data: colab } = await supabaseAdmin
    .from("backoffice_colaboradores")
    .select("id, role, nome")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  return colab as { id: string; role: BackofficeRole; nome: string } | null;
}

// GET — lista todos os condomínios com dados de implementação
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAdmin = getSupabaseAdminClient()!;

  const { data, error } = await supabaseAdmin
    .from("backoffice_clientes")
    .select(`
      id,
      plano,
      status_implementacao,
      notas,
      criado_em,
      condominio:condominios (
        id,
        nome,
        cidade,
        estado
      ),
      responsavel:backoffice_colaboradores (
        nome
      )
    `)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Busca síndico de cada condomínio
  const condominioIds = (data ?? []).map((d: any) => {
    const condo = Array.isArray(d.condominio) ? d.condominio[0] : d.condominio;
    return condo?.id;
  }).filter(Boolean);

  const { data: sindicos } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, usuarios(nome, email)")
    .in("condominio_id", condominioIds)
    .eq("role", "SINDICO")
    .eq("ativo", true);

  const sindicoMap: Record<string, { nome: string; email: string }> = {};
  (sindicos ?? []).forEach((s: any) => {
    const u = Array.isArray(s.usuarios) ? s.usuarios[0] : s.usuarios;
    if (u) sindicoMap[s.condominio_id] = { nome: u.nome, email: u.email };
  });

  const rows = (data ?? []).map((d: any) => {
    const condo = Array.isArray(d.condominio) ? d.condominio[0] : d.condominio;
    const responsavel = Array.isArray(d.responsavel) ? d.responsavel[0] : d.responsavel;
    return {
      id: d.id,
      plano: d.plano,
      status: d.status_implementacao,
      notas: d.notas,
      criado_em: d.criado_em,
      condominio_id: condo?.id,
      nome: condo?.nome ?? "",
      cidade: condo?.cidade ?? "",
      estado: condo?.estado ?? "",
      responsavel: responsavel?.nome ?? "",
      sindico: sindicoMap[condo?.id] ?? null,
    };
  });

  return NextResponse.json({ data: rows });
}

// POST — cria condomínio + conta do síndico
export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!["ADMIN", "IMPLEMENTACAO"].includes(colab.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const {
    nome, endereco, cidade, estado, cep,
    plano,
    sindicoNome, sindicoEmail, sindicoSenha,
    responsavelId,
  } = body;

  if (!nome || !sindicoNome || !sindicoEmail || !sindicoSenha || !plano) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;

  // 1. Cria o condomínio na tabela principal
  const { data: condo, error: condoError } = await supabaseAdmin
    .from("condominios")
    .insert({
        nome,
        endereco: endereco || "Não informado",
        cidade: cidade || "Não informada",
        estado: (estado && estado.length === 2) ? estado.toUpperCase() : "XX",
        cep: (cep && /^[0-9]{5}-?[0-9]{3}$/.test(cep)) ? cep : "00000-000",
        tipo: "VERTICAL",
        total_unidades: 0,
        onboarding_completo: true,
      })
    .select("id")
    .single();

  if (condoError || !condo) {
    return NextResponse.json({ error: condoError?.message ?? "Erro ao criar condomínio." }, { status: 400 });
  }

  // 2. Cria usuário auth do síndico
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: sindicoEmail,
    password: sindicoSenha,
    user_metadata: { nome: sindicoNome },
    email_confirm: true,
  });

  if (authError || !authData.user) {
    // Rollback: remove condomínio
    await supabaseAdmin.from("condominios").delete().eq("id", condo.id);
    return NextResponse.json({ error: authError?.message ?? "Erro ao criar usuário." }, { status: 400 });
  }

  const sindicoId = authData.user.id;

  // 3. Cria registro na tabela usuarios
  const { error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .upsert({ id: sindicoId, nome: sindicoNome, email: sindicoEmail });

  if (usuarioError) {
    await supabaseAdmin.auth.admin.deleteUser(sindicoId);
    await supabaseAdmin.from("condominios").delete().eq("id", condo.id);
    return NextResponse.json({ error: usuarioError.message }, { status: 400 });
  }

  // 4. Cria perfil de síndico
  const { error: perfilError } = await supabaseAdmin.from("perfis_usuario").insert({
    usuario_id: sindicoId,
    condominio_id: condo.id,
    role: "SINDICO",
    ativo: true,
  });

  if (perfilError) {
    await supabaseAdmin.auth.admin.deleteUser(sindicoId);
    await supabaseAdmin.from("condominios").delete().eq("id", condo.id);
    return NextResponse.json({ error: perfilError.message }, { status: 400 });
  }

  // 5. Cria registro de cliente no backoffice
  const { error: clienteError } = await supabaseAdmin.from("backoffice_clientes").insert({
    condominio_id: condo.id,
    plano,
    status_implementacao: "AGUARDANDO",
    responsavel_id: responsavelId ?? colab.id,
  });

  if (clienteError) {
    return NextResponse.json({ error: clienteError.message }, { status: 400 });
  }

  // 6. Audit log
  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: "CRIAR_CONDOMINIO",
    recurso: "condominio",
    recurso_id: condo.id,
    detalhes: { nome, sindicoEmail, plano },
  });

  return NextResponse.json({ success: true, condominioId: condo.id });
}
