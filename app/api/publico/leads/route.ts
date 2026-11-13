/**
 * ENTRADA DE LEADS DO SITE — POST /api/publico/leads
 *
 * O formulário de orçamento do site envia o pedido para cá (além de abrir o WhatsApp).
 * A função do banco receber_lead_site valida, limita a quantidade de pedidos, evita
 * duplicar e cria contato + negócio em "Novo lead" + evento, com a origem "Site".
 * A resposta traz só o código do pedido (para ir na mensagem do WhatsApp).
 *
 * Só aceita pedidos vindos dos endereços do site (lista abaixo, ou a variável
 * ORIGENS_DO_SITE separada por vírgula). Trecho pronto para o site: integracao-site/.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { ipDoPedido } from "@/lib/ip";
import { obterEnvSupabase, supabaseConfigurado } from "@/lib/supabase/env";
import type { Database, Json } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const ORIGENS_PADRAO = ["https://aurorabartendersaraxa.com.br", "https://www.aurorabartendersaraxa.com.br", "https://aurorabartenders.pages.dev"];

function origensAceitas() {
  const extra = (process.env.ORIGENS_DO_SITE ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return new Set([...ORIGENS_PADRAO, ...extra]);
}

function cors(origem: string | null) {
  const aceita = origem && origensAceitas().has(origem.replace(/\/+$/, "")) ? origem : null;
  return {
    aceita,
    cabecalhos: {
      ...(aceita ? { "Access-Control-Allow-Origin": aceita, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
    } as Record<string, string>,
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")).cabecalhos });
}

export async function POST(req: NextRequest) {
  const origem = req.headers.get("origin");
  const { aceita, cabecalhos } = cors(origem);
  const responder = (corpo: unknown, status: number) => NextResponse.json(corpo, { status, headers: cabecalhos });
  // navegadores sempre mandam "Origin" em pedidos de outro site; sem ele (ou de outro site), recusa
  if (!aceita) return responder({ ok: false, mensagem: "Origem não autorizada." }, 403);
  if (!supabaseConfigurado) return responder({ ok: false, mensagem: "Sistema ainda não configurado." }, 503);

  const texto = await req.text();
  if (texto.length > 6000) return responder({ ok: false, mensagem: "Pedido grande demais." }, 413);
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    return responder({ ok: false, mensagem: "Pedido inválido." }, 400);
  }
  if (typeof dados !== "object" || dados === null || Array.isArray(dados)) return responder({ ok: false, mensagem: "Pedido inválido." }, 400);

  const { url, chave } = obterEnvSupabase();
  const supabase = criarClienteSupabase<Database>(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("receber_lead_site", { p: dados as Json, p_ip: ipDoPedido(req.headers) });
  if (error) {
    console.error("[receber_lead_site]", error.message);
    return responder({ ok: false, mensagem: "Não foi possível registrar o pedido agora." }, 502);
  }
  const r = (data ?? {}) as { ok?: boolean; codigo?: string; mensagem?: string };
  return responder(r.ok ? { ok: true, codigo: r.codigo ?? null } : { ok: false, mensagem: r.mensagem ?? "Não foi possível registrar o pedido." }, r.ok ? 200 : 422);
}
