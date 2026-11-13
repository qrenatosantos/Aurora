/**
 * LINK PÚBLICO da proposta: /proposta/<código>  (liberado em lib/rotas.ts)
 * O cliente vê o documento e ACEITA sem login. Os dados vêm da função
 * proposta_publica (security definer) — as tabelas continuam fechadas para visitantes
 * e o JSON não traz ids, comissão nem anotações internas.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, History, MessageCircle, XCircle } from "lucide-react";
import { DocumentoProposta, type ClienteDoc, type EmpresaDoc, type ItemDoc, type PropostaDoc, type VendedorDoc } from "@/components/comercial/documento-proposta";
import { LogoNegocio } from "@/components/logo-negocio";
import { TemaToggle } from "@/components/ui/tema-toggle";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { obterMarca } from "@/lib/marca-servidor";
import { createClient } from "@/lib/supabase/server";
import { linkWhatsApp } from "@/lib/whatsapp";
import { BotaoImprimir, FormAceite } from "./botoes";

export const metadata: Metadata = { title: "Proposta comercial", robots: { index: false, follow: false } };

type Publico = {
  proposta: PropostaDoc;
  itens: ItemDoc[];
  cliente: ClienteDoc | null;
  vendedor: VendedorDoc | null;
  empresa: EmpresaDoc;
};

export default async function PropostaPublica({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[a-f0-9]{32}$/.test(codigo)) notFound();
  const supabase = await createClient();
  const [{ data, error }, marca] = await Promise.all([supabase.rpc("proposta_publica", { p_codigo: codigo }), obterMarca()]);
  if (error) console.error("[proposta_publica]", error.message);
  if (!data) notFound();

  const { proposta: p, itens, cliente, vendedor, empresa } = data as unknown as Publico;
  const total = formatarMoeda(p.total);
  const whats = vendedor?.telefone || empresa.whatsapp;

  return (
    <main className="min-h-dvh bg-fundo px-4 py-6 sm:px-6 imprimir-sem-margem">
      <div className="mx-auto max-w-[210mm]">
        <header className="mb-4 flex items-center gap-3 nao-imprimir">
          <LogoNegocio nome={empresa.nome} logoUrl={marca.logoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-titulo text-lg font-bold text-texto">{empresa.nome}</p>
            <p className="text-sm text-texto-2">
              Proposta {p.numero} · {total}
            </p>
          </div>
          <TemaToggle />
        </header>

        <section aria-live="polite" className="mb-4 rounded-2xl border border-borda bg-superficie p-4 shadow-sm nao-imprimir sm:p-5">
          {p.status === "aceita" ? (
            <p className="flex items-start gap-2 text-ok">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <strong>Proposta aceita</strong> em {formatarDataHora(p.aceita_em)}
                {p.aceite_nome ? ` por ${p.aceite_nome}` : ""}. Obrigado! O vendedor vai entrar em contato com os próximos passos.
              </span>
            </p>
          ) : p.status === "substituida" ? (
            <p className="flex items-start gap-2 text-alerta">
              <History className="mt-0.5 size-5 shrink-0" aria-hidden /> Existe uma versão mais nova desta proposta. Peça o link atualizado ao
              vendedor.
            </p>
          ) : p.status === "recusada" ? (
            <p className="flex items-start gap-2 text-perigo">
              <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden /> Esta proposta foi encerrada. Fale com o vendedor para uma nova.
            </p>
          ) : p.status === "expirada" ? (
            <p className="flex items-start gap-2 text-alerta">
              <Clock className="mt-0.5 size-5 shrink-0" aria-hidden /> A validade desta proposta acabou em {formatarData(p.validade)}. Peça uma
              atualizada ao vendedor.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-texto">
                Confira os itens abaixo. Proposta válida até <strong>{formatarData(p.validade)}</strong>. Está tudo certo? Registre o seu aceite.
              </p>
              <FormAceite codigo={codigo} total={total} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-borda pt-3">
            <BotaoImprimir />
            {whats && (
              <a
                href={linkWhatsApp(whats, `Olá${vendedor?.nome ? `, ${vendedor.nome.split(" ")[0]}` : ""}! Tenho uma dúvida sobre a proposta ${p.numero}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-whats px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                <MessageCircle className="size-4" aria-hidden /> Falar com o vendedor
              </a>
            )}
          </div>
        </section>

        <DocumentoProposta
          proposta={p}
          itens={itens}
          empresa={empresa}
          cliente={cliente ?? {}}
          vendedor={vendedor ?? {}}
          logoUrl={marca.logoUrl}
          cor={marca.corPrimaria}
        />
      </div>
    </main>
  );
}
