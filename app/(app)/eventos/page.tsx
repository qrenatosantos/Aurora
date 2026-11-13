/**
 * AGENDA DE EVENTOS: calendário do mês com as festas em consulta, reservadas e confirmadas,
 * aviso de dia lotado, datas bloqueadas e a lista dos pedidos ainda sem data.
 * O agente consulta a mesma agenda pela API (agenda/disponibilidade).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CabecalhoPagina, Cartao, Selo } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { SITUACAO_DATA, diaDaSemana, hojeBR, mesPorExtenso, nomeTipoEvento } from "@/lib/aurora";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { formatarData } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { BloqueioAgenda, Evento, StatusNegocio } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { Bloqueios, ConsultaData } from "./ferramentas";

export const metadata: Metadata = { title: "Agenda de eventos" };

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const iso = (ano: number, mes: number, dia: number) => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

const COR_SITUACAO: Record<string, string> = {
  confirmada: "bg-ok-suave text-ok",
  reservada: "bg-alerta-suave text-alerta",
  consulta: "bg-superficie-2 text-texto-2",
  liberada: "bg-superficie-2 text-texto-2 line-through",
};

type NegocioCurto = { id: string; titulo: string; status: StatusNegocio; contato_id: string | null };

export default async function PaginaEventos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const hoje = hojeBR();
  const mesAtual = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hoje.slice(0, 7);
  const [ano, mes] = mesAtual.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const primeiroDia = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const inicio = iso(ano, mes, 1);
  const fim = iso(ano, mes, diasNoMes);
  const anterior = mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
  const proximo = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;

  const supabase = await createClient();
  const [{ perfil }, config, eventosR, semDataR, bloqueiosR] = await Promise.all([
    obterPerfil(),
    obterConfiguracoes(),
    supabase.from("eventos").select("*").gte("data", inicio).lte("data", fim).order("data").order("hora_inicio"),
    supabase.from("eventos").select("*").is("data", null).order("mes_previsto", { nullsFirst: false }).limit(200),
    supabase.from("bloqueios_agenda").select("*").gte("fim", hoje < inicio ? hoje : inicio).order("inicio").limit(100),
  ]);
  const eventos = (eventosR.data ?? []) as Evento[];
  const semDataTodos = (semDataR.data ?? []) as Evento[];
  const bloqueios = (bloqueiosR.data ?? []) as BloqueioAgenda[];

  const ids = Array.from(new Set([...eventos, ...semDataTodos].map((e) => e.negocio_id)));
  const negocios = new Map<string, NegocioCurto>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("negocios").select("id, titulo, status, contato_id").in("id", ids.slice(i, i + 100));
    for (const n of (data ?? []) as NegocioCurto[]) negocios.set(n.id, n);
  }
  // perdidos saem da agenda; sem data: só os negócios em aberto
  const doMes = eventos.filter((e) => negocios.get(e.negocio_id)?.status !== "perdido");
  const semData = semDataTodos.filter((e) => negocios.get(e.negocio_id)?.status === "aberto");

  const porDia = new Map<string, Evento[]>();
  for (const e of doMes) porDia.set(e.data!, [...(porDia.get(e.data!) ?? []), e]);
  const bloqueado = (dia: string) => bloqueios.find((b) => dia >= b.inicio && dia <= b.fim);
  const ocupam = (lista: Evento[]) =>
    lista.filter((e) => e.situacao_data === "confirmada" || (e.situacao_data === "reservada" && (!e.reservada_ate || e.reservada_ate >= hoje))).length;
  const capacidade = config.capacidade_simultanea;

  const celulas: (number | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);

  const resumo = {
    confirmadas: doMes.filter((e) => e.situacao_data === "confirmada").length,
    reservadas: doMes.filter((e) => e.situacao_data === "reservada").length,
    consulta: doMes.filter((e) => e.situacao_data === "consulta").length,
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Agenda de eventos"
        descricao={`Até ${capacidade} festa(s) no mesmo dia e horário. A data fica reservada quando a proposta é enviada e confirmada quando o negócio fecha.`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao className="p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link href={`/eventos?mes=${anterior}`} aria-label="Mês anterior" className="grid size-11 place-items-center rounded-xl hover:bg-superficie-2">
                <ChevronLeft className="size-5" aria-hidden />
              </Link>
              <div className="text-center">
                <h2 className="text-xl font-semibold capitalize">{mesPorExtenso(inicio)}</h2>
                <p className="text-xs text-texto-2">
                  {resumo.confirmadas} confirmada(s) · {resumo.reservadas} reservada(s) · {resumo.consulta} em consulta
                </p>
              </div>
              <Link href={`/eventos?mes=${proximo}`} aria-label="Próximo mês" className="grid size-11 place-items-center rounded-xl hover:bg-superficie-2">
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            </div>

            {/* Calendário (a partir de 640px). No celular, a lista abaixo faz o mesmo papel. */}
            <div className="hidden sm:block" role="grid" aria-label={`Calendário de ${mesPorExtenso(inicio)}`}>
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-texto-2" role="row">
                {SEMANA.map((d) => (
                  <div key={d} role="columnheader" className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-borda bg-borda">
                {celulas.map((dia, i) => {
                  if (dia === null) return <div key={`v${i}`} className="min-h-24 bg-superficie-2/60" />;
                  const d = iso(ano, mes, dia);
                  const lista = porDia.get(d) ?? [];
                  const b = bloqueado(d);
                  const ocupados = ocupam(lista);
                  return (
                    <div key={d} role="gridcell" className={cn("min-h-24 bg-superficie p-1.5", b && "bg-perigo-suave/50", d < hoje && "opacity-70")}>
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className={cn("num grid size-6 place-items-center rounded-full text-xs font-semibold", d === hoje && "bg-marca text-marca-texto")}>{dia}</span>
                        {b ? (
                          <span className="truncate text-[10px] font-semibold text-perigo" title={b.motivo ?? "Bloqueada"}>
                            Bloqueada
                          </span>
                        ) : ocupados >= capacidade ? (
                          <span className="text-[10px] font-bold text-perigo">Lotado</span>
                        ) : ocupados > 0 ? (
                          <span className="num text-[10px] font-semibold text-texto-2">
                            {ocupados}/{capacidade}
                          </span>
                        ) : null}
                      </div>
                      <ul className="space-y-1">
                        {lista.map((e) => (
                          <li key={e.id}>
                            <Link
                              href={`/negocios/${e.negocio_id}`}
                              title={`${negocios.get(e.negocio_id)?.titulo ?? "Negócio"} · ${SITUACAO_DATA[e.situacao_data].nome}`}
                              className={cn("block truncate rounded px-1.5 py-1 text-[11px] font-semibold hover:opacity-80", COR_SITUACAO[e.situacao_data])}
                            >
                              {e.hora_inicio ? `${e.hora_inicio.slice(0, 5)} ` : ""}
                              {negocios.get(e.negocio_id)?.titulo ?? nomeTipoEvento(e.tipo)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-sm bg-ok" /> Confirmada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-sm bg-alerta-forte" /> Reservada (proposta enviada)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-sm bg-borda" /> Em consulta
                </span>
              </p>
            </div>

            {/* Lista do mês (sempre no celular; no computador serve de detalhe) */}
            <div className="sm:mt-5">
              <h3 className="mb-2 text-sm font-semibold text-texto-2 sm:text-base sm:text-texto">Eventos do mês</h3>
              {doMes.length === 0 ? (
                <EstadoVazio icone={CalendarDays} titulo="Nenhum evento neste mês" descricao="Os eventos aparecem aqui quando o negócio tem data definida." />
              ) : (
                <ul className="divide-y divide-borda">
                  {doMes.map((e) => {
                    const n = negocios.get(e.negocio_id);
                    const s = SITUACAO_DATA[e.situacao_data];
                    return (
                      <li key={e.id}>
                        <Link href={`/negocios/${e.negocio_id}`} className="flex min-h-14 items-center gap-3 py-2 hover:text-marca-forte">
                          <span className="w-12 shrink-0 text-center">
                            <span className="num block text-xl leading-none font-bold">{e.data!.slice(8, 10)}</span>
                            <span className="block text-[11px] text-texto-2">{diaDaSemana(e.data).slice(0, 3)}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{n?.titulo ?? nomeTipoEvento(e.tipo)}</span>
                            <span className="block truncate text-xs text-texto-2">
                              {[
                                e.hora_inicio ? e.hora_inicio.slice(0, 5) : "horário a combinar",
                                [e.local, e.cidade].filter(Boolean).join(", "),
                                e.convidados ? `${e.convidados} convidados` : e.convidados_faixa,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <Selo cor={s.cor}>{s.nome}</Selo>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Cartao>

          <Cartao>
            <h2 className="mb-1 text-base font-semibold">Pedidos sem data definida</h2>
            <p className="mb-3 text-sm text-texto-2">Negócios em aberto em que o cliente ainda não fechou a data.</p>
            {semData.length === 0 ? (
              <p className="text-sm text-texto-2">Nenhum pedido sem data.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {semData.map((e) => (
                  <li key={e.id}>
                    <Link href={`/negocios/${e.negocio_id}`} className="flex min-h-12 items-center gap-3 py-2 text-sm hover:text-marca-forte">
                      <span className="min-w-0 flex-1 truncate font-medium">{negocios.get(e.negocio_id)?.titulo ?? nomeTipoEvento(e.tipo)}</span>
                      <span className="shrink-0 text-texto-2">{e.mes_previsto ? `previsto para ${mesPorExtenso(e.mes_previsto)}` : "sem previsão"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div className="space-y-4">
          <ConsultaData />
          <Bloqueios bloqueios={bloqueios.filter((b) => b.fim >= hoje)} gestor={ehGestor(perfil)} />
          <p className="px-1 text-xs text-texto-2">
            Hoje é {formatarData(hoje)}. A capacidade por horário muda em Configurações ▸ Propostas e agenda.
          </p>
        </div>
      </div>
    </>
  );
}
