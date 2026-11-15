"use client";

/**
 * EDITOR DA PROPOSTA DA AURORA: capa, dados do evento, cardápio, investimento
 * (com a calculadora de insumos), condições, termos e agradecimento.
 * Salva tudo de uma vez (ação salvarProposta → função salvar_proposta do banco).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Calculator, Plus, Save, Trash2 } from "lucide-react";
import { calcularParaProposta, salvarProposta } from "@/app/(app)/propostas/actions";
import { MemoriaCalculo } from "@/components/aurora/memoria-calculo";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { EntradaMoeda, valorCampo } from "@/components/ui/controles";
import { useToast } from "@/components/ui/toast";
import { LINHAS, TIPOS_EVENTO, entradaESaldo } from "@/lib/aurora";
import { formatarMoeda, lerMoeda } from "@/lib/formatar";
import type { Drink, DrinkCardapio, Proposta, PropostaItem, ResultadoCalculo } from "@/lib/tipos";

type ItemEditor = { chave: number; descricao: string; detalhes: string; quantidade: string; preco: string };
const txt = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
const numOuNulo = (v: string) => {
  const s = v.trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function Rotulo({ para, children, ajuda }: { para: string; children: React.ReactNode; ajuda?: string }) {
  return (
    <label htmlFor={para} className="mb-1.5 block text-sm font-medium text-texto">
      {children}
      {ajuda && <span className="mt-0.5 block text-xs font-normal text-texto-2">{ajuda}</span>}
    </label>
  );
}

export function EditorProposta({ proposta, itens, drinks, gestor }: { proposta: Proposta; itens: PropostaItem[]; drinks: Drink[]; gestor: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [salvando, iniciarSalvar] = useTransition();
  const [calculando, iniciarCalculo] = useTransition();
  const [mudou, setMudou] = useState(false);
  const ev = proposta.evento ?? {};

  const [c, setC] = useState({
    titulo: proposta.titulo,
    validade: proposta.validade,
    capa_titulo: proposta.capa_titulo ?? "",
    capa_subtitulo: proposta.capa_subtitulo ?? "",
    capa_foto_url: proposta.capa_foto_url ?? "",
    apresentacao: proposta.apresentacao ?? "",
    descricao_servico: proposta.descricao_servico ?? "",
    mensagem_final: proposta.mensagem_final ?? "",
    foto_final_url: proposta.foto_final_url ?? "",
    condicoes_pagamento: proposta.condicoes_pagamento ?? "",
    observacoes: proposta.observacoes ?? "",
    nota_interna: proposta.nota_interna ?? "",
    pacote_nome: proposta.pacote_nome ?? "",
    linha: proposta.linha ?? "tradicional",
    entrada_pct: txt(proposta.entrada_pct),
    entrada_dias_antes: txt(proposta.entrada_dias_antes),
    saldo_dias_antes: txt(proposta.saldo_dias_antes),
    cancelamento_aviso_dias: txt(proposta.cancelamento_aviso_dias),
    cancelamento_multa_pct: txt(proposta.cancelamento_multa_pct),
    taxa_quebra: proposta.taxa_quebra === null ? "" : valorCampo(proposta.taxa_quebra),
    foro: proposta.foro ?? "",
    ev_tipo: ev.tipo ?? "",
    ev_nome: ev.nome ?? "",
    ev_data: ev.data ?? "",
    ev_mes: ev.mes_previsto?.slice(0, 7) ?? "",
    ev_hora: ev.hora_inicio ?? "",
    ev_duracao: txt(ev.duracao_horas),
    ev_cidade: ev.cidade ?? "",
    ev_uf: ev.uf ?? "",
    ev_local: ev.local ?? "",
    ev_convidados: txt(ev.convidados),
    ev_faixa: ev.convidados_faixa ?? "",
  });
  const [cardapio, setCardapio] = useState<DrinkCardapio[]>(proposta.cardapio ?? []);
  const [linhas, setLinhas] = useState<ItemEditor[]>(
    itens.map((i, k) => ({ chave: k, descricao: i.descricao, detalhes: i.detalhes ?? "", quantidade: txt(Number(i.quantidade)), preco: valorCampo(i.preco_unitario) })),
  );
  const [proxima, setProxima] = useState(itens.length);
  const [calculo, setCalculo] = useState<ResultadoCalculo | null>(null);
  const [calculoUsado, setCalculoUsado] = useState<ResultadoCalculo | null | undefined>(undefined);
  const [drinkNovo, setDrinkNovo] = useState("");

  const campo = (nome: keyof typeof c) => ({
    id: `p-${nome}`,
    value: c[nome],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setC((a) => ({ ...a, [nome]: e.target.value }));
      setMudou(true);
    },
  });
  const total = linhas.reduce((s, l) => s + (numOuNulo(l.quantidade) ?? 0) * lerMoeda(l.preco), 0);
  const pagamento = entradaESaldo(total, numOuNulo(c.entrada_pct));
  const mudarCardapio = (fn: (lista: DrinkCardapio[]) => DrinkCardapio[]) => {
    setCardapio(fn);
    setMudou(true);
  };
  const mudarLinha = (chave: number, campoLinha: keyof ItemEditor, valor: string) => {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campoLinha]: valor } : l)));
    setMudou(true);
  };
  const disponiveis = drinks.filter((d) => d.ativo && !cardapio.some((x) => x.drink_id === d.id));

  function calcular() {
    iniciarCalculo(async () => {
      const r = await calcularParaProposta({
        drinks: cardapio.map((d) => d.drink_id).filter((x): x is string => Boolean(x)),
        convidados: numOuNulo(c.ev_convidados),
        duracao_horas: numOuNulo(c.ev_duracao),
        linha: c.linha === "premium" ? "premium" : "tradicional",
        cidade: c.ev_cidade,
        pacote_nome: c.pacote_nome,
      });
      if (r.ok && r.calculo) setCalculo(r.calculo);
      else toast.erro(r.mensagem ?? "Não foi possível calcular.");
    });
  }

  function usarPreco() {
    if (!calculo?.ok || !calculo.preco_sugerido) return;
    const preco = valorCampo(calculo.preco_sugerido);
    setLinhas((ls) => (ls.length ? ls.map((l, i) => (i === 0 ? { ...l, quantidade: "1", preco } : l)) : [{ chave: 0, descricao: "Serviço de bar e coquetelaria", detalhes: "", quantidade: "1", preco }]));
    setCalculoUsado(calculo);
    setMudou(true);
    toast.info("Preço sugerido aplicado ao primeiro item. Salve para gravar.");
  }

  function salvar() {
    iniciarSalvar(async () => {
      const r = await salvarProposta(proposta.id, {
        titulo: c.titulo,
        validade: c.validade,
        capa_titulo: c.capa_titulo,
        capa_subtitulo: c.capa_subtitulo,
        capa_foto_url: c.capa_foto_url,
        apresentacao: c.apresentacao,
        descricao_servico: c.descricao_servico,
        mensagem_final: c.mensagem_final,
        foto_final_url: c.foto_final_url,
        condicoes_pagamento: c.condicoes_pagamento,
        observacoes: c.observacoes,
        nota_interna: c.nota_interna,
        pacote_nome: c.pacote_nome,
        linha: c.linha === "premium" ? "premium" : "tradicional",
        entrada_pct: numOuNulo(c.entrada_pct),
        entrada_dias_antes: numOuNulo(c.entrada_dias_antes),
        saldo_dias_antes: numOuNulo(c.saldo_dias_antes),
        cancelamento_aviso_dias: numOuNulo(c.cancelamento_aviso_dias),
        cancelamento_multa_pct: numOuNulo(c.cancelamento_multa_pct),
        taxa_quebra: c.taxa_quebra.trim() === "" ? null : lerMoeda(c.taxa_quebra),
        foro: c.foro,
        evento: {
          tipo: c.ev_tipo || null,
          nome: c.ev_nome,
          data: c.ev_data || null,
          mes_previsto: !c.ev_data && c.ev_mes ? `${c.ev_mes}-01` : null,
          hora_inicio: c.ev_hora ? c.ev_hora.slice(0, 5) : null,
          duracao_horas: numOuNulo(c.ev_duracao),
          cidade: c.ev_cidade,
          uf: c.ev_uf,
          local: c.ev_local,
          convidados: numOuNulo(c.ev_convidados),
          convidados_faixa: c.ev_faixa,
        },
        cardapio: cardapio.map((d) => ({ ...d, descricao: d.descricao ?? "", foto_url: d.foto_url ?? "" })),
        itens: linhas.map((l) => ({ descricao: l.descricao, detalhes: l.detalhes, quantidade: numOuNulo(l.quantidade) ?? 0, preco_unitario: lerMoeda(l.preco) })),
        ...(calculoUsado === undefined ? {} : { calculo: calculoUsado }),
      });
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Proposta salva.");
        setMudou(false);
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível salvar.");
    });
  }

  return (
    <div className="space-y-4 nao-imprimir">
      {/* Capa */}
      <Cartao className="space-y-3">
        <h2 className="text-base font-semibold">Capa e identificação</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Rotulo para="p-capa_titulo" ajuda="A frase grande da capa. Ex.: Um brinde ao primeiro ano do José Miguel.">
              Título da capa
            </Rotulo>
            <Entrada {...campo("capa_titulo")} maxLength={160} />
          </div>
          <div className="sm:col-span-2">
            <Rotulo para="p-capa_subtitulo">Frase de apoio</Rotulo>
            <Entrada {...campo("capa_subtitulo")} maxLength={240} />
          </div>
          <div>
            <Rotulo para="p-titulo" ajuda="Só para a equipe (lista de propostas).">
              Nome interno da proposta
            </Rotulo>
            <Entrada {...campo("titulo")} maxLength={120} />
          </div>
          <div>
            <Rotulo para="p-validade" ajuda="A data fica reservada até este dia.">
              Válida até
            </Rotulo>
            <Entrada {...campo("validade")} type="date" />
          </div>
          <div className="sm:col-span-2">
            <Rotulo para="p-capa_foto_url" ajuda="Opcional. Cole o endereço https:// de uma foto. Vazio = foto padrão da Aurora.">
              Foto da capa
            </Rotulo>
            <Entrada {...campo("capa_foto_url")} maxLength={500} placeholder="https://..." />
          </div>
          <div className="sm:col-span-2">
            <Rotulo para="p-apresentacao" ajuda="Opcional. Ex.: Para o primeiro aniversário do José Miguel, um serviço de bar caprichado e tranquilo para a família.">
              Frase da página “Partes da proposta”
            </Rotulo>
            <AreaTexto {...campo("apresentacao")} rows={2} maxLength={400} />
          </div>
        </div>
      </Cartao>

      {/* Evento */}
      <Cartao className="space-y-3">
        <h2 className="text-base font-semibold">Dados do evento nesta proposta</h2>
        <p className="text-sm text-texto-2">Cópia dos dados do negócio no momento em que a proposta foi criada. Alterar aqui muda só o documento.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Rotulo para="p-ev_tipo">Tipo</Rotulo>
            <Selecao {...campo("ev_tipo")}>
              <option value="">— a definir —</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <div className="sm:col-span-2">
            <Rotulo para="p-ev_nome">Nome do evento</Rotulo>
            <Entrada {...campo("ev_nome")} maxLength={120} placeholder="Ex.: 1 ano do José Miguel" />
          </div>
          <div>
            <Rotulo para="p-ev_data">Data</Rotulo>
            <Entrada {...campo("ev_data")} type="date" />
          </div>
          <div>
            <Rotulo para="p-ev_hora">Início</Rotulo>
            <Entrada {...campo("ev_hora")} type="time" />
          </div>
          <div>
            <Rotulo para="p-ev_duracao">Duração (horas)</Rotulo>
            <Entrada {...campo("ev_duracao")} inputMode="decimal" />
          </div>
          {!c.ev_data && (
            <div>
              <Rotulo para="p-ev_mes">Mês previsto (sem data)</Rotulo>
              <Entrada {...campo("ev_mes")} type="month" />
            </div>
          )}
          <div>
            <Rotulo para="p-ev_local">Local</Rotulo>
            <Entrada {...campo("ev_local")} maxLength={160} />
          </div>
          <div className="grid grid-cols-[1fr_4.5rem] gap-2">
            <div>
              <Rotulo para="p-ev_cidade">Cidade</Rotulo>
              <Entrada {...campo("ev_cidade")} maxLength={80} />
            </div>
            <div>
              <Rotulo para="p-ev_uf">UF</Rotulo>
              <Entrada {...campo("ev_uf")} maxLength={2} className="uppercase" />
            </div>
          </div>
          <div>
            <Rotulo para="p-ev_convidados">Convidados</Rotulo>
            <Entrada {...campo("ev_convidados")} inputMode="numeric" />
          </div>
          {!c.ev_convidados && (
            <div>
              <Rotulo para="p-ev_faixa">Ou estimativa</Rotulo>
              <Entrada {...campo("ev_faixa")} maxLength={40} placeholder="Ex.: 51 a 100" />
            </div>
          )}
        </div>
      </Cartao>

      {/* Cardápio */}
      <Cartao className="space-y-3">
        <h2 className="text-base font-semibold">Cardápio ({cardapio.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Rotulo para="p-pacote_nome" ajuda="Aparece no cardápio. Deixe vazio para cardápio personalizado.">
              Pacote
            </Rotulo>
            <Entrada {...campo("pacote_nome")} maxLength={80} />
          </div>
          <div>
            <Rotulo para="p-linha">Linha de bebidas</Rotulo>
            <Selecao {...campo("linha")}>
              {LINHAS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Selecao>
          </div>
        </div>
        {cardapio.length === 0 && <p className="text-sm text-texto-2">Nenhum drink. Adicione do catálogo abaixo.</p>}
        <ul className="space-y-2">
          {cardapio.map((d, i) => (
            <li key={`${d.drink_id ?? "livre"}-${i}`} className="grid gap-2 rounded-xl border border-borda p-2 sm:grid-cols-[14rem_1fr_auto] sm:items-start">
              <Entrada
                aria-label={`Nome do drink ${i + 1}`}
                value={d.nome}
                maxLength={80}
                onChange={(e) => mudarCardapio((l) => l.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))}
              />
              <Entrada
                aria-label={`Descrição do drink ${i + 1}`}
                value={d.descricao ?? ""}
                maxLength={300}
                placeholder="Descrição no cardápio"
                onChange={(e) => mudarCardapio((l) => l.map((x, k) => (k === i ? { ...x, descricao: e.target.value } : x)))}
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  aria-label={`Subir ${d.nome}`}
                  disabled={i === 0}
                  className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 disabled:opacity-30"
                  onClick={() => mudarCardapio((l) => l.map((x, k) => (k === i - 1 ? l[i] : k === i ? l[i - 1] : x)))}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Descer ${d.nome}`}
                  disabled={i === cardapio.length - 1}
                  className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 disabled:opacity-30"
                  onClick={() => mudarCardapio((l) => l.map((x, k) => (k === i + 1 ? l[i] : k === i ? l[i + 1] : x)))}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Tirar ${d.nome} do cardápio`}
                  className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-perigo"
                  onClick={() => mudarCardapio((l) => l.filter((_, k) => k !== i))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Rotulo para="p-drink-novo">Adicionar drink do catálogo</Rotulo>
            <Selecao id="p-drink-novo" value={drinkNovo} onChange={(e) => setDrinkNovo(e.target.value)}>
              <option value="">— escolha —</option>
              {disponiveis.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                  {d.alcoolico ? "" : " (sem álcool)"}
                </option>
              ))}
            </Selecao>
          </div>
          <Botao
            variante="secundario"
            disabled={!drinkNovo}
            onClick={() => {
              const d = drinks.find((x) => x.id === drinkNovo);
              if (!d) return;
              mudarCardapio((l) => [...l, { drink_id: d.id, nome: d.nome, descricao: d.descricao, foto_url: d.foto_url, alcoolico: d.alcoolico, copo: d.copo, categoria: d.categoria }]);
              setDrinkNovo("");
            }}
          >
            <Plus className="size-4" aria-hidden /> Adicionar
          </Botao>
        </div>
      </Cartao>

      {/* Investimento */}
      <Cartao className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Investimento</h2>
          <p className="num text-xl font-extrabold text-marca-forte">{formatarMoeda(total)}</p>
        </div>
        {proposta.preco_pendente && total <= 0 && (
          <p className="rounded-xl bg-alerta-suave p-3 text-sm text-alerta">
            <strong>Preço a definir.</strong> Esta proposta foi montada sem valor{proposta.origem === "agente" ? " (o agente não informa preço sem regras aprovadas)" : ""}. Use a
            calculadora abaixo ou digite o valor.
          </p>
        )}
        <div>
          <Rotulo para="p-descricao_servico" ajuda="Texto ao lado do valor. Ex.: 4 horas de atendimento com as 4 opções do cardápio, preparo na hora e gestão dos insumos.">
            Descrição do serviço
          </Rotulo>
          <AreaTexto {...campo("descricao_servico")} rows={2} maxLength={400} />
        </div>
        <ul className="space-y-2">
          {linhas.map((l, i) => (
            <li key={l.chave} className="grid gap-2 rounded-xl border border-borda p-2 sm:grid-cols-[1fr_5rem_10rem_auto] sm:items-start">
              <div className="space-y-2">
                <Entrada aria-label={`Descrição do item ${i + 1}`} value={l.descricao} maxLength={200} onChange={(e) => mudarLinha(l.chave, "descricao", e.target.value)} />
                <Entrada aria-label={`Detalhes do item ${i + 1}`} value={l.detalhes} maxLength={300} placeholder="Detalhes (opcional)" onChange={(e) => mudarLinha(l.chave, "detalhes", e.target.value)} />
              </div>
              <Entrada aria-label={`Quantidade do item ${i + 1}`} inputMode="decimal" value={l.quantidade} onChange={(e) => mudarLinha(l.chave, "quantidade", e.target.value)} />
              <EntradaMoeda aria-label={`Valor do item ${i + 1}`} value={l.preco} onChange={(e) => mudarLinha(l.chave, "preco", e.target.value)} placeholder="0,00" />
              <button
                type="button"
                aria-label={`Remover item ${i + 1}`}
                disabled={linhas.length === 1}
                className="grid size-11 place-items-center justify-self-end rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-perigo disabled:opacity-30"
                onClick={() => {
                  setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                  setMudou(true);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="fantasma"
            onClick={() => {
              setLinhas((ls) => [...ls, { chave: proxima, descricao: "", detalhes: "", quantidade: "1", preco: "" }]);
              setProxima((n) => n + 1);
              setMudou(true);
            }}
          >
            <Plus className="size-4" aria-hidden /> Adicionar item (ex.: drink premium, hora extra)
          </Botao>
          <Botao variante="secundario" carregando={calculando} onClick={calcular}>
            <Calculator className="size-4" aria-hidden /> Calcular pela calculadora
          </Botao>
        </div>
        {(calculo ?? proposta.calculo) && (
          <details open={Boolean(calculo)} className="rounded-xl border border-borda p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Memória de cálculo {calculo ? "(conta de agora)" : "(da última vez que foi salva)"} — só a equipe vê
            </summary>
            <div className="mt-3">
              <MemoriaCalculo calculo={(calculo ?? proposta.calculo)!} />
              {calculo?.ok && (
                <Botao className="mt-3" onClick={usarPreco}>
                  Usar o preço sugerido ({formatarMoeda(calculo.preco_sugerido)})
                </Botao>
              )}
            </div>
          </details>
        )}

        <h3 className="pt-2 text-sm font-semibold">Pagamento</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Rotulo para="p-entrada_pct">Entrada (%)</Rotulo>
            <Entrada {...campo("entrada_pct")} inputMode="decimal" />
          </div>
          <div>
            <Rotulo para="p-entrada_dias_antes">Entrada até (dias antes)</Rotulo>
            <Entrada {...campo("entrada_dias_antes")} inputMode="numeric" />
          </div>
          <div>
            <Rotulo para="p-saldo_dias_antes">Saldo até (dias antes)</Rotulo>
            <Entrada {...campo("saldo_dias_antes")} inputMode="numeric" />
          </div>
        </div>
        <p className="text-sm text-texto-2">
          {pagamento
            ? `Entrada de ${formatarMoeda(pagamento.entrada)} e saldo de ${formatarMoeda(pagamento.saldo)}.`
            : "Sem percentual de entrada, a proposta mostra só o valor total. O padrão vem de Configurações ▸ Propostas e agenda."}
        </p>
        <div>
          <Rotulo para="p-condicoes_pagamento">Observação sobre pagamento (opcional)</Rotulo>
          <AreaTexto {...campo("condicoes_pagamento")} rows={2} maxLength={1000} />
        </div>
      </Cartao>

      {/* Termos e fecho */}
      <Cartao className="space-y-3">
        <h2 className="text-base font-semibold">Termos e agradecimento</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Rotulo para="p-cancelamento_aviso_dias">Cancelamento: aviso (dias)</Rotulo>
            <Entrada {...campo("cancelamento_aviso_dias")} inputMode="numeric" />
          </div>
          <div>
            <Rotulo para="p-cancelamento_multa_pct">Multa (%)</Rotulo>
            <Entrada {...campo("cancelamento_multa_pct")} inputMode="decimal" />
          </div>
          <div>
            <Rotulo para="p-taxa_quebra">Taxa de quebra</Rotulo>
            <EntradaMoeda {...campo("taxa_quebra")} placeholder="0,00" />
          </div>
          <div>
            <Rotulo para="p-foro">Foro</Rotulo>
            <Entrada {...campo("foro")} maxLength={120} />
          </div>
        </div>
        <div>
          <Rotulo para="p-observacoes" ajuda="Opcional. Aparece no rodapé dos termos.">
            Observações para o cliente
          </Rotulo>
          <AreaTexto {...campo("observacoes")} rows={2} maxLength={2000} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Rotulo para="p-mensagem_final" ajuda="Vazio = mensagem padrão.">
              Mensagem da página final
            </Rotulo>
            <AreaTexto {...campo("mensagem_final")} rows={3} maxLength={400} />
          </div>
          <div>
            <Rotulo para="p-foto_final_url" ajuda="Opcional (ex.: foto enviada pelo cliente, com autorização dele).">
              Foto da página final
            </Rotulo>
            <Entrada {...campo("foto_final_url")} maxLength={500} placeholder="https://..." />
          </div>
        </div>
        <div>
          <Rotulo para="p-nota_interna" ajuda="Não aparece para o cliente. Recado de quem montou para quem aprova.">
            Nota interna
          </Rotulo>
          <AreaTexto {...campo("nota_interna")} rows={2} maxLength={1000} />
        </div>
      </Cartao>

      <div className="sticky bottom-20 z-10 flex items-center justify-end gap-3 rounded-2xl border border-borda bg-superficie/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <p className="mr-auto text-sm text-texto-2" role="status">
          {mudou ? "Há alterações não salvas." : gestor ? "Tudo salvo." : "Tudo salvo. Envie para aprovação quando estiver pronta."}
        </p>
        <Botao carregando={salvando} disabled={!mudou} onClick={salvar}>
          <Save className="size-4" aria-hidden /> Salvar proposta
        </Botao>
      </div>
    </div>
  );
}
