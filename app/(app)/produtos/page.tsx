/** PRODUTOS E SERVIÇOS: preço, unidade e desconto máximo permitido. */
import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarProdutos } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { ListaProdutos } from "./lista-produtos";
import { redirect } from "next/navigation";
import { obterConfiguracoes } from "@/lib/configuracoes";

export const metadata: Metadata = { title: "Produtos e serviços" };

export default async function PaginaProdutos() {
  // Na Aurora o que se vende está em Catálogo (pacotes e drinks). Esta lista de produtos avulsos
  // só serve às regras de comissão por produto.
  if (!(await obterConfiguracoes()).mod_comissoes) redirect("/catalogo");
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
