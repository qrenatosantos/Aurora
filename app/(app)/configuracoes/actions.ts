"use server";

/**
 * MUTATIONS de Configurações (só o gestor; o banco também confere):
 * dados da empresa e regras comerciais, funis e etapas, origens, motivos de perda
 * e modelos de mensagem.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { somenteDigitos } from "@/lib/formatar";
import { exigirGestor } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { type ChaveTexto, TEXTOS_PADRAO } from "@/lib/proposta-textos";
import { caixa, ehUuid, emailOpcional, idOpcional, inteiro, textoObrigatorio, textoOpcional } from "@/lib/validacao";

const esquema = z.object({
  nome_negocio: textoObrigatorio(2, 80, "Informe o nome da empresa."),
  responsavel: textoOpcional(80),
  documento: textoOpcional(30),
  whatsapp: z
    .string()
    .optional()
    .transform((v) => somenteDigitos(v))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "WhatsApp com DDD, ex.: (34) 90000-0000.")
    .transform((v) => (v === "" ? null : v)),
  email: textoOpcional(160),
  site: textoOpcional(160),
  cidade: textoOpcional(80),
  uf: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "Use a sigla do estado, ex.: MG.")
    .transform((v) => (v === "" ? null : v)),
  endereco: textoOpcional(160),
  instagram: textoOpcional(60).transform((v) => (v ? v.replace(/^@/, "") : v)),
  vendedores_veem_tudo: caixa,
  dias_sem_contato: inteiro(1, 90, "De 1 a 90 dias."),
  mensagem_whatsapp: textoOpcional(500),
});

export async function salvarConfiguracoes(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const dados = esquema.safeParse(lerFormulario(formData));
  if (!dados.success) return falha("Confira os campos destacados.", errosDoZod(dados.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("configuracoes").upsert({ unica: true, ...dados.data }, { onConflict: "unica" });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/", "layout");
  return sucesso("Configurações salvas.");
}

// ---------------------------------------------------------------- propostas, agenda e atendimento (Aurora)
/** Número opcional: "" = não definido (nulo no banco). Aceita vírgula. */
const numeroOpcional = (min: number, max: number, msg: string, inteiroSo = false) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().replace(/\./g, "").replace(",", "."))
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max && (!inteiroSo || Number.isInteger(Number(v)))), msg)
    .transform((v) => (v === "" ? null : Number(v)));

const esquemaAurora = z.object({
  validade_proposta_dias: inteiro(1, 365, "De 1 a 365 dias."),
  prefixo_proposta: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "De 2 a 8 letras ou números, sem espaço."),
  entrada_pct: numeroOpcional(0, 100, "De 0 a 100."),
  entrada_dias_antes: numeroOpcional(0, 365, "De 0 a 365 dias.", true),
  saldo_dias_antes: numeroOpcional(0, 365, "De 0 a 365 dias.", true),
  cancelamento_aviso_dias: numeroOpcional(0, 365, "De 0 a 365 dias.", true),
  cancelamento_multa_pct: numeroOpcional(0, 100, "De 0 a 100."),
  taxa_quebra: numeroOpcional(0, 99999, "Valor inválido."),
  foro: textoOpcional(120),
  condicoes_padrao: textoOpcional(1000),
  rodape_proposta: textoOpcional(500),
  capacidade_simultanea: inteiro(1, 50, "De 1 a 50."),
  duracao_padrao_horas: z
    .string()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v >= 0.5 && v <= 24, "De 0,5 a 24 horas."),
  atendimento_novos_leads: z.enum(["humano", "agente"]),
});

