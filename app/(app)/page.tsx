/**
 * INÍCIO: lembretes do dia (atividades atrasadas e de hoje), meta do mês com projeção,
 * números rápidos, negócios sem próxima atividade, propostas aguardando aprovação (gestor)
 * e propostas aceitas recentemente.
 */
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, FileText, Hourglass, KanbanSquare } from "lucide-react";
import { BarraProgresso } from "@/components/comercial/barra-progresso";
import { BotaoAtividade } from "@/components/comercial/botao-atividade";
import { ListaAtividades } from "@/components/comercial/lista-atividades";
import { classesBotao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { diasDesde, difDias, fimMes, inicioMes, moedaInteira, pct, primeiroNome, somarDias } from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { agoraServidor, listarVendedores } from "@/lib/dados";
import { formatarDataExtenso, formatarDataHora, hojeISO } from "@/lib/formatar";
import { todasAsLinhas } from "@/lib/paginar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Atividade, Negocio } from "@/lib/tipos";

export default async function Inicio({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const { senha } = await searchParams;
  const [{ perfil }, config, vendedores] = await Promise.all([obterPerfil(), obterConfiguracoes(), listarVendedores()]);
  const gestor = ehGestor(perfil);
  const meuId = perfil?.id ?? "";
  const hoje = hojeISO();
  const agora = agoraServidor();
  const mes = inicioMes(hoje);
  const fimHoje = `${somarDias(hoje, 1)}T00:00:00-03:00`;
  const supabase = await createClient();

  const [lembretesR, abertos, ganhosMesR, metasR, aguardandoR, aceitasR, pendentesNeg] = await Promise.all([
    // lembretes: minhas atividades atrasadas e de hoje
    supabase.from("atividades").select("*").eq("vendedor_id", meuId).eq("concluida", false).lt("quando", fimHoje).order("quando").limit(30),
    todasAsLinhas<Negocio>((a, b) => {
      let q = supabase.from("negocios").select("*").eq("status", "aberto");
      if (!gestor) q = q.eq("vendedor_id", meuId);
      return q.order("id").range(a, b);
    }),
    (() => {
      let q = supabase.from("negocios").select("valor").eq("status", "ganho").gte("fechado_em", `${mes}T00:00:00-03:00`);
      if (!gestor) q = q.eq("vendedor_id", meuId);
      return q;
    })(),
    supabase.rpc("progresso_metas", { p_competencia: mes }),
    gestor
      ? supabase.from("propostas").select("id, numero, versao, total").eq("status", "aguardando_aprovacao").order("aprovacao_pedida_em").limit(10)
      : Promise.resolve({ data: [] as { id: string; numero: string; versao: number; total: number }[] }),
    supabase.from("propostas").select("id, numero, total, aceita_em, aceite_nome").eq("status", "aceita").order("aceita_em", { ascending: false }).limit(5),
    todasAsLinhas<{ negocio_id: string | null }>((a, b) =>
      supabase.from("atividades").select("negocio_id").eq("concluida", false).not("negocio_id", "is", null).order("id").range(a, b),
    ),
  ]);

  const lembretes = (lembretesR.data ?? []) as Atividade[];
  const ids = Array.from(new Set(lembretes.map((a) => a.negocio_id).filter((x): x is string => Boolean(x))));
  const { data: negsLembrete } = ids.length ? await supabase.from("negocios").select("id, titulo").in("id", ids) : { data: [] };
  const nomeNeg = Object.fromEntries((negsLembrete ?? []).map((n) => [n.id, n.titulo]));

  const comProxima = new Set(pendentesNeg.map((a) => a.negocio_id));
  const meusAbertos = abertos.filter((n) => gestor || n.vendedor_id === meuId);
  const semProxima = meusAbertos.filter((n) => !comProxima.has(n.id));
  const parados = meusAbertos.filter((n) => diasDesde(n.ultima_atividade_em ?? n.created_at, agora) >= config.dias_sem_contato);
  const valorAberto = meusAbertos.reduce((s, n) => s + Number(n.valor), 0);
  const ganhoMes = (ganhosMesR.data ?? []).reduce((s, n) => s + Number(n.valor), 0);
  const qtdGanhoMes = (ganhosMesR.data ?? []).length;

  // Meta: a minha (vendedor) ou a soma das metas dos vendedores (gestor)
  const metas = metasR.data ?? [];
  const minha = metas.find((m) => m.vendedor_id === meuId);
  const metaValor = gestor ? metas.filter((m) => m.vendedor_id).reduce((s, m) => s + Number(m.meta_valor), 0) : Number(minha?.meta_valor ?? 0);
  const diasMes = Number(fimMes(hoje).slice(8));
  const diaAtual = difDias(mes, hoje) + 1;
  const projecao = ganhoMes * (diasMes / diaAtual);
  const atrasadas = lembretes.filter((a) => a.quando < `${hoje}T00:00:00-03:00`).length;
  const nomeVend = Object.fromEntries(vendedores.map((v) => [v.id, v.nome]));

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Olá, {primeiroNome(perfil?.nome) || "vendedor"}!</h1>
          <p className="mt-1 text-sm text-texto-2 first-letter:uppercase">{formatarDataExtenso(hoje)}</p>
        </div>
        <div className="flex flex-wrap gap-2 nao-imprimir">
          <BotaoAtividade negocios={meusAbertos.slice(0, 300).map((n) => ({ id: n.id, nome: n.titulo }))} />
        </div>
      </div>

      {senha === "alterada" && (
        <p role="status" className="mb-6 rounded-xl bg-ok-suave p-3 text-sm text-ok">
          Senha alterada com sucesso.
        </p>
      )}

      {gestor && (aguardandoR.data?.length ?? 0) > 0 && (
        <Link
          href="/propostas?status=aguardando_aprovacao"
          className="mb-4 flex min-h-12 items-center gap-3 rounded-2xl border border-alerta-forte bg-alerta-suave px-4 py-3 text-sm font-semibold text-alerta"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">{aguardandoR.data!.length} proposta(s) com desconto acima do limite aguardando sua aprovação</span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">Vendido no mês</p>
          <p className="num text-xl font-extrabold text-ok sm:text-2xl">{moedaInteira(ganhoMes)}</p>
          <p className="text-xs text-texto-2">{qtdGanhoMes} negócio(s){gestor ? " · time" : ""}</p>
        </Cartao>
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">Em aberto no funil</p>
          <p className="num text-xl font-extrabold sm:text-2xl">{moedaInteira(valorAberto)}</p>
          <p className="text-xs text-texto-2">{meusAbertos.length} negócio(s)</p>
        </Cartao>
        <Link href="/agenda" className="block">
          <Cartao className="h-full p-3 hover:border-marca/50 sm:p-4">
            <p className="text-xs text-texto-2">Para hoje</p>
            <p className="num text-xl font-extrabold sm:text-2xl">{lembretes.length - atrasadas}</p>
            <p className={atrasadas ? "text-xs font-semibold text-perigo" : "text-xs text-texto-2"}>{atrasadas} atrasada(s)</p>
          </Cartao>
        </Link>
        <Link href="/funil" className="block">
          <Cartao className="h-full p-3 hover:border-marca/50 sm:p-4">
            <p className="text-xs text-texto-2">Sem contato há {config.dias_sem_contato}+ dias</p>
            <p className={`num text-xl font-extrabold sm:text-2xl ${parados.length ? "text-alerta" : ""}`}>{parados.length}</p>
            <p className="text-xs text-texto-2">negócio(s) esfriando</p>
          </Cartao>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <CalendarCheck className="size-5 text-marca-forte" aria-hidden /> Seus lembretes de hoje
              </h2>
              <Link href="/agenda" className="text-sm font-semibold text-marca-forte hover:underline">
                Agenda completa
              </Link>
            </div>
            <ListaAtividades
              atividades={lembretes}
              agora={agora}
              hoje={hoje}
              meuId={meuId}
              gestor={gestor}
              negocios={nomeNeg}
              vazio="Nada pendente para hoje. Aproveite para agendar follow-ups nos negócios sem próxima atividade."
            />
          </Cartao>

          {semProxima.length > 0 && (
            <Cartao>
              <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
                <Hourglass className="size-5 text-alerta" aria-hidden /> Negócios sem próxima atividade
              </h2>
              <p className="mb-3 text-sm text-texto-2">Todo negócio em aberto precisa de um próximo passo agendado.</p>
              <ul className="divide-y divide-borda">
                {semProxima.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <Link href={`/negocios/${n.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:text-marca-forte">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{n.titulo}</span>
                        <span className="block text-xs text-texto-2">
                          {gestor ? `${nomeVend[n.vendedor_id] ?? ""} · ` : ""}último contato há {diasDesde(n.ultima_atividade_em ?? n.created_at, agora)} dia(s)
                        </span>
                      </span>
                      <span className="num text-sm font-bold">{moedaInteira(n.valor)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {semProxima.length > 8 && <p className="mt-2 text-sm text-texto-2">e mais {semProxima.length - 8}…</p>}
            </Cartao>
          )}
        </div>

        <div className="space-y-4">
          <Cartao>
            <h2 className="mb-2 text-base font-semibold">{gestor ? "Meta do time no mês" : "Sua meta do mês"}</h2>
            {metaValor > 0 ? (
              <>
                <p className="mb-1 text-sm">
                  <strong className="num text-lg">{moedaInteira(ganhoMes)}</strong> <span className="text-texto-2">de {moedaInteira(metaValor)}</span>
                </p>
                <BarraProgresso atual={ganhoMes} meta={metaValor} projecao={projecao} rotulo="Progresso da meta do mês" />
                <p className={`mt-2 text-sm ${projecao >= metaValor ? "text-menta-texto" : "text-alerta"}`}>
                  {pct(ganhoMes / metaValor)} atingido · projeção {moedaInteira(projecao)} ({pct(projecao / metaValor)})
                </p>
              </>
            ) : (
              <p className="text-sm text-texto-2">Sem meta definida para este mês.</p>
            )}
            <Link href="/metas" className={classesBotao("secundario", "mt-3 w-full")}>
              Ver metas e ranking
            </Link>
          </Cartao>

          <Cartao>
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="size-5 text-ok" aria-hidden /> Propostas aceitas
            </h2>
            {(aceitasR.data ?? []).length === 0 ? (
              <p className="text-sm text-texto-2">Nenhuma ainda.</p>
            ) : (
              <ul className="space-y-2">
                {aceitasR.data!.map((p) => (
                  <li key={p.id}>
                    <Link href={`/propostas/${p.id}`} className="block rounded-xl p-2 hover:bg-superficie-2">
                      <span className="flex justify-between gap-2 text-sm font-semibold">
                        <span>{p.numero}</span>
                        <span className="num">{moedaInteira(p.total)}</span>
                      </span>
                      <span className="block text-xs text-texto-2">
                        {p.aceite_nome} · {formatarDataHora(p.aceita_em)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/funil" className={classesBotao("secundario")}>
              <KanbanSquare className="size-4" aria-hidden /> Funil
            </Link>
            <Link href="/propostas" className={classesBotao("secundario")}>
              <FileText className="size-4" aria-hidden /> Propostas
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
