"use client";

/**
 * Produtos/serviços do negócio. O valor do negócio vira a soma dos itens (no banco).
 * Desconto acima do máximo do produto: só o gestor (o banco também barra).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save, Trash2 } from "lucide-react";
import { salvarProdutosNegocio } from "@/app/(app)/negocios/actions";
import { Botao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campo";
import { useToast } from "@/components/ui/toast";
import { fmtQtd, moedaInteira, pctNum, totalItem } from "@/lib/comercial";
import { formatarMoeda, lerMoeda } from "@/lib/formatar";
import type { NegocioProduto, Produto } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Linha = { chave: string; produto_id: string | null; descricao: string; quantidade: string; preco: string; desconto: string };

const num = (t: string) => lerMoeda(t);
const paraTexto = (n: number) => String(n).replace(".", ",");

export function ProdutosNegocio({
  negocioId,
  itens,
  produtos,
  pode,
  gestor,
  descontoAvulso,
}: {
  negocioId: string;
  itens: NegocioProduto[];
  produtos: Produto[];
  pode: boolean;
  gestor: boolean;
  descontoAvulso: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    itens.map((i) => ({
      chave: i.id,
      produto_id: i.produto_id,
      descricao: i.descricao,
      quantidade: paraTexto(Number(i.quantidade)),
      preco: paraTexto(Number(i.preco_unitario)),
      desconto: paraTexto(Number(i.desconto_pct)),
    })),
  );
  const [mudou, setMudou] = useState(false);
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const limite = (l: Linha) => (l.produto_id ? Number(porId.get(l.produto_id)?.desconto_max ?? 0) : descontoAvulso);

  function alterar(chave: string, campo: keyof Linha, valor: string) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
    setMudou(true);
  }

  function adicionar(produtoId: string) {
    const p = porId.get(produtoId);
    setLinhas((ls) => [
      ...ls,
      {
        chave: `novo-${ls.length}-${produtoId || "avulso"}`,
        produto_id: p?.id ?? null,
        descricao: p?.nome ?? "",
        quantidade: "1",
        preco: paraTexto(Number(p?.preco ?? 0)),
        desconto: "0",
      },
    ]);
    setMudou(true);
  }

  const total = linhas.reduce((s, l) => s + totalItem(num(l.quantidade), num(l.preco), num(l.desconto)), 0);
  const acima = linhas.filter((l) => num(l.desconto) > limite(l));

  function salvar() {
    if (!gestor && acima.length) {
      toast.erro(`Desconto acima do máximo em "${acima[0].descricao}" (máx. ${pctNum(limite(acima[0]))}). Só o gestor pode.`);
      return;
    }
    iniciar(async () => {
      const r = await salvarProdutosNegocio(
        negocioId,
        linhas.map((l) => ({
          produto_id: l.produto_id,
          descricao: l.descricao.trim(),
          quantidade: num(l.quantidade),
          preco_unitario: num(l.preco),
          desconto_pct: num(l.desconto),
        })),
      );
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Salvo.");
        setMudou(false);
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível salvar.");
    });
  }

  return (
    <div className="space-y-3">
      {linhas.length === 0 && (
        <p className="rounded-xl border border-dashed border-borda p-4 text-center text-sm text-texto-2">
          Nenhum produto. Adicione itens do catálogo para o valor do negócio ser calculado sozinho.
        </p>
      )}
      <ul className="space-y-2">
        {linhas.map((l) => {
          const lim = limite(l);
          const passou = num(l.desconto) > lim;
          return (
            <li key={l.chave} className="rounded-xl border border-borda p-3">
              <div className="flex items-start gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  <span className="sr-only">Descrição</span>
                  <Entrada value={l.descricao} disabled={!pode} onChange={(e) => alterar(l.chave, "descricao", e.target.value)} maxLength={200} />
                </label>
                {pode && (
                  <button
                    type="button"
                    aria-label={`Remover ${l.descricao}`}
                    onClick={() => {
                      setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                      setMudou(true);
                    }}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-texto-2 hover:bg-perigo-suave hover:text-perigo"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-texto-2">
                  Qtd. {l.produto_id ? `(${porId.get(l.produto_id)?.unidade ?? "un"})` : ""}
                  <Entrada inputMode="decimal" value={l.quantidade} disabled={!pode} onChange={(e) => alterar(l.chave, "quantidade", e.target.value)} />
                </label>
                <label className="text-xs text-texto-2">
                  Preço (R$)
                  <Entrada inputMode="decimal" value={l.preco} disabled={!pode} onChange={(e) => alterar(l.chave, "preco", e.target.value)} />
                </label>
                <label className="text-xs text-texto-2">
                  Desc. % (máx. {fmtQtd(lim)})
                  <Entrada
                    inputMode="decimal"
                    value={l.desconto}
                    disabled={!pode}
                    aria-invalid={passou || undefined}
                    onChange={(e) => alterar(l.chave, "desconto", e.target.value)}
                  />
                </label>
              </div>
              <p className={cn("mt-1.5 text-right text-sm font-bold num", passou && "text-perigo")}>
                {passou && <span className="mr-2 text-xs font-semibold">{gestor ? "acima do máximo (gestor)" : "acima do máximo!"}</span>}
                {formatarMoeda(totalItem(num(l.quantidade), num(l.preco), num(l.desconto)))}
              </p>
            </li>
          );
        })}
      </ul>
      {pode && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Adicionar produto do catálogo</span>
            <Selecao
              value=""
              onChange={(e) => {
                if (e.target.value) adicionar(e.target.value === "avulso" ? "" : e.target.value);
              }}
            >
              <option value="">+ Adicionar produto ou serviço…</option>
              {produtos
                .filter((p) => p.ativo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {moedaInteira(p.preco)}/{p.unidade}
                  </option>
                ))}
              <option value="avulso">Item avulso (fora do catálogo)</option>
            </Selecao>
          </label>
          <Botao onClick={salvar} carregando={pendente} disabled={!mudou}>
            <Save className="size-4" aria-hidden /> Salvar produtos
          </Botao>
        </div>
      )}
      <p className="flex items-center justify-between border-t border-borda pt-2 text-base">
        <span className="text-texto-2">Total dos produtos</span>
        <strong className="num">{formatarMoeda(total)}</strong>
      </p>
    </div>
  );
}
