"use server";

/** MUTATIONS das metas mensais (por vendedor e por equipe). Só o gestor; o banco confere. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, falha, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { somarMeses } from "@/lib/comercial";
import { exigirGestor } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/validacao";

const esquema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês inválido."),
  linhas: z
    .array(
      z.object({
        vendedor_id: z.string().nullable(),
        equipe_id: z.string().nullable(),
        meta_valor: z.number().min(0).max(9_999_999_999),
        meta_qtd: z.number().int().min(0).max(100_000),
      }),
    )
    .max(200),
});

export async function salvarMetas(entrada: unknown): Promise<EstadoAcao> {
  const r = esquema.safeParse(entrada);
  if (!r.success) return falha(r.error.issues[0]?.message ?? "Confira os valores.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { competencia, linhas } = r.data;
  const supabase = await createClient();
  const { data: existentes, error: e1 } = await supabase.from("metas").select("id, vendedor_id, equipe_id").eq("competencia", competencia);
  if (e1) return falha(mensagemErroBanco(e1));

  for (const l of linhas) {
    const vend = l.vendedor_id && ehUuid(l.vendedor_id) ? l.vendedor_id : null;
    const eq = !vend && l.equipe_id && ehUuid(l.equipe_id) ? l.equipe_id : null;
    if (!vend && !eq) continue;
    const atual = (existentes ?? []).find((m) => (vend ? m.vendedor_id === vend : m.equipe_id === eq));
    if (l.meta_valor <= 0 && l.meta_qtd <= 0) {
      if (atual) {
        const { error } = await supabase.from("metas").delete().eq("id", atual.id);
        if (error) return falha(mensagemErroBanco(error));
      }
      continue;
    }
    const valores = { meta_valor: l.meta_valor, meta_qtd: l.meta_qtd };
    const { error } = atual
      ? await supabase.from("metas").update(valores).eq("id", atual.id)
      : await supabase.from("metas").insert({ competencia, vendedor_id: vend, equipe_id: eq, ...valores });
    if (error) return falha(mensagemErroBanco(error));
  }
  revalidatePath("/metas");
  revalidatePath("/");
  return sucesso("Metas salvas.");
}

/** Copia as metas do mês anterior para o mês escolhido (só onde ainda não há meta). */
export async function copiarMesAnterior(competencia: string): Promise<EstadoAcao> {
  if (!/^\d{4}-\d{2}-01$/.test(competencia)) return falha("Mês inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const anterior = somarMeses(competencia, -1);
  const [{ data: velhas }, { data: atuais }] = await Promise.all([
    supabase.from("metas").select("vendedor_id, equipe_id, meta_valor, meta_qtd").eq("competencia", anterior),
    supabase.from("metas").select("vendedor_id, equipe_id").eq("competencia", competencia),
  ]);
  const novas = (velhas ?? []).filter(
    (v) => !(atuais ?? []).some((a) => (v.vendedor_id ? a.vendedor_id === v.vendedor_id : a.equipe_id === v.equipe_id)),
  );
  if (!novas.length) return falha("Nada para copiar: o mês anterior não tem metas novas para este mês.");
  const { error } = await supabase.from("metas").insert(novas.map((m) => ({ ...m, competencia })));
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/metas");
  return sucesso(`${novas.length} meta(s) copiada(s) do mês anterior.`);
}
