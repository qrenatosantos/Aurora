/**
 * Regras, textos e contas do comercial. Funções PURAS: servem no servidor e no navegador.
 */
import { FUSO, formatarHora, hojeISO } from "@/lib/formatar";
import { preencherModelo } from "@/lib/whatsapp";
import type { StatusNegocio, StatusProposta, TipoAtividade } from "@/lib/tipos";

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------
export const STATUS_NEGOCIO: Record<StatusNegocio, { nome: string; cor: "info" | "ok" | "perigo" }> = {
  aberto: { nome: "Em aberto", cor: "info" },
  ganho: { nome: "Ganho", cor: "ok" },
  perdido: { nome: "Perdido", cor: "perigo" },
};

export const TIPOS_ATIVIDADE: { id: TipoAtividade; nome: string; verbo: string }[] = [
  { id: "tarefa", nome: "Tarefa", verbo: "Tarefa" },
  { id: "ligacao", nome: "Ligação", verbo: "Ligar" },
  { id: "reuniao", nome: "Reunião", verbo: "Reunião" },
  { id: "whatsapp", nome: "WhatsApp", verbo: "WhatsApp" },
  { id: "email", nome: "E-mail", verbo: "E-mail" },
  { id: "visita", nome: "Visita", verbo: "Visita" },
];
export const nomeTipoAtividade = (t: string) => TIPOS_ATIVIDADE.find((x) => x.id === t)?.nome ?? t;

export const STATUS_PROPOSTA: Record<
  StatusProposta,
  { nome: string; cor: "neutro" | "alerta" | "info" | "ok" | "perigo" | "marca" }
> = {
  rascunho: { nome: "Rascunho", cor: "neutro" },
  aguardando_aprovacao: { nome: "Aguardando aprovação", cor: "alerta" },
  enviada: { nome: "Enviada", cor: "info" },
  aceita: { nome: "Aceita", cor: "ok" },
  recusada: { nome: "Recusada", cor: "perigo" },
  substituida: { nome: "Substituída", cor: "neutro" },
};

export const PORTES = [
  { id: "mei", nome: "MEI" },
  { id: "pequena", nome: "Pequena" },
  { id: "media", nome: "Média" },
  { id: "grande", nome: "Grande" },
] as const;

/** Variáveis aceitas nos modelos de mensagem. */
export const VARIAVEIS_MODELO = ["nome", "empresa", "vendedor", "negocio", "valor", "link_proposta", "validade"] as const;

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------
const fmtInteiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtCompacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtPct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** 12345.67 → "R$ 12.346" */
export const moedaInteira = (v: number | string | null | undefined) => fmtInteiro.format(Number(v) || 0);
/** 1234567 → "R$ 1,2 mi" */
export const moedaCurta = (v: number | string | null | undefined) => {
  const n = Number(v) || 0;
  return Math.abs(n) < 10000 ? moedaInteira(n) : `R$ ${fmtCompacto.format(n)}`;
};
/** 0.256 → "25,6%" (recebe fração) */
export const pct = (fracao: number) => `${fmtPct.format(Number.isFinite(fracao) ? fracao * 100 : 0)}%`;
/** 12.5 → "12,5%" (recebe percentual) */
export const pctNum = (v: number | string | null | undefined) => `${fmtPct.format(Number(v) || 0)}%`;

/** Total de um item com desconto (igual ao banco: arredonda em centavos). */
export function totalItem(qtd: number, preco: number, descontoPct: number) {
  return Math.round(qtd * preco * (1 - descontoPct / 100) * 100) / 100;
}

export function totaisItens(itens: { quantidade: number; preco_unitario: number; desconto_pct: number }[]) {
  const subtotal = itens.reduce((s, i) => s + Math.round(i.quantidade * i.preco_unitario * 100) / 100, 0);
  const total = itens.reduce((s, i) => s + totalItem(i.quantidade, i.preco_unitario, i.desconto_pct), 0);
  return { subtotal, desconto: subtotal - total, total };
}

/** Quantidade sem zeros sobrando: 2.000 → "2", 1.5 → "1,5" */
export const fmtQtd = (n: number | string) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(n) || 0);

// ---------------------------------------------------------------------------
// Datas (fuso de São Paulo)
// ---------------------------------------------------------------------------
/** Data (AAAA-MM-DD) de um timestamptz no fuso de São Paulo. */
export const diaSP = (iso: string | Date) => hojeISO(typeof iso === "string" ? new Date(iso) : iso);

/** "2026-10-12" + 3 → "2026-10-15" */
export function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas AAAA-MM-DD (b - a). */
export function difDias(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

/** "2026-10-12" → "2026-10-01" */
export const inicioMes = (dia: string) => `${dia.slice(0, 7)}-01`;

/** Último dia do mês: "2026-02-10" → "2026-02-28" */
export function fimMes(dia: string) {
  const [a, m] = dia.split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 0));
  return d.toISOString().slice(0, 10);
}

