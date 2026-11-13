/**
 * Perfil do vendedor LOGADO (tabela vendedores).
 *
 * A função `meu_perfil()` do banco garante o cadastro no 1º acesso: vincula pelo
 * e-mail a um vendedor pré-cadastrado ou cria um novo (o 1º usuário vira gestor).
 * `cache()` = uma chamada por requisição (layout + página).
 *
 * As permissões de verdade ficam no banco (RLS). Estas funções só servem para
 * esconder botões e dar mensagens claras antes de tentar gravar.
 */
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Vendedor } from "@/lib/tipos";

export const obterPerfil = cache(async (): Promise<{ perfil: Vendedor | null; erro?: string }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("meu_perfil");
  if (error) {
    console.error("[meu_perfil]", error.message);
    return { perfil: null, erro: error.message };
  }
  return { perfil: (data as unknown as Vendedor | null) ?? null };
});

/** Para Server Actions: perfil ativo ou mensagem de erro pronta. */
export async function exigirPerfil(): Promise<{ perfil: Vendedor } | { erro: string }> {
  const { perfil } = await obterPerfil();
  if (!perfil) return { erro: "Não foi possível identificar seu cadastro. Faça login novamente." };
  if (!perfil.ativo) return { erro: "Seu acesso está desativado. Fale com o gestor." };
  return { perfil };
}

/** Para Server Actions só do gestor. */
export async function exigirGestor(): Promise<{ perfil: Vendedor } | { erro: string }> {
  const r = await exigirPerfil();
  if ("erro" in r) return r;
  if (r.perfil.papel !== "gestor") return { erro: "Só o gestor pode fazer isso." };
  return r;
}

export const ehGestor = (perfil: Vendedor | null | undefined) => perfil?.papel === "gestor" && perfil.ativo;
