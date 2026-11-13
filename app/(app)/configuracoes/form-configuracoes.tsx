"use client";

/**
 * Formulário padrão do projeto: useAcao(serverAction) + <form onSubmit> + <Botao carregando>.
 * Dados da empresa (cabeçalho da proposta) e regras comerciais.
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
        <h2 className="text-base font-semibold text-texto">Empresa (aparece no cabeçalho das propostas)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome da empresa" nome="nome_negocio" erro={e.nome_negocio}>
            {(p) => <Entrada {...p} defaultValue={config.nome_negocio} required maxLength={80} autoComplete="organization" />}
          </Campo>
          <Campo rotulo="CNPJ" nome="documento" erro={e.documento}>
            {(p) => <Entrada {...p} defaultValue={config.documento ?? ""} maxLength={30} placeholder="00.000.000/0001-00" />}
          </Campo>
          <Campo rotulo="WhatsApp / telefone" nome="whatsapp" erro={e.whatsapp} ajuda="Com DDD. Ex.: (11) 90000-0000">
            {(p) => <Entrada {...p} type="tel" inputMode="tel" defaultValue={formatarTelefone(config.whatsapp)} autoComplete="tel" />}
          </Campo>
          <Campo rotulo="E-mail comercial" nome="email" erro={e.email}>
            {(p) => <Entrada {...p} type="email" defaultValue={config.email ?? ""} maxLength={160} />}
          </Campo>
          <Campo rotulo="Site" nome="site" erro={e.site}>
            {(p) => <Entrada {...p} defaultValue={config.site ?? ""} maxLength={160} placeholder="www.suaempresa.com.br" />}
          </Campo>
          <Campo rotulo="Instagram" nome="instagram" erro={e.instagram}>
            {(p) => <Entrada {...p} defaultValue={config.instagram ?? ""} placeholder="@suaempresa" />}
          </Campo>
          <Campo rotulo="Cidade" nome="cidade" erro={e.cidade}>
            {(p) => <Entrada {...p} defaultValue={config.cidade ?? ""} placeholder="Campinas - SP" />}
          </Campo>
          <Campo rotulo="Endereço" nome="endereco" erro={e.endereco}>
            {(p) => <Entrada {...p} defaultValue={config.endereco ?? ""} placeholder="Rua, número, bairro" />}
          </Campo>
        </div>
      </Cartao>

      <Cartao className="space-y-4">
        <h2 className="text-base font-semibold text-texto">Regras comerciais</h2>
        <label className="flex items-start gap-3 rounded-xl border border-borda p-3 text-sm">
          <input type="checkbox" name="vendedores_veem_tudo" defaultChecked={config.vendedores_veem_tudo} className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" />
          <span>
            <strong className="block text-texto">Vendedores veem tudo</strong>
            Desligado (padrão): cada vendedor vê só os próprios contatos, negócios e atividades. Ligado: todos veem os dados do time, mas cada um
            continua editando só os seus. Comissões são sempre individuais.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Validade padrão da proposta (dias)" nome="validade_proposta_dias" erro={e.validade_proposta_dias}>
            {(p) => <Entrada {...p} type="number" inputMode="numeric" min={1} max={365} defaultValue={config.validade_proposta_dias} />}
          </Campo>
          <Campo rotulo="Negócio “esfriando” após (dias sem contato)" nome="dias_sem_contato" erro={e.dias_sem_contato}>
            {(p) => <Entrada {...p} type="number" inputMode="numeric" min={1} max={90} defaultValue={config.dias_sem_contato} />}
          </Campo>
          <Campo
            rotulo="Desconto máx. em itens avulsos (%)"
            nome="desconto_max_avulso"
            erro={e.desconto_max_avulso}
            ajuda="Para itens fora do catálogo."
          >
            {(p) => <Entrada {...p} inputMode="decimal" defaultValue={String(config.desconto_max_avulso).replace(".", ",")} />}
          </Campo>
        </div>
        <Campo rotulo="Condições de pagamento padrão (proposta)" nome="condicoes_padrao" erro={e.condicoes_padrao}>
          {(p) => <AreaTexto {...p} rows={3} maxLength={1000} defaultValue={config.condicoes_padrao ?? ""} placeholder="Ex.: 30% na assinatura e saldo em 2x no boleto." />}
        </Campo>
        <Campo rotulo="Rodapé da proposta" nome="rodape_proposta" erro={e.rodape_proposta}>
          {(p) => <AreaTexto {...p} rows={2} maxLength={500} defaultValue={config.rodape_proposta ?? ""} placeholder="Ex.: Impostos inclusos. Preços válidos para SP." />}
        </Campo>
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
          <strong className="text-texto">Logo, cores e fonte</strong> (também usadas na proposta) ficam em{" "}
          <span className="font-medium text-marca-forte underline">Personalização</span>.
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
