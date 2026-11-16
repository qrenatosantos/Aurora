/**
 * LINK PÚBLICO da proposta: /proposta/<código>  (liberado em lib/rotas.ts)
 * O cliente vê o documento da Aurora e ACEITA sem login. Os dados vêm da função
 * proposta_publica (security definer): as tabelas continuam fechadas para visitantes
 * e o JSON não traz ids, memória de cálculo nem anotações internas.
 * Só propostas JÁ ENVIADAS (depois da aprovação do gestor) aparecem aqui.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, History, MessageCircle, XCircle } from "lucide-react";
import { DocumentoAurora, type EmpresaAurora, type ItemAurora, type PropostaAurora } from "@/components/aurora/documento-aurora";
import { LogoNegocio } from "@/components/logo-negocio";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { obterMarca } from "@/lib/marca-servidor";
import { createClient } from "@/lib/supabase/server";
import { linkWhatsApp } from "@/lib/whatsapp";
import { BotaoImprimir, FormAceite } from "./botoes";

export const metadata: Metadata = { title: "Proposta", robots: { index: false, follow: false } };

type Publico = {
  proposta: PropostaAurora & { pedido?: string | null };
  itens: ItemAurora[];
  cliente: { contato?: string | null; empresa?: string | null } | null;
  empresa: EmpresaAurora & { whatsapp?: string | null };
};

export default async function PropostaPublica({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[a-f0-9]{32}$/.test(codigo)) notFound();
  const supabase = await createClient();
  const [{ data, error }, marca] = await Promise.all([supabase.rpc("proposta_publica", { p_codigo: codigo }), obterMarca()]);
  if (error) console.error("[proposta_publica]", error.message);
  if (!data) notFound();

  const { proposta: p, itens, cliente, empresa } = data as unknown as Publico;
  const total = formatarMoeda(p.total);
  const whats = empresa.whatsapp;
  const nomeCliente = cliente?.contato ?? cliente?.empresa ?? null;
  const aberta = p.status === "enviada";
  const ref = `${p.numero}${p.pedido ? ` (pedido ${p.pedido})` : ""}`;

  return (
    <main className="min-h-dvh bg-fundo px-3 py-5 sm:px-6 print:p-0">
      <div className="mx-auto max-w-6xl print:mx-0 print:max-w-none">
        <header className="mb-4 flex items-center gap-3 nao-imprimir">
          <LogoNegocio nome={empresa.nome} logoUrl={marca.logoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-titulo text-xl font-semibold text-texto">{empresa.nome}</p>
            <p className="text-sm text-texto-2">
              Proposta {p.numero}
              {p.versao > 1 ? ` · versão ${p.versao}` : ""}
            </p>
          </div>
          {aberta && (
            <a href="#aceite" className="inline-flex min-h-11 items-center rounded-xl bg-marca px-4 text-sm font-semibold text-marca-texto hover:bg-marca/90">
              Aceitar
            </a>
          )}
        </header>

        {!aberta && (
          <section aria-live="polite" className="mb-4 rounded-2xl border border-borda bg-superficie p-4 shadow-sm nao-imprimir sm:p-5">
            {p.status === "aceita" ? (
              <p className="flex items-start gap-2 text-ok">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span>
                  <strong>Proposta aceita</strong> em {formatarDataHora(p.aceita_em)}
                  {p.aceite_nome ? ` por ${p.aceite_nome}` : ""}. Obrigado! A Aurora vai entrar em contato com os próximos passos.
                  {whats && (
                    <a
                      href={linkWhatsApp(whats, `Olá, Aurora! Acabei de aceitar a proposta ${ref}. Quais são os próximos passos?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex min-h-11 w-fit items-center gap-2 rounded-xl bg-whats px-4 text-sm font-semibold text-white hover:opacity-90"
                    >
                      <MessageCircle className="size-4" aria-hidden /> Avisar a Aurora pelo WhatsApp
                    </a>
                  )}
                </span>
              </p>
            ) : p.status === "substituida" ? (
              <p className="flex items-start gap-2 text-alerta">
                <History className="mt-0.5 size-5 shrink-0" aria-hidden /> Existe uma versão mais nova desta proposta. Peça o link atualizado à Aurora.
              </p>
            ) : p.status === "recusada" ? (
              <p className="flex items-start gap-2 text-perigo">
                <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden /> Esta proposta foi encerrada. Fale com a Aurora para uma nova.
              </p>
            ) : (
              <p className="flex items-start gap-2 text-alerta">
                <Clock className="mt-0.5 size-5 shrink-0" aria-hidden /> A validade desta proposta acabou em {formatarData(p.validade)}. Peça uma atualizada à
                Aurora.
              </p>
            )}
          </section>
        )}

        <DocumentoAurora proposta={p} itens={itens} empresa={empresa} cliente={{ nome: nomeCliente }} logoUrl={marca.logoUrl} />

        <section id="aceite" aria-live="polite" className="mt-4 scroll-mt-4 rounded-2xl border border-borda bg-superficie p-4 shadow-sm nao-imprimir sm:p-6">
          {aberta ? (
            <div className="mx-auto max-w-xl space-y-3">
              <h2 className="text-2xl font-semibold">Tudo certo? Registre o seu aceite</h2>
              <p className="text-sm text-texto-2">
                Proposta válida até <strong className="text-texto">{formatarData(p.validade)}</strong>. Valor total: <strong className="text-texto">{total}</strong>. Se
                quiser mudar alguma coisa, fale com a gente antes de aceitar.
              </p>
              <FormAceite codigo={codigo} total={total} />
            </div>
          ) : (
            <p className="text-center text-sm text-texto-2">Proposta {p.numero}.</p>
          )}
          <div className="mx-auto mt-4 flex max-w-xl flex-wrap gap-2 border-t border-borda pt-3">
            <BotaoImprimir />
            {whats && (
              <a
                href={linkWhatsApp(whats, `Olá, Aurora! Quero conversar sobre a proposta ${ref}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-whats px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                <MessageCircle className="size-4" aria-hidden /> Quero conversar sobre a proposta
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
