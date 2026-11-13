/** FICHA DO CONTATO: dados, WhatsApp com modelos, negócios e histórico de atividades. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, Phone } from "lucide-react";
import { AcoesFicha } from "@/components/comercial/acoes-ficha";
import { BotaoMensagem } from "@/components/comercial/botao-mensagem";
import { ListaAtividades } from "@/components/comercial/lista-atividades";
import { Cartao, Selo } from "@/components/ui/cartao";
import { STATUS_NEGOCIO, moedaInteira } from "@/lib/comercial";
import { agoraServidor, listarModelos, mapaNomes, opcoesCadastro, opcoesNegocio } from "@/lib/dados";
import { formatarData, formatarTelefone, hojeISO } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Atividade, Contato } from "@/lib/tipos";
import { Privacidade } from "./privacidade";

export const metadata: Metadata = { title: "Contato" };

export default async function PaginaContato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("contatos").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const contato = data as Contato;
  const { perfil } = await obterPerfil();
  const gestor = ehGestor(perfil);
  const [cad, neg, modelos, negociosR, atividadesR, empresaR] = await Promise.all([
    opcoesCadastro(perfil),
    opcoesNegocio(perfil),
    listarModelos(),
    supabase.from("negocios").select("*").eq("contato_id", id).order("created_at", { ascending: false }),
    supabase.from("atividades").select("*").eq("contato_id", id).order("quando", { ascending: false }).limit(100),
    contato.empresa_id ? supabase.from("empresas").select("id, nome").eq("id", contato.empresa_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const negocios = negociosR.data ?? [];
  const atividades = (atividadesR.data ?? []) as Atividade[];
  const empresa = empresaR.data;
  const nomeNegocio = Object.fromEntries(negocios.map((n) => [n.id, n.titulo]));
  const pode = gestor || contato.responsavel_id === perfil?.id;
  const nomeVendedor = mapaNomes(cad.vendedores);
  const origem = cad.origens.find((o) => o.id === contato.origem_id)?.nome;
  const agora = agoraServidor();
  const hoje = hojeISO();
  const abertos = negocios.filter((n) => n.status === "aberto");
  const dados = {
    nome: contato.nome.split(" ")[0],
    empresa: empresa?.nome ?? "",
    vendedor: perfil?.nome ?? "",
    negocio: abertos[0]?.titulo ?? "",
    valor: abertos[0] ? moedaInteira(abertos[0].valor) : "",
  };

  return (
    <>
      <Link href="/contatos" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden /> Contatos
      </Link>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{contato.nome}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-2">
            {contato.cargo && <span>{contato.cargo}</span>}
            {empresa ? (
              <Link href={`/empresas/${empresa.id}`} className="inline-flex items-center gap-1 hover:text-marca-forte">
                <Building2 className="size-4" aria-hidden /> {empresa.nome}
              </Link>
            ) : (
              <span>Pessoa física</span>
            )}
            {contato.responsavel_id && <span>Responsável: {nomeVendedor.get(contato.responsavel_id) ?? "—"}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {origem && <Selo>{origem}</Selo>}
            {contato.tags.map((t) => (
              <Selo key={t} cor="marca">
                {t}
              </Selo>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <BotaoMensagem telefone={contato.telefone} modelos={modelos} dados={dados} contatoId={contato.id} empresaId={contato.empresa_id} />
          <BotaoMensagem canal="email" email={contato.email} modelos={modelos} dados={dados} contatoId={contato.id} empresaId={contato.empresa_id} compacto />
        </div>
      </div>

      <div className="mb-4">
        <AcoesFicha contato={contato} opcoesCadastro={cad} opcoesNegocio={neg} pode={pode} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Negócios ({negocios.length})</h2>
            {negocios.length === 0 ? (
              <p className="text-sm text-texto-2">Nenhum negócio com este contato.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {negocios.map((n) => (
                  <li key={n.id}>
                    <Link href={`/negocios/${n.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:text-marca-forte">
                      <span className="min-w-0 flex-1 truncate font-medium">{n.titulo}</span>
                      <span className="num font-bold">{moedaInteira(n.valor)}</span>
                      <Selo cor={STATUS_NEGOCIO[n.status].cor}>{STATUS_NEGOCIO[n.status].nome}</Selo>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Atividades</h2>
            <ListaAtividades
              atividades={atividades}
              agora={agora}
              hoje={hoje}
              meuId={perfil?.id ?? null}
              gestor={gestor}
              negocios={nomeNegocio}
              vendedores={cad.vendedores}
              mostrarVendedor
              vazio="Nenhuma atividade com este contato."
            />
          </Cartao>
        </div>
        <div className="space-y-4">
          <Cartao>
            <h2 className="mb-2 text-base font-semibold">Dados</h2>
          <ul className="space-y-2 text-sm">
            {contato.telefone && (
              <li>
                <a href={`tel:${contato.telefone}`} className="inline-flex min-h-11 items-center gap-2 text-marca-forte underline">
                  <Phone className="size-4" aria-hidden /> {formatarTelefone(contato.telefone)}
                </a>
              </li>
            )}
            {contato.email && (
              <li className="flex items-center gap-2 break-all">
                <Mail className="size-4 shrink-0" aria-hidden /> {contato.email}
              </li>
            )}
            {contato.cidade && <li>Cidade: {contato.cidade}</li>}
            {contato.cpf && <li>CPF: {contato.cpf}</li>}
            <li className="text-texto-2">Cadastrado em {formatarData(contato.created_at)}</li>
          </ul>
          {contato.observacoes && <p className="mt-3 text-sm whitespace-pre-line">{contato.observacoes}</p>}
          </Cartao>
          {gestor && <Privacidade id={contato.id} nome={contato.nome} temFechados={negocios.some((n) => n.status === "ganho")} />}
        </div>
      </div>
    </>
  );
}
