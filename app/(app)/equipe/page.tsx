/** EQUIPE (só o gestor): vendedores, papéis, equipes e quem já entrou no sistema. */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina, Cartao } from "@/components/ui/cartao";
import { listarEquipes, listarVendedores } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { Equipe } from "./equipe";

export const metadata: Metadata = { title: "Equipe" };

export default async function PaginaEquipe() {
  const [{ perfil }, vendedores, equipes] = await Promise.all([obterPerfil(), listarVendedores(), listarEquipes()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  return (
    <>
      <CabecalhoPagina titulo="Equipe" descricao="Quem usa o sistema, com que papel e em qual equipe." />
      <Cartao className="mb-4 text-sm text-texto-2">
        <strong className="text-texto">Como dar acesso:</strong> 1) cadastre o vendedor aqui com o e-mail dele; 2) no Supabase, em Authentication ▸ Users ▸
        Add user, crie o login com o MESMO e-mail (marque Auto Confirm User). No 1º acesso o sistema liga os dois sozinho. Vendedores veem e editam só os
        próprios contatos e negócios (mude em Configurações ▸ “Vendedores veem tudo”). Para tirar o acesso, desmarque “Ativo”.
      </Cartao>
      <Equipe vendedores={vendedores} equipes={equipes} meuId={perfil?.id ?? null} />
    </>
  );
}
