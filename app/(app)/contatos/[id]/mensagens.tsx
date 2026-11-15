"use client";

/**
 * Preferências de mensagens do contato: "não contatar" e consentimento para retomadas.
 * O agente lê e grava os mesmos campos pela API; as datas são do banco.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellOff, MessageCircleMore } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao, Selo } from "@/components/ui/cartao";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatarDataHora } from "@/lib/formatar";
import type { Contato } from "@/lib/tipos";
import { salvarPreferenciasContato } from "../actions";

type Props = Pick<Contato, "id" | "nao_contatar" | "nao_contatar_em" | "nao_contatar_motivo" | "aceita_retomadas" | "aceita_retomadas_em"> & { pode: boolean };

export function PreferenciasMensagens(c: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  const salvar = (prefs: { nao_contatar: boolean; nao_contatar_motivo?: string | null; aceita_retomadas: boolean }) =>
    iniciar(async () => {
      const r = await salvarPreferenciasContato(c.id, prefs);
      if (!r.ok) return toast.erro(r.mensagem ?? "Não foi possível salvar.");
      toast.sucesso(r.mensagem ?? "Salvo.");
      setAberto(false);
      router.refresh();
    });

  return (
    <Cartao>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
        <MessageCircleMore className="size-5 text-marca-forte" aria-hidden /> Mensagens
      </h2>
      {c.nao_contatar ? (
        <div className="mb-3 rounded-xl bg-perigo-suave p-3 text-sm text-perigo">
          <p className="font-semibold">Não quer receber mensagens</p>
          <p>
            Desde {formatarDataHora(c.nao_contatar_em)}
            {c.nao_contatar_motivo ? ` · ${c.nao_contatar_motivo}` : ""}
          </p>
          <p className="mt-1 text-xs">Ninguém da equipe nem o agente deve puxar conversa. Responder quando a pessoa chamar continua liberado.</p>
        </div>
      ) : (
        <ul className="mb-3 space-y-1 text-sm">
          <li className="flex flex-wrap items-center gap-2">
            Retomadas:{" "}
            {c.aceita_retomadas ? (
              <Selo cor="ok">aceita · desde {formatarDataHora(c.aceita_retomadas_em)}</Selo>
            ) : (
              <Selo>sem consentimento{c.aceita_retomadas_em ? ` · recusou em ${formatarDataHora(c.aceita_retomadas_em)}` : ""}</Selo>
            )}
          </li>
        </ul>
      )}
      {c.pode && (
        <div className="flex flex-col gap-2">
          {c.nao_contatar ? (
            <Botao variante="secundario" carregando={pendente} onClick={() => salvar({ nao_contatar: false, aceita_retomadas: false })}>
              A pessoa voltou a aceitar mensagens
            </Botao>
          ) : (
            <>
              <Botao variante="secundario" carregando={pendente && !aberto} onClick={() => salvar({ nao_contatar: false, aceita_retomadas: !c.aceita_retomadas })}>
                {c.aceita_retomadas ? "Retirar o consentimento de retomadas" : "Registrar que aceita retomadas"}
              </Botao>
              <Botao
                variante="fantasma"
                className="!text-perigo"
                onClick={() => {
                  setMotivo("");
                  setAberto(true);
                }}
              >
                <BellOff className="size-4" aria-hidden /> Pediu para não receber mensagens
              </Botao>
            </>
          )}
        </div>
      )}

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Não contatar esta pessoa?">
        <div className="space-y-4 text-sm">
          <p>A partir de agora, nem a equipe nem o agente puxam conversa nem mandam retomadas. Se a pessoa chamar, pode responder normalmente.</p>
          <label className="block">
            <span className="mb-1 block font-medium">Motivo (opcional)</span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Ex.: pediu por telefone em 15/11"
              className="min-h-11 w-full rounded-xl border border-borda bg-superficie px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-marca"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" carregando={pendente} onClick={() => salvar({ nao_contatar: true, nao_contatar_motivo: motivo, aceita_retomadas: false })}>
              Não contatar
            </Botao>
          </div>
        </div>
      </Modal>
    </Cartao>
  );
}
