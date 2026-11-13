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
  created_at: string;
  updated_at: string;
};

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

export type StatusProposta = "rascunho" | "aguardando_aprovacao" | "enviada" | "aceita" | "recusada" | "substituida";

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
