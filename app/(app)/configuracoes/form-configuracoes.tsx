"use client";

/**
 * Formulário padrão do projeto: useAcao(serverAction) + <form onSubmit> + <Botao carregando>.
 * Dados da empresa (aparecem nas propostas) e regras gerais.
 */
import Link from "next/link";
import { Palette } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { formatarTelefone } from "@/lib/formatar";
import type { Configuracoes } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";
import { salvarConfiguracoes } from "./actions";

export function FormConfiguracoes({ config }: { config: Configuracoes }) {
  const { onSubmit, erros: e, pendente } = useAcao(salvarConfiguracoes);

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Cartao className="space-y-4">
        <h2 className="text-base font-semibold text-texto">Empresa (aparece nas propostas)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome da empresa" nome="nome_negocio" erro={e.nome_negocio}>
            {(p) => <Entrada {...p} defaultValue={config.nome_negocio} required maxLength={80} autoComplete="organization" />}
          </Campo>
          <Campo rotulo="Responsável" nome="responsavel" erro={e.responsavel} ajuda="Quem assina as propostas como contratado.">
            {(p) => <Entrada {...p} defaultValue={config.responsavel ?? ""} maxLength={80} />}
          </Campo>
          <Campo rotulo="CNPJ" nome="documento" erro={e.documento}>
            {(p) => <Entrada {...p} defaultValue={config.documento ?? ""} maxLength={30} placeholder="00.000.000/0001-00" />}
          </Campo>
          <Campo rotulo="WhatsApp" nome="whatsapp" erro={e.whatsapp} ajuda="Com DDD. Ex.: (34) 90000-0000">
            {(p) => <Entrada {...p} type="tel" inputMode="tel" defaultValue={formatarTelefone(config.whatsapp)} autoComplete="tel" />}
          </Campo>
          <Campo rotulo="E-mail" nome="email" erro={e.email}>
            {(p) => <Entrada {...p} type="email" defaultValue={config.email ?? ""} maxLength={160} />}
          </Campo>
          <Campo rotulo="Instagram" nome="instagram" erro={e.instagram}>
            {(p) => <Entrada {...p} defaultValue={config.instagram ?? ""} placeholder="@aurora.bartenders" />}
          </Campo>
          <Campo rotulo="Site" nome="site" erro={e.site}>
            {(p) => <Entrada {...p} defaultValue={config.site ?? ""} maxLength={160} />}
          </Campo>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <Campo rotulo="Cidade" nome="cidade" erro={e.cidade} ajuda="Eventos em outra cidade podem ter taxa na calculadora.">
              {(p) => <Entrada {...p} defaultValue={config.cidade ?? ""} placeholder="Araxá" />}
            </Campo>
            <Campo rotulo="UF" nome="uf" erro={e.uf}>
              {(p) => <Entrada {...p} defaultValue={config.uf ?? ""} maxLength={2} placeholder="MG" className="uppercase" />}
            </Campo>
          </div>
          <Campo rotulo="Endereço" nome="endereco" erro={e.endereco} className="sm:col-span-2">
            {(p) => <Entrada {...p} defaultValue={config.endereco ?? ""} placeholder="Rua, número, bairro" />}
          </Campo>
        </div>
      </Cartao>

      <Cartao className="space-y-4">
        <h2 className="text-base font-semibold text-texto">Regras gerais</h2>
        <label className="flex items-start gap-3 rounded-xl border border-borda p-3 text-sm">
          <input type="checkbox" name="vendedores_veem_tudo" defaultChecked={config.vendedores_veem_tudo} className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" />
          <span>
            <strong className="block text-texto">Todos da equipe veem tudo</strong>
            Desligado (padrão): quem não é gestor vê só os próprios contatos, negócios e tarefas. Ligado: todos veem os dados de todos, mas cada um
            continua editando só os seus. O gestor sempre vê e edita tudo.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Negócio “esfriando” após (dias sem contato)" nome="dias_sem_contato" erro={e.dias_sem_contato}>
            {(p) => <Entrada {...p} type="number" inputMode="numeric" min={1} max={90} defaultValue={config.dias_sem_contato} />}
          </Campo>
        </div>
        <Campo rotulo="Mensagem padrão do WhatsApp" nome="mensagem_whatsapp" erro={e.mensagem_whatsapp} ajuda="Use {nome}. Os modelos completos ficam na aba Modelos de mensagem.">
          {(p) => <AreaTexto {...p} defaultValue={config.mensagem_whatsapp ?? ""} maxLength={500} rows={2} />}
        </Campo>
      </Cartao>

      <Link
        href="/personalizacao"
        className="flex min-h-11 items-center gap-3 rounded-2xl border border-dashed border-borda p-4 text-sm text-texto-2 hover:bg-superficie-2"
      >
        <Palette className="size-5 shrink-0 text-marca-forte" aria-hidden />
        <span>
          <strong className="text-texto">Logo, cores e fonte</strong> ficam em <span className="font-medium text-marca-forte underline">Personalização</span>.
        </span>
      </Link>

      <div className="flex justify-end">
        <Botao type="submit" carregando={pendente} className="w-full sm:w-auto">
          {pendente ? "Salvando..." : "Salvar configurações"}
        </Botao>
      </div>
    </form>
  );
}
