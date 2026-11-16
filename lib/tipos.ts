/**
 * Tipos TypeScript das tabelas do banco (espelham supabase/schema.sql).
 *
 * Formato compatível com o `npx supabase gen types typescript` (Row / Insert / Update),
 * então dá para trocar este arquivo pelo gerado automaticamente se quiser.
 * Aqui Insert/Update são "parciais" da Row para ficar curto: o banco confere o resto.
 *
 * Para adicionar uma tabela: crie o tipo da linha (Row) e acrescente em Tables.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tabela<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type ConfiguracoesRow = {
  id: string;
  unica: boolean;
  nome_negocio: string;
  whatsapp: string | null;
  cidade: string | null;
  endereco: string | null;
  instagram: string | null;
  cor_primaria: string;
  mensagem_whatsapp: string | null;
  // Personalização (tela /personalizacao)
  nome_exibicao: string | null;
  subtitulo: string | null;
  logo_url: string | null;
  cor_destaque: string;
  fonte: string;
  raio: string;
  tema_padrao: string;
  // Comercial
  vendedores_veem_tudo: boolean;
  documento: string | null;
  email: string | null;
  site: string | null;
  validade_proposta_dias: number;
  condicoes_padrao: string | null;
  rodape_proposta: string | null;
  desconto_max_avulso: number;
  dias_sem_contato: number;
  // Aurora
  responsavel: string | null;
  uf: string | null;
  mod_empresas: boolean;
  mod_funis: boolean;
  mod_metas: boolean;
  mod_comissoes: boolean;
  mod_equipe: boolean;
  capacidade_simultanea: number;
  duracao_padrao_horas: number;
  atendimento_novos_leads: Atendimento;
  entrada_pct: number | null;
  entrada_dias_antes: number | null;
  saldo_dias_antes: number | null;
  cancelamento_aviso_dias: number | null;
  cancelamento_multa_pct: number | null;
  taxa_quebra: number | null;
  foro: string | null;
  prefixo_proposta: string;
  proposta_textos: Record<string, string>;
  proposta_fotos: Record<string, string>;
  retencao_leads_meses: number;
  email_privacidade: string | null;
  whatsapp_atendimento: string | null;
  retencao_automatica: boolean;
  created_at: string;
  updated_at: string;
};

/** Quem conversa com o cliente. */
export type Atendimento = "humano" | "agente";

export type Papel = "gestor" | "vendedor";

export type VendedorRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  nome: string;
  telefone: string | null;
  papel: Papel;
  equipe_id: string | null;
  cor: string;
  ativo: boolean;
  /** "agente" = o Agente SDR (vendedor especial, sem login). */
  tipo: "humano" | "agente";
  created_at: string;
  updated_at: string;
};

export type EquipeRow = { id: string; nome: string; created_at: string; updated_at: string };

export type ItemListaRow = { id: string; nome: string; ativo: boolean; ordem: number; created_at: string; updated_at: string };

