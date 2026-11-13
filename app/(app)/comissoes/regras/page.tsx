/** REGRAS DE COMISSÃO: % sobre o valor ganho, por vendedor e/ou produto, com faixas por valor. */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CabecalhoPagina, Cartao } from "@/components/ui/cartao";
import { listarProdutos, listarVendedores } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { RegraComissao } from "@/lib/tipos";
import { Regras } from "./regras";
import { ModuloDesligado } from "@/components/comercial/modulo-desligado";
import { obterConfiguracoes } from "@/lib/configuracoes";

export const metadata: Metadata = { title: "Regras de comissão" };

export default async function PaginaRegras() {
  const [configModulo, perfilModulo] = await Promise.all([obterConfiguracoes(), obterPerfil()]);
  if (!configModulo.mod_comissoes) return <ModuloDesligado nome="Comissões" gestor={Boolean(ehGestor(perfilModulo.perfil))} />;
  const supabase = await createClient();
  const [{ perfil }, vendedores, produtos, { data }] = await Promise.all([
    obterPerfil(),
    listarVendedores(),
    listarProdutos(),
    supabase.from("regras_comissao").select("*").order("created_at"),
  ]);
  const gestor = ehGestor(perfil);
  return (
    <>
      <Link href="/comissoes" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden /> Comissões
      </Link>
      <CabecalhoPagina
        titulo="Regras de comissão"
        descricao={gestor ? "Defina quanto cada venda paga de comissão." : "As regras que valem para você."}
      />
      <Cartao className="mb-4 text-sm text-texto-2">
        <p>
          <strong className="text-texto">Como o sistema escolhe a regra:</strong> para cada produto do negócio ganho vale a regra mais específica — 1º
          vendedor + produto, 2º só o produto, 3º só o vendedor, 4º a regra geral. A <strong className="text-texto">faixa</strong> compara o valor total
          do negócio (ex.: 5% até R$ 50 mil, 4% acima). Sem regra, a comissão é zero.
        </p>
        <p className="mt-2">
          A comissão é recalculada sozinha se o negócio mudar <em>antes</em> de ser paga. Mudou uma regra? Em Comissões, use “Recalcular a pagar”.
        </p>
      </Cartao>
      <Regras
        regras={(data ?? []) as RegraComissao[]}
        vendedores={vendedores.filter((v) => v.ativo).map((v) => ({ id: v.id, nome: v.nome }))}
        produtos={produtos.map((p) => ({ id: p.id, nome: p.nome }))}
        gestor={gestor}
      />
    </>
  );
}
