"use client";

/** Pacotes: cartões com os drinks incluídos e edição (só o gestor). */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { nomeCategoriaDrink } from "@/lib/aurora";
import type { Drink, Pacote, PacoteDrink } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { excluirPacote, salvarPacote } from "./actions";

export function ListaPacotes({ pacotes, drinks, ligacoes, gestor }: { pacotes: Pacote[]; drinks: Drink[]; ligacoes: PacoteDrink[]; gestor: boolean }) {
  const [editando, setEditando] = useState<Pacote | "novo" | null>(null);
  const drinksDe = (id: string) =>
    ligacoes
      .filter((l) => l.pacote_id === id)
      .map((l) => drinks.find((d) => d.id === l.drink_id))
      .filter((d): d is Drink => Boolean(d));

  return (
    <>
      {gestor && (
        <div className="mb-4 flex justify-end">
          <Botao onClick={() => setEditando("novo")}>
            <Plus className="size-4" aria-hidden /> Novo pacote
          </Botao>
        </div>
      )}
      {pacotes.length === 0 ? (
        <EstadoVazio titulo="Nenhum pacote cadastrado" descricao="Rode o arquivo supabase/dados-iniciais.sql para trazer os pacotes do site, ou crie um novo." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pacotes.map((p) => {
            const lista = drinksDe(p.id);
            return (
              <Cartao key={p.id} className={p.ativo ? undefined : "opacity-60"}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold">{p.nome}</h2>
                    {p.slogan && <p className="text-sm text-texto-2 italic">{p.slogan}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!p.ativo && <Selo>Desativado</Selo>}
                    {gestor && (
                      <button
                        type="button"
                        aria-label={`Editar pacote ${p.nome}`}
                        className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-texto"
                        onClick={() => setEditando(p)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
                {p.descricao && <p className="mt-2 text-sm">{p.descricao}</p>}
                <h3 className="mt-3 mb-1.5 text-xs font-bold tracking-wider text-texto-2 uppercase">Drinks do pacote ({lista.length})</h3>
                {lista.length === 0 ? (
                  <p className="text-sm text-texto-2">Nenhum drink neste pacote.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {lista.map((d) => (
                      <li key={d.id}>
                        <Selo cor={d.alcoolico ? "marca" : "ok"} title={nomeCategoriaDrink(d.categoria)}>
                          {d.nome}
                        </Selo>
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>
            );
          })}
        </div>
      )}

      {editando && (
        <DialogoPacote
          key={editando === "novo" ? "novo" : editando.id}
          pacote={editando === "novo" ? null : editando}
          drinks={drinks}
          selecionados={editando === "novo" ? [] : drinksDe(editando.id).map((d) => d.id)}
          proximaOrdem={pacotes.length + 1}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function DialogoPacote({
  pacote,
  drinks,
  selecionados,
  proximaOrdem,
  aoFechar,
}: {
  pacote: Pacote | null;
  drinks: Drink[];
  selecionados: string[];
  proximaOrdem: number;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const [marcados, setMarcados] = useState<string[]>(selecionados);
  const { onSubmit, erros: e, pendente } = useAcao(salvarPacote, {
    aoSucesso: () => {
      aoFechar();
      router.refresh();
    },
  });
  // ordem do cardápio = ordem dos drinks no catálogo
  const emOrdem = drinks.filter((d) => marcados.includes(d.id)).map((d) => d.id);

  return (
    <Modal aberto aoFechar={aoFechar} titulo={pacote ? `Editar pacote ${pacote.nome}` : "Novo pacote"} largo>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {pacote && <input type="hidden" name="id" value={pacote.id} />}
        <input type="hidden" name="drinks" value={JSON.stringify(emOrdem)} />
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <Campo rotulo="Nome do pacote" nome="nome" erro={e.nome}>
            {(p) => <Entrada {...p} defaultValue={pacote?.nome ?? ""} maxLength={60} required />}
          </Campo>
          <Campo rotulo="Ordem" nome="ordem" erro={e.ordem}>
            {(p) => <Entrada {...p} type="number" min={0} defaultValue={pacote?.ordem ?? proximaOrdem} />}
          </Campo>
        </div>
        <Campo rotulo="Frase do pacote" nome="slogan" erro={e.slogan}>
          {(p) => <Entrada {...p} defaultValue={pacote?.slogan ?? ""} maxLength={160} placeholder="Ex.: Os clássicos que nunca falham." />}
        </Campo>
        <Campo rotulo="Descrição (opcional)" nome="descricao" erro={e.descricao}>
          {(p) => <AreaTexto {...p} rows={2} maxLength={500} defaultValue={pacote?.descricao ?? ""} />}
        </Campo>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Drinks incluídos ({marcados.length})</legend>
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-xl border border-borda p-2 sm:grid-cols-2">
            {drinks
              .filter((d) => d.ativo || marcados.includes(d.id))
              .map((d) => (
                <label key={d.id} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-superficie-2">
                  <input
                    type="checkbox"
                    checked={marcados.includes(d.id)}
                    onChange={(ev) => setMarcados((m) => (ev.target.checked ? [...m, d.id] : m.filter((x) => x !== d.id)))}
                    className="size-5 shrink-0 accent-[var(--marca)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                  <span className="shrink-0 text-xs text-texto-2">{nomeCategoriaDrink(d.categoria)}</span>
                </label>
              ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={pacote?.ativo ?? true} className="size-5 accent-[var(--marca)]" />
          Pacote ativo (aparece nas propostas e para o agente)
        </label>
        <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:items-center sm:justify-end">
          {pacote && (
            <Botao
              variante="fantasma"
              className="text-perigo sm:mr-auto"
              onClick={async () => {
                if (!(await confirmar({ titulo: `Excluir o pacote ${pacote.nome}?`, mensagem: "Propostas já feitas não mudam.", perigo: true }))) return;
                iniciar(async () => {
                  const r = await excluirPacote(pacote.id);
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
            Salvar pacote
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
