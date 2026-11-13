/**
 * Gráficos simples em HTML/CSS (sem biblioteca), legíveis no claro e no escuro.
 * Uma cor por série (a da marca), rótulos e valores em cor de texto, cantos de 4px
 * na ponta da barra, dica (title) ao passar o mouse e os números sempre visíveis.
 */
import { cn } from "@/lib/utils";

export type ItemBarra = { rotulo: string; valor: number; texto: string; detalhe?: string; cor?: string };

/** Barras horizontais (ranking, motivos, etapas). */
export function BarrasHorizontais({ itens, vazio = "Sem dados no período." }: { itens: ItemBarra[]; vazio?: string }) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  if (!itens.length || max <= 0) return <p className="text-sm text-texto-2">{vazio}</p>;
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.rotulo} title={`${i.rotulo}: ${i.texto}${i.detalhe ? ` · ${i.detalhe}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-texto">{i.rotulo}</span>
            <span className="num shrink-0 font-semibold text-texto">
              {i.texto}
              {i.detalhe && <span className="ml-1 font-normal text-texto-2">· {i.detalhe}</span>}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-r bg-superficie-2">
            <div
              className={cn("h-full rounded-r-[4px]", !i.cor && "bg-marca")}
              style={{ width: `${Math.max(1.5, (i.valor / max) * 100)}%`, background: i.cor }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Colunas verticais (valor por mês). */
export function Colunas({ itens, rotuloEixo }: { itens: ItemBarra[]; rotuloEixo: string }) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  return (
    <div role="img" aria-label={rotuloEixo}>
      <div className="flex h-44 items-end gap-1.5 border-b border-borda sm:gap-3">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${i.rotulo}: ${i.texto}`}>
            <span className="num mb-1 truncate text-center text-[10px] font-semibold text-texto-2 sm:text-xs">{i.valor > 0 ? i.texto : ""}</span>
            <div
              className="w-full rounded-t-[4px] bg-marca transition-opacity hover:opacity-80"
              style={{ height: `${max > 0 ? Math.max(i.valor > 0 ? 2 : 0, (i.valor / max) * 100) : 0}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 sm:gap-3">
        {itens.map((i) => (
          <span key={i.rotulo} className="min-w-0 flex-1 truncate text-center text-xs text-texto-2 capitalize">
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Funil de conversão: largura proporcional a quantos chegaram em cada etapa. */
export function FunilConversao({ etapas }: { etapas: { nome: string; qtd: number; taxa: string; cor: string }[] }) {
  const max = Math.max(1, ...etapas.map((e) => e.qtd));
  return (
    <ol className="space-y-1.5">
      {etapas.map((e) => (
        <li key={e.nome} className="flex items-center gap-3" title={`${e.nome}: ${e.qtd} negócio(s) · ${e.taxa}`}>
          <span className="w-28 shrink-0 truncate text-sm text-texto sm:w-40">{e.nome}</span>
          <div className="flex min-w-0 flex-1 justify-center">
            <div
              className="flex h-8 items-center justify-center rounded-[4px] text-xs font-bold text-white"
              style={{ width: `${Math.max(8, (e.qtd / max) * 100)}%`, background: e.cor }}
            >
              <span className="num px-1 [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">{e.qtd}</span>
            </div>
          </div>
          <span className="num w-14 shrink-0 text-right text-xs font-semibold text-texto-2">{e.taxa}</span>
        </li>
      ))}
    </ol>
  );
}
