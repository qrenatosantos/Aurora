"use client";

/** Módulos opcionais (nada é apagado ao desligar) e prazo de guarda dos leads (LGPD). */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { useConfirmar } from "@/components/ui/confirmar";
import { useToast } from "@/components/ui/toast";
import type { Configuracoes } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { aplicarRetencao, salvarModulos } from "../actions";

const MODULOS = [
  { nome: "mod_empresas", titulo: "Empresas (clientes pessoa jurídica)", texto: "Cadastro de empresas com vários contatos. Útil se a Aurora passar a atender muitas empresas recorrentes." },
  { nome: "mod_funis", titulo: "Vários funis", texto: "Permite criar mais de um funil de vendas. Desligado, o sistema usa só o funil de eventos." },
  { nome: "mod_metas", titulo: "Metas", texto: "Metas mensais de vendas, com projeção." },
  { nome: "mod_comissoes", titulo: "Comissões", texto: "Cálculo e extrato de comissões por venda." },
  { nome: "mod_equipe", titulo: "Equipes (grupos de pessoas)", texto: "Agrupa as pessoas em equipes, para metas e relatórios por equipe. Só faz sentido com mais gente vendendo." },
] as const;

export function FormModulos({ config }: { config: Configuracoes }) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarModulos);
  const [aplicando, iniciar] = useTransition();
  const toast = useToast();
  const confirmar = useConfirmar();
  const router = useRouter();

  function retencao() {
    iniciar(async () => {
      const sim = await aplicarRetencao(true);
      if (!sim.ok) return toast.erro(sim.mensagem ?? "Não foi possível verificar.");
      const n = Number(sim.dados?.quantidade ?? 0);
      if (n === 0) return toast.info(sim.mensagem ?? "Nada a apagar.");
      const ok = await confirmar({
        titulo: `Apagar os dados de ${n} contato(s)?`,
        mensagem:
          "São contatos que nunca fecharam negócio e estão parados há mais tempo que o prazo de guarda. Nome, telefone, conversa e dados do evento são apagados. Não dá para desfazer.",
        textoConfirmar: "Apagar",
        perigo: true,
      });
      if (!ok) return;
      const r = await aplicarRetencao(false);
      if (r.ok) {
        toast.sucesso(r.mensagem ?? "Pronto.");
        router.refresh();
      } else toast.erro(r.mensagem ?? "Não foi possível apagar.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Cartao className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-texto">Módulos opcionais</h2>
          <p className="mt-1 text-sm text-texto-2">Desligar só esconde o módulo do menu. Os dados continuam guardados e voltam ao religar.</p>
        </div>
        {MODULOS.map((m) => (
          <label key={m.nome} className="flex items-start gap-3 rounded-xl border border-borda p-3 text-sm">
            <input type="checkbox" name={m.nome} defaultChecked={config[m.nome]} className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" />
            <span>
              <strong className="block text-texto">{m.titulo}</strong>
              {m.texto}
            </span>
          </label>
        ))}
      </Cartao>

      <Cartao className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-texto">
            <ShieldCheck className="size-5 text-marca-forte" aria-hidden /> Dados pessoais (LGPD)
          </h2>
          <p className="mt-1 text-sm text-texto-2">
            Leads que não fecharam negócio não precisam ficar guardados para sempre. Para apagar os dados de uma pessoa específica, abra a ficha do
            contato.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Guardar leads que não fecharam por (meses)" nome="retencao_leads_meses" erro={e.retencao_leads_meses}>
            {(p) => <Entrada {...p} type="number" inputMode="numeric" min={1} max={120} defaultValue={config.retencao_leads_meses} />}
          </Campo>
          <Campo rotulo="E-mail para pedidos de privacidade" nome="email_privacidade" erro={e.email_privacidade} ajuda="Aparece na política de privacidade do site.">
            {(p) => <Entrada {...p} type="email" defaultValue={config.email_privacidade ?? ""} maxLength={160} />}
          </Campo>
        </div>
        <Botao variante="secundario" carregando={aplicando} onClick={retencao}>
          Verificar contatos fora do prazo de guarda
        </Botao>
      </Cartao>

      <div className="flex justify-end">
        <Botao type="submit" carregando={pendente} className="w-full sm:w-auto">
          {pendente ? "Salvando..." : "Salvar"}
        </Botao>
      </div>
    </form>
  );
}
