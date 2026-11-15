"use server";

/**
 * MUTATIONS das propostas da Aurora.
 *
 * Fluxo: rascunho → aguardando aprovação → (ajustes solicitados ↔) → aprovada → enviada → aceita | recusada.
 * As travas ficam NO BANCO (schema.sql, parte A7): só o gestor aprova, só proposta aprovada
 * pode ser enviada e conteúdo aprovado não muda. Aqui validamos e devolvemos mensagens claras.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, falha, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { exigirGestor, exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoCalculo, StatusProposta } from "@/lib/tipos";
import { ehUuid } from "@/lib/validacao";

async function revalidarProposta(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("propostas").select("negocio_id").eq("id", id).maybeSingle();
  revalidatePath("/propostas");
  revalidatePath(`/propostas/${id}`);
  revalidatePath("/");
  revalidatePath("/eventos");
  revalidatePath("/funil");
  if (data?.negocio_id) revalidatePath(`/negocios/${data.negocio_id}`);
}

export async function criarProposta(negocioId: string): Promise<EstadoAcao> {
  if (!ehUuid(negocioId)) return falha("Negócio inválido.");
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_proposta", { p_negocio_id: negocioId });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath(`/negocios/${negocioId}`);
  revalidatePath("/propostas");
  return sucesso("Proposta criada com os dados do evento e o cardápio do pacote.", { id: String(data) });
}

const textoCurto = (max: number) => z.string().trim().max(max).default("");
const numeroOuVazio = (min: number, max: number) =>
  z
    .union([z.number(), z.null()])
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), "Valor fora do permitido.");
const urlOuVazia = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Use um endereço de imagem que comece com https://.");

const esquema = z.object({
  titulo: z.string().trim().min(2, "Dê um título à proposta.").max(120),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a validade."),
  capa_titulo: textoCurto(160),
  capa_subtitulo: textoCurto(240),
  capa_foto_url: urlOuVazia,
  apresentacao: textoCurto(400),
  descricao_servico: textoCurto(400),
  mensagem_final: textoCurto(400),
  foto_final_url: urlOuVazia,
  condicoes_pagamento: textoCurto(1000),
  observacoes: textoCurto(2000),
  nota_interna: textoCurto(1000),
  pacote_nome: textoCurto(80),
  linha: z.enum(["tradicional", "premium"]),
  entrada_pct: numeroOuVazio(0, 100),
  entrada_dias_antes: numeroOuVazio(0, 365),
  saldo_dias_antes: numeroOuVazio(0, 365),
  cancelamento_aviso_dias: numeroOuVazio(0, 365),
  cancelamento_multa_pct: numeroOuVazio(0, 100),
  taxa_quebra: numeroOuVazio(0, 99999),
  foro: textoCurto(120),
  evento: z.object({
    tipo: z.enum(["casamento", "15_anos", "aniversario", "formatura", "empresa", "outro"]).nullable(),
    nome: textoCurto(120),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    mes_previsto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    hora_inicio: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    duracao_horas: numeroOuVazio(0.5, 24),
    cidade: textoCurto(80),
    uf: z.string().trim().toUpperCase().max(2).default(""),
    local: textoCurto(160),
    convidados: numeroOuVazio(1, 5000),
    convidados_faixa: textoCurto(40),
  }),
  cardapio: z
    .array(
      z.object({
        drink_id: z.string().nullable().optional(),
        nome: z.string().trim().min(1, "Todo drink do cardápio precisa de nome.").max(80),
        descricao: textoCurto(300),
        foto_url: urlOuVazia,
        alcoolico: z.boolean().nullable().optional(),
        copo: z.enum(["long_drink", "baixo", "caneca", "taca", "outro"]).nullable().optional(),
        categoria: z.string().max(20).nullable().optional(),
      }),
    )
    .max(30, "Máximo de 30 drinks no cardápio."),
  itens: z
    .array(
      z.object({
        descricao: z.string().trim().min(1, "Descreva todos os itens do investimento.").max(200),
        detalhes: textoCurto(1000),
        quantidade: z.number().positive("Quantidade maior que zero.").max(1_000_000),
        preco_unitario: z.number().min(0).max(9_999_999),
      }),
    )
    .min(1, "A proposta precisa de pelo menos um item de investimento.")
    .max(30, "Máximo de 30 itens."),
  calculo: z.unknown().optional(),
});

const vazioParaNulo = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" ? null : v]));

/** Salva tudo de uma vez (função salvar_proposta: tudo ou nada). */
export async function salvarProposta(id: string, dados: unknown): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const r = esquema.safeParse(dados);
  if (!r.success) return falha(r.error.issues[0]?.message ?? "Confira os campos.");
  const { itens, evento, cardapio, calculo, ...cab } = r.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("salvar_proposta", {
    p_id: id,
    p_dados: {
      ...cab,
      // números vazios viram "" para o banco gravar nulo
      entrada_pct: cab.entrada_pct ?? "",
      entrada_dias_antes: cab.entrada_dias_antes ?? "",
      saldo_dias_antes: cab.saldo_dias_antes ?? "",
      cancelamento_aviso_dias: cab.cancelamento_aviso_dias ?? "",
      cancelamento_multa_pct: cab.cancelamento_multa_pct ?? "",
      taxa_quebra: cab.taxa_quebra ?? "",
      evento: vazioParaNulo(evento),
      cardapio: cardapio.map((d) => ({
        drink_id: d.drink_id && ehUuid(d.drink_id) ? d.drink_id : null,
        nome: d.nome,
        descricao: d.descricao || null,
        foto_url: d.foto_url || null,
        alcoolico: d.alcoolico ?? null,
        copo: d.copo ?? null,
        categoria: d.categoria ?? null,
      })),
      ...(calculo === undefined ? {} : { calculo: (calculo ?? null) as never }),
    } as never,
    p_itens: itens.map((i) => ({ ...i, unidade: "evento", desconto_pct: 0, produto_id: null })),
  });
  if (error) return falha(mensagemErroBanco(error));
  await revalidarProposta(id);
  return sucesso("Proposta salva.");
}

