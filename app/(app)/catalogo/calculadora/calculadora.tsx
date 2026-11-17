"use client";

/** Parâmetros da calculadora, aprovação das regras de preço e simulador. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, Calculator, ShieldAlert } from "lucide-react";
import { MemoriaCalculo } from "@/components/aurora/memoria-calculo";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { EntradaMoeda, valorCampo } from "@/components/ui/controles";
import { useToast } from "@/components/ui/toast";
import { formatarDataHora } from "@/lib/formatar";
import type { Calculadora, ResultadoCalculo } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { aprovarCalculadora, salvarCalculadora, simularPreco } from "../actions";

const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)).replace(".", ","));

export function TelaCalculadora({
  calc,
  pendencias,
  pacotes,
  aprovador,
  gestor,
}: {
  calc: Calculadora | null;
  pendencias: string[];
  pacotes: { id: string; nome: string }[];
  aprovador: string | null;
  gestor: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [aprovando, iniciarAprovacao] = useTransition();
  const [simulando, iniciarSimulacao] = useTransition();
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [sim, setSim] = useState({ pacote_id: pacotes[0]?.id ?? "", convidados: "100", duracao_horas: "6", linha: "tradicional" as "tradicional" | "premium", outra_cidade: false, sem_vidraria: false });
  const { onSubmit, erros: e, pendente } = useAcao(salvarCalculadora, { aoSucesso: () => router.refresh() });
  const completa = pendencias.length === 0;

  function simular() {
    iniciarSimulacao(async () => {
      const r = await simularPreco({
        pacote_id: sim.pacote_id,
        convidados: Number(sim.convidados),
        duracao_horas: Number(sim.duracao_horas.replace(",", ".")),
        linha: sim.linha,
        outra_cidade: sim.outra_cidade,
        sem_vidraria: sim.sem_vidraria,
      });
      if (r.ok && r.calculo) setResultado(r.calculo);
      else {
        setResultado(null);
        toast.erro(r.mensagem ?? "Não foi possível simular.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Situação das regras de preço */}
      {calc?.aprovada ? (
        <div className="flex items-start gap-3 rounded-2xl border border-ok bg-ok-suave p-4 text-sm text-ok" role="status">
          <BadgeCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <strong>Regras de preço aprovadas</strong>
            {calc.aprovada_em ? ` em ${formatarDataHora(calc.aprovada_em)}` : ""}
            {aprovador ? ` por ${aprovador}` : ""}. O agente pode informar preço por elas. Se você mudar um preço de insumo, uma receita, um pacote ou
            um parâmetro, a aprovação cai e precisa ser refeita.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-alerta-forte bg-alerta-suave p-4 text-sm text-alerta" role="status">
          <p className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <strong>Regras de preço ainda não aprovadas.</strong> Enquanto isso, o agente não informa preço a ninguém e as propostas dele chegam
              com “preço a definir”. Você continua podendo digitar o valor em cada proposta.
            </span>
          </p>
          {!completa && (
            <ul className="mt-2 list-disc space-y-0.5 pl-12">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {gestor && (
            <Botao
              className="mt-3 ml-8"
              carregando={aprovando}
              disabled={!completa}
              title={completa ? undefined : "Preencha o que falta antes de aprovar"}
              onClick={() =>
                iniciarAprovacao(async () => {
                  const r = await aprovarCalculadora();
                  if (r.ok) {
                    toast.sucesso(r.mensagem ?? "Aprovado.");
                    router.refresh();
                  } else toast.erro(r.mensagem ?? "Não foi possível aprovar.");
                })
              }
            >
              <BadgeCheck className="size-4" aria-hidden /> Conferi e aprovo as regras de preço
            </Botao>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-1 text-base font-semibold">Parâmetros</h2>
          <p className="mb-4 text-sm text-texto-2">Os preços dos insumos ficam na aba Insumos e as receitas, na aba Drinks.</p>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <fieldset disabled={!gestor} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Drinks por convidado, por hora" nome="drinks_por_convidado_hora" erro={e.drinks_por_convidado_hora} ajuda="Consumo médio. Ex.: 1 = um drink por pessoa a cada hora.">
                  {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(calc?.drinks_por_convidado_hora)} />}
                </Campo>
                <Campo rotulo="Perdas e desperdício (%)" nome="perdas_pct" erro={e.perdas_pct} ajuda="Acréscimo sobre a quantidade de insumos.">
                  {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(calc?.perdas_pct ?? 0)} />}
                </Campo>
                <Campo rotulo="Convidados por bartender" nome="convidados_por_bartender" erro={e.convidados_por_bartender}>
                  {(p) => <Entrada {...p} inputMode="numeric" defaultValue={num(calc?.convidados_por_bartender)} />}
                </Campo>
                <Campo rotulo="Mínimo de bartenders" nome="minimo_bartenders" erro={e.minimo_bartenders}>
                  {(p) => <Entrada {...p} inputMode="numeric" defaultValue={num(calc?.minimo_bartenders ?? 1)} />}
                </Campo>
                <Campo rotulo="Custo do bartender por hora" nome="custo_bartender_hora" erro={e.custo_bartender_hora}>
                  {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(calc?.custo_bartender_hora)} placeholder="0,00" />}
                </Campo>
                <Campo rotulo="Horas de montagem e desmontagem" nome="horas_montagem" erro={e.horas_montagem} ajuda="Pagas além das horas de festa.">
                  {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(calc?.horas_montagem ?? 0)} />}
                </Campo>
                <Campo rotulo="Custo fixo por evento" nome="custo_fixo" erro={e.custo_fixo} ajuda="Transporte, estrutura do bar, descartáveis...">
                  {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(calc?.custo_fixo ?? 0)} placeholder="0,00" />}
                </Campo>
                <Campo rotulo="Acréscimo para outra cidade" nome="taxa_outra_cidade" erro={e.taxa_outra_cidade} ajuda="Soma quando a cidade do evento é diferente da sua.">
                  {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(calc?.taxa_outra_cidade ?? 0)} placeholder="0,00" />}
                </Campo>
                <Campo rotulo="Margem sobre o custo (%)" nome="margem_pct" erro={e.margem_pct} ajuda="Ex.: 100 = o preço é o dobro do custo.">
                  {(p) => <Entrada {...p} inputMode="decimal" defaultValue={num(calc?.margem_pct)} />}
                </Campo>
                <Campo rotulo="Arredondar o preço para cima de" nome="arredondar_para" erro={e.arredondar_para} ajuda="Ex.: 50 = de 50 em 50 reais. Zero = não arredonda.">
                  {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(calc?.arredondar_para ?? 0)} placeholder="0,00" />}
                </Campo>
                <Campo rotulo="Preço mínimo de um evento" nome="preco_minimo" erro={e.preco_minimo}>
                  {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(calc?.preco_minimo ?? 0)} placeholder="0,00" />}
                </Campo>
                <Campo
                  rotulo="Desconto sem vidraria (copos descartáveis)"
                  nome="desconto_sem_vidraria"
                  erro={e.desconto_sem_vidraria}
                  ajuda="Quanto o preço cai quando o cliente dispensa a vidraria. É uma das opções que a Cecília oferece para baixar o valor."
                >
                  {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(calc?.desconto_sem_vidraria ?? 0)} placeholder="0,00" />}
                </Campo>
              </div>
            </fieldset>
            {gestor && (
              <div className="flex justify-end">
                <Botao type="submit" carregando={pendente}>
                  Salvar parâmetros
                </Botao>
              </div>
            )}
          </form>
        </Cartao>

        <Cartao>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Calculator className="size-5 text-marca-forte" aria-hidden /> Simular uma festa
          </h2>
          <p className="mb-4 text-sm text-texto-2">A mesma conta entra na proposta. Use para conferir antes de aprovar as regras.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="sim-pacote" className="mb-1.5 block text-sm font-medium">
                Pacote
              </label>
              <Selecao id="sim-pacote" value={sim.pacote_id} onChange={(ev) => setSim((s) => ({ ...s, pacote_id: ev.target.value }))}>
                {pacotes.length === 0 && <option value="">— cadastre um pacote —</option>}
                {pacotes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div>
              <label htmlFor="sim-conv" className="mb-1.5 block text-sm font-medium">
                Convidados
              </label>
              <Entrada id="sim-conv" inputMode="numeric" value={sim.convidados} onChange={(ev) => setSim((s) => ({ ...s, convidados: ev.target.value }))} />
            </div>
            <div>
              <label htmlFor="sim-horas" className="mb-1.5 block text-sm font-medium">
                Horas de serviço
              </label>
              <Entrada id="sim-horas" inputMode="decimal" value={sim.duracao_horas} onChange={(ev) => setSim((s) => ({ ...s, duracao_horas: ev.target.value }))} />
            </div>
            <div>
              <label htmlFor="sim-linha" className="mb-1.5 block text-sm font-medium">
                Linha de bebidas
              </label>
              <Selecao id="sim-linha" value={sim.linha} onChange={(ev) => setSim((s) => ({ ...s, linha: ev.target.value === "premium" ? "premium" : "tradicional" }))}>
                <option value="tradicional">Tradicional</option>
                <option value="premium">Premium</option>
              </Selecao>
            </div>
            <label className="flex min-h-11 items-center gap-3 self-end text-sm">
              <input type="checkbox" checked={sim.outra_cidade} onChange={(ev) => setSim((s) => ({ ...s, outra_cidade: ev.target.checked }))} className="size-5 accent-[var(--marca)]" />
              Evento em outra cidade
            </label>
            <label className="flex min-h-11 items-center gap-3 self-end text-sm">
              <input type="checkbox" checked={sim.sem_vidraria} onChange={(ev) => setSim((s) => ({ ...s, sem_vidraria: ev.target.checked }))} className="size-5 accent-[var(--marca)]" />
              Sem vidraria (copos descartáveis)
            </label>
          </div>
          <Botao variante="secundario" className="mt-4 w-full" carregando={simulando} disabled={!sim.pacote_id} onClick={simular}>
            Calcular
          </Botao>
          {resultado && (
            <div className="mt-4 border-t border-borda pt-4">
              <MemoriaCalculo calculo={resultado} />
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}
