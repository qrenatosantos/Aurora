"use client";

/**
 * Topo do negócio: barra de etapas (toque para mudar), Ganho / Perdido / Reabrir,
 * Editar, Excluir, registro rápido de interação e agendamento de atividade.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarPlus, MessageSquarePlus, Pencil, RotateCcw, ThumbsDown, Trash2, Trophy } from "lucide-react";
import { excluirNegocio, ganharNegocio, moverNegocio, reabrirNegocio } from "@/app/(app)/negocios/actions";
import { DialogoAtividade } from "@/components/comercial/dialogo-atividade";
import { DialogoNegocio, type OpcoesNegocio } from "@/components/comercial/dialogo-negocio";
import { DialogoPerda } from "@/components/comercial/dialogo-perda";
import { Botao } from "@/components/ui/botao";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import type { Etapa, MotivoPerda, Negocio } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function BarraEtapas({ negocio, etapas, pode }: { negocio: Negocio; etapas: Etapa[]; pode: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const [otimista, setOtimista] = useState<string | null>(null);
  const atual = otimista ?? negocio.etapa_id;
  const idx = etapas.findIndex((e) => e.id === atual);
  const aberto = negocio.status === "aberto";

  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Etapas do funil">
      {etapas.map((e, i) => {
        const feita = i < idx || (!aberto && i <= idx);
        const atualE = i === idx;
        return (
          <li key={e.id} className="min-w-24 flex-1">
            <button
              type="button"
              disabled={!pode || !aberto || pendente || atualE}
              aria-current={atualE ? "step" : undefined}
              onClick={() =>
                iniciar(async () => {
                  setOtimista(e.id);
                  const r = await moverNegocio(negocio.id, e.id);
                  if (r.ok) {
                    toast.sucesso(r.mensagem ?? "Etapa alterada.");
                    router.refresh();
                  } else {
                    setOtimista(null);
                    toast.erro(r.mensagem ?? "Não foi possível.");
                  }
                })
              }
              className={cn(
                "flex min-h-11 w-full flex-col justify-center rounded-lg px-2 py-1 text-left text-xs font-bold transition-colors disabled:cursor-default",
                atualE && aberto
                  ? "bg-marca text-marca-texto"
                  : feita
                    ? "bg-marca-suave text-marca-forte"
                    : "bg-superficie-2 text-texto-2 enabled:hover:bg-borda",
              )}
              title={pode && aberto && !atualE ? `Mover para ${e.nome}` : e.nome}
            >
              <span className="truncate">{e.nome}</span>
              <span className="font-semibold opacity-80">{e.probabilidade}%</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function AcoesNegocio({
  negocio,
  opcoes,
  motivos,
  temProdutos,
  pode,
}: {
  negocio: Negocio;
  opcoes: OpcoesNegocio;
  motivos: MotivoPerda[];
  temProdutos: boolean;
  pode: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [editar, setEditar] = useState(false);
  const [perder, setPerder] = useState(false);
  const [atividade, setAtividade] = useState<"registro" | "agendar" | null>(null);

  function executar(acao: () => Promise<{ ok: boolean; mensagem?: string }>, depois?: () => void) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        if (depois) depois();
        else router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  }

  if (!pode) return null;

  return (
    <div className="flex flex-wrap gap-2 nao-imprimir">
      {negocio.status === "aberto" ? (
        <>
          <Botao
            className="bg-ok text-white hover:bg-ok/90 dark:text-black"
            carregando={pendente}
            onClick={async () => {
              if (!(Number(negocio.valor) > 0)) {
                toast.erro("Adicione produtos ou um valor antes de marcar como ganho.");
                return;
              }
              if (await confirmar({ titulo: "Marcar como GANHO?", mensagem: "A comissão será calculada e o negócio sai do funil.", textoConfirmar: "Sim, ganhamos!" }))
                executar(() => ganharNegocio(negocio.id));
            }}
          >
            <Trophy className="size-4" aria-hidden /> Ganho
          </Botao>
          <Botao variante="secundario" className="text-perigo" onClick={() => setPerder(true)}>
            <ThumbsDown className="size-4" aria-hidden /> Perdido
          </Botao>
        </>
      ) : (
        <Botao
          variante="secundario"
          carregando={pendente}
          onClick={async () => {
            if (await confirmar({ titulo: "Reabrir o negócio?", mensagem: "Ele volta para o funil. Uma comissão ainda não paga é removida." }))
              executar(() => reabrirNegocio(negocio.id));
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Reabrir
        </Botao>
      )}
      <Botao variante="secundario" onClick={() => setAtividade("registro")}>
        <MessageSquarePlus className="size-4" aria-hidden /> Registrar interação
      </Botao>
      <Botao variante="secundario" onClick={() => setAtividade("agendar")}>
        <CalendarPlus className="size-4" aria-hidden /> Agendar
      </Botao>
      <Botao variante="fantasma" onClick={() => setEditar(true)}>
        <Pencil className="size-4" aria-hidden /> Editar
      </Botao>
      <Botao
        variante="fantasma"
        className="text-perigo"
        aria-label="Excluir negócio"
        onClick={async () => {
          if (
            await confirmar({
              titulo: "Excluir este negócio?",
              mensagem: "Apaga também as atividades, propostas e o histórico dele. Não dá para desfazer.",
              perigo: true,
            })
          )
            executar(
              () => excluirNegocio(negocio.id),
              () => router.push("/funil"),
            );
        }}
      >
        <Trash2 className="size-4" aria-hidden />
      </Botao>

      <DialogoNegocio
        key={editar ? "editar" : "fechado"}
        aberto={editar}
        aoFechar={() => setEditar(false)}
        opcoes={opcoes}
        negocio={negocio}
        temProdutos={temProdutos}
      />
      <DialogoPerda aberto={perder} aoFechar={() => setPerder(false)} aoPerder={() => router.refresh()} negocio={negocio} motivos={motivos} />
      <DialogoAtividade
        key={atividade ?? "nenhuma"}
        aberto={atividade !== null}
        aoFechar={() => {
          setAtividade(null);
          router.refresh();
        }}
        modo={atividade ?? "agendar"}
        contexto={{ negocioId: negocio.id, contatoId: negocio.contato_id, empresaId: negocio.empresa_id }}
        vendedores={opcoes.gestor ? opcoes.vendedores : undefined}
      />
    </div>
  );
}
