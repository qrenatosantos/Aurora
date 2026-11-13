"use server";

/**
 * EQUIPE: vendedores (pré-cadastro pelo e-mail) e equipes. Só o gestor.
 * O login é criado no Supabase (Authentication ▸ Users); no 1º acesso o sistema
 * liga o usuário ao vendedor pelo e-mail.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type EstadoAcao, errosDoZod, falha, lerFormulario, mensagemErroBanco, sucesso } from "@/lib/acoes";
import { exigirGestor } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { caixa, ehUuid, emailOpcional, idOpcional, telefoneOpcional, textoObrigatorio } from "@/lib/validacao";

const esquema = z.object({
  id: idOpcional,
  nome: textoObrigatorio(2, 120, "Informe o nome."),
  email: emailOpcional,
  telefone: telefoneOpcional,
  papel: z.enum(["gestor", "vendedor"], "Escolha o papel."),
  equipe_id: idOpcional,
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  ativo: caixa,
});

export async function salvarVendedor(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquema.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const { id, ...d } = r.data;
  if (!id && !d.email) return falha("Confira os campos.", { email: "Informe o e-mail que a pessoa usará para entrar." });
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("vendedores").update(d).eq("id", id).select("id")
    : await supabase.from("vendedores").insert(d).select("id");
  if (error) return falha(mensagemErroBanco(error));
  if (!data?.length) return falha("Pessoa não encontrada.");
  revalidatePath("/equipe");
  revalidatePath("/", "layout");
  return sucesso(id ? "Cadastro salvo." : "Pessoa cadastrada. Crie o login dela no Supabase com este mesmo e-mail.");
}

export async function excluirVendedor(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Cadastro inválido.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("vendedores").delete().eq("id", id);
  if (error)
    return falha(
      error.code === "23503" ? "Esta pessoa tem negócios ou atividades. Desmarque “Ativo” em vez de excluir (o histórico continua)." : mensagemErroBanco(error),
    );
  revalidatePath("/equipe");
  return sucesso("Cadastro excluído.");
}

const esquemaEquipe = z.object({ id: idOpcional, nome: textoObrigatorio(2, 60, "Informe o nome da equipe.") });

export async function salvarEquipe(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const r = esquemaEquipe.safeParse(lerFormulario(formData));
  if (!r.success) return falha("Confira os campos destacados.", errosDoZod(r.error));
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = r.data.id
    ? await supabase.from("equipes").update({ nome: r.data.nome }).eq("id", r.data.id)
    : await supabase.from("equipes").insert({ nome: r.data.nome });
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/equipe");
  return sucesso("Equipe salva.");
}

export async function excluirEquipe(id: string): Promise<EstadoAcao> {
  if (!ehUuid(id)) return falha("Equipe inválida.");
  const g = await exigirGestor();
  if ("erro" in g) return falha(g.erro);
  const supabase = await createClient();
  const { error } = await supabase.from("equipes").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/equipe");
  return sucesso("Equipe excluída (as pessoas ficaram sem equipe).");
}
