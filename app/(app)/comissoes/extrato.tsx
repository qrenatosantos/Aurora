"use client";

/** Extrato de comissões do mês. O gestor seleciona e marca como pagas (ou desfaz). */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCheck, RefreshCw, Undo2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import { pctNum } from "@/lib/comercial";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import type { Comissao } from "@/lib/tipos";
import { marcarPagas, recalcularPendentes } from "./actions";

export function Extrato({
  comissoes,
  negocios,
  vendedores,
  gestor,
}: {
  comissoes: Comissao[];
  negocios: Record<string, string>;
  vendedores: Record<string, string>;
  gestor: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const selecionadas = comissoes.filter((c) => sel.has(c.id));
  const totalSel = selecionadas.reduce((s, c) => s + Number(c.valor), 0);

  function executar(acao: () => Promise<{ ok: boolean; mensagem?: string }>) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        setSel(new Set());
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  }

  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3">
      {gestor && (
        <div className="flex flex-wrap items-center gap-2 nao-imprimir">
          <Botao
            disabled={!selecionadas.some((c) => c.status === "pendente")}
            carregando={pendente}
            onClick={async () => {
              const ids = selecionadas.filter((c) => c.status === "pendente").map((c) => c.id);
              if (await confirmar({ titulo: `Marcar ${ids.length} como paga(s)?`, mensagem: `Total: ${formatarMoeda(totalSel)}. Depois de paga, a comissão não muda mais sozinha.`, textoConfirmar: "Marcar como paga" }))
                executar(() => marcarPagas(ids, true));
            }}
          >
            <CheckCheck className="size-4" aria-hidden /> Marcar como paga
          </Botao>
          <Botao
            variante="secundario"
            disabled={!selecionadas.some((c) => c.status === "paga")}
            onClick={() => executar(() => marcarPagas(selecionadas.filter((c) => c.status === "paga").map((c) => c.id), false))}
          >
            <Undo2 className="size-4" aria-hidden /> Desfazer pagamento
          </Botao>
          <Botao variante="fantasma" onClick={() => executar(() => recalcularPendentes())}>
            <RefreshCw className="size-4" aria-hidden /> Recalcular a pagar
          </Botao>
          {selecionadas.length > 0 && (
            <span className="text-sm text-texto-2">
              {selecionadas.length} selecionada(s) · {formatarMoeda(totalSel)}
            </span>
          )}
        </div>
      )}
      <div className="relative overflow-x-auto rounded-2xl border border-borda bg-superficie">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-superficie-2 text-left text-xs text-texto-2">
            <tr>
              {gestor && (
                <th className="w-12 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas"
                    className="size-5 accent-[var(--marca)]"
                    checked={sel.size > 0 && sel.size === comissoes.length}
                    onChange={(e) => setSel(e.target.checked ? new Set(comissoes.map((c) => c.id)) : new Set())}
                  />
                </th>
              )}
              <th className="px-3 py-2 font-semibold">Negócio</th>
              <th className="px-3 py-2 font-semibold">Vendedor</th>
              <th className="px-3 py-2 text-right font-semibold">Base</th>
              <th className="px-3 py-2 text-right font-semibold">%</th>
              <th className="px-3 py-2 text-right font-semibold">Comissão</th>
              <th className="px-3 py-2 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {comissoes.map((c) => (
              <tr key={c.id} className="align-top">
                {gestor && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar comissão de ${negocios[c.negocio_id] ?? "negócio"}`}
                      className="size-5 accent-[var(--marca)]"
                      checked={sel.has(c.id)}
                      onChange={() => alternar(c.id)}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <Link href={`/negocios/${c.negocio_id}`} className="font-medium hover:text-marca-forte">
                    {negocios[c.negocio_id] ?? "Negócio"}
                  </Link>
                  <details className="text-xs text-texto-2">
                    <summary className="cursor-pointer">Como foi calculada</summary>
                    <ul className="mt-1 space-y-0.5">
                      {c.detalhes.map((d, i) => (
                        <li key={i}>
                          {d.descricao}: {formatarMoeda(d.base)} × {pctNum(d.percentual)} ({d.regra}) = {formatarMoeda(d.comissao)}
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
                <td className="px-3 py-2.5">{vendedores[c.vendedor_id] ?? "—"}</td>
                <td className="num px-3 py-2.5 text-right">{formatarMoeda(c.valor_base)}</td>
                <td className="num px-3 py-2.5 text-right">{pctNum(c.percentual_medio)}</td>
                <td className="num px-3 py-2.5 text-right font-bold">{formatarMoeda(c.valor)}</td>
                <td className="px-3 py-2.5">
                  {c.status === "paga" ? <Selo cor="ok">Paga {formatarData(c.paga_em)}</Selo> : <Selo cor="alerta">A pagar</Selo>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
