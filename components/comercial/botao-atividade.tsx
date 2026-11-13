"use client";

/** Botão "Nova atividade" (agenda/início) com escolha do negócio. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, MessageSquarePlus } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Fab } from "@/components/ui/controles";
import { DialogoAtividade } from "./dialogo-atividade";

type Opcao = { id: string; nome: string };

export function BotaoAtividade({
  negocios,
  vendedores,
  flutuante,
}: {
  negocios: Opcao[];
  vendedores?: Opcao[];
  flutuante?: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"agendar" | "registro" | null>(null);
  return (
    <>
      <Botao variante="secundario" onClick={() => setModo("registro")}>
        <MessageSquarePlus className="size-4" aria-hidden /> Registrar interação
      </Botao>
      <Botao onClick={() => setModo("agendar")}>
        <CalendarPlus className="size-4" aria-hidden /> Nova atividade
      </Botao>
      {flutuante && (
        <Fab onClick={() => setModo("agendar")} className="md:hidden" aria-label="Nova atividade">
          <CalendarPlus className="size-6" aria-hidden />
        </Fab>
      )}
      {modo && (
        <DialogoAtividade
          aberto
          aoFechar={() => {
            setModo(null);
            router.refresh();
          }}
          modo={modo}
          negocios={negocios}
          vendedores={vendedores}
        />
      )}
    </>
  );
}
