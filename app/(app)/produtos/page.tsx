/** PRODUTOS E SERVIÇOS: preço, unidade e desconto máximo permitido. */
import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarProdutos } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { ListaProdutos } from "./lista-produtos";

export const metadata: Metadata = { title: "Produtos e serviços" };

export default async function PaginaProdutos() {
  const [{ perfil }, produtos] = await Promise.all([obterPerfil(), listarProdutos()]);
  return (
    <>
      <CabecalhoPagina
        titulo="Produtos e serviços"
        descricao="O que você vende. O desconto máximo vale para negócios e propostas: acima dele, só com aprovação do gestor."
      />
      <ListaProdutos produtos={produtos} gestor={ehGestor(perfil)} />
    </>
  );
}
