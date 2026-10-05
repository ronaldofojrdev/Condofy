import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DashboardRole = "SINDICO" | "PORTEIRO" | "MORADOR";

type ProfileRow = {
  condominio_id: string;
  role: DashboardRole;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabaseAuth = getSupabaseAuthClient();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAuth || !supabaseAdmin) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

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
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  if (profile.role !== "SINDICO") {
    return NextResponse.json({ error: "Acesso restrito ao síndico." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") ?? "";
  const inicio = searchParams.get("inicio") ?? "";
  const fim = searchParams.get("fim") ?? "";
  const condominioId = profile.condominio_id;

  switch (tipo) {
    case "moradores": {
      const { data, error } = await supabaseAdmin
        .from("perfis_usuario")
        .select("unidade_id, usuarios(nome, email), unidades(numero, bloco:blocos(nome))")
        .eq("condominio_id", condominioId)
        .eq("role", "MORADOR")
        .eq("ativo", true)
        .order("unidade_id");

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const rows = (data ?? []).map((r: any) => {
        const usuario = Array.isArray(r.usuarios) ? r.usuarios[0] : r.usuarios;
        const unidade = Array.isArray(r.unidades) ? r.unidades[0] : r.unidades;
        const bloco = Array.isArray(unidade?.bloco) ? unidade?.bloco[0] : unidade?.bloco;
        return {
          Nome: usuario?.nome ?? "",
          Email: usuario?.email ?? "",
          Unidade: unidade?.numero ?? "",
          Bloco: bloco?.nome ?? ""
        };
      });

      return NextResponse.json({ rows, filename: "moradores" });
    }

    case "cobrancas": {
      let query = supabaseAdmin
        .from("cobrancas")
        .select("descricao, tipo, valor, vencimento, status, pago_em, unidade:unidades(numero)")
        .eq("condominio_id", condominioId)
        .order("vencimento", { ascending: false });

      if (inicio) query = query.gte("vencimento", inicio);
      if (fim) query = query.lte("vencimento", fim);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const TIPO_MAP: Record<string, string> = { TAXA_MENSAL: "Taxa Mensal", MULTA: "Multa", EXTRA: "Taxa Extra" };
      const STATUS_MAP: Record<string, string> = { PENDENTE: "Pendente", PAGO: "Pago", ATRASADO: "Atrasado" };

      const rows = (data ?? []).map((r: any) => {
        const unidade = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
        return {
          Unidade: unidade?.numero ?? "",
          Descrição: r.descricao,
          Tipo: TIPO_MAP[r.tipo] ?? r.tipo,
          "Valor (R$)": Number(r.valor).toFixed(2),
          Vencimento: r.vencimento,
          Status: STATUS_MAP[r.status] ?? r.status,
          "Pago em": r.pago_em ? r.pago_em.slice(0, 10) : ""
        };
      });

      return NextResponse.json({ rows, filename: "cobrancas" });
    }

    case "inadimplencia": {
      const { data, error } = await supabaseAdmin
        .from("cobrancas")
        .select("descricao, tipo, valor, vencimento, unidade:unidades(numero, perfis_usuario(usuarios(nome)))")
        .eq("condominio_id", condominioId)
        .eq("status", "ATRASADO")
        .order("vencimento", { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const rows = (data ?? []).map((r: any) => {
        const unidade = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
        const perfis = unidade?.perfis_usuario ?? [];
        const morador = perfis.find((p: any) => p) ?? null;
        const usuario = Array.isArray(morador?.usuarios) ? morador?.usuarios[0] : morador?.usuarios;
        return {
          Morador: usuario?.nome ?? "Sem morador",
          Unidade: unidade?.numero ?? "",
          Descrição: r.descricao,
          "Valor (R$)": Number(r.valor).toFixed(2),
          Vencimento: r.vencimento,
        };
      });

      return NextResponse.json({ rows, filename: "inadimplencia" });
    }

    case "entregas": {
      let query = supabaseAdmin
        .from("entregas")
        .select("remetente, descricao, status, criado_em, retirado_em, unidade:unidades(numero)")
        .eq("condominio_id", condominioId)
        .order("criado_em", { ascending: false });

      if (inicio) query = query.gte("criado_em", `${inicio}T00:00:00`);
      if (fim) query = query.lte("criado_em", `${fim}T23:59:59`);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const rows = (data ?? []).map((r: any) => {
        const unidade = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
        return {
          Unidade: unidade?.numero ?? "",
          Remetente: r.remetente ?? "",
          Descrição: r.descricao ?? "",
          Status: r.status === "PENDENTE" ? "Aguardando retirada" : "Retirado",
          "Registrado em": r.criado_em ? r.criado_em.slice(0, 16).replace("T", " ") : "",
          "Retirado em": r.retirado_em ? r.retirado_em.slice(0, 16).replace("T", " ") : ""
        };
      });

      return NextResponse.json({ rows, filename: "entregas" });
    }

    case "ocorrencias": {
      let query = supabaseAdmin
        .from("ocorrencias")
        .select("tipo, descricao, status, anonima, criado_em, atualizado_em, unidade:unidades(numero)")
        .eq("condominio_id", condominioId)
        .order("criado_em", { ascending: false });

      if (inicio) query = query.gte("criado_em", `${inicio}T00:00:00`);
      if (fim) query = query.lte("criado_em", `${fim}T23:59:59`);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const TIPO_MAP: Record<string, string> = {
        BARULHO: "Barulho", DANO: "Dano", SEGURANCA: "Segurança",
        MANUTENCAO: "Manutenção", OUTRO: "Outro"
      };
      const STATUS_MAP: Record<string, string> = {
        ABERTA: "Aberta", EM_ANDAMENTO: "Em andamento", RESOLVIDA: "Resolvida"
      };

      const rows = (data ?? []).map((r: any) => {
        const unidade = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
        return {
          Unidade: unidade?.numero ?? "",
          Tipo: TIPO_MAP[r.tipo] ?? r.tipo,
          Descrição: r.anonima ? "(anônima)" : r.descricao,
          Status: STATUS_MAP[r.status] ?? r.status,
          "Registrado em": r.criado_em ? r.criado_em.slice(0, 16).replace("T", " ") : "",
          "Atualizado em": r.atualizado_em ? r.atualizado_em.slice(0, 16).replace("T", " ") : ""
        };
      });

      return NextResponse.json({ rows, filename: "ocorrencias" });
    }

    case "reservas": {
      let query = supabaseAdmin
        .from("reservas_salao")
        .select("data_reserva, horario_inicio, horario_fim, status, motivo_rejeicao, criado_em, salao:saloes(nome), solicitante:usuarios(nome)")
        .eq("condominio_id", condominioId)
        .order("data_reserva", { ascending: false });

      if (inicio) query = query.gte("data_reserva", inicio);
      if (fim) query = query.lte("data_reserva", fim);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const STATUS_MAP: Record<string, string> = {
        PENDENTE: "Pendente", APROVADO: "Aprovado", REJEITADO: "Rejeitado", CANCELADO: "Cancelado"
      };

      const rows = (data ?? []).map((r: any) => {
        const salao = Array.isArray(r.salao) ? r.salao[0] : r.salao;
        const solicitante = Array.isArray(r.solicitante) ? r.solicitante[0] : r.solicitante;
        return {
          Salão: salao?.nome ?? "",
          Solicitante: solicitante?.nome ?? "",
          Data: r.data_reserva,
          Início: r.horario_inicio,
          Fim: r.horario_fim,
          Status: STATUS_MAP[r.status] ?? r.status,
          "Motivo rejeição": r.motivo_rejeicao ?? ""
        };
      });

      return NextResponse.json({ rows, filename: "reservas" });
    }

    default:
      return NextResponse.json({ error: "Tipo de relatório inválido." }, { status: 400 });
  }
}
