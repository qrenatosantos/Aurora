"use client";

/**
 * Quem está atendendo (agente ou humano), botões de passagem e a conversa com o cliente.
 * O agente grava a conversa pela API; pela tela, a equipe pode registrar mensagens à mão.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bot, MessagesSquare, Send, UserRound } from "lucide-react";
import { registrarMensagem, transferirAtendimento } from "@/app/(app)/negocios/acoes-aurora";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Selecao } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ATENDIMENTO } from "@/lib/aurora";
import { formatarDataHora } from "@/lib/formatar";
import type { Atendimento, Mensagem, Transferencia } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { cn } from "@/lib/utils";

const CANAIS = { whatsapp: "WhatsApp", instagram: "Instagram", email: "E-mail", telefone: "Telefone", site: "Site", outro: "Outro" } as const;
const AUTORES = { cliente: "Cliente", agente: "Agente", humano: "Equipe", sistema: "Sistema" } as const;

export function AtendimentoNegocio({
  negocioId,
  atendimento,
  desde,
  aberto: negocioAberto,
  pode,
  mensagens,
  transferencias,
}: {
  negocioId: string;
  atendimento: Atendimento;
  desde: string;
  aberto: boolean;
  pode: boolean;
  mensagens: Mensagem[];
  transferencias: Transferencia[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const [dialogo, setDialogo] = useState<Atendimento | null>(null);
  const [motivo, setMotivo] = useState("");
  const { onSubmit, erros, pendente: gravando } = useAcao(registrarMensagem, {
    aoSucesso: (_r, form) => {
      form?.reset();
      router.refresh();
    },
  });
  const a = ATENDIMENTO[atendimento];
  const ultima = transferencias[0];

  function transferir() {
    if (!dialogo) return;
    const para = dialogo;
    iniciar(async () => {
      const r = await transferirAtendimento(negocioId, para, motivo);
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        setDialogo(null);
        setMotivo("");
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  }

  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessagesSquare className="size-5 text-marca-forte" aria-hidden /> Atendimento
        </h2>
        <Selo cor={a.cor}>
          {atendimento === "agente" ? <Bot className="mr-1 size-3.5" aria-hidden /> : <UserRound className="mr-1 size-3.5" aria-hidden />}
          Com: {a.nome}
        </Selo>
      </div>
      <p className="text-sm text-texto-2">
        {atendimento === "agente" ? "O agente está conversando com o cliente" : "O atendimento está com a equipe"} desde {formatarDataHora(desde)}.
        {ultima?.motivo ? ` Recado: “${ultima.motivo}”` : ""}
      </p>
      {pode && negocioAberto && (
        <div className="mt-3 flex flex-wrap gap-2">
          {atendimento === "humano" ? (
            <Botao variante="secundario" onClick={() => setDialogo("agente")}>
              <Bot className="size-4" aria-hidden /> Passar para o agente
            </Botao>
          ) : (
            <Botao onClick={() => setDialogo("humano")}>
              <UserRound className="size-4" aria-hidden /> Assumir atendimento
            </Botao>
          )}
        </div>
      )}

      <h3 className="mt-5 mb-2 text-sm font-semibold">Conversa</h3>
      {mensagens.length === 0 ? (
        <p className="text-sm text-texto-2">Nenhuma mensagem registrada. A conversa do agente aparece aqui; você também pode registrar à mão.</p>
      ) : (
        <ol className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl bg-superficie-2 p-3" aria-label="Mensagens da conversa">
          {mensagens.map((m) => (
            <li key={m.id} className={cn("flex", m.direcao === "saida" && "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.direcao === "entrada" ? "bg-superficie text-texto" : m.autor === "agente" ? "bg-marca-suave text-texto" : "bg-ok-suave text-texto",
                )}
              >
                <p className="break-words whitespace-pre-line">{m.texto}</p>
                <p className="mt-1 text-[11px] text-texto-2">
                  {AUTORES[m.autor]} · {CANAIS[m.canal]} · {formatarDataHora(m.enviada_em)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pode && (
        <form onSubmit={onSubmit} noValidate className="mt-3 space-y-2">
          <input type="hidden" name="negocio_id" value={negocioId} />
          <label htmlFor="msg-texto" className="sr-only">
            Mensagem
          </label>
          <AreaTexto id="msg-texto" name="texto" rows={2} maxLength={8000} placeholder="Registrar uma mensagem da conversa..." aria-invalid={erros.texto ? true : undefined} />
          {erros.texto && <p className="text-sm text-perigo">{erros.texto}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="msg-quem" className="sr-only">
              Quem falou
            </label>
            <Selecao id="msg-quem" name="quem" defaultValue="cliente" className="w-auto">
              <option value="cliente">O cliente disse</option>
              <option value="humano">Eu respondi</option>
            </Selecao>
            <label htmlFor="msg-canal" className="sr-only">
              Canal
            </label>
            <Selecao id="msg-canal" name="canal" defaultValue="whatsapp" className="w-auto">
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="telefone">Telefone</option>
              <option value="email">E-mail</option>
              <option value="outro">Outro</option>
            </Selecao>
            <Botao type="submit" variante="secundario" carregando={gravando} className="ml-auto">
              <Send className="size-4" aria-hidden /> Registrar
            </Botao>
          </div>
        </form>
      )}

      {transferencias.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-texto-2">Passagens de atendimento ({transferencias.length})</summary>
          <ol className="mt-2 space-y-1.5 border-l-2 border-borda pl-3">
            {transferencias.map((t) => (
              <li key={t.id}>
                <span className="font-medium">
                  {ATENDIMENTO[t.de].nome} → {ATENDIMENTO[t.para].nome}
                </span>{" "}
                <span className="text-texto-2">
                  · {formatarDataHora(t.created_at)} · por {t.autor_tipo === "agente" ? "agente" : t.autor_tipo === "sistema" ? "sistema" : "equipe"}
                  {t.motivo ? ` · ${t.motivo}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <Modal
        aberto={dialogo !== null}
        aoFechar={() => setDialogo(null)}
        titulo={dialogo === "agente" ? "Passar para o agente" : "Assumir atendimento"}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </Botao>
            <Botao carregando={pendente} onClick={transferir}>
              {dialogo === "agente" ? "Passar para o agente" : "Assumir"}
            </Botao>
          </>
        }
      >
        <p className="mb-3 text-sm text-texto-2">
          {dialogo === "agente"
            ? "O agente passa a conversar com este cliente e a manter o negócio atualizado. Ele é avisado na hora. A proposta que ele montar continua precisando da sua aprovação."
            : "Você passa a conduzir a conversa. O agente é avisado e para de alterar este negócio."}
        </p>
        <label htmlFor="motivo-transferencia" className="text-sm font-medium">
          Recado (opcional)
        </label>
        <AreaTexto
          id="motivo-transferencia"
          rows={3}
          maxLength={500}
          value={motivo}
          onChange={(ev) => setMotivo(ev.target.value)}
          placeholder={dialogo === "agente" ? "Ex.: Cliente da Maria; quer pacote Signature para 120 pessoas." : "Ex.: Vou negociar o valor pessoalmente."}
        />
      </Modal>
    </Cartao>
  );
}
