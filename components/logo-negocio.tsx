/**
 * LOGO DO NEGÓCIO — use em qualquer lugar (menu, login, documentos impressos, recibos).
 *
 *   // Server Component:
 *   const marca = await obterMarca();            // de "@/lib/marca-servidor"
 *   <LogoNegocio nome={marca.nome} logoUrl={marca.logoUrl} tamanho="lg" />
 *
 * Sem logo enviada na Personalização, mostra o ícone da Aurora (public/aurora/favicon.svg).
 * Funciona em Server e Client Components (não usa hooks).
 */
import { cn } from "@/lib/utils";

const TAMANHOS = {
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

export type TamanhoLogo = keyof typeof TAMANHOS;

export function LogoNegocio({
  nome,
  logoUrl,
  tamanho = "md",
  decorativa = true,
  className,
}: {
  nome: string;
  logoUrl?: string | null;
  tamanho?: TamanhoLogo;
  /** true (padrão) quando o nome já aparece escrito ao lado — leitores de tela ignoram a imagem. */
  decorativa?: boolean;
  className?: string;
}) {
  const classes = cn(TAMANHOS[tamanho], "shrink-0 rounded-xl", className);
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo vem do Supabase Storage (qualquer domínio)
      <img
        src={logoUrl}
        alt={decorativa ? "" : `Logo de ${nome}`}
        className={cn(classes, "object-contain")}
        data-logo-negocio=""
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG local (public/aurora), sem otimização
    <img
      src="/aurora/favicon.svg"
      alt={decorativa ? "" : `Logo de ${nome}`}
      className={cn(classes, "object-contain [print-color-adjust:exact]")}
      data-logo-negocio=""
    />
  );
}
