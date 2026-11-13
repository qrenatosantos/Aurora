"use client";

/** Aceite da proposta pelo cliente (nome + "li e concordo") e botão de imprimir. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Printer } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { useToast } from "@/components/ui/toast";
import { aceitarPeloLink } from "./actions";

export function FormAceite({ codigo, total }: { codigo: string; total: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        iniciar(async () => {
          const r = await aceitarPeloLink(codigo, String(f.get("nome") ?? ""), f.get("concordo") === "on");
          setErros(r.erros ?? {});
          if (r.ok) {
            toast.sucesso(r.mensagem ?? "Proposta aceita!");
            router.refresh();
          } else toast.erro(r.mensagem ?? "Não foi possível aceitar.");
        });
      }}
    >
      <Campo rotulo="Seu nome completo" nome="nome" erro={erros.nome}>
        {(p) => <Entrada {...p} autoComplete="name" maxLength={120} placeholder="Nome de quem está aceitando" required />}
      </Campo>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="concordo" className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" aria-invalid={erros.concordo ? true : undefined} />
        <span>
          Li a proposta e concordo com os itens, valores ({total}) e condições. Sei que o aceite fica registrado com data, hora e endereço de
          internet (IP).
        </span>
      </label>
      {erros.concordo && (
        <p role="alert" className="text-sm text-perigo">
          {erros.concordo}
        </p>
      )}
      <button
        type="submit"
        disabled={pendente}
        aria-busy={pendente || undefined}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ok px-6 text-base font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 sm:w-auto dark:text-black"
      >
        <Check className="size-5" aria-hidden /> {pendente ? "Registrando..." : "Aceitar proposta"}
      </button>
    </form>
  );
}

export function BotaoImprimir() {
  return (
    <Botao variante="secundario" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Imprimir / PDF
    </Botao>
  );
}
