"use client";

/** Novo negócio / editar negócio (com cadastro rápido de contato e empresa). */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { salvarNegocio } from "@/app/(app)/negocios/actions";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { EntradaMoeda, valorCampo } from "@/components/ui/controles";
import { Modal } from "@/components/ui/modal";
import type { Etapa, Funil, Negocio } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";

type Opcao = { id: string; nome: string };
export type OpcoesNegocio = {
  funis: (Funil & { etapas: Etapa[] })[];
  contatos: (Opcao & { empresa_id: string | null })[];
  empresas: Opcao[];
  origens: Opcao[];
  vendedores: Opcao[];
  gestor: boolean;
  meuId: string | null;
};

export function DialogoNegocio({
  aberto,
  aoFechar,
  opcoes,
  negocio,
  temProdutos = false,
  inicial = {},
}: {
  aberto: boolean;
  aoFechar: () => void;
  opcoes: OpcoesNegocio;
  negocio?: Negocio | null;
  temProdutos?: boolean;
  inicial?: { funilId?: string; etapaId?: string; contatoId?: string; empresaId?: string };
}) {
  const router = useRouter();
  const funisAtivos = opcoes.funis.filter((f) => f.ativo || f.id === negocio?.funil_id);
  const [funilId, setFunilId] = useState(negocio?.funil_id ?? inicial.funilId ?? funisAtivos[0]?.id ?? "");
  const [contatoId, setContatoId] = useState(negocio?.contato_id ?? inicial.contatoId ?? "");
  const [novoContato, setNovoContato] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState(false);
  const etapas = opcoes.funis.find((f) => f.id === funilId)?.etapas ?? [];
  const empresaDoContato = opcoes.contatos.find((c) => c.id === contatoId)?.empresa_id ?? "";

  const { onSubmit, erros: e, pendente } = useAcao(salvarNegocio, {
    aoSucesso: (r) => {
      aoFechar();
      if (!negocio && r.dados?.id) router.push(`/negocios/${r.dados.id}`);
      else router.refresh();
    },
  });

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={negocio ? "Editar negócio" : "Novo negócio"} largo>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {negocio && <input type="hidden" name="id" value={negocio.id} />}
        <Campo rotulo="Nome do negócio" nome="titulo" erro={e.titulo}>
          {(p) => (
            <Entrada
              {...p}
              defaultValue={negocio?.titulo ?? ""}
              placeholder="Ex.: 20 notebooks para a filial Campinas"
              maxLength={120}
              required
              autoFocus={!negocio}
            />
          )}
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Funil" nome="funil_id" erro={e.funil_id}>
            {(p) => (
              <Selecao {...p} value={funilId} onChange={(ev) => setFunilId(ev.target.value)}>
                {funisAtivos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Etapa" nome="etapa_id" erro={e.etapa_id}>
            {(p) => (
              <Selecao
                {...p}
                key={funilId}
                defaultValue={
                  etapas.some((x) => x.id === (negocio?.etapa_id ?? inicial.etapaId))
                    ? (negocio?.etapa_id ?? inicial.etapaId)
                    : etapas[0]?.id
                }
              >
                {etapas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome} ({x.probabilidade}%)
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            {novoContato ? (
              <>
                <Campo rotulo="Nome do novo contato" nome="novo_contato" erro={e.novo_contato}>
                  {(p) => <Entrada {...p} maxLength={120} placeholder="Ex.: Carla Duarte" />}
                </Campo>
                <Campo rotulo="Telefone / WhatsApp" nome="novo_telefone" erro={e.novo_telefone}>
                  {(p) => <Entrada {...p} type="tel" inputMode="tel" placeholder="(11) 90000-0000" />}
                </Campo>
              </>
            ) : (
              <Campo rotulo="Contato" nome="contato_id" erro={e.contato_id}>
                {(p) => (
                  <Selecao {...p} value={contatoId} onChange={(ev) => setContatoId(ev.target.value)}>
                    <option value="">— sem contato —</option>
                    {opcoes.contatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
            <button
              type="button"
              onClick={() => setNovoContato((v) => !v)}
              className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-marca-forte hover:underline"
            >
              {novoContato ? "Escolher contato existente" : (<><Plus className="size-4" aria-hidden /> Cadastrar contato novo</>)}
            </button>
          </div>
          <div className="space-y-2">
            {novaEmpresa ? (
              <Campo rotulo="Nome da nova empresa" nome="nova_empresa" erro={e.nova_empresa}>
                {(p) => <Entrada {...p} maxLength={120} placeholder="Ex.: Metalúrgica Santa Rita" />}
              </Campo>
            ) : (
              <Campo rotulo="Empresa" nome="empresa_id" erro={e.empresa_id} ajuda="Vazio = a empresa do contato.">
                {(p) => (
                  <Selecao {...p} key={empresaDoContato} defaultValue={negocio?.empresa_id ?? inicial.empresaId ?? empresaDoContato}>
                    <option value="">— sem empresa (pessoa física) —</option>
                    {opcoes.empresas.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
            <button
              type="button"
              onClick={() => setNovaEmpresa((v) => !v)}
              className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-marca-forte hover:underline"
            >
              {novaEmpresa ? "Escolher empresa existente" : (<><Plus className="size-4" aria-hidden /> Cadastrar empresa nova</>)}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            rotulo="Valor estimado"
            nome="valor"
            erro={e.valor}
            ajuda={temProdutos ? "Soma dos produtos (edite na tela do negócio)." : "Ou adicione produtos depois."}
          >
            {(p) => <EntradaMoeda {...p} defaultValue={valorCampo(negocio?.valor ?? 0)} disabled={temProdutos} placeholder="0,00" />}
          </Campo>
          <Campo rotulo="Previsão de fechamento" nome="previsao_fechamento" erro={e.previsao_fechamento}>
            {(p) => <Entrada {...p} type="date" defaultValue={negocio?.previsao_fechamento ?? ""} />}
          </Campo>
          <Campo rotulo="Origem do lead" nome="origem_id" erro={e.origem_id}>
            {(p) => (
              <Selecao {...p} defaultValue={negocio?.origem_id ?? ""}>
                <option value="">— não informada —</option>
                {opcoes.origens.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {opcoes.gestor && (
            <Campo rotulo="Vendedor responsável" nome="vendedor_id" erro={e.vendedor_id}>
              {(p) => (
                <Selecao {...p} defaultValue={negocio?.vendedor_id ?? opcoes.meuId ?? ""}>
                  {opcoes.vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          <Campo rotulo="Etiquetas" nome="tags" erro={e.tags} ajuda="Separe por vírgula. Ex.: Grande conta, Urgente">
            {(p) => <Entrada {...p} defaultValue={negocio?.tags.join(", ") ?? ""} maxLength={300} />}
          </Campo>
        </div>

        <Campo rotulo="Observações" nome="observacoes" erro={e.observacoes}>
          {(p) => <AreaTexto {...p} rows={3} maxLength={4000} defaultValue={negocio?.observacoes ?? ""} />}
        </Campo>

        <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pendente}>
            {negocio ? "Salvar" : "Criar negócio"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
