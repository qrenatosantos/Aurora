/** Importar leads por CSV (mapeamento de colunas + detecção de duplicados). */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarOrigens, listarVendedores } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { Importador } from "./importador";

export const metadata: Metadata = { title: "Importar leads" };

export default async function PaginaImportar() {
  const [{ perfil }, vendedores, origens] = await Promise.all([obterPerfil(), listarVendedores(), listarOrigens()]);
  return (
    <>
      <Link href="/contatos" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden /> Contatos
      </Link>
      <CabecalhoPagina
        titulo="Importar leads (CSV)"
        descricao="Traga sua lista de contatos de uma planilha. Duplicados (mesmo e-mail ou telefone) são detectados antes de gravar."
      />
      <Importador
        gestor={ehGestor(perfil)}
        meuId={perfil?.id ?? null}
        vendedores={vendedores.filter((v) => v.ativo).map((v) => ({ id: v.id, nome: v.nome }))}
        origens={origens.filter((o) => o.ativo).map((o) => ({ id: o.id, nome: o.nome }))}
      />
    </>
  );
}
