"use client";

/** Dados do evento do negócio: resumo, situação da data, aviso de agenda e formulário de edição. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CalendarCheck, CalendarDays, Clock, GlassWater, MapPin, Pencil, Users } from "lucide-react";
import { salvarEvento } from "@/app/(app)/negocios/acoes-aurora";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { Modal } from "@/components/ui/modal";
import { LINHAS, SITUACAO_DATA, TIPOS_EVENTO, dataPorExtenso, diaDaSemana, horasTexto, mesPorExtenso, nomeTipoEvento } from "@/lib/aurora";
import { formatarData } from "@/lib/formatar";
import type { Disponibilidade, Evento } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";

type Opcao = { id: string; nome: string };

export function CartaoEvento({
  negocioId,
  evento,
  pacotes,
  disponibilidade,
  pode,
  cidadePadrao,
  ufPadrao,
}: {
  negocioId: string;
  evento: Evento | null;
  pacotes: Opcao[];
  disponibilidade: Disponibilidade | null;
  pode: boolean;
  cidadePadrao: string | null;
  ufPadrao: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [semData, setSemData] = useState(Boolean(evento && !evento.data && evento.mes_previsto));
  const { onSubmit, erros: e, pendente } = useAcao(salvarEvento, {
    aoSucesso: () => {
      setAberto(false);
      router.refresh();
    },
  });

  const pacote = pacotes.find((p) => p.id === evento?.pacote_id)?.nome;
  const sit = SITUACAO_DATA[evento?.situacao_data ?? "consulta"];
  const vazio = !evento || (!evento.tipo && !evento.data && !evento.mes_previsto && !evento.convidados && !evento.convidados_faixa && !evento.cidade);
  const d = disponibilidade;

  return (
    <Cartao>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarDays className="size-5 text-marca-forte" aria-hidden /> Evento
        </h2>
        {pode && (
          <Botao variante="secundario" onClick={() => setAberto(true)}>
            <Pencil className="size-4" aria-hidden /> {vazio ? "Preencher" : "Editar"}
          </Botao>
        )}
      </div>

      {vazio ? (
        <p className="text-sm text-texto-2">Ainda sem dados do evento. Preencha tipo, data, cidade e convidados para montar a proposta.</p>
      ) : (
        <>
          <p className="font-titulo text-xl font-semibold text-texto">
            {evento.nome || nomeTipoEvento(evento.tipo)}
            {evento.nome && evento.tipo ? <span className="font-sans text-sm font-normal text-texto-2"> · {nomeTipoEvento(evento.tipo)}</span> : null}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-texto-2" aria-hidden />
              <div>
                <dt className="sr-only">Data</dt>
                <dd className="font-medium">
                  {evento.data
                    ? `${dataPorExtenso(evento.data)} (${diaDaSemana(evento.data).toLowerCase()})`
                    : evento.mes_previsto
                      ? `A definir · previsto para ${mesPorExtenso(evento.mes_previsto)}`
                      : "Data a definir"}
                </dd>
                {evento.data && (
                  <dd className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Selo cor={sit.cor} title={sit.ajuda}>
                      {sit.nome}
                      {evento.situacao_data === "reservada" && evento.reservada_ate ? ` até ${formatarData(evento.reservada_ate)}` : ""}
                    </Selo>
                  </dd>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-texto-2" aria-hidden />
              <div>
                <dt className="sr-only">Horário e duração</dt>
                <dd className="font-medium">
                  {evento.hora_inicio ? `Início às ${evento.hora_inicio.slice(0, 5)}` : "Horário a combinar"}
                  {evento.duracao_horas ? ` · ${horasTexto(evento.duracao_horas)} de serviço` : ""}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-texto-2" aria-hidden />
              <div>
                <dt className="sr-only">Local</dt>
                <dd className="font-medium">{[evento.local, [evento.cidade, evento.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "Local a definir"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-texto-2" aria-hidden />
              <div>
                <dt className="sr-only">Convidados</dt>
                <dd className="font-medium">
                  {evento.convidados ? `${evento.convidados} convidados` : evento.convidados_faixa ? `${evento.convidados_faixa} convidados (estimativa)` : "Convidados a definir"}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:col-span-2">
              <GlassWater className="mt-0.5 size-4 shrink-0 text-texto-2" aria-hidden />
              <div>
                <dt className="sr-only">Pacote</dt>
                <dd className="font-medium">
                  {pacote ? `Pacote ${pacote}` : evento.quer_ajuda_pacote ? "Quer ajuda para escolher o pacote" : "Pacote a definir"}
                  {evento.linha === "premium" ? " · linha premium" : ""}
                </dd>
                {evento.preferencias.length > 0 && <dd className="text-texto-2">Preferências: {evento.preferencias.join(", ")}</dd>}
              </div>
            </div>
          </dl>
          {evento.observacoes && <p className="mt-3 rounded-xl bg-superficie-2 p-3 text-sm whitespace-pre-line">{evento.observacoes}</p>}

          {d && evento.situacao_data !== "confirmada" && (d.situacao === "lotada" || d.situacao === "bloqueada") && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-perigo-suave p-3 text-sm text-perigo">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {d.situacao === "bloqueada" ? (
                  <>
                    <strong>Data bloqueada na agenda</strong>
                    {d.motivo_bloqueio ? `: ${d.motivo_bloqueio}.` : "."}
                  </>
                ) : (
                  <>
                    <strong>Agenda lotada nesse dia e horário:</strong> já há {d.confirmados} evento(s) confirmado(s) e {d.reservados} reservado(s). O
                    limite é {d.capacidade}.
                  </>
                )}
              </span>
            </p>
          )}
          {d && d.situacao === "parcial" && evento.situacao_data !== "confirmada" && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-alerta-suave p-3 text-sm text-alerta">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Já há {d.confirmados + d.reservados} de {d.capacidade} vagas ocupadas nesse dia e horário ({d.confirmados} confirmada(s), {d.reservados}{" "}
                reservada(s)).
              </span>
            </p>
          )}
        </>
      )}

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Dados do evento" largo>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <input type="hidden" name="negocio_id" value={negocioId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Tipo de evento" nome="tipo" erro={e.tipo}>
              {(p) => (
                <Selecao {...p} defaultValue={evento?.tipo ?? ""}>
                  <option value="">— a definir —</option>
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Nome do evento (opcional)" nome="nome" erro={e.nome} ajuda="Ex.: 1 ano do José Miguel. Aparece na proposta.">
              {(p) => <Entrada {...p} defaultValue={evento?.nome ?? ""} maxLength={120} />}
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {semData ? (
              <Campo rotulo="Mês previsto" nome="mes_previsto" erro={e.mes_previsto}>
                {(p) => <Entrada {...p} type="month" defaultValue={evento?.mes_previsto?.slice(0, 7) ?? ""} />}
              </Campo>
            ) : (
              <Campo rotulo="Data do evento" nome="data" erro={e.data}>
                {(p) => <Entrada {...p} type="date" defaultValue={evento?.data ?? ""} />}
              </Campo>
            )}
            <Campo rotulo="Início" nome="hora_inicio" erro={e.hora_inicio}>
              {(p) => <Entrada {...p} type="time" defaultValue={evento?.hora_inicio?.slice(0, 5) ?? ""} />}
            </Campo>
            <Campo rotulo="Duração do serviço (horas)" nome="duracao_horas" erro={e.duracao_horas}>
              {(p) => <Entrada {...p} inputMode="decimal" defaultValue={evento?.duracao_horas ? String(evento.duracao_horas).replace(".", ",") : ""} placeholder="padrão: 6" />}
            </Campo>
          </div>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={semData} onChange={(ev) => setSemData(ev.target.checked)} className="size-5 accent-[var(--marca)]" />
            Data ainda a definir (informar só o mês previsto)
          </label>

          <div className="grid gap-4 sm:grid-cols-[1fr_5rem_1fr]">
            <Campo rotulo="Cidade" nome="cidade" erro={e.cidade}>
              {(p) => <Entrada {...p} defaultValue={evento?.cidade ?? cidadePadrao ?? ""} maxLength={80} />}
            </Campo>
            <Campo rotulo="UF" nome="uf" erro={e.uf}>
              {(p) => <Entrada {...p} defaultValue={evento?.uf ?? ufPadrao ?? ""} maxLength={2} className="uppercase" />}
            </Campo>
            <Campo rotulo="Local" nome="local" erro={e.local}>
              {(p) => <Entrada {...p} defaultValue={evento?.local ?? ""} maxLength={160} placeholder="Ex.: Espaço Festa Mágica" />}
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Número de convidados" nome="convidados" erro={e.convidados}>
              {(p) => <Entrada {...p} inputMode="numeric" defaultValue={evento?.convidados ?? ""} placeholder="ex.: 85" />}
            </Campo>
            <Campo rotulo="Ou uma estimativa" nome="convidados_faixa" erro={e.convidados_faixa} ajuda="Como veio do site. Ex.: 51 a 100">
              {(p) => <Entrada {...p} defaultValue={evento?.convidados_faixa ?? ""} maxLength={40} />}
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Pacote de interesse" nome="pacote_id" erro={e.pacote_id}>
              {(p) => (
                <Selecao {...p} defaultValue={evento?.pacote_id ?? ""}>
                  <option value="">— a definir —</option>
                  {pacotes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Linha de bebidas" nome="linha" erro={e.linha} ajuda="Premium usa as marcas premium na calculadora.">
              {(p) => (
                <Selecao {...p} defaultValue={evento?.linha ?? ""}>
                  <option value="">— a definir —</option>
                  {LINHAS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>

          <Campo rotulo="Preferências de drinks" nome="preferencias" erro={e.preferencias} ajuda="Separe por vírgula. Ex.: sem álcool, drinks premium">
            {(p) => <Entrada {...p} defaultValue={evento?.preferencias.join(", ") ?? ""} maxLength={300} />}
          </Campo>
          <Campo rotulo="Observações do evento" nome="observacoes" erro={e.observacoes}>
            {(p) => <AreaTexto {...p} rows={3} maxLength={2000} defaultValue={evento?.observacoes ?? ""} />}
          </Campo>
          <Campo rotulo="Situação da data na agenda" nome="situacao_data" erro={e.situacao_data} ajuda="Muda sozinha: reservada ao enviar a proposta, confirmada ao fechar. Aqui você pode acertar à mão.">
            {(p) => (
              <Selecao {...p} defaultValue={evento?.situacao_data ?? "consulta"}>
                {Object.entries(SITUACAO_DATA).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>

          <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao type="submit" carregando={pendente}>
              Salvar evento
            </Botao>
          </div>
        </form>
      </Modal>
    </Cartao>
  );
}
