"use client";

/** Gestão da equipe: vendedores (papel, equipe, cor, ativo) e equipes. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatarTelefone, iniciais } from "@/lib/formatar";
import type { Equipe as TEquipe, Vendedor } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { excluirEquipe, excluirVendedor, salvarEquipe, salvarVendedor } from "./actions";

export function Equipe({ vendedores, equipes, meuId, mostrarEquipes }: { vendedores: Vendedor[]; equipes: TEquipe[]; meuId: string | null; mostrarEquipes: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const [vend, setVend] = useState<Vendedor | "novo" | null>(null);
  const [eq, setEq] = useState<TEquipe | "nova" | null>(null);
  const nomeEq = new Map(equipes.map((e) => [e.id, e.nome]));

  function excluir(acao: () => Promise<{ ok: boolean; mensagem?: string }>, titulo: string) {
    return async () => {
      if (!(await confirmar({ titulo, perigo: true }))) return;
      iniciar(async () => {
        const r = await acao();
        if (r.ok) {
          toast.sucesso(r.mensagem ?? "Excluído.");
          router.refresh();
        } else toast.erro(r.mensagem ?? "Não foi possível.");
      });
    };
  }
  const fechar = () => {
    setVend(null);
    setEq(null);
    router.refresh();
  };

  return (
    <div className={mostrarEquipes ? "grid grid-cols-1 gap-4 lg:grid-cols-3" : ""}>
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Pessoas</h2>
          <Botao onClick={() => setVend("novo")}>
            <UserPlus className="size-4" aria-hidden /> Nova pessoa
          </Botao>
        </div>
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
          {vendedores.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-4 py-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: v.cor }}>
                {iniciais(v.nome)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                  {v.nome}
                  {v.id === meuId && <span className="text-xs text-texto-2">(você)</span>}
                  {v.tipo === "agente" ? (
                    <Selo cor="info">Atendente automático</Selo>
                  ) : (
                    <>
                      <Selo cor={v.papel === "gestor" ? "marca" : "neutro"}>{v.papel === "gestor" ? "Gestor" : "Atendente"}</Selo>
                      {!v.ativo && <Selo cor="perigo">Inativo</Selo>}
                      {!v.user_id && v.ativo && <Selo cor="alerta">Ainda não entrou</Selo>}
                    </>
                  )}
                </span>
                <span className="block truncate text-xs text-texto-2">
                  {v.tipo === "agente"
                    ? "Não tem login: entra só pela API, com a chave criada em Integrações. Nunca aprova propostas."
                    : [v.email, formatarTelefone(v.telefone), v.equipe_id ? nomeEq.get(v.equipe_id) : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              {v.tipo !== "agente" && (
                <Botao variante="fantasma" aria-label={`Editar ${v.nome}`} onClick={() => setVend(v)}>
                  <Pencil className="size-4" aria-hidden />
                </Botao>
              )}
              {v.id !== meuId && v.tipo !== "agente" && (
                <Botao variante="fantasma" className="!text-perigo" aria-label={`Excluir ${v.nome}`} onClick={excluir(() => excluirVendedor(v.id), `Excluir ${v.nome}?`)}>
                  <Trash2 className="size-4" aria-hidden />
                </Botao>
              )}
            </li>
          ))}
        </ul>
      </div>
      {mostrarEquipes && (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Equipes</h2>
          <Botao variante="secundario" onClick={() => setEq("nova")}>
            <Plus className="size-4" aria-hidden /> Nova
          </Botao>
        </div>
        <Cartao className="p-2">
          {equipes.length === 0 ? (
            <p className="p-3 text-sm text-texto-2">Sem equipes. Crie para ter metas por equipe.</p>
          ) : (
            <ul>
              {equipes.map((e) => (
                <li key={e.id} className="flex items-center gap-2 rounded-xl px-3 py-1.5 hover:bg-superficie-2">
                  <span className="flex-1 text-sm font-medium">
                    {e.nome} <span className="text-xs text-texto-2">({vendedores.filter((v) => v.equipe_id === e.id).length})</span>
                  </span>
                  <Botao variante="fantasma" aria-label={`Renomear ${e.nome}`} onClick={() => setEq(e)}>
                    <Pencil className="size-4" aria-hidden />
                  </Botao>
                  <Botao variante="fantasma" className="!text-perigo" aria-label={`Excluir ${e.nome}`} onClick={excluir(() => excluirEquipe(e.id), `Excluir a equipe ${e.nome}?`)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
      )}

      {vend && <DialogoVendedor vendedor={vend === "novo" ? null : vend} equipes={mostrarEquipes ? equipes : []} aoFechar={fechar} />}
      {eq && <DialogoEquipe equipe={eq === "nova" ? null : eq} aoFechar={fechar} />}
    </div>
  );
}

function DialogoVendedor({ vendedor, equipes, aoFechar }: { vendedor: Vendedor | null; equipes: TEquipe[]; aoFechar: () => void }) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarVendedor, { aoSucesso: aoFechar });
  return (
    <Modal aberto aoFechar={aoFechar} titulo={vendedor ? "Editar pessoa" : "Nova pessoa"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {vendedor && <input type="hidden" name="id" value={vendedor.id} />}
        <Campo rotulo="Nome" nome="nome" erro={e.nome}>
          {(p) => <Entrada {...p} defaultValue={vendedor?.nome ?? ""} maxLength={120} required autoFocus />}
        </Campo>
        <Campo rotulo="E-mail de login" nome="email" erro={e.email} ajuda="O mesmo e-mail do usuário criado no Supabase (Authentication ▸ Users).">
          {(p) => <Entrada {...p} type="email" defaultValue={vendedor?.email ?? ""} autoComplete="off" />}
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Telefone" nome="telefone" erro={e.telefone}>
            {(p) => <Entrada {...p} type="tel" defaultValue={formatarTelefone(vendedor?.telefone)} />}
          </Campo>
          <Campo rotulo="Cor" nome="cor" erro={e.cor}>
            {(p) => <Entrada {...p} type="color" defaultValue={vendedor?.cor ?? "#2563EB"} className="h-11 p-1" />}
          </Campo>
          <Campo rotulo="Papel" nome="papel" erro={e.papel}>
            {(p) => (
              <Selecao {...p} defaultValue={vendedor?.papel ?? "vendedor"}>
                <option value="vendedor">Atendente (não aprova propostas)</option>
                <option value="gestor">Gestor (aprova propostas e administra)</option>
              </Selecao>
            )}
          </Campo>
          {equipes.length > 0 && (
          <Campo rotulo="Equipe" nome="equipe_id" erro={e.equipe_id}>
            {(p) => (
              <Selecao {...p} defaultValue={vendedor?.equipe_id ?? ""}>
                <option value="">— sem equipe —</option>
                {equipes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          )}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="ativo" defaultChecked={vendedor?.ativo ?? true} className="size-5 accent-[var(--marca)]" /> Ativo (pode entrar no
          sistema)
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pendente}>
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

function DialogoEquipe({ equipe, aoFechar }: { equipe: TEquipe | null; aoFechar: () => void }) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarEquipe, { aoSucesso: aoFechar });
  return (
    <Modal aberto aoFechar={aoFechar} titulo={equipe ? "Renomear equipe" : "Nova equipe"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {equipe && <input type="hidden" name="id" value={equipe.id} />}
        <Campo rotulo="Nome da equipe" nome="nome" erro={e.nome}>
          {(p) => <Entrada {...p} defaultValue={equipe?.nome ?? ""} maxLength={60} required autoFocus />}
        </Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pendente}>
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
