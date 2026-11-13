/**
 * TAREFAS (follow-ups): atrasadas, hoje, próximas e concluídas (últimos 30 dias).
 * (A agenda de EVENTOS, com as datas das festas, fica em /eventos.)
 * O gestor (ou com "vendedores veem tudo") filtra por vendedor.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { BotaoAtividade } from "@/components/comercial/botao-atividade";
import { Filtros } from "@/components/comercial/filtros";
import { ListaAtividades } from "@/components/comercial/lista-atividades";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { somarDias } from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { agoraServidor, listarVendedores, nomesClientes } from "@/lib/dados";
import { hojeISO } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Atividade } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tarefas" };

const ABAS = [
  { id: "atrasadas", nome: "Atrasadas" },
  { id: "hoje", nome: "Hoje" },
  { id: "proximas", nome: "Próximas" },
  { id: "concluidas", nome: "Concluídas" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export default async function PaginaAgenda({ searchParams }: { searchParams: Promise<{ ver?: string; vendedor?: string }> }) {
  const sp = await searchParams;
  const [{ perfil }, config, vendedores] = await Promise.all([obterPerfil(), obterConfiguracoes(), listarVendedores()]);
  const gestor = ehGestor(perfil);
  const veTime = gestor || config.vendedores_veem_tudo;
  // padrão: só as minhas (mesmo para o gestor); "todos" mostra o time
  const vendedor = veTime ? (sp.vendedor === "todos" ? "" : vendedores.some((v) => v.id === sp.vendedor) ? sp.vendedor! : (perfil?.id ?? "")) : "";
  const hoje = hojeISO();
  const ini = `${hoje}T00:00:00-03:00`;
  const fim = `${somarDias(hoje, 1)}T00:00:00-03:00`;

  const supabase = await createClient();
  const base = () => {
    let q = supabase.from("atividades").select("*", { count: "exact" });
    if (vendedor) q = q.eq("vendedor_id", vendedor);
    return q;
  };
  const [atrasadas, deHoje, proximas, concluidas] = await Promise.all([
    base().eq("concluida", false).lt("quando", ini).order("quando").limit(200),
    base().eq("concluida", false).gte("quando", ini).lt("quando", fim).order("quando").limit(200),
    base().eq("concluida", false).gte("quando", fim).order("quando").limit(200),
    base().eq("concluida", true).gte("concluida_em", `${somarDias(hoje, -30)}T00:00:00-03:00`).order("concluida_em", { ascending: false }).limit(200),
  ]);
  const listas: Record<Aba, { data: Atividade[] | null; count: number | null }> = {
    atrasadas: atrasadas as never,
    hoje: deHoje as never,
    proximas: proximas as never,
    concluidas: concluidas as never,
  };
  const padrao: Aba = (atrasadas.count ?? 0) > 0 && !(deHoje.count ?? 0) ? "atrasadas" : "hoje";
  const aba: Aba = ABAS.some((a) => a.id === sp.ver) ? (sp.ver as Aba) : padrao;
  const atividades = (listas[aba].data ?? []) as Atividade[];

  const idsNeg = Array.from(new Set(atividades.map((a) => a.negocio_id).filter((x): x is string => Boolean(x))));
  const [negR, nomes, abertosR] = await Promise.all([
    idsNeg.length ? supabase.from("negocios").select("id, titulo").in("id", idsNeg) : Promise.resolve({ data: [] }),
    nomesClientes({ contatos: atividades.map((a) => a.contato_id), empresas: [] }),
    supabase.from("negocios").select("id, titulo").eq("status", "aberto").order("titulo").limit(500),
  ]);
  const nomeNegocio = Object.fromEntries((negR.data ?? []).map((n) => [n.id, n.titulo]));
  const nomeContato = Object.fromEntries([...nomes.contatos.values()].map((c) => [c.id, c.nome]));
  const opVend = vendedores.filter((v) => v.ativo).map((v) => ({ id: v.id, nome: v.nome }));
  const qs = (ver: string) => `/agenda?${new URLSearchParams({ ver, ...(veTime ? { vendedor: vendedor || "todos" } : {}) })}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Tarefas"
        descricao="Ligações, reuniões, visitas e tarefas. Toque no círculo para concluir."
        acoes={
          <BotaoAtividade
            negocios={(abertosR.data ?? []).map((n) => ({ id: n.id, nome: n.titulo }))}
            vendedores={gestor ? opVend : undefined}
            flutuante
          />
        }
      />
      {veTime && (
        <Filtros
          acao="/agenda"
          campos={[
            { tipo: "oculto", nome: "ver", valor: aba },
            { nome: "vendedor", rotulo: "De quem", valor: vendedor || "todos", opcoes: [{ id: "todos", nome: "Todo o time" }, ...opVend] },
          ]}
        />
      )}
      <nav aria-label="Filtro da agenda" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {ABAS.map((a) => {
          const n = listas[a.id].count ?? 0;
          const ativo = a.id === aba;
          return (
            <Link
              key={a.id}
              href={qs(a.id)}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                ativo ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie text-texto hover:bg-superficie-2",
              )}
            >
              {a.nome}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  ativo ? "bg-white/25" : a.id === "atrasadas" && n > 0 ? "bg-perigo-suave text-perigo" : "bg-superficie-2 text-texto-2",
                )}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </nav>
      <ListaAtividades
        atividades={atividades}
        agora={agoraServidor()}
        hoje={hoje}
        meuId={perfil?.id ?? null}
        gestor={gestor}
        negocios={nomeNegocio}
        contatos={nomeContato}
        vendedores={opVend}
        mostrarVendedor={veTime && !vendedor}
        vazio={
          aba === "atrasadas"
            ? "Nenhuma atividade atrasada. Muito bem!"
            : aba === "hoje"
              ? "Nada para hoje. Que tal agendar um follow-up nos negócios parados?"
              : aba === "proximas"
                ? "Nenhuma atividade futura agendada."
                : "Nenhuma atividade concluída nos últimos 30 dias."
        }
      />
    </>
  );
}
