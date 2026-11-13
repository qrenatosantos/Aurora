"use client";

/** Botão "Novo contato" / "Nova empresa" que abre o formulário em janela. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Fab } from "@/components/ui/controles";
import { DialogoContato, DialogoEmpresa, type OpcoesCadastro } from "./dialogos-cadastro";

export function BotaoCadastro({
  tipo,
  opcoes,
  empresaInicial,
  flutuante,
}: {
  tipo: "contato" | "empresa";
  opcoes: OpcoesCadastro;
  empresaInicial?: string;
  /** Também mostra o botão flutuante no celular */
  flutuante?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const rotulo = tipo === "contato" ? "Novo contato" : "Nova empresa";
  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        <Plus className="size-4" aria-hidden /> {rotulo}
      </Botao>
      {flutuante && (
        <Fab onClick={() => setAberto(true)} className="md:hidden" aria-label={rotulo}>
          <Plus className="size-6" strokeWidth={2.6} aria-hidden />
        </Fab>
      )}
      {tipo === "contato" ? (
        <DialogoContato key={String(aberto)} aberto={aberto} aoFechar={() => setAberto(false)} opcoes={opcoes} empresaInicial={empresaInicial} />
      ) : (
        <DialogoEmpresa key={String(aberto)} aberto={aberto} aoFechar={() => setAberto(false)} opcoes={opcoes} />
      )}
    </>
  );
}
