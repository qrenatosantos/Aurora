/**
 * NEGÓCIO: etapas, ganho/perda, produtos, atividades (registro rápido e agenda),
 * propostas, histórico de etapas (tempo em cada uma) e comissão.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, FileText, History, Percent, User } from "lucide-react";
import { BotaoMensagem } from "@/components/comercial/botao-mensagem";
import { ListaAtividades } from "@/components/comercial/lista-atividades";
import { Cartao, Selo } from "@/components/ui/cartao";
import { STATUS_NEGOCIO, STATUS_PROPOSTA, duracaoLegivel, moedaInteira, pctNum } from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { agoraServidor, listarModelos, listarMotivosPerda, listarProdutos, opcoesNegocio } from "@/lib/dados";
import { formatarData, formatarDataHora, formatarMoeda, formatarTelefone, hojeISO } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { urlDoSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Atividade, Comissao, HistoricoEtapa, NegocioProduto, Proposta } from "@/lib/tipos";
import { AcoesNegocio, BarraEtapas } from "./acoes-negocio";
import { BotaoNovaProposta } from "./botao-nova-proposta";
import { ProdutosNegocio } from "./produtos-negocio";

export const metadata: Metadata = { title: "Negócio" };

export default async function PaginaNegocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: negocio } = await supabase.from("negocios").select("*").eq("id", id).maybeSingle();
  if (!negocio) notFound();

  const { perfil } = await obterPerfil();
  const gestor = ehGestor(perfil);
  const pode = gestor || negocio.vendedor_id === perfil?.id;

  const [config, opcoes, motivos, produtos, modelos, itensR, atividadesR, historicoR, propostasR, comissaoR, contatoR, empresaR] =
    await Promise.all([
      obterConfiguracoes(),
      opcoesNegocio(perfil),
      listarMotivosPerda(),
      listarProdutos(),
      listarModelos(),
      supabase.from("negocio_produtos").select("*").eq("negocio_id", id).order("ordem"),
      supabase.from("atividades").select("*").eq("negocio_id", id).order("quando", { ascending: false }).limit(200),
      supabase.from("historico_etapas").select("*").eq("negocio_id", id).order("movido_em"),
      supabase.from("propostas").select("*").eq("negocio_id", id).order("created_at", { ascending: false }),
      supabase.from("comissoes").select("*").eq("negocio_id", id).maybeSingle(),
      negocio.contato_id
        ? supabase.from("contatos").select("id, nome, telefone, email, cargo").eq("id", negocio.contato_id).maybeSingle()
        : Promise.resolve({ data: null }),
      negocio.empresa_id
        ? supabase.from("empresas").select("id, nome, cidade, uf").eq("id", negocio.empresa_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const itens = (itensR.data ?? []) as NegocioProduto[];
  const atividades = (atividadesR.data ?? []) as Atividade[];
  const historico = (historicoR.data ?? []) as HistoricoEtapa[];
  const propostas = (propostasR.data ?? []) as Proposta[];
  const comissao = comissaoR.data as Comissao | null;
  const contato = contatoR.data;
  const empresa = empresaR.data;

  const funil = opcoes.funis.find((f) => f.id === negocio.funil_id);
  const etapas = funil?.etapas ?? [];
  const etapa = etapas.find((e) => e.id === negocio.etapa_id);
  const nomeEtapa = new Map(opcoes.funis.flatMap((f) => f.etapas).map((e) => [e.id, e.nome]));
  const vendedor = opcoes.vendedores.find((v) => v.id === negocio.vendedor_id)?.nome ?? "—";
  const origem = opcoes.origens.find((o) => o.id === negocio.origem_id)?.nome;
  const motivo = motivos.find((m) => m.id === negocio.motivo_perda_id)?.nome;
  const agora = agoraServidor();
  const hoje = hojeISO();
  const pendentes = atividades.filter((a) => !a.concluida).sort((a, b) => a.quando.localeCompare(b.quando));
  const feitas = atividades.filter((a) => a.concluida);
  const st = STATUS_NEGOCIO[negocio.status];
  const propostaAtual = propostas.find((p) => p.status === "enviada");
  const origemSite = await urlDoSite();

  // tempo total por etapa (soma de todas as passagens)
  const tempoPorEtapa = new Map<string, number>();
  for (const h of historico)
    if (h.de_etapa_id && h.segundos_na_etapa) tempoPorEtapa.set(h.de_etapa_id, (tempoPorEtapa.get(h.de_etapa_id) ?? 0) + Number(h.segundos_na_etapa));
  const tempoAtual = negocio.status === "aberto" && negocio.etapa_desde ? (agora - Date.parse(negocio.etapa_desde)) / 1000 : null;

  const dadosMensagem = {
    nome: contato?.nome?.split(" ")[0] ?? "",
    empresa: empresa?.nome ?? "",
    vendedor: perfil?.nome ?? vendedor,
    negocio: negocio.titulo,
    valor: formatarMoeda(negocio.valor),
    link_proposta: propostaAtual ? `${origemSite}/proposta/${propostaAtual.codigo}` : "",
    validade: propostaAtual ? formatarData(propostaAtual.validade) : "",
  };

  return (
    <>
      <Link href="/funil" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto nao-imprimir">
        <ArrowLeft className="size-4" aria-hidden /> Funil
      </Link>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Selo cor={st.cor}>{st.nome}</Selo>
            {funil && <span className="text-xs font-semibold text-texto-2">{funil.nome}</span>}
            {negocio.tags.map((t) => (
              <Selo key={t} cor="marca">
                {t}
              </Selo>
            ))}
          </div>
          <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{negocio.titulo}</h1>
          <p className="num mt-1 text-2xl font-extrabold text-marca-forte">{formatarMoeda(negocio.valor)}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-2">
            {empresa && (
              <Link href={`/empresas/${empresa.id}`} className="inline-flex items-center gap-1 hover:text-marca-forte">
                <Building2 className="size-4" aria-hidden /> {empresa.nome}
              </Link>
            )}
            {contato && (
              <Link href={`/contatos/${contato.id}`} className="inline-flex items-center gap-1 hover:text-marca-forte">
                <User className="size-4" aria-hidden /> {contato.nome}
                {contato.cargo ? ` (${contato.cargo})` : ""}
              </Link>
            )}
            <span>Vendedor: {vendedor}</span>
            {negocio.previsao_fechamento && negocio.status === "aberto" && (
              <span className={negocio.previsao_fechamento < hoje ? "font-semibold text-perigo" : undefined}>
                <CalendarDays className="mr-1 inline size-4" aria-hidden />
                Previsão: {formatarData(negocio.previsao_fechamento)}
              </span>
            )}
          </p>
          {negocio.status === "perdido" && (
            <p className="mt-2 rounded-xl bg-perigo-suave px-3 py-2 text-sm text-perigo">
              Perdido em {formatarData(negocio.fechado_em)}: <strong>{motivo ?? "—"}</strong>
              {negocio.motivo_perda_detalhe ? ` — ${negocio.motivo_perda_detalhe}` : ""}
            </p>
          )}
          {negocio.status === "ganho" && (
            <p className="mt-2 rounded-xl bg-ok-suave px-3 py-2 text-sm text-ok">Ganho em {formatarDataHora(negocio.fechado_em)}.</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <BotaoMensagem
            telefone={contato?.telefone}
            modelos={modelos}
            dados={dadosMensagem}
            negocioId={negocio.id}
            contatoId={contato?.id}
            empresaId={empresa?.id}
            modeloInicial={propostaAtual ? "Envio de proposta" : undefined}
          />
          <BotaoMensagem
            canal="email"
            email={contato?.email}
            modelos={modelos}
            dados={dadosMensagem}
            negocioId={negocio.id}
            contatoId={contato?.id}
            empresaId={empresa?.id}
            compacto
          />
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <BarraEtapas key={negocio.etapa_id} negocio={negocio} etapas={etapas} pode={pode} />
        <AcoesNegocio negocio={negocio} opcoes={opcoes} motivos={motivos} temProdutos={itens.length > 0} pode={pode} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Próximas atividades</h2>
            <ListaAtividades
              atividades={pendentes}
              agora={agora}
              hoje={hoje}
              meuId={perfil?.id ?? null}
              gestor={gestor}
              vendedores={opcoes.vendedores}
              vazio={negocio.status === "aberto" ? "Nenhuma atividade agendada. Agende o próximo passo para o negócio não esfriar." : "Nada pendente."}
            />
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Produtos e serviços</h2>
            <ProdutosNegocio
              key={itens.map((i) => i.id).join(",")}
              negocioId={negocio.id}
              itens={itens}
              produtos={produtos}
              pode={pode}
              gestor={gestor}
              descontoAvulso={Number(config.desconto_max_avulso)}
            />
          </Cartao>

          <Cartao>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <FileText className="size-5 text-marca-forte" aria-hidden /> Propostas
              </h2>
              {pode && <BotaoNovaProposta negocioId={negocio.id} variante="secundario" />}
            </div>
            {propostas.length === 0 ? (
              <p className="text-sm text-texto-2">Nenhuma proposta ainda. Ela é montada com os produtos do negócio.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {propostas.map((p) => (
                  <li key={p.id}>
                    <Link href={`/propostas/${p.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:text-marca-forte">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {p.numero} · v{p.versao}
                        </span>
                        <span className="block text-xs text-texto-2">
                          {formatarData(p.created_at)} · válida até {formatarData(p.validade)}
                          {p.visualizada_em ? ` · cliente abriu ${p.visualizacoes}x` : ""}
                        </span>
                      </span>
                      <span className="num font-bold">{moedaInteira(p.total)}</span>
                      <Selo cor={STATUS_PROPOSTA[p.status].cor}>{STATUS_PROPOSTA[p.status].nome}</Selo>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Histórico de interações</h2>
            <ListaAtividades
              atividades={feitas}
              agora={agora}
              hoje={hoje}
              meuId={perfil?.id ?? null}
              gestor={gestor}
              vendedores={opcoes.vendedores}
              mostrarVendedor
              vazio="Nenhuma interação registrada. Use “Registrar interação” depois de cada ligação, visita ou mensagem."
            />
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <History className="size-5 text-marca-forte" aria-hidden /> Tempo em cada etapa
            </h2>
            <ul className="space-y-1.5 text-sm">
              {etapas.map((e) => {
                const t = (tempoPorEtapa.get(e.id) ?? 0) + (e.id === negocio.etapa_id && tempoAtual ? tempoAtual : 0);
                return (
                  <li key={e.id} className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: e.cor }} />
                    <span className={e.id === negocio.etapa_id ? "flex-1 font-semibold" : "flex-1"}>{e.nome}</span>
                    <span className="num text-texto-2">{t ? duracaoLegivel(t) : "—"}</span>
                  </li>
                );
              })}
            </ul>
            <h3 className="mt-4 mb-2 text-sm font-semibold">Movimentações</h3>
            <ol className="space-y-2 border-l-2 border-borda pl-3 text-sm">
              {historico.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">
                    {h.de_status === null
                      ? `Criado em ${nomeEtapa.get(h.para_etapa_id ?? "") ?? "—"}`
                      : h.para_status !== h.de_status
                        ? h.para_status === "aberto"
                          ? "Reaberto"
                          : `${STATUS_NEGOCIO[h.para_status].nome}`
                        : `${nomeEtapa.get(h.de_etapa_id ?? "") ?? "—"} → ${nomeEtapa.get(h.para_etapa_id ?? "") ?? "—"}`}
                  </p>
                  <p className="text-xs text-texto-2">
                    {formatarDataHora(h.movido_em)}
                    {h.segundos_na_etapa ? ` · ficou ${duracaoLegivel(Number(h.segundos_na_etapa))} na etapa anterior` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Cartao>

          {comissao && (
            <Cartao>
              <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
                <Percent className="size-5 text-marca-forte" aria-hidden /> Comissão
              </h2>
              <p className="num text-xl font-extrabold">{formatarMoeda(comissao.valor)}</p>
              <p className="text-sm text-texto-2">
                {pctNum(comissao.percentual_medio)} de {formatarMoeda(comissao.valor_base)} ·{" "}
                {comissao.status === "paga" ? `paga em ${formatarData(comissao.paga_em)}` : "a pagar"}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-texto-2">
                {comissao.detalhes.map((d, i) => (
                  <li key={i}>
                    {d.descricao}: {pctNum(d.percentual)} ({d.regra}) = {formatarMoeda(d.comissao)}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          <Cartao>
            <h2 className="mb-2 text-base font-semibold">Dados</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-texto-2">Etapa</dt>
              <dd>{etapa ? `${etapa.nome} (${etapa.probabilidade}%)` : "—"}</dd>
              <dt className="text-texto-2">Origem</dt>
              <dd>{origem ?? "—"}</dd>
              <dt className="text-texto-2">Criado</dt>
              <dd>{formatarData(negocio.created_at)}</dd>
              {contato?.telefone && (
                <>
                  <dt className="text-texto-2">Telefone</dt>
                  <dd>
                    <a href={`tel:${contato.telefone}`} className="text-marca-forte underline">
                      {formatarTelefone(contato.telefone)}
                    </a>
                  </dd>
                </>
              )}
              {contato?.email && (
                <>
                  <dt className="text-texto-2">E-mail</dt>
                  <dd className="truncate">{contato.email}</dd>
                </>
              )}
            </dl>
            {negocio.observacoes && <p className="mt-3 text-sm whitespace-pre-line">{negocio.observacoes}</p>}
          </Cartao>
        </div>
      </div>
    </>
  );
}
