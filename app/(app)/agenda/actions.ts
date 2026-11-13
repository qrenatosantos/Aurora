"use server";

/**
 * MUTATIONS das atividades (tarefas, ligações, reuniões, WhatsApp, e-mail, visitas).
 * Atividade concluída ligada a um negócio atualiza a "última atividade" dele (gatilho no banco).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { localParaISO } from "@/lib/comercial";
import { exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { caixa, ehUuid, idOpcional, textoObrigatorio, textoOpcional } from "@/lib/validacao";

const TIPOS = ["tarefa", "ligacao", "reuniao", "whatsapp", "email", "visita"] as const;

function revalidarAgenda(negocioId?: string | null, contatoId?: string | null, empresaId?: string | null) {
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath("/funil");
  if (negocioId) revalidatePath(`/negocios/${negocioId}`);
  if (contatoId) revalidatePath(`/contatos/${contatoId}`);
  if (empresaId) revalidatePath(`/empresas/${empresaId}`);
}

const esquema = z.object({
  id: idOpcional,
  tipo: z.enum(TIPOS, "Escolha o tipo."),
  titulo: textoObrigatorio(2, 160, "Descreva a atividade (ex.: Ligar para apresentar a proposta)."),
  descricao: textoOpcional(2000),
  quando: z
    .string("Informe a data e a hora.")
    .transform((v) => localParaISO(v))
    .refine((v) => v !== null, "Informe a data e a hora."),
  duracao_min: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 1440), "Duração em minutos (1 a 1440)."),
  vendedor_id: idOpcional,
  negocio_id: idOpcional,
  contato_id: idOpcional,
  empresa_id: idOpcional,
  concluida: caixa,
  resultado: textoOpcional(1000),
});

export async function salvarAtividade(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquema.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const { id, ...d } = r.data;
  const supabase = await createClient();

  let { contato_id, empresa_id } = d;
  // Atividade de um negócio herda o contato/empresa do negócio (e o dono, se o gestor não escolher outro).
  let donoNegocio: string | null = null;
  if (d.negocio_id) {
    const { data: n } = await supabase.from("negocios").select("contato_id, empresa_id, vendedor_id").eq("id", d.negocio_id).maybeSingle();
    if (!n) return falha("Negócio não encontrado.");
    contato_id = contato_id ?? n.contato_id;
    empresa_id = empresa_id ?? n.empresa_id;
    donoNegocio = n.vendedor_id;
  }
  const vendedor_id = p.perfil.papel === "gestor" ? (d.vendedor_id ?? donoNegocio ?? p.perfil.id) : p.perfil.id;
  const linha = { ...d, vendedor_id, contato_id, empresa_id, quando: d.quando as string };

  const { error, data } = id
    ? await supabase.from("atividades").update(linha).eq("id", id).select("id")
    : await supabase.from("atividades").insert(linha).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Atividade não encontrada ou sem permissão.");
  revalidarAgenda(d.negocio_id, contato_id, empresa_id);
  return sucesso(id ? "Atividade salva." : d.concluida ? "Interação registrada." : "Atividade agendada.");
}

/** Marcar como feita (ou desfazer), com resultado opcional. */
export async function concluirAtividade(id: string, concluida: boolean, resultado?: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Atividade inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades")
    .update({ concluida, ...(resultado ? { resultado: resultado.slice(0, 1000) } : {}) })
    .eq("id", id)
    .select("negocio_id, contato_id, empresa_id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para alterar esta atividade.");
  revalidarAgenda(data[0].negocio_id, data[0].contato_id, data[0].empresa_id);
  return sucesso(concluida ? "Atividade concluída." : "Atividade reaberta.");
}

/** Adia para outro dia/hora (botões "+1 dia", "+1 semana"). */
export async function adiarAtividade(id: string, dias: number): Promise<EstadoAcao> {
  if (!ehUuid(id) || ![1, 2, 7].includes(dias)) return falha("Dados inválidos.");
  const supabase = await createClient();
  const { data: a } = await supabase.from("atividades").select("quando, negocio_id").eq("id", id).maybeSingle();
  if (!a) return falha("Atividade não encontrada.");
  const base = Math.max(Date.parse(a.quando), Date.now());
  const quando = new Date(base + dias * 86400000).toISOString();
  const { data, error } = await supabase.from("atividades").update({ quando }).eq("id", id).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para alterar esta atividade.");
  revalidarAgenda(a.negocio_id);
  return sucesso(dias === 7 ? "Adiada para a semana que vem." : `Adiada ${dias} dia${dias > 1 ? "s" : ""}.`);
}

export async function excluirAtividade(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Atividade inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("atividades").delete().eq("id", id).select("negocio_id, contato_id, empresa_id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Sem permissão para excluir esta atividade.");
  revalidarAgenda(data[0].negocio_id, data[0].contato_id, data[0].empresa_id);
  return sucesso("Atividade excluída.");
}

/** Registro automático ao abrir o WhatsApp com um modelo (botão WhatsApp). */
export async function registrarMensagem(dados: {
  canal: "whatsapp" | "email";
  texto: string;
  negocioId?: string | null;
  contatoId?: string | null;
  empresaId?: string | null;
  titulo?: string;
}): Promise<EstadoAcao> {
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const negocio_id = dados.negocioId && ehUuid(dados.negocioId) ? dados.negocioId : null;
  const contato_id = dados.contatoId && ehUuid(dados.contatoId) ? dados.contatoId : null;
  const empresa_id = dados.empresaId && ehUuid(dados.empresaId) ? dados.empresaId : null;
  const supabase = await createClient();
  let vendedor_id = p.perfil.id;
  if (negocio_id && p.perfil.papel === "gestor") {
    const { data: n } = await supabase.from("negocios").select("vendedor_id").eq("id", negocio_id).maybeSingle();
    vendedor_id = n?.vendedor_id ?? vendedor_id;
  }
  const { error } = await supabase.from("atividades").insert({
    tipo: dados.canal,
    titulo: (dados.titulo || (dados.canal === "whatsapp" ? "Mensagem pelo WhatsApp" : "E-mail enviado")).slice(0, 160),
    descricao: dados.texto.slice(0, 2000),
    quando: new Date().toISOString(),
    concluida: true,
    vendedor_id,
    negocio_id,
    contato_id,
    empresa_id,
  });
  if (error) return falha(mensagemErroBanco(error));
  revalidarAgenda(negocio_id, contato_id, empresa_id);
  return sucesso("Mensagem registrada no histórico.");
}
