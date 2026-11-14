/**
 * Endereço do site (ex.: https://app.aurorabartendersaraxa.com.br), para montar links completos
 * como o da proposta pública. Lido do próprio pedido: funciona no Cloudflare e no localhost
 * sem configurar nada.
 */
import "server-only";
import { headers } from "next/headers";

export async function urlDoSite() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocolo.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}
