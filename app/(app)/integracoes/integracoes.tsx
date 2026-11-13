"use client";

/** Chaves de acesso do agente e avisos (webhooks): criar, revogar, testar. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Eye, EyeOff, KeyRound, Pencil, Plus, RefreshCw, Send, Trash2, Webhook as IconeWebhook } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { EstadoAcao } from "@/lib/acoes";
import { ESCOPOS_API, TIPOS_AVISO } from "@/lib/aurora";
import { formatarDataHora } from "@/lib/formatar";
import type { ChaveApi, Webhook } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { criarChave, excluirWebhook, processarFila, revogarChave, salvarWebhook, testarWebhook } from "./actions";

type ChaveLista = Omit<ChaveApi, "hash" | "criada_por" | "updated_at">;

function useExecutar() {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const executar = (acao: () => Promise<EstadoAcao>, depois?: () => void) =>
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        depois?.();
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível.");
    });
  return { executar, pendente, toast };
}

async function copiar(texto: string, toast: ReturnType<typeof useToast>, oQue: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.info(`${oQue} copiada.`);
  } catch {
    toast.erro("Não foi possível copiar. Selecione o texto e copie manualmente.");
  }
}

export function Chaves({ chaves }: { chaves: ChaveLista[] }) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const { executar, toast } = useExecutar();
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState<string | null>(null);
  const { onSubmit, erros: e, pendente } = useAcao(criarChave, {
    toast: false,
    aoSucesso: (r) => {
      setNova(r.dados?.chave ?? null);
      router.refresh();
    },
  });

  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="size-5 text-marca-forte" aria-hidden /> Chaves de acesso
          </h2>
          <p className="text-sm text-texto-2">O agente entra no sistema com uma chave. Você cria e revoga aqui; a chave aparece uma única vez.</p>
        </div>
        <Botao
          onClick={() => {
            setNova(null);
            setAberto(true);
          }}
        >
          <Plus className="size-4" aria-hidden /> Nova chave
        </Botao>
      </div>
      {chaves.length === 0 ? (
        <p className="text-sm text-texto-2">Nenhuma chave criada. Sem chave, ninguém acessa a API.</p>
      ) : (
        <ul className="divide-y divide-borda text-sm">
          {chaves.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{c.nome}</span> <code className="text-xs text-texto-2">{c.prefixo}…</code>
                <span className="block text-xs text-texto-2">
                  {c.escopos.length} de {ESCOPOS_API.length} permissões · até {c.limite_por_minuto} chamadas por minuto · criada em {formatarDataHora(c.created_at)} ·{" "}
                  {c.ultimo_uso_em ? `último uso em ${formatarDataHora(c.ultimo_uso_em)}` : "nunca usada"}
                </span>
              </span>
              {c.ativa ? (
                <>
                  <Selo cor="ok">ativa</Selo>
                  <Botao
                    variante="fantasma"
                    className="!text-perigo"
                    onClick={async () => {
                      if (await confirmar({ titulo: `Revogar a chave “${c.nome}”?`, mensagem: "Quem usa esta chave perde o acesso na hora. Não dá para desfazer: será preciso criar outra.", textoConfirmar: "Revogar", perigo: true }))
                        executar(() => revogarChave(c.id));
                    }}
                  >
                    Revogar
                  </Botao>
                </>
              ) : (
                <Selo cor="perigo">revogada{c.revogada_em ? ` em ${formatarDataHora(c.revogada_em)}` : ""}</Selo>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={nova ? "Chave criada" : "Nova chave de acesso"} largo>
        {nova ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-alerta-suave p-3 text-sm font-semibold text-alerta">Copie a chave agora. Por segurança, ela não será mostrada de novo.</p>
            <code className="block rounded-xl bg-superficie-2 p-3 text-sm break-all select-all">{nova}</code>
            <p className="text-sm text-texto-2">
              O agente envia a chave em toda chamada, no cabeçalho <code>Authorization: Bearer {nova.slice(0, 10)}…</code> Guarde-a como uma senha: não a coloque em
              conversas, e-mails ou no código.
            </p>
            <div className="flex justify-end gap-2 border-t border-borda pt-4">
              <Botao variante="secundario" onClick={() => copiar(nova, toast, "Chave")}>
                <Copy className="size-4" aria-hidden /> Copiar chave
              </Botao>
              <Botao onClick={() => setAberto(false)}>Já copiei</Botao>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Campo rotulo="Nome da chave" nome="nome" erro={e.nome} ajuda="Para você reconhecer depois. Ex.: Agente SDR (produção).">
                {(p) => <Entrada {...p} maxLength={60} required />}
              </Campo>
              <Campo rotulo="Chamadas por minuto" nome="limite" erro={e.limite}>
                {(p) => <Entrada {...p} type="number" min={1} max={6000} defaultValue={120} />}
              </Campo>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">O que esta chave pode fazer</legend>
              <div className="grid gap-1 rounded-xl border border-borda p-2 sm:grid-cols-2">
                {ESCOPOS_API.map((s) => (
                  <label key={s.id} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-superficie-2">
                    <input type="checkbox" name={`escopo_${s.id}`} defaultChecked className="size-5 shrink-0 accent-[var(--marca)]" />
                    {s.nome}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-texto-2">
                Nenhuma chave pode aprovar proposta, excluir dados, mudar preços ou ver configurações: essas ações simplesmente não existem na API.
              </p>
            </fieldset>
            <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
              <Botao variante="secundario" onClick={() => setAberto(false)}>
                Cancelar
              </Botao>
              <Botao type="submit" carregando={pendente}>
                Criar chave
              </Botao>
            </div>
          </form>
        )}
      </Modal>
    </Cartao>
  );
}

export function Webhooks({ webhooks }: { webhooks: Webhook[] }) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const { executar, pendente: executando, toast } = useExecutar();
  const [editando, setEditando] = useState<Webhook | "novo" | null>(null);
  const [visivel, setVisivel] = useState<string | null>(null);

  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <IconeWebhook className="size-5 text-marca-forte" aria-hidden /> Avisos para o agente (webhooks)
          </h2>
          <p className="text-sm text-texto-2">Quando algo acontece, o sistema chama o endereço do agente. Cada aviso vai assinado com o segredo abaixo.</p>
        </div>
        <Botao onClick={() => setEditando("novo")}>
          <Plus className="size-4" aria-hidden /> Novo aviso
        </Botao>
      </div>
      {webhooks.length === 0 ? (
        <p className="text-sm text-texto-2">
          Nenhum endereço cadastrado. Sem ele, os avisos ficam só na fila e o agente os busca pela API (<code>GET /api/v1/eventos</code>).
        </p>
      ) : (
        <ul className="divide-y divide-borda text-sm">
          {webhooks.map((w) => (
            <li key={w.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{w.nome}</span> {w.ativo ? <Selo cor="ok">ligado</Selo> : <Selo>desligado</Selo>}
                  <span className="block truncate text-xs text-texto-2">{w.url}</span>
                  <span className="block text-xs text-texto-2">{w.eventos.length === 0 ? "Todos os tipos de aviso" : `${w.eventos.length} tipo(s) de aviso`}</span>
                </span>
                <Botao variante="secundario" carregando={executando} disabled={!w.ativo} onClick={() => executar(() => testarWebhook(w.id))}>
                  <Send className="size-4" aria-hidden /> Enviar teste
                </Botao>
                <button type="button" aria-label={`Editar ${w.nome}`} className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-texto" onClick={() => setEditando(w)}>
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${w.nome}`}
                  className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-perigo"
                  onClick={async () => {
                    if (await confirmar({ titulo: `Excluir o aviso “${w.nome}”?`, perigo: true })) executar(() => excluirWebhook(w.id));
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-superficie-2 px-3 py-2">
                <span className="text-xs font-semibold text-texto-2">Segredo da assinatura:</span>
                <code className="min-w-0 flex-1 text-xs break-all">{visivel === w.id ? w.segredo : "•".repeat(24)}</code>
                <button type="button" aria-label={visivel === w.id ? "Esconder segredo" : "Mostrar segredo"} className="grid size-9 place-items-center rounded-lg hover:bg-superficie" onClick={() => setVisivel((v) => (v === w.id ? null : w.id))}>
                  {visivel === w.id ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
                <button type="button" aria-label="Copiar segredo" className="grid size-9 place-items-center rounded-lg hover:bg-superficie" onClick={() => copiar(w.segredo, toast, "Chave de assinatura")}>
                  <Copy className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editando && (
        <DialogoWebhook
          key={editando === "novo" ? "novo" : editando.id}
          webhook={editando === "novo" ? null : editando}
          aoFechar={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </Cartao>
  );
}

function DialogoWebhook({ webhook, aoFechar }: { webhook: Webhook | null; aoFechar: () => void }) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarWebhook, { aoSucesso: aoFechar });
  const todos = !webhook || webhook.eventos.length === 0;
  return (
    <Modal aberto aoFechar={aoFechar} titulo={webhook ? `Editar aviso ${webhook.nome}` : "Novo aviso"} largo>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {webhook && <input type="hidden" name="id" value={webhook.id} />}
        <Campo rotulo="Nome" nome="nome" erro={e.nome}>
          {(p) => <Entrada {...p} defaultValue={webhook?.nome ?? ""} maxLength={60} required placeholder="Ex.: Agente SDR" />}
        </Campo>
        <Campo rotulo="Endereço que recebe os avisos" nome="url" erro={e.url} ajuda="Quem constrói o agente informa este endereço. Precisa começar com https://.">
          {(p) => <Entrada {...p} type="url" defaultValue={webhook?.url ?? ""} maxLength={500} required placeholder="https://..." />}
        </Campo>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Quais avisos enviar</legend>
          <div className="grid gap-1 rounded-xl border border-borda p-2 sm:grid-cols-2">
            {TIPOS_AVISO.map((t) => (
              <label key={t.id} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-superficie-2">
                <input type="checkbox" name={`tipo_${t.id}`} defaultChecked={todos || webhook.eventos.includes(t.id)} className="size-5 shrink-0 accent-[var(--marca)]" />
                {t.nome}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={webhook?.ativo ?? true} className="size-5 accent-[var(--marca)]" />
          Ligado
        </label>
        <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pendente}>
            Salvar aviso
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

export function FilaAvisos() {
  const { executar, pendente } = useExecutar();
  return (
    <Botao variante="secundario" carregando={pendente} onClick={() => executar(() => processarFila())}>
      <RefreshCw className="size-4" aria-hidden /> Processar fila agora
    </Botao>
  );
}
