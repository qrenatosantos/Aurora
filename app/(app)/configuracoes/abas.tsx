/** Abas de Configurações (links). */
import Link from "next/link";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/configuracoes", nome: "Empresa e regras" },
  { href: "/configuracoes/funis", nome: "Funis e etapas" },
  { href: "/configuracoes/listas", nome: "Origens e motivos" },
  { href: "/configuracoes/mensagens", nome: "Modelos de mensagem" },
];

export function AbasConfiguracoes({ atual }: { atual: string }) {
  return (
    <nav aria-label="Seções de configurações" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
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
