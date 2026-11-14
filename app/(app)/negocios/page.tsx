/**
 * NEGÓCIOS em lista (inclui ganhos e perdidos), com filtros, paginação e exportação CSV.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Download, Handshake } from "lucide-react";
import { Filtros } from "@/components/comercial/filtros";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Selo } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { PERIODOS, STATUS_NEGOCIO, lerPeriodo, moedaInteira } from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { listarFunis, listarVendedores, nomesClientes } from "@/lib/dados";
import { formatarData } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { StatusNegocio } from "@/lib/tipos";

export const metadata: Metadata = { title: "Negócios" };

const POR_PAGINA = 50;

export default async function PaginaNegocios({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; funil?: string; vendedor?: string; q?: string; periodo?: string; de?: string; ate?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const [{ perfil }, config, funis, vendedores] = await Promise.all([obterPerfil(), obterConfiguracoes(), listarFunis(), listarVendedores()]);
  const veTime = ehGestor(perfil) || config.vendedores_veem_tudo;
  const status = (["aberto", "ganho", "perdido"] as const).includes(sp.status as StatusNegocio) ? (sp.status as StatusNegocio) : "";
  const funil = funis.some((f) => f.id === sp.funil) ? sp.funil! : "";
  const vendedor = veTime && vendedores.some((v) => v.id === sp.vendedor) ? sp.vendedor! : "";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const usaPeriodo = Boolean(sp.periodo);
  const { periodo, de, ate } = lerPeriodo(sp);
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const supabase = await createClient();
  let consulta = supabase.from("negocios").select("*", { count: "exact" });
  if (status) consulta = consulta.eq("status", status);
  if (funil) consulta = consulta.eq("funil_id", funil);
  if (vendedor) consulta = consulta.eq("vendedor_id", vendedor);
  // busca pelo título ou pelo código do pedido (a "Ref." que vem na mensagem do WhatsApp)
  if (q) {
    const termo = q.replace(/[%_,()]/g, " ").trim();
    const codigo = termo.replace(/^ref\.?\s*/i, "").toUpperCase();
    consulta = /^[A-Z0-9]{4,10}$/.test(codigo) ? consulta.or(`titulo.ilike.%${termo}%,codigo.eq.${codigo}`) : consulta.ilike("titulo", `%${termo}%`);
  }
  if (usaPeriodo) consulta = consulta.gte("created_at", `${de}T00:00:00-03:00`).lte("created_at", `${ate}T23:59:59.999-03:00`);
  const { data, count } = await consulta
    .order("created_at", { ascending: false })
    .order("id")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  const negocios = data ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const nomes = await nomesClientes({ contatos: negocios.map((n) => n.contato_id), empresas: negocios.map((n) => n.empresa_id) });
  const nomeEtapa = new Map(funis.flatMap((f) => f.etapas).map((e) => [e.id, e.nome]));
  const nomeVendedor = new Map(vendedores.map((v) => [v.id, v.nome]));

  const params = { status, funil, vendedor, q, ...(usaPeriodo ? { periodo, de, ate } : {}) };
  const link = (n: number) => `/negocios?${new URLSearchParams({ ...params, pagina: String(n) })}`;
  const linkCsv = `/relatorios/exportar?${new URLSearchParams({ tipo: "negocios", ...params })}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Negócios"
        descricao={`${total} negócio(s)${veTime ? "" : " seus"}. Toque para abrir.`}
        acoes={
          <a href={linkCsv} className={classesBotao("secundario")}>
            <Download className="size-4" aria-hidden /> Exportar CSV
          </a>
        }
      />
      <Filtros
        acao="/negocios"
        limpar
        campos={[
          { tipo: "texto", nome: "q", rotulo: "Buscar", valor: q, placeholder: "Nome ou Ref. do pedido" },
          {
            nome: "status",
            rotulo: "Situação",
            valor: status,
            todos: "Todas",
            opcoes: Object.entries(STATUS_NEGOCIO).map(([id, s]) => ({ id, nome: s.nome })),
          },
          ...(funis.length > 1 ? [{ nome: "funil", rotulo: "Funil", valor: funil, todos: "Todos", opcoes: funis.map((f) => ({ id: f.id, nome: f.nome })) }] : []),
          ...(veTime
            ? [{ nome: "vendedor", rotulo: "Responsável", valor: vendedor, todos: "Todos", opcoes: vendedores.map((v) => ({ id: v.id, nome: v.nome })) }]
            : []),
          {
            nome: "periodo",
            rotulo: "Criado em",
            valor: usaPeriodo ? periodo : "",
            todos: "Qualquer data",
            opcoes: PERIODOS.filter((p) => p.id !== "personalizado").map((p) => ({ id: p.id, nome: p.nome })),
          },
        ]}
      />

      {negocios.length === 0 ? (
        <EstadoVazio icone={Handshake} titulo="Nenhum negócio encontrado" descricao="Mude os filtros ou crie negócios no Funil." />
      ) : (
        <>
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
            {negocios.map((n) => {
              const cliente = (n.empresa_id && nomes.empresas.get(n.empresa_id)) || (n.contato_id && nomes.contatos.get(n.contato_id)?.nome) || "Sem cliente";
              return (
                <li key={n.id}>
                  <Link href={`/negocios/${n.id}`} className="flex min-h-16 flex-col gap-1 px-4 py-3 hover:bg-superficie-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{n.titulo}</span>
                      <span className="block truncate text-xs text-texto-2">
                        {cliente} · {nomeEtapa.get(n.etapa_id) ?? "—"}
                        {veTime ? ` · ${nomeVendedor.get(n.vendedor_id) ?? ""}` : ""} · criado {formatarData(n.created_at)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="num font-bold">{moedaInteira(n.valor)}</span>
                      <Selo cor={STATUS_NEGOCIO[n.status].cor}>{STATUS_NEGOCIO[n.status].nome}</Selo>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {paginas > 1 && (
            <nav aria-label="Páginas" className="mt-4 flex items-center justify-center gap-2">
              {pagina > 1 && (
                <Link href={link(pagina - 1)} className={classesBotao("secundario")}>
                  Anterior
                </Link>
              )}
              <span className="text-sm text-texto-2">
                Página {pagina} de {paginas}
              </span>
              {pagina < paginas && (
                <Link href={link(pagina + 1)} className={classesBotao("secundario")}>
                  Próxima
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
