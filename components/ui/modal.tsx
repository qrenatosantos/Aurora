"use client";

/**
 * Janela (modal) com o <dialog> nativo: foco preso, Esc fecha, acessível.
 * No celular abre como "folha" de baixo para cima; no computador, centralizada.
 *
 *   const [aberto, setAberto] = useState(false);
 *   <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo cliente">...</Modal>
 */
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
  largo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largo?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      className={cn(
        "mx-0 mt-auto mb-0 max-h-[94dvh] w-full max-w-none rounded-t-2xl border border-borda bg-superficie p-0 text-texto shadow-xl backdrop:bg-black/55",
        "sm:m-auto sm:w-[calc(100%-3rem)] sm:rounded-2xl",
        largo ? "sm:max-w-3xl" : "sm:max-w-lg",
      )}
    >
      {aberto && (
        <div className="flex max-h-[94dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-borda py-2 pr-2 pl-5">
            <h2 id={idTitulo} className="text-lg font-semibold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={aoFechar}
              className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {rodape && (
            <div className="pb-seguro flex flex-col-reverse gap-2 border-t border-borda px-5 py-3 sm:flex-row sm:justify-end">
              {rodape}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
