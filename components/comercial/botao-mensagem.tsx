"use client";

/**
 * Botão WhatsApp/E-mail com MODELOS DE MENSAGEM (Configurações ▸ Mensagens).
 * Preenche {nome}, {empresa}, {vendedor}, {negocio}, {valor}, {link_proposta}, {validade},
 * deixa editar e abre o WhatsApp (wa.me) ou o e-mail. Registra a mensagem no histórico.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { registrarMensagem } from "@/app/(app)/agenda/actions";
import { classesBotao } from "@/components/ui/botao";
import { AreaTexto } from "@/components/ui/campo";
import { Chip } from "@/components/ui/controles";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { montarMensagem } from "@/lib/comercial";
import type { ModeloMensagem } from "@/lib/tipos";
import { linkWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export type DadosMensagem = {
  nome?: string | null;
  empresa?: string | null;
  vendedor?: string | null;
  negocio?: string | null;
  valor?: string | null;
  link_proposta?: string | null;
  validade?: string | null;
};

export function BotaoMensagem({
  canal = "whatsapp",
  telefone,
  email,
  modelos,
  dados,
  negocioId,
  contatoId,
  empresaId,
  modeloInicial,
  texto,
  compacto,
  className,
}: {
  canal?: "whatsapp" | "email";
  telefone?: string | null;
  email?: string | null;
  modelos: ModeloMensagem[];
  dados: DadosMensagem;
  negocioId?: string | null;
  contatoId?: string | null;
  empresaId?: string | null;
  /** Título do modelo a escolher primeiro (ex.: "Envio de proposta") */
  modeloInicial?: string;
  texto?: string;
  compacto?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const lista = modelos.filter((m) => m.ativo && m.canal === canal);
  const inicial = lista.find((m) => m.titulo === modeloInicial) ?? lista[0];
  const [aberto, setAberto] = useState(false);
  const [modeloId, setModeloId] = useState(inicial?.id ?? "");
  const [mensagem, setMensagem] = useState(inicial ? montarMensagem(inicial.texto, dados) : "");

  const whats = canal === "whatsapp";
  const destino = whats ? telefone : email;
  const Icone = whats ? MessageCircle : Mail;
  const rotulo = texto ?? (whats ? "WhatsApp" : "E-mail");

  function escolher(m: ModeloMensagem) {
    setModeloId(m.id);
    setMensagem(montarMensagem(m.texto, dados));
  }

  function registrar() {
    const titulo = lista.find((m) => m.id === modeloId)?.titulo;
    void registrarMensagem({
      canal,
      texto: mensagem,
      negocioId,
      contatoId,
      empresaId,
      titulo: titulo ? `${whats ? "WhatsApp" : "E-mail"}: ${titulo}` : undefined,
    }).then((r) => {
      if (r.ok) router.refresh();
    });
    setAberto(false);
  }

  const href = whats
    ? linkWhatsApp(destino, mensagem)
    : `mailto:${encodeURIComponent(destino ?? "")}?subject=${encodeURIComponent(dados.negocio ?? "Contato")}&body=${encodeURIComponent(mensagem)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={!destino}
        title={!destino ? (whats ? "Cadastre o telefone do contato" : "Cadastre o e-mail do contato") : undefined}
        aria-label={compacto ? `${rotulo}${dados.nome ? ` para ${dados.nome}` : ""}` : undefined}
        className={cn(
          compacto
            ? "grid size-11 place-items-center rounded-xl border border-borda bg-superficie hover:bg-superficie-2 disabled:opacity-40"
            : classesBotao("secundario"),
          whats && "text-whats",
          className,
        )}
      >
        <Icone className="size-5" aria-hidden />
        {!compacto && <span className="text-texto">{rotulo}</span>}
      </button>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={whats ? "Mensagem no WhatsApp" : "Enviar e-mail"}>
        <div className="space-y-4">
          {lista.length > 0 ? (
            <div role="group" aria-label="Modelos de mensagem" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {lista.map((m) => (
                <Chip key={m.id} ativo={m.id === modeloId} onClick={() => escolher(m)}>
                  {m.titulo}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-texto-2">Sem modelos cadastrados (Configurações ▸ Mensagens). Escreva a mensagem abaixo.</p>
          )}
          <label className="block text-sm font-medium text-texto" htmlFor="texto-mensagem">
            Mensagem (pode editar)
          </label>
          <AreaTexto id="texto-mensagem" rows={7} value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={2000} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={classesBotao("secundario")}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mensagem);
                  toast.info("Texto copiado.");
                } catch {
                  toast.erro("Não foi possível copiar.");
                }
              }}
            >
              <Copy className="size-4" aria-hidden /> Copiar
            </button>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={registrar}
              className={cn(classesBotao("primario"), whats && "bg-whats text-white hover:bg-whats/90 dark:text-white")}
            >
              <Icone className="size-4" aria-hidden /> {whats ? "Abrir WhatsApp" : "Abrir e-mail"}
            </a>
          </div>
          <p className="text-xs text-texto-2">Ao abrir, a mensagem fica registrada no histórico de atividades.</p>
        </div>
      </Modal>
    </>
  );
}