export type CanalModelo = "whatsapp" | "email";
export type ModeloMensagemRow = {
  id: string;
  titulo: string;
  canal: CanalModelo;
  texto: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type FunilRow = { id: string; nome: string; ordem: number; ativo: boolean; created_at: string; updated_at: string };

export type EtapaRow = {
  id: string;
  funil_id: string;
  nome: string;
  ordem: number;
  probabilidade: number;
  cor: string;
  created_at: string;
  updated_at: string;
};

export type ProdutoRow = {
  id: string;
  nome: string;
  codigo: string | null;
  tipo: "produto" | "servico";
  descricao: string | null;
  unidade: string;
  preco: number;
  desconto_max: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Porte = "mei" | "pequena" | "media" | "grande";

export type EmpresaRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  segmento: string | null;
  porte: Porte | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  tags: string[];
  origem_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContatoRow = {
  id: string;
  nome: string;
  tipo: "pf" | "pj";
  empresa_id: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  cidade: string | null;
  tags: string[];
  origem_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  /** Pediu para não receber mensagens (datas preenchidas pelo banco). */
  nao_contatar: boolean;
  nao_contatar_em: string | null;
  nao_contatar_motivo: string | null;
  /** Consentiu receber mensagens de retomada. */
  aceita_retomadas: boolean;
  aceita_retomadas_em: string | null;
  created_at: string;
  updated_at: string;
};

export type StatusNegocio = "aberto" | "ganho" | "perdido";

export type NegocioRow = {
  id: string;
  titulo: string;
  funil_id: string;
  etapa_id: string;
  vendedor_id: string;
  contato_id: string | null;
  empresa_id: string | null;
  origem_id: string | null;
  valor: number;
  previsao_fechamento: string | null;
  status: StatusNegocio;
  motivo_perda_id: string | null;
  motivo_perda_detalhe: string | null;
  fechado_em: string | null;
  etapa_desde: string | null;
  ultima_atividade_em: string | null;
  tags: string[];
  observacoes: string | null;
  /** Código curto do pedido (ex.: A7K2Q9). */
  codigo: string | null;
  atendimento: Atendimento;
  atendimento_desde: string;
  created_at: string;
  updated_at: string;
};

export type NegocioProdutoRow = {
  id: string;
  negocio_id: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
  total: number;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type HistoricoEtapaRow = {
  id: string;
  negocio_id: string;
  funil_id: string | null;
  de_etapa_id: string | null;
  para_etapa_id: string | null;
  de_status: StatusNegocio | null;
  para_status: StatusNegocio;
  movido_em: string;
  segundos_na_etapa: number | null;
  autor_id: string | null;
};

export type TipoAtividade = "tarefa" | "ligacao" | "reuniao" | "whatsapp" | "email" | "visita";

export type AtividadeRow = {
  id: string;
  tipo: TipoAtividade;
  titulo: string;
  descricao: string | null;
  quando: string;
  duracao_min: number | null;
  vendedor_id: string;
  negocio_id: string | null;
  contato_id: string | null;
  empresa_id: string | null;
  concluida: boolean;
  concluida_em: string | null;
  resultado: string | null;
  created_at: string;
  updated_at: string;
};

export type StatusProposta =
  | "rascunho"
  | "aguardando_aprovacao"
  | "ajustes_solicitados"
  | "aprovada"
  | "enviada"
  | "aceita"
  | "recusada"
  | "substituida";

export type TipoEvento = "casamento" | "15_anos" | "aniversario" | "formatura" | "empresa" | "outro";
export type LinhaBebida = "tradicional" | "premium";
export type Copo = "long_drink" | "baixo" | "caneca" | "taca" | "outro";

/** Cópia dos dados do evento guardada na proposta. */
export type EventoProposta = {
  tipo?: TipoEvento | null;
  nome?: string | null;
  data?: string | null;
  mes_previsto?: string | null;
  hora_inicio?: string | null;
  duracao_horas?: number | null;
  cidade?: string | null;
  uf?: string | null;
  local?: string | null;
  convidados?: number | null;
  convidados_faixa?: string | null;
};

/** Um drink no cardápio da proposta. */
export type DrinkCardapio = {
  drink_id?: string | null;
  nome: string;
  descricao?: string | null;
  foto_url?: string | null;
  alcoolico?: boolean | null;
  copo?: Copo | null;
  categoria?: string | null;
};

export type PropostaRow = {
  id: string;
  negocio_id: string;
  vendedor_id: string | null;
  numero: string;
  versao: number;
  codigo: string;
  titulo: string;
  status: StatusProposta;
  validade: string;
  condicoes_pagamento: string | null;
  prazo_entrega: string | null;
  observacoes: string | null;
  subtotal: number;
  desconto_total: number;
  total: number;
  precisa_aprovacao: boolean;
  aprovacao_pedida_em: string | null;
  aprovada_em: string | null;
  aprovada_por: string | null;
  enviada_em: string | null;
  visualizada_em: string | null;
  visualizacoes: number;
  aceita_em: string | null;
  aceite_nome: string | null;
  aceite_ip: string | null;
  aceite_navegador: string | null;
  aceite_via: "link" | "manual" | null;
  // Aurora
  origem: Atendimento;
  evento: EventoProposta;
  cardapio: DrinkCardapio[];
  pacote_nome: string | null;
  linha: LinhaBebida | null;
  capa_titulo: string | null;
  capa_subtitulo: string | null;
  capa_foto_url: string | null;
  apresentacao: string | null;
  descricao_servico: string | null;
  mensagem_final: string | null;
  foto_final_url: string | null;
  entrada_pct: number | null;
  entrada_dias_antes: number | null;
  saldo_dias_antes: number | null;
  cancelamento_aviso_dias: number | null;
  cancelamento_multa_pct: number | null;
  taxa_quebra: number | null;
  foro: string | null;
  calculo: ResultadoCalculo | null;
  preco_pendente: boolean;
  /** Copos descartáveis no lugar da vidraria (com desconto). */
  sem_vidraria: boolean;
  nota_interna: string | null;
  submetida_por: string | null;
  ajustes_comentario: string | null;
  ajustes_em: string | null;
  ajustes_por: string | null;
  created_at: string;
  updated_at: string;
};

export type PropostaItemRow = {
  id: string;
  proposta_id: string;
  produto_id: string | null;
  descricao: string;
  detalhes: string | null;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
  desconto_limite: number;
  acima_limite: boolean;
  total: number;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type MetaRow = {
  id: string;
  competencia: string;
  vendedor_id: string | null;
  equipe_id: string | null;
  meta_valor: number;
  meta_qtd: number;
  created_at: string;
  updated_at: string;
};

export type RegraComissaoRow = {
  id: string;
  nome: string;
  vendedor_id: string | null;
  produto_id: string | null;
  percentual: number;
  valor_min: number | null;
  valor_max: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type LinhaComissao = { descricao: string; base: number; percentual: number; regra: string; comissao: number };

export type ComissaoRow = {
  id: string;
  negocio_id: string;
  vendedor_id: string;
  competencia: string;
  valor_base: number;
  valor: number;
  percentual_medio: number;
  detalhes: LinhaComissao[];
  status: "pendente" | "paga";
  paga_em: string | null;
  paga_por: string | null;
  observacao: string | null;
  calculada_em: string;
  created_at: string;
  updated_at: string;
};

export type AuditoriaRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  autor: string;
  tabela: string;
  registro_id: string | null;
  negocio_id: string | null;
  acao: "criou" | "alterou" | "excluiu";
  campos: string[] | null;
  descricao: string | null;
  ator_tipo: "humano" | "agente" | "cliente" | "site" | "sistema";
  chave_api_id: string | null;
};

// ---------------------------------------------------------------------
// AURORA: evento, agenda, catálogo, calculadora, atendimento, integrações
// ---------------------------------------------------------------------
export type SituacaoData = "consulta" | "reservada" | "confirmada" | "liberada";

export type EventoRow = {
  id: string;
  negocio_id: string;
  tipo: TipoEvento | null;
  nome: string | null;
  data: string | null;
  mes_previsto: string | null;
  hora_inicio: string | null;
  duracao_horas: number | null;
  cidade: string | null;
  uf: string | null;
  local: string | null;
  convidados: number | null;
  convidados_faixa: string | null;
  pacote_id: string | null;
  quer_ajuda_pacote: boolean;
  linha: LinhaBebida | null;
  preferencias: string[];
  observacoes: string | null;
  situacao_data: SituacaoData;
  reservada_ate: string | null;
  created_at: string;
  updated_at: string;
};

export type BloqueioAgendaRow = { id: string; inicio: string; fim: string; motivo: string | null; created_at: string; updated_at: string };

export type CategoriaInsumo =
  | "destilado"
  | "licor"
  | "vinho"
  | "fruta"
  | "xarope"
  | "suco"
  | "refrigerante"
  | "gelo"
  | "guarnicao"
  | "descartavel"
  | "outro";

export type InsumoRow = {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
  unidade: "ml" | "g" | "un";
  embalagem: number;
  preco_tradicional: number | null;
  preco_premium: number | null;
  marca_tradicional: string | null;
  marca_premium: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoriaDrink = "classico" | "premium" | "sem_alcool" | "autoral";

export type DrinkRow = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: CategoriaDrink;
  alcoolico: boolean;
  copo: Copo | null;
  foto_url: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type DrinkInsumoRow = { id: string; drink_id: string; insumo_id: string; quantidade: number; created_at: string; updated_at: string };

export type PacoteRow = {
  id: string;
  nome: string;
  slogan: string | null;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  /** Acréscimo (%) sobre o preço calculado, para os pacotes mais completos. */
  acrescimo_pct: number;
  created_at: string;
  updated_at: string;
};

export type PacoteDrinkRow = { pacote_id: string; drink_id: string; ordem: number; created_at: string };

export type CalculadoraRow = {
  id: string;
  unica: boolean;
  drinks_por_convidado_hora: number | null;
  convidados_por_bartender: number | null;
  minimo_bartenders: number;
  custo_bartender_hora: number | null;
  horas_montagem: number;
  custo_fixo: number;
  taxa_outra_cidade: number;
  perdas_pct: number;
  margem_pct: number | null;
  arredondar_para: number;
  preco_minimo: number;
  desconto_sem_vidraria: number;
  aprovada: boolean;
  aprovada_em: string | null;
  aprovada_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Memória de cálculo devolvida por calcular_preco(). */
export type ResultadoCalculo = {
  ok: boolean;
  aprovada: boolean;
  pendencias: string[];
  entrada?: { pacote_id: string | null; pacote: string | null; convidados: number; duracao_horas: number; linha: LinhaBebida; outra_cidade: boolean; sem_vidraria?: boolean };
  total_drinks?: number;
  drinks?: { id: string; nome: string; quantidade: number }[];
  insumos?: {
    id: string;
    nome: string;
    categoria: CategoriaInsumo;
    unidade: string;
    quantidade: number;
    embalagem: number;
    embalagens: number;
    preco_embalagem: number;
    linha: LinhaBebida;
    marca: string | null;
    custo: number;
    compra: number;
  }[];
  bartenders?: number;
  custos?: {
    insumos: number;
    compra_embalagens_inteiras: number;
    mao_de_obra: number;
    fixo: number;
    outra_cidade: number;
    total: number;
    margem_pct: number;
    acrescimo_pacote_pct?: number;
    desconto_sem_vidraria?: number;
  };
  preco_sugerido?: number;
  calculado_em?: string;
};

export type Disponibilidade = {
  data: string;
  hora_inicio: string | null;
  capacidade: number;
  confirmados: number;
  reservados: number;
  vagas: number;
  bloqueada: boolean;
  motivo_bloqueio: string | null;
  situacao: "livre" | "parcial" | "lotada" | "bloqueada";
  eventos_no_dia: { hora_inicio: string | null; duracao_horas: number | null; situacao: "confirmada" | "reservada"; bate_no_horario: boolean }[];
};

export type PropostaRevisaoRow = {
  id: string;
  proposta_id: string;
  de_status: StatusProposta | null;
  para_status: StatusProposta;
  comentario: string | null;
  autor_id: string | null;
  autor_tipo: string;
  created_at: string;
};

export type TransferenciaRow = {
  id: string;
  negocio_id: string;
  de: Atendimento;
  para: Atendimento;
  motivo: string | null;
  autor_id: string | null;
  autor_tipo: "humano" | "agente" | "sistema";
  created_at: string;
};

export type CanalMensagem = "whatsapp" | "instagram" | "email" | "telefone" | "site" | "outro";

export type MensagemRow = {
  id: string;
  negocio_id: string;
  contato_id: string | null;
  canal: CanalMensagem;
  direcao: "entrada" | "saida";
  autor: "cliente" | "agente" | "humano" | "sistema";
  texto: string;
  enviada_em: string;
  id_externo: string | null;
  created_at: string;
};

export type LeadRecebidoRow = {
  id: string;
  created_at: string;
  origem: string;
  dados: Json;
  ip_hash: string | null;
  contato_id: string | null;
  negocio_id: string | null;
  status: "processado" | "duplicado" | "rejeitado";
  motivo: string | null;
};

export type EventoSaidaRow = {
  id: number;
  tipo: string;
  negocio_id: string | null;
  proposta_id: string | null;
  contato_id: string | null;
  dados: Json;
  created_at: string;
};

export type WebhookRow = {
  id: string;
  nome: string;
  url: string;
  segredo: string;
  eventos: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookEntregaRow = {
  id: number;
  evento_id: number;
  webhook_id: string;
  status: "pendente" | "enviando" | "entregue" | "falhou" | "desistiu";
  tentativas: number;
  pedido_id: number | null;
  http_status: number | null;
  erro: string | null;
  proxima_tentativa_em: string;
  entregue_em: string | null;
  created_at: string;
  updated_at: string;
};

export type ChaveApiRow = {
  id: string;
  nome: string;
  prefixo: string;
  hash: string;
  escopos: string[];
  limite_por_minuto: number;
  ativa: boolean;
  criada_por: string | null;
  ultimo_uso_em: string | null;
  revogada_em: string | null;
  created_at: string;
  updated_at: string;
};

export type AgenteLogRow = {
  id: number;
  created_at: string;
  chave_id: string | null;
  acao: string;
  status: number;
  ok: boolean;
  negocio_id: string | null;
  registro_id: string | null;
  resumo: string | null;
  erro: string | null;
  pedido: Json;
  ip: string | null;
  duracao_ms: number | null;
};

export type ResultadoImportacao = {
  criados: number;
  duplicados: number;
  erros: number;
  empresas: number;
  simulado: boolean;
  linhas: { linha: number; status: "ok" | "erro" | "duplicado" | "duplicado_importado"; motivo: string | null }[];
};

export type Database = {
  public: {
    Tables: {
      configuracoes: Tabela<ConfiguracoesRow>;
      equipes: Tabela<EquipeRow>;
      vendedores: Tabela<VendedorRow>;
      origens: Tabela<ItemListaRow>;
      motivos_perda: Tabela<ItemListaRow>;
      modelos_mensagem: Tabela<ModeloMensagemRow>;
      funis: Tabela<FunilRow>;
      etapas: Tabela<EtapaRow>;
      produtos: Tabela<ProdutoRow>;
      empresas: Tabela<EmpresaRow>;
      contatos: Tabela<ContatoRow>;
      negocios: Tabela<NegocioRow>;
      negocio_produtos: Tabela<NegocioProdutoRow>;
      historico_etapas: Tabela<HistoricoEtapaRow>;
      atividades: Tabela<AtividadeRow>;
      propostas: Tabela<PropostaRow>;
      proposta_itens: Tabela<PropostaItemRow>;
      metas: Tabela<MetaRow>;
      regras_comissao: Tabela<RegraComissaoRow>;
      comissoes: Tabela<ComissaoRow>;
      auditoria: Tabela<AuditoriaRow>;
      eventos: Tabela<EventoRow>;
      bloqueios_agenda: Tabela<BloqueioAgendaRow>;
      insumos: Tabela<InsumoRow>;
      drinks: Tabela<DrinkRow>;
      drink_insumos: Tabela<DrinkInsumoRow>;
      pacotes: Tabela<PacoteRow>;
      pacote_drinks: Tabela<PacoteDrinkRow>;
      calculadora: Tabela<CalculadoraRow>;
      proposta_revisoes: Tabela<PropostaRevisaoRow>;
      transferencias: Tabela<TransferenciaRow>;
      mensagens: Tabela<MensagemRow>;
      leads_recebidos: Tabela<LeadRecebidoRow>;
      eventos_saida: Tabela<EventoSaidaRow>;
      webhooks: Tabela<WebhookRow>;
      webhook_entregas: Tabela<WebhookEntregaRow>;
      chaves_api: Tabela<ChaveApiRow>;
      agente_log: Tabela<AgenteLogRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      /** Campos de MARCA para telas sem login (security definer — veja schema.sql). */
      marca_publica: {
        Args: never;
        Returns: {
          nome_exibido: string;
          subtitulo: string | null;
          logo_url: string | null;
          cor_primaria: string;
          cor_destaque: string;
          fonte: string;
          raio: string;
          tema_padrao: string;
        }[];
      };
      meu_perfil: { Args: never; Returns: Json };
      criar_proposta: { Args: { p_negocio_id: string }; Returns: string };
      salvar_proposta: { Args: { p_id: string; p_dados: Json; p_itens: Json }; Returns: undefined };
      nova_versao_proposta: { Args: { p_id: string }; Returns: string };
      duplicar_proposta: { Args: { p_id: string; p_negocio_destino: string }; Returns: string };
      calcular_preco: { Args: { p: Json }; Returns: Json };
      calculadora_pendencias: { Args: never; Returns: string[] };
      aprovar_calculadora: { Args: never; Returns: undefined };
      disponibilidade_data: {
        Args: { p_data: string; p_hora?: string | null; p_duracao?: number | null; p_ignorar?: string | null };
        Returns: Json;
      };
      transferir_atendimento: { Args: { p_negocio: string; p_para: string; p_motivo?: string | null }; Returns: boolean };
      receber_lead_site: { Args: { p: Json; p_ip?: string | null }; Returns: Json };
      api_agente: { Args: { p_chave: string; p_acao: string; p_dados?: Json; p_meta?: Json }; Returns: Json };
      criar_chave_api: { Args: { p_nome: string; p_escopos?: string[] | null; p_limite?: number }; Returns: Json };
      revogar_chave_api: { Args: { p_id: string }; Returns: undefined };
      testar_webhook: { Args: { p_webhook: string }; Returns: number };
      processar_webhooks: { Args: never; Returns: undefined };
      exportar_contato: { Args: { p_id: string }; Returns: Json };
      anonimizar_contato: { Args: { p_id: string; p_incluir_fechados?: boolean }; Returns: Json };
      aplicar_retencao: { Args: { p_simular?: boolean }; Returns: number };
      recalcular_comissoes_pendentes: { Args: never; Returns: number };
      ranking_vendedores: {
        Args: { p_inicio: string; p_fim: string };
        Returns: {
          vendedor_id: string;
          nome: string;
          cor: string;
          equipe: string | null;
          ganhos: number;
          valor_ganho: number;
          perdidos: number;
          meta_valor: number;
          meta_qtd: number;
        }[];
      };
      progresso_metas: {
        Args: { p_competencia: string };
        Returns: {
          meta_id: string;
          vendedor_id: string | null;
          equipe_id: string | null;
          nome: string;
          meta_valor: number;
          meta_qtd: number;
          realizado_valor: number;
          realizado_qtd: number;
        }[];
      };
      contatos_duplicados: {
        Args: { p_email: string | null; p_telefone: string | null; p_ignorar?: string | null };
        Returns: { id: string; nome: string; motivo: string; responsavel: string | null; visivel: boolean }[];
      };
      importar_leads: {
        Args: {
          p_linhas: Json;
          p_responsavel: string | null;
          p_origem: string | null;
          p_tags: string[] | null;
          p_pular_duplicados: boolean;
          p_simular: boolean;
        };
        Returns: Json;
      };
      proposta_publica: { Args: { p_codigo: string }; Returns: Json };
      aceitar_proposta_publica: {
        Args: { p_codigo: string; p_nome: string; p_ip?: string | null; p_navegador?: string | null };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type Tabelas = Database["public"]["Tables"];

/** Linha de uma tabela: Linha<"configuracoes"> */
export type Linha<T extends keyof Tabelas> = Tabelas[T]["Row"];

// Atalhos
export type Configuracoes = ConfiguracoesRow;
export type Vendedor = VendedorRow;
export type Equipe = EquipeRow;
export type Origem = ItemListaRow;
export type MotivoPerda = ItemListaRow;
export type ModeloMensagem = ModeloMensagemRow;
export type Funil = FunilRow;
export type Etapa = EtapaRow;
export type Produto = ProdutoRow;
export type Empresa = EmpresaRow;
export type Contato = ContatoRow;
export type Negocio = NegocioRow;
export type NegocioProduto = NegocioProdutoRow;
export type HistoricoEtapa = HistoricoEtapaRow;
export type Atividade = AtividadeRow;
export type Proposta = PropostaRow;
export type PropostaItem = PropostaItemRow;
export type Meta = MetaRow;
export type RegraComissao = RegraComissaoRow;
export type Comissao = ComissaoRow;
export type Auditoria = AuditoriaRow;
export type Evento = EventoRow;
export type BloqueioAgenda = BloqueioAgendaRow;
export type Insumo = InsumoRow;
export type Drink = DrinkRow;
export type DrinkInsumo = DrinkInsumoRow;
export type Pacote = PacoteRow;
export type PacoteDrink = PacoteDrinkRow;
export type Calculadora = CalculadoraRow;
export type PropostaRevisao = PropostaRevisaoRow;
export type Transferencia = TransferenciaRow;
export type Mensagem = MensagemRow;
export type Webhook = WebhookRow;
export type WebhookEntrega = WebhookEntregaRow;
export type EventoSaida = EventoSaidaRow;
export type ChaveApi = ChaveApiRow;
export type AgenteLog = AgenteLogRow;
