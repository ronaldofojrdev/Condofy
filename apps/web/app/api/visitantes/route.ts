import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PerfilRow = { condominio_id: string; role: string };

async function getProfile(token: string) {
  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return null;

  const { data: userData, error } = await supabaseAuth.auth.getUser(token);
  if (error || !userData.user) return null;

  const { data: profile } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<PerfilRow>();

  if (!profile?.condominio_id) return null;
  return { userId: userData.user.id, ...profile };
}

// GET /api/visitantes — lista visitantes do condomínio
// MORADOR: apenas da sua unidade | PORTEIRO/SINDICO: todos
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const profile = await getProfile(token);
  if (!profile) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAdmin = getSupabaseAdminClient()!;

  if (profile.role === "MORADOR") {
    // Busca unidade do morador
    const { data: perfil } = await supabaseAdmin
      .from("perfis_usuario")
      .select("unidade_id")
      .eq("usuario_id", profile.userId)
      .eq("condominio_id", profile.condominio_id)
      .eq("ativo", true)
      .limit(1)
      .single<{ unidade_id: string | null }>();

    if (!perfil?.unidade_id) {
      return NextResponse.json([]);
    }

    const { data } = await supabaseAdmin
      .from("visitantes")
      .select("id, nome, documento, motivo, entrada_em, saida_em")
      .eq("condominio_id", profile.condominio_id)
      .eq("unidade_id", perfil.unidade_id)
      .eq("ativo", true)
      .order("entrada_em", { ascending: false })
      .limit(50);

    return NextResponse.json(data ?? []);
  }

  // SINDICO ou PORTEIRO: tudo
  const { data } = await supabaseAdmin
    .from("visitantes")
    .select(`
      id,
      nome,
      documento,
      motivo,
      entrada_em,
      saida_em,
      unidade:unidades(numero),
      registrado_por_usuario:usuarios!visitantes_registrado_por_fkey(nome)
    `)
    .eq("condominio_id", profile.condominio_id)
    .eq("ativo", true)
    .order("entrada_em", { ascending: false })
    .limit(100);

  return NextResponse.json(data ?? []);
}

// POST /api/visitantes — registrar entrada (PORTEIRO/SINDICO)
export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const profile = await getProfile(token);
  if (!profile) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (profile.role === "MORADOR") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    unidade_id: string;
    nome: string;
    documento?: string;
    motivo?: string;
  } | null;

  if (!body?.unidade_id || !body?.nome?.trim()) {
    return NextResponse.json({ error: "Unidade e nome são obrigatórios." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient()!;

  // Valida que unidade pertence ao condomínio
  const { data: unidade } = await supabaseAdmin
    .from("unidades")
    .select("id")
    .eq("id", body.unidade_id)
    .eq("condominio_id", profile.condominio_id)
    .maybeSingle();

  if (!unidade) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("visitantes")
    .insert({
      condominio_id: profile.condominio_id,
      unidade_id: body.unidade_id,
      nome: body.nome.trim(),
      documento: body.documento?.trim() || null,
      motivo: body.motivo?.trim() || null,
      registrado_por: profile.userId,
    })
    .select("id, nome, entrada_em")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
