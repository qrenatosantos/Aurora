"use client";

/** Lista e edição das regras de comissão (gestor). */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { excluirRegra, salvarRegra } from "@/app/(app)/comissoes/actions";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { EntradaMoeda, valorCampo } from "@/components/ui/controles";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { moedaInteira, pctNum } from "@/lib/comercial";
import type { RegraComissao } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";

type Opcao = { id: string; nome: string };

export function Regras({
  regras,
  vendedores,
  produtos,
  gestor,
}: {
  regras: RegraComissao[];
  vendedores: Opcao[];
  produtos: Opcao[];
  gestor: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const [editando, setEditando] = useState<RegraComissao | "nova" | null>(null);
  const nomeV = new Map(vendedores.map((v) => [v.id, v.nome]));
  const nomeP = new Map(produtos.map((p) => [p.id, p.nome]));
  const prioridade = (r: RegraComissao) => (r.produto_id ? 2 : 0) + (r.vendedor_id ? 1 : 0);
  const ordenadas = [...regras].sort((a, b) => prioridade(b) - prioridade(a) || Number(b.valor_min ?? 0) - Number(a.valor_min ?? 0));

  return (
    <>
      {gestor && (
        <div className="mb-3 flex justify-end">
          <Botao onClick={() => setEditando("nova")}>
            <Plus className="size-4" aria-hidden /> Nova regra
          </Botao>
        </div>
      )}
      <ul className="space-y-2">
        {ordenadas.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {r.nome} {!r.ativo && <Selo>Inativa</Selo>}
              </p>
              <p className="text-sm text-texto-2">
                {r.vendedor_id ? `Vendedor: ${nomeV.get(r.vendedor_id) ?? "—"}` : "Todos os vendedores"} ·{" "}
                {r.produto_id ? `Produto: ${nomeP.get(r.produto_id) ?? "—"}` : "Qualquer produto"}
                {r.valor_min !== null || r.valor_max !== null
                  ? ` · Negócios ${r.valor_min !== null ? `de ${moedaInteira(r.valor_min)}` : ""}${r.valor_max !== null ? ` até ${moedaInteira(r.valor_max)}` : " em diante"}`
                  : ""}
              </p>
            </div>
            <span className="num text-2xl font-extrabold text-marca-forte">{pctNum(r.percentual)}</span>
            {gestor && (
              <div className="flex gap-1">
                <Botao variante="secundario" onClick={() => setEditando(r)} aria-label={`Editar ${r.nome}`}>
                  <Pencil className="size-4" aria-hidden />
                </Botao>
                <Botao
                  variante="fantasma"
                  className="text-perigo"
                  aria-label={`Excluir ${r.nome}`}
                  onClick={async () => {
                    if (await confirmar({ titulo: `Excluir a regra “${r.nome}”?`, mensagem: "Comissões já calculadas não mudam.", perigo: true }))
                      iniciar(async () => {
                        const x = await excluirRegra(r.id);
                        if (x.ok) {
                          toast.sucesso(x.mensagem ?? "Excluída.");
                          router.refresh();
                        } else toast.erro(x.mensagem ?? "Não foi possível.");
                      });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Botao>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editando && (
        <DialogoRegra
          regra={editando === "nova" ? null : editando}
          vendedores={vendedores}
          produtos={produtos}
          aoFechar={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function DialogoRegra({
  regra,
  vendedores,
  produtos,
  aoFechar,
}: {
  regra: RegraComissao | null;
  vendedores: Opcao[];
  produtos: Opcao[];
  aoFechar: () => void;
}) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarRegra, { aoSucesso: () => aoFechar() });
  return (
    <Modal aberto aoFechar={aoFechar} titulo={regra ? "Editar regra" : "Nova regra de comissão"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {regra && <input type="hidden" name="id" value={regra.id} />}
        <Campo rotulo="Nome da regra" nome="nome" erro={e.nome}>
          {(p) => <Entrada {...p} defaultValue={regra?.nome ?? ""} maxLength={80} placeholder="Ex.: Padrão, Suporte mensal" required autoFocus />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Vendedor" nome="vendedor_id" erro={e.vendedor_id}>
            {(p) => (
              <Selecao {...p} defaultValue={regra?.vendedor_id ?? ""}>
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Produto" nome="produto_id" erro={e.produto_id}>
            {(p) => (
              <Selecao {...p} defaultValue={regra?.produto_id ?? ""}>
                <option value="">Qualquer produto</option>
                {produtos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <Campo rotulo="Comissão (% sobre o valor ganho)" nome="percentual" erro={e.percentual}>
          {(p) => <Entrada {...p} inputMode="decimal" defaultValue={String(regra?.percentual ?? 5).replace(".", ",")} className="max-w-32" />}
        </Campo>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium text-texto">Faixa pelo valor do negócio (opcional)</legend>
          <Campo rotulo="A partir de" nome="valor_min" erro={e.valor_min}>
            {(p) => <EntradaMoeda {...p} defaultValue={regra?.valor_min !== null && regra?.valor_min !== undefined ? valorCampo(regra.valor_min) : ""} />}
          </Campo>
          <Campo rotulo="Até" nome="valor_max" erro={e.valor_max}>
            {(p) => <EntradaMoeda {...p} defaultValue={regra?.valor_max !== null && regra?.valor_max !== undefined ? valorCampo(regra.valor_max) : ""} />}
          </Campo>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="ativo" defaultChecked={regra?.ativo ?? true} className="size-5 accent-[var(--marca)]" /> Regra ativa
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pendente}>
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
