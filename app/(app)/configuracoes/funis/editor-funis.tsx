"use client";

/** Funis e etapas: nome, ordem (setas), % de probabilidade e cor de cada etapa. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { excluirFunil, salvarEtapas, salvarFunil } from "@/app/(app)/configuracoes/actions";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import type { FunilComEtapas } from "@/lib/dados";
import { useAcao } from "@/lib/use-acao";

type EtapaEd = { chave: string; id: string | null; nome: string; probabilidade: string; cor: string; marco?: string | null };

/** O que faz o cartão chegar em cada etapa (regras no banco: funil automático). */
const GATILHO: Record<string, string> = {
  novo: "Entra sozinho: pedido novo (site, WhatsApp ou cadastro).",
  atendimento: "Anda sozinho: a Aurora responde o cliente ou alguém registra uma interação.",
  preparacao: "Anda sozinho: proposta criada, ou o gestor pediu ajustes.",
  aprovacao: "Anda sozinho: proposta enviada para a aprovação do gestor.",
  enviada: "Anda sozinho: proposta enviada ao cliente.",
  negociacao: "Anda sozinho: o cliente responde depois do envio, pede nova versão ou recusa.",
};

export function EditorFunis({ funis, contagem, variosFunis }: { funis: FunilComEtapas[]; contagem: Record<string, number>; variosFunis: boolean }) {
  const router = useRouter();
  const { onSubmit, erros: e, pendente } = useAcao(salvarFunil, {
    aoSucesso: (_r, form) => {
      form?.reset();
      router.refresh();
    },
  });
  return (
    <div className="space-y-4">
      {funis.map((f) => (
        <Funil key={f.id + f.updated_at + f.etapas.map((x) => x.updated_at).join()} funil={f} contagem={contagem} />
      ))}
      {variosFunis && (
      <Cartao>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Campo rotulo="Novo funil" nome="nome" erro={e.nome} className="flex-1">
            {(p) => <Entrada {...p} placeholder="Ex.: Pós-venda / renovação" maxLength={60} />}
          </Campo>
          <Botao type="submit" carregando={pendente}>
            <Plus className="size-4" aria-hidden /> Criar funil
          </Botao>
        </form>
      </Cartao>
      )}
    </div>
  );
}

