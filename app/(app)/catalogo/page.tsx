/** CATÁLOGO ▸ Pacotes: Essencial, Signature, Reserve, Exclusive... e os drinks de cada um. */
import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarDrinks, listarPacotes } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { PacoteDrink } from "@/lib/tipos";
import { AbasCatalogo } from "./abas";
import { ListaPacotes } from "./pacotes";

export const metadata: Metadata = { title: "Catálogo" };

export default async function PaginaCatalogo() {
  const supabase = await createClient();
  const [{ perfil }, pacotes, drinks, pd] = await Promise.all([
    obterPerfil(),
    listarPacotes(),
    listarDrinks(),
    supabase.from("pacote_drinks").select("*").order("ordem"),
  ]);
  return (
    <>
      <CabecalhoPagina titulo="Catálogo" descricao="Pacotes, drinks, insumos e as regras de preço. É daqui que saem o cardápio e o valor das propostas." />
      <AbasCatalogo atual="/catalogo" />
      <ListaPacotes pacotes={pacotes} drinks={drinks} ligacoes={(pd.data ?? []) as PacoteDrink[]} gestor={ehGestor(perfil)} />
    </>
  );
}
