/**
 * Leitura da linha única de `configuracoes` (nome do negócio, WhatsApp, cor...).
 *
 * `cache()` faz o layout e a página compartilharem a MESMA consulta por requisição.
 * Se a tabela ainda não existir ou estiver vazia, devolve valores padrão
 * (o app continua abrindo e a tela de Configurações cria a linha ao salvar).
 */
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Configuracoes } from "@/lib/tipos";

export const CONFIG_PADRAO: Configuracoes = {
  id: "",
  unica: true,
  nome_negocio: "Aurora Bartenders",
  whatsapp: null,
  cidade: null,
  endereco: null,
  instagram: null,
  cor_primaria: "#021938",
  mensagem_whatsapp: null,
  nome_exibicao: null,
  subtitulo: null,
  logo_url: null,
  cor_destaque: "#C6A86A",
  fonte: "aurora",
  raio: "reto",
  tema_padrao: "claro",
  vendedores_veem_tudo: false,
  documento: null,
  email: null,
  site: null,
  validade_proposta_dias: 15,
  condicoes_padrao: null,
  rodape_proposta: null,
  desconto_max_avulso: 5,
  dias_sem_contato: 7,
  responsavel: null,
  uf: "MG",
  mod_empresas: false,
  mod_funis: false,
  mod_metas: false,
  mod_comissoes: false,
  mod_equipe: false,
  capacidade_simultanea: 3,
  duracao_padrao_horas: 4,
  atendimento_novos_leads: "humano",
  entrada_pct: null,
  entrada_dias_antes: null,
  saldo_dias_antes: null,
  cancelamento_aviso_dias: null,
  cancelamento_multa_pct: null,
  taxa_quebra: null,
  foro: null,
  prefixo_proposta: "PROP",
  proposta_textos: {},
  proposta_fotos: {},
  retencao_leads_meses: 12,
  email_privacidade: null,
  created_at: "",
  updated_at: "",
};

export const obterConfiguracoes = cache(async (): Promise<Configuracoes & { erro?: string }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
  if (error) {
    console.error("[configuracoes]", error.message);
    return { ...CONFIG_PADRAO, erro: error.message };
  }
  return data ?? CONFIG_PADRAO;
});
