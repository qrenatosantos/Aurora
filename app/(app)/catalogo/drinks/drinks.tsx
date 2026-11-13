"use client";

/** Drinks: lista por categoria, com edição dos dados do cardápio e da receita (insumos por drink). */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GlassWater, Pencil, Plus, Trash2, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CATEGORIAS_DRINK, COPOS } from "@/lib/aurora";
import type { Drink, DrinkInsumo, Insumo } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { excluirDrink, salvarDrink } from "../actions";

type LinhaReceita = { chave: number; insumo_id: string; quantidade: string };

export function ListaDrinks({ drinks, insumos, receitas, gestor }: { drinks: Drink[]; insumos: Insumo[]; receitas: DrinkInsumo[]; gestor: boolean }) {
  const [editando, setEditando] = useState<Drink | "novo" | null>(null);
  const comReceita = new Set(receitas.map((r) => r.drink_id));
  const nomeInsumo = new Map(insumos.map((i) => [i.id, i]));

  return (
    <>
      {gestor && (
        <div className="mb-4 flex justify-end">
          <Botao onClick={() => setEditando("novo")}>
            <Plus className="size-4" aria-hidden /> Novo drink
          </Botao>
        </div>
      )}
      {drinks.length === 0 ? (
        <EstadoVazio icone={GlassWater} titulo="Nenhum drink cadastrado" descricao="Rode o arquivo supabase/dados-iniciais.sql para trazer os drinks do site, ou cadastre um novo." />
      ) : (
        <div className="space-y-5">
          {CATEGORIAS_DRINK.map((cat) => {
            const lista = drinks.filter((d) => d.categoria === cat.id);
            if (!lista.length) return null;
            return (
              <section key={cat.id} aria-label={cat.nome}>
                <h2 className="mb-2 text-xs font-bold tracking-wider text-texto-2 uppercase">
                  {cat.nome} ({lista.length})
                </h2>
                <Cartao className="divide-y divide-borda p-0 sm:p-0">
                  {lista.map((d) => {
                    const receita = receitas.filter((r) => r.drink_id === d.id);
                    return (
                      <div key={d.id} className={`flex items-center gap-3 p-3 sm:p-4 ${d.ativo ? "" : "opacity-55"}`}>
                        {d.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto do catálogo (qualquer origem)
                          <img src={d.foto_url} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-superficie-2 text-texto-2">
                            <GlassWater className="size-6" aria-hidden />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                            {d.nome}
                            {!d.alcoolico && <Selo cor="ok">sem álcool</Selo>}
                            {!comReceita.has(d.id) && <Selo cor="alerta">sem receita</Selo>}
                            {!d.descricao && <Selo>sem descrição</Selo>}
                            {!d.ativo && <Selo>desativado</Selo>}
                          </p>
                          {d.descricao && <p className="truncate text-sm text-texto-2">{d.descricao}</p>}
                          {receita.length > 0 && (
                            <p className="mt-0.5 truncate text-xs text-texto-2">
                              Receita:{" "}
                              {receita
                                .map((r) => {
                                  const i = nomeInsumo.get(r.insumo_id);
                                  return i ? `${String(Number(r.quantidade)).replace(".", ",")} ${i.unidade} de ${i.nome.toLowerCase()}` : null;
                                })
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        {gestor && (
                          <button
                            type="button"
                            aria-label={`Editar ${d.nome}`}
                            className="grid size-11 shrink-0 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-texto"
                            onClick={() => setEditando(d)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </Cartao>
              </section>
            );
          })}
        </div>
      )}

      {editando && (
        <DialogoDrink
          key={editando === "novo" ? "novo" : editando.id}
          drink={editando === "novo" ? null : editando}
          insumos={insumos}
          receita={editando === "novo" ? [] : receitas.filter((r) => r.drink_id === editando.id)}
          proximaOrdem={drinks.length + 1}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function DialogoDrink({
  drink,
  insumos,
  receita,
  proximaOrdem,
  aoFechar,
}: {
  drink: Drink | null;
  insumos: Insumo[];
  receita: DrinkInsumo[];
  proximaOrdem: number;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const [linhas, setLinhas] = useState<LinhaReceita[]>(
    receita.map((r, i) => ({ chave: i, insumo_id: r.insumo_id, quantidade: String(Number(r.quantidade)).replace(".", ",") })),
  );
  const [proxima, setProxima] = useState(receita.length);
  const { onSubmit, erros: e, pendente } = useAcao(salvarDrink, {
    aoSucesso: () => {
      aoFechar();
      router.refresh();
    },
  });
  const unidade = (id: string) => insumos.find((i) => i.id === id)?.unidade ?? "";
  const receitaJson = JSON.stringify(
    linhas
      .filter((l) => l.insumo_id && l.quantidade.trim() !== "")
      .map((l) => ({ insumo_id: l.insumo_id, quantidade: Number(l.quantidade.replace(",", ".")) || 0 })),
  );
  const mudar = (chave: number, campo: "insumo_id" | "quantidade", valor: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));

  return (
    <Modal aberto aoFechar={aoFechar} titulo={drink ? `Editar ${drink.nome}` : "Novo drink"} largo>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {drink && <input type="hidden" name="id" value={drink.id} />}
        <input type="hidden" name="receita" value={receitaJson} />
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <Campo rotulo="Nome do drink" nome="nome" erro={e.nome}>
            {(p) => <Entrada {...p} defaultValue={drink?.nome ?? ""} maxLength={80} required />}
          </Campo>
          <Campo rotulo="Ordem" nome="ordem" erro={e.ordem}>
            {(p) => <Entrada {...p} type="number" min={0} defaultValue={drink?.ordem ?? proximaOrdem} />}
          </Campo>
        </div>
        <Campo rotulo="Descrição no cardápio" nome="descricao" erro={e.descricao} ajuda="Aparece na proposta. Ex.: Cachaça, frutas selecionadas, açúcar e gelo.">
          {(p) => <AreaTexto {...p} rows={2} maxLength={300} defaultValue={drink?.descricao ?? ""} />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Categoria" nome="categoria" erro={e.categoria}>
            {(p) => (
              <Selecao {...p} defaultValue={drink?.categoria ?? "classico"}>
                {CATEGORIAS_DRINK.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Servido em" nome="copo" erro={e.copo} ajuda="Define a página “Vidraria” da proposta.">
            {(p) => (
              <Selecao {...p} defaultValue={drink?.copo ?? ""}>
                <option value="">— não informar —</option>
                {COPOS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <Campo rotulo="Foto (endereço da imagem, opcional)" nome="foto_url" erro={e.foto_url} ajuda="Cole o endereço https:// de uma foto sua. Sem foto, o cardápio mostra só o texto.">
          {(p) => <Entrada {...p} defaultValue={drink?.foto_url ?? ""} maxLength={500} placeholder="https://..." />}
        </Campo>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="alcoolico" defaultChecked={drink?.alcoolico ?? true} className="size-5 accent-[var(--marca)]" />
            Contém álcool
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="ativo" defaultChecked={drink?.ativo ?? true} className="size-5 accent-[var(--marca)]" />
            Ativo (aparece para escolher)
          </label>
        </div>

        <fieldset className="rounded-xl border border-borda p-3">
          <legend className="px-1 text-sm font-medium">Receita de 1 drink</legend>
          <p className="mb-2 text-xs text-texto-2">Quanto de cada insumo vai em um drink. A calculadora multiplica pela quantidade de drinks da festa.</p>
          {linhas.length === 0 && <p className="mb-2 text-sm text-texto-2">Sem receita. Sem ela, este drink não entra na conta de preço.</p>}
          <ul className="space-y-2">
            {linhas.map((l) => (
              <li key={l.chave} className="grid grid-cols-[1fr_6.5rem_2.75rem] items-center gap-2">
                <Selecao aria-label="Insumo" value={l.insumo_id} onChange={(ev) => mudar(l.chave, "insumo_id", ev.target.value)}>
                  <option value="">— escolha —</option>
                  {insumos
                    .filter((i) => i.ativo || i.id === l.insumo_id)
                    .map((i) => (
                      <option key={i.id} value={i.id} disabled={linhas.some((x) => x.insumo_id === i.id && x.chave !== l.chave)}>
                        {i.nome}
                      </option>
                    ))}
                </Selecao>
                <div className="relative">
                  <Entrada
                    aria-label={`Quantidade${unidade(l.insumo_id) ? ` em ${unidade(l.insumo_id)}` : ""}`}
                    inputMode="decimal"
                    value={l.quantidade}
                    onChange={(ev) => mudar(l.chave, "quantidade", ev.target.value)}
                    className="pr-9"
                  />
                  <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-texto-2">
                    {unidade(l.insumo_id)}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Tirar da receita"
                  className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-perigo"
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <Botao
            variante="fantasma"
            className="mt-2"
            onClick={() => {
              setLinhas((ls) => [...ls, { chave: proxima, insumo_id: "", quantidade: "" }]);
              setProxima((n) => n + 1);
            }}
          >
            <Plus className="size-4" aria-hidden /> Adicionar insumo
          </Botao>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:items-center sm:justify-end">
          {drink && (
            <Botao
              variante="fantasma"
              className="text-perigo sm:mr-auto"
              onClick={async () => {
                if (!(await confirmar({ titulo: `Excluir ${drink.nome}?`, mensagem: "Ele sai dos pacotes. Propostas já feitas não mudam.", perigo: true }))) return;
                iniciar(async () => {
                  const r = await excluirDrink(drink.id);
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
            Salvar drink
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
