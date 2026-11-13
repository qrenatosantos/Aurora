"use server";

/**
 * MUTATIONS das propostas. O banco cuida de: número sequencial, totais, limite de
 * desconto (acima do limite = só envia com aprovação do gestor), versões e aceite único.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, falha, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { exigirGestor, exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { StatusProposta } from "@/lib/tipos";
import { ehUuid } from "@/lib/validacao";

async function revalidarProposta(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("propostas").select("negocio_id").eq("id", id).maybeSingle();
  revalidatePath("/propostas");
  revalidatePath(`/propostas/${id}`);
  revalidatePath("/");
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
  return sucesso("Proposta criada com os produtos do negócio.", { id: String(data) });
}

const esquema = z.object({
  titulo: z.string().trim().min(2, "Dê um título à proposta.").max(120),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a validade."),
  condicoes_pagamento: z.string().trim().max(1000).default(""),
  prazo_entrega: z.string().trim().max(300).default(""),
  observacoes: z.string().trim().max(2000).default(""),
  itens: z
    .array(
      z.object({
        produto_id: z.string().nullable(),
        descricao: z.string().trim().min(1, "Descreva todos os itens.").max(200),
        detalhes: z.string().trim().max(1000).default(""),
        unidade: z.string().trim().min(1).max(20).default("un"),
        quantidade: z.number().positive("Quantidade maior que zero.").max(1_000_000),
        preco_unitario: z.number().min(0).max(9_999_999),
        desconto_pct: z.number().min(0, "Desconto de 0 a 100%.").max(100, "Desconto de 0 a 100%."),
      }),
    )
    .min(1, "Adicione pelo menos um item.")
    .max(100, "Máximo de 100 itens."),
});

/** Salva cabeçalho + itens de uma vez (função salvar_proposta, tudo ou nada). */
export async function salvarProposta(id: string, dados: unknown): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const r = esquema.safeParse(dados);
  if (!r.success) return falha(r.error.issues[0]?.message ?? "Confira os campos.");
  const { itens, ...cab } = r.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("salvar_proposta", {
    p_id: id,
    p_dados: cab,
    p_itens: itens.map((i) => ({ ...i, produto_id: i.produto_id && ehUuid(i.produto_id) ? i.produto_id : null })),
  });
  if (error) return falha(mensagemErroBanco(error));
  await revalidarProposta(id);
  const { data } = await supabase.from("propostas").select("precisa_aprovacao").eq("id", id).maybeSingle();
  return sucesso(
    data?.precisa_aprovacao
      ? "Proposta salva. Há desconto acima do limite: peça a aprovação do gestor antes de enviar."
      : "Proposta salva.",
  );
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

export async function pedirAprovacao(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  return (await mudarStatus(id, "aguardando_aprovacao")) ?? sucesso("Pedido de aprovação enviado ao gestor.");
}

export async function aprovarDesconto(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data: atual } = await supabase.from("propostas").select("status").eq("id", id).maybeSingle();
  if (!atual) return falha("Proposta não encontrada.");
  const extra = { aprovada_em: new Date().toISOString(), aprovada_por: g.perfil.id };
  const erro = await mudarStatus(id, atual.status === "aguardando_aprovacao" ? "rascunho" : atual.status, extra);
  return erro ?? sucesso("Desconto aprovado. O vendedor já pode enviar a proposta.");
}

export async function recusarDesconto(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  return (await mudarStatus(id, "rascunho")) ?? sucesso("Desconto não aprovado. A proposta voltou para rascunho.");
}

/** Envia = libera o link público. */
export async function enviarProposta(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  return (await mudarStatus(id, "enviada")) ?? sucesso("Proposta enviada! Copie o link ou mande pelo WhatsApp.");
}

export async function marcarRecusada(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  return (await mudarStatus(id, "recusada")) ?? sucesso("Proposta marcada como recusada.");
}

/** Cliente aceitou por telefone/e-mail: registra o aceite manual (o negócio vira GANHO). */
export async function marcarAceita(id: string, nome: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const quem = nome.trim().slice(0, 120);
  if (quem.length < 3) return falha("Informe quem aceitou (nome do cliente).");
  const erro = await mudarStatus(id, "aceita", { aceite_nome: quem });
  if (erro) return erro;
  revalidatePath("/funil");
  revalidatePath("/comissoes");
  return sucesso("Aceite registrado. O negócio foi marcado como ganho.");
}

export async function novaVersao(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nova_versao_proposta", { p_id: id });
  if (error) return falha(mensagemErroBanco(error));
  await revalidarProposta(id);
  return sucesso("Nova versão criada. Ajuste e envie de novo (o link antigo mostra que há versão nova).", { id: String(data) });
}

export async function excluirProposta(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Proposta inválida.");
  const supabase = await createClient();
  const { data: p } = await supabase.from("propostas").select("negocio_id").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("propostas").delete().eq("id", id).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Só dá para excluir rascunhos (as enviadas ficam no histórico).");
  revalidatePath("/propostas");
  if (p?.negocio_id) revalidatePath(`/negocios/${p.negocio_id}`);
  return sucesso("Rascunho excluído.", p?.negocio_id ? { negocio: p.negocio_id } : undefined);
}
