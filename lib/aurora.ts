/**
 * AURORA — rótulos, listas e pequenas contas próprias deste sistema.
 * Funções PURAS: servem no servidor e no navegador.
 */
import { FUSO } from "@/lib/formatar";
import type { Atendimento, CategoriaDrink, CategoriaInsumo, Copo, EventoProposta, LinhaBebida, SituacaoData, TipoEvento } from "@/lib/tipos";

export const TIPOS_EVENTO: { id: TipoEvento; nome: string }[] = [
  { id: "casamento", nome: "Casamento" },
  { id: "15_anos", nome: "15 anos" },
  { id: "aniversario", nome: "Aniversário" },
  { id: "formatura", nome: "Formatura" },
  { id: "empresa", nome: "Evento de empresa" },
  { id: "outro", nome: "Outro" },
];
export const nomeTipoEvento = (t: string | null | undefined) => TIPOS_EVENTO.find((x) => x.id === t)?.nome ?? "Evento";

export const SITUACAO_DATA: Record<SituacaoData, { nome: string; cor: "neutro" | "alerta" | "ok" | "info"; ajuda: string }> = {
  consulta: { nome: "Em consulta", cor: "neutro", ajuda: "A data ainda não está segurada." },
  reservada: { nome: "Reservada", cor: "alerta", ajuda: "Proposta enviada: a data fica segurada até a validade." },
  confirmada: { nome: "Confirmada", cor: "ok", ajuda: "Negócio fechado: a data é desta festa." },
  liberada: { nome: "Liberada", cor: "info", ajuda: "A data voltou a ficar livre." },
};

export const LINHAS: { id: LinhaBebida; nome: string }[] = [
  { id: "tradicional", nome: "Tradicional" },
  { id: "premium", nome: "Premium" },
];

export const ATENDIMENTO: Record<Atendimento, { nome: string; cor: "marca" | "info" }> = {
  humano: { nome: "Humano", cor: "info" },
  agente: { nome: "Agente", cor: "marca" },
};

export const CATEGORIAS_DRINK: { id: CategoriaDrink; nome: string }[] = [
  { id: "classico", nome: "Clássico" },
  { id: "premium", nome: "Premium" },
  { id: "sem_alcool", nome: "Sem álcool" },
  { id: "autoral", nome: "Autoral" },
];
export const nomeCategoriaDrink = (c: string) => CATEGORIAS_DRINK.find((x) => x.id === c)?.nome ?? c;

export const COPOS: { id: Copo; nome: string; descricao: string }[] = [
  { id: "long_drink", nome: "Copo long drink", descricao: "Copo alto para drinks e bebidas refrescantes." },
  { id: "baixo", nome: "Copo baixo", descricao: "Copo baixo para caipirinha e caipiroska." },
  { id: "caneca", nome: "Caneca Moscow Mule", descricao: "Caneca com alça para o Moscow Mule." },
  { id: "taca", nome: "Taça", descricao: "Taça para drinks servidos sem gelo ou com espumante." },
  { id: "outro", nome: "Outro", descricao: "" },
];

export const CATEGORIAS_INSUMO: { id: CategoriaInsumo; nome: string }[] = [
  { id: "destilado", nome: "Destilado" },
  { id: "licor", nome: "Licor e aperitivo" },
  { id: "vinho", nome: "Vinho e espumante" },
  { id: "fruta", nome: "Fruta" },
  { id: "xarope", nome: "Xarope e açúcar" },
  { id: "suco", nome: "Suco" },
  { id: "refrigerante", nome: "Refrigerante e água" },
  { id: "gelo", nome: "Gelo" },
  { id: "guarnicao", nome: "Guarnição e ervas" },
  { id: "descartavel", nome: "Descartável" },
  { id: "outro", nome: "Outro" },
];
export const nomeCategoriaInsumo = (c: string) => CATEGORIAS_INSUMO.find((x) => x.id === c)?.nome ?? c;

export const UNIDADES_INSUMO = [
  { id: "ml", nome: "mililitro (ml)" },
  { id: "g", nome: "grama (g)" },
  { id: "un", nome: "unidade (un)" },
] as const;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** "2026-11-28" → { dia: 28, mes: 10, ano: 2026 } sem depender de fuso (data sem hora). */
function partes(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return { ano, mes: mes - 1, dia };
}

/** "2026-11-28" → "28 de novembro de 2026" */
export function dataPorExtenso(iso: string | null | undefined) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const { ano, mes, dia } = partes(iso);
  return `${dia} de ${MESES[mes]} de ${ano}`;
}

