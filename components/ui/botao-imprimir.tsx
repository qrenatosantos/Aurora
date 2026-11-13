"use client";

/** Abre a janela de impressão do navegador (lá dá para escolher "Salvar como PDF"). */
import { Printer } from "lucide-react";
import { Botao } from "./botao";

export function BotaoImprimir({ texto = "Imprimir / salvar PDF" }: { texto?: string }) {
  return (
    <Botao onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> {texto}
    </Botao>
  );
}
