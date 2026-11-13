"use server";

/** MUTATIONS do catálogo de produtos e serviços (só o gestor; o banco confere). */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { exigirGestor } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { caixa, ehUuid, idOpcional, moeda, percentual, textoObrigatorio, textoOpcional } from "@/lib/validacao";

const esquema = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 120, "Informe o nome do produto ou serviço."),
  codigo: textoOpcional(30),
  tipo: z.enum(["produto", "servico"], "Escolha o tipo."),
  descricao: textoOpcional(1000),
  unidade: textoObrigatorio(1, 20, "Informe a unidade (ex.: un, hora, mês)."),
  preco: moeda,
  desconto_max: percentual,
  ativo: caixa,
});

export async function salvarProduto(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquema.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, ...d } = r.data;
  const supabase = await createClient();
  const { error, data } = id
    ? await supabase.from("produtos").update(d).eq("id", id).select("id")
    : await supabase.from("produtos").insert(d).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Produto não encontrado.");
  revalidatePath("/produtos");
  return sucesso(id ? "Produto salvo." : "Produto cadastrado.");
}

export async function excluirProduto(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Produto inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/produtos");
  return sucesso("Produto excluído. Negócios e propostas antigos mantêm a descrição e o preço.");
}
