"use client";

/**
 * Lista de atividades com ações de 1 toque: concluir, adiar, editar e excluir.
 * Usada na Agenda, na tela inicial e nas fichas de negócio/contato/empresa.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Clock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { adiarAtividade, concluirAtividade, excluirAtividade } from "@/app/(app)/agenda/actions";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import { nomeTipoAtividade, rotuloQuando, situacaoAtividade } from "@/lib/comercial";
import { formatarDataHora } from "@/lib/formatar";
import type { Atividade } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { DialogoAtividade } from "./dialogo-atividade";
import { IconeAtividade } from "./icone-atividade";

type Opcao = { id: string; nome: string };

export function ListaAtividades({
  atividades,
  agora,
  hoje,
  meuId,
  gestor,
  negocios = {},
  contatos = {},
  vendedores = [],
  mostrarVendedor = false,
  vazio = "Nada por aqui.",
}: {
  atividades: Atividade[];
  /** Date.now() do servidor (situação atrasada/hoje sem divergir na hidratação) */
  agora: number;
  hoje: string;
  meuId: string | null;
  gestor: boolean;
  negocios?: Record<string, string>;
  contatos?: Record<string, string>;
  vendedores?: Opcao[];
  mostrarVendedor?: boolean;
  vazio?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState<Atividade | null>(null);
  const nomeVendedor = new Map(vendedores.map((v) => [v.id, v.nome]));

  function executar(acao: () => Promise<{ ok: boolean; mensagem?: string }>) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  }

  if (atividades.length === 0) return <p className="rounded-xl border border-dashed border-borda p-4 text-center text-sm text-texto-2">{vazio}</p>;

  return (
    <>
      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie" aria-busy={pendente || undefined}>
        {atividades.map((a) => {
          const sit = situacaoAtividade(a.quando, a.concluida, agora);
          const pode = gestor || a.vendedor_id === meuId;
          return (
            <li key={a.id} className="flex items-start gap-3 px-3 py-3 sm:px-4">
              <button
                type="button"
                disabled={!pode || pendente}
                onClick={() => executar(() => concluirAtividade(a.id, !a.concluida))}
                aria-label={a.concluida ? `Reabrir: ${a.titulo}` : `Concluir: ${a.titulo}`}
                aria-pressed={a.concluida}
                className={cn(
                  "mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50",
                  a.concluida ? "border-ok bg-ok text-white dark:text-black" : "border-borda text-transparent hover:border-ok hover:text-ok",
                )}
              >
                <Check className="size-5" strokeWidth={3} aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("font-semibold break-words text-texto", a.concluida && "text-texto-2 line-through decoration-1")}>
                  {a.titulo}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-2">
                  <span className="inline-flex items-center gap-1">
                    <IconeAtividade tipo={a.tipo} className="size-3.5" /> {nomeTipoAtividade(a.tipo)}
                  </span>
                  <span
                    title={formatarDataHora(a.quando)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                      sit === "atrasada" && "bg-perigo-suave text-perigo",
                      sit === "hoje" && "bg-destaque-suave text-destaque-forte",
                      (sit === "futura" || sit === "concluida") && "bg-superficie-2",
                    )}
                  >
                    <Clock className="size-3" aria-hidden />
                    {sit === "atrasada" ? "Atrasada · " : ""}
                    {rotuloQuando(a.quando, hoje)}
                  </span>
                  {mostrarVendedor && nomeVendedor.get(a.vendedor_id) && <span>{nomeVendedor.get(a.vendedor_id)}</span>}
                </p>
                {(a.negocio_id && negocios[a.negocio_id]) || (a.contato_id && contatos[a.contato_id]) ? (
                  <p className="mt-1 truncate text-sm">
                    {a.negocio_id && negocios[a.negocio_id] ? (
                      <Link href={`/negocios/${a.negocio_id}`} className="font-medium text-marca-forte hover:underline">
                        {negocios[a.negocio_id]}
                      </Link>
                    ) : (
                      a.contato_id && (
                        <Link href={`/contatos/${a.contato_id}`} className="font-medium text-marca-forte hover:underline">
                          {contatos[a.contato_id]}
                        </Link>
                      )
                    )}
                  </p>
                ) : null}
                {a.descricao && <p className="mt-1 text-sm whitespace-pre-line text-texto-2">{a.descricao}</p>}
                {a.resultado && <p className="mt-1 text-sm text-texto">Resultado: {a.resultado}</p>}
              </div>
              {pode && (
                <details className="relative shrink-0">
                  <summary
                    aria-label={`Mais ações: ${a.titulo}`}
                    className="grid size-11 cursor-pointer list-none place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 [&::-webkit-details-marker]:hidden"
                  >
                    <MoreVertical className="size-5" aria-hidden />
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-borda bg-superficie p-1.5 shadow-lg">
                    {!a.concluida && (
                      <>
                        <BotaoMenu onClick={(e) => fecharMenu(e, () => executar(() => adiarAtividade(a.id, 1)))}>
                          <Clock className="size-4" aria-hidden /> Adiar 1 dia
                        </BotaoMenu>
                        <BotaoMenu onClick={(e) => fecharMenu(e, () => executar(() => adiarAtividade(a.id, 7)))}>
                          <Clock className="size-4" aria-hidden /> Adiar 1 semana
                        </BotaoMenu>
                      </>
                    )}
                    <BotaoMenu onClick={(e) => fecharMenu(e, () => setEditando(a))}>
                      <Pencil className="size-4" aria-hidden /> Editar
                    </BotaoMenu>
                    <BotaoMenu
                      className="text-perigo"
                      onClick={(e) =>
                        fecharMenu(e, async () => {
                          if (await confirmar({ titulo: "Excluir atividade?", mensagem: a.titulo, perigo: true }))
                            executar(() => excluirAtividade(a.id));
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden /> Excluir
                    </BotaoMenu>
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      <DialogoAtividade
        key={editando?.id ?? "nenhuma"}
        aberto={editando !== null}
        aoFechar={() => {
          setEditando(null);
          router.refresh();
        }}
        atividade={editando}
        vendedores={gestor ? vendedores : undefined}
      />
    </>
  );
}

function fecharMenu(e: React.MouseEvent<HTMLButtonElement>, depois: () => void) {
  e.currentTarget.closest("details")?.removeAttribute("open");
  depois();
}

function BotaoMenu({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium hover:bg-superficie-2", className)}
      {...props}
    />
  );
}
