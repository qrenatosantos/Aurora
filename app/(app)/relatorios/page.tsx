/**
 * PAINEL E RELATÓRIOS: funil de conversão por etapa, taxa de conversão, ciclo médio,
 * ticket médio, ganhos × perdidos, motivos de perda, receita prevista (ponderada pela
 * probabilidade), ranking, atividades realizadas, tempo por etapa e origem dos leads.
 * Filtros de período/funil/vendedor e exportação CSV. Tudo respeita o RLS
 * (o vendedor vê os próprios números; o ranking é agregado).
 */
import type { Metadata } from "next";
import { Download, Trophy } from "lucide-react";
import { Filtros } from "@/components/comercial/filtros";
import { BarrasHorizontais, Colunas, FunilConversao } from "@/components/comercial/graficos";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Cartao } from "@/components/ui/cartao";
import {
  PERIODOS,
  TIPOS_ATIVIDADE,
  diaSP,
  duracaoLegivel,
  lerPeriodo,
  moedaCurta,
  moedaInteira,
  nomeMesCurto,
  pct,
  somarDias,
  somarMeses,
} from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { listarFunis, listarMotivosPerda, listarOrigens, listarVendedores } from "@/lib/dados";
import { formatarData, hojeISO } from "@/lib/formatar";
import { todasAsLinhas } from "@/lib/paginar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { HistoricoEtapa, Negocio } from "@/lib/tipos";

export const metadata: Metadata = { title: "Relatórios" };

type Sp = { periodo?: string; de?: string; ate?: string; funil?: string; vendedor?: string };

function Indicador({ titulo, valor, detalhe, destaque }: { titulo: string; valor: string; detalhe?: string; destaque?: "ok" | "perigo" }) {
  return (
    <Cartao className="p-3 sm:p-4">
      <p className="text-xs font-medium text-texto-2">{titulo}</p>
      <p className={`num mt-0.5 text-xl font-extrabold sm:text-2xl ${destaque === "ok" ? "text-ok" : destaque === "perigo" ? "text-perigo" : "text-texto"}`}>
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-texto-2">{detalhe}</p>}
    </Cartao>
  );
}

