/**
 * CONTATOS (leads e clientes): busca, filtros por etiqueta/origem/responsável,
 * botão WhatsApp em cada um, cadastro e importação por CSV.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Download, Upload, Users } from "lucide-react";
import { BotaoCadastro } from "@/components/comercial/botao-cadastro";
import { Filtros } from "@/components/comercial/filtros";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Selo } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { mapaNomes, opcoesCadastro } from "@/lib/dados";
import { formatarTelefone, iniciais } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { linkWhatsApp } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Contatos" };
const POR_PAGINA = 50;

export default async function PaginaContatos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; origem?: string; responsavel?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const { perfil } = await obterPerfil();
  const [config, opcoes] = await Promise.all([obterConfiguracoes(), opcoesCadastro(perfil)]);
  const veTime = ehGestor(perfil) || config.vendedores_veem_tudo;
  const q = (sp.q ?? "").trim().slice(0, 60).replace(/[%_,()]/g, " ");
  const tag = (sp.tag ?? "").trim().slice(0, 30);
  const origem = opcoes.origens.some((o) => o.id === sp.origem) ? sp.origem! : "";
  const responsavel = veTime && opcoes.vendedores.some((v) => v.id === sp.responsavel) ? sp.responsavel! : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const supabase = await createClient();
  let consulta = supabase.from("contatos").select("*", { count: "exact" });
  if (q) {
    const dig = q.replace(/\D/g, "");
    consulta = consulta.or(
      [`nome.ilike.%${q}%`, `email.ilike.%${q}%`, `cargo.ilike.%${q}%`, ...(dig.length >= 4 ? [`telefone.ilike.%${dig}%`] : [])].join(","),
    );
  }
  if (tag) consulta = consulta.contains("tags", [tag]);
  if (origem) consulta = consulta.eq("origem_id", origem);
  if (responsavel) consulta = consulta.eq("responsavel_id", responsavel);
  const { data, count } = await consulta.order("nome").order("id").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  const contatos = data ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const nomeEmpresa = mapaNomes(opcoes.empresas);
  const nomeVendedor = mapaNomes(opcoes.vendedores);
  const nomeOrigem = mapaNomes(opcoes.origens);
  const params = { q, tag, origem, responsavel };
  const link = (n: number) => `/contatos?${new URLSearchParams({ ...params, pagina: String(n) })}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Contatos"
        descricao={`${total} contato(s)${veTime ? "" : " seus"}.`}
        acoes={
          <>
            <Link href="/contatos/importar" className={classesBotao("secundario")}>
              <Upload className="size-4" aria-hidden /> Importar CSV
            </Link>
            <a href={`/relatorios/exportar?${new URLSearchParams({ tipo: "contatos", ...params })}`} className={classesBotao("secundario")}>
              <Download className="size-4" aria-hidden /> Exportar
            </a>
            <BotaoCadastro tipo="contato" opcoes={opcoes} flutuante />
          </>
        }
      />
      <Filtros
        acao="/contatos"
        limpar
        campos={[
          { tipo: "texto", nome: "q", rotulo: "Buscar", valor: q, placeholder: "Nome, e-mail, telefone" },
          { tipo: "texto", nome: "tag", rotulo: "Etiqueta", valor: tag, placeholder: "Ex.: Decisor" },
          { nome: "origem", rotulo: "Origem", valor: origem, todos: "Todas", opcoes: opcoes.origens },
          ...(veTime ? [{ nome: "responsavel", rotulo: "Responsável", valor: responsavel, todos: "Todos", opcoes: opcoes.vendedores }] : []),
        ]}
      />

      {contatos.length === 0 ? (
        <EstadoVazio
          icone={Users}
          titulo={q || tag || origem ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
          descricao="Cadastre seus leads um a um ou importe uma planilha (CSV) com nome, e-mail, telefone e empresa."
        />
      ) : (
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
          {contatos.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-marca-suave text-xs font-bold text-marca-forte">
                {iniciais(c.nome)}
              </span>
              <Link href={`/contatos/${c.id}`} className="min-w-0 flex-1 py-1 hover:text-marca-forte">
                <span className="block truncate font-semibold">{c.nome}</span>
                <span className="block truncate text-xs text-texto-2">
                  {[c.cargo, c.empresa_id ? nomeEmpresa.get(c.empresa_id) : "Pessoa física", formatarTelefone(c.telefone)].filter(Boolean).join(" · ")}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {c.origem_id && nomeOrigem.get(c.origem_id) && <Selo>{nomeOrigem.get(c.origem_id)}</Selo>}
                  {c.tags.slice(0, 3).map((t) => (
                    <Selo key={t} cor="marca">
                      {t}
                    </Selo>
                  ))}
                  {veTime && c.responsavel_id && <span className="text-xs text-texto-2">{nomeVendedor.get(c.responsavel_id)}</span>}
                </span>
              </Link>
              {c.telefone && (
                <a
                  href={linkWhatsApp(c.telefone, `Olá, ${c.nome.split(" ")[0]}! Aqui é ${perfil?.nome ?? ""}, da ${config.nome_negocio}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${c.nome}`}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-whats hover:bg-superficie-2"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
                  </svg>
                </a>
              )}
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
