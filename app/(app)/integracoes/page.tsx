/**
 * INTEGRAÇÕES (só o gestor): chaves de acesso do agente, avisos (webhooks), fila de avisos
 * e o registro de tudo o que o agente fez. O agente em si é construído fora deste sistema.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, MailWarning, ScrollText } from "lucide-react";
import { SoGestor } from "@/components/comercial/so-gestor";
import { CabecalhoPagina, Cartao, Selo } from "@/components/ui/cartao";
import { nomeAviso } from "@/lib/aurora";
import { ROTAS_AGENTE } from "@/lib/api/rotas-agente";
import { formatarDataHora, formatarTelefone } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { urlDoSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { AgenteLog, ChaveApi, EventoSaida, LeadRecebidoRow, Webhook, WebhookEntrega } from "@/lib/tipos";
import { Chaves, FilaAvisos, Webhooks } from "./integracoes";

export const metadata: Metadata = { title: "Integrações" };

const ENTREGA = {
  pendente: { nome: "na fila", cor: "neutro" },
  enviando: { nome: "enviando", cor: "info" },
  entregue: { nome: "entregue", cor: "ok" },
  falhou: { nome: "falhou, vai tentar de novo", cor: "alerta" },
  desistiu: { nome: "não entregue", cor: "perigo" },
} as const;

export default async function PaginaIntegracoes() {
  const { perfil } = await obterPerfil();
  if (!ehGestor(perfil)) return <SoGestor />;
  const supabase = await createClient();
  const [chavesR, webhooksR, eventosR, logR, rejeitadosR, site] = await Promise.all([
    supabase.from("chaves_api").select("id, nome, prefixo, escopos, limite_por_minuto, ativa, ultimo_uso_em, revogada_em, created_at").order("created_at", { ascending: false }),
    supabase.from("webhooks").select("*").order("created_at"),
    supabase.from("eventos_saida").select("*").order("id", { ascending: false }).limit(25),
    supabase.from("agente_log").select("*").order("id", { ascending: false }).limit(40),
    // pedidos que chegaram (site ou agente) e NÃO viraram negócio: ninguém pode ficar sem resposta
    supabase.from("leads_recebidos").select("*").eq("status", "rejeitado").neq("dados", "{}").order("created_at", { ascending: false }).limit(15),
    urlDoSite(),
  ]);
  const chaves = (chavesR.data ?? []) as Omit<ChaveApi, "hash" | "criada_por" | "updated_at">[];
  const webhooks = (webhooksR.data ?? []) as Webhook[];
  const eventos = (eventosR.data ?? []) as EventoSaida[];
  const log = (logR.data ?? []) as AgenteLog[];
  const rejeitados = ((rejeitadosR.data ?? []) as LeadRecebidoRow[]).map((l) => {
    const d = (l.dados ?? {}) as Record<string, unknown>;
    const texto = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
    return { id: l.id, quando: l.created_at, origem: l.origem, motivo: l.motivo, nome: texto("nome"), telefone: texto("whatsapp") || texto("telefone") };
  });
  const idsEventos = eventos.map((e) => e.id);
  const { data: entregasD } = idsEventos.length
    ? await supabase.from("webhook_entregas").select("*").in("evento_id", idsEventos)
    : { data: [] as WebhookEntrega[] };
  const entregas = (entregasD ?? []) as WebhookEntrega[];
  const nomeChave = new Map(chaves.map((c) => [c.id, c.nome]));

  return (
    <>
      <CabecalhoPagina
        titulo="Integrações"
        descricao="A porta de entrada do agente SDR: chave de acesso, avisos e o registro de tudo o que ele fizer. O agente é construído à parte."
      />

      <div className="space-y-5">
        <Cartao className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <BookOpen className="size-6 shrink-0 text-marca-forte" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-texto">Endereço da API: {site}/api/v1</p>
            <p className="text-texto-2">
              {ROTAS_AGENTE.length} endereços. A documentação completa está no arquivo <code>docs/API-DO-AGENTE.md</code> do projeto; ferramentas de agente
              leem o formato de máquina abaixo.
            </p>
          </div>
          <Link href="/api/v1/openapi.json" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda px-4 text-sm font-semibold hover:bg-superficie-2">
            Abrir OpenAPI
          </Link>
        </Cartao>

        {rejeitados.length > 0 && (
          <Cartao className="border-alerta-forte">
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
              <MailWarning className="size-5 text-alerta" aria-hidden /> Pedidos que não entraram no funil
            </h2>
            <p className="mb-3 text-sm text-texto-2">
              Chegaram, mas o sistema não conseguiu registrar. Os dados ficaram guardados aqui para ninguém ficar sem resposta: cadastre o contato manualmente.
            </p>
            <ul className="divide-y divide-borda text-sm">
              {rejeitados.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                  <span className="font-semibold">{l.nome || "Sem nome"}</span>
                  {l.telefone && <span className="num">{formatarTelefone(l.telefone) || l.telefone}</span>}
                  <span className="text-xs text-texto-2">
                    {formatarDataHora(l.quando)} · {l.origem}
                    {l.motivo ? ` · ${l.motivo}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        <Chaves chaves={chaves} />
        <Webhooks webhooks={webhooks} />

        <Cartao>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Últimos avisos</h2>
              <p className="text-sm text-texto-2">O que aconteceu no sistema e se cada aviso chegou ao agente. O agente também pode buscar estes avisos pela API.</p>
            </div>
            <FilaAvisos />
          </div>
          {eventos.length === 0 ? (
            <p className="text-sm text-texto-2">Nenhum aviso ainda. Eles aparecem quando chega um lead, uma proposta é aprovada, e assim por diante.</p>
          ) : (
            <ul className="divide-y divide-borda text-sm">
              {eventos.map((e) => {
                const es = entregas.filter((x) => x.evento_id === e.id);
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="num w-12 shrink-0 text-xs text-texto-2">nº {e.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{nomeAviso(e.tipo)}</span>
                      <span className="block text-xs text-texto-2">
                        {formatarDataHora(e.created_at)}
                        {e.negocio_id ? (
                          <>
                            {" · "}
                            <Link href={`/negocios/${e.negocio_id}`} className="underline hover:text-marca-forte">
                              ver negócio
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </span>
                    {es.length === 0 ? (
                      <Selo>só na fila de consulta</Selo>
                    ) : (
                      es.map((x) => (
                        <Selo key={x.id} cor={ENTREGA[x.status].cor} title={x.erro ?? undefined}>
                          {ENTREGA[x.status].nome}
                          {x.http_status ? ` (${x.http_status})` : ""}
                          {x.tentativas > 1 ? ` · ${x.tentativas}ª tentativa` : ""}
                        </Selo>
                      ))
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <ScrollText className="size-5 text-marca-forte" aria-hidden /> Registro do agente
          </h2>
          <p className="mb-3 text-sm text-texto-2">
            Cada chamada feita com uma chave, inclusive as recusadas. As alterações em contatos, negócios e propostas aparecem também em{" "}
            <Link href="/auditoria?autor=agente" className="font-medium text-marca-forte underline">
              Auditoria
            </Link>
            .
          </p>
          {log.length === 0 ? (
            <p className="text-sm text-texto-2">Nenhuma chamada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-borda text-left text-xs tracking-wider text-texto-2 uppercase">
                    <th scope="col" className="py-2 pr-3 font-bold">Quando</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Ação</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Resultado</th>
                    <th scope="col" className="py-2 font-bold">Chave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {log.map((l) => (
                    <tr key={l.id}>
                      <td className="num py-1.5 pr-3 whitespace-nowrap text-texto-2">{formatarDataHora(l.created_at)}</td>
                      <td className="py-1.5 pr-3">
                        <code className="text-xs">{l.acao}</code>
                        {(l.resumo || l.erro) && <span className="block text-xs text-texto-2">{l.ok ? l.resumo : l.erro}</span>}
                      </td>
                      <td className="py-1.5 pr-3">
                        <Selo cor={l.ok ? "ok" : l.status === 429 ? "alerta" : "perigo"}>{l.ok ? "feito" : `recusado (${l.status})`}</Selo>
                      </td>
                      <td className="py-1.5 text-xs text-texto-2">{l.chave_id ? (nomeChave.get(l.chave_id) ?? "chave removida") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}
