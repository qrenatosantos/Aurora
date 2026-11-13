/** Configurações ▸ Modelos de mensagem do WhatsApp e e-mail (só o gestor). */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarModelos } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { AbasConfiguracoes } from "../abas";
import { Modelos } from "./modelos";

export const metadata: Metadata = { title: "Modelos de mensagem" };

export default async function PaginaMensagens() {
  const [{ perfil }, modelos] = await Promise.all([obterPerfil(), listarModelos()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Mensagens prontas que os vendedores usam no botão WhatsApp/E-mail de cada negócio e contato." />
      <AbasConfiguracoes atual="/configuracoes/mensagens" />
      <Modelos modelos={modelos} />
    </>
  );
}
