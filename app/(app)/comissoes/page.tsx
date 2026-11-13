/**
 * COMISSÕES: extrato do mês (calculado pelo banco ao ganhar cada negócio).
 * Vendedor vê só as suas; o gestor vê todas e marca como pagas.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Percent, Scale } from "lucide-react";
import { Filtros } from "@/components/comercial/filtros";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { inicioMes, mesValido, nomeMes, somarMeses } from "@/lib/comercial";
import { listarVendedores } from "@/lib/dados";
import { formatarMoeda, hojeISO } from "@/lib/formatar";
import { todasAsLinhas } from "@/lib/paginar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Comissao } from "@/lib/tipos";
import { Extrato } from "./extrato";
import { ModuloDesligado } from "@/components/comercial/modulo-desligado";
import { obterConfiguracoes } from "@/lib/configuracoes";

export const metadata: Metadata = { title: "Comissões" };

export default async function PaginaComissoes({ searchParams }: { searchParams: Promise<{ mes?: string; vendedor?: string; status?: string }> }) {
  const [configModulo, perfilModulo] = await Promise.all([obterConfiguracoes(), obterPerfil()]);
  if (!configModulo.mod_comissoes) return <ModuloDesligado nome="Comissões" gestor={Boolean(ehGestor(perfilModulo.perfil))} />;
  const sp = await searchParams;
  const competencia = mesValido(sp.mes) ? `${sp.mes}-01` : inicioMes(hojeISO());
  const [{ perfil }, vendedores] = await Promise.all([obterPerfil(), listarVendedores()]);
  const gestor = ehGestor(perfil);
  const vendedor = gestor && vendedores.some((v) => v.id === sp.vendedor) ? sp.vendedor! : "";
  const status = sp.status === "paga" || sp.status === "pendente" ? sp.status : "";
  const supabase = await createClient();
  const comissoes = await todasAsLinhas<Comissao>((de, ate) => {
    let q = supabase.from("comissoes").select("*").eq("competencia", competencia);
    if (vendedor) q = q.eq("vendedor_id", vendedor);
    if (status) q = q.eq("status", status);
    return q.order("created_at").order("id").range(de, ate);
  });
  const ids = comissoes.map((c) => c.negocio_id);
  const titulos: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("negocios").select("id, titulo").in("id", ids.slice(i, i + 100));
    for (const n of data ?? []) titulos[n.id] = n.titulo;
  }
  const nomeVend = Object.fromEntries(vendedores.map((v) => [v.id, v.nome]));
  const total = comissoes.reduce((s, c) => s + Number(c.valor), 0);
  const pago = comissoes.filter((c) => c.status === "paga").reduce((s, c) => s + Number(c.valor), 0);
  const base = comissoes.reduce((s, c) => s + Number(c.valor_base), 0);
  const mes = competencia.slice(0, 7);
  const linkMes = (n: number) => `/comissoes?${new URLSearchParams({ mes: somarMeses(competencia, n).slice(0, 7), vendedor, status })}`;

  // resumo por vendedor (gestor)
  const porVendedor = new Map<string, { total: number; pendente: number }>();
  for (const c of comissoes) {
    const r = porVendedor.get(c.vendedor_id) ?? { total: 0, pendente: 0 };
    r.total += Number(c.valor);
    if (c.status === "pendente") r.pendente += Number(c.valor);
    porVendedor.set(c.vendedor_id, r);
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Comissões"
        descricao={gestor ? "Calculadas pelo sistema quando o negócio é ganho. Marque como pagas no fechamento do mês." : "Suas comissões do mês."}
        acoes={
          <Link href="/comissoes/regras" className={classesBotao("secundario")}>
            <Scale className="size-4" aria-hidden /> Regras de comissão
          </Link>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={linkMes(-1)} className={classesBotao("secundario")} aria-label="Mês anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <p className="text-lg font-bold capitalize">{nomeMes(competencia)}</p>
        <Link href={linkMes(1)} className={classesBotao("secundario")} aria-label="Próximo mês">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {gestor && (
        <Filtros
          acao="/comissoes"
          limpar
          campos={[
            { tipo: "oculto", nome: "mes", valor: mes },
            { nome: "vendedor", rotulo: "Vendedor", valor: vendedor, todos: "Todos", opcoes: vendedores.map((v) => ({ id: v.id, nome: v.nome })) },
            {
              nome: "status",
              rotulo: "Situação",
              valor: status,
              todos: "Todas",
              opcoes: [
                { id: "pendente", nome: "A pagar" },
                { id: "paga", nome: "Pagas" },
              ],
            },
          ]}
        />
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">Vendas comissionadas</p>
          <p className="num text-lg font-extrabold">{formatarMoeda(base)}</p>
        </Cartao>
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">Comissão total</p>
          <p className="num text-lg font-extrabold">{formatarMoeda(total)}</p>
        </Cartao>
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">Já pago</p>
          <p className="num text-lg font-extrabold text-ok">{formatarMoeda(pago)}</p>
        </Cartao>
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">A pagar</p>
          <p className="num text-lg font-extrabold text-alerta">{formatarMoeda(total - pago)}</p>
        </Cartao>
      </div>
      {gestor && porVendedor.size > 1 && (
        <Cartao className="mb-4">
          <h2 className="mb-2 text-sm font-semibold">Por vendedor</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {[...porVendedor.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .map(([id, r]) => (
                <li key={id} className="flex justify-between gap-2">
                  <span>{nomeVend[id] ?? "—"}</span>
                  <span className="num">
                    {formatarMoeda(r.total)} {r.pendente > 0 && <span className="text-alerta">({formatarMoeda(r.pendente)} a pagar)</span>}
                  </span>
                </li>
              ))}
          </ul>
        </Cartao>
      )}
      {comissoes.length === 0 ? (
        <EstadoVazio icone={Percent} titulo="Nenhuma comissão neste mês" descricao="A comissão aparece aqui assim que um negócio é marcado como ganho." />
      ) : (
        <Extrato key={competencia} comissoes={comissoes} negocios={titulos} vendedores={nomeVend} gestor={gestor} />
      )}
    </>
  );
}
