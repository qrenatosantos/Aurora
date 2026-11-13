/**
 * Configurações (só o gestor) — LEITURA no servidor e GRAVAÇÃO via Server Action
 * (./actions.ts) chamada pelo formulário (./form-configuracoes.tsx).
 */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { AbasConfiguracoes } from "./abas";
import { FormConfiguracoes } from "./form-configuracoes";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  const [config, { perfil }] = await Promise.all([obterConfiguracoes(), obterPerfil()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Dados da empresa (aparecem nas propostas) e regras comerciais." />
      <AbasConfiguracoes atual="/configuracoes" />
      {/* key: quando os dados mudam no servidor, o formulário reinicia com os valores novos */}
      <FormConfiguracoes key={config.updated_at} config={config} />
    </>
  );
}