/** Conta da calculadora para o cardápio e o evento que estão no editor (não grava nada). */
export async function calcularParaProposta(entrada: {
  drinks: string[];
  convidados: number | null;
  duracao_horas: number | null;
  linha: "tradicional" | "premium";
  cidade: string;
  /** Nome do pacote da proposta: entra o acréscimo do pacote. Vazio = cardápio personalizado. */
  pacote_nome?: string;
}): Promise<{ ok: boolean; mensagem?: string; calculo?: ResultadoCalculo }> {
  const p = await exigirPerfil();
  if ("erro" in p) return { ok: false, mensagem: p.erro };
  const supabase = await createClient();
  const { data: config } = await supabase.from("configuracoes").select("cidade").limit(1).maybeSingle();
  const minha = (config?.cidade ?? "").split("/")[0].trim().toLowerCase();
  const nomePacote = (entrada.pacote_nome ?? "").trim();
  const { data: pacote } = nomePacote ? await supabase.from("pacotes").select("id").ilike("nome", nomePacote.replace(/[%_]/g, "")).limit(1).maybeSingle() : { data: null };
  const { data, error } = await supabase.rpc("calcular_preco", {
    p: {
      pacote_id: pacote?.id ?? null,
      drinks: entrada.drinks.filter(ehUuid),
      convidados: entrada.convidados,
      duracao_horas: entrada.duracao_horas,
      linha: entrada.linha,
      outra_cidade: Boolean(minha && entrada.cidade.trim() && entrada.cidade.trim().toLowerCase() !== minha),
    },
  });
  if (error) return { ok: false, mensagem: mensagemErroBanco(error) };
  return { ok: true, calculo: data as unknown as ResultadoCalculo };
}

