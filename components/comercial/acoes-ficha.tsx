"use client";

/** Ações da ficha de contato/empresa: editar, novo negócio, registrar interação, agendar e excluir. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarPlus, Handshake, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { excluirContato, excluirEmpresa } from "@/app/(app)/contatos/actions";
import { Botao } from "@/components/ui/botao";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import type { Contato, Empresa } from "@/lib/tipos";
import { DialogoAtividade } from "./dialogo-atividade";
import { DialogoNegocio, type OpcoesNegocio } from "./dialogo-negocio";
import { DialogoContato, DialogoEmpresa, type OpcoesCadastro } from "./dialogos-cadastro";

export function AcoesFicha({
  contato,
  empresa,
  opcoesCadastro,
  opcoesNegocio,
  pode,
}: {
  contato?: Contato;
  empresa?: Empresa;
  opcoesCadastro: OpcoesCadastro;
  opcoesNegocio: OpcoesNegocio;
  pode: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState<"editar" | "negocio" | "registro" | "agendar" | null>(null);
  const fechar = () => setAberto(null);
  const contexto = {
    contatoId: contato?.id ?? null,
    empresaId: contato?.empresa_id ?? empresa?.id ?? null,
  };

  return (
    <div className="flex flex-wrap gap-2 nao-imprimir">
      <Botao onClick={() => setAberto("negocio")}>
        <Handshake className="size-4" aria-hidden /> Novo negócio
      </Botao>
      <Botao variante="secundario" onClick={() => setAberto("registro")}>
        <MessageSquarePlus className="size-4" aria-hidden /> Registrar interação
      </Botao>
      <Botao variante="secundario" onClick={() => setAberto("agendar")}>
        <CalendarPlus className="size-4" aria-hidden /> Agendar
      </Botao>
      {pode && (
        <>
          <Botao variante="fantasma" onClick={() => setAberto("editar")}>
            <Pencil className="size-4" aria-hidden /> Editar
          </Botao>
          <Botao
            variante="fantasma"
            className="text-perigo"
            aria-label="Excluir"
            carregando={pendente}
            onClick={async () => {
              const nome = contato?.nome ?? empresa?.nome ?? "";
              if (!(await confirmar({ titulo: `Excluir ${nome}?`, mensagem: "Os negócios continuam, só ficam sem este vínculo.", perigo: true })))
                return;
              iniciar(async () => {
                const r = contato ? await excluirContato(contato.id) : await excluirEmpresa(empresa!.id);
                if (r.ok) {
                  toast.sucesso(r.mensagem ?? "Excluído.");
                  router.push(contato ? "/contatos" : "/empresas");
                } else toast.erro(r.mensagem ?? "Não foi possível excluir.");
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </Botao>
        </>
      )}

      {aberto === "editar" &&
        (contato ? (
          <DialogoContato aberto aoFechar={fechar} opcoes={opcoesCadastro} contato={contato} />
        ) : (
          <DialogoEmpresa aberto aoFechar={fechar} opcoes={opcoesCadastro} empresa={empresa} />
        ))}
      {aberto === "negocio" && (
        <DialogoNegocio
          aberto
          aoFechar={fechar}
          opcoes={opcoesNegocio}
          inicial={{ contatoId: contato?.id, empresaId: contexto.empresaId ?? undefined }}
        />
      )}
      {(aberto === "registro" || aberto === "agendar") && (
        <DialogoAtividade
          aberto
          aoFechar={() => {
            fechar();
            router.refresh();
          }}
          modo={aberto}
          contexto={contexto}
          vendedores={opcoesNegocio.gestor ? opcoesNegocio.vendedores : undefined}
        />
      )}
    </div>
  );
}
