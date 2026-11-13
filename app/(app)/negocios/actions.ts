"use server";

/**
 * MUTATIONS dos negócios (oportunidades). As regras importantes ficam no banco:
 * histórico de etapas, ganho exige valor, perda exige motivo, desconto máximo,
 * comissão calculada ao ganhar. Aqui validamos e devolvemos mensagens claras.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { lerTags } from "@/lib/comercial";
import { exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import {
  dataOpcional,
  ehUuid,
  idObrigatorio,
  idOpcional,
  moeda,
  telefoneOpcional,
  textoObrigatorio,
  textoOpcional,
} from "@/lib/validacao";

function revalidarNegocio(id?: string) {
  revalidatePath("/funil");
  revalidatePath("/negocios");
  revalidatePath("/");
  if (id) revalidatePath(`/negocios/${id}`);
}

const esquema = z.object({
  id: idOpcional,
  titulo: textoObrigatorio(2, 120, "Dê um nome ao negócio (ex.: Notebooks para a filial)."),
  funil_id: idObrigatorio("Escolha o funil."),
  etapa_id: idObrigatorio("Escolha a etapa."),
  vendedor_id: idOpcional,
  contato_id: idOpcional,
  empresa_id: idOpcional,
  novo_contato: textoOpcional(120),
  novo_telefone: telefoneOpcional,
  nova_empresa: textoOpcional(120),
  origem_id: idOpcional,
  valor: moeda,
  previsao_fechamento: dataOpcional,
  tags: z
    .string()
    .optional()
    .transform((v) => lerTags(v)),
  observacoes: textoOpcional(4000),
});

/** Criar ou editar negócio (com cadastro rápido de contato/empresa). */
export async function salvarNegocio(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquema.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const { perfil } = p;
  const d = r.data;
  const supabase = await createClient();

  // Vendedor só cria/edita negócio em nome de si mesmo (o banco também confere).
  const vendedor_id = perfil.papel === "gestor" ? (d.vendedor_id ?? perfil.id) : perfil.id;

  let empresa_id = d.empresa_id;
  if (!empresa_id && d.nova_empresa) {
    const { data, error } = await supabase
      .from("empresas")
      .insert({ nome: d.nova_empresa, responsavel_id: vendedor_id, origem_id: d.origem_id })
      .select("id")
      .single();
    if (error) return falha(mensagemErroBanco(error));
    empresa_id = data.id;
  }
  let contato_id = d.contato_id;
  if (!contato_id && d.novo_contato) {
    const { data, error } = await supabase
      .from("contatos")
      .insert({
        nome: d.novo_contato,
        telefone: d.novo_telefone,
        empresa_id,
        tipo: empresa_id ? "pj" : "pf",
        responsavel_id: vendedor_id,
        origem_id: d.origem_id,
      })
      .select("id")
      .single();
    if (error) return falha(mensagemErroBanco(error));
    contato_id = data.id;
  }
  if (!empresa_id && contato_id) {
    const { data } = await supabase.from("contatos").select("empresa_id").eq("id", contato_id).maybeSingle();
    empresa_id = data?.empresa_id ?? null;
  }

  const linha = {
    titulo: d.titulo,
    funil_id: d.funil_id,
    etapa_id: d.etapa_id,
    vendedor_id,
    contato_id,
    empresa_id,
    origem_id: d.origem_id,
    previsao_fechamento: d.previsao_fechamento,
    tags: d.tags,
    observacoes: d.observacoes,
  };

  if (d.id) {
    // Com produtos, o valor é a soma dos itens (o banco recalcula): só grava o valor digitado se não houver itens.
    const { count } = await supabase
      .from("negocio_produtos")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", d.id);
    const { data, error } = await supabase
      .from("negocios")
      .update(count ? linha : { ...linha, valor: d.valor })
      .eq("id", d.id)
      .select("id");
    if (error) return falha(mensagemErroBanco(error));
    if (!data?.length) return falha("Negócio não encontrado ou sem permissão para editar.");
    revalidarNegocio(d.id);
    return sucesso("Negócio salvo.", { id: d.id });
  }

  const { data, error } = await supabase
    .from("negocios")
    .insert({ ...linha, valor: d.valor })
    .select("id")
    .single();
  if (error) return falha(mensagemErroBanco(error));
  revalidarNegocio();
  if (contato_id) revalidatePath(`/contatos/${contato_id}`);
  return sucesso("Negócio criado.", { id: data.id });
}

