"use server";

/**
 * MUTATIONS de contatos e empresas + importação de leads por CSV.
 * Vendedor cadastra leads em nome de si mesmo; o gestor escolhe o responsável (RLS confere).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { lerTags } from "@/lib/comercial";
import { somenteDigitos } from "@/lib/formatar";
import { exigirGestor, exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoImportacao } from "@/lib/tipos";
import { ehUuid, emailOpcional, idOpcional, telefoneOpcional, textoObrigatorio, textoOpcional } from "@/lib/validacao";

const tags = z
  .string()
  .optional()
  .transform((v) => lerTags(v));

const esquemaContato = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 120, "Informe o nome do contato."),
  empresa_id: idOpcional,
  cargo: textoOpcional(80),
  email: emailOpcional,
  telefone: telefoneOpcional,
  cpf: z
    .string()
    .optional()
    .transform((v) => somenteDigitos(v))
    .refine((v) => v === "" || v.length === 11, "CPF com 11 números.")
    .transform((v) => (v === "" ? null : v)),
  cidade: textoOpcional(80),
  tags,
  origem_id: idOpcional,
  responsavel_id: idOpcional,
  observacoes: textoOpcional(2000),
});

export async function salvarContato(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaContato.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const { id, responsavel_id, ...d } = r.data;
  const base = { ...d, tipo: d.empresa_id ? ("pj" as const) : ("pf" as const) };
  // Gestor escolhe o responsável; vendedor cria em nome de si mesmo e não muda o dono ao editar.
  const linha =
    p.perfil.papel === "gestor"
      ? { ...base, responsavel_id: responsavel_id ?? p.perfil.id }
      : id
        ? base
        : { ...base, responsavel_id: p.perfil.id };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("contatos").update(linha).eq("id", id).select("id")
    : await supabase.from("contatos").insert(linha).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Contato não encontrado ou sem permissão para editar.");
  revalidatePath("/contatos");
  revalidatePath(`/contatos/${data[0].id}`);
  if (d.empresa_id) revalidatePath(`/empresas/${d.empresa_id}`);
  return sucesso(id ? "Contato salvo." : "Contato cadastrado.", { id: data[0].id });
}

export async function excluirContato(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Contato inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("contatos").delete().eq("id", id).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para excluir este contato.");
  revalidatePath("/contatos");
  return sucesso("Contato excluído. Os negócios dele continuam, sem contato.");
}

/** Aviso de duplicado (e-mail/telefone) em toda a base, antes de salvar. */
export async function verificarDuplicado(email: string, telefone: string, ignorar?: string | null) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("contatos_duplicados", {
    p_email: email?.trim() || null,
    p_telefone: somenteDigitos(telefone) || null,
    p_ignorar: ignorar && ehUuid(ignorar) ? ignorar : null,
  });
  return (data ?? []).map((d) => ({ id: d.visivel ? d.id : null, nome: d.nome, motivo: d.motivo, responsavel: d.responsavel }));
}

const esquemaEmpresa = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 120, "Informe o nome da empresa."),
  cnpj: z
    .string()
    .optional()
    .transform((v) => somenteDigitos(v))
    .refine((v) => v === "" || v.length === 14, "CNPJ com 14 números.")
    .transform((v) => (v === "" ? null : v)),
  segmento: textoOpcional(60),
  porte: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || ["mei", "pequena", "media", "grande"].includes(v), "Porte inválido."),
  telefone: telefoneOpcional,
  email: emailOpcional,
  site: textoOpcional(160),
  cidade: textoOpcional(80),
  uf: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "UF com 2 letras.")
    .transform((v) => (v === "" ? null : v)),
  endereco: textoOpcional(200),
  tags,
  origem_id: idOpcional,
  responsavel_id: idOpcional,
  observacoes: textoOpcional(2000),
});

export async function salvarEmpresa(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaEmpresa.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const { id, porte, ...resto } = r.data;
  const d = { ...resto, porte: porte as "mei" | "pequena" | "media" | "grande" | null };
  const gestor = p.perfil.papel === "gestor";
  const supabase = await createClient();
  const { responsavel_id, ...semResp } = d;
  const linha = gestor ? { ...semResp, responsavel_id: responsavel_id ?? p.perfil.id } : id ? semResp : { ...semResp, responsavel_id: p.perfil.id };
  const { data, error } = id
    ? await supabase.from("empresas").update(linha).eq("id", id).select("id")
    : await supabase.from("empresas").insert(linha).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Empresa não encontrada ou sem permissão para editar.");
  revalidatePath("/empresas");
  revalidatePath(`/empresas/${data[0].id}`);
  return sucesso(id ? "Empresa salva." : "Empresa cadastrada.", { id: data[0].id });
}

