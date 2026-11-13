"use client";

/** Gestor define as metas do mês (valor e nº de vendas) por vendedor e por equipe. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { EntradaMoeda, valorCampo } from "@/components/ui/controles";
import { Entrada } from "@/components/ui/campo";
import { useToast } from "@/components/ui/toast";
import { lerMoeda } from "@/lib/formatar";
import { copiarMesAnterior, salvarMetas } from "./actions";

type Linha = { chave: string; nome: string; vendedor_id: string | null; equipe_id: string | null; valor: string; qtd: string };

export function FormMetas({
  competencia,
  alvos,
}: {
  competencia: string;
  alvos: { vendedor_id: string | null; equipe_id: string | null; nome: string; meta_valor: number; meta_qtd: number }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    alvos.map((a) => ({
      chave: a.vendedor_id ?? a.equipe_id ?? a.nome,
      nome: a.nome,
      vendedor_id: a.vendedor_id,
      equipe_id: a.equipe_id,
      valor: a.meta_valor ? valorCampo(a.meta_valor) : "",
      qtd: a.meta_qtd ? String(a.meta_qtd) : "",
    })),
  );
  const alterar = (chave: string, campo: "valor" | "qtd", v: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  function executar(acao: () => Promise<{ ok: boolean; mensagem?: string }>) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Salvo.");
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  }

  const grupos = [
    { titulo: "Por vendedor", itens: linhas.filter((l) => l.vendedor_id) },
    { titulo: "Por equipe", itens: linhas.filter((l) => l.equipe_id) },
  ].filter((g) => g.itens.length);

  return (
    <Cartao className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Definir metas do mês</h2>
        <Botao variante="secundario" carregando={pendente} onClick={() => executar(() => copiarMesAnterior(competencia))}>
          <Copy className="size-4" aria-hidden /> Copiar do mês anterior
        </Botao>
      </div>
      {grupos.map((g) => (
        <fieldset key={g.titulo} className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-texto-2">{g.titulo}</legend>
          {g.itens.map((l) => (
            <div key={l.chave} className="grid grid-cols-[1fr_8.5rem_5rem] items-center gap-2 sm:grid-cols-[1fr_11rem_7rem]">
              <span className="truncate text-sm font-medium">{l.nome}</span>
              <label>
                <span className="sr-only">Meta em reais de {l.nome}</span>
                <EntradaMoeda value={l.valor} onChange={(e) => alterar(l.chave, "valor", e.target.value)} placeholder="0,00" />
              </label>
              <label>
                <span className="sr-only">Meta de vendas de {l.nome}</span>
                <Entrada inputMode="numeric" value={l.qtd} onChange={(e) => alterar(l.chave, "qtd", e.target.value.replace(/\D/g, ""))} placeholder="nº" />
              </label>
            </div>
          ))}
        </fieldset>
      ))}
      <p className="text-xs text-texto-2">Valor em R$ e nº de vendas ganhas no mês. Deixe em branco para não ter meta.</p>
      <div className="flex justify-end">
        <Botao
          carregando={pendente}
          onClick={() =>
            executar(() =>
              salvarMetas({
                competencia,
                linhas: linhas.map((l) => ({
                  vendedor_id: l.vendedor_id,
                  equipe_id: l.equipe_id,
                  meta_valor: Math.round(lerMoeda(l.valor) * 100) / 100,
                  meta_qtd: Number(l.qtd) || 0,
                })),
              }),
            )
          }
        >
          <Save className="size-4" aria-hidden /> Salvar metas
        </Botao>
      </div>
    </Cartao>
  );
}
