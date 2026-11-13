/**
 * PROPOSTAS: todas as propostas visíveis, com filtro por situação.
 * O gestor vê no topo as que aguardam a aprovação dele (nenhuma proposta sai sem ela).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Filtros } from "@/components/comercial/filtros";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Selo } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { STATUS_PROPOSTA, moedaInteira } from "@/lib/comercial";
import { listarVendedores } from "@/lib/dados";
import { formatarData, hojeISO } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Proposta, StatusProposta } from "@/lib/tipos";

export const metadata: Metadata = { title: "Propostas" };
const POR_PAGINA = 50;

export default async function PaginaPropostas({ searchParams }: { searchParams: Promise<{ status?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const status = (Object.keys(STATUS_PROPOSTA) as StatusProposta[]).includes(sp.status as StatusProposta) ? (sp.status as StatusProposta) : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const supabase = await createClient();
  const [{ perfil }, vendedores] = await Promise.all([obterPerfil(), listarVendedores()]);
  let q = supabase.from("propostas").select("*", { count: "exact" });
  if (status) q = q.eq("status", status);
  else q = q.neq("status", "substituida");
  const [{ data, count }, aguardando] = await Promise.all([
    q.order("created_at", { ascending: false }).order("id").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    ehGestor(perfil)
      ? supabase.from("propostas").select("id", { count: "exact", head: true }).eq("status", "aguardando_aprovacao")
      : Promise.resolve({ count: 0 }),
  ]);
  const propostas = (data ?? []) as Proposta[];
  const ids = Array.from(new Set(propostas.map((p) => p.negocio_id)));
  const { data: negocios } = ids.length ? await supabase.from("negocios").select("id, titulo").in("id", ids) : { data: [] };
  const titulo = new Map((negocios ?? []).map((n) => [n.id, n.titulo]));
  const nomeVendedor = new Map(vendedores.map((v) => [v.id, v.nome]));
  const hoje = hojeISO();
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (n: number) => `/propostas?${new URLSearchParams({ status, pagina: String(n) })}`;

  return (
    <>
      <CabecalhoPagina titulo="Propostas" descricao="Crie propostas a partir de um negócio (botão “Nova proposta” na tela do negócio)." />
      {(aguardando.count ?? 0) > 0 && status !== "aguardando_aprovacao" && (
        <Link
          href="/propostas?status=aguardando_aprovacao"
          className="mb-4 flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-alerta-forte bg-alerta-suave px-4 py-3 text-sm font-semibold text-alerta"
        >
          {aguardando.count === 1 ? "1 proposta aguardando" : `${aguardando.count} propostas aguardando`} sua aprovação <span aria-hidden>→</span>
        </Link>
      )}
      <Filtros
        acao="/propostas"
        limpar
        campos={[
          {
            nome: "status",
            rotulo: "Situação",
            valor: status,
            todos: "Todas (menos substituídas)",
            opcoes: Object.entries(STATUS_PROPOSTA).map(([id, s]) => ({ id, nome: s.nome })),
          },
        ]}
      />
      {propostas.length === 0 ? (
        <EstadoVazio icone={FileText} titulo="Nenhuma proposta" descricao="Abra um negócio e clique em “Nova proposta”." />
      ) : (
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
          {propostas.map((p) => {
            const expirada = p.status === "enviada" && p.validade < hoje;
            return (
              <li key={p.id}>
                <Link href={`/propostas/${p.id}`} className="flex min-h-16 flex-col gap-1 px-4 py-3 hover:bg-superficie-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {p.numero} · v{p.versao} <span className="font-normal text-texto-2">— {titulo.get(p.negocio_id) ?? p.titulo}</span>
                    </span>
                    <span className="block text-xs text-texto-2">
                      {p.pacote_nome ? `${p.pacote_nome} · ` : ""}
                      {p.origem === "agente" ? "montada pelo agente" : (nomeVendedor.get(p.vendedor_id ?? "") ?? "—")} · criada {formatarData(p.created_at)}
                      {p.validade ? ` · válida até ${formatarData(p.validade)}` : ""}
                      {p.visualizada_em ? ` · cliente abriu ${p.visualizacoes}x` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="num font-bold">{p.preco_pendente || Number(p.total) === 0 ? "valor a definir" : moedaInteira(p.total)}</span>
                    {expirada ? <Selo cor="alerta">Expirada</Selo> : <Selo cor={STATUS_PROPOSTA[p.status].cor}>{STATUS_PROPOSTA[p.status].nome}</Selo>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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
  );
}
