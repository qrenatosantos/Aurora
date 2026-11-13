/**
 * Formato padrão de retorno das Server Actions (mutations) do projeto.
 *
 * Toda action que grava dados devolve um EstadoAcao. O formulário (client)
 * mostra um toast com `mensagem` e os erros por campo em `erros`.
 * Veja o exemplo completo em app/(app)/configuracoes/.
 */
import type { z } from "zod";

export type EstadoAcao = {
  ok: boolean;
  mensagem?: string;
  /** Erros por campo: { nome_negocio: "Informe o nome" } */
  erros?: Record<string, string>;
  /** Dados extras para a tela (ex.: { id: "..." } do registro criado). */
  dados?: Record<string, string>;
};

export const estadoInicial: EstadoAcao = { ok: false };

export function sucesso(mensagem = "Salvo com sucesso.", dados?: Record<string, string>): EstadoAcao {
  return { ok: true, mensagem, dados };
}

export function falha(mensagem: string, erros?: Record<string, string>): EstadoAcao {
  return { ok: false, mensagem, erros };
}

/** Converte o erro do zod em { campo: "primeira mensagem" }. */
export function errosDoZod(erro: z.ZodError): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = String(issue.path[0] ?? "_");
    if (!erros[campo]) erros[campo] = issue.message;
  }
  return erros;
}

/** Transforma FormData em objeto simples (campos repetidos viram o último valor). */
export function lerFormulario(formData: FormData): Record<string, string> {
  const dados: Record<string, string> = {};
  formData.forEach((valor, chave) => {
    if (typeof valor === "string") dados[chave] = valor;
  });
  return dados;
}

/** Regras do banco (constraints) → mensagem que o vendedor entende. */
const REGRAS_BANCO: [string, string][] = [
  ["negocios_ganho_valor_ck", "Para marcar como ganho, o negócio precisa ter valor maior que zero."],
  ["negocios_perda_motivo_ck", "Informe o motivo da perda."],
  ["negocios_etapa_fk", "A etapa escolhida não pertence a este funil (ou ainda tem negócios nela)."],
  ["propostas_aprovacao_ck", "A proposta só pode ser enviada depois de aprovada pelo gestor."],
  ["propostas_uma_aceita_uidx", "Este negócio já tem uma proposta aceita."],
  ["metas_vendedor_uidx", "Já existe meta para este vendedor neste mês."],
  ["metas_equipe_uidx", "Já existe meta para esta equipe neste mês."],
  ["metas_algum_valor_ck", "Informe a meta em valor (R$) ou em número de vendas."],
  ["vendedores_email_uidx", "Já existe um vendedor com este e-mail."],
  ["equipes_nome_uidx", "Já existe uma equipe com este nome."],
  ["origens_nome_uidx", "Já existe uma origem com este nome."],
  ["motivos_perda_nome_uidx", "Já existe um motivo com este nome."],
  ["regras_faixa_ck", "Na faixa, o valor final precisa ser maior que o inicial."],
];

/** Mensagem amigável para erros do banco (PostgREST / Postgres). */
export function mensagemErroBanco(erro: { code?: string; message?: string; details?: string } | null | undefined) {
  if (!erro) return "Algo deu errado. Tente novamente.";
  const texto = `${erro.message ?? ""} ${erro.details ?? ""}`;
  for (const [regra, mensagem] of REGRAS_BANCO) if (texto.includes(regra)) return mensagem;
  // Regras escritas no banco com "raise exception" já vêm em português claro
  if (erro.code === "P0001" && erro.message) return erro.message;
  switch (erro.code) {
    case "23505":
      return "Já existe um registro com esses dados.";
    case "23503":
      return "Este registro está ligado a outros dados e não pode ser alterado/excluído.";
    case "23514":
      return "Algum valor está fora do permitido.";
    case "42501":
      return "Sem permissão para esta ação.";
    case "42P01":
    case "PGRST205":
    case "PGRST202":
      return "Tabela ou função não encontrada. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase.";
    default:
      return "Não foi possível salvar. Verifique sua conexão e tente novamente.";
  }
}