export default async function PaginaRelatorios({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const [{ perfil }, config, funis, vendedores, motivos, origens] = await Promise.all([
    obterPerfil(),
    obterConfiguracoes(),
    listarFunis(),
    listarVendedores(),
    listarMotivosPerda(),
    listarOrigens(),
  ]);
  const gestor = ehGestor(perfil);
  const veTime = gestor || config.vendedores_veem_tudo;
  const { periodo, de, ate } = lerPeriodo(sp);
  const funil = funis.some((f) => f.id === sp.funil) ? sp.funil! : "";
  const vendedor = veTime && vendedores.some((v) => v.id === sp.vendedor) ? sp.vendedor! : "";
  const funilSel = funis.find((f) => f.id === funil) ?? funis.find((f) => f.ativo) ?? funis[0];
  const ini = `${de}T00:00:00-03:00`;
  const fim = `${somarDias(ate, 1)}T00:00:00-03:00`;

  const supabase = await createClient();
  const filtrar = <T extends { eq: (c: string, v: string) => T }>(q: T) => {
    let r = q;
    if (funil) r = r.eq("funil_id", funil);
    if (vendedor) r = r.eq("vendedor_id", vendedor);
    return r;
  };
  const [fechados, criados, abertos, atividades, ranking] = await Promise.all([
    todasAsLinhas<Negocio>((a, b) =>
      filtrar(supabase.from("negocios").select("*"))
        .in("status", ["ganho", "perdido"])
        .gte("fechado_em", ini)
        .lt("fechado_em", fim)
        .order("fechado_em")
        .order("id")
        .range(a, b),
    ),
    todasAsLinhas<Negocio>((a, b) =>
      filtrar(supabase.from("negocios").select("*")).gte("created_at", ini).lt("created_at", fim).order("created_at").order("id").range(a, b),
    ),
    todasAsLinhas<Negocio>((a, b) => filtrar(supabase.from("negocios").select("*")).eq("status", "aberto").order("id").range(a, b)),
    todasAsLinhas<{ tipo: string; vendedor_id: string }>((a, b) => {
      let q = supabase.from("atividades").select("tipo, vendedor_id").eq("concluida", true).gte("concluida_em", ini).lt("concluida_em", fim);
      if (vendedor) q = q.eq("vendedor_id", vendedor);
      return q.order("id").range(a, b);
    }),
    supabase.rpc("ranking_vendedores", { p_inicio: de, p_fim: ate }),
  ]);

  // Histórico do funil escolhido (conversão por etapa e tempo médio em cada etapa)
  const historico = funilSel
    ? await todasAsLinhas<HistoricoEtapa>((a, b) =>
        supabase
          .from("historico_etapas")
          .select("*")
          .eq("funil_id", funilSel.id)
          .gte("movido_em", ini)
          .lt("movido_em", fim)
          .order("movido_em")
          .order("id")
          .range(a, b),
      )
    : [];

  const ganhos = fechados.filter((n) => n.status === "ganho");
  const perdidos = fechados.filter((n) => n.status === "perdido");
  const valorGanho = ganhos.reduce((s, n) => s + Number(n.valor), 0);
  const valorPerdido = perdidos.reduce((s, n) => s + Number(n.valor), 0);
  const taxa = fechados.length ? ganhos.length / fechados.length : 0;
  const ticket = ganhos.length ? valorGanho / ganhos.length : 0;
  const cicloDias = ganhos.length
    ? ganhos.reduce((s, n) => s + (Date.parse(n.fechado_em!) - Date.parse(n.created_at)) / 86400000, 0) / ganhos.length
    : 0;

  // Receita prevista: em aberto × probabilidade da etapa
  const etapaPorId = new Map(funis.flatMap((f) => f.etapas).map((e) => [e.id, e]));
  const ponderado = abertos.reduce((s, n) => s + (Number(n.valor) * (etapaPorId.get(n.etapa_id)?.probabilidade ?? 0)) / 100, 0);
  const totalAberto = abertos.reduce((s, n) => s + Number(n.valor), 0);
  const hojeMes = `${hojeISO().slice(0, 7)}-01`;
  const previsaoMeses = [0, 1, 2].map((m) => {
    const mes = somarMeses(hojeMes, m);
    const doMes = abertos.filter((n) => n.previsao_fechamento?.startsWith(mes.slice(0, 7)) || (m === 0 && n.previsao_fechamento && n.previsao_fechamento < mes));
    return {
      rotulo: m === 0 ? `${nomeMesCurto(mes)} (+ vencidos)` : nomeMesCurto(mes),
      valor: doMes.reduce((s, n) => s + (Number(n.valor) * (etapaPorId.get(n.etapa_id)?.probabilidade ?? 0)) / 100, 0),
      qtd: doMes.length,
    };
  });

  // Ganhos por mês do período
  const meses: string[] = [];
  for (let m = `${de.slice(0, 7)}-01`; m <= ate && meses.length < 24; m = somarMeses(m, 1)) meses.push(m);
  const porMes = meses.map((m) => {
    const v = ganhos.filter((n) => diaSP(n.fechado_em!).startsWith(m.slice(0, 7))).reduce((s, n) => s + Number(n.valor), 0);
    return { rotulo: nomeMesCurto(m), valor: v, texto: moedaCurta(v) };
  });

  // Motivos de perda
  const motivosCont = new Map<string, { qtd: number; valor: number }>();
  for (const n of perdidos) {
    const k = n.motivo_perda_id ?? "";
    const r = motivosCont.get(k) ?? { qtd: 0, valor: 0 };
    r.qtd++;
    r.valor += Number(n.valor);
    motivosCont.set(k, r);
  }
  const nomeMotivo = new Map(motivos.map((m) => [m.id, m.nome]));
  const itensMotivos = [...motivosCont.entries()]
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .map(([k, r]) => ({ rotulo: nomeMotivo.get(k) ?? "Sem motivo", valor: r.qtd, texto: `${r.qtd}`, detalhe: `${pct(r.qtd / perdidos.length)} · ${moedaCurta(r.valor)}` }));

  // Funil de conversão (negócios criados no período, no funil escolhido): quantos chegaram a cada etapa
  const criadosFunil = funilSel ? criados.filter((n) => n.funil_id === funilSel.id) : [];
  const idsCriados = new Set(criadosFunil.map((n) => n.id));
  const ordemEtapa = new Map((funilSel?.etapas ?? []).map((e) => [e.id, e.ordem]));
  const maxOrdem = new Map<string, number>();
  for (const n of criadosFunil) maxOrdem.set(n.id, ordemEtapa.get(n.etapa_id) ?? 0);
  for (const h of historico)
    if (idsCriados.has(h.negocio_id) && h.para_etapa_id && ordemEtapa.has(h.para_etapa_id))
      maxOrdem.set(h.negocio_id, Math.max(maxOrdem.get(h.negocio_id) ?? 0, ordemEtapa.get(h.para_etapa_id)!));
  const totalCriados = criadosFunil.length;
  const etapasFunil = (funilSel?.etapas ?? []).map((e) => {
    const qtd = criadosFunil.filter((n) => (maxOrdem.get(n.id) ?? 0) >= e.ordem).length;
    return { nome: e.nome, qtd, taxa: totalCriados ? pct(qtd / totalCriados) : "—", cor: e.cor };
  });
  const ganhosCriados = criadosFunil.filter((n) => n.status === "ganho").length;
  etapasFunil.push({ nome: "Ganho", qtd: ganhosCriados, taxa: totalCriados ? pct(ganhosCriados / totalCriados) : "—", cor: "#059669" });

  // Tempo médio em cada etapa (saídas no período)
  const tempo = new Map<string, { soma: number; n: number }>();
  for (const h of historico)
    if (h.de_etapa_id && h.segundos_na_etapa !== null && h.de_status === "aberto") {
      const r = tempo.get(h.de_etapa_id) ?? { soma: 0, n: 0 };
      r.soma += Number(h.segundos_na_etapa);
      r.n++;
      tempo.set(h.de_etapa_id, r);
    }
  const itensTempo = (funilSel?.etapas ?? []).map((e) => {
    const r = tempo.get(e.id);
    const media = r ? r.soma / r.n : 0;
    return { rotulo: e.nome, valor: media, texto: r ? duracaoLegivel(media) : "—", detalhe: r ? `${r.n} saída(s)` : undefined, cor: e.cor };
  });

  // Origem dos leads que mais convertem (negócios criados no período)
  const porOrigem = new Map<string, { total: number; ganhos: number; valor: number }>();
  for (const n of criados) {
    const k = n.origem_id ?? "";
    const r = porOrigem.get(k) ?? { total: 0, ganhos: 0, valor: 0 };
    r.total++;
    if (n.status === "ganho") {
      r.ganhos++;
      r.valor += Number(n.valor);
    }
    porOrigem.set(k, r);
  }
  const nomeOrigem = new Map(origens.map((o) => [o.id, o.nome]));
  const itensOrigem = [...porOrigem.entries()]
    .map(([k, r]) => ({ k, ...r, taxa: r.total ? r.ganhos / r.total : 0 }))
    .sort((a, b) => b.taxa - a.taxa || b.valor - a.valor)
    .map((r) => ({
      rotulo: nomeOrigem.get(r.k) ?? "Não informada",
      valor: r.taxa,
      texto: pct(r.taxa),
      detalhe: `${r.ganhos} de ${r.total} · ${moedaCurta(r.valor)}`,
    }));

  // Atividades realizadas
  const porTipo = TIPOS_ATIVIDADE.map((t) => ({ rotulo: t.nome, valor: atividades.filter((a) => a.tipo === t.id).length })).map((i) => ({
    ...i,
    texto: String(i.valor),
  }));
  const nomeVend = new Map(vendedores.map((v) => [v.id, v.nome]));
  const porVendAtv = new Map<string, number>();
  for (const a of atividades) porVendAtv.set(a.vendedor_id, (porVendAtv.get(a.vendedor_id) ?? 0) + 1);

  const rk = (ranking.data ?? []).filter((r) => r.ganhos > 0 || r.perdidos > 0 || Number(r.meta_valor) > 0);
  const paramsCsv = { periodo, de, ate, funil, vendedor };
  const csv = (tipo: string) => `/relatorios/exportar?${new URLSearchParams({ tipo, ...paramsCsv })}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Painel e relatórios"
        descricao={`${formatarData(de)} a ${formatarData(ate)}${veTime ? (vendedor ? ` · ${nomeVend.get(vendedor)}` : " · time inteiro") : " · seus números"}`}
        acoes={
          <>
            <a href={csv("negocios")} className={classesBotao("secundario")}>
              <Download className="size-4" aria-hidden /> Negócios (CSV)
            </a>
            <a href={csv("atividades")} className={classesBotao("secundario")}>
              <Download className="size-4" aria-hidden /> Atividades (CSV)
            </a>
          </>
        }
      />
      <Filtros
        acao="/relatorios"
        campos={[
          { nome: "periodo", rotulo: "Período", valor: periodo, opcoes: PERIODOS.map((p) => ({ id: p.id, nome: p.nome })) },
          ...(periodo === "personalizado"
            ? [
                { tipo: "data" as const, nome: "de", rotulo: "De", valor: de },
                { tipo: "data" as const, nome: "ate", rotulo: "Até", valor: ate },
              ]
            : []),
          { nome: "funil", rotulo: "Funil", valor: funil, todos: "Todos", opcoes: funis.map((f) => ({ id: f.id, nome: f.nome })) },
          ...(veTime ? [{ nome: "vendedor", rotulo: "Vendedor", valor: vendedor, todos: "Todos", opcoes: vendedores.map((v) => ({ id: v.id, nome: v.nome })) }] : []),
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Vendido (ganhos)" valor={moedaInteira(valorGanho)} detalhe={`${ganhos.length} negócio(s)`} destaque="ok" />
        <Indicador titulo="Taxa de conversão" valor={pct(taxa)} detalhe={`${ganhos.length} ganhos de ${fechados.length} fechados`} />
        <Indicador titulo="Ticket médio" valor={moedaInteira(ticket)} detalhe="por negócio ganho" />
        <Indicador titulo="Ciclo médio de venda" valor={`${Math.round(cicloDias)} dias`} detalhe="da criação ao ganho" />
        <Indicador titulo="Perdidos" valor={moedaInteira(valorPerdido)} detalhe={`${perdidos.length} negócio(s)`} destaque="perigo" />
        <Indicador titulo="Em aberto (hoje)" valor={moedaInteira(totalAberto)} detalhe={`${abertos.length} negócio(s) no funil`} />
        <Indicador titulo="Receita prevista" valor={moedaInteira(ponderado)} detalhe="em aberto × probabilidade da etapa" />
        <Indicador titulo="Atividades feitas" valor={String(atividades.length)} detalhe="no período" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-1 text-base font-semibold">Funil de conversão — {funilSel?.nome ?? "—"}</h2>
          <p className="mb-3 text-xs text-texto-2">
            {totalCriados} negócio(s) criados no período: quantos chegaram a cada etapa (% sobre os criados).
          </p>
          {totalCriados ? <FunilConversao etapas={etapasFunil} /> : <p className="text-sm text-texto-2">Nenhum negócio criado no período.</p>}
        </Cartao>

        <Cartao>
          <h2 className="mb-3 text-base font-semibold">Vendas ganhas por mês</h2>
          <Colunas itens={porMes} rotuloEixo="Valor ganho por mês" />
          <table className="sr-only">
            <caption>Valor ganho por mês</caption>
            <tbody>
              {porMes.map((m) => (
                <tr key={m.rotulo}>
                  <th>{m.rotulo}</th>
                  <td>{moedaInteira(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 text-base font-semibold">Ganhos × perdidos</h2>
          <BarrasHorizontais
            itens={[
              { rotulo: "Ganhos", valor: ganhos.length, texto: String(ganhos.length), detalhe: moedaCurta(valorGanho), cor: "var(--ok)" },
              { rotulo: "Perdidos", valor: perdidos.length, texto: String(perdidos.length), detalhe: moedaCurta(valorPerdido), cor: "var(--perigo)" },
            ]}
          />
          <h3 className="mt-5 mb-2 text-sm font-semibold">Motivos de perda</h3>
          <BarrasHorizontais itens={itensMotivos} vazio="Nenhuma perda no período." />
        </Cartao>

        <Cartao>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Trophy className="size-5 text-destaque-forte" aria-hidden /> Ranking de vendedores
          </h2>
          <p className="mb-3 text-xs text-texto-2">Valor ganho no período (todos os funis){veTime ? "" : " — você vê o ranking do time"}.</p>
          {rk.length === 0 ? (
            <p className="text-sm text-texto-2">Sem vendas no período.</p>
          ) : (
            <ol className="space-y-2">
              {rk.map((r, i) => {
                const meta = Number(r.meta_valor);
                return (
                  <li key={r.vendedor_id} className="flex items-center gap-3">
                    <span className="num w-6 text-center text-sm font-extrabold text-texto-2">{i + 1}º</span>
                    <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: r.cor }} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${r.vendedor_id === perfil?.id ? "text-marca-forte" : ""}`}>{r.nome}</span>
                      <span className="block text-xs text-texto-2">
                        {r.ganhos} ganho(s) · {r.ganhos + r.perdidos ? pct(r.ganhos / (r.ganhos + r.perdidos)) : "—"} conversão
                        {meta > 0 ? ` · ${pct(Number(r.valor_ganho) / meta)} da meta` : ""}
                      </span>
                    </span>
                    <span className="num text-sm font-bold">{moedaCurta(r.valor_ganho)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-base font-semibold">Receita prevista (ponderada)</h2>
          <p className="mb-3 text-xs text-texto-2">Negócios em aberto pela previsão de fechamento × probabilidade da etapa.</p>
          <BarrasHorizontais
            itens={previsaoMeses.map((m) => ({ rotulo: m.rotulo, valor: m.valor, texto: moedaCurta(m.valor), detalhe: `${m.qtd} negócio(s)` }))}
            vazio="Nenhum negócio em aberto com previsão nos próximos meses."
          />
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-base font-semibold">Tempo médio em cada etapa — {funilSel?.nome ?? "—"}</h2>
          <p className="mb-3 text-xs text-texto-2">Onde os negócios ficam parados (saídas de etapa no período).</p>
          <BarrasHorizontais itens={itensTempo} vazio="Sem movimentações no período." />
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-base font-semibold">Origens que mais convertem</h2>
          <p className="mb-3 text-xs text-texto-2">Negócios criados no período: % que virou venda, por origem do lead.</p>
          <BarrasHorizontais itens={itensOrigem} vazio="Nenhum negócio criado no período." />
        </Cartao>

        <Cartao>
          <h2 className="mb-3 text-base font-semibold">Atividades realizadas</h2>
          <BarrasHorizontais itens={porTipo} vazio="Nenhuma atividade concluída no período." />
          {veTime && porVendAtv.size > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-sm font-semibold">Por vendedor</h3>
              <BarrasHorizontais
                itens={[...porVendAtv.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, n]) => ({ rotulo: nomeVend.get(id) ?? "—", valor: n, texto: String(n) }))}
              />
            </>
          )}
        </Cartao>
      </div>
    </>
  );
}
