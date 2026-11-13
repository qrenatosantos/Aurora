/**
 * FUNIL (kanban): negócios EM ABERTO do funil escolhido, por etapa.
 * Filtros pela URL: ?funil= &vendedor= &tag= &criado= (dias) &previsao=
 */
import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import Link from "next/link";
import { Filtros } from "@/components/comercial/filtros";
import { Quadro, type CardFunil } from "@/components/comercial/quadro";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { fimMes, inicioMes, somarDias } from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { agoraServidor, listarMotivosPerda, nomesClientes, opcoesNegocio } from "@/lib/dados";
import { hojeISO } from "@/lib/formatar";
import { todasAsLinhas } from "@/lib/paginar";
import { obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Negocio } from "@/lib/tipos";

export const metadata: Metadata = { title: "Funil" };

const CRIADO = [
  { id: "", nome: "Qualquer data" },
  { id: "7", nome: "Últimos 7 dias" },
  { id: "30", nome: "Últimos 30 dias" },
  { id: "90", nome: "Últimos 90 dias" },
];
const PREVISAO = [
  { id: "", nome: "Qualquer previsão" },
  { id: "mes", nome: "Fecha este mês" },
  { id: "atrasada", nome: "Previsão vencida" },
  { id: "sem", nome: "Sem previsão" },
];

export default async function PaginaFunil({
  searchParams,
}: {
  searchParams: Promise<{ funil?: string; vendedor?: string; tag?: string; criado?: string; previsao?: string }>;
}) {
  const sp = await searchParams;
  const { perfil } = await obterPerfil();
  const [config, opcoes, motivos] = await Promise.all([obterConfiguracoes(), opcoesNegocio(perfil), listarMotivosPerda()]);
  const funisAtivos = opcoes.funis.filter((f) => f.ativo);
  const funil = funisAtivos.find((f) => f.id === sp.funil) ?? funisAtivos[0];
  const gestor = opcoes.gestor;
  const veTime = gestor || config.vendedores_veem_tudo;

  if (!funil) {
    return (
      <>
        <CabecalhoPagina titulo="Funil" />
        <EstadoVazio
          titulo="Nenhum funil cadastrado"
          descricao={gestor ? "Crie o seu funil de vendas e as etapas em Configurações ▸ Funis." : "Peça ao gestor para criar o funil de vendas."}
          acao={
            gestor ? (
              <Link href="/configuracoes/funis" className={classesBotao()}>
                Criar funil
              </Link>
            ) : undefined
          }
        />
      </>
    );
  }

  const hoje = hojeISO();
  const supabase = await createClient();
  const vendedorFiltro = veTime && sp.vendedor && opcoes.vendedores.some((v) => v.id === sp.vendedor) ? sp.vendedor : "";
  const tag = (sp.tag ?? "").trim().slice(0, 30);

  const negocios = await todasAsLinhas<Negocio>((de, ate) => {
    let q = supabase.from("negocios").select("*").eq("funil_id", funil.id).eq("status", "aberto");
    if (vendedorFiltro) q = q.eq("vendedor_id", vendedorFiltro);
    if (tag) q = q.contains("tags", [tag]);
    if (["7", "30", "90"].includes(sp.criado ?? "")) q = q.gte("created_at", `${somarDias(hoje, -Number(sp.criado))}T00:00:00-03:00`);
    if (sp.previsao === "mes") q = q.gte("previsao_fechamento", inicioMes(hoje)).lte("previsao_fechamento", fimMes(hoje));
    else if (sp.previsao === "atrasada") q = q.lt("previsao_fechamento", hoje);
    else if (sp.previsao === "sem") q = q.is("previsao_fechamento", null);
    return q.order("created_at").order("id").range(de, ate);
  });

  // Próxima atividade (pendente) de cada negócio + nomes dos clientes
  const ids = new Set(negocios.map((n) => n.id));
  const [pendentes, nomes] = await Promise.all([
    todasAsLinhas<{ negocio_id: string | null; quando: string; titulo: string }>((de, ate) =>
      supabase
        .from("atividades")
        .select("negocio_id, quando, titulo")
        .eq("concluida", false)
        .not("negocio_id", "is", null)
        .order("quando")
        .order("id")
        .range(de, ate),
    ),
    nomesClientes({ contatos: negocios.map((n) => n.contato_id), empresas: negocios.map((n) => n.empresa_id) }),
  ]);
  const proxima = new Map<string, { quando: string; titulo: string }>();
  for (const a of pendentes) if (a.negocio_id && ids.has(a.negocio_id) && !proxima.has(a.negocio_id)) proxima.set(a.negocio_id, a);

  const cards: CardFunil[] = negocios.map((n) => ({
    ...n,
    empresaNome: n.empresa_id ? (nomes.empresas.get(n.empresa_id) ?? null) : null,
    contatoNome: n.contato_id ? (nomes.contatos.get(n.contato_id)?.nome ?? null) : null,
    proxima: proxima.get(n.id) ?? null,
  }));

  // tags existentes (para o filtro)
  const tags = Array.from(new Set(negocios.flatMap((n) => n.tags))).sort();
  if (tag && !tags.includes(tag)) tags.unshift(tag);

  const { data: listaVendedores } = await supabase.from("vendedores").select("id, nome, cor");
  const vendedores = Object.fromEntries((listaVendedores ?? []).map((v) => [v.id, { nome: v.nome, cor: v.cor }]));

  return (
    <>
      <CabecalhoPagina
        titulo="Funil de vendas"
        descricao={gestor ? "Todos os negócios em aberto do time." : veTime ? "Negócios do time (você edita os seus)." : "Seus negócios em aberto."}
        acoes={
          gestor ? (
            <Link href="/configuracoes/funis" className={classesBotao("fantasma")}>
              <Settings2 className="size-4" aria-hidden /> Etapas
            </Link>
          ) : undefined
        }
      />
      <Filtros
        acao="/funil"
        limpar
        campos={[
          { nome: "funil", rotulo: "Funil", valor: funil.id, opcoes: funisAtivos.map((f) => ({ id: f.id, nome: f.nome })) },
          ...(veTime
            ? [{ nome: "vendedor", rotulo: "Vendedor", valor: vendedorFiltro, todos: "Todos", opcoes: opcoes.vendedores }]
            : []),
          { nome: "tag", rotulo: "Etiqueta", valor: tag, todos: "Todas", opcoes: tags.map((t) => ({ id: t, nome: t })) },
          { nome: "criado", rotulo: "Criado em", valor: sp.criado ?? "", opcoes: CRIADO },
          { nome: "previsao", rotulo: "Previsão", valor: sp.previsao ?? "", opcoes: PREVISAO },
        ]}
      />
      <Quadro
        key={funil.id}
        etapas={funil.etapas}
        negocios={cards}
        opcoes={opcoes}
        motivos={motivos}
        diasParado={config.dias_sem_contato}
        agora={agoraServidor()}
        hoje={hoje}
        vendedores={vendedores}
        mostrarVendedor={veTime}
      />
    </>
  );
}
