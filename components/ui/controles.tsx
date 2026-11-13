/**
 * Controles de toque rápido: Interruptor (liga/desliga), Chip (filtro), Fab (botão flutuante)
 * e EntradaMoeda (campo com "R$"). Sem "use client": só repassam props.
 */
import { cn } from "@/lib/utils";

/** Interruptor acessível (role="switch"). Use onClick para alternar. */
export function Interruptor({
  ligado,
  rotulo,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "role"> & { ligado: boolean; rotulo?: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      className={cn(
        "inline-flex min-h-11 items-center gap-3 text-left font-semibold disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          ligado ? "bg-ok" : "bg-borda",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
            ligado && "translate-x-5",
          )}
        />
      </span>
      {rotulo}
    </button>
  );
}

/** Chip de filtro/atalho: aria-pressed indica o selecionado. */
export function Chip({
  ativo,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
        ativo ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie text-texto hover:bg-superficie-2",
        className,
      )}
      {...props}
    />
  );
}

/** Grupo de opções lado a lado (ex.: "Em reais" | "Em %"). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: React.ReactNode }[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="grid auto-cols-fr grid-flow-col gap-1.5 rounded-2xl bg-superficie-2 p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => aoMudar(o.valor)}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold",
            o.valor === valor ? "bg-superficie text-marca-forte shadow-sm" : "text-texto-2 hover:text-texto",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Botão flutuante (canto inferior direito, acima da barra do celular). */
export function Fab({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "nao-imprimir fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-marca pr-5 pl-4 text-base font-extrabold text-marca-texto shadow-lg shadow-marca/40 hover:bg-marca-forte transition-transform active:scale-95 md:right-8 md:bottom-8",
        className,
      )}
      {...props}
    />
  );
}

const estiloMoeda =
  "block w-full min-h-11 rounded-xl border border-borda bg-superficie py-2 pr-3 pl-11 text-base font-bold text-texto num " +
  "placeholder:text-texto-2/60 focus:border-marca focus:outline-none focus:ring-2 focus:ring-foco/40 aria-[invalid=true]:border-perigo";

/** Campo de valor em reais: <EntradaMoeda {...p} defaultValue="12,50" /> */
export function EntradaMoeda({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-bold text-texto-2">
        R$
      </span>
      <input inputMode="decimal" autoComplete="off" className={cn(estiloMoeda, className)} {...props} />
    </div>
  );
}

/** 12.5 → "12,50" (para preencher campos de valor) */
export function valorCampo(n: number | null | undefined) {
  return n || n === 0 ? Number(n).toFixed(2).replace(".", ",") : "";
}
