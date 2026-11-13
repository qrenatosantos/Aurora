/**
 * Consultas reaproveitadas por várias telas (sempre no servidor, respeitando o RLS).
 * `cache()` = uma consulta por requisição, mesmo que várias partes da página peçam.
 */
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todasAsLinhas } from "@/lib/paginar";
import { obterConfiguracoes } from "@/lib/configuracoes";
import type { Drink, Equipe, Etapa, Funil, ModeloMensagem, MotivoPerda, Origem, Pacote, Produto, Vendedor } from "@/lib/tipos";

function log(onde: string, error: { message: string } | null) {
  if (error) console.error(`[${onde}]`, error.message);
}

/** Vendedores (ativos primeiro). */
export const listarVendedores = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vendedores").select("*").order("ativo", { ascending: false }).order("nome");
  log("vendedores", error);
  return (data ?? []) as Vendedor[];
});

export const listarEquipes = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("equipes").select("*").order("nome");
  log("equipes", error);
  return (data ?? []) as Equipe[];
});

/** Funis (ativos) com as etapas em ordem. */
export const listarFunis = cache(async () => {
  const supabase = await createClient();
  const [f, e] = await Promise.all([
    supabase.from("funis").select("*").order("ordem").order("nome"),
    supabase.from("etapas").select("*").order("ordem"),
  ]);
  log("funis", f.error);
  log("etapas", e.error);
  const etapas = (e.data ?? []) as Etapa[];
  return ((f.data ?? []) as Funil[]).map((funil) => ({ ...funil, etapas: etapas.filter((x) => x.funil_id === funil.id) }));
});
export type FunilComEtapas = Funil & { etapas: Etapa[] };

export const listarOrigens = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("origens").select("*").order("ordem").order("nome");
  log("origens", error);
  return (data ?? []) as Origem[];
});

export const listarMotivosPerda = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("motivos_perda").select("*").order("ordem").order("nome");
  log("motivos_perda", error);
  return (data ?? []) as MotivoPerda[];
});

export const listarProdutos = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  log("produtos", error);
  return (data ?? []) as Produto[];
});

/** Pacotes do catálogo (em ordem). */
export const listarPacotes = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pacotes").select("*").order("ordem").order("nome");
  log("pacotes", error);
  return (data ?? []) as Pacote[];
});

/** Drinks do catálogo (em ordem). */
export const listarDrinks = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("drinks").select("*").order("ordem").order("nome");
  log("drinks", error);
  return (data ?? []) as Drink[];
});

export const listarModelos = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("modelos_mensagem").select("*").order("ordem").order("titulo");
  log("modelos_mensagem", error);
  return (data ?? []) as ModeloMensagem[];
});

/** Mapa id → nome (para mostrar nomes sem consultas extras). */
export function mapaNomes<T extends { id: string; nome: string }>(lista: T[]) {
  return new Map(lista.map((x) => [x.id, x.nome]));
}

/** Divide uma lista em pedaços (o filtro .in() vai na URL: pedaços de 100 evitam URLs gigantes). */
function pedacos<T>(lista: T[], tamanho = 100) {
  const saida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho));
  return saida;
}

type ContatoCurto = { id: string; nome: string; telefone: string | null; email: string | null };

/** Nomes de contatos e empresas citados numa lista (consultas em pedaços de 100). */
export async function nomesClientes(ids: { contatos: (string | null)[]; empresas: (string | null)[] }) {
  const supabase = await createClient();
  const cts = Array.from(new Set(ids.contatos.filter((x): x is string => Boolean(x))));
  const ems = Array.from(new Set(ids.empresas.filter((x): x is string => Boolean(x))));
  const [c, e] = await Promise.all([
    Promise.all(pedacos(cts).map((p) => supabase.from("contatos").select("id, nome, telefone, email").in("id", p))),
    Promise.all(pedacos(ems).map((p) => supabase.from("empresas").select("id, nome").in("id", p))),
  ]);
  return {
    contatos: new Map(c.flatMap((r) => (r.data ?? []) as ContatoCurto[]).map((x) => [x.id, x])),
    empresas: new Map(e.flatMap((r) => r.data ?? []).map((x) => [x.id, x.nome])),
  };
}

/** Opções do formulário de negócio (funis, contatos, empresas, origens, vendedores). */
export async function opcoesNegocio(perfil: Vendedor | null) {
  const supabase = await createClient();
  const [config, funis, origens, vendedores, contatos, empresas] = await Promise.all([
    obterConfiguracoes(),
    listarFunis(),
    listarOrigens(),
    listarVendedores(),
    todasAsLinhas((de, ate) => supabase.from("contatos").select("id, nome, empresa_id").order("nome").order("id").range(de, ate)),
    todasAsLinhas((de, ate) => supabase.from("empresas").select("id, nome").order("nome").order("id").range(de, ate)),
  ]);
  return {
    funis,
    origens: origens.filter((o) => o.ativo).map((o) => ({ id: o.id, nome: o.nome })),
    // o Agente SDR é um "vendedor" sem login: nunca é dono de negócio
    vendedores: vendedores.filter((v) => v.ativo && v.tipo !== "agente").map((v) => ({ id: v.id, nome: v.nome })),
    contatos,
    empresas,
    gestor: perfil?.papel === "gestor",
    meuId: perfil?.id ?? null,
    modEmpresas: config.mod_empresas,
    variosFunis: config.mod_funis,
  };
}

/** Hora atual no servidor (passada para os componentes: a tela não muda entre servidor e navegador). */
export function agoraServidor() {
  return Date.now();
}

/** Opções dos formulários de contato/empresa. */
export async function opcoesCadastro(perfil: Vendedor | null) {
  const supabase = await createClient();
  const [origens, vendedores, empresas] = await Promise.all([
    listarOrigens(),
    listarVendedores(),
    todasAsLinhas((de, ate) => supabase.from("empresas").select("id, nome").order("nome").order("id").range(de, ate)),
  ]);
  return {
    empresas,
    origens: origens.filter((o) => o.ativo).map((o) => ({ id: o.id, nome: o.nome })),
    vendedores: vendedores.filter((v) => v.ativo && v.tipo !== "agente").map((v) => ({ id: v.id, nome: v.nome })),
    gestor: perfil?.papel === "gestor",
    meuId: perfil?.id ?? null,
  };
}
