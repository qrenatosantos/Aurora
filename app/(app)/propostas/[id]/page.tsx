/**
 * PROPOSTA: editor (enquanto pode ser alterada), fluxo de aprovação do gestor, envio,
 * link público, versões, histórico de decisões e o documento no padrão da Aurora (PDF).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Eye, Link2 } from "lucide-react";
import { DocumentoAurora } from "@/components/aurora/documento-aurora";
import { Cartao, Selo } from "@/components/ui/cartao";
import { resumoEvento } from "@/lib/aurora";
import { STATUS_PROPOSTA } from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { listarDrinks, listarModelos, listarVendedores } from "@/lib/dados";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { obterMarca } from "@/lib/marca-servidor";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { urlDoSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Proposta, PropostaItem, PropostaRevisao } from "@/lib/tipos";
import { AcoesProposta } from "./acoes-proposta";
import { EditorProposta } from "./editor-proposta";

export const metadata: Metadata = { title: "Proposta" };

const AUTOR = { humano: "equipe", agente: "agente", cliente: "cliente", site: "site", sistema: "sistema" } as Record<string, string>;

export default async function PaginaProposta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("propostas").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const proposta = data as Proposta;

  const [{ perfil }, config, marca, drinks, modelos, vendedores, itensR, negocioR, versoesR, revisoesR, abertosR, site] = await Promise.all([
    obterPerfil(),
    obterConfiguracoes(),
    obterMarca(),
    listarDrinks(),
    listarModelos(),
    listarVendedores(),
    supabase.from("proposta_itens").select("*").eq("proposta_id", id).order("ordem"),
    supabase.from("negocios").select("id, titulo, vendedor_id, contato_id, empresa_id, status").eq("id", proposta.negocio_id).maybeSingle(),
    supabase.from("propostas").select("id, versao, status, total, created_at").eq("numero", proposta.numero).order("versao"),
    supabase.from("proposta_revisoes").select("*").eq("proposta_id", id).order("created_at"),
    supabase.from("negocios").select("id, titulo").eq("status", "aberto").neq("id", proposta.negocio_id).order("updated_at", { ascending: false }).limit(100),
    urlDoSite(),
  ]);
  const itens = (itensR.data ?? []) as PropostaItem[];
  const revisoes = (revisoesR.data ?? []) as PropostaRevisao[];
  const negocio = negocioR.data;
  const { data: contato } = negocio?.contato_id
    ? await supabase.from("contatos").select("id, nome, telefone, email").eq("id", negocio.contato_id).maybeSingle()
    : { data: null };
  const gestor = ehGestor(perfil);
  const pode = gestor || negocio?.vendedor_id === perfil?.id;
  // conteúdo: editável em rascunho e ajustes; aguardando aprovação, só o gestor (regra do banco)
  const editavel = pode && (proposta.status === "rascunho" || proposta.status === "ajustes_solicitados" || (proposta.status === "aguardando_aprovacao" && gestor));
  const link = `${site}/proposta/${proposta.codigo}`;
  const st = STATUS_PROPOSTA[proposta.status];
  const nomeVendedor = (vid: string | null) => vendedores.find((v) => v.id === vid)?.nome;

  return (
    <>
      <Link
        href={negocio ? `/negocios/${negocio.id}` : "/propostas"}
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto nao-imprimir"
      >
        <ArrowLeft className="size-4" aria-hidden /> {negocio ? negocio.titulo : "Propostas"}
      </Link>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between nao-imprimir">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Selo cor={st.cor}>{st.nome}</Selo>
            {proposta.origem === "agente" && (
              <Selo cor="marca">
                <Bot className="mr-1 size-3.5" aria-hidden /> Montada pelo agente
              </Selo>
            )}
            {proposta.preco_pendente && Number(proposta.total) <= 0 && <Selo cor="alerta">Preço a definir</Selo>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {proposta.numero} <span className="text-texto-2">· v{proposta.versao}</span>
          </h1>
          <p className="num text-xl font-extrabold text-marca-forte">{formatarMoeda(proposta.total)}</p>
          <p className="text-sm text-texto-2">{resumoEvento(proposta.evento)}</p>
        </div>
        {versoesR.data && versoesR.data.length > 1 && (
          <nav aria-label="Versões" className="flex flex-wrap gap-1.5">
            {versoesR.data.map((v) => (
              <Link
                key={v.id}
                href={`/propostas/${v.id}`}
                aria-current={v.id === proposta.id ? "page" : undefined}
                className={
                  v.id === proposta.id
                    ? "rounded-full bg-marca px-3 py-1.5 text-xs font-bold text-marca-texto"
                    : "rounded-full border border-borda px-3 py-1.5 text-xs font-semibold text-texto-2 hover:bg-superficie-2"
                }
              >
                v{v.versao} · {STATUS_PROPOSTA[v.status as Proposta["status"]].nome}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="mb-4">
        <AcoesProposta
          proposta={proposta}
          pode={Boolean(pode)}
          gestor={gestor}
          link={link}
          telefone={contato?.telefone}
          email={contato?.email}
          modelos={modelos}
          dados={{
            nome: contato?.nome?.split(" ")[0] ?? "",
            empresa: "",
            vendedor: perfil?.nome ?? config.responsavel ?? "",
            negocio: negocio?.titulo ?? proposta.titulo,
            valor: formatarMoeda(proposta.total),
            link_proposta: link,
            validade: formatarData(proposta.validade),
          }}
          contatoId={contato?.id}
          negocios={(abertosR.data ?? []) as { id: string; titulo: string }[]}
        />
      </div>

      {(proposta.status === "enviada" || proposta.status === "aceita") && (
        <Cartao className="mb-4 grid gap-2 text-sm sm:grid-cols-2 nao-imprimir">
          <p className="flex items-start gap-2 break-all">
            <Link2 className="mt-0.5 size-4 shrink-0 text-marca-forte" aria-hidden />
            <span>
              Link do cliente: <span className="font-medium">{link}</span>
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Eye className="size-4 shrink-0 text-marca-forte" aria-hidden />
            {proposta.visualizada_em
              ? `Cliente abriu ${proposta.visualizacoes}x (1ª vez em ${formatarDataHora(proposta.visualizada_em)})`
              : "O cliente ainda não abriu o link."}
          </p>
          {proposta.status === "aceita" && (
            <p className="rounded-xl bg-ok-suave p-3 text-ok sm:col-span-2">
              <strong>Aceita</strong> em {formatarDataHora(proposta.aceita_em)} por {proposta.aceite_nome}
              {proposta.aceite_via === "link" ? ` pelo link${proposta.aceite_ip ? ` (IP ${proposta.aceite_ip})` : ""}` : " (registrado pela equipe)"}.
            </p>
          )}
        </Cartao>
      )}

      {editavel && (
        <div className="mb-6">
          <EditorProposta key={proposta.updated_at} proposta={proposta} itens={itens} drinks={drinks} gestor={gestor} />
        </div>
      )}

      {revisoes.length > 1 && (
        <details className="mb-4 rounded-2xl border border-borda bg-superficie p-4 text-sm nao-imprimir">
          <summary className="cursor-pointer font-semibold">Histórico de decisões ({revisoes.length})</summary>
          <ol className="mt-3 space-y-2 border-l-2 border-borda pl-3">
            {revisoes.map((r) => (
              <li key={r.id}>
                <p className="font-medium">
                  {r.de_status ? `${STATUS_PROPOSTA[r.de_status].nome} → ` : "Criada como "}
                  {STATUS_PROPOSTA[r.para_status].nome}
                </p>
                <p className="text-xs text-texto-2">
                  {formatarDataHora(r.created_at)} · {r.autor_tipo === "humano" ? (nomeVendedor(r.autor_id) ?? "equipe") : (AUTOR[r.autor_tipo] ?? r.autor_tipo)}
                </p>
                {r.comentario && <p className="mt-0.5 whitespace-pre-line">{r.comentario}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}

      <h2 className="mb-2 text-sm font-bold tracking-wider text-texto-2 uppercase nao-imprimir">
        {editavel ? "Prévia do documento (salve para atualizar)" : "Documento"}
      </h2>
      <DocumentoAurora
        proposta={proposta}
        itens={itens}
        empresa={{
          nome: marca.nome,
          responsavel: config.responsavel,
          cidade: config.cidade,
          uf: config.uf,
          instagram: config.instagram,
          rodape: config.rodape_proposta,
          textos: config.proposta_textos,
          fotos: config.proposta_fotos,
        }}
        cliente={{ nome: contato?.nome }}
        logoUrl={marca.logoUrl}
      />
    </>
  );
}
