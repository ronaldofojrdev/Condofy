import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET — lista colaboradores ativos (id + nome) para qualquer role autenticado
// Usado para preencher dropdowns de responsável em leads, contratos etc.
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return NextResponse.json({ error: "Erro de configuração." }, { status: 500 });

  const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !userData.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Verifica que o solicitante é um colaborador ativo (qualquer role)
  const { data: colab } = await supabaseAdmin
    .from("backoffice_colaboradores")
    .select("id")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("backoffice_colaboradores")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}
