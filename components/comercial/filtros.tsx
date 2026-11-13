"use client";

/**
 * Barra de filtros por URL (?funil=...&vendedor=...). Muda a página sozinha ao escolher
 * uma opção (navegação no cliente, sem recarregar). Os filtros ficam no link: dá para
 * salvar nos favoritos ou mandar para alguém.
 *
 *   <Filtros acao="/relatorios" campos={[{ nome: "funil", rotulo: "Funil", valor, opcoes }]} />
 */
import Form from "next/form";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campo";

export type CampoFiltro =
  | { tipo?: "select"; nome: string; rotulo: string; valor: string; opcoes: { id: string; nome: string }[]; todos?: string }
  | { tipo: "data"; nome: string; rotulo: string; valor: string }
  | { tipo: "texto"; nome: string; rotulo: string; valor: string; placeholder?: string }
  | { tipo: "oculto"; nome: string; valor: string };

export function Filtros({ acao, campos, limpar }: { acao: string; campos: CampoFiltro[]; limpar?: boolean }) {
  const visiveis = campos.filter((c) => c.tipo !== "oculto");
  return (
    <Form
      action={acao}
      onChange={(e) => {
        const alvo = e.target as HTMLElement;
        if (alvo.tagName === "SELECT" || (alvo as HTMLInputElement).type === "date") e.currentTarget.requestSubmit();
      }}
      className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end nao-imprimir"
    >
      {campos.map((c) =>
        c.tipo === "oculto" ? (
          <input key={c.nome} type="hidden" name={c.nome} value={c.valor} />
        ) : (
          <label key={c.nome} className="min-w-0 text-sm sm:w-44">
            <span className="mb-1 block text-xs font-semibold text-texto-2">{c.rotulo}</span>
            {c.tipo === "data" ? (
              <Entrada type="date" name={c.nome} defaultValue={c.valor} />
            ) : c.tipo === "texto" ? (
              <Entrada type="search" name={c.nome} defaultValue={c.valor} placeholder={c.placeholder} />
            ) : (
              <Selecao name={c.nome} defaultValue={c.valor}>
                {c.todos !== undefined && <option value="">{c.todos}</option>}
                {c.opcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </label>
        ),
      )}
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <button type="submit" className={classesBotao("secundario", "flex-1 sm:flex-none")}>
          <SlidersHorizontal className="size-4" aria-hidden /> Filtrar
        </button>
        {limpar && visiveis.some((c) => c.valor) && (
          <Link href={acao} className={classesBotao("fantasma")}>
            Limpar
          </Link>
        )}
      </div>
    </Form>
  );
}
