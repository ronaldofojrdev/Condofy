import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
  unidade_id: string | null;
  usuario_id: string;
};

type VeiculoCreateBody = {
  unidade_id?: string;
  placa?: string;
  modelo?: string;
  cor?: string | null;
  morador_id?: string | null;
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
    .select("condominio_id, role, unidade_id, usuario_id")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  if (profile.role === "MORADOR") {
    // Morador vê apenas veículos da sua unidade
    if (!profile.unidade_id) {
      return NextResponse.json([], { status: 200 });
    }

    const { data, error } = await supabaseAdmin
      .from("veiculos")
      .select("id, placa, modelo, cor, criado_em, unidade_id")
      .eq("condominio_id", profile.condominio_id)
      .eq("unidade_id", profile.unidade_id)
      .eq("ativo", true)
      .order("criado_em", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? []);
  }

  // SINDICO e PORTEIRO veem todos
  const { data, error } = await supabaseAdmin
    .from("veiculos")
    .select(`
      id,
      placa,
      modelo,
      cor,
      criado_em,
      ativo,
      unidade_id,
      unidades ( numero ),
      usuarios!veiculos_morador_id_fkey ( nome )
    `)
    .eq("condominio_id", profile.condominio_id)
    .eq("ativo", true)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const formatted = (data ?? []).map((v: any) => ({
    id: v.id,
    placa: v.placa,
    modelo: v.modelo,
    cor: v.cor,
    criado_em: v.criado_em,
    unidade_numero: v.unidades?.numero ?? null,
    morador_nome: v.usuarios?.nome ?? null,
  }));

  return NextResponse.json(formatted);
}

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
    .select("condominio_id, role, usuario_id")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<ProfileRow>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  if (profile.role !== "PORTEIRO" && profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Apenas porteiro ou síndico pode cadastrar veículos." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as VeiculoCreateBody | null;
  const placa = body?.placa?.trim().toUpperCase();
  const modelo = body?.modelo?.trim();
  const cor = body?.cor?.trim() || null;
  const unidade_id = body?.unidade_id;
  const morador_id = body?.morador_id || null;

  if (!placa) return NextResponse.json({ error: "Placa é obrigatória." }, { status: 400 });
  if (!modelo) return NextResponse.json({ error: "Modelo é obrigatório." }, { status: 400 });
  if (!unidade_id) return NextResponse.json({ error: "Unidade é obrigatória." }, { status: 400 });

  // Verificar que a unidade pertence ao condomínio
  const { data: unidade } = await supabaseAdmin
    .from("unidades")
    .select("id")
    .eq("id", unidade_id)
    .eq("condominio_id", profile.condominio_id)
    .single();

  if (!unidade) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 });

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("veiculos")
    .insert({
      condominio_id: profile.condominio_id,
      unidade_id,
      morador_id,
      placa,
      modelo,
      cor,
      registrado_por: userData.user.id,
    })
    .select("id, placa, modelo, cor, criado_em")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Placa já cadastrada neste condomínio." }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
