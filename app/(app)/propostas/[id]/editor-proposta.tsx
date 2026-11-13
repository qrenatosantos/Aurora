"use client";

/**
 * Editor da proposta (rascunho): itens com desconto, condições, prazo e validade.
 * Desconto acima do máximo do produto é permitido aqui, mas a proposta só pode ser
 * ENVIADA depois que o gestor aprovar (regra do banco).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Save, Trash2 } from "lucide-react";
import { salvarProposta } from "@/app/(app)/propostas/actions";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { useToast } from "@/components/ui/toast";
import { fmtQtd, moedaInteira, totaisItens, totalItem } from "@/lib/comercial";
import { formatarMoeda, lerMoeda } from "@/lib/formatar";
import type { Produto, Proposta, PropostaItem } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Linha = {
  chave: string;
  produto_id: string | null;
  descricao: string;
  detalhes: string;
  unidade: string;
  quantidade: string;
  preco: string;
  desconto: string;
};

const num = (t: string) => lerMoeda(t);
const txt = (n: number | string) => String(Number(n)).replace(".", ",");

export function EditorProposta({
  proposta,
  itens,
  produtos,
  descontoAvulso,
}: {
  proposta: Proposta;
  itens: PropostaItem[];
  produtos: Produto[];
  descontoAvulso: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const [cab, setCab] = useState({
    titulo: proposta.titulo,
    validade: proposta.validade,
    condicoes_pagamento: proposta.condicoes_pagamento ?? "",
    prazo_entrega: proposta.prazo_entrega ?? "",
    observacoes: proposta.observacoes ?? "",
  });
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    itens.map((i) => ({
      chave: i.id,
      produto_id: i.produto_id,
      descricao: i.descricao,
      detalhes: i.detalhes ?? "",
      unidade: i.unidade,
      quantidade: txt(i.quantidade),
      preco: txt(i.preco_unitario),
      desconto: txt(i.desconto_pct),
    })),
  );
  const [mudou, setMudou] = useState(false);

  const limite = (l: Linha) => (l.produto_id ? Number(porId.get(l.produto_id)?.desconto_max ?? 0) : descontoAvulso);
  const alterar = (chave: string, campo: keyof Linha, valor: string) => {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
    setMudou(true);
  };
  const mudarCab = (campo: keyof typeof cab, valor: string) => {
    setCab((c) => ({ ...c, [campo]: valor }));
    setMudou(true);
  };

  function adicionar(produtoId: string) {
    const p = porId.get(produtoId);
    setLinhas((ls) => [
      ...ls,
      {
        chave: `novo-${Date.now()}`,
        produto_id: p?.id ?? null,
        descricao: p?.nome ?? "",
        detalhes: p?.descricao ?? "",
        unidade: p?.unidade ?? "un",
        quantidade: "1",
        preco: txt(p?.preco ?? 0),
        desconto: "0",
      },
    ]);
    setMudou(true);
  }

  const numericos = linhas.map((l) => ({ quantidade: num(l.quantidade), preco_unitario: num(l.preco), desconto_pct: num(l.desconto) }));
  const t = totaisItens(numericos);
  const acima = linhas.filter((l) => num(l.desconto) > limite(l));

  function salvar() {
    iniciar(async () => {
      const r = await salvarProposta(proposta.id, {
        ...cab,
        itens: linhas.map((l) => ({
          produto_id: l.produto_id,
          descricao: l.descricao.trim(),
          detalhes: l.detalhes.trim(),
          unidade: l.unidade.trim() || "un",
          quantidade: num(l.quantidade),
          preco_unitario: num(l.preco),
          desconto_pct: num(l.desconto),
        })),
      });
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Salvo.");
        setMudou(false);
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível salvar.");
    });
  }

  return (
    <Cartao className="space-y-4 nao-imprimir">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Montar a proposta</h2>
        <Botao onClick={salvar} carregando={pendente} disabled={!mudou}>
          <Save className="size-4" aria-hidden /> {mudou ? "Salvar alterações" : "Salvo"}
        </Botao>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="text-sm font-medium">
          Título
          <Entrada value={cab.titulo} onChange={(e) => mudarCab("titulo", e.target.value)} maxLength={120} />
        </label>
        <label className="text-sm font-medium">
          Válida até
          <Entrada type="date" value={cab.validade} onChange={(e) => mudarCab("validade", e.target.value)} />
        </label>
      </div>

      <ul className="space-y-2">
        {linhas.map((l, i) => {
          const lim = limite(l);
          const passou = num(l.desconto) > lim;
          return (
            <li key={l.chave} className={cn("rounded-xl border p-3", passou ? "border-alerta-forte bg-alerta-suave/40" : "border-borda")}>
              <div className="flex items-start gap-2">
                <span className="mt-3 w-5 shrink-0 text-xs font-bold text-texto-2">{i + 1}.</span>
                <div className="grid min-w-0 flex-1 gap-2">
                  <label>
                    <span className="sr-only">Descrição do item {i + 1}</span>
                    <Entrada value={l.descricao} onChange={(e) => alterar(l.chave, "descricao", e.target.value)} maxLength={200} placeholder="Descrição" />
                  </label>
                  <label>
                    <span className="sr-only">Detalhes do item {i + 1}</span>
                    <AreaTexto
                      rows={2}
                      className="min-h-0 text-sm"
                      value={l.detalhes}
                      onChange={(e) => alterar(l.chave, "detalhes", e.target.value)}
                      maxLength={1000}
                      placeholder="Detalhes (opcional): especificação, garantia..."
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-xs text-texto-2">
                      Qtd.
                      <Entrada inputMode="decimal" value={l.quantidade} onChange={(e) => alterar(l.chave, "quantidade", e.target.value)} />
                    </label>
                    <label className="text-xs text-texto-2">
                      Unidade
                      <Entrada value={l.unidade} maxLength={20} onChange={(e) => alterar(l.chave, "unidade", e.target.value)} />
                    </label>
                    <label className="text-xs text-texto-2">
                      Preço unit. (R$)
                      <Entrada inputMode="decimal" value={l.preco} onChange={(e) => alterar(l.chave, "preco", e.target.value)} />
                    </label>
                    <label className="text-xs text-texto-2">
                      Desconto % (máx. {fmtQtd(lim)})
                      <Entrada
                        inputMode="decimal"
                        value={l.desconto}
                        aria-invalid={passou || undefined}
                        onChange={(e) => alterar(l.chave, "desconto", e.target.value)}
                      />
                    </label>
                  </div>
                  <p className="flex items-center justify-between gap-2 text-sm">
                    {passou ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-alerta">
                        <AlertTriangle className="size-3.5" aria-hidden /> Acima do máximo: precisa de aprovação do gestor
                      </span>
                    ) : (
                      <span />
                    )}
                    <strong className="num">{formatarMoeda(totalItem(num(l.quantidade), num(l.preco), num(l.desconto)))}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remover item ${i + 1}`}
                  onClick={() => {
                    setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                    setMudou(true);
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-texto-2 hover:bg-perigo-suave hover:text-perigo"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <label className="block">
        <span className="sr-only">Adicionar item</span>
        <Selecao value="" onChange={(e) => e.target.value && adicionar(e.target.value === "avulso" ? "" : e.target.value)}>
          <option value="">+ Adicionar produto ou serviço…</option>
          {produtos
            .filter((p) => p.ativo)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} — {moedaInteira(p.preco)}/{p.unidade} (desc. máx. {fmtQtd(p.desconto_max)}%)
              </option>
            ))}
          <option value="avulso">Item avulso (fora do catálogo)</option>
        </Selecao>
      </label>

      <div className="ml-auto grid max-w-xs gap-1 text-sm">
        <p className="flex justify-between">
          <span className="text-texto-2">Subtotal</span> <span className="num">{formatarMoeda(t.subtotal)}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-texto-2">Descontos</span> <span className="num">−{formatarMoeda(t.desconto)}</span>
        </p>
        <p className="flex justify-between text-lg font-extrabold">
          <span>Total</span> <span className="num">{formatarMoeda(t.total)}</span>
        </p>
      </div>
      {acima.length > 0 && (
        <p className="rounded-xl bg-alerta-suave p-3 text-sm text-alerta">
          {acima.length} item(ns) com desconto acima do permitido. Depois de salvar, use “Pedir aprovação ao gestor”.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Condições de pagamento
          <AreaTexto rows={3} maxLength={1000} value={cab.condicoes_pagamento} onChange={(e) => mudarCab("condicoes_pagamento", e.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Prazo de entrega
          <AreaTexto rows={3} maxLength={300} value={cab.prazo_entrega} onChange={(e) => mudarCab("prazo_entrega", e.target.value)} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Observações (aparecem para o cliente)
        <AreaTexto rows={3} maxLength={2000} value={cab.observacoes} onChange={(e) => mudarCab("observacoes", e.target.value)} />
      </label>
      <div className="flex justify-end">
        <Botao onClick={salvar} carregando={pendente} disabled={!mudou} className="w-full sm:w-auto">
          <Save className="size-4" aria-hidden /> Salvar proposta
        </Botao>
      </div>
    </Cartao>
  );
}
