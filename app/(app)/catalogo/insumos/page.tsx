/** CATÁLOGO ▸ Insumos e preços: o que se compra para os drinks, com preço tradicional e premium. */
import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Insumo } from "@/lib/tipos";
import { AbasCatalogo } from "../abas";
import { ListaInsumos } from "./insumos";

export const metadata: Metadata = { title: "Insumos e preços" };

export default async function PaginaInsumos() {
  const supabase = await createClient();
  const [{ perfil }, { data }] = await Promise.all([obterPerfil(), supabase.from("insumos").select("*").order("categoria").order("nome")]);
  return (
    <>
      <CabecalhoPagina titulo="Catálogo" descricao="Bebidas, frutas e demais insumos. O preço é o da embalagem que você compra." />
      <AbasCatalogo atual="/catalogo/insumos" />
      <ListaInsumos insumos={(data ?? []) as Insumo[]} gestor={ehGestor(perfil)} />
    </>
  );
}
