"use client";

/**
 * Nova atividade / editar / REGISTRO RÁPIDO de interação (já concluída, agora).
 *   <DialogoAtividade aberto={...} aoFechar={...} contexto={{ negocioId }} modo="registro" />
 */
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { salvarAtividade } from "@/app/(app)/agenda/actions";
import { TIPOS_ATIVIDADE, isoParaLocal } from "@/lib/comercial";
import type { Atividade, TipoAtividade } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { cn } from "@/lib/utils";
import { IconeAtividade } from "./icone-atividade";

export type ContextoAtividade = {
  negocioId?: string | null;
  contatoId?: string | null;
  empresaId?: string | null;
};

type Opcao = { id: string; nome: string };

export function DialogoAtividade({
  aberto,
  aoFechar,
  contexto = {},
  atividade,
  modo = "agendar",
  vendedores,
  negocios,
}: {
  aberto: boolean;
  aoFechar: () => void;
  contexto?: ContextoAtividade;
  atividade?: Atividade | null;
  /** "registro" = interação que já aconteceu (concluída, agora) */
  modo?: "agendar" | "registro";
  /** Só para o gestor: escolher o vendedor responsável */
  vendedores?: Opcao[];
  /** Para ligar a um negócio (agenda) */
  negocios?: Opcao[];
}) {
  const registro = !atividade && modo === "registro";
  const [tipo, setTipo] = useState<TipoAtividade>(atividade?.tipo ?? (registro ? "ligacao" : "tarefa"));
  const { onSubmit, erros: e, pendente } = useAcao(salvarAtividade, { aoSucesso: () => aoFechar() });

  const padraoQuando = () => {
    if (atividade) return isoParaLocal(atividade.quando);
    const d = new Date();
    if (!registro) {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    }
    return isoParaLocal(d.toISOString());
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={atividade ? "Editar atividade" : registro ? "Registrar interação" : "Agendar atividade"}
    >
      {aberto && (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {atividade && <input type="hidden" name="id" value={atividade.id} />}
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="negocio_id" value={atividade?.negocio_id ?? contexto.negocioId ?? ""} />
          <input type="hidden" name="contato_id" value={atividade?.contato_id ?? contexto.contatoId ?? ""} />
          <input type="hidden" name="empresa_id" value={atividade?.empresa_id ?? contexto.empresaId ?? ""} />
          {registro && <input type="hidden" name="concluida" value="1" />}

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-texto">Tipo</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TIPOS_ATIVIDADE.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tipo === t.id}
                  onClick={() => setTipo(t.id)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold",
                    tipo === t.id ? "border-marca bg-marca-suave text-marca-forte" : "border-borda text-texto-2 hover:bg-superficie-2",
                  )}
                >
                  <IconeAtividade tipo={t.id} className="size-5" />
                  {t.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <Campo rotulo={registro ? "O que aconteceu" : "Título"} nome="titulo" erro={e.titulo}>
            {(p) => (
              <Entrada
                {...p}
                defaultValue={atividade?.titulo ?? ""}
                placeholder={registro ? "Ex.: Liguei, cliente pediu desconto à vista" : "Ex.: Ligar para confirmar a reunião"}
                maxLength={160}
                required
                autoFocus
              />
            )}
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo={registro ? "Quando foi" : "Data e hora"} nome="quando" erro={e.quando}>
              {(p) => <Entrada {...p} type="datetime-local" defaultValue={padraoQuando()} required />}
            </Campo>
            <Campo rotulo="Duração (min)" nome="duracao_min" erro={e.duracao_min}>
              {(p) => (
                <Entrada
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  defaultValue={atividade?.duracao_min ?? (tipo === "reuniao" || tipo === "visita" ? 60 : "")}
                />
              )}
            </Campo>
          </div>

          {negocios && negocios.length > 0 && !contexto.negocioId && (
            <Campo rotulo="Negócio (opcional)" nome="negocio_id_sel" erro={e.negocio_id}>
              {(p) => (
                <Selecao
                  {...p}
                  defaultValue={atividade?.negocio_id ?? ""}
                  onChange={(ev) => {
                    const h = ev.currentTarget.form?.elements.namedItem("negocio_id") as HTMLInputElement | null;
                    if (h) h.value = ev.currentTarget.value;
                  }}
                >
                  <option value="">— nenhum —</option>
                  {negocios.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}

          {vendedores && vendedores.length > 0 && (
            <Campo rotulo="Responsável" nome="vendedor_id" erro={e.vendedor_id} ajuda="Vazio = o dono do negócio (ou você).">
              {(p) => (
                <Selecao {...p} defaultValue={atividade?.vendedor_id ?? ""}>
                  <option value="">— automático —</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}

          <Campo rotulo={registro ? "Detalhes (opcional)" : "Observações (opcional)"} nome="descricao" erro={e.descricao}>
            {(p) => <AreaTexto {...p} rows={3} maxLength={2000} defaultValue={atividade?.descricao ?? ""} />}
          </Campo>

          {atividade && (
            <>
              <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                <input type="checkbox" name="concluida" defaultChecked={atividade.concluida} className="size-5 accent-[var(--marca)]" />
                Já foi feita (concluída)
              </label>
              <Campo rotulo="Resultado (opcional)" nome="resultado" erro={e.resultado}>
                {(p) => <AreaTexto {...p} rows={2} maxLength={1000} defaultValue={atividade.resultado ?? ""} />}
              </Campo>
            </>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" carregando={pendente}>
              {registro ? "Registrar" : "Salvar"}
            </Botao>
          </div>
        </form>
      )}
    </Modal>
  );
}
