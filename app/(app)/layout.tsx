/**
 * Layout de TODAS as páginas logadas (pasta app/(app)/ — o "(app)" não aparece na URL).
 * Monta o "app shell": sidebar (computador), barra inferior (celular) e o topo
 * com a logo e o nome exibido (tela Personalização). As cores/fonte da marca
 * já são aplicadas pelo layout raiz (app/layout.tsx).
 */
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/shell/bottom-nav";
import { MenuUsuario } from "@/components/shell/menu-usuario";
import { Sidebar } from "@/components/shell/sidebar";
import { LogoNegocio } from "@/components/logo-negocio";
import { TemaToggle } from "@/components/ui/tema-toggle";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { SUBTITULO_PADRAO_MENU } from "@/lib/marca";
import { obterMarca } from "@/lib/marca-servidor";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { UserX } from "lucide-react";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  // Segunda barreira (a primeira é o proxy.ts): sem sessão, volta para o login.
  if (!data?.claims) redirect("/login");

  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  const [config, marca, { perfil, erro: erroPerfil }] = await Promise.all([
    obterConfiguracoes(),
    obterMarca(),
    obterPerfil(),
  ]);
  const bloqueado = perfil !== null && !perfil.ativo;
  const gestor = ehGestor(perfil);
  const dadosMarca = {
    nome: marca.nome,
    subtitulo: marca.subtitulo ?? SUBTITULO_PADRAO_MENU,
    logoUrl: marca.logoUrl,
  };

  return (
    <>
      <Sidebar marca={dadosMarca} gestor={gestor} />

      <div className="md:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-borda bg-fundo/90 px-4 backdrop-blur sm:px-6 nao-imprimir">
          <LogoNegocio nome={marca.nome} logoUrl={marca.logoUrl} className="md:hidden" />
          <p className="min-w-0 flex-1 truncate font-semibold text-texto md:font-medium md:text-texto-2">
            {marca.nome}
          </p>
          <TemaToggle />
          <MenuUsuario email={email} nome={perfil?.nome} gestor={gestor} />
        </header>

        {config.erro && (
          <div role="alert" className="mx-4 mt-4 rounded-xl bg-alerta-suave p-3 text-sm text-alerta sm:mx-6">
            Não foi possível ler a tabela <code>configuracoes</code>. Rode o arquivo{" "}
            <code>supabase/schema.sql</code> no SQL Editor do Supabase.
          </div>
        )}

        {!config.erro && erroPerfil && (
          <div role="alert" className="mx-4 mt-4 rounded-xl bg-alerta-suave p-3 text-sm text-alerta sm:mx-6">
            Não foi possível carregar o seu cadastro de vendedor (função <code>meu_perfil</code>). Rode o arquivo{" "}
            <code>supabase/schema.sql</code> no SQL Editor do Supabase.
          </div>
        )}

        <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:pb-10">
          {bloqueado ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-borda bg-superficie px-6 py-12 text-center">
              <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-perigo-suave text-perigo">
                <UserX className="size-7" aria-hidden />
              </div>
              <h1 className="text-lg font-semibold text-texto">Seu acesso está desativado</h1>
              <p className="mt-1 max-w-sm text-sm text-texto-2">
                Só vendedores ativos acessam o sistema comercial. Fale com o gestor da sua empresa.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <BottomNav marca={dadosMarca} gestor={gestor} />
    </>
  );
}
