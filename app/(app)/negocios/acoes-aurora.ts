"use server";

/**
 * MUTATIONS da Aurora ligadas ao negócio: dados do evento, responsável pelo
 * atendimento (agente ou humano) e registro manual da conversa.
 * As regras ficam no banco (schema.sql, parte da Aurora).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { dataOpcional, ehUuid, idObrigatorio, idOpcional, textoOpcional } from "@/lib/validacao";

function revalidar(negocioId: string) {
  revalidatePath(`/negocios/${negocioId}`);
  revalidatePath("/eventos");
  revalidatePath("/funil");
  revalidatePath("/");
}

const numeroOpcional = (min: number, max: number, msg: string, inteiroSo = false) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().replace(",", "."))
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max && (!inteiroSo || Number.isInteger(Number(v)))), msg)
    .transform((v) => (v === "" ? null : Number(v)));

const esquemaEvento = z.object({
  negocio_id: idObrigatorio("Negócio inválido."),
  tipo: z.enum(["", "casamento", "15_anos", "aniversario", "formatura", "empresa", "outro"]).transform((v) => (v === "" ? null : v)),
  nome: textoOpcional(120),
  data: dataOpcional,
  mes_previsto: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}$/.test(v), "Mês inválido.")
    .transform((v) => (v ? `${v}-01` : null)),
  hora_inicio: z
    .string()
    .optional()
    .transform((v) => (v ? v.slice(0, 5) : null))
    .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Hora inválida."),
  duracao_horas: numeroOpcional(0.5, 24, "De 0,5 a 24 horas."),
  cidade: textoOpcional(80),
  uf: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "Use a sigla, ex.: MG.")
    .transform((v) => (v === "" ? null : v)),
  local: textoOpcional(160),
  convidados: numeroOpcional(1, 5000, "De 1 a 5.000 convidados.", true),
  convidados_faixa: textoOpcional(40),
  pacote_id: idOpcional,
  linha: z.enum(["", "tradicional", "premium"]).transform((v) => (v === "" ? null : v)),
  preferencias: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((x) => x.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 10),
    ),
  observacoes: textoOpcional(2000),
  situacao_data: z.enum(["consulta", "reservada", "confirmada", "liberada"]),
});

/** Salva os dados do evento do negócio (cria na primeira vez). */
export async function salvarEvento(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaEvento.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const d = r.data;
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").upsert(
    {
      ...d,
      mes_previsto: d.data ? null : d.mes_previsto,
      pacote_id: d.pacote_id,
      quer_ajuda_pacote: false,
      // reserva feita à mão não vence sozinha (a automática vence na validade da proposta)
      reservada_ate: null,
    },
    { onConflict: "negocio_id" },
  );
  if (error) return falha(mensagemErroBanco(error));
  revalidar(d.negocio_id);

  // aviso de data ocupada (a gravação já foi feita; é só um alerta)
  if (d.data) {
    const { data: disp } = await supabase.rpc("disponibilidade_data", {
      p_data: d.data,
      p_hora: d.hora_inicio,
      p_duracao: d.duracao_horas,
      p_ignorar: d.negocio_id,
    });
    const s = (disp as { situacao?: string } | null)?.situacao;
    if (s === "lotada") return sucesso("Evento salvo. Atenção: a agenda já está lotada nesse dia e horário.");
    if (s === "bloqueada") return sucesso("Evento salvo. Atenção: essa data está bloqueada na agenda.");
  }
  return sucesso("Evento salvo.");
}

/** Botões "Passar para o agente" e "Assumir atendimento". */
export async function transferirAtendimento(negocioId: string, para: "agente" | "humano", motivo: string): Promise<EstadoAcao> {
  if (!ehUuid(negocioId) || (para !== "agente" && para !== "humano")) return falha("Dados inválidos.");
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transferir_atendimento", {
    p_negocio: negocioId,
    p_para: para,
    p_motivo: motivo.trim().slice(0, 500) || null,
  });
  if (error) return falha(mensagemErroBanco(error));
  revalidar(negocioId);
  if (!data) return sucesso(para === "agente" ? "O atendimento já estava com o agente." : "O atendimento já estava com você.");
  return sucesso(para === "agente" ? "Atendimento passado para o agente." : "Você assumiu o atendimento.");
}

const esquemaMensagem = z.object({
  negocio_id: idObrigatorio("Negócio inválido."),
  quem: z.enum(["cliente", "humano"]),
  canal: z.enum(["whatsapp", "instagram", "email", "telefone", "outro"]),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(8000, "Máximo de 8.000 caracteres."),
});

/** Registro manual de uma mensagem na conversa (o que o cliente disse ou o que a equipe respondeu). */
export async function registrarMensagem(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaMensagem.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const p = await exigirPerfil();
  if ("erro" in p) return falha(p.erro);
  const d = r.data;
  const supabase = await createClient();
  const { data: negocio } = await supabase.from("negocios").select("contato_id").eq("id", d.negocio_id).maybeSingle();
  if (!negocio) return falha("Negócio não encontrado ou sem permissão.");
  const { error } = await supabase.from("mensagens").insert({
    negocio_id: d.negocio_id,
    contato_id: negocio.contato_id,
    canal: d.canal,
    direcao: d.quem === "cliente" ? "entrada" : "saida",
    autor: d.quem,
    texto: d.texto,
  });
  if (error) return falha(mensagemErroBanco(error));
  revalidar(d.negocio_id);
  return sucesso("Mensagem registrada.");
}
