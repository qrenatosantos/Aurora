/** Configurações ▸ Propostas e agenda: condições comerciais, textos do documento, capacidade e atendimento. */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { AbasConfiguracoes } from "../abas";
import { FormAurora } from "./form-aurora";

export const metadata: Metadata = { title: "Propostas e agenda" };

export default async function PaginaConfigPropostas() {
  const [config, { perfil }] = await Promise.all([obterConfiguracoes(), obterPerfil()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Condições das propostas, textos do documento, agenda e atendimento." />
      <AbasConfiguracoes atual="/configuracoes/propostas" />
      <FormAurora key={config.updated_at} config={config} />
    </>
  );
}