export async function excluirEmpresa(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Empresa inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("empresas").delete().eq("id", id).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para excluir esta empresa.");
  revalidatePath("/empresas");
  return sucesso("Empresa excluída. Contatos e negócios dela continuam, sem empresa.");
}

const esquemaImportacao = z.object({
  linhas: z
    .array(
      z.object({
        nome: z.string().max(300).optional(),
        email: z.string().max(300).optional(),
        telefone: z.string().max(60).optional(),
        empresa: z.string().max(300).optional(),
        cargo: z.string().max(200).optional(),
        cidade: z.string().max(200).optional(),
        observacoes: z.string().max(3000).optional(),
        tags: z.string().max(300).optional(),
      }),
    )
    .min(1, "O arquivo não tem linhas.")
    .max(2000, "Máximo de 2.000 linhas por importação. Divida o arquivo."),
  responsavel: z.string().nullable(),
  origem: z.string().nullable(),
  tags: z.string().max(300),
  pularDuplicados: z.boolean(),
  simular: z.boolean(),
});

/** Importa (ou só confere, com simular = true) as linhas já mapeadas do CSV. */
export async function importarLeads(entrada: unknown): Promise<EstadoAcao & { resultado?: ResultadoImportacao }> {
  const r = esquemaImportacao.safeParse(entrada);
  if (!r.success) return falha(r.error.issues[0]?.message ?? "Arquivo inválido.");
  const d = r.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("importar_leads", {
    p_linhas: d.linhas,
    p_responsavel: d.responsavel && ehUuid(d.responsavel) ? d.responsavel : null,
    p_origem: d.origem && ehUuid(d.origem) ? d.origem : null,
    p_tags: lerTags(d.tags),
    p_pular_duplicados: d.pularDuplicados,
    p_simular: d.simular,
  });
  if (error) return falha(mensagemErroBanco(error));
  const resultado = data as unknown as ResultadoImportacao;
  if (!d.simular) {
    revalidatePath("/contatos");
    revalidatePath("/empresas");
  }
  return {
    ...sucesso(
      d.simular
        ? `Conferido: ${resultado.criados} prontos para importar, ${resultado.duplicados} duplicado(s), ${resultado.erros} com erro.`
        : `${resultado.criados} contato(s) importado(s)${resultado.empresas ? ` e ${resultado.empresas} empresa(s) nova(s)` : ""}.`,
    ),
    resultado,
  };
}

// ============================== LGPD (só o gestor; o banco confere) ==============================

/** Devolve TUDO o que o sistema guarda sobre o contato (pedido de acesso do titular), em JSON. */
export async function exportarContato(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Contato inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exportar_contato", { p_id: id });
  if (error) return falha(mensagemErroBanco(error));
  return sucesso("Arquivo gerado.", { json: JSON.stringify(data, null, 2) });
}

/** Apaga os dados pessoais do contato (pedido de eliminação). Negócios fechados só saem se pedido. */
export async function apagarDadosContato(id: string, incluirFechados: boolean): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Contato inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("anonimizar_contato", { p_id: id, p_incluir_fechados: incluirFechados });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/contatos");
  revalidatePath(`/contatos/${id}`);
  revalidatePath("/negocios");
  const r = (data ?? {}) as { negocios_mantidos?: number; contato_anonimizado?: boolean };
  return sucesso(
    r.contato_anonimizado
      ? "Dados pessoais apagados."
      : `Conversas e dados dos negócios em aberto ou perdidos foram apagados. ${r.negocios_mantidos} negócio(s) fechado(s) foram mantidos como registro do contrato.`,
  );
}

/**
 * Preferências de mensagens do contato: "não contatar" (pediu para parar) e consentimento para
 * retomadas. As datas são gravadas pelo banco. Vale para a equipe e para o agente.
 */
export async function salvarPreferenciasContato(
  id: string,
  preferencias: { nao_contatar: boolean; nao_contatar_motivo?: string | null; aceita_retomadas: boolean },
): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Contato inválido.");
  const r = z
    .object({ nao_contatar: z.boolean(), nao_contatar_motivo: z.string().trim().max(200, "Até 200 caracteres.").nullish(), aceita_retomadas: z.boolean() })
    .safeParse(preferencias);
  if (!r.success) return falha(r.error.issues[0]?.message ?? "Dados inválidos.");
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contatos")
    .update({ ...r.data, nao_contatar_motivo: r.data.nao_contatar ? r.data.nao_contatar_motivo || null : null })
    .eq("id", id)
    .select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Contato não encontrado ou sem permissão para editar.");
  revalidatePath(`/contatos/${id}`);
  revalidatePath("/negocios", "layout");
  return sucesso(r.data.nao_contatar ? "Anotado: esta pessoa não recebe mais mensagens." : "Preferências salvas.");
}
