"use client";

/**
 * Ações da proposta conforme a situação:
 *   rascunho / ajustes solicitados → enviar para aprovação (gestor: aprovar, aprovar e enviar)
 *   aguardando aprovação           → gestor aprova ou pede ajustes (com comentário)
 *   aprovada                       → enviar ao cliente (libera o link) ou reabrir para editar
 *   enviada                        → link, WhatsApp, aceite manual, recusada, nova versão
 * As travas de verdade ficam no banco; aqui só mostramos os botões que fazem sentido.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Copy, CopyPlus, ExternalLink, FilePlus2, MessageSquareWarning, PencilLine, Printer, Send, ShieldCheck, Trash2, Undo2, XCircle } from "lucide-react";
import {
  aprovarEEnviar,
  aprovarProposta,
  duplicarProposta,
  enviarProposta,
  excluirProposta,
  marcarAceita,
  marcarRecusada,
  novaVersao,
  pedirAjustes,
  reabrirProposta,
  submeterProposta,
} from "@/app/(app)/propostas/actions";
import { BotaoMensagem, type DadosMensagem } from "@/components/comercial/botao-mensagem";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Selecao } from "@/components/ui/campo";
import { useConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { EstadoAcao } from "@/lib/acoes";
import { formatarDataHora } from "@/lib/formatar";
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
  negocios,
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
  /** Negócios em aberto (para "Duplicar para outro negócio"). */
  negocios: { id: string; titulo: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [dialogo, setDialogo] = useState<"aceite" | "ajustes" | "duplicar" | null>(null);
  const [nome, setNome] = useState("");
  const [comentario, setComentario] = useState("");
  const [destino, setDestino] = useState("");
  const s = proposta.status;
  const semValor = Number(proposta.total) <= 0;
  const editavel = s === "rascunho" || s === "ajustes_solicitados";

  function executar(acao: () => Promise<EstadoAcao>, depois?: (r: EstadoAcao) => void) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        setDialogo(null);
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

  const confirmarEnvio = () =>
    confirmar({
      titulo: "Enviar a proposta ao cliente?",
      mensagem: "O link público passa a funcionar, o cliente poderá aceitar e a data fica reservada na agenda até a validade. Para mudar depois, crie uma nova versão.",
      textoConfirmar: "Enviar",
    });

  return (
    <div className="space-y-3 nao-imprimir">
      {/* Faixa de situação */}
      {s === "ajustes_solicitados" && (
        <div className="rounded-2xl border border-perigo bg-perigo-suave p-4 text-sm text-perigo" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <MessageSquareWarning className="size-5 shrink-0" aria-hidden /> Ajustes solicitados
            {proposta.ajustes_em ? ` em ${formatarDataHora(proposta.ajustes_em)}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-line text-texto">{proposta.ajustes_comentario}</p>
          <p className="mt-1 text-texto-2">Faça os ajustes, salve e envie de novo para aprovação.</p>
        </div>
      )}
      {s === "aguardando_aprovacao" && (
        <div className="rounded-2xl border border-alerta-forte bg-alerta-suave p-4 text-sm text-alerta" role="status">
          <p className="font-semibold">
            Aguardando a aprovação do gestor
            {proposta.aprovacao_pedida_em ? ` desde ${formatarDataHora(proposta.aprovacao_pedida_em)}` : ""}
            {proposta.origem === "agente" ? " · montada pelo agente" : ""}.
          </p>
          {proposta.nota_interna && <p className="mt-1 whitespace-pre-line text-texto">Recado de quem montou: {proposta.nota_interna}</p>}
          {semValor && <p className="mt-1 font-semibold">Falta definir o valor: preencha o investimento no editor abaixo antes de aprovar.</p>}
        </div>
      )}
      {s === "aprovada" && (
        <p className="flex items-center gap-2 rounded-2xl border border-ok bg-ok-suave p-4 text-sm font-semibold text-ok" role="status">
          <ShieldCheck className="size-5 shrink-0" aria-hidden /> Aprovada
          {proposta.aprovada_em ? ` em ${formatarDataHora(proposta.aprovada_em)}` : ""}. Falta enviar ao cliente.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* rascunho / ajustes solicitados */}
        {pode && editavel && gestor && (
          <>
            <Botao
              carregando={pendente}
              disabled={semValor}
              title={semValor ? "Defina o valor da proposta antes" : undefined}
              onClick={async () => {
                if (await confirmarEnvio()) executar(() => aprovarEEnviar(proposta.id));
              }}
            >
              <Send className="size-4" aria-hidden /> Aprovar e enviar ao cliente
            </Botao>
            <Botao variante="secundario" disabled={semValor} onClick={() => executar(() => aprovarProposta(proposta.id))}>
              <ShieldCheck className="size-4" aria-hidden /> Só aprovar
            </Botao>
          </>
        )}
        {pode && editavel && !gestor && (
          <Botao carregando={pendente} onClick={() => executar(() => submeterProposta(proposta.id))}>
            <ShieldCheck className="size-4" aria-hidden /> Enviar para aprovação
          </Botao>
        )}

        {/* aguardando aprovação */}
        {s === "aguardando_aprovacao" && gestor && (
          <>
            <Botao
              carregando={pendente}
              disabled={semValor}
              onClick={async () => {
                if (await confirmarEnvio()) executar(() => aprovarEEnviar(proposta.id));
              }}
            >
              <Send className="size-4" aria-hidden /> Aprovar e enviar ao cliente
            </Botao>
            <Botao variante="secundario" disabled={semValor} onClick={() => executar(() => aprovarProposta(proposta.id))}>
              <ShieldCheck className="size-4" aria-hidden /> Só aprovar
            </Botao>
            <Botao variante="secundario" className="text-perigo" onClick={() => setDialogo("ajustes")}>
              <MessageSquareWarning className="size-4" aria-hidden /> Pedir ajustes
            </Botao>
          </>
        )}
        {s === "aguardando_aprovacao" && pode && !gestor && (
          <Botao variante="secundario" onClick={() => executar(() => reabrirProposta(proposta.id))}>
            <Undo2 className="size-4" aria-hidden /> Retirar o pedido de aprovação
          </Botao>
        )}

        {/* aprovada */}
        {s === "aprovada" && pode && (
          <>
            <Botao
              carregando={pendente}
              onClick={async () => {
                if (await confirmarEnvio()) executar(() => enviarProposta(proposta.id));
              }}
            >
              <Send className="size-4" aria-hidden /> Enviar ao cliente
            </Botao>
            <Botao
              variante="secundario"
              onClick={async () => {
                if (await confirmar({ titulo: "Reabrir para editar?", mensagem: "A proposta volta a ser rascunho e perde a aprovação. Depois de alterar, precisa ser aprovada de novo.", textoConfirmar: "Reabrir" }))
                  executar(() => reabrirProposta(proposta.id));
              }}
            >
              <PencilLine className="size-4" aria-hidden /> Reabrir para editar
            </Botao>
          </>
        )}

        {/* enviada / aceita / recusada */}
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
          <>
            <BotaoMensagem telefone={telefone} modelos={modelos} dados={dados} negocioId={proposta.negocio_id} contatoId={contatoId} empresaId={empresaId} modeloInicial="Envio de proposta" texto="Mandar no WhatsApp" />
            <BotaoMensagem canal="email" email={email} modelos={modelos} dados={dados} negocioId={proposta.negocio_id} contatoId={contatoId} empresaId={empresaId} modeloInicial="Proposta por e-mail" texto="E-mail" />
          </>
        )}
        {pode && s === "enviada" && (
          <>
            <Botao variante="secundario" className="text-ok" onClick={() => setDialogo("aceite")}>
              <CheckCircle2 className="size-4" aria-hidden /> Cliente aceitou
            </Botao>
            <Botao
              variante="fantasma"
              className="text-perigo"
              onClick={async () => {
                if (await confirmar({ titulo: "Marcar como recusada?", mensagem: "O link deixa de aceitar e a data é liberada na agenda. O negócio continua aberto." }))
                  executar(() => marcarRecusada(proposta.id));
              }}
            >
              <XCircle className="size-4" aria-hidden /> Recusada
            </Botao>
          </>
        )}
        {pode && (s === "enviada" || s === "recusada") && (
          <Botao
            variante="secundario"
            onClick={async () => {
              if (await confirmar({ titulo: "Criar nova versão?", mensagem: "Copia esta proposta como versão nova (rascunho, precisa de nova aprovação). Esta versão fica marcada como substituída.", textoConfirmar: "Criar versão" }))
                executar(
                  () => novaVersao(proposta.id),
                  (r) => (r.dados?.id ? router.push(`/propostas/${r.dados.id}`) : router.refresh()),
                );
            }}
          >
            <FilePlus2 className="size-4" aria-hidden /> Nova versão
          </Botao>
        )}

        {pode && negocios.length > 0 && (
          <Botao variante="fantasma" onClick={() => setDialogo("duplicar")}>
            <CopyPlus className="size-4" aria-hidden /> Duplicar para outro negócio
          </Botao>
        )}
        {pode && (editavel || s === "aguardando_aprovacao") && (
          <Botao
            variante="fantasma"
            className="text-perigo"
            onClick={async () => {
              if (await confirmar({ titulo: "Excluir esta proposta?", mensagem: "Ela ainda não foi enviada ao cliente. Não dá para desfazer.", perigo: true }))
                executar(
                  () => excluirProposta(proposta.id),
                  (r) => router.push(r.dados?.negocio ? `/negocios/${r.dados.negocio}` : "/propostas"),
                );
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Excluir
          </Botao>
        )}
        <Botao variante="secundario" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Imprimir / PDF
        </Botao>
      </div>

      <Modal
        aberto={dialogo === "aceite"}
        aoFechar={() => setDialogo(null)}
        titulo="Registrar aceite do cliente"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </Botao>
            <Botao carregando={pendente} onClick={() => executar(() => marcarAceita(proposta.id, nome))}>
              Registrar aceite
            </Botao>
          </>
        }
      >
        <p className="mb-3 text-sm text-texto-2">
          Use quando o cliente aceitou por telefone, mensagem ou pessoalmente. O negócio é <strong>fechado</strong> com o valor desta proposta e a data é
          confirmada na agenda. (Pelo link, o próprio cliente registra o aceite.)
        </p>
        <label className="text-sm font-medium" htmlFor="nome-aceite">
          Quem aceitou
        </label>
        <Entrada id="nome-aceite" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" maxLength={120} />
      </Modal>

      <Modal
        aberto={dialogo === "ajustes"}
        aoFechar={() => setDialogo(null)}
        titulo="Pedir ajustes"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </Botao>
            <Botao carregando={pendente} onClick={() => executar(() => pedirAjustes(proposta.id, comentario))}>
              Pedir ajustes
            </Botao>
          </>
        }
      >
        <p className="mb-3 text-sm text-texto-2">
          A proposta volta para quem montou{proposta.origem === "agente" ? " (o agente é avisado na hora)" : ""}, com o seu comentário. Ela não vai para o cliente
          enquanto você não aprovar.
        </p>
        <label className="text-sm font-medium" htmlFor="comentario-ajustes">
          O que precisa ser ajustado
        </label>
        <AreaTexto id="comentario-ajustes" rows={4} maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ex.: Trocar o Fitzgerald pelo Moscow Mule e recalcular para 5 horas." />
      </Modal>

      <Modal
        aberto={dialogo === "duplicar"}
        aoFechar={() => setDialogo(null)}
        titulo="Duplicar para outro negócio"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </Botao>
            <Botao
              carregando={pendente}
              disabled={!destino}
              onClick={() =>
                executar(
                  () => duplicarProposta(proposta.id, destino),
                  (r) => (r.dados?.id ? router.push(`/propostas/${r.dados.id}`) : router.refresh()),
                )
              }
            >
              Duplicar
            </Botao>
          </>
        }
      >
        <p className="mb-3 text-sm text-texto-2">
          Cria uma proposta nova (rascunho, com número novo) em outro negócio, copiando cardápio, textos, condições e itens. Os dados do evento vêm do
          negócio escolhido.
        </p>
        <label className="text-sm font-medium" htmlFor="destino-duplicar">
          Negócio de destino
        </label>
        <Selecao id="destino-duplicar" value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="">— escolha —</option>
          {negocios.map((n) => (
            <option key={n.id} value={n.id}>
              {n.titulo}
            </option>
          ))}
        </Selecao>
      </Modal>
    </div>
  );
}
