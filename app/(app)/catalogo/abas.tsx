/** Abas do Catálogo (links). */
import Link from "next/link";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/catalogo", nome: "Pacotes" },
  { href: "/catalogo/drinks", nome: "Drinks e receitas" },
  { href: "/catalogo/insumos", nome: "Insumos e preços" },
  { href: "/catalogo/calculadora", nome: "Calculadora" },
];

export function AbasCatalogo({ atual }: { atual: string }) {
  return (
    <nav aria-label="Seções do catálogo" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
      {ABAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          aria-current={a.href === atual ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold",
            a.href === atual ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:bg-superficie-2",
          )}
        >
          {a.nome}
        </Link>
      ))}
    </nav>
  );
}
