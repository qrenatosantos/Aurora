"use client";

/**
 * LGPD na ficha do contato (só o gestor): baixar tudo o que o sistema guarda sobre a pessoa
 * (pedido de acesso) e apagar os dados pessoais (pedido de eliminação).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apagarDadosContato, exportarContato } from "../actions";

export function Privacidade({ id, nome, temFechados }: { id: string; nome: string; temFechados: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [incluirFechados, setIncluirFechados] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  const baixar = () =>
    iniciar(async () => {
      const r = await exportarContato(id);
      if (!r.ok || !r.dados?.json) return toast.erro(r.mensagem ?? "Não foi possível gerar o arquivo.");
      const url = URL.createObjectURL(new Blob([r.dados.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-${nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "contato"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.sucesso("Arquivo baixado. Envie ao titular por um canal seguro.");
    });

  const apagar = () =>
    iniciar(async () => {
      const r = await apagarDadosContato(id, incluirFechados);
      if (!r.ok) return toast.erro(r.mensagem ?? "Não foi possível apagar.");
      toast.sucesso(r.mensagem ?? "Dados apagados.");
      setAberto(false);
      router.refresh();
    });

  return (
    <Cartao>
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="size-5 text-marca-forte" aria-hidden /> Privacidade (LGPD)
      </h2>
      <p className="mb-3 text-sm text-texto-2">Use quando a pessoa pedir uma cópia dos dados dela ou pedir para apagá-los.</p>
      <div className="flex flex-col gap-2">
        <Botao variante="secundario" carregando={pendente && !aberto} onClick={baixar}>
          <Download className="size-4" aria-hidden /> Baixar os dados desta pessoa
        </Botao>
        <Botao
          variante="fantasma"
          className="!text-perigo"
          onClick={() => {
            setConfirmacao("");
            setIncluirFechados(false);
            setAberto(true);
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Apagar dados pessoais
        </Botao>
      </div>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Apagar os dados de ${nome}?`}>
        <div className="space-y-4 text-sm">
          <p>
            Serão apagados, sem volta: nome, telefone, e-mail, conversas, anotações e propostas não aceitas dos negócios desta pessoa. Os números (valor, datas,
            etapa) continuam nos relatórios, sem identificação.
          </p>
          {temFechados && (
            <label className="flex items-start gap-3 rounded-xl border border-borda p-3">
              <input type="checkbox" checked={incluirFechados} onChange={(e) => setIncluirFechados(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" />
              <span>
                <strong>Apagar também os negócios fechados.</strong>
                <span className="block text-texto-2">
                  Por padrão eles ficam: a proposta aceita é o registro do contrato, e a lei permite guardá-la. Marque só se tiver certeza.
                </span>
              </span>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block font-medium">Para confirmar, digite APAGAR</span>
            <input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-borda bg-superficie px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-marca"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" carregando={pendente} disabled={confirmacao.trim().toUpperCase() !== "APAGAR"} onClick={apagar}>
              Apagar dados
            </Botao>
          </div>
        </div>
      </Modal>
    </Cartao>
  );
}
