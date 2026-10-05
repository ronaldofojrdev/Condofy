import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAuth || !supabaseAdmin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<{ condominio_id: string; role: string }>();

  if (!profile?.condominio_id) return NextResponse.json({ error: "Sem perfil." }, { status: 403 });
  if (profile.role !== "PORTEIRO" && profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [entregasRes, veiculosRes, visitantesAtivosRes, visitantesHojeRes] = await Promise.all([
    supabaseAdmin
      .from("entregas")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", profile.condominio_id)
      .eq("status", "AGUARDANDO"),
    supabaseAdmin
      .from("veiculos")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", profile.condominio_id)
      .eq("ativo", true),
    // visitantes ainda no condomínio (sem saída)
    supabaseAdmin
      .from("visitantes")
      .select("id, nome, unidade:unidades(numero), entrada_em", { count: "exact" })
      .eq("condominio_id", profile.condominio_id)
      .eq("ativo", true)
      .is("saida_em", null)
      .order("entrada_em", { ascending: false })
      .limit(10),
    // total de visitas hoje
    supabaseAdmin
      .from("visitantes")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", profile.condominio_id)
      .eq("ativo", true)
      .gte("entrada_em", todayStart.toISOString()),
  ]);

  return NextResponse.json({
    entregasPendentes: entregasRes.count ?? 0,
    veiculosCadastrados: veiculosRes.count ?? 0,
    visitantesAtivos: visitantesAtivosRes.count ?? 0,
    visitantesHoje: visitantesHojeRes.count ?? 0,
    visitantesNoCondominio: (visitantesAtivosRes.data ?? []).map((v: any) => ({
      id: v.id,
      nome: v.nome,
      unidade_numero: Array.isArray(v.unidade) ? (v.unidade[0]?.numero ?? null) : (v.unidade?.numero ?? null),
      entrada_em: v.entrada_em,
    })),
  });
}
