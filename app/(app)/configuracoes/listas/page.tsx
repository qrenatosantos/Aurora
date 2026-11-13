/** Configurações ▸ Origens do lead e motivos de perda (só o gestor). */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarMotivosPerda, listarOrigens } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { AbasConfiguracoes } from "../abas";
import { EditorLista } from "./editor-lista";

export const metadata: Metadata = { title: "Origens e motivos" };

export default async function PaginaListas() {
  const [{ perfil }, origens, motivos] = await Promise.all([obterPerfil(), listarOrigens(), listarMotivosPerda()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Listas usadas nos cadastros e nos relatórios." />
      <AbasConfiguracoes atual="/configuracoes/listas" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EditorLista tabela="origens" titulo="Origens do lead" ajuda="De onde vêm os clientes. O relatório mostra quais origens mais convertem." itens={origens} />
        <EditorLista tabela="motivos_perda" titulo="Motivos de perda" ajuda="Obrigatório ao marcar um negócio como perdido." itens={motivos} />
      </div>
    </>
  );
}
