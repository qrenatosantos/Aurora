"use server";

/**
 * Aceite pelo PRÓPRIO CLIENTE, sem login. Chama a função do banco
 * aceitar_proposta_publica (security definer): trava a proposta, confere situação
 * e validade, e registra nome, data/hora, IP e navegador. Um aceite só.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { type EstadoAcao, falha, sucesso } from "@/lib/acoes";
import { createClient } from "@/lib/supabase/server";

export async function aceitarPeloLink(codigo: string, nome: string, concordo: boolean): Promise<EstadoAcao> {
  if (typeof codigo !== "string" || !/^[a-f0-9]{32}$/.test(codigo)) return falha("Link inválido.");
  const quem = typeof nome === "string" ? nome.trim().slice(0, 120) : "";
  if (quem.length < 3) return falha("Informe seu nome completo para registrar o aceite.", { nome: "Informe seu nome completo." });
  if (!concordo) return falha("Marque a caixa confirmando que leu e concorda com a proposta.", { concordo: "Confirme para aceitar." });

  const h = await headers();
  // Na Vercel o IP real do visitante vem no 1º item de x-forwarded-for
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim().slice(0, 45) || null;
  const navegador = (h.get("user-agent") ?? "").slice(0, 300) || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aceitar_proposta_publica", {
    p_codigo: codigo,
    p_nome: quem,
    p_ip: ip,
    p_navegador: navegador,
  });
  if (error) return falha("Não foi possível registrar o aceite agora. Tente de novo em instantes.");
  const r = (data ?? {}) as { ok?: boolean; mensagem?: string };
  revalidatePath(`/proposta/${codigo}`);
  return r.ok ? sucesso(r.mensagem ?? "Proposta aceita!") : falha(r.mensagem ?? "Não foi possível aceitar.");
}
