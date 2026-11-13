"use server";

/**
 * Comissões: o VALOR é calculado pelo banco (ao ganhar o negócio, recalcula enquanto
 * não paga). Aqui o gestor só marca/desmarca como paga e cuida das regras.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { exigirGestor } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { caixa, ehUuid, idOpcional, percentual, textoObrigatorio } from "@/lib/validacao";
import { lerMoeda } from "@/lib/formatar";

export async function marcarPagas(ids: string[], paga: boolean): Promise<EstadoAcao> {
  const lista = Array.isArray(ids) ? ids.filter(ehUuid).slice(0, 500) : [];
  if (!lista.length) return falha("Selecione ao menos uma comissão.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comissoes")
    .update({ status: paga ? "paga" : "pendente" })
    .in("id", lista)
    .select("id");
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/comissoes");
  return sucesso(paga ? `${data?.length ?? 0} comissão(ões) marcada(s) como paga(s).` : `${data?.length ?? 0} voltaram para “a pagar” (e foram recalculadas).`);
}

export async function recalcularPendentes(): Promise<EstadoAcao> {
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recalcular_comissoes_pendentes");
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/comissoes");
  return sucesso(`${data ?? 0} comissão(ões) a pagar recalculada(s) com as regras atuais.`);
}

const valorOpcional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? Math.round(lerMoeda(v) * 100) / 100 : null));

const esquemaRegra = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 80, "Dê um nome à regra (ex.: Padrão, Suporte mensal)."),
  vendedor_id: idOpcional,
  produto_id: idOpcional,
  percentual,
  valor_min: valorOpcional,
  valor_max: valorOpcional,
  ativo: caixa,
});

export async function salvarRegra(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaRegra.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, ...d } = r.data;
  if (d.valor_min !== null && d.valor_max !== null && d.valor_max < d.valor_min)
    return falha("Confira a faixa.", { valor_max: "O valor final precisa ser maior que o inicial." });
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("regras_comissao").update(d).eq("id", id).select("id")
    : await supabase.from("regras_comissao").insert(d).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Regra não encontrada.");
  revalidatePath("/comissoes");
  revalidatePath("/comissoes/regras");
  return sucesso("Regra salva. Use “Recalcular a pagar” para aplicar às comissões ainda não pagas.");
}

export async function excluirRegra(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Regra inválida.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("regras_comissao").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/comissoes/regras");
  return sucesso("Regra excluída.");
}