/** Arrastar no funil / escolher etapa (o histórico é gravado pelo banco). */
export async function moverNegocio(id: string, etapaId: string): Promise<EstadoAcao> {
  if (!ehUuid(id) || !ehUuid(etapaId)) return falha("Dados inválidos.");
  const supabase = await createClient();
  const { data: etapa } = await supabase.from("etapas").select("funil_id, nome").eq("id", etapaId).maybeSingle();
  if (!etapa) return falha("Etapa não encontrada.");
  const { data, error } = await supabase
    .from("negocios")
    .update({ etapa_id: etapaId, funil_id: etapa.funil_id })
    .eq("id", id)
    .select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para mover este negócio.");
  revalidarNegocio(id);
  return sucesso(`Movido para ${etapa.nome}.`);
}

export async function ganharNegocio(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Dados inválidos.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("negocios").update({ status: "ganho" }).eq("id", id).select("id, valor");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para alterar este negócio.");
  revalidarNegocio(id);
  revalidatePath("/comissoes");
  revalidatePath("/metas");
  return sucesso("Parabéns! Negócio ganho. A comissão já foi calculada.");
}

const esquemaPerda = z.object({
  id: idObrigatorio("Negócio inválido."),
  motivo_perda_id: idObrigatorio("Escolha o motivo da perda."),
  motivo_perda_detalhe: textoOpcional(500),
});

export async function perderNegocio(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaPerda.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Informe o motivo da perda.", errosDoZod(r.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .update({ status: "perdido", motivo_perda_id: r.data.motivo_perda_id, motivo_perda_detalhe: r.data.motivo_perda_detalhe })
    .eq("id", r.data.id)
    .select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para alterar este negócio.");
  revalidarNegocio(r.data.id);
  revalidatePath("/comissoes");
  return sucesso("Negócio marcado como perdido.");
}

export async function reabrirNegocio(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Dados inválidos.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("negocios").update({ status: "aberto" }).eq("id", id).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para alterar este negócio.");
  revalidarNegocio(id);
  revalidatePath("/comissoes");
  return sucesso("Negócio reaberto.");
}

export async function excluirNegocio(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Dados inválidos.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("negocios").delete().eq("id", id).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para excluir este negócio.");
  revalidarNegocio();
  return sucesso("Negócio excluído.");
}

const esquemaItens = z
  .array(
    z.object({
      produto_id: z.string().nullable(),
      descricao: z.string().trim().min(1, "Descreva o item.").max(200),
      quantidade: z.number().positive("Quantidade maior que zero.").max(1_000_000),
      preco_unitario: z.number().min(0).max(9_999_999),
      desconto_pct: z.number().min(0).max(100),
    }),
  )
  .max(50, "Máximo de 50 itens.");

/** Substitui os produtos do negócio (o banco soma o valor e confere o desconto máximo). */
export async function salvarProdutosNegocio(negocioId: string, itens: unknown): Promise<EstadoAcao> {
  if (!ehUuid(negocioId)) return falha("Negócio inválido.");
  const r = esquemaItens.safeParse(itens);
  if (!r.success) return falha(r.error.issues[0]?.message ?? "Confira os itens.");
  const supabase = await createClient();
  const { data: antigos, error: e1 } = await supabase.from("negocio_produtos").select("id").eq("negocio_id", negocioId);
  if (e1) return falha(mensagemErroBanco(e1));

  // Insere os novos ANTES de apagar os antigos: se o banco recusar (ex.: desconto), nada se perde.
  if (r.data.length) {
    const { error } = await supabase.from("negocio_produtos").insert(
      r.data.map((i, n) => ({
        negocio_id: negocioId,
        produto_id: i.produto_id && ehUuid(i.produto_id) ? i.produto_id : null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        desconto_pct: i.desconto_pct,
        ordem: n + 1,
      })),
    );
    if (error) return falha(mensagemErroBanco(error));
  }
  const ids = (antigos ?? []).map((a) => a.id);
  if (ids.length) {
    const { error } = await supabase.from("negocio_produtos").delete().in("id", ids);
    if (error) return falha(mensagemErroBanco(error));
  }
  revalidarNegocio(negocioId);
  revalidatePath("/comissoes");
  return sucesso("Produtos salvos. O valor do negócio foi atualizado.");
}
