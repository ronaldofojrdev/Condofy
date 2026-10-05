import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  condominio_id: string;
  role: "SINDICO" | "PORTEIRO" | "MORADOR";
};

const CATEGORIAS_VALIDAS = ["GERAL", "ATA", "REGULAMENTO", "FINANCEIRO", "MANUTENCAO", "OUTRO"] as const;

export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("documentos")
    .select("id, titulo, descricao, categoria, url, criado_em")
    .eq("condominio_id", profile.condominio_id)
    .order("categoria", { ascending: true })
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ documentos: data ?? [], role: profile.role });
}

type CreateBody = {
  titulo?: string;
  descricao?: string | null;
  categoria?: string;
  url?: string;
};

export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  if (profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Apenas o síndico pode adicionar documentos." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const titulo = body?.titulo?.trim();
  const descricao = body?.descricao?.trim() ?? null;
  const categoria = body?.categoria?.trim() ?? "GERAL";
  const url = body?.url?.trim();

  if (!titulo) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  if (!url) return NextResponse.json({ error: "URL é obrigatória." }, { status: 400 });
  if (!CATEGORIAS_VALIDAS.includes(categoria as typeof CATEGORIAS_VALIDAS[number])) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }

  const { data: doc, error: insertError } = await supabaseAdmin
    .from("documentos")
    .insert({
      condominio_id: profile.condominio_id,
      criado_por: userData.user.id,
      titulo,
      descricao,
      categoria,
      url,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !doc) {
    return NextResponse.json({ error: insertError?.message ?? "Erro ao adicionar documento." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, documentoId: doc.id });
}
