/**
 * PROPOSTA: editor (rascunho), aprovação de desconto, envio, link público,
 * versões, aceite e documento imprimível/PDF com a marca.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Link2 } from "lucide-react";
import { DocumentoProposta } from "@/components/comercial/documento-proposta";
import { Cartao, Selo } from "@/components/ui/cartao";
import { STATUS_PROPOSTA } from "@/lib/comercial";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { listarModelos, listarProdutos, listarVendedores } from "@/lib/dados";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { obterMarca } from "@/lib/marca-servidor";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { urlDoSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Proposta, PropostaItem } from "@/lib/tipos";
import { AcoesProposta } from "./acoes-proposta";
import { EditorProposta } from "./editor-proposta";

export const metadata: Metadata = { title: "Proposta" };

export default async function PaginaProposta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("propostas").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const proposta = data as Proposta;

  const [{ perfil }, config, marca, produtos, modelos, vendedores, itensR, negocioR, versoesR, site] = await Promise.all([
    obterPerfil(),
    obterConfiguracoes(),
    obterMarca(),
    listarProdutos(),
    listarModelos(),
    listarVendedores(),
    supabase.from("proposta_itens").select("*").eq("proposta_id", id).order("ordem"),
    supabase.from("negocios").select("id, titulo, vendedor_id, contato_id, empresa_id, status").eq("id", proposta.negocio_id).maybeSingle(),
    supabase.from("propostas").select("id, versao, status, total, created_at").eq("numero", proposta.numero).order("versao"),
    urlDoSite(),
  ]);
  const itens = (itensR.data ?? []) as PropostaItem[];
  const negocio = negocioR.data;
  const [contatoR, empresaR] = await Promise.all([
    negocio?.contato_id
      ? supabase.from("contatos").select("id, nome, cargo, telefone, email, cidade").eq("id", negocio.contato_id).maybeSingle()
      : Promise.resolve({ data: null }),
    negocio?.empresa_id ? supabase.from("empresas").select("id, nome, cidade, uf").eq("id", negocio.empresa_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const contato = contatoR.data;
  const empresa = empresaR.data;
  const vendedor = vendedores.find((v) => v.id === proposta.vendedor_id);
  const gestor = ehGestor(perfil);
  const pode = gestor || negocio?.vendedor_id === perfil?.id;
  const editavel = pode && (proposta.status === "rascunho" || proposta.status === "aguardando_aprovacao");
  const link = `${site}/proposta/${proposta.codigo}`;
  const st = STATUS_PROPOSTA[proposta.status];
  const aprovador = vendedores.find((v) => v.id === proposta.aprovada_por)?.nome;

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
            {proposta.precisa_aprovacao && !proposta.aprovada_em && <Selo cor="alerta">Desconto acima do limite</Selo>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {proposta.numero} <span className="text-texto-2">· v{proposta.versao}</span>
          </h1>
          <p className="num text-xl font-extrabold text-marca-forte">{formatarMoeda(proposta.total)}</p>
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
          pode={pode}
          gestor={gestor}
          link={link}
          telefone={contato?.telefone}
          email={contato?.email}
          modelos={modelos}
          dados={{
            nome: contato?.nome?.split(" ")[0] ?? "",
            empresa: empresa?.nome ?? "",
            vendedor: vendedor?.nome ?? perfil?.nome ?? "",
            negocio: negocio?.titulo ?? proposta.titulo,
            valor: formatarMoeda(proposta.total),
            link_proposta: link,
            validade: formatarData(proposta.validade),
          }}
          contatoId={contato?.id}
          empresaId={empresa?.id}
          temItens={itens.length > 0}
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
          {proposta.aprovada_em && (
            <p className="text-texto-2 sm:col-span-2">
              Desconto aprovado por {aprovador ?? "gestor"} em {formatarDataHora(proposta.aprovada_em)}.
            </p>
          )}
        </Cartao>
      )}

      {editavel && (
        <div className="mb-6">
          <EditorProposta
            key={proposta.updated_at}
            proposta={proposta}
            itens={itens}
            produtos={produtos}
            descontoAvulso={Number(config.desconto_max_avulso)}
          />
        </div>
      )}

      <h2 className="mb-2 text-sm font-bold tracking-wider text-texto-2 uppercase nao-imprimir">
        {editavel ? "Prévia do documento (salve para atualizar)" : "Documento"}
      </h2>
      <DocumentoProposta
        proposta={{ ...proposta, emitida_em: proposta.enviada_em ?? proposta.created_at }}
        itens={itens}
        empresa={{
          nome: marca.nome,
          documento: config.documento,
          whatsapp: config.whatsapp,
          email: config.email,
          site: config.site,
          endereco: config.endereco,
          cidade: config.cidade,
          rodape: config.rodape_proposta,
        }}
        cliente={{ empresa: empresa?.nome, contato: contato?.nome, cargo: contato?.cargo, cidade: empresa?.cidade ?? contato?.cidade }}
        vendedor={{ nome: vendedor?.nome, email: vendedor?.email, telefone: vendedor?.telefone }}
        logoUrl={marca.logoUrl}
        cor={marca.corPrimaria}
      />
    </>
  );
}
