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

export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const allowed: BackofficeRole[] = ["ADMIN", "JURIDICO"];
  if (!allowed.includes(colab.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_lgpd_solicitacoes")
    .select(`
      id, tipo, status, solicitante_nome, solicitante_email,
      descricao, prazo_legal, resolvido_em, notas_internas, criado_em,
      condominio:condominios (nome, cidade),
      resolvido_por:backoffice_colaboradores (nome)
    `)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const hoje = new Date();
  const rows = (data ?? []).map((s: any) => {
    const condo = Array.isArray(s.condominio) ? s.condominio[0] : s.condominio;
    const resolvido = Array.isArray(s.resolvido_por) ? s.resolvido_por[0] : s.resolvido_por;
    const diasRestantes = Math.ceil((new Date(s.prazo_legal).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return { ...s, condominio: condo ?? null, resolvido_por: resolvido ?? null, dias_restantes: diasRestantes };
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const colab = await getColaborador(token);
  if (!colab) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const allowed: BackofficeRole[] = ["ADMIN", "JURIDICO"];
  if (!allowed.includes(colab.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { tipo, solicitante_nome, solicitante_email, condominio_id, descricao } = body;
  if (!tipo || !solicitante_nome || !solicitante_email) {
    return NextResponse.json({ error: "Tipo, nome e e-mail são obrigatórios." }, { status: 400 });
  }

  // Prazo legal: 15 dias corridos (LGPD art. 19)
  const prazo = new Date();
  prazo.setDate(prazo.getDate() + 15);

  const supabaseAdmin = getSupabaseAdminClient()!;
  const { data, error } = await supabaseAdmin
    .from("backoffice_lgpd_solicitacoes")
    .insert({
      tipo,
      solicitante_nome,
      solicitante_email,
      condominio_id: condominio_id || null,
      descricao: descricao || null,
      prazo_legal: prazo.toISOString().split("T")[0],
      status: "PENDENTE",
    })
    .select("id")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erro ao criar solicitação." }, { status: 400 });

  return NextResponse.json({ success: true, solicitacaoId: data.id });
}
