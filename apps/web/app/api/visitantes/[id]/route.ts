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

// PATCH /api/visitantes/:id — registrar saída
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const profile = await getProfile(token);
  if (!profile) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (profile.role === "MORADOR") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const supabaseAdmin = getSupabaseAdminClient()!;

  // Verifica que o visitante pertence ao condomínio
  const { data: visitante } = await supabaseAdmin
    .from("visitantes")
    .select("id, saida_em")
    .eq("id", params.id)
    .eq("condominio_id", profile.condominio_id)
    .eq("ativo", true)
    .maybeSingle();

  if (!visitante) return NextResponse.json({ error: "Visitante não encontrado." }, { status: 404 });
  if (visitante.saida_em) return NextResponse.json({ error: "Saída já registrada." }, { status: 409 });

  const { data, error } = await supabaseAdmin
    .from("visitantes")
    .update({ saida_em: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, saida_em")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
