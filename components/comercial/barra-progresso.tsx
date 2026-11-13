/** Barra de progresso de meta, com marcador da PROJEÇÃO do mês. Sem "use client". */
import { cn } from "@/lib/utils";

export function BarraProgresso({
  atual,
  meta,
  projecao,
  rotulo,
  className,
}: {
  atual: number;
  meta: number;
  /** Quanto deve fechar no fim do mês, mantendo o ritmo */
  projecao?: number | null;
  rotulo: string;
  className?: string;
}) {
  const pct = meta > 0 ? (atual / meta) * 100 : 0;
  const proj = meta > 0 && projecao ? Math.min(100, (projecao / meta) * 100) : null;
  const batida = pct >= 100;
  return (
    <div className={cn("relative h-3 w-full overflow-visible rounded-full bg-superficie-2", className)}>
      <div
        role="progressbar"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(pct, 100))}
        className={cn("h-full rounded-full transition-all", batida ? "bg-menta" : pct >= 70 ? "bg-marca" : "bg-destaque")}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      {proj !== null && !batida && (
        <span
          aria-hidden
          title="Projeção para o fim do mês"
          className="absolute -top-1 h-5 w-0.5 rounded bg-texto-2"
          style={{ left: `calc(${proj}% - 1px)` }}
        />
      )}
    </div>
  );
}
