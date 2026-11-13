"use server";

/**
 * MUTATIONS de Integrações (só o gestor; o banco confere): chaves de acesso do agente
 * e avisos (webhooks). A chave é devolvida UMA vez, na criação: o banco guarda só o resumo dela.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { ESCOPOS_API, TIPOS_AVISO } from "@/lib/aurora";
import { exigirGestor } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { caixa, ehUuid, idOpcional, textoObrigatorio } from "@/lib/validacao";

export async function criarChave(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const bruto = lerFormulario(formData);
  const r = z
    .object({
      nome: textoObrigatorio(2, 60, "Dê um nome à chave (ex.: Agente SDR)."),
      limite: z
        .string()
        .optional()
        .transform((v) => Number(v || 120))
        .refine((v) => Number.isInteger(v) && v >= 1 && v <= 6000, "De 1 a 6.000 chamadas por minuto."),
    })
    .safeParse(bruto);
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const escopos = ESCOPOS_API.map((e) => e.id).filter((id) => bruto[`escopo_${id}`] === "on");
  if (escopos.length === 0) return falha("Marque pelo menos uma permissão.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_chave_api", { p_nome: r.data.nome, p_escopos: escopos, p_limite: r.data.limite });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/integracoes");
  const chave = (data as { chave?: string } | null)?.chave ?? "";
  return sucesso("Chave criada. Copie agora: ela não será mostrada de novo.", { chave });
}

export async function revogarChave(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Chave inválida.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revogar_chave_api", { p_id: id });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/integracoes");
  return sucesso("Chave revogada. Quem a usava perdeu o acesso na hora.");
}

export async function salvarWebhook(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const bruto = lerFormulario(formData);
  const r = z
    .object({
      id: idOpcional,
      nome: textoObrigatorio(2, 60, "Dê um nome ao aviso (ex.: Agente SDR)."),
      url: z
        .string()
        .trim()
        .max(500, "Endereço muito longo.")
        .regex(/^https:\/\/[^\s]+$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s]*)?$/, "Use um endereço que comece com https://."),
      ativo: caixa,
    })
    .safeParse(bruto);
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  // nenhum tipo marcado = todos os tipos
  const eventos = TIPOS_AVISO.map((t) => t.id).filter((id) => bruto[`tipo_${id}`] === "on");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, ...d } = r.data;
  const supabase = await createClient();
  const linha = { ...d, eventos: eventos.length === TIPOS_AVISO.length ? [] : eventos };
  const { error, data } = id
    ? await supabase.from("webhooks").update(linha).eq("id", id).select("id")
    : await supabase.from("webhooks").insert(linha).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Aviso não encontrado.");
  revalidatePath("/integracoes");
  return sucesso(id ? "Aviso salvo." : "Aviso criado. Use “Enviar teste” para conferir se o agente recebe.");
}

export async function excluirWebhook(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Aviso inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("webhooks").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/integracoes");
  return sucesso("Aviso excluído.");
}

export async function testarWebhook(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Aviso inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.rpc("testar_webhook", { p_webhook: id });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/integracoes");
  return sucesso("Aviso de teste colocado na fila. Veja o resultado em “Últimos avisos” em alguns segundos.");
}

export async function processarFila(): Promise<EstadoAcao> {
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.rpc("processar_webhooks");
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/integracoes");
  return sucesso("Fila processada: respostas conferidas e pendências reenviadas.");
}
