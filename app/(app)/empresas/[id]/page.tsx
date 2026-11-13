/** FICHA DA EMPRESA: dados, contatos (vários por empresa), negócios e atividades. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { AcoesFicha } from "@/components/comercial/acoes-ficha";
import { BotaoCadastro } from "@/components/comercial/botao-cadastro";
import { ListaAtividades } from "@/components/comercial/lista-atividades";
import { Cartao, Selo } from "@/components/ui/cartao";
import { PORTES, STATUS_NEGOCIO, moedaInteira } from "@/lib/comercial";
import { agoraServidor, mapaNomes, opcoesCadastro, opcoesNegocio } from "@/lib/dados";
import { formatarTelefone, hojeISO } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import type { Atividade, Empresa } from "@/lib/tipos";
import { linkWhatsApp } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Empresa" };

const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export default async function PaginaEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("empresas").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const empresa = data as Empresa;
  const { perfil } = await obterPerfil();
  const gestor = ehGestor(perfil);
  const [cad, neg, contatosR, negociosR, atividadesR] = await Promise.all([
    opcoesCadastro(perfil),
    opcoesNegocio(perfil),
    supabase.from("contatos").select("*").eq("empresa_id", id).order("nome"),
    supabase.from("negocios").select("*").eq("empresa_id", id).order("created_at", { ascending: false }),
    supabase.from("atividades").select("*").eq("empresa_id", id).order("quando", { ascending: false }).limit(100),
  ]);
  const contatos = contatosR.data ?? [];
  const negocios = negociosR.data ?? [];
  const atividades = (atividadesR.data ?? []) as Atividade[];
  const pode = gestor || empresa.responsavel_id === perfil?.id;
  const nomeVendedor = mapaNomes(cad.vendedores);
  const ganho = negocios.filter((n) => n.status === "ganho").reduce((s, n) => s + Number(n.valor), 0);
  const emAberto = negocios.filter((n) => n.status === "aberto").reduce((s, n) => s + Number(n.valor), 0);

  return (
    <>
      <Link href="/empresas" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden /> Empresas
      </Link>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{empresa.nome}</h1>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-2">
          {empresa.segmento && <span>{empresa.segmento}</span>}
          {empresa.porte && <span>Porte: {PORTES.find((p) => p.id === empresa.porte)?.nome}</span>}
          {empresa.cidade && <span>{`${empresa.cidade}${empresa.uf ? `/${empresa.uf}` : ""}`}</span>}
          {empresa.responsavel_id && <span>Responsável: {nomeVendedor.get(empresa.responsavel_id) ?? "—"}</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {empresa.tags.map((t) => (
            <Selo key={t} cor="marca">
              {t}
            </Selo>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <AcoesFicha empresa={empresa} opcoesCadastro={cad} opcoesNegocio={neg} pode={pode} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">Já comprou</p>
          <p className="num text-lg font-extrabold text-ok">{moedaInteira(ganho)}</p>
        </Cartao>
        <Cartao className="p-3 sm:p-4">
          <p className="text-xs text-texto-2">Em negociação</p>
          <p className="num text-lg font-extrabold">{moedaInteira(emAberto)}</p>
        </Cartao>
        <Cartao className="col-span-2 p-3 sm:col-span-1 sm:p-4">
          <p className="text-xs text-texto-2">Contatos</p>
          <p className="num text-lg font-extrabold">{contatos.length}</p>
        </Cartao>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Contatos</h2>
              <BotaoCadastro tipo="contato" opcoes={cad} empresaInicial={empresa.id} />
            </div>
            {contatos.length === 0 ? (
              <p className="text-sm text-texto-2">Nenhum contato nesta empresa.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {contatos.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2">
                    <Link href={`/contatos/${c.id}`} className="min-w-0 flex-1 hover:text-marca-forte">
                      <span className="block truncate font-medium">{c.nome}</span>
                      <span className="block truncate text-xs text-texto-2">
                        {[c.cargo, formatarTelefone(c.telefone), c.email].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                    {c.telefone && (
                      <a
                        href={linkWhatsApp(c.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-11 place-items-center rounded-xl text-whats hover:bg-superficie-2"
                        aria-label={`WhatsApp de ${c.nome}`}
                      >
                        <MessageCircle className="size-5" aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Negócios ({negocios.length})</h2>
            {negocios.length === 0 ? (
              <p className="text-sm text-texto-2">Nenhum negócio com esta empresa.</p>
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
              agora={agoraServidor()}
              hoje={hojeISO()}
              meuId={perfil?.id ?? null}
              gestor={gestor}
              negocios={Object.fromEntries(negocios.map((n) => [n.id, n.titulo]))}
              vendedores={cad.vendedores}
              mostrarVendedor
              vazio="Nenhuma atividade com esta empresa."
            />
          </Cartao>
        </div>
        <Cartao>
          <h2 className="mb-2 text-base font-semibold">Dados</h2>
          <ul className="space-y-2 text-sm">
            {empresa.cnpj && <li>CNPJ: {fmtCnpj(empresa.cnpj)}</li>}
            {empresa.telefone && (
              <li>
                <a href={`tel:${empresa.telefone}`} className="inline-flex min-h-11 items-center gap-2 text-marca-forte underline">
                  <Phone className="size-4" aria-hidden /> {formatarTelefone(empresa.telefone)}
                </a>
              </li>
            )}
            {empresa.email && (
              <li className="flex items-center gap-2 break-all">
                <Mail className="size-4 shrink-0" aria-hidden /> {empresa.email}
              </li>
            )}
            {empresa.site && (
              <li className="flex items-center gap-2 break-all">
                <Globe className="size-4 shrink-0" aria-hidden /> {empresa.site}
              </li>
            )}
            {empresa.endereco && <li>{empresa.endereco}</li>}
          </ul>
          {empresa.observacoes && <p className="mt-3 text-sm whitespace-pre-line">{empresa.observacoes}</p>}
        </Cartao>
      </div>
    </>
  );
}