async function mudarStatus(id: string, status: StatusProposta, extra: Record<string, unknown> = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("propostas")
    .update({ status, ...extra })
    .eq("id", id)
    .select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Proposta não encontrada ou sem permissão.");
  await revalidarProposta(id);
  return null;
}

/** Quem montou pede a aprovação do gestor. */
export async function submeterProposta(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  return (await mudarStatus(id, "aguardando_aprovacao")) ?? sucesso("Proposta enviada para a aprovação do gestor.");
}

/** Volta para rascunho (retira o pedido, ou reabre uma aprovada: a aprovação cai). */
export async function reabrirProposta(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  return (await mudarStatus(id, "rascunho")) ?? sucesso("A proposta voltou para rascunho. Depois de alterar, ela precisa ser aprovada de novo.");
}

export async function aprovarProposta(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  return (await mudarStatus(id, "aprovada")) ?? sucesso("Proposta aprovada. Agora ela pode ser enviada ao cliente.");
}

export async function pedirAjustes(id: string, comentario: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const texto = comentario.trim().slice(0, 2000);
  if (texto.length < 3) return falha("Escreva o que precisa ser ajustado.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  return (await mudarStatus(id, "ajustes_solicitados", { ajustes_comentario: texto })) ?? sucesso("Ajustes solicitados. Quem montou a proposta foi avisado.");
}

/** Envia = libera o link público e reserva a data. Só funciona para proposta aprovada (trava no banco). */
export async function enviarProposta(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  return (await mudarStatus(id, "enviada")) ?? sucesso("Proposta enviada! Copie o link ou mande pelo WhatsApp. A data ficou reservada na agenda.");
}

/** Atalho do gestor: aprova e envia em seguida. */
export async function aprovarEEnviar(id: string): Promise<EstadoAcao> {
  const a = await aprovarProposta(id);
  if (!a.ok) return a;
  return enviarProposta(id);
}

export async function marcarRecusada(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  return (await mudarStatus(id, "recusada")) ?? sucesso("Proposta marcada como recusada. A data foi liberada na agenda.");
}

/** Cliente aceitou por telefone ou mensagem: registra o aceite manual (o negócio fecha). */
export async function marcarAceita(id: string, nome: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const quem = nome.trim().slice(0, 120);
  if (quem.length < 3) return falha("Informe quem aceitou (nome do cliente).");
  const erro = await mudarStatus(id, "aceita", { aceite_nome: quem });
  if (erro) return erro;
  return sucesso("Aceite registrado. O negócio foi fechado e a data, confirmada na agenda.");
}

export async function novaVersao(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nova_versao_proposta", { p_id: id });
  if (error) return falha(mensagemErroBanco(error));
  await revalidarProposta(id);
  return sucesso("Nova versão criada como rascunho. O link antigo avisa o cliente de que há versão nova.", { id: String(data) });
}

/** Copia cardápio, textos, condições e itens para OUTRO negócio (número novo, dados do evento de lá). */
export async function duplicarProposta(id: string, negocioDestino: string): Promise<EstadoAcao> {
  if (!ehUuid(id) || !ehUuid(negocioDestino)) return falha("Escolha o negócio de destino.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicar_proposta", { p_id: id, p_negocio_destino: negocioDestino });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/propostas");
  revalidatePath(`/negocios/${negocioDestino}`);
  return sucesso("Proposta duplicada como rascunho no outro negócio.", { id: String(data) });
}

export async function excluirProposta(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const supabase = await createClient();
  const { data: p } = await supabase.from("propostas").select("negocio_id").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("propostas").delete().eq("id", id).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Só dá para excluir propostas que ainda não foram aprovadas (as demais ficam no histórico).");
  revalidatePath("/propostas");
  if (p?.negocio_id) revalidatePath(`/negocios/${p.negocio_id}`);
  return sucesso("Proposta excluída.", p?.negocio_id ? { negocio: p.negocio_id } : undefined);
}
