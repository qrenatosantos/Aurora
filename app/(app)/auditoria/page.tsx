/**
 * AUDITORIA: quem criou, alterou ou excluiu o quê, e quando.
 * Preenchida SÓ pelo banco (gatilhos) — ninguém edita nem apaga pelo app.
 * O gestor vê tudo; os vendedores, as próprias ações.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { Filtros } from "@/components/comercial/filtros";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Selo } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { dataValida, somarDias } from "@/lib/comercial";
import { formatarDataHora, hojeISO } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditoria" };

const NOME_TABELA: Record<string, string> = {
  negocios: "Negócio",
  propostas: "Proposta",
  comissoes: "Comissão",
  metas: "Meta",
  regras_comissao: "Regra de comissão",
  vendedores: "Vendedor",
  equipes: "Equipe",
  configuracoes: "Configurações",
  produtos: "Produto",
  funis: "Funil",
  etapas: "Etapa",
  contatos: "Contato",
  empresas: "Empresa",
  motivos_perda: "Motivo de perda",
  origens: "Origem",
  modelos_mensagem: "Modelo de mensagem",
};
const COR_ACAO = { criou: "ok", alterou: "info", excluiu: "perigo" } as const;

export default async function PaginaAuditoria({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; tabela?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const de = dataValida(sp.de) ? sp.de : somarDias(hoje, -30);
  const ate = dataValida(sp.ate) ? sp.ate : hoje;
  const tabela = sp.tabela && NOME_TABELA[sp.tabela] ? sp.tabela : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const POR_PAGINA = 100;

  const supabase = await createClient();
  let consulta = supabase
    .from("auditoria")
    .select("*", { count: "exact" })
    .gte("created_at", `${de}T00:00:00-03:00`)
    .lt("created_at", `${somarDias(ate, 1)}T00:00:00-03:00`)
    .order("created_at", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (tabela) consulta = consulta.eq("tabela", tabela);
  const [{ perfil }, { data: registros, count }] = await Promise.all([obterPerfil(), consulta]);
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (n: number) => `/auditoria?${new URLSearchParams({ de, ate, tabela, pagina: String(n) })}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Auditoria"
        descricao={ehGestor(perfil) ? "Registro automático das alterações importantes (negócios, propostas, comissões, metas, cadastros)." : "Suas ações registradas."}
      />
      <Filtros
        acao="/auditoria"
        campos={[
          { tipo: "data", nome: "de", rotulo: "De", valor: de },
          { tipo: "data", nome: "ate", rotulo: "Até", valor: ate },
          { nome: "tabela", rotulo: "O quê", valor: tabela, todos: "Tudo", opcoes: Object.entries(NOME_TABELA).map(([id, nome]) => ({ id, nome })) },
        ]}
      />
      {!registros?.length ? (
        <EstadoVazio icone={History} titulo="Nada no período" descricao="Mude as datas ou o filtro." />
      ) : (
        <>
          <p className="mb-2 text-sm text-texto-2">{total} registro(s)</p>
          <ol className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
            {registros.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-36 shrink-0 text-xs text-texto-2">{formatarDataHora(r.created_at)}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <strong className="text-texto">{r.autor}</strong> <Selo cor={COR_ACAO[r.acao]}>{r.acao}</Selo>{" "}
                  <span className="text-texto">{NOME_TABELA[r.tabela] ?? r.tabela}</span>
                  {r.descricao && <span className="text-texto-2"> &quot;{r.descricao}&quot;</span>}
                  {r.campos?.length ? <span className="text-texto-2"> ({r.campos.join(", ")})</span> : null}
                  {r.negocio_id && r.acao !== "excluiu" && (
                    <Link href={`/negocios/${r.negocio_id}`} className="ml-1 text-xs font-medium text-marca-forte underline">
                      abrir negócio
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
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
