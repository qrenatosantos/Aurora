"use client";

/** Marcar negócio como PERDIDO: o motivo é obrigatório (também no banco). */
import { perderNegocio } from "@/app/(app)/negocios/actions";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Selecao } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { useAcao } from "@/lib/use-acao";

export function DialogoPerda({
  aberto,
  aoFechar,
  aoPerder,
  negocio,
  motivos,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoPerder?: () => void;
  negocio: { id: string; titulo: string } | null;
  motivos: { id: string; nome: string; ativo: boolean }[];
}) {
  const { onSubmit, erros: e, pendente } = useAcao(perderNegocio, {
    aoSucesso: () => {
      aoFechar();
      aoPerder?.();
    },
  });
  return (
    <Modal aberto={aberto && negocio !== null} aoFechar={aoFechar} titulo="Marcar como perdido">
      {negocio && (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <input type="hidden" name="id" value={negocio.id} />
          <p className="text-sm text-texto-2">
            <strong className="text-texto">{negocio.titulo}</strong>. Saber por que perdemos ajuda a vender mais: o motivo aparece nos
            relatórios.
          </p>
          <Campo rotulo="Motivo da perda" nome="motivo_perda_id" erro={e.motivo_perda_id}>
            {(p) => (
              <Selecao {...p} defaultValue="" required autoFocus>
                <option value="" disabled>
                  Escolha o motivo…
                </option>
                {motivos
                  .filter((m) => m.ativo)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Detalhes (opcional)" nome="motivo_perda_detalhe" erro={e.motivo_perda_detalhe}>
            {(p) => <AreaTexto {...p} rows={3} maxLength={500} placeholder="Ex.: concorrente ofereceu 12% a menos" />}
          </Campo>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" carregando={pendente}>
              Marcar como perdido
            </Botao>
          </div>
        </form>
      )}
    </Modal>
  );
}
