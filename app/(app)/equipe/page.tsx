/** EQUIPE (só o gestor): quem entra no sistema, com que papel; o agente aparece como um atendente à parte. */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina, Cartao } from "@/components/ui/cartao";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { listarEquipes, listarVendedores } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { Equipe } from "./equipe";

export const metadata: Metadata = { title: "Equipe" };

export default async function PaginaEquipe() {
  const [{ perfil }, vendedores, equipes, config] = await Promise.all([obterPerfil(), listarVendedores(), listarEquipes(), obterConfiguracoes()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  return (
    <>
      <CabecalhoPagina titulo="Equipe" descricao="Quem entra no sistema e com que papel." />
      <Cartao className="mb-4 text-sm text-texto-2">
        <strong className="text-texto">Como dar acesso a uma pessoa:</strong> 1) cadastre-a aqui com o e-mail dela; 2) no Supabase, em Authentication ▸ Users ▸
        Add user, crie o login com o MESMO e-mail (marque Auto Confirm User). No primeiro acesso o sistema liga os dois sozinho. Só quem tem o papel{" "}
        <strong className="text-texto">Gestor</strong> aprova propostas, muda preços e vê Integrações e Auditoria. Para tirar o acesso, desmarque “Ativo”.
      </Cartao>
      <Equipe vendedores={vendedores} equipes={equipes} meuId={perfil?.id ?? null} mostrarEquipes={config.mod_equipe} />
    </>
  );
}
