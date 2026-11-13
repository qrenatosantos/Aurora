"use client";

/**
 * Ações da proposta conforme a situação: pedir/dar aprovação de desconto, enviar
 * (libera o link público), copiar link, WhatsApp, registrar aceite manual, recusar,
 * nova versão, excluir rascunho e imprimir/PDF.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Copy, ExternalLink, FilePlus2, Printer, Send, ShieldCheck, ShieldX, Trash2, XCircle } from "lucide-react";
import {
  aprovarDesconto,
  enviarProposta,
  excluirProposta,
  marcarAceita,
  marcarRecusada,
  novaVersao,
  pedirAprovacao,
  recusarDesconto,
} from "@/app/(app)/propostas/actions";
import { BotaoMensagem, type DadosMensagem } from "@/components/comercial/botao-mensagem";
import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campo";
import { useConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { EstadoAcao } from "@/lib/acoes";
import type { ModeloMensagem, Proposta } from "@/lib/tipos";

export function AcoesProposta({
  proposta,
  pode,
  gestor,
  link,
  telefone,
  email,
  modelos,
  dados,
  contatoId,
  empresaId,
  temItens,
  mudancasPendentes,
}: {
  proposta: Proposta;
  pode: boolean;
  gestor: boolean;
  link: string;
  telefone?: string | null;
  email?: string | null;
  modelos: ModeloMensagem[];
  dados: DadosMensagem;
  contatoId?: string | null;
  empresaId?: string | null;
  temItens: boolean;
  mudancasPendentes?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [aceite, setAceite] = useState(false);
  const [nome, setNome] = useState("");
  const s = proposta.status;
  const editavel = s === "rascunho" || s === "aguardando_aprovacao";
  const aprovada = !proposta.precisa_aprovacao || Boolean(proposta.aprovada_em);

  function executar(acao: () => Promise<EstadoAcao>, depois?: (r: EstadoAcao) => void) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        if (depois) depois(r);
        else router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      toast.info("Link copiado. Cole no WhatsApp ou no e-mail do cliente.");
    } catch {
      toast.erro("Não foi possível copiar. Selecione e copie o link manualmente.");
    }
  }

  return (
    <div className="space-y-3 nao-imprimir">
      {editavel && proposta.precisa_aprovacao && (
        <div className="rounded-2xl border border-alerta-forte bg-alerta-suave p-4 text-sm text-alerta">
          {proposta.aprovada_em ? (
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-5" aria-hidden /> Desconto acima do limite APROVADO pelo gestor. Já pode enviar.
            </p>
          ) : s === "aguardando_aprovacao" ? (
            <p className="font-semibold">Aguardando o gestor aprovar o desconto acima do limite.</p>
          ) : (
            <p className="font-semibold">Há desconto acima do limite: a proposta só pode ser enviada depois da aprovação do gestor.</p>
          )}
          {gestor && !proposta.aprovada_em && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Botao carregando={pendente} onClick={() => executar(() => aprovarDesconto(proposta.id))}>
                <ShieldCheck className="size-4" aria-hidden /> Aprovar desconto
              </Botao>
              <Botao variante="secundario" onClick={() => executar(() => recusarDesconto(proposta.id))}>
                <ShieldX className="size-4" aria-hidden /> Não aprovar
              </Botao>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {pode && editavel && (
          <>
            {aprovada ? (
              <Botao
                carregando={pendente}
                disabled={!temItens || mudancasPendentes}
                title={mudancasPendentes ? "Salve as alterações antes" : undefined}
                onClick={async () => {
                  if (
                    await confirmar({
                      titulo: "Enviar a proposta?",
                      mensagem: "O link público passa a funcionar e o cliente poderá aceitar. Para mudar depois, crie uma nova versão.",
                      textoConfirmar: "Enviar",
                    })
                  )
                    executar(() => enviarProposta(proposta.id));
                }}
              >
                <Send className="size-4" aria-hidden /> Enviar ao cliente
              </Botao>
            ) : (
              s === "rascunho" && (
                <Botao carregando={pendente} onClick={() => executar(() => pedirAprovacao(proposta.id))}>
                  <ShieldCheck className="size-4" aria-hidden /> Pedir aprovação ao gestor
                </Botao>
              )
            )}
            <Botao
              variante="fantasma"
              className="text-perigo"
              onClick={async () => {
                if (await confirmar({ titulo: "Excluir este rascunho?", perigo: true }))
                  executar(
                    () => excluirProposta(proposta.id),
                    (r) => router.push(r.dados?.negocio ? `/negocios/${r.dados.negocio}` : "/propostas"),
                  );
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Excluir rascunho
            </Botao>
          </>
        )}

        {(s === "enviada" || s === "aceita" || s === "recusada") && (
          <>
            <Botao variante="secundario" onClick={copiar}>
              <Copy className="size-4" aria-hidden /> Copiar link
            </Botao>
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-texto-2 hover:bg-superficie-2">
              <ExternalLink className="size-4" aria-hidden /> Ver como cliente
            </a>
          </>
        )}
        {s === "enviada" && (
          <BotaoMensagem
            telefone={telefone}
            modelos={modelos}
            dados={dados}
            negocioId={proposta.negocio_id}
            contatoId={contatoId}
            empresaId={empresaId}
            modeloInicial="Envio de proposta"
            texto="Mandar no WhatsApp"
          />
        )}
        {s === "enviada" && (
          <BotaoMensagem
            canal="email"
            email={email}
            modelos={modelos}
            dados={dados}
            negocioId={proposta.negocio_id}
            contatoId={contatoId}
            empresaId={empresaId}
            modeloInicial="Proposta por e-mail"
            texto="E-mail"
          />
        )}
        {pode && s === "enviada" && (
          <>
            <Botao variante="secundario" className="text-ok" onClick={() => setAceite(true)}>
              <CheckCircle2 className="size-4" aria-hidden /> Cliente aceitou
            </Botao>
            <Botao
              variante="fantasma"
              className="text-perigo"
              onClick={async () => {
                if (await confirmar({ titulo: "Marcar como recusada?", mensagem: "O link deixa de aceitar. O negócio continua aberto." }))
                  executar(() => marcarRecusada(proposta.id));
              }}
            >
              <XCircle className="size-4" aria-hidden /> Recusada
            </Botao>
          </>
        )}
        {pode && (s === "enviada" || s === "recusada" || s === "rascunho") && (
          <Botao
            variante="secundario"
            onClick={async () => {
              if (
                await confirmar({
                  titulo: "Criar nova versão?",
                  mensagem: "Copia esta proposta como versão nova (rascunho). Esta versão fica marcada como substituída.",
                  textoConfirmar: "Criar versão",
                })
              )
                executar(
                  () => novaVersao(proposta.id),
                  (r) => (r.dados?.id ? router.push(`/propostas/${r.dados.id}`) : router.refresh()),
                );
            }}
          >
            <FilePlus2 className="size-4" aria-hidden /> Nova versão
          </Botao>
        )}
        <Botao variante="secundario" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Imprimir / PDF
        </Botao>
      </div>

      <Modal
        aberto={aceite}
        aoFechar={() => setAceite(false)}
        titulo="Registrar aceite do cliente"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAceite(false)}>
              Cancelar
            </Botao>
            <Botao
              carregando={pendente}
              onClick={() =>
                executar(
                  () => marcarAceita(proposta.id, nome),
                  () => {
                    setAceite(false);
                    router.refresh();
                  },
                )
              }
            >
              Registrar aceite
            </Botao>
          </>
        }
      >
        <p className="mb-3 text-sm text-texto-2">
          Use quando o cliente aceitou por telefone, e-mail ou pessoalmente. O negócio vira <strong>ganho</strong> com o valor desta proposta e a
          comissão é calculada. (Pelo link, o próprio cliente registra o aceite.)
        </p>
        <label className="text-sm font-medium" htmlFor="nome-aceite">
          Quem aceitou
        </label>
        <Entrada id="nome-aceite" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" maxLength={120} />
      </Modal>
    </div>
  );
}