/** Soma meses a uma data de 1º dia: ("2026-10-01", -1) → "2026-09-01" */
export function somarMeses(primeiroDia: string, n: number) {
  const [a, m] = primeiroDia.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtMesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
/** "2026-10-01" → "outubro de 2026" */
export const nomeMes = (dia: string) => fmtMes.format(new Date(`${dia.slice(0, 7)}-01T12:00:00Z`));
/** "2026-10-01" → "out." */
export const nomeMesCurto = (dia: string) => fmtMesCurto.format(new Date(`${dia.slice(0, 7)}-01T12:00:00Z`));

/** Valida "AAAA-MM-DD". */
export const dataValida = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Valida "AAAA-MM". */
export const mesValido = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Data/hora de uma atividade para mostrar: "Hoje, 14:30", "Amanhã, 09:00", "12/10, 10:00" */
export function rotuloQuando(iso: string, hoje = hojeISO()) {
  const dia = diaSP(iso);
  const hora = formatarHora(iso);
  const dif = difDias(hoje, dia);
  if (dif === 0) return `Hoje, ${hora}`;
  if (dif === 1) return `Amanhã, ${hora}`;
  if (dif === -1) return `Ontem, ${hora}`;
  const [, m, d] = dia.split("-");
  return `${d}/${m}, ${hora}`;
}

/** Situação de uma atividade pendente: atrasada / hoje / futura */
export function situacaoAtividade(iso: string, concluida: boolean, agora = Date.now()): "concluida" | "atrasada" | "hoje" | "futura" {
  if (concluida) return "concluida";
  const hoje = hojeISO(new Date(agora));
  const dia = diaSP(iso);
  if (dia < hoje || (dia === hoje && Date.parse(iso) < agora - 60 * 60 * 1000)) return "atrasada";
  if (dia === hoje) return "hoje";
  return "futura";
}

/** 93784 s → "1 dia e 2 h" */
export function duracaoLegivel(segundos: number | null | undefined) {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return "—";
  const s = Math.max(0, segundos);
  const dias = Math.floor(s / 86400);
  const horas = Math.floor((s % 86400) / 3600);
  if (dias >= 1) return horas && dias < 10 ? `${dias} dia${dias > 1 ? "s" : ""} e ${horas} h` : `${dias} dia${dias > 1 ? "s" : ""}`;
  if (horas >= 1) return `${horas} h`;
  return `${Math.max(1, Math.round(s / 60))} min`;
}

/** Dias inteiros desde um timestamptz. */
export const diasDesde = (iso: string | null | undefined, agora = Date.now()) =>
  iso ? Math.max(0, Math.floor((agora - Date.parse(iso)) / 86400000)) : 0;

/** Entrada datetime-local ("2026-10-12T14:30") no fuso de SP → ISO com -03:00 */
export function localParaISO(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  return `${valor}:00-03:00`;
}

/** ISO → valor de <input type="datetime-local"> no fuso de SP */
export function isoParaLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}

// ---------------------------------------------------------------------------
// Período dos relatórios
// ---------------------------------------------------------------------------
export const PERIODOS = [
  { id: "mes", nome: "Este mês" },
  { id: "mes_passado", nome: "Mês passado" },
  { id: "trimestre", nome: "Últimos 3 meses" },
  { id: "semestre", nome: "Últimos 6 meses" },
  { id: "ano", nome: "Este ano" },
  { id: "personalizado", nome: "Personalizado" },
] as const;

export function lerPeriodo(sp: { periodo?: string; de?: string; ate?: string }, hoje = hojeISO()) {
  const id = PERIODOS.some((p) => p.id === sp.periodo) ? sp.periodo! : "semestre";
  const ini = inicioMes(hoje);
  let de = ini;
  let ate = hoje;
  if (id === "mes_passado") {
    de = somarMeses(ini, -1);
    ate = fimMes(de);
  } else if (id === "trimestre") de = somarMeses(ini, -2);
  else if (id === "semestre") de = somarMeses(ini, -5);
  else if (id === "ano") de = `${hoje.slice(0, 4)}-01-01`;
  else if (id === "personalizado") {
    de = dataValida(sp.de) ? sp.de : somarMeses(ini, -5);
    ate = dataValida(sp.ate) ? sp.ate : hoje;
    if (ate < de) [de, ate] = [ate, de];
  }
  return { periodo: id, de, ate };
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------
export const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] ?? "";

/** "a, b;c" → ["a","b","c"] (sem repetidos, até 10 tags de 30 letras) */
export function lerTags(texto: string | null | undefined) {
  const lista = (texto ?? "")
    .split(/[,;]/)
    .map((t) => t.trim().slice(0, 30))
    .filter(Boolean);
  return Array.from(new Set(lista)).slice(0, 10);
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Preenche um modelo de mensagem com os dados do negócio/contato. */
export function montarMensagem(
  modelo: string,
  dados: Partial<Record<(typeof VARIAVEIS_MODELO)[number], string | number | null | undefined>>,
) {
  return preencherModelo(modelo.replace(/\\n/g, "\n"), dados).replace(/[ \t]+\n/g, "\n").trim();
}

/** Linha de CSV (separador ";" — abre certo no Excel em português). */
export function linhaCsv(valores: (string | number | null | undefined)[]) {
  return valores
    .map((v) => {
      if (v === null || v === undefined) return "";
      const t = typeof v === "number" ? String(v).replace(".", ",") : String(v);
      // evita fórmulas maliciosas ao abrir no Excel (=, +, -, @)
      const seguro = /^[=+\-@]/.test(t) && typeof v !== "number" ? `'${t}` : t;
      return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
    })
    .join(";");
}
