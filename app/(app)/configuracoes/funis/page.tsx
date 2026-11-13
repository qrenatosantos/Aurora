/** Configurações ▸ Funis e etapas (só o gestor). */
import type { Metadata } from "next";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { listarFunis } from "@/lib/dados";
import { todasAsLinhas } from "@/lib/paginar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { AbasConfiguracoes } from "../abas";
import { EditorFunis } from "./editor-funis";

export const metadata: Metadata = { title: "Funis e etapas" };

export default async function PaginaFunis() {
  const [{ perfil }, funis, config] = await Promise.all([obterPerfil(), listarFunis(), obterConfiguracoes()]);
  if (!ehGestor(perfil)) return <SoGestor />;
  const supabase = await createClient();
  const abertos = await todasAsLinhas<{ etapa_id: string }>((a, b) =>
    supabase.from("negocios").select("etapa_id").eq("status", "aberto").order("id").range(a, b),
  );
  const contagem: Record<string, number> = {};
  for (const n of abertos) contagem[n.etapa_id] = (contagem[n.etapa_id] ?? 0) + 1;
  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="As etapas por onde cada pedido passa, do primeiro contato ao fechamento." />
      <AbasConfiguracoes atual="/configuracoes/funis" />
      <EditorFunis funis={funis} contagem={contagem} variosFunis={config.mod_funis} />
    </>
  );
}
