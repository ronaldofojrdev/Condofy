import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  condominio_id: string;
  role: "SINDICO" | "PORTEIRO" | "MORADOR";
};

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

  if (profileError || !profile?.condominio_id || profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("manutencoes")
    .select("id, titulo, descricao, responsavel, prevista_em, concluida, concluida_em, criado_em")
    .eq("condominio_id", profile.condominio_id)
    .order("prevista_em", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data ?? []);
}

type CreateBody = {
  titulo?: string;
  descricao?: string | null;
  responsavel?: string | null;
  prevista_em?: string;
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

  if (profileError || !profile?.condominio_id || profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Apenas o síndico pode gerenciar manutenções." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const titulo = body?.titulo?.trim();
  const descricao = body?.descricao?.trim() ?? null;
  const responsavel = body?.responsavel?.trim() ?? null;
  const prevista_em = body?.prevista_em;

  if (!titulo) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  if (!prevista_em) return NextResponse.json({ error: "Data prevista é obrigatória." }, { status: 400 });

  const { data: manutencao, error: insertError } = await supabaseAdmin
    .from("manutencoes")
    .insert({ condominio_id: profile.condominio_id, criado_por: userData.user.id, titulo, descricao, responsavel, prevista_em })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !manutencao) {
    return NextResponse.json({ error: insertError?.message ?? "Erro ao criar manutenção." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, manutencaoId: manutencao.id });
}