/** "2026-11-28" → "Sábado" */
export function diaDaSemana(iso: string | null | undefined) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const { ano, mes, dia } = partes(iso);
  return DIAS[new Date(Date.UTC(ano, mes, dia)).getUTCDay()];
}

/** "2027-03-01" → "março de 2027" */
export function mesPorExtenso(iso: string | null | undefined) {
  if (!iso || !/^\d{4}-\d{2}/.test(iso)) return "";
  const { ano, mes } = partes(iso + "-01");
  return `${MESES[mes]} de ${ano}`;
}

/** 4 → "4 horas", 1 → "1 hora", 4.5 → "4,5 horas" */
export function horasTexto(h: number | string | null | undefined) {
  const n = Number(h);
  if (!h || !Number.isFinite(n)) return "";
  return `${String(n).replace(".", ",")} ${n === 1 ? "hora" : "horas"}`;
}

/** Resumo de uma linha do evento: "Casamento · 28/11/2026 · Araxá · 120 convidados". */
export function resumoEvento(e: EventoProposta | null | undefined) {
  if (!e) return "";
  const data = e.data ? `${e.data.slice(8, 10)}/${e.data.slice(5, 7)}/${e.data.slice(0, 4)}` : e.mes_previsto ? mesPorExtenso(e.mes_previsto) : "data a definir";
  return [
    e.tipo ? nomeTipoEvento(e.tipo) : null,
    data,
    e.cidade,
    e.convidados ? `${e.convidados} convidados` : e.convidados_faixa ? `${e.convidados_faixa} convidados` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Valor da entrada e do saldo a partir do total e do percentual. */
export function entradaESaldo(total: number, entradaPct: number | null | undefined) {
  if (entradaPct === null || entradaPct === undefined) return null;
  const entrada = Math.round(total * Number(entradaPct)) / 100;
  return { entrada, saldo: Math.round((total - entrada) * 100) / 100, pctEntrada: Number(entradaPct), pctSaldo: 100 - Number(entradaPct) };
}

/** Data de hoje (AAAA-MM-DD) no fuso do Brasil. */
export function hojeBR(base: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(base);
}

/** Tipos de aviso (webhook) que o sistema dispara. */
export const TIPOS_AVISO: { id: string; nome: string }[] = [
  { id: "lead.criado", nome: "Novo lead" },
  { id: "atendimento.encaminhado_agente", nome: "Contato encaminhado ao agente" },
  { id: "atendimento.assumido_humano", nome: "Atendimento assumido por humano" },
  { id: "atendimento.pedido_humano", nome: "Agente pediu atendimento humano" },
  { id: "proposta.submetida", nome: "Proposta submetida à aprovação" },
  { id: "proposta.aprovada", nome: "Proposta aprovada" },
  { id: "proposta.ajustes_solicitados", nome: "Ajustes solicitados" },
  { id: "proposta.enviada", nome: "Proposta enviada ao cliente" },
  { id: "proposta.visualizada", nome: "Cliente abriu a proposta" },
  { id: "proposta.aceita", nome: "Proposta aceita" },
  { id: "proposta.recusada", nome: "Proposta recusada" },
  { id: "negocio.ganho", nome: "Negócio fechado" },
  { id: "negocio.perdido", nome: "Negócio perdido" },
];
export const nomeAviso = (t: string) => TIPOS_AVISO.find((x) => x.id === t)?.nome ?? (t === "teste.ping" ? "Aviso de teste" : t);

/** Permissões (escopos) de uma chave do agente, com explicação em português. */
export const ESCOPOS_API: { id: string; nome: string }[] = [
  { id: "contatos.ler", nome: "Buscar e ler contatos" },
  { id: "contatos.gravar", nome: "Criar e atualizar contatos" },
  { id: "negocios.ler", nome: "Ler negócios e dados do evento" },
  { id: "negocios.gravar", nome: "Criar e atualizar negócios, evento e etapa" },
  { id: "agenda.ler", nome: "Consultar se a data está livre" },
  { id: "catalogo.ler", nome: "Ler pacotes, drinks e condições" },
  { id: "precos.calcular", nome: "Pedir preço pelas regras aprovadas" },
  { id: "propostas.ler", nome: "Ler propostas e a decisão do gestor" },
  { id: "propostas.gravar", nome: "Criar rascunho e submeter à aprovação" },
  { id: "propostas.enviar", nome: "Marcar como enviada (só as aprovadas)" },
  { id: "mensagens.ler", nome: "Ler a conversa" },
  { id: "mensagens.gravar", nome: "Registrar mensagens da conversa" },
  { id: "atendimento.transferir", nome: "Pedir atendimento humano" },
  { id: "eventos.ler", nome: "Consultar os avisos pendentes" },
];
