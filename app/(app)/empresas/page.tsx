/** EMPRESAS (pessoa jurídica): busca, segmento, responsável e nº de contatos/negócios. */
import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { BotaoCadastro } from "@/components/comercial/botao-cadastro";
import { Filtros } from "@/components/comercial/filtros";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Selo } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { mapaNomes, opcoesCadastro } from "@/lib/dados";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Empresas" };
const POR_PAGINA = 48;

export default async function PaginaEmpresas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; responsavel?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const { perfil } = await obterPerfil();
  const [config, opcoes] = await Promise.all([obterConfiguracoes(), opcoesCadastro(perfil)]);
  const veTime = ehGestor(perfil) || config.vendedores_veem_tudo;
  const q = (sp.q ?? "").trim().slice(0, 60).replace(/[%_,()]/g, " ");
  const responsavel = veTime && opcoes.vendedores.some((v) => v.id === sp.responsavel) ? sp.responsavel! : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const supabase = await createClient();
  let consulta = supabase.from("empresas").select("*", { count: "exact" });
  if (q) consulta = consulta.or(`nome.ilike.%${q}%,segmento.ilike.%${q}%,cidade.ilike.%${q}%`);
  if (responsavel) consulta = consulta.eq("responsavel_id", responsavel);
  const { data, count } = await consulta.order("nome").order("id").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  const empresas = data ?? [];
  const ids = empresas.map((e) => e.id);
  const [negs, ctts] = ids.length
    ? await Promise.all([
        supabase.from("negocios").select("empresa_id, status").in("empresa_id", ids),
        supabase.from("contatos").select("empresa_id").in("empresa_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const abertos = new Map<string, number>();
  for (const n of negs.data ?? []) if (n.status === "aberto" && n.empresa_id) abertos.set(n.empresa_id, (abertos.get(n.empresa_id) ?? 0) + 1);
  const qtdContatos = new Map<string, number>();
  for (const c of ctts.data ?? []) if (c.empresa_id) qtdContatos.set(c.empresa_id, (qtdContatos.get(c.empresa_id) ?? 0) + 1);
  const nomeVendedor = mapaNomes(opcoes.vendedores);
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (n: number) => `/empresas?${new URLSearchParams({ q, responsavel, pagina: String(n) })}`;

  return (
    <>
      <CabecalhoPagina titulo="Empresas" descricao={`${total} empresa(s).`} acoes={<BotaoCadastro tipo="empresa" opcoes={opcoes} flutuante />} />
      <Filtros
        acao="/empresas"
        limpar
        campos={[
          { tipo: "texto", nome: "q", rotulo: "Buscar", valor: q, placeholder: "Nome, segmento ou cidade" },
          ...(veTime ? [{ nome: "responsavel", rotulo: "Responsável", valor: responsavel, todos: "Todos", opcoes: opcoes.vendedores }] : []),
        ]}
      />
      {empresas.length === 0 ? (
        <EstadoVazio icone={Building2} titulo="Nenhuma empresa" descricao="Cadastre as empresas clientes e ligue os contatos a elas." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {empresas.map((e) => (
            <li key={e.id}>
              <Link href={`/empresas/${e.id}`} className="block h-full rounded-2xl border border-borda bg-superficie p-4 shadow-sm hover:border-marca/50">
                <p className="font-semibold">{e.nome}</p>
                <p className="text-sm text-texto-2">
                  {[e.segmento, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ""}`].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-texto-2">
                  <Selo>{qtdContatos.get(e.id) ?? 0} contato(s)</Selo>
                  {(abertos.get(e.id) ?? 0) > 0 && <Selo cor="info">{abertos.get(e.id)} em aberto</Selo>}
                  {e.tags.slice(0, 2).map((t) => (
                    <Selo key={t} cor="marca">
                      {t}
                    </Selo>
                  ))}
                  {veTime && e.responsavel_id && <span>{nomeVendedor.get(e.responsavel_id)}</span>}
                </p>
              </Link>
            </li>
          ))}
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
