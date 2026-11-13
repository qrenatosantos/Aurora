"use client";

/** Consulta rápida de data e bloqueios da agenda (o gestor fecha datas à mão). */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Search, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cartao, Selo } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import { formatarData } from "@/lib/formatar";
import type { BloqueioAgenda, Disponibilidade } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { consultarDisponibilidade, excluirBloqueio, salvarBloqueio } from "./actions";

const SITUACAO = {
  livre: { nome: "Livre", cor: "ok" },
  parcial: { nome: "Com vagas", cor: "alerta" },
  lotada: { nome: "Lotada", cor: "perigo" },
  bloqueada: { nome: "Bloqueada", cor: "perigo" },
} as const;

export function ConsultaData() {
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [pendente, iniciar] = useTransition();
  const [resposta, setResposta] = useState<Disponibilidade | null>(null);
  const toast = useToast();

  function consultar() {
    iniciar(async () => {
      const r = await consultarDisponibilidade(dia, hora);
      if (r.ok && r.disponibilidade) setResposta(r.disponibilidade);
      else {
        setResposta(null);
        toast.erro(r.mensagem ?? "Não foi possível consultar.");
      }
    });
  }
  const s = resposta ? SITUACAO[resposta.situacao] : null;

  return (
    <Cartao>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Search className="size-5 text-marca-forte" aria-hidden /> Essa data está livre?
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="consulta-dia" className="mb-1.5 block text-sm font-medium">
            Data
          </label>
          <Entrada id="consulta-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        <div>
          <label htmlFor="consulta-hora" className="mb-1.5 block text-sm font-medium">
            Início (opcional)
          </label>
          <Entrada id="consulta-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      </div>
      <Botao variante="secundario" className="mt-3 w-full" carregando={pendente} disabled={!dia} onClick={consultar}>
        Consultar
      </Botao>
      {resposta && s && (
        <div className="mt-3 rounded-xl bg-superficie-2 p-3 text-sm" role="status">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {formatarData(resposta.data)}
            {resposta.hora_inicio ? ` às ${resposta.hora_inicio}` : ""} <Selo cor={s.cor}>{s.nome}</Selo>
          </p>
          <p className="mt-1 text-texto-2">
            {resposta.bloqueada
              ? `Data bloqueada${resposta.motivo_bloqueio ? `: ${resposta.motivo_bloqueio}` : ""}.`
              : `${resposta.confirmados} confirmada(s) e ${resposta.reservados} reservada(s) ${resposta.hora_inicio ? "nesse horário" : "no dia"}. Limite: ${resposta.capacidade}. Vagas: ${resposta.vagas}.`}
          </p>
        </div>
      )}
    </Cartao>
  );
}

export function Bloqueios({ bloqueios, gestor }: { bloqueios: BloqueioAgenda[]; gestor: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [, iniciar] = useTransition();
  const { onSubmit, erros: e, pendente } = useAcao(salvarBloqueio, {
    aoSucesso: (_r, form) => {
      form?.reset();
      router.refresh();
    },
  });

  return (
    <Cartao>
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Ban className="size-5 text-marca-forte" aria-hidden /> Datas bloqueadas
      </h2>
      <p className="mb-3 text-sm text-texto-2">Dias em que a Aurora não atende. O agente também enxerga esses bloqueios.</p>
      {bloqueios.length === 0 ? (
        <p className="text-sm text-texto-2">Nenhuma data bloqueada daqui para a frente.</p>
      ) : (
        <ul className="divide-y divide-borda">
          {bloqueios.map((b) => (
            <li key={b.id} className="flex min-h-12 items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {formatarData(b.inicio)}
                  {b.fim !== b.inicio ? ` a ${formatarData(b.fim)}` : ""}
                </span>
                {b.motivo && <span className="block truncate text-texto-2">{b.motivo}</span>}
              </span>
              {gestor && (
                <button
                  type="button"
                  aria-label={`Remover bloqueio de ${formatarData(b.inicio)}`}
                  className="grid size-11 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2 hover:text-perigo"
                  onClick={async () => {
                    if (!(await confirmar({ titulo: "Remover este bloqueio?", mensagem: "A data volta a ficar disponível na agenda." }))) return;
                    iniciar(async () => {
                      const r = await excluirBloqueio(b.id);
                      if (r.ok) {
                        toast.sucesso(r.mensagem ?? "Removido.");
                        router.refresh();
                      } else toast.erro(r.mensagem ?? "Não foi possível remover.");
                    });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {gestor && (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3 border-t border-borda pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Do dia" nome="inicio" erro={e.inicio}>
              {(p) => <Entrada {...p} type="date" required />}
            </Campo>
            <Campo rotulo="Até (opcional)" nome="fim" erro={e.fim}>
              {(p) => <Entrada {...p} type="date" />}
            </Campo>
          </div>
          <Campo rotulo="Motivo (opcional)" nome="motivo" erro={e.motivo}>
            {(p) => <Entrada {...p} maxLength={160} placeholder="Ex.: Folga da equipe" />}
          </Campo>
          <Botao type="submit" variante="secundario" carregando={pendente} className="w-full">
            Bloquear data
          </Botao>
        </form>
      )}
    </Cartao>
  );
}
