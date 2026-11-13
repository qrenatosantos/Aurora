/** CATÁLOGO ▸ Drinks e receitas: o que aparece no cardápio da proposta e quanto de cada insumo vai em 1 drink. */
import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarDrinks } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { DrinkInsumo, Insumo } from "@/lib/tipos";
import { AbasCatalogo } from "../abas";
import { ListaDrinks } from "./drinks";

export const metadata: Metadata = { title: "Drinks e receitas" };

export default async function PaginaDrinks() {
  const supabase = await createClient();
  const [{ perfil }, drinks, insumosR, receitasR] = await Promise.all([
    obterPerfil(),
    listarDrinks(),
    supabase.from("insumos").select("*").order("nome"),
    supabase.from("drink_insumos").select("*"),
  ]);
  return (
    <>
      <CabecalhoPagina titulo="Catálogo" descricao="Nome e descrição vão para o cardápio da proposta. A receita alimenta a calculadora de insumos." />
      <AbasCatalogo atual="/catalogo/drinks" />
      <ListaDrinks drinks={drinks} insumos={(insumosR.data ?? []) as Insumo[]} receitas={(receitasR.data ?? []) as DrinkInsumo[]} gestor={ehGestor(perfil)} />
    </>
  );
}
