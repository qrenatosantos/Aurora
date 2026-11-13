"use client";

/** Modelos de mensagem (WhatsApp / e-mail) com variáveis {nome}, {empresa}, {valor}... */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { excluirModelo, salvarModelo } from "@/app/(app)/configuracoes/actions";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { VARIAVEIS_MODELO } from "@/lib/comercial";
import type { ModeloMensagem } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";

export function Modelos({ modelos }: { modelos: ModeloMensagem[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const [editando, setEditando] = useState<ModeloMensagem | "novo" | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Botao onClick={() => setEditando("novo")}>
          <Plus className="size-4" aria-hidden /> Novo modelo
        </Botao>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {modelos.map((m) => (
          <li key={m.id} className="flex flex-col rounded-2xl border border-borda bg-superficie p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              {m.canal === "whatsapp" ? <MessageCircle className="size-4 text-whats" aria-hidden /> : <Mail className="size-4" aria-hidden />}
              {m.titulo} {!m.ativo && <Selo>Inativo</Selo>}
            </p>
            <p className="line-clamp-4 flex-1 text-sm whitespace-pre-line text-texto-2">{m.texto.replace(/\\n/g, "\n")}</p>
            <div className="mt-3 flex gap-2">
              <Botao variante="secundario" onClick={() => setEditando(m)}>
                <Pencil className="size-4" aria-hidden /> Editar
              </Botao>
              <Botao
                variante="fantasma"
                className="text-perigo"
                aria-label={`Excluir ${m.titulo}`}
                onClick={async () => {
                  if (await confirmar({ titulo: `Excluir “${m.titulo}”?`, perigo: true }))
                    iniciar(async () => {
                      const r = await excluirModelo(m.id);
                      if (r.ok) {
                        toast.sucesso(r.mensagem ?? "Excluído.");
                        router.refresh();
                      } else toast.erro(r.mensagem ?? "Não foi possível.");
                    });
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Botao>
            </div>
          </li>
        ))}
      </ul>
      {editando && (
        <DialogoModelo
          modelo={editando === "novo" ? null : editando}
          aoFechar={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function DialogoModelo({ modelo, aoFechar }: { modelo: ModeloMensagem | null; aoFechar: () => void }) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarModelo, { aoSucesso: aoFechar });
  return (
    <Modal aberto aoFechar={aoFechar} titulo={modelo ? "Editar modelo" : "Novo modelo"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {modelo && <input type="hidden" name="id" value={modelo.id} />}
        <div className="grid grid-cols-[1fr_9rem] gap-3">
          <Campo rotulo="Título" nome="titulo" erro={e.titulo}>
            {(p) => <Entrada {...p} defaultValue={modelo?.titulo ?? ""} maxLength={60} required autoFocus />}
          </Campo>
          <Campo rotulo="Canal" nome="canal" erro={e.canal}>
            {(p) => (
              <Selecao {...p} defaultValue={modelo?.canal ?? "whatsapp"}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
              </Selecao>
            )}
          </Campo>
        </div>
        <Campo rotulo="Mensagem" nome="texto" erro={e.texto} ajuda={`Variáveis: ${VARIAVEIS_MODELO.map((v) => `{${v}}`).join(" ")}`}>
          {(p) => <AreaTexto {...p} rows={7} maxLength={2000} defaultValue={modelo?.texto.replace(/\\n/g, "\n") ?? ""} />}
        </Campo>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="ativo" defaultChecked={modelo?.ativo ?? true} className="size-5 accent-[var(--marca)]" /> Ativo
        </label>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pendente}>
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
