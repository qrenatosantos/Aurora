"use client";

/** Cria a proposta a partir do negócio (copia os produtos) e abre o editor. */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FilePlus2 } from "lucide-react";
import { criarProposta } from "@/app/(app)/propostas/actions";
import { Botao } from "@/components/ui/botao";
import { useToast } from "@/components/ui/toast";

export function BotaoNovaProposta({ negocioId, variante = "primario" }: { negocioId: string; variante?: "primario" | "secundario" }) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  return (
    <Botao
      variante={variante}
      carregando={pendente}
      onClick={() =>
        iniciar(async () => {
          const r = await criarProposta(negocioId);
          if (r.ok && r.dados?.id) {
            toast.sucesso(r.mensagem ?? "Proposta criada.");
            router.push(`/propostas/${r.dados.id}`);
          } else toast.erro(r.mensagem ?? "Não foi possível criar a proposta.");
        })
      }
    >
      <FilePlus2 className="size-4" aria-hidden /> Nova proposta
    </Botao>
  );
}
