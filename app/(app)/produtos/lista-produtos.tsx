"use client";

/** Catálogo de produtos/serviços com busca; o gestor cadastra, edita e exclui. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { EntradaMoeda, Fab, valorCampo } from "@/components/ui/controles";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fmtQtd } from "@/lib/comercial";
import { formatarMoeda } from "@/lib/formatar";
import type { Produto } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { excluirProduto, salvarProduto } from "./actions";

export function ListaProdutos({ produtos, gestor }: { produtos: Produto[]; gestor: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Produto | "novo" | null>(null);
  const termo = busca.trim().toLowerCase();
  const visiveis = produtos.filter((p) => !termo || `${p.nome} ${p.codigo ?? ""} ${p.descricao ?? ""}`.toLowerCase().includes(termo));

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="busca-produto" className="sr-only">
            Buscar produto
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-2" aria-hidden />
          <Entrada id="busca-produto" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou código" className="pl-10" />
        </div>
        {gestor && (
          <Botao onClick={() => setEditando("novo")}>
            <Plus className="size-4" aria-hidden /> Novo produto ou serviço
          </Botao>
        )}
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={Package}
          titulo={produtos.length ? "Nada encontrado" : "Catálogo vazio"}
          descricao={gestor ? "Cadastre o que você vende, com preço e desconto máximo permitido." : "O gestor ainda não cadastrou produtos."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((p) => (
            <li key={p.id} className="flex flex-col rounded-2xl border border-borda bg-superficie p-4 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Selo cor={p.tipo === "servico" ? "info" : "marca"}>{p.tipo === "servico" ? "Serviço" : "Produto"}</Selo>
                {!p.ativo && <Selo>Inativo</Selo>}
                {p.codigo && <span className="text-xs text-texto-2">{p.codigo}</span>}
              </div>
              <p className="font-semibold">{p.nome}</p>
              {p.descricao && <p className="mt-1 line-clamp-2 text-sm text-texto-2">{p.descricao}</p>}
              <p className="mt-auto pt-3">
                <span className="num text-lg font-extrabold">{formatarMoeda(p.preco)}</span>
                <span className="text-sm text-texto-2"> / {p.unidade}</span>
              </p>
              <p className="text-xs text-texto-2">Desconto máximo sem aprovação: {fmtQtd(p.desconto_max)}%</p>
              {gestor && (
                <div className="mt-3 flex gap-2 border-t border-borda pt-3">
                  <Botao variante="secundario" className="flex-1" onClick={() => setEditando(p)}>
                    <Pencil className="size-4" aria-hidden /> Editar
                  </Botao>
                  <Botao
                    variante="fantasma"
                    className="text-perigo"
                    aria-label={`Excluir ${p.nome}`}
                    onClick={async () => {
                      if (
                        await confirmar({
                          titulo: `Excluir ${p.nome}?`,
                          mensagem: "Prefira desmarcar “Ativo” se ele já foi vendido. Regras de comissão deste produto também são apagadas.",
                          perigo: true,
                        })
                      )
                        iniciar(async () => {
                          const r = await excluirProduto(p.id);
                          if (r.ok) {
                            toast.sucesso(r.mensagem ?? "Excluído.");
                            router.refresh();
                          } else toast.erro(r.mensagem ?? "Não foi possível excluir.");
                        });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {gestor && (
        <Fab onClick={() => setEditando("novo")} className="md:hidden" aria-label="Novo produto">
          <Plus className="size-6" aria-hidden />
        </Fab>
      )}
      {editando && <DialogoProduto produto={editando === "novo" ? null : editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function DialogoProduto({ produto, aoFechar }: { produto: Produto | null; aoFechar: () => void }) {
  const router = useRouter();
  const { onSubmit, erros: e, pendente } = useAcao(salvarProduto, {
    aoSucesso: () => {
      aoFechar();
      router.refresh();
    },
  });
  return (
    <Modal aberto aoFechar={aoFechar} titulo={produto ? "Editar produto" : "Novo produto ou serviço"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {produto && <input type="hidden" name="id" value={produto.id} />}
        <Campo rotulo="Nome" nome="nome" erro={e.nome}>
          {(p) => <Entrada {...p} defaultValue={produto?.nome ?? ""} maxLength={120} required autoFocus />}
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Tipo" nome="tipo" erro={e.tipo}>
            {(p) => (
              <Selecao {...p} defaultValue={produto?.tipo ?? "produto"}>
                <option value="produto">Produto</option>
                <option value="servico">Serviço</option>
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Código (opcional)" nome="codigo" erro={e.codigo}>
            {(p) => <Entrada {...p} defaultValue={produto?.codigo ?? ""} maxLength={30} />}
          </Campo>
          <Campo rotulo="Preço" nome="preco" erro={e.preco}>
            {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(produto?.preco ?? 0)} />}
          </Campo>
          <Campo rotulo="Unidade" nome="unidade" erro={e.unidade} ajuda="un, hora, mês, m²...">
            {(p) => <Entrada {...p} defaultValue={produto?.unidade ?? "un"} maxLength={20} />}
          </Campo>
        </div>
        <Campo
          rotulo="Desconto máximo (%)"
          nome="desconto_max"
          erro={e.desconto_max}
          ajuda="Acima disso, a proposta só é enviada com aprovação do gestor."
        >
          {(p) => <Entrada {...p} inputMode="decimal" defaultValue={String(produto?.desconto_max ?? 10).replace(".", ",")} className="max-w-32" />}
        </Campo>
        <Campo rotulo="Descrição (aparece na proposta)" nome="descricao" erro={e.descricao}>
          {(p) => <AreaTexto {...p} rows={3} maxLength={1000} defaultValue={produto?.descricao ?? ""} />}
        </Campo>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="ativo" defaultChecked={produto?.ativo ?? true} className="size-5 accent-[var(--marca)]" /> Ativo (aparece para
          vender)
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
