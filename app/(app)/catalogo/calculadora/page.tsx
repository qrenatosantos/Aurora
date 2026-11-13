/**
 * CATÁLOGO ▸ Calculadora: parâmetros (consumo, equipe, margem), o que falta preencher,
 * aprovação das regras de preço e um simulador com lista de compras.
 */
import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { listarPacotes, listarVendedores } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Calculadora } from "@/lib/tipos";
import { AbasCatalogo } from "../abas";
import { TelaCalculadora } from "./calculadora";

export const metadata: Metadata = { title: "Calculadora" };

export default async function PaginaCalculadora() {
  const supabase = await createClient();
  const [{ perfil }, pacotes, vendedores, calcR, pendR] = await Promise.all([
    obterPerfil(),
    listarPacotes(),
    listarVendedores(),
    supabase.from("calculadora").select("*").limit(1).maybeSingle(),
    supabase.rpc("calculadora_pendencias"),
  ]);
  const calc = calcR.data as Calculadora | null;
  return (
    <>
      <CabecalhoPagina
        titulo="Catálogo"
        descricao="O preço sugerido sai do custo dos insumos do cardápio, da mão de obra, dos custos fixos e da margem."
      />
      <AbasCatalogo atual="/catalogo/calculadora" />
      <TelaCalculadora
        key={calc?.updated_at ?? "nova"}
        calc={calc}
        pendencias={(pendR.data ?? []) as string[]}
        pacotes={pacotes.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))}
        aprovador={vendedores.find((v) => v.id === calc?.aprovada_por)?.nome ?? null}
        gestor={ehGestor(perfil)}
      />
    </>
  );
}
