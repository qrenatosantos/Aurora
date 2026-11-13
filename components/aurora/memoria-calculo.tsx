/**
 * MEMÓRIA DE CÁLCULO da calculadora de insumos: lista de compras, custos e preço sugerido.
 * Uso interno (catálogo e editor da proposta). Nunca vai para o cliente nem para o agente.
 */
import { nomeCategoriaInsumo } from "@/lib/aurora";
import { formatarMoeda } from "@/lib/formatar";
import type { ResultadoCalculo } from "@/lib/tipos";

const n = (v: number | string, casas = 1) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(Number(v) || 0);

export function MemoriaCalculo({ calculo }: { calculo: ResultadoCalculo }) {
  if (!calculo.ok) {
    return (
      <div className="rounded-xl bg-alerta-suave p-3 text-sm text-alerta" role="status">
        <p className="font-semibold">A conta ainda não fecha. Falta:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {calculo.pendencias.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    );
  }
  const c = calculo.custos!;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-marca-suave p-3">
          <p className="text-xs font-bold tracking-wider text-texto-2 uppercase">Preço sugerido</p>
          <p className="num text-2xl font-extrabold text-marca-forte">{formatarMoeda(calculo.preco_sugerido)}</p>
          <p className="text-xs text-texto-2">
            custo {formatarMoeda(c.total)} + margem de {n(c.margem_pct)}%
          </p>
        </div>
        <div className="rounded-xl bg-superficie-2 p-3">
          <p className="text-xs font-bold tracking-wider text-texto-2 uppercase">Drinks estimados</p>
          <p className="num text-2xl font-extrabold">{n(calculo.total_drinks ?? 0, 0)}</p>
          <p className="text-xs text-texto-2">
            {calculo.entrada?.convidados} convidados · {n(calculo.entrada?.duracao_horas ?? 0)} h
          </p>
        </div>
        <div className="rounded-xl bg-superficie-2 p-3">
          <p className="text-xs font-bold tracking-wider text-texto-2 uppercase">Equipe</p>
          <p className="num text-2xl font-extrabold">
            {calculo.bartenders} {calculo.bartenders === 1 ? "bartender" : "bartenders"}
          </p>
          <p className="text-xs text-texto-2">linha {calculo.entrada?.linha === "premium" ? "premium" : "tradicional"}</p>
        </div>
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-bold tracking-wider text-texto-2 uppercase">Custos</h4>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>Insumos (proporcional ao consumo)</dt>
          <dd className="num text-right">{formatarMoeda(c.insumos)}</dd>
          <dt>Mão de obra</dt>
          <dd className="num text-right">{formatarMoeda(c.mao_de_obra)}</dd>
          <dt>Custo fixo por evento</dt>
          <dd className="num text-right">{formatarMoeda(c.fixo)}</dd>
          {Number(c.outra_cidade) > 0 && (
            <>
              <dt>Evento em outra cidade</dt>
              <dd className="num text-right">{formatarMoeda(c.outra_cidade)}</dd>
            </>
          )}
          <dt className="border-t border-borda pt-1 font-semibold">Custo total</dt>
          <dd className="num border-t border-borda pt-1 text-right font-semibold">{formatarMoeda(c.total)}</dd>
        </dl>
        <p className="mt-1 text-xs text-texto-2">Comprando embalagens inteiras, os insumos saem por {formatarMoeda(c.compra_embalagens_inteiras)}.</p>
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-bold tracking-wider text-texto-2 uppercase">Lista de compras</h4>
        <div className="overflow-x-auto rounded-xl border border-borda">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs text-texto-2">
                <th scope="col" className="px-3 py-2 font-semibold">Insumo</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Necessário</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Comprar</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {(calculo.insumos ?? []).map((i) => (
                <tr key={i.id}>
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {i.nome}
                    <span className="block text-xs font-normal text-texto-2">
                      {nomeCategoriaInsumo(i.categoria)}
                      {i.linha === "premium" ? " · premium" : ""}
                      {i.marca ? ` · ${i.marca}` : ""}
                    </span>
                  </th>
                  <td className="num px-3 py-1.5 text-right whitespace-nowrap">
                    {n(i.quantidade)} {i.unidade}
                  </td>
                  <td className="num px-3 py-1.5 text-right whitespace-nowrap">
                    {n(i.embalagens, 0)} × {n(i.embalagem, 3)} {i.unidade}
                  </td>
                  <td className="num px-3 py-1.5 text-right whitespace-nowrap">{formatarMoeda(i.custo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-texto-2">
          Cardápio considerado: {(calculo.drinks ?? []).map((d) => `${d.nome} (${n(d.quantidade, 0)})`).join(", ")}.
        </p>
      </div>
    </div>
  );
}
