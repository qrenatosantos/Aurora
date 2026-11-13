/**
 * Endereço de internet (IP) de quem fez o pedido. No Cloudflare vem em "cf-connecting-ip";
 * em outros provedores, no 1º item de "x-forwarded-for".
 */
export function ipDoPedido(h: Headers): string | null {
  const ip = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim().slice(0, 45);
  return ip || null;
}
