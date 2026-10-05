import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  message: string;
  conversationHistory: ConversationMessage[];
};

export const dynamic = "force-dynamic";

// Modelos Gemini com versão de API correta (REST, sem SDK)
// gemini-2.5 → v1beta | gemini-2.0 → v1beta | gemini-1.5 → v1 (removido do v1beta)
const GEMINI_MODELS: Array<{ model: string; apiVersion: string }> = [
  { model: "gemini-2.5-flash", apiVersion: "v1beta" },
  { model: "gemini-2.5-flash-lite", apiVersion: "v1beta" },
  { model: "gemini-2.0-flash", apiVersion: "v1beta" },
  { model: "gemini-2.0-flash-lite", apiVersion: "v1beta" },
  { model: "gemini-1.5-flash", apiVersion: "v1" },
];

async function callGeminiRest(
  apiKey: string,
  model: string,
  apiVersion: string,
  systemPrompt: string,
  history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
  userMessage: string
): Promise<string> {
  const contents = [
    ...history,
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini ${model} HTTP ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(data.error.message);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Resposta vazia do modelo.");

  return text.trim();
}

export async function POST(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const accessToken = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Assistente de IA não configurado. Contate o suporte." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;

  if (!body?.message?.trim()) {
    return NextResponse.json({ error: "Mensagem não pode ser vazia." }, { status: 400 });
  }

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfis_usuario")
    .select("condominio_id, role")
    .eq("usuario_id", userData.user.id)
    .eq("ativo", true)
    .limit(1)
    .single<{ condominio_id: string; role: string }>();

  if (profileError || !profile?.condominio_id) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 403 });
  }

  const condominioId = profile.condominio_id;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [condoResult, moradoresResult, porteirosResult, entregasResult, avisosResult] =
    await Promise.all([
      supabaseAdmin
        .from("condominios")
        .select("nome, endereco, total_unidades")
        .eq("id", condominioId)
        .single<{ nome: string; endereco: string; total_unidades: number }>(),
      supabaseAdmin
        .from("perfis_usuario")
        .select("id", { count: "exact", head: true })
        .eq("condominio_id", condominioId)
        .eq("role", "MORADOR")
        .eq("ativo", true),
      supabaseAdmin
        .from("perfis_usuario")
        .select("id", { count: "exact", head: true })
        .eq("condominio_id", condominioId)
        .eq("role", "PORTEIRO")
        .eq("ativo", true),
      supabaseAdmin
        .from("entregas")
        .select("id", { count: "exact", head: true })
        .eq("condominio_id", condominioId)
        .eq("status", "AGUARDANDO"),
      supabaseAdmin
        .from("avisos")
        .select("id", { count: "exact", head: true })
        .eq("condominio_id", condominioId)
        .gte("criado_em", monthStart)
    ]);

  const condo = condoResult.data;
  const countMoradores = moradoresResult.count ?? 0;
  const countPorteiros = porteirosResult.count ?? 0;
  const countEntregasPendentes = entregasResult.count ?? 0;
  const countAvisos = avisosResult.count ?? 0;

  const systemPrompt = `Você é o Assistente do Condofy, um sistema de gestão de condomínios.
Você está ajudando o síndico do condomínio "${condo?.nome ?? "não informado"}" localizado em "${condo?.endereco ?? "não informado"}".

Dados atuais do condomínio:
- Total de unidades: ${condo?.total_unidades ?? "?"}
- Moradores ativos: ${countMoradores}
- Porteiros: ${countPorteiros}
- Avisos publicados este mês: ${countAvisos}
- Entregas pendentes de retirada: ${countEntregasPendentes}

Você pode:
- Responder dúvidas sobre os dados acima do condomínio
- Responder dúvidas gerais de síndico (legislação condominial brasileira, Lei 4.591/64, Código Civil arts. 1.331-1.358, boas práticas de gestão)
- Redigir avisos e comunicados formais para o condomínio quando solicitado
- Orientar sobre situações comuns: inadimplência, obras, assembleias, conflitos entre moradores

Seja direto, profissional e útil. Responda em português brasileiro.`;

  const historyFormatted = (body.conversationHistory ?? []).map((msg) => ({
    role: (msg.role === "assistant" ? "model" : "user") as "user" | "model",
    parts: [{ text: msg.content }],
  }));

  // Tenta cada modelo em sequência até um funcionar
  let lastError = "";
  for (const { model, apiVersion } of GEMINI_MODELS) {
    try {
      const reply = await callGeminiRest(apiKey, model, apiVersion, systemPrompt, historyFormatted, body.message.trim());
      console.log(`[api/assistente] Sucesso com modelo: ${model} (${apiVersion})`);
      return NextResponse.json({ reply });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[api/assistente] Falha com ${model}:`, lastError.slice(0, 150));
    }
  }

  return NextResponse.json(
    { error: "Assistente temporariamente indisponível. Tente novamente em instantes." },
    { status: 502 }
  );
}