function Funil({ funil, contagem }: { funil: FunilComEtapas; contagem: Record<string, number> }) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(funil.nome);
  const [ativo, setAtivo] = useState(funil.ativo);
  const [etapas, setEtapas] = useState<EtapaEd[]>(() =>
    funil.etapas.map((x) => ({ chave: x.id, id: x.id, nome: x.nome, probabilidade: String(x.probabilidade), cor: x.cor, marco: x.marco ?? null })),
  );
  const [mudou, setMudou] = useState(false);
  const mexer = (f: (l: EtapaEd[]) => EtapaEd[]) => {
    setEtapas(f);
    setMudou(true);
  };
  const mover = (i: number, d: number) =>
    mexer((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  function salvar() {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("id", funil.id);
      fd.set("nome", nome);
      if (ativo) fd.set("ativo", "on");
      const r1 = await salvarFunil({ ok: false }, fd);
      if (!r1.ok) {
        toast.erro(r1.mensagem ?? "Não foi possível salvar o funil.");
        return;
      }
      const r2 = await salvarEtapas(
        funil.id,
        etapas.map((x) => ({ id: x.id, nome: x.nome.trim(), probabilidade: Math.round(Number(x.probabilidade) || 0), cor: x.cor })),
      );
      if (r2.ok) {
        toast.sucesso("Funil salvo.");
        setMudou(false);
        router.refresh();
      } else toast.erro(r2.mensagem ?? "Não foi possível salvar as etapas.");
    });
  }

  return (
    <Cartao className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium">
          Nome do funil
          <Entrada
            value={nome}
            maxLength={60}
            onChange={(e) => {
              setNome(e.target.value);
              setMudou(true);
            }}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => {
              setAtivo(e.target.checked);
              setMudou(true);
            }}
            className="size-5 accent-[var(--marca)]"
          />
          Ativo
        </label>
      </div>
      <ol className="space-y-2">
        {etapas.map((x, i) => (
          <li key={x.chave} className="flex flex-wrap items-center gap-2 rounded-xl border border-borda p-2">
            <span className="w-5 text-center text-xs font-bold text-texto-2">{i + 1}</span>
            <label className="min-w-36 flex-1">
              <span className="sr-only">Nome da etapa {i + 1}</span>
              <Entrada value={x.nome} maxLength={40} onChange={(e) => mexer((l) => l.map((y) => (y.chave === x.chave ? { ...y, nome: e.target.value } : y)))} />
            </label>
            <label className="flex items-center gap-1 text-xs text-texto-2">
              <Entrada
                className="w-16"
                inputMode="numeric"
                value={x.probabilidade}
                aria-label={`Probabilidade da etapa ${i + 1} (%)`}
                onChange={(e) => mexer((l) => l.map((y) => (y.chave === x.chave ? { ...y, probabilidade: e.target.value.replace(/\D/g, "").slice(0, 3) } : y)))}
              />
              %
            </label>
            <input
              type="color"
              value={x.cor}
              aria-label={`Cor da etapa ${i + 1}`}
              onChange={(e) => mexer((l) => l.map((y) => (y.chave === x.chave ? { ...y, cor: e.target.value } : y)))}
              className="h-11 w-11 cursor-pointer rounded-lg border border-borda bg-superficie p-1"
            />
            {x.id && contagem[x.id] ? <Selo>{contagem[x.id]} em aberto</Selo> : null}
            {x.marco && GATILHO[x.marco] && <span className="w-full pl-7 text-xs text-texto-2">{GATILHO[x.marco]}</span>}
            <span className="ml-auto flex">
              <Botao variante="fantasma" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>
                <ArrowUp className="size-4" aria-hidden />
              </Botao>
              <Botao variante="fantasma" aria-label="Descer" onClick={() => mover(i, 1)} disabled={i === etapas.length - 1}>
                <ArrowDown className="size-4" aria-hidden />
              </Botao>
              <Botao
                variante="fantasma"
                className="text-perigo"
                aria-label={`Remover etapa ${x.nome}`}
                disabled={Boolean(x.id && contagem[x.id])}
                title={x.id && contagem[x.id] ? "Mova os negócios desta etapa antes de remover" : undefined}
                onClick={() => mexer((l) => l.filter((y) => y.chave !== x.chave))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Botao>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="secundario"
          onClick={() => mexer((l) => [...l, { chave: `nova-${l.length}-${Math.random()}`, id: null, nome: "", probabilidade: "50", cor: "#64748B" }])}
          disabled={etapas.length >= 12}
        >
          <Plus className="size-4" aria-hidden /> Etapa
        </Botao>
        <Botao onClick={salvar} carregando={pendente} disabled={!mudou}>
          <Save className="size-4" aria-hidden /> Salvar funil
        </Botao>
        <Botao
          variante="fantasma"
          className="ml-auto text-perigo"
          onClick={async () => {
            if (await confirmar({ titulo: `Excluir o funil “${funil.nome}”?`, mensagem: "Só é possível se não houver negócios nele.", perigo: true }))
              iniciar(async () => {
                const r = await excluirFunil(funil.id);
                if (r.ok) {
                  toast.sucesso(r.mensagem ?? "Excluído.");
                  router.refresh();
                } else toast.erro(r.mensagem ?? "Não foi possível.");
              });
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Excluir funil
        </Botao>
      </div>
      <p className="text-xs text-texto-2">
        A probabilidade de cada etapa calcula a receita prevista (valor × %). Ganho e Perdido não são etapas: são o resultado do negócio.
      </p>
    </Cartao>
  );
}
