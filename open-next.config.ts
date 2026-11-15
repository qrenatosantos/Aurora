// Adaptador do Next.js para o Cloudflare Workers (OpenNext).
// O sistema é todo dinâmico (cada tela lê o banco na hora), então não usa cache de páginas.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig({}),
  // "npm run build" chama o OpenNext (ver package.json); aqui o OpenNext chama o Next direto,
  // para não entrar em repetição.
  buildCommand: "npx next build",
};

export default config;
