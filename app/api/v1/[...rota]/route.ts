/**
 * API DO AGENTE — porta de entrada HTTP: /api/v1/...
 *
 * Este arquivo só traduz o pedido (método, endereço, consulta e corpo JSON) para uma
 * AÇÃO e chama a função do banco api_agente(chave, ação, dados). Quem confere a chave,
 * as permissões, o limite por minuto e as regras de negócio é O BANCO, e é lá que
 * cada chamada fica registrada. Aqui não há nenhuma chave secreta do sistema.
 *
 *   Authorization: Bearer aur_...     (chave criada em Integrações)
 *
 * Tabela de rotas: lib/api/rotas-agente.ts · Documentação: docs/API-DO-AGENTE.md
 */
import { type NextRequest, NextResponse } from "next/server";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { acharRota, caminhoExiste } from "@/lib/api/rotas-agente";
import { documentoOpenApi } from "@/lib/api/openapi";
import { ipDoPedido } from "@/lib/ip";
import { obterEnvSupabase, supabaseConfigurado } from "@/lib/supabase/env";
import type { Database, Json } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const CABECALHOS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function erro(status: number, codigo: string, mensagem: string) {
  return NextResponse.json({ erro: { codigo, mensagem } }, { status, headers: CABECALHOS });
}

function urlBase(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host.split(",")[0].trim()}`;
}

async function atender(req: NextRequest, contexto: { params: Promise<{ rota: string[] }> }) {
  const { rota: partes } = await contexto.params;

  // documentação em formato de máquina (pública: não tem dado nenhum)
  if (req.method === "GET" && partes.length === 1 && partes[0] === "openapi.json") {
    return NextResponse.json(documentoOpenApi(urlBase(req)), { headers: { "Cache-Control": "public, max-age=300" } });
  }
  if (!supabaseConfigurado) return erro(503, "indisponivel", "Sistema ainda não configurado.");

  const autorizacao = req.headers.get("authorization") ?? "";
  const chave = autorizacao.toLowerCase().startsWith("bearer ") ? autorizacao.slice(7).trim() : "";
  if (!chave) return erro(401, "chave_ausente", "Envie a chave no cabeçalho: Authorization: Bearer aur_...");

  const achada = acharRota(req.method, partes);
  if (!achada) {
    return caminhoExiste(partes)
      ? erro(405, "metodo_nao_permitido", "Este endereço existe, mas não aceita esse método.")
      : erro(404, "rota_desconhecida", "Endereço desconhecido. Veja a lista em /api/v1/openapi.json.");
  }

  // dados = consulta (?a=b) + corpo JSON + trechos do endereço (nessa ordem de prioridade)
  let dados: Record<string, unknown> = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (req.method !== "GET") {
    const texto = await req.text();
    if (texto.length > 200_000) return erro(413, "corpo_grande", "Corpo do pedido grande demais (limite de 200 KB).");
    if (texto.trim() !== "") {
      try {
        const corpo = JSON.parse(texto) as unknown;
        if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return erro(400, "dados_invalidos", "O corpo precisa ser um objeto JSON.");
        dados = { ...dados, ...(corpo as Record<string, unknown>) };
      } catch {
        return erro(400, "json_invalido", "O corpo do pedido não é um JSON válido.");
      }
    }
  }
  dados = { ...dados, ...achada.dados };

  const { url, chave: chavePublica } = obterEnvSupabase();
  const supabase = criarClienteSupabase<Database>(url, chavePublica, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("api_agente", {
    p_chave: chave,
    p_acao: achada.rota.acao,
    p_dados: dados as Json,
    p_meta: { ip: ipDoPedido(req.headers), base_url: urlBase(req) },
  });
  if (error) {
    console.error("[api_agente]", error.message);
    return erro(502, "banco_indisponivel", "Não foi possível falar com o banco de dados agora. Tente de novo em instantes.");
  }
  const r = (data ?? {}) as { status?: number; dados?: unknown; erro?: { codigo: string; mensagem: string } };
  const status = Number(r.status) || 500;
  return NextResponse.json(status >= 400 ? { erro: r.erro } : { dados: r.dados ?? null }, { status, headers: CABECALHOS });
}

export { atender as GET, atender as POST, atender as PATCH, atender as PUT };
