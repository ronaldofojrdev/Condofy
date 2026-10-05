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

// GET — listar colaboradores (somente ADMIN)
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (colab.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_colaboradores")
    .select("id, nome, email, role, ativo, criado_em")
    .order("criado_em", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — criar colaborador (somente ADMIN)
export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (colab.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { nome, email, role, senha } = body;
  if (!nome || !email || !role || !senha) {
    return NextResponse.json({ error: "Nome, e-mail, role e senha são obrigatórios." }, { status: 400 });
  }

  const ROLES_VALIDOS: BackofficeRole[] = ["ADMIN", "IMPLEMENTACAO", "COMERCIAL", "FINANCEIRO", "JURIDICO", "DEV"];
  if (!ROLES_VALIDOS.includes(role)) {
    return NextResponse.json({ error: "Role inválida." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;

  // Criar auth user
  const { data: authData, error: authError } = await (supabaseAdmin.auth as any).admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    return NextResponse.json({ error: authError?.message ?? "Erro ao criar usuário." }, { status: 400 });
  }

  // Inserir colaborador
  const { data: newColab, error: colabError } = await supabaseAdmin
    .from("backoffice_colaboradores")
    .insert({ usuario_id: authData.user.id, nome, email, role })
    .select("id")
    .single();

  if (colabError) {
    // Rollback: deletar auth user criado
    await (supabaseAdmin.auth as any).admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: colabError.message }, { status: 400 });
  }

  // Audit log
  await supabaseAdmin.from("backoffice_audit_log").insert({
    colaborador_id: colab.id,
    acao: "CRIAR_COLABORADOR",
    recurso: "colaborador",
    recurso_id: newColab.id,
    detalhes: { nome, email, role },
  });

  return NextResponse.json({ success: true, colaboradorId: newColab.id });
}
