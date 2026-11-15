"use server";

/**
 * MUTATIONS do catálogo (só o gestor; o banco também confere): insumos, drinks com
 * receita, pacotes e parâmetros da calculadora. Mudar preço, receita, pacote ou
 * parâmetro DESFAZ a aprovação das regras de preço (regra no banco).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { lerMoeda } from "@/lib/formatar";
import { exigirGestor, exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoCalculo } from "@/lib/tipos";
import { caixa, ehUuid, idOpcional, textoObrigatorio, textoOpcional } from "@/lib/validacao";

function revalidar() {
  revalidatePath("/catalogo", "layout");
  revalidatePath("/");
}

const precoOpcional = z
  .string()
  .optional()
  .transform((v) => ((v ?? "").trim() === "" ? null : Math.round(lerMoeda(v) * 100) / 100))
  .refine((v) => v === null || (v >= 0 && v <= 999_999), "Valor inválido.");

const numero = (min: number, max: number, msg: string) =>
  z
    .string()
    .optional()
    .transform((v) => Number((v ?? "").trim().replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, msg);

const numeroOpcional = (min: number, max: number, msg: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().replace(",", "."))
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max), msg)
    .transform((v) => (v === "" ? null : Number(v)));

// ------------------------------------------------------------------ insumos
const esquemaInsumo = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 80, "Informe o nome do insumo."),
  categoria: z.enum(["destilado", "licor", "vinho", "fruta", "xarope", "suco", "refrigerante", "gelo", "guarnicao", "descartavel", "outro"]),
  unidade: z.enum(["ml", "g", "un"]),
  embalagem: numero(0.001, 1_000_000, "Informe quanto vem na embalagem (maior que zero)."),
  preco_tradicional: precoOpcional,
  preco_premium: precoOpcional,
  marca_tradicional: textoOpcional(80),
  marca_premium: textoOpcional(80),
  observacoes: textoOpcional(500),
  ativo: caixa,
});

export async function salvarInsumo(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaInsumo.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, ...d } = r.data;
  const supabase = await createClient();
  const { error, data } = id
    ? await supabase.from("insumos").update(d).eq("id", id).select("id")
    : await supabase.from("insumos").insert(d).select("id");
  if (error) return falha(error.message.includes("insumos_nome_uidx") ? "Já existe um insumo com esse nome." : mensagemErroBanco(error));
  if (!data?.length) return falha("Insumo não encontrado.");
  revalidar();
  return sucesso(id ? "Insumo salvo." : "Insumo cadastrado.");
}

export async function excluirInsumo(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Insumo inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("insumos").delete().eq("id", id);
  if (error) return falha(error.code === "23503" ? "Este insumo está na receita de algum drink. Tire-o das receitas antes de excluir (ou desative)." : mensagemErroBanco(error));
  revalidar();
  return sucesso("Insumo excluído.");
}

// ------------------------------------------------------------------ drinks (com receita)
const esquemaDrink = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 80, "Informe o nome do drink."),
  descricao: textoOpcional(300),
  categoria: z.enum(["classico", "premium", "sem_alcool", "autoral"]),
  alcoolico: caixa,
  copo: z.enum(["", "long_drink", "baixo", "caneca", "taca", "outro"]).transform((v) => (v === "" ? null : v)),
  foto_url: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || (v.length <= 500 && /^(https?:\/\/|\/)/.test(v)), "Use um endereço que comece com https:// (ou / para imagens do próprio sistema).")
    .transform((v) => (v === "" ? null : v)),
  ordem: numero(0, 9999, "Ordem inválida."),
  ativo: caixa,
  receita: z.string().optional(),
});

const esquemaReceita = z
  .array(z.object({ insumo_id: z.string().refine(ehUuid, "Insumo inválido."), quantidade: z.number().positive("Quantidade maior que zero.").max(100_000) }))
  .max(40, "Máximo de 40 insumos por drink.");

export async function salvarDrink(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaDrink.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  let receita: z.infer<typeof esquemaReceita> = [];
  try {
    const lida = esquemaReceita.safeParse(JSON.parse(r.data.receita || "[]"));
    if (!lida.success) return falha(lida.error.issues[0]?.message ?? "Receita inválida.");
    receita = lida.data;
  } catch {
    return falha("Receita inválida.");
  }
  if (new Set(receita.map((x) => x.insumo_id)).size !== receita.length) return falha("O mesmo insumo aparece duas vezes na receita.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, receita: _ignorar, ...d } = r.data;
  void _ignorar;
  const supabase = await createClient();
  const { error, data } = id
    ? await supabase.from("drinks").update({ ...d, ordem: Math.round(d.ordem) }).eq("id", id).select("id")
    : await supabase.from("drinks").insert({ ...d, ordem: Math.round(d.ordem) }).select("id");
  if (error) return falha(error.message.includes("drinks_nome_uidx") ? "Já existe um drink com esse nome." : mensagemErroBanco(error));
  const drinkId = data?.[0]?.id;
  if (!drinkId) return falha("Drink não encontrado.");

  // receita: só regrava se mudou (cada mudança desfaz a aprovação das regras de preço)
  const { data: atual } = await supabase.from("drink_insumos").select("insumo_id, quantidade").eq("drink_id", drinkId);
  const chave = (l: { insumo_id: string; quantidade: number }[]) =>
    l
      .map((x) => `${x.insumo_id}:${Number(x.quantidade)}`)
      .sort()
      .join("|");
  if (chave(atual ?? []) !== chave(receita)) {
    const { error: e1 } = await supabase.from("drink_insumos").delete().eq("drink_id", drinkId);
    if (e1) return falha(mensagemErroBanco(e1));
    if (receita.length) {
      const { error: e2 } = await supabase.from("drink_insumos").insert(receita.map((x) => ({ ...x, drink_id: drinkId })));
      if (e2) return falha(mensagemErroBanco(e2));
    }
  }
  revalidar();
  return sucesso(id ? "Drink salvo." : "Drink cadastrado.");
}

export async function excluirDrink(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Drink inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("drinks").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidar();
  return sucesso("Drink excluído. Propostas antigas mantêm o cardápio que tinham.");
}

// ------------------------------------------------------------------ pacotes
const esquemaPacote = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 60, "Informe o nome do pacote."),
  slogan: textoOpcional(160),
  descricao: textoOpcional(500),
  ordem: numero(0, 9999, "Ordem inválida."),
  acrescimo_pct: numero(0, 300, "De 0 a 300%."),
  ativo: caixa,
  drinks: z.string().optional(),
});

export async function salvarPacote(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaPacote.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  let drinks: string[] = [];
  try {
    const lida = z.array(z.string().refine(ehUuid)).max(30).safeParse(JSON.parse(r.data.drinks || "[]"));
    if (!lida.success) return falha("Lista de drinks inválida.");
    drinks = Array.from(new Set(lida.data));
  } catch {
    return falha("Lista de drinks inválida.");
  }
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, drinks: _ignorar, ...d } = r.data;
  void _ignorar;
  const supabase = await createClient();
  const { error, data } = id
    ? await supabase.from("pacotes").update({ ...d, ordem: Math.round(d.ordem) }).eq("id", id).select("id")
    : await supabase.from("pacotes").insert({ ...d, ordem: Math.round(d.ordem) }).select("id");
  if (error) return falha(error.message.includes("pacotes_nome_uidx") ? "Já existe um pacote com esse nome." : mensagemErroBanco(error));
  const pacoteId = data?.[0]?.id;
  if (!pacoteId) return falha("Pacote não encontrado.");

  const { data: atual } = await supabase.from("pacote_drinks").select("drink_id, ordem").eq("pacote_id", pacoteId).order("ordem");
  if ((atual ?? []).map((x) => x.drink_id).join("|") !== drinks.join("|")) {
    const { error: e1 } = await supabase.from("pacote_drinks").delete().eq("pacote_id", pacoteId);
    if (e1) return falha(mensagemErroBanco(e1));
    if (drinks.length) {
      const { error: e2 } = await supabase.from("pacote_drinks").insert(drinks.map((drink_id, i) => ({ pacote_id: pacoteId, drink_id, ordem: i + 1 })));
      if (e2) return falha(mensagemErroBanco(e2));
    }
  }
  revalidar();
  return sucesso(id ? "Pacote salvo." : "Pacote criado.");
}

export async function excluirPacote(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Pacote inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("pacotes").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidar();
  return sucesso("Pacote excluído.");
}

// ------------------------------------------------------------------ calculadora
const esquemaCalculadora = z.object({
  drinks_por_convidado_hora: numeroOpcional(0.01, 20, "De 0,01 a 20."),
  convidados_por_bartender: numeroOpcional(1, 1000, "De 1 a 1.000.").refine((v) => v === null || Number.isInteger(v), "Use número inteiro."),
  minimo_bartenders: numero(1, 50, "De 1 a 50.").refine((v) => Number.isInteger(v), "Use número inteiro."),
  custo_bartender_hora: precoOpcional,
  horas_montagem: numero(0, 24, "De 0 a 24 horas."),
  custo_fixo: precoOpcional.transform((v) => v ?? 0),
  taxa_outra_cidade: precoOpcional.transform((v) => v ?? 0),
  perdas_pct: numero(0, 100, "De 0 a 100."),
  margem_pct: numeroOpcional(0, 1000, "De 0 a 1.000."),
  arredondar_para: precoOpcional.transform((v) => v ?? 0),
  preco_minimo: precoOpcional.transform((v) => v ?? 0),
});

export async function salvarCalculadora(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaCalculadora.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("calculadora").upsert({ unica: true, ...r.data }, { onConflict: "unica" });
  if (error) return falha(mensagemErroBanco(error));
  revalidar();
  return sucesso("Parâmetros salvos. Confira a simulação e aprove as regras para o agente poder informar preço.");
}

export async function aprovarCalculadora(): Promise<EstadoAcao> {
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.rpc("aprovar_calculadora");
  if (error) return falha(mensagemErroBanco(error));
  revalidar();
  return sucesso("Regras de preço aprovadas. O agente já pode informar preço por elas.");
}

/** Simulação: mesma conta usada na proposta. */
export async function simularPreco(entrada: {
  pacote_id: string;
  convidados: number;
  duracao_horas: number;
  linha: "tradicional" | "premium";
  outra_cidade: boolean;
}): Promise<{ ok: boolean; mensagem?: string; calculo?: ResultadoCalculo }> {
  const p = await exigirPerfil();
  if ("erro" in p) return { ok: false, mensagem: p.erro };
  if (!ehUuid(entrada.pacote_id)) return { ok: false, mensagem: "Escolha o pacote." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calcular_preco", {
    p: {
      pacote_id: entrada.pacote_id,
      convidados: Math.round(Number(entrada.convidados) || 0),
      duracao_horas: Number(entrada.duracao_horas) || 0,
      linha: entrada.linha === "premium" ? "premium" : "tradicional",
      outra_cidade: Boolean(entrada.outra_cidade),
    },
  });
  if (error) return { ok: false, mensagem: mensagemErroBanco(error) };
  return { ok: true, calculo: data as unknown as ResultadoCalculo };
}
