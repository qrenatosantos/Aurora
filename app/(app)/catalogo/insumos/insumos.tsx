"use client";

/** Insumos: lista por categoria com os dois preços (tradicional e premium) e edição. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { EntradaMoeda, valorCampo } from "@/components/ui/controles";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CATEGORIAS_INSUMO, UNIDADES_INSUMO, nomeCategoriaInsumo } from "@/lib/aurora";
import { formatarMoeda } from "@/lib/formatar";
import type { Insumo } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { excluirInsumo, salvarInsumo } from "../actions";

const qtd = (n: number) => String(Number(n)).replace(".", ",");

export function ListaInsumos({ insumos, gestor }: { insumos: Insumo[]; gestor: boolean }) {
  const [editando, setEditando] = useState<Insumo | "novo" | null>(null);
  const semPreco = insumos.filter((i) => i.ativo && i.preco_tradicional === null).length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-texto-2">
          {semPreco > 0 ? (
            <span className="font-semibold text-alerta">{semPreco} insumo(s) ainda sem preço. Sem eles, a calculadora não fecha a conta.</span>
          ) : (
            "Todos os insumos ativos têm preço."
          )}
        </p>
        {gestor && (
          <Botao onClick={() => setEditando("novo")}>
            <Plus className="size-4" aria-hidden /> Novo insumo
          </Botao>
        )}
      </div>

      {insumos.length === 0 ? (
        <EstadoVazio titulo="Nenhum insumo cadastrado" descricao="Cadastre as bebidas, frutas e demais itens usados nos drinks." />
      ) : (
        <Cartao className="relative overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs tracking-wider text-texto-2 uppercase">
                <th scope="col" className="px-4 py-3 font-bold">Insumo</th>
                <th scope="col" className="px-4 py-3 font-bold">Embalagem</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">Tradicional</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">Premium</th>
                {gestor && <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Editar</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {insumos.map((i) => (
                <tr key={i.id} className={i.ativo ? undefined : "opacity-55"}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">
                    {i.nome}
                    <span className="block text-xs font-normal text-texto-2">
                      {nomeCategoriaInsumo(i.categoria)}
                      {!i.ativo ? " · desativado" : ""}
                    </span>
                  </th>
                  <td className="num px-4 py-2.5 whitespace-nowrap">
                    {qtd(i.embalagem)} {i.unidade}
                  </td>
                  <td className="num px-4 py-2.5 text-right whitespace-nowrap">
                    {i.preco_tradicional === null ? <Selo cor="alerta">sem preço</Selo> : formatarMoeda(i.preco_tradicional)}
                    {i.marca_tradicional && <span className="block text-xs text-texto-2">{i.marca_tradicional}</span>}
                  </td>
                  <td className="num px-4 py-2.5 text-right whitespace-nowrap">
                    {i.preco_premium === null ? <span className="text-texto-2">—</span> : formatarMoeda(i.preco_premium)}
                    {i.marca_premium && <span className="block text-xs text-texto-2">{i.marca_premium}</span>}
                  </td>
                  {gestor && (
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        aria-label={`Editar ${i.nome}`}
                        className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-texto"
                        onClick={() => setEditando(i)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}
      <p className="mt-3 text-xs text-texto-2">
        Premium vazio = o insumo não tem versão premium; na linha premium, a conta usa o preço tradicional dele (ex.: limão, gelo).
      </p>

      {editando && <DialogoInsumo key={editando === "novo" ? "novo" : editando.id} insumo={editando === "novo" ? null : editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function DialogoInsumo({ insumo, aoFechar }: { insumo: Insumo | null; aoFechar: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const { onSubmit, erros: e, pendente } = useAcao(salvarInsumo, {
    aoSucesso: () => {
      aoFechar();
      router.refresh();
    },
  });

  return (
    <Modal aberto aoFechar={aoFechar} titulo={insumo ? `Editar ${insumo.nome}` : "Novo insumo"} largo>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {insumo && <input type="hidden" name="id" value={insumo.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" nome="nome" erro={e.nome}>
            {(p) => <Entrada {...p} defaultValue={insumo?.nome ?? ""} maxLength={80} required placeholder="Ex.: Vodka" />}
          </Campo>
          <Campo rotulo="Categoria" nome="categoria" erro={e.categoria}>
            {(p) => (
              <Selecao {...p} defaultValue={insumo?.categoria ?? "outro"}>
                {CATEGORIAS_INSUMO.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Medido em" nome="unidade" erro={e.unidade} ajuda="A receita dos drinks usa esta unidade.">
            {(p) => (
              <Selecao {...p} defaultValue={insumo?.unidade ?? "ml"}>
                {UNIDADES_INSUMO.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Quanto vem na embalagem" nome="embalagem" erro={e.embalagem} ajuda="Ex.: garrafa de 1 litro = 1000 (ml); saco de gelo de 5 kg = 5000 (g).">
            {(p) => <Entrada {...p} inputMode="decimal" defaultValue={insumo ? qtd(insumo.embalagem) : ""} required />}
          </Campo>
        </div>
        <div className="grid gap-4 rounded-xl border border-borda p-3 sm:grid-cols-2">
          <Campo rotulo="Preço da embalagem — linha tradicional" nome="preco_tradicional" erro={e.preco_tradicional}>
            {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(insumo?.preco_tradicional)} placeholder="0,00" />}
          </Campo>
          <Campo rotulo="Marca tradicional (opcional)" nome="marca_tradicional" erro={e.marca_tradicional}>
            {(p) => <Entrada {...p} defaultValue={insumo?.marca_tradicional ?? ""} maxLength={80} />}
          </Campo>
          <Campo rotulo="Preço da embalagem — linha premium" nome="preco_premium" erro={e.preco_premium} ajuda="Deixe vazio se não houver versão premium.">
            {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(insumo?.preco_premium)} placeholder="0,00" />}
          </Campo>
          <Campo rotulo="Marca premium (opcional)" nome="marca_premium" erro={e.marca_premium}>
            {(p) => <Entrada {...p} defaultValue={insumo?.marca_premium ?? ""} maxLength={80} />}
          </Campo>
        </div>
        <Campo rotulo="Observações (opcional)" nome="observacoes" erro={e.observacoes}>
          {(p) => <AreaTexto {...p} rows={2} maxLength={500} defaultValue={insumo?.observacoes ?? ""} />}
        </Campo>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={insumo?.ativo ?? true} className="size-5 accent-[var(--marca)]" />
          Insumo ativo
        </label>
        <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:items-center sm:justify-end">
          {insumo && (
            <Botao
              variante="fantasma"
              className="text-perigo sm:mr-auto"
              onClick={async () => {
                if (!(await confirmar({ titulo: `Excluir ${insumo.nome}?`, perigo: true }))) return;
                iniciar(async () => {
                  const r = await excluirInsumo(insumo.id);
                  if (r.ok) {
                    toast.sucesso(r.mensagem ?? "Excluído.");
                    aoFechar();
                    router.refresh();
                  } else toast.erro(r.mensagem ?? "Não foi possível excluir.");
                });
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Excluir
            </Botao>
          )}
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pendente}>
            Salvar insumo
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