export async function salvarConfigAurora(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const bruto = lerFormulario(formData);
  const dados = esquemaAurora.safeParse(bruto);
  if (!dados.success) return falha("Confira os campos destacados.", errosDoZod(dados.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  // textos da proposta: só guarda o que for diferente do padrão
  const textos: Record<string, string> = {};
  for (const chave of Object.keys(TEXTOS_PADRAO) as ChaveTexto[]) {
    const v = (bruto[`texto_${chave}`] ?? "").replace(/\r/g, "").trim();
    if (v.length > 1500) return falha("Um dos textos da proposta passou de 1.500 caracteres.", { [`texto_${chave}`]: "Máximo de 1.500 caracteres." });
    if (v !== "" && v !== TEXTOS_PADRAO[chave]) textos[chave] = v;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .upsert({ unica: true, ...dados.data, proposta_textos: textos }, { onConflict: "unica" });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/", "layout");
  return sucesso("Configurações salvas.");
}

// ---------------------------------------------------------------- módulos e dados (LGPD)
export async function salvarModulos(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = z
    .object({
      mod_empresas: caixa,
      mod_funis: caixa,
      mod_metas: caixa,
      mod_comissoes: caixa,
      mod_equipe: caixa,
      retencao_leads_meses: inteiro(1, 120, "De 1 a 120 meses."),
      email_privacidade: emailOpcional,
    })
    .safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("configuracoes").upsert({ unica: true, ...r.data }, { onConflict: "unica" });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/", "layout");
  return sucesso("Módulos e prazo de guarda salvos.");
}

/** Prazo de guarda (LGPD): simular = só conta quantos contatos seriam apagados. */
export async function aplicarRetencao(simular: boolean): Promise<EstadoAcao> {
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aplicar_retencao", { p_simular: simular });
  if (error) return falha(mensagemErroBanco(error));
  const n = Number(data ?? 0);
  if (!simular) revalidatePath("/", "layout");
  return sucesso(
    simular
      ? n === 0
        ? "Nenhum contato passou do prazo de guarda."
        : `${n} contato(s) passaram do prazo de guarda.`
      : `${n} contato(s) tiveram os dados pessoais apagados.`,
    { quantidade: String(n) },
  );
}

// ---------------------------------------------------------------- funis
export async function salvarFunil(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = z
    .object({ id: idOpcional, nome: textoObrigatorio(2, 60, "Dê um nome ao funil."), ativo: caixa })
    .safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { id, ...d } = r.data;
  if (id) {
    const { error } = await supabase.from("funis").update(d).eq("id", id);
    if (error) return falha(mensagemErroBanco(error));
  } else {
    const { count } = await supabase.from("funis").select("id", { count: "exact", head: true });
    const { data, error } = await supabase.from("funis").insert({ ...d, ativo: true, ordem: (count ?? 0) + 1 }).select("id").single();
    if (error) return falha(mensagemErroBanco(error));
    // etapas iniciais (dá para mudar depois)
    const { error: e2 } = await supabase.from("etapas").insert([
      { funil_id: data.id, nome: "Prospecção", ordem: 1, probabilidade: 10, cor: "#64748B" },
      { funil_id: data.id, nome: "Qualificação", ordem: 2, probabilidade: 25, cor: "#0EA5E9" },
      { funil_id: data.id, nome: "Proposta", ordem: 3, probabilidade: 50, cor: "#F59E0B" },
      { funil_id: data.id, nome: "Negociação", ordem: 4, probabilidade: 75, cor: "#10B981" },
    ]);
    if (e2) return falha(mensagemErroBanco(e2));
  }
  revalidatePath("/configuracoes/funis");
  revalidatePath("/funil");
  return sucesso(id ? "Funil salvo." : "Funil criado com 4 etapas iniciais. Ajuste à vontade.");
}

export async function excluirFunil(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Funil inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("funis").delete().eq("id", id);
  if (error)
    return falha(error.code === "23503" ? "Este funil tem negócios. Desative-o em vez de excluir (o histórico continua)." : mensagemErroBanco(error));
  revalidatePath("/configuracoes/funis");
  revalidatePath("/funil");
  return sucesso("Funil excluído.");
}

const esquemaEtapas = z
  .array(
    z.object({
      id: z.string().nullable(),
      nome: z.string().trim().min(2, "Toda etapa precisa de nome (2+ letras).").max(40),
      probabilidade: z.number().int().min(0, "Probabilidade de 0 a 100%.").max(100, "Probabilidade de 0 a 100%."),
      cor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    }),
  )
  .min(1, "O funil precisa de pelo menos 1 etapa.")
  .max(12, "Máximo de 12 etapas.");

/** Salva as etapas do funil (ordem = ordem da lista). Etapa removida com negócios é recusada pelo banco. */
export async function salvarEtapas(funilId: string, etapas: unknown): Promise<EstadoAcao> {
  if (!ehUuid(funilId)) return falha("Funil inválido.");
  const r = esquemaEtapas.safeParse(etapas);
  if (!r.success) return falha(r.error.issues[0]?.message ?? "Confira as etapas.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { data: atuais } = await supabase.from("etapas").select("id").eq("funil_id", funilId);
  const manter = new Set(r.data.map((e) => e.id).filter((x): x is string => Boolean(x && ehUuid(x))));
  const remover = (atuais ?? []).map((e) => e.id).filter((id) => !manter.has(id));
  if (remover.length) {
    const { error } = await supabase.from("etapas").delete().in("id", remover);
    if (error)
      return falha(
        error.code === "23503" ? "Uma etapa removida ainda tem negócios. Mova os negócios para outra etapa antes de remover." : mensagemErroBanco(error),
      );
  }
  for (const [i, e] of r.data.entries()) {
    const linha = { nome: e.nome, probabilidade: e.probabilidade, cor: e.cor.toUpperCase(), ordem: i + 1 };
    const { error } =
      e.id && ehUuid(e.id)
        ? await supabase.from("etapas").update(linha).eq("id", e.id).eq("funil_id", funilId)
        : await supabase.from("etapas").insert({ ...linha, funil_id: funilId });
    if (error) return falha(mensagemErroBanco(error));
  }
  revalidatePath("/configuracoes/funis");
  revalidatePath("/funil");
  return sucesso("Etapas salvas.");
}

// ---------------------------------------------------------------- listas
const TABELAS = { origens: "Origem", motivos_perda: "Motivo" } as const;
type TabelaLista = keyof typeof TABELAS;

export async function salvarItemLista(tabela: TabelaLista, item: { id?: string | null; nome: string; ativo: boolean }): Promise<EstadoAcao> {
  if (!(tabela in TABELAS)) return falha("Lista inválida.");
  const nome = String(item.nome ?? "").trim();
  if (nome.length < 2 || nome.length > (tabela === "origens" ? 60 : 80)) return falha("Nome com 2 a 80 letras.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  if (item.id && ehUuid(item.id)) {
    const { error } = await supabase.from(tabela).update({ nome, ativo: Boolean(item.ativo) }).eq("id", item.id);
    if (error) return falha(mensagemErroBanco(error));
  } else {
    const { count } = await supabase.from(tabela).select("id", { count: "exact", head: true });
    const { error } = await supabase.from(tabela).insert({ nome, ativo: true, ordem: (count ?? 0) + 1 });
    if (error) return falha(mensagemErroBanco(error));
  }
  revalidatePath("/configuracoes/listas");
  return sucesso(`${TABELAS[tabela]} salvo(a).`);
}

export async function excluirItemLista(tabela: TabelaLista, id: string): Promise<EstadoAcao> {
  if (!(tabela in TABELAS) || !ehUuid(id)) return falha("Item inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error)
    return falha(error.code === "23503" ? "Já usado em negócios perdidos: desative em vez de excluir." : mensagemErroBanco(error));
  revalidatePath("/configuracoes/listas");
  return sucesso("Excluído.");
}

// ---------------------------------------------------------------- modelos de mensagem
const esquemaModelo = z.object({
  id: idOpcional,
  titulo: textoObrigatorio(2, 60, "Dê um título ao modelo."),
  canal: z.enum(["whatsapp", "email"], "Escolha o canal."),
  texto: textoObrigatorio(5, 2000, "Escreva a mensagem (5+ letras)."),
  ativo: caixa,
});

export async function salvarModelo(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaModelo.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, ...d } = r.data;
  const supabase = await createClient();
  const { error } = id ? await supabase.from("modelos_mensagem").update(d).eq("id", id) : await supabase.from("modelos_mensagem").insert(d);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/configuracoes/mensagens");
  return sucesso("Modelo salvo.");
}

export async function excluirModelo(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Modelo inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("modelos_mensagem").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/configuracoes/mensagens");
  return sucesso("Modelo excluído.");
}
