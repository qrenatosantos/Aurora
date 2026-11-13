"use client";

/** Lista simples editável (origens do lead / motivos de perda): adicionar, renomear, ativar e excluir. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { excluirItemLista, salvarItemLista } from "@/app/(app)/configuracoes/actions";
import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import type { ItemListaRow } from "@/lib/tipos";

export function EditorLista({
  tabela,
  titulo,
  ajuda,
  itens,
}: {
  tabela: "origens" | "motivos_perda";
  titulo: string;
  ajuda: string;
  itens: ItemListaRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [novo, setNovo] = useState("");
  const [editados, setEditados] = useState<Record<string, { nome: string; ativo: boolean }>>({});

  function executar(acao: () => Promise<{ ok: boolean; mensagem?: string }>, depois?: () => void) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Salvo.");
        depois?.();
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  }

  return (
    <Cartao className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="text-sm text-texto-2">{ajuda}</p>
      </div>
      <ul className="space-y-2">
        {itens.map((i) => {
          const ed = editados[i.id] ?? { nome: i.nome, ativo: i.ativo };
          const mudou = ed.nome !== i.nome || ed.ativo !== i.ativo;
          return (
            <li key={i.id} className="flex items-center gap-2">
              <label className="flex-1">
                <span className="sr-only">Nome</span>
                <Entrada value={ed.nome} maxLength={80} onChange={(e) => setEditados((m) => ({ ...m, [i.id]: { ...ed, nome: e.target.value } }))} />
              </label>
              <label className="flex min-h-11 items-center gap-1.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={ed.ativo}
                  onChange={(e) => setEditados((m) => ({ ...m, [i.id]: { ...ed, ativo: e.target.checked } }))}
                  className="size-5 accent-[var(--marca)]"
                />
                Ativo
              </label>
              {mudou && (
                <Botao
                  aria-label={`Salvar ${ed.nome}`}
                  carregando={pendente}
                  onClick={() =>
                    executar(
                      () => salvarItemLista(tabela, { id: i.id, ...ed }),
                      () =>
                        setEditados((m) => {
                          const n = { ...m };
                          delete n[i.id];
                          return n;
                        }),
                    )
                  }
                >
                  <Save className="size-4" aria-hidden />
                </Botao>
              )}
              <Botao
                variante="fantasma"
                className="text-perigo"
                aria-label={`Excluir ${i.nome}`}
                onClick={async () => {
                  if (await confirmar({ titulo: `Excluir “${i.nome}”?`, mensagem: "Se já foi usado, prefira desmarcar Ativo.", perigo: true }))
                    executar(() => excluirItemLista(tabela, i.id));
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Botao>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.trim()) executar(() => salvarItemLista(tabela, { nome: novo, ativo: true }), () => setNovo(""));
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Novo item</span>
          <Entrada value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Adicionar…" maxLength={80} />
        </label>
        <Botao type="submit" variante="secundario" carregando={pendente}>
          <Plus className="size-4" aria-hidden /> Adicionar
        </Botao>
      </form>
    </Cartao>
  );
}
