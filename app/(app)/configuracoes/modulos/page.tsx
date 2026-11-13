/** Configurações ▸ Módulos e dados: liga/desliga partes da base e define o prazo de guarda (LGPD). */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { AbasConfiguracoes } from "../abas";
import { FormModulos } from "./form-modulos";

export const metadata: Metadata = { title: "Módulos e dados" };

export default async function PaginaModulos() {
  const [config, { perfil }] = await Promise.all([obterConfiguracoes(), obterPerfil()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Partes do sistema que ficam ligadas e por quanto tempo os dados são guardados." />
      <AbasConfiguracoes atual="/configuracoes/modulos" />
      <FormModulos key={config.updated_at} config={config} />
    </>
  );
}
