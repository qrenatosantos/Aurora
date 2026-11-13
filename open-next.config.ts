// Adaptador do Next.js para o Cloudflare Workers (OpenNext).
// O sistema é todo dinâmico (cada tela lê o banco na hora), então não usa cache de páginas.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
