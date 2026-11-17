"use server";

/** MUTATIONS da agenda de eventos: bloqueios de data (só o gestor) e consulta de disponibilidade. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { exigirGestor, exigirPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Disponibilidade } from "@/lib/tipos";
import { ehUuid, textoOpcional } from "@/lib/validacao";

const data = (msg: string) => z.string(msg).regex(/^\d{4}-\d{2}-\d{2}$/, msg);

export async function salvarBloqueio(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = z
    .object({ inicio: data("Informe o primeiro dia."), fim: z.string().optional(), motivo: textoOpcional(160) })
    .safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const fim = r.data.fim && /^\d{4}-\d{2}-\d{2}$/.test(r.data.fim) ? r.data.fim : r.data.inicio;
  if (fim < r.data.inicio) return falha("O último dia não pode ser antes do primeiro.", { fim: "Data anterior ao início." });
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("bloqueios_agenda").insert({ inicio: r.data.inicio, fim, motivo: r.data.motivo });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/eventos");
  return sucesso("Data bloqueada na agenda.");
}

export async function excluirBloqueio(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Bloqueio inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("bloqueios_agenda").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/eventos");
  return sucesso("Bloqueio removido.");
}

/** "Essa data está livre?" — mesma conta que o agente recebe pela API. */
export async function consultarDisponibilidade(dia: string, hora: string, horas = ""): Promise<{ ok: boolean; mensagem?: string; disponibilidade?: Disponibilidade }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, mensagem: "Escolha a data." };
  const p = await exigirPerfil();
  if ("erro" in p) return { ok: false, mensagem: p.erro };
  const supabase = await createClient();
  const { data: d, error } = await supabase.rpc("disponibilidade_data", {
    p_data: dia,
    p_hora: /^\d{2}:\d{2}/.test(hora) ? hora.slice(0, 5) : null,
    p_duracao: Number(horas.replace(",", ".")) >= 0.5 && Number(horas.replace(",", ".")) <= 24 ? Number(horas.replace(",", ".")) : null,
  });
  if (error) return { ok: false, mensagem: mensagemErroBanco(error) };
  return { ok: true, disponibilidade: d as unknown as Disponibilidade };
}
