"use client";

/** Condições comerciais padrão, textos da proposta, agenda de eventos e atendimento dos leads novos. */
import { Info } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { CAMPOS_TEXTO, textoProposta } from "@/lib/proposta-textos";
import type { Configuracoes } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { salvarConfigAurora } from "../actions";

const num = (v: number | null) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export function FormAurora({ config }: { config: Configuracoes }) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarConfigAurora);
  const semCondicoes = config.entrada_pct === null && config.entrada_dias_antes === null && config.saldo_dias_antes === null;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Cartao className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-texto">Condições comerciais padrão</h2>
          <p className="mt-1 text-sm text-texto-2">
            Entram em toda proposta nova e podem ser ajustadas em cada uma. Campo vazio = a proposta sai sem essa condição, e o agente também não a
            informa ao cliente.
          </p>
        </div>
        {semCondicoes && (
          <p className="flex items-start gap-2 rounded-xl bg-destaque-suave p-3 text-sm text-destaque-forte">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Ainda não há condições definidas. Os exemplos em cinza vêm de uma proposta antiga da Aurora e servem só de referência: preencha com o
              que vale hoje.
            </span>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Entrada (%)" nome="entrada_pct" erro={e.entrada_pct} ajuda="O saldo é o restante.">
            {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(config.entrada_pct)} placeholder="ex.: 60" />}
          </Campo>
          <Campo rotulo="Entrada até (dias antes do evento)" nome="entrada_dias_antes" erro={e.entrada_dias_antes}>
            {(p) => <Entrada {...p} inputMode="numeric" defaultValue={num(config.entrada_dias_antes)} placeholder="ex.: 14" />}
          </Campo>
          <Campo rotulo="Saldo até (dias antes do evento)" nome="saldo_dias_antes" erro={e.saldo_dias_antes}>
            {(p) => <Entrada {...p} inputMode="numeric" defaultValue={num(config.saldo_dias_antes)} placeholder="ex.: 1" />}
          </Campo>
          <Campo rotulo="Cancelamento: aviso mínimo (dias)" nome="cancelamento_aviso_dias" erro={e.cancelamento_aviso_dias}>
            {(p) => <Entrada {...p} inputMode="numeric" defaultValue={num(config.cancelamento_aviso_dias)} placeholder="ex.: 7" />}
          </Campo>
          <Campo rotulo="Multa por cancelar fora do prazo (%)" nome="cancelamento_multa_pct" erro={e.cancelamento_multa_pct}>
            {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(config.cancelamento_multa_pct)} placeholder="ex.: 25" />}
          </Campo>
          <Campo rotulo="Taxa de quebra por peça (R$)" nome="taxa_quebra" erro={e.taxa_quebra}>
            {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(config.taxa_quebra)} placeholder="ex.: 25,00" />}
          </Campo>
          <Campo rotulo="Validade da proposta (dias)" nome="validade_proposta_dias" erro={e.validade_proposta_dias} ajuda="A data fica reservada até a validade.">
            {(p) => <Entrada {...p} type="number" inputMode="numeric" min={1} max={365} defaultValue={config.validade_proposta_dias} />}
          </Campo>
          <Campo rotulo="Foro" nome="foro" erro={e.foro}>
            {(p) => <Entrada {...p} defaultValue={config.foro ?? ""} maxLength={120} placeholder="ex.: Comarca de Araxá - MG" />}
          </Campo>
          <Campo rotulo="Prefixo do número" nome="prefixo_proposta" erro={e.prefixo_proposta} ajuda={`Ex.: ${config.prefixo_proposta}-2026-0001`}>
            {(p) => <Entrada {...p} defaultValue={config.prefixo_proposta} maxLength={8} className="uppercase" />}
          </Campo>
        </div>
        <Campo rotulo="Observação sobre pagamento (opcional)" nome="condicoes_padrao" erro={e.condicoes_padrao} ajuda="Texto livre que aparece junto do investimento. Ex.: formas de pagamento aceitas.">
          {(p) => <AreaTexto {...p} rows={2} maxLength={1000} defaultValue={config.condicoes_padrao ?? ""} />}
        </Campo>
        <Campo rotulo="Rodapé dos termos (opcional)" nome="rodape_proposta" erro={e.rodape_proposta}>
          {(p) => <AreaTexto {...p} rows={2} maxLength={500} defaultValue={config.rodape_proposta ?? ""} />}
        </Campo>
      </Cartao>

      <Cartao className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-texto">Agenda de eventos e atendimento</h2>
          <p className="mt-1 text-sm text-texto-2">A agenda avisa quando a data já está ocupada. O agente consulta a mesma agenda.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Festas no mesmo dia e horário" nome="capacidade_simultanea" erro={e.capacidade_simultanea} ajuda="Acima disso, a data aparece como lotada.">
            {(p) => <Entrada {...p} type="number" inputMode="numeric" min={1} max={50} defaultValue={config.capacidade_simultanea} />}
          </Campo>
          <Campo rotulo="Duração padrão do serviço (horas)" nome="duracao_padrao_horas" erro={e.duracao_padrao_horas} ajuda="Usada quando o cliente não informa a duração. Também conta no choque de horário.">
            {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(config.duracao_padrao_horas)} />}
          </Campo>
          <Campo rotulo="Leads novos do site vão para" nome="atendimento_novos_leads" erro={e.atendimento_novos_leads} ajuda="Deixe em Humano até o agente estar ligado.">
            {(p) => (
              <Selecao {...p} defaultValue={config.atendimento_novos_leads}>
                <option value="humano">Humano (André)</option>
                <option value="agente">Agente SDR</option>
              </Selecao>
            )}
          </Campo>
          <Campo
            rotulo="WhatsApp que recebe os clientes pela proposta"
            nome="whatsapp_atendimento"
            erro={e.whatsapp_atendimento}
            ajuda="Número dos botões “Quero conversar sobre a proposta” e “Avisar que aceitei” (ex.: o da Cecília). Vazio = o WhatsApp da empresa."
          >
            {(p) => <Entrada {...p} type="tel" inputMode="tel" defaultValue={config.whatsapp_atendimento ?? ""} placeholder="(34) 90000-0000" />}
          </Campo>
        </div>
      </Cartao>

      <Cartao className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-texto">Textos fixos da proposta</h2>
          <p className="mt-1 text-sm text-texto-2">Vêm da proposta-modelo da Aurora. Para voltar ao texto original, apague o campo e salve.</p>
        </div>
        {CAMPOS_TEXTO.map((c) => (
          <Campo key={c.chave} rotulo={c.rotulo} nome={`texto_${c.chave}`} erro={e[`texto_${c.chave}`]} ajuda={c.ajuda}>
            {(p) =>
              c.linhas === 1 ? (
                <Entrada {...p} defaultValue={textoProposta(config.proposta_textos, c.chave)} maxLength={240} />
              ) : (
                <AreaTexto {...p} rows={c.linhas} maxLength={1500} defaultValue={textoProposta(config.proposta_textos, c.chave)} />
              )
            }
          </Campo>
        ))}
      </Cartao>

      <div className="flex justify-end">
        <Botao type="submit" carregando={pendente} className="w-full sm:w-auto">
          {pendente ? "Salvando..." : "Salvar"}
        </Botao>
      </div>
    </form>
  );
}
