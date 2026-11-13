-- =====================================================================
-- DADOS DE EXEMPLO (OPCIONAL) — rode DEPOIS do schema.sql.
-- Empresa fictícia: LUMEN SOLUÇÕES EM TI (Campinas - SP), que vende
-- equipamentos, licenças e serviços de TI para outras empresas (B2B).
--
-- Cria: 1 gestora + 4 vendedores (2 equipes), 2 funis, 12 produtos/serviços,
-- 45 empresas, ~70 contatos, 150 negócios nos últimos 6 meses (com histórico
-- de etapas), ~400 atividades, 12 propostas (1 aceita pelo link, 1 aguardando
-- aprovação de desconto, 1 com 2 versões), metas e comissões (meses
-- anteriores já pagos).
--
-- Pode rodar de novo: apaga os exemplos anteriores e recria com datas a partir de hoje.
-- Para começar "limpo" com o cliente real, simplesmente NÃO rode este arquivo.
-- =====================================================================

-- Durante o seed: histórico com datas do passado (gravado aqui) e sem auditoria.
do $$ begin
  perform set_config('app.seed', 'on', false);
  perform set_config('app.sem_auditoria', 'on', false);
end $$;

-- ---------------------------------------------------------------------
-- Empresa (Configurações)
-- ---------------------------------------------------------------------
insert into public.configuracoes
  (unica, nome_negocio, whatsapp, cidade, endereco, instagram, mensagem_whatsapp, documento, email, site,
   validade_proposta_dias, condicoes_padrao, rodape_proposta, desconto_max_avulso, dias_sem_contato, vendedores_veem_tudo)
values
  (true,
   'Lumen Soluções em TI',
   '5519933330000',
   'Campinas - SP',
   'Av. José de Souza Campos, 1500 - Cambuí',
   'lumenti',
   'Olá, {nome}! Aqui é {vendedor}, da Lumen Soluções em TI. Tudo bem?',
   '12.345.678/0001-95',
   'comercial@lumenti.com.br',
   'www.lumenti.com.br',
   15,
   'Entrada de 30% na assinatura e saldo em 2x (30/60 dias) no boleto. Serviços mensais: boleto todo dia 10.',
   'Lumen Soluções em TI Ltda · CNPJ 12.345.678/0001-95 · Preços válidos para o estado de SP. Impostos inclusos.',
   5, 7, false)
on conflict (unica) do update set
  nome_negocio           = excluded.nome_negocio,
  whatsapp               = excluded.whatsapp,
  cidade                 = excluded.cidade,
  endereco               = excluded.endereco,
  instagram              = excluded.instagram,
  mensagem_whatsapp      = excluded.mensagem_whatsapp,
  documento              = excluded.documento,
  email                  = excluded.email,
  site                   = excluded.site,
  validade_proposta_dias = excluded.validade_proposta_dias,
  condicoes_padrao       = excluded.condicoes_padrao,
  rodape_proposta        = excluded.rodape_proposta,
  desconto_max_avulso    = excluded.desconto_max_avulso,
  dias_sem_contato       = excluded.dias_sem_contato;

-- ---------------------------------------------------------------------
-- Equipes e vendedores (crie no Supabase Auth usuários com estes e-mails
-- para entrar como cada um — o vínculo é feito sozinho pelo e-mail)
-- ---------------------------------------------------------------------
insert into public.equipes (id, nome) values
  ('10000000-0000-4000-8000-000000000001', 'Equipe Capital'),
  ('10000000-0000-4000-8000-000000000002', 'Equipe Interior')
on conflict (id) do update set nome = excluded.nome;

insert into public.vendedores (id, email, nome, telefone, papel, equipe_id, cor, ativo) values
  ('20000000-0000-4000-8000-000000000001', 'marina.couto@lumenti.com.br', 'Marina Couto', '19991110001', 'gestor', null, '#7C3AED', true),
  ('20000000-0000-4000-8000-000000000002', 'rafael.mendes@lumenti.com.br', 'Rafael Mendes', '11991110002', 'vendedor', '10000000-0000-4000-8000-000000000001', '#2563EB', true),
  ('20000000-0000-4000-8000-000000000003', 'juliana.prado@lumenti.com.br', 'Juliana Prado', '11991110003', 'vendedor', '10000000-0000-4000-8000-000000000001', '#DB2777', true),
  ('20000000-0000-4000-8000-000000000004', 'bruno.takahashi@lumenti.com.br', 'Bruno Takahashi', '19991110004', 'vendedor', '10000000-0000-4000-8000-000000000002', '#059669', true),
  ('20000000-0000-4000-8000-000000000005', 'camila.ferraz@lumenti.com.br', 'Camila Ferraz', '19991110005', 'vendedor', '10000000-0000-4000-8000-000000000002', '#D97706', true)
on conflict (id) do update set
  nome = excluded.nome, telefone = excluded.telefone, papel = excluded.papel,
  equipe_id = excluded.equipe_id, cor = excluded.cor, ativo = true;

-- ---------------------------------------------------------------------
-- Listas: origens, motivos de perda, modelos de mensagem
-- ---------------------------------------------------------------------
insert into public.origens (id, nome, ordem) values
  ('30000000-0000-4000-8000-000000000001', 'Site / formulário', 1),
  ('30000000-0000-4000-8000-000000000002', 'Indicação de cliente', 2),
  ('30000000-0000-4000-8000-000000000003', 'Google Ads', 3),
  ('30000000-0000-4000-8000-000000000004', 'LinkedIn', 4),
  ('30000000-0000-4000-8000-000000000005', 'Feira / evento', 5),
  ('30000000-0000-4000-8000-000000000006', 'Prospecção ativa', 6),
  ('30000000-0000-4000-8000-000000000007', 'Instagram', 7)
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem, ativo = true;

insert into public.motivos_perda (id, nome, ordem) values
  ('40000000-0000-4000-8000-000000000001', 'Preço acima do orçamento do cliente', 1),
  ('40000000-0000-4000-8000-000000000002', 'Fechou com concorrente', 2),
  ('40000000-0000-4000-8000-000000000003', 'Projeto adiado / sem verba', 3),
  ('40000000-0000-4000-8000-000000000004', 'Parou de responder', 4),
  ('40000000-0000-4000-8000-000000000005', 'Não era o perfil (fora do escopo)', 5),
  ('40000000-0000-4000-8000-000000000006', 'Prazo de entrega não atendia', 6)
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem, ativo = true;

insert into public.modelos_mensagem (id, titulo, canal, texto, ordem) values
  ('70000000-0000-4000-8000-000000000001', 'Primeiro contato', 'whatsapp',
   'Olá, {nome}! Aqui é {vendedor}, da Lumen Soluções em TI. Vi o interesse da {empresa} e queria entender melhor o cenário de TI de vocês. Podemos falar 15 minutos hoje ou amanhã?', 1),
  ('70000000-0000-4000-8000-000000000002', 'Envio de proposta', 'whatsapp',
   'Oi, {nome}! Conforme combinamos, segue a proposta para {negocio} (total {valor}). É só abrir o link e, se estiver tudo certo, clicar em "Aceitar proposta": {link_proposta}', 2),
  ('70000000-0000-4000-8000-000000000003', 'Follow-up da proposta', 'whatsapp',
   'Olá, {nome}, tudo bem? Conseguiu avaliar a proposta que enviei? Ela vale até {validade}. Fico à disposição para ajustar o que for preciso.', 3),
  ('70000000-0000-4000-8000-000000000004', 'Confirmar reunião', 'whatsapp',
   'Oi, {nome}! Passando para confirmar nossa reunião sobre {negocio}. Está mantido?', 4),
  ('70000000-0000-4000-8000-000000000005', 'Pós-venda / boas-vindas', 'whatsapp',
   'Olá, {nome}! Obrigado por fechar com a Lumen. Nosso time técnico vai entrar em contato para agendar a implantação. Qualquer dúvida, conte comigo! — {vendedor}', 5),
  ('70000000-0000-4000-8000-000000000006', 'Proposta por e-mail', 'email',
   'Prezado(a) {nome},\n\nSegue a proposta comercial para {negocio}, no valor de {valor}, válida até {validade}.\nVocê pode visualizar e aceitar pelo link: {link_proposta}\n\nAtenciosamente,\n{vendedor}\nLumen Soluções em TI', 6),
  ('70000000-0000-4000-8000-000000000007', 'Reativar contato', 'email',
   'Olá, {nome}!\n\nFaz um tempo que não conversamos. A {empresa} ainda tem planos de modernizar a infraestrutura de TI este ano? Posso enviar algumas novidades que podem ajudar.\n\nAbraço,\n{vendedor}', 7)
on conflict (id) do update set titulo = excluded.titulo, canal = excluded.canal, texto = excluded.texto, ordem = excluded.ordem, ativo = true;

-- ---------------------------------------------------------------------
-- Funis e etapas (probabilidade de fechar em %)
-- ---------------------------------------------------------------------
insert into public.funis (id, nome, ordem) values
  ('50000000-0000-4000-8000-000000000001', 'Vendas B2B (projetos e equipamentos)', 1),
  ('50000000-0000-4000-8000-000000000002', 'Contratos recorrentes (suporte e nuvem)', 2)
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem, ativo = true;

insert into public.etapas (id, funil_id, nome, ordem, probabilidade, cor) values
  ('51000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000001', 'Prospecção', 1, 10, '#64748B'),
  ('51000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000001', 'Qualificação', 2, 20, '#0EA5E9'),
  ('51000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000001', 'Diagnóstico / reunião', 3, 40, '#6366F1'),
  ('51000000-0000-4000-8000-000000000014', '50000000-0000-4000-8000-000000000001', 'Proposta enviada', 4, 60, '#F59E0B'),
  ('51000000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000001', 'Negociação', 5, 80, '#10B981'),
  ('51000000-0000-4000-8000-000000000021', '50000000-0000-4000-8000-000000000002', 'Lead', 1, 10, '#64748B'),
  ('51000000-0000-4000-8000-000000000022', '50000000-0000-4000-8000-000000000002', 'Visita técnica', 2, 30, '#0EA5E9'),
  ('51000000-0000-4000-8000-000000000023', '50000000-0000-4000-8000-000000000002', 'Proposta', 3, 60, '#F59E0B'),
  ('51000000-0000-4000-8000-000000000024', '50000000-0000-4000-8000-000000000002', 'Fechamento', 4, 85, '#10B981')
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem, probabilidade = excluded.probabilidade, cor = excluded.cor;

-- ---------------------------------------------------------------------
-- Produtos e serviços (preço, unidade e desconto máximo)
-- ---------------------------------------------------------------------
insert into public.produtos (id, nome, codigo, tipo, descricao, unidade, preco, desconto_max) values
  ('60000000-0000-4000-8000-000000000001', 'Notebook corporativo i5 16GB', 'NB-I5', 'produto', 'Notebook 14", Core i5, 16 GB RAM, SSD 512 GB, Windows 11 Pro, garantia de 3 anos on-site.', 'un', 4290.00, 8),
  ('60000000-0000-4000-8000-000000000002', 'Monitor 24" Full HD', 'MON-24', 'produto', 'Monitor IPS 24", ajuste de altura, HDMI e DisplayPort.', 'un', 1150.00, 10),
  ('60000000-0000-4000-8000-000000000003', 'Licença Microsoft 365 Business Standard', 'M365-BS', 'servico', 'Licença anual por usuário (e-mail, Teams, Office e 1 TB OneDrive).', 'usuário/ano', 780.00, 5),
  ('60000000-0000-4000-8000-000000000004', 'Firewall gerenciado', 'FW-GER', 'produto', 'Appliance de firewall com configuração, VPN e monitoramento por 12 meses.', 'un', 6800.00, 7),
  ('60000000-0000-4000-8000-000000000005', 'Projeto de implantação de rede', 'IMP-REDE', 'servico', 'Levantamento, projeto, configuração de switches/Wi-Fi e documentação.', 'projeto', 9500.00, 10),
  ('60000000-0000-4000-8000-000000000006', 'Suporte de TI mensal (até 20 usuários)', 'SUP-20', 'servico', 'Atendimento remoto ilimitado e 4 visitas mensais, SLA de 4 horas.', 'mês', 2400.00, 15),
  ('60000000-0000-4000-8000-000000000007', 'Backup em nuvem 1 TB', 'BKP-1TB', 'servico', 'Backup diário automatizado com retenção de 30 dias.', 'mês', 390.00, 10),
  ('60000000-0000-4000-8000-000000000008', 'Treinamento de equipe', 'TRE-H', 'servico', 'Treinamento presencial ou online (Microsoft 365, segurança da informação).', 'hora', 280.00, 20),
  ('60000000-0000-4000-8000-000000000009', 'Cabeamento estruturado (ponto)', 'CAB-PT', 'servico', 'Ponto de rede Cat6 com certificação e identificação.', 'ponto', 185.00, 12),
  ('60000000-0000-4000-8000-000000000010', 'Consultoria LGPD', 'LGPD', 'servico', 'Diagnóstico, mapeamento de dados, políticas e treinamento do encarregado (DPO).', 'projeto', 7200.00, 10),
  ('60000000-0000-4000-8000-000000000011', 'Servidor Dell PowerEdge T350', 'SRV-T350', 'produto', 'Servidor torre Xeon, 32 GB, 2x SSD 960 GB RAID 1, 3 anos de garantia.', 'un', 18900.00, 6),
  ('60000000-0000-4000-8000-000000000012', 'Câmera IP com instalação', 'CAM-IP', 'produto', 'Câmera IP Full HD com visão noturna, instalação e configuração no app.', 'un', 890.00, 12)
on conflict (id) do update set nome = excluded.nome, codigo = excluded.codigo, tipo = excluded.tipo, descricao = excluded.descricao,
  unidade = excluded.unidade, preco = excluded.preco, desconto_max = excluded.desconto_max, ativo = true;

-- ---------------------------------------------------------------------
-- Regras de comissão (prioridade: vendedor+produto > produto > vendedor > geral)
-- ---------------------------------------------------------------------
insert into public.regras_comissao (id, nome, vendedor_id, produto_id, percentual, valor_min, valor_max) values
  ('80000000-0000-4000-8000-000000000001', 'Padrão (negócios até R$ 50 mil)', null, null, 5.00, null, 50000.00),
  ('80000000-0000-4000-8000-000000000002', 'Padrão (negócios acima de R$ 50 mil)', null, null, 4.00, 50000.01, null),
  ('80000000-0000-4000-8000-000000000003', 'Suporte mensal (recorrência)', null, '60000000-0000-4000-8000-000000000006', 8.00, null, null),
  ('80000000-0000-4000-8000-000000000004', 'Servidores (margem menor)', null, '60000000-0000-4000-8000-000000000011', 2.50, null, null),
  ('80000000-0000-4000-8000-000000000005', 'Juliana — vendedora sênior', '20000000-0000-4000-8000-000000000003', null, 6.00, null, null)
on conflict (id) do update set nome = excluded.nome, vendedor_id = excluded.vendedor_id, produto_id = excluded.produto_id,
  percentual = excluded.percentual, valor_min = excluded.valor_min, valor_max = excluded.valor_max, ativo = true;

-- ---------------------------------------------------------------------
-- Apaga os exemplos anteriores (negócios, atividades, propostas, contatos, empresas, metas)
-- ---------------------------------------------------------------------
delete from public.comissoes where negocio_id in (select md5('seed-neg-' || g)::uuid from generate_series(1, 200) g);
delete from public.negocios where id in (select md5('seed-neg-' || g)::uuid from generate_series(1, 200) g);
delete from public.contatos where id in (select md5('seed-ctt-' || g)::uuid from generate_series(1, 200) g);
delete from public.empresas where id in (select md5('seed-emp-' || g)::uuid from generate_series(1, 200) g);
delete from public.metas where id in (select md5('seed-meta-' || g)::uuid from generate_series(1, 200) g);

-- ---------------------------------------------------------------------
-- Empresas, contatos, negócios (com produtos e histórico) e atividades
-- ---------------------------------------------------------------------
do $$
declare
  v_vend   uuid[] := array['20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003',
                           '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005']::uuid[];
  v_orig   uuid[] := array['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
                           '30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004',
                           '30000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000006',
                           '30000000-0000-4000-8000-000000000007']::uuid[];
  v_mot    uuid[] := array['40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
                           '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004',
                           '40000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000006']::uuid[];
  v_et1    uuid[] := array['51000000-0000-4000-8000-000000000011', '51000000-0000-4000-8000-000000000012',
                           '51000000-0000-4000-8000-000000000013', '51000000-0000-4000-8000-000000000014',
                           '51000000-0000-4000-8000-000000000015']::uuid[];
  v_et2    uuid[] := array['51000000-0000-4000-8000-000000000021', '51000000-0000-4000-8000-000000000022',
                           '51000000-0000-4000-8000-000000000023', '51000000-0000-4000-8000-000000000024']::uuid[];
  v_f1     uuid := '50000000-0000-4000-8000-000000000001';
  v_f2     uuid := '50000000-0000-4000-8000-000000000002';
  v_juliana uuid := '20000000-0000-4000-8000-000000000003';
  v_bruno  uuid := '20000000-0000-4000-8000-000000000004';

  e_nome text[] := array[
    'Metalúrgica Santa Rita', 'Clínica Vida Plena', 'Transportadora Rota Sul', 'Colégio Horizonte', 'Supermercados Bom Preço',
    'Andrade & Lima Advogados', 'Construtora Pedra Forte', 'Laboratório BioAnálise', 'Agropecuária Vale Verde', 'Hotel Serra Azul',
    'Contabilidade Exata', 'Farmácias Popular Mais', 'Têxtil Fio de Ouro', 'Imobiliária Casa Nova', 'Grupo Sabor Mineiro',
    'Auto Peças Veloz', 'Odonto Sorriso Clínicas', 'Gráfica Impressão Rápida', 'Cooperativa Agrícola Alvorada', 'Academia Corpo em Forma',
    'Distribuidora Atlântico', 'Faculdade Nova Era', 'Rede Amigo Fiel Pet Shop', 'Prisma Engenharia e Projetos', 'Arte & Lar Móveis Planejados',
    'Instituto de Idiomas Global', 'Clínica Veterinária Bichos & Cia', 'Panificadora Trigo de Ouro', 'Proteção Total Corretora de Seguros', 'Logística Expressa Brasil',
    'Associação Comercial de Vinhedo', 'Cerâmica Terra Nobre', 'Rede de Postos Caminho Certo', 'Escritório Contábil Balanço', 'Hospital Dia Santa Clara',
    'Usinagem Precisão CNC', 'Alphaville Office Center', 'Ótica Visão Clara', 'Laticínios Serra da Mantiqueira', 'Pagar Fácil Fintech',
    'Marmoraria Granito Real', 'Centro Automotivo Turbo', 'Escola de Música Harmonia', 'Frigorífico Boi Bom', 'Agência Criativa Pixel'];
  e_seg text[] := array[
    'Indústria', 'Saúde', 'Logística', 'Educação', 'Varejo', 'Jurídico', 'Construção', 'Saúde', 'Agronegócio', 'Hotelaria',
    'Serviços', 'Varejo', 'Indústria', 'Imobiliário', 'Alimentação', 'Varejo', 'Saúde', 'Indústria', 'Agronegócio', 'Serviços',
    'Distribuição', 'Educação', 'Varejo', 'Engenharia', 'Indústria', 'Educação', 'Saúde', 'Alimentação', 'Financeiro', 'Logística',
    'Associação', 'Indústria', 'Varejo', 'Serviços', 'Saúde', 'Indústria', 'Imobiliário', 'Varejo', 'Indústria', 'Tecnologia',
    'Indústria', 'Serviços', 'Educação', 'Indústria', 'Serviços'];
  e_cid text[] := array[
    'Campinas', 'São Paulo', 'Jundiaí', 'Sorocaba', 'Guarulhos', 'São Paulo', 'Ribeirão Preto', 'Campinas', 'Piracicaba', 'Campos do Jordão',
    'Santo André', 'Osasco', 'Americana', 'São Paulo', 'São Paulo', 'Campinas', 'São Bernardo do Campo', 'Jundiaí', 'Limeira', 'Santos',
    'Santos', 'São José dos Campos', 'São Paulo', 'Campinas', 'Mogi das Cruzes', 'Campinas', 'Valinhos', 'Indaiatuba', 'São Paulo', 'Barueri',
    'Vinhedo', 'Porto Ferreira', 'Bauru', 'Campinas', 'Ribeirão Preto', 'Sumaré', 'Barueri', 'São Carlos', 'Bragança Paulista', 'São Paulo',
    'Itu', 'Campinas', 'Campinas', 'Presidente Prudente', 'São Paulo'];
  e_porte text[] := array['pequena', 'media', 'media', 'grande', 'pequena'];

  p_nomes text[] := array[
    'Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João',
    'Karina', 'Leonardo', 'Mariana', 'Nicolas', 'Olívia', 'Paulo', 'Renata', 'Sérgio', 'Tatiane', 'Vinícius',
    'Aline', 'Caio', 'Débora', 'Fábio', 'Helena', 'Igor', 'Juliana', 'Lucas', 'Mônica', 'Otávio',
    'Patrícia', 'Ricardo', 'Simone', 'Thiago', 'Vanessa', 'André', 'Beatriz', 'César', 'Daniela', 'Everton'];
  s_nomes text[] := array[
    'Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Gomes', 'Lopes', 'Machado', 'Nogueira',
    'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira', 'Azevedo', 'Batista', 'Campos',
    'Dias', 'Freitas', 'Guimarães', 'Martins', 'Moreira', 'Nascimento', 'Pinto', 'Rocha', 'Souza', 'Tavares'];
  cargos text[] := array['Diretor(a) administrativo(a)', 'Gerente de TI', 'Sócio(a)-proprietário(a)', 'Compras',
                         'Coordenador(a) financeiro(a)', 'Gerente de operações'];
  tags_neg text[] := array['Grande conta', 'Urgente', 'Renovação', 'Indicação', 'Licitação privada'];
  tit1 text[] := array['Renovação do parque de notebooks', 'Projeto de rede e Wi-Fi', 'Segurança: firewall e VPN',
                       'Adequação à LGPD', 'Novo servidor de arquivos', 'Monitoramento por câmeras', 'Cabeamento da nova sede',
                       'Treinamento Microsoft 365', 'Estações de trabalho para filial'];
  tit2 text[] := array['Contrato de suporte mensal', 'Backup em nuvem', 'Migração para Microsoft 365', 'Suporte + backup gerenciado'];
  atv_tit text[] := array['Tarefa: preparar material da reunião', 'Ligação de qualificação', 'Reunião de diagnóstico',
                          'Follow-up pelo WhatsApp', 'E-mail com apresentação comercial', 'Visita técnica ao cliente'];
  atv_tipo text[] := array['tarefa', 'ligacao', 'reuniao', 'whatsapp', 'email', 'visita'];
  atv_res text[] := array['Cliente pediu mais detalhes técnicos.', 'Conversa boa: decisor confirmado.', 'Levantamos a necessidade e o orçamento.',
                          'Respondeu que vai avaliar com a diretoria.', 'Enviado; aguardando retorno.', 'Mapeamos a estrutura atual.'];

  -- produtos por funil (índices de 1 a 12, ver acima)
  prods1 int[] := array[1, 2, 4, 5, 8, 9, 10, 11, 12, 3];
  prods2 int[] := array[6, 7, 3, 6];

  i int; j int; k int; n int; m int;
  h bigint; r int; bonus int;
  v_emp uuid; v_ctt uuid; v_neg uuid; v_vd uuid; v_funil uuid; v_etapas uuid[];
  v_idade int; v_criado timestamptz; v_fechado timestamptz; v_fim timestamptz; v_status text;
  v_k int; v_entrada timestamptz; v_ant timestamptz; v_titulo text;
  v_prod int; v_pid uuid; v_qtd numeric; v_desc numeric; v_dmax numeric; v_preco numeric;
  v_quando timestamptz; v_off int; v_tipo int;
  v_nome text; v_mail text;
begin
  -- EMPRESAS (45) + 1 ou 2 contatos cada; 10 contatos pessoa física
  for i in 1..45 loop
    h := abs(hashtext('emp' || i));
    v_emp := md5('seed-emp-' || i)::uuid;
    insert into public.empresas (id, nome, cnpj, segmento, porte, telefone, email, site, cidade, uf, tags, origem_id, responsavel_id, created_at)
    values (v_emp, e_nome[i],
            case when i % 3 <> 0 then lpad((h % 100000000)::text, 8, '0') || '0001' || lpad((h % 97)::text, 2, '0') end,
            e_seg[i], e_porte[(h % 5) + 1],
            case when e_cid[i] in ('São Paulo', 'Guarulhos', 'Osasco', 'Santo André', 'São Bernardo do Campo', 'Barueri', 'Mogi das Cruzes')
                 then '11' else '19' end || '3' || lpad((h % 10000000)::text, 7, '0'),
            'contato@' || regexp_replace(translate(lower(e_nome[i]), 'áàâãéêíóôõúç&', 'aaaaeeiooouc '), '[^a-z]', '', 'g') || '.com.br',
            null, e_cid[i], 'SP',
            case when i % 7 = 0 then array['Grande conta'] when i % 5 = 0 then array['Cliente ativo'] else '{}' end,
            v_orig[(h % 7) + 1], v_vend[(i % 4) + 1], now() - make_interval(days => 190 - i));
  end loop;

  for i in 1..55 loop
    h := abs(hashtext('ctt' || i));
    v_nome := p_nomes[((i * 7) % 40) + 1] || ' ' || s_nomes[((i * 11) % 30) + 1];
    v_mail := translate(lower(split_part(v_nome, ' ', 1) || '.' || split_part(v_nome, ' ', 2)), 'áàâãéêíóôõúç', 'aaaaeeiooouc');
    if i <= 45 then
      v_emp := md5('seed-emp-' || i)::uuid;
      insert into public.contatos (id, nome, tipo, empresa_id, cargo, email, telefone, cidade, tags, origem_id, responsavel_id, created_at)
      select md5('seed-ctt-' || i)::uuid, v_nome, 'pj', v_emp, cargos[(h % 6) + 1],
             v_mail || '@' || regexp_replace(translate(lower(e.nome), 'áàâãéêíóôõúç&', 'aaaaeeiooouc '), '[^a-z]', '', 'g') || '.com.br',
             (case when e.telefone like '11%' then '119' else '199' end) || lpad((h % 100000000)::text, 8, '0'),
             e.cidade, case when i % 4 = 0 then array['Decisor'] else '{}' end, e.origem_id, e.responsavel_id, e.created_at
        from public.empresas e where e.id = v_emp;
    else
      insert into public.contatos (id, nome, tipo, cargo, email, telefone, cidade, tags, origem_id, responsavel_id, created_at)
      values (md5('seed-ctt-' || i)::uuid, v_nome, 'pf', 'Profissional autônomo(a)', v_mail || '@gmail.com',
              '119' || lpad((h % 100000000)::text, 8, '0'), 'Campinas', array['Pessoa física'],
              v_orig[(h % 7) + 1], v_vend[(i % 4) + 1], now() - make_interval(days => 60 - (i - 45) * 3));
    end if;
  end loop;

  -- 2º contato em 1 de cada 3 empresas
  for i in 1..15 loop
    h := abs(hashtext('ctt2' || i));
    v_emp := md5('seed-emp-' || (i * 3))::uuid;
    v_nome := p_nomes[((i * 13 + 5) % 40) + 1] || ' ' || s_nomes[((i * 17 + 3) % 30) + 1];
    v_mail := translate(lower(split_part(v_nome, ' ', 1) || '.' || split_part(v_nome, ' ', 2)), 'áàâãéêíóôõúç', 'aaaaeeiooouc');
    insert into public.contatos (id, nome, tipo, empresa_id, cargo, email, telefone, cidade, origem_id, responsavel_id, created_at)
    select md5('seed-ctt-' || (100 + i))::uuid, v_nome, 'pj', v_emp, cargos[((h + 2) % 6) + 1],
           v_mail || '@' || regexp_replace(translate(lower(e.nome), 'áàâãéêíóôõúç&', 'aaaaeeiooouc '), '[^a-z]', '', 'g') || '.com.br',
           '119' || lpad(((h * 3) % 100000000)::text, 8, '0'), e.cidade, e.origem_id, e.responsavel_id, e.created_at
      from public.empresas e where e.id = v_emp;
  end loop;

  -- NEGÓCIOS (150), espalhados nos últimos 6 meses
  for i in 1..150 loop
    h := abs(hashtext('neg' || i));
    v_neg := md5('seed-neg-' || i)::uuid;
    v_idade := greatest(1, 182 - (i * 181 / 150) + (h % 4)::int);
    v_criado := now() - make_interval(days => v_idade, hours => (h % 9)::int);
    if i % 5 = 0 then
      v_funil := v_f2; v_etapas := v_et2; v_titulo := tit2[((h / 3) % 4) + 1];
    else
      v_funil := v_f1; v_etapas := v_et1; v_titulo := tit1[((h / 3) % 9) + 1];
    end if;
    n := array_length(v_etapas, 1);
    j := ((i * 7) % 45) + 1;  -- empresa
    v_emp := md5('seed-emp-' || j)::uuid;
    v_ctt := md5('seed-ctt-' || j)::uuid;
    v_vd := v_vend[((h / 7) % 4) + 1];

    -- situação conforme a idade do negócio (Juliana converte mais; Bruno, um pouco menos)
    r := ((h / 101) % 100)::int;
    bonus := case when v_vd = v_juliana then 12 when v_vd = v_bruno then -6 else 0 end;
    if v_idade > 60 then
      v_status := case when r < 34 + bonus then 'ganho' when r < 74 then 'perdido' else 'aberto' end;
    elsif v_idade > 20 then
      v_status := case when r < 20 + bonus then 'ganho' when r < 40 then 'perdido' else 'aberto' end;
    else
      v_status := case when r < 4 then 'ganho' when r < 10 then 'perdido' else 'aberto' end;
    end if;

    -- até qual etapa chegou
    if v_status = 'ganho' then
      v_k := n;
    elsif v_status = 'perdido' then
      v_k := 1 + ((h / 17) % n)::int;
    else
      v_k := 1 + ((h / 19) % n)::int;
      if v_idade < 10 then v_k := least(v_k, 2); end if;
    end if;

    v_fechado := null;
    if v_status <> 'aberto' then
      v_fechado := least(v_criado + make_interval(days => 8 + ((h / 23) % 45)::int), now() - interval '6 hours');
    end if;
    v_fim := coalesce(v_fechado, now() - interval '3 hours');
    v_entrada := v_criado + (v_fim - v_criado) * ((v_k - 1)::numeric / v_k);

    insert into public.negocios (id, titulo, funil_id, etapa_id, vendedor_id, contato_id, empresa_id, origem_id, valor,
                                 previsao_fechamento, status, tags, created_at, etapa_desde, ultima_atividade_em, observacoes)
    select v_neg, v_titulo || ' — ' || e.nome, v_funil, v_etapas[v_k], v_vd, v_ctt, v_emp,
           v_orig[((h / 13) % 7) + 1], 0,
           case when v_status = 'aberto' then public.hoje_br() + (((h / 29) % 60)::int - 10)
                else (v_fim at time zone 'America/Sao_Paulo')::date end,
           'aberto',
           case when i % 9 = 0 then array[tags_neg[((h / 31) % 5) + 1]] else '{}' end,
           v_criado, v_entrada, v_criado,
           case when i % 4 = 0 then 'Cliente quer começar a implantação ainda neste trimestre.' end
      from public.empresas e where e.id = v_emp;

    -- produtos do negócio (o valor do negócio é a soma)
    m := 1 + ((h / 37) % 3)::int;
    for j in 1..m loop
      if v_funil = v_f2 then
        v_prod := prods2[((h / (41 * j)) % 4) + 1];
      else
        v_prod := prods1[((h / (43 * j)) % 10) + 1];
      end if;
      v_pid := ('60000000-0000-4000-8000-0000000000' || lpad(v_prod::text, 2, '0'))::uuid;
      continue when exists (select 1 from public.negocio_produtos np where np.negocio_id = v_neg and np.produto_id = v_pid);
      select p.preco, p.desconto_max into v_preco, v_dmax from public.produtos p where p.id = v_pid;
      v_qtd := case v_prod
        when 1 then 3 + (h / (7 * j)) % 23   when 2 then 3 + (h / (7 * j)) % 23
        when 3 then 10 + (h / (7 * j)) % 41  when 8 then 8 + (h / (7 * j)) % 33
        when 9 then 20 + (h / (7 * j)) % 101 when 12 then 4 + (h / (7 * j)) % 13
        when 11 then 1 + (h / (7 * j)) % 2  when 6 then 12 when 7 then 12
        else 1 end;
      v_desc := case when (h / (53 * j)) % 3 = 0 then floor(((h / (59 * j)) % (v_dmax::int + 1))) else 0 end;
      insert into public.negocio_produtos (negocio_id, produto_id, descricao, quantidade, preco_unitario, desconto_pct, ordem)
      select v_neg, p.id, p.nome, v_qtd, p.preco, v_desc, j from public.produtos p where p.id = v_pid;
    end loop;

    -- fechamento (dispara o cálculo da comissão no banco)
    if v_status <> 'aberto' then
      update public.negocios
         set status = v_status, fechado_em = v_fechado,
             motivo_perda_id = case when v_status = 'perdido' then v_mot[((h / 47) % 6) + 1] end,
             motivo_perda_detalhe = case when v_status = 'perdido' and i % 3 = 0 then 'Cliente informou por telefone.' end
       where id = v_neg;
      update public.negocios set etapa_desde = v_fechado where id = v_neg;
    end if;

    -- histórico de etapas (com o tempo que ficou em cada uma)
    v_ant := v_criado;
    for j in 1..v_k loop
      v_entrada := v_criado + (v_fim - v_criado) * ((j - 1)::numeric / v_k);
      insert into public.historico_etapas (negocio_id, funil_id, de_etapa_id, para_etapa_id, de_status, para_status,
                                           movido_em, segundos_na_etapa, autor_id)
      values (v_neg, v_funil, case when j > 1 then v_etapas[j - 1] end, v_etapas[j], case when j > 1 then 'aberto' end, 'aberto',
              v_entrada, case when j > 1 then extract(epoch from v_entrada - v_ant)::bigint end, v_vd);
      v_ant := v_entrada;
    end loop;
    if v_status <> 'aberto' then
      insert into public.historico_etapas (negocio_id, funil_id, de_etapa_id, para_etapa_id, de_status, para_status,
                                           movido_em, segundos_na_etapa, autor_id)
      values (v_neg, v_funil, v_etapas[v_k], v_etapas[v_k], 'aberto', v_status, v_fechado,
              extract(epoch from v_fechado - v_ant)::bigint, v_vd);
    end if;

    -- atividades já realizadas
    m := 1 + ((h / 61) % 3)::int;
    for j in 1..m loop
      v_tipo := ((i + j) % 6) + 1;
      v_quando := v_criado + (v_fim - v_criado) * (j::numeric / (m + 1));
      insert into public.atividades (id, tipo, titulo, quando, duracao_min, vendedor_id, negocio_id, contato_id, empresa_id,
                                     concluida, concluida_em, resultado, created_at)
      values (md5('seed-atv-' || i || '-' || j)::uuid, atv_tipo[v_tipo], atv_tit[v_tipo], v_quando,
              case when atv_tipo[v_tipo] in ('reuniao', 'visita') then 60 when atv_tipo[v_tipo] = 'ligacao' then 15 end,
              v_vd, v_neg, v_ctt, v_emp, true, v_quando, atv_res[v_tipo], v_quando - interval '1 day');
    end loop;

    -- próxima atividade dos negócios em aberto (algumas atrasadas, algumas hoje)
    if v_status = 'aberto' then
      v_off := case when i % 6 = 0 then 0 else ((h / 67) % 12)::int - 4 end;
      v_tipo := ((i * 5) % 6) + 1;
      v_quando := ((public.hoje_br() + v_off)::timestamp + make_interval(hours => 9 + ((h / 71) % 8)::int))
                  at time zone 'America/Sao_Paulo';
      insert into public.atividades (id, tipo, titulo, descricao, quando, duracao_min, vendedor_id, negocio_id, contato_id, empresa_id,
                                     concluida, created_at)
      values (md5('seed-atv-' || i || '-9')::uuid, atv_tipo[v_tipo],
              case atv_tipo[v_tipo] when 'whatsapp' then 'Cobrar retorno pelo WhatsApp' when 'ligacao' then 'Ligar para alinhar próximos passos'
                   when 'reuniao' then 'Reunião de apresentação da solução' when 'email' then 'Enviar e-mail com estudo de caso'
                   when 'visita' then 'Visita técnica para levantamento' else 'Preparar proposta comercial' end,
              case when i % 3 = 0 then 'Levar a pesquisa de satisfação de clientes parecidos.' end,
              v_quando, case when atv_tipo[v_tipo] in ('reuniao', 'visita') then 60 end,
              v_vd, v_neg, v_ctt, v_emp, false, now() - interval '2 days');
    end if;
  end loop;

  -- METAS: 6 meses por vendedor + equipes no mês atual e no anterior
  k := 0;
  for m in 0..5 loop
    for j in 1..4 loop
      k := k + 1;
      insert into public.metas (id, competencia, vendedor_id, meta_valor, meta_qtd)
      values (md5('seed-meta-' || k)::uuid, (date_trunc('month', public.hoje_br()) - make_interval(months => m))::date,
              v_vend[j], 60000 + 10000 * ((j + m) % 3), 4 + (j % 2));
    end loop;
  end loop;
  for m in 0..1 loop
    k := k + 1;
    insert into public.metas (id, competencia, equipe_id, meta_valor, meta_qtd)
    values (md5('seed-meta-' || k)::uuid, (date_trunc('month', public.hoje_br()) - make_interval(months => m))::date,
            '10000000-0000-4000-8000-000000000001', 150000, 10);
    k := k + 1;
    insert into public.metas (id, competencia, equipe_id, meta_valor, meta_qtd)
    values (md5('seed-meta-' || k)::uuid, (date_trunc('month', public.hoje_br()) - make_interval(months => m))::date,
            '10000000-0000-4000-8000-000000000002', 130000, 9);
  end loop;
end $$;

-- Comissões dos meses anteriores: já pagas (no dia 5 do mês seguinte)
update public.comissoes
   set status = 'paga',
       paga_em = (competencia + interval '1 month' + interval '4 days 10 hours'),
       paga_por = '20000000-0000-4000-8000-000000000001'
 where competencia < date_trunc('month', public.hoje_br())::date
   and negocio_id in (select md5('seed-neg-' || g)::uuid from generate_series(1, 200) g);

-- ---------------------------------------------------------------------
-- PROPOSTAS (12): enviadas, 1 com 2 versões, 1 aguardando aprovação de
-- desconto, 1 recusada, 2 rascunhos e 1 ACEITA pelo link público.
-- ---------------------------------------------------------------------
do $$
declare
  v_neg   record;
  k       int := 0;
  v_prop  uuid;
  v_prop2 uuid;
  v_env   timestamptz;
  v_cod   text;
begin
  for v_neg in
    select n.* from public.negocios n
     where n.id in (select md5('seed-neg-' || g)::uuid from generate_series(1, 150) g)
       and n.status = 'aberto' and n.funil_id = '50000000-0000-4000-8000-000000000001'
       and n.etapa_id in ('51000000-0000-4000-8000-000000000014', '51000000-0000-4000-8000-000000000015')
       and exists (select 1 from public.negocio_produtos np where np.negocio_id = n.id)
     order by n.created_at desc
     limit 12
  loop
    k := k + 1;
    v_env := now() - make_interval(days => case when k = 7 then 25 else k end, hours => 3);
    v_prop := md5('seed-prop-' || k)::uuid;
    insert into public.propostas (id, negocio_id, numero, titulo, validade, condicoes_pagamento, prazo_entrega, observacoes, created_at)
    values (v_prop, v_neg.id, '', left('Proposta — ' || v_neg.titulo, 120),
            (v_env at time zone 'America/Sao_Paulo')::date + 15,
            (select c.condicoes_padrao from public.configuracoes c where c.unica),
            'Entrega e instalação em até 20 dias úteis após o aceite.',
            case when k % 2 = 0 then 'Inclui configuração inicial e acompanhamento na primeira semana.' end,
            v_env - interval '1 day');
    insert into public.proposta_itens (proposta_id, produto_id, descricao, detalhes, unidade, quantidade, preco_unitario, desconto_pct, ordem)
    select v_prop, np.produto_id, np.descricao, p.descricao, coalesce(p.unidade, 'un'), np.quantidade, np.preco_unitario,
           case when k = 2 and np.ordem = (select min(x.ordem) from public.negocio_produtos x where x.negocio_id = v_neg.id)
                then least(100, coalesce(p.desconto_max, 5) + 7) else np.desconto_pct end,
           np.ordem
      from public.negocio_produtos np left join public.produtos p on p.id = np.produto_id
     where np.negocio_id = v_neg.id;

    if k = 2 then      -- desconto acima do limite: aguardando o gestor
      update public.propostas set status = 'aguardando_aprovacao', aprovacao_pedida_em = now() - interval '5 hours' where id = v_prop;
    elsif k in (5, 6) then
      null;            -- rascunhos
    else
      update public.propostas set status = 'enviada', enviada_em = v_env,
             visualizada_em = case when k in (1, 3, 8, 9) then v_env + interval '3 hours' end,
             visualizacoes = case when k in (1, 3, 8, 9) then 1 + k % 3 else 0 end
       where id = v_prop;
    end if;

    if k = 4 then
      update public.propostas set status = 'recusada' where id = v_prop;
    end if;

    if k = 3 then      -- 2ª versão (cliente pediu mais prazo de pagamento)
      v_prop2 := md5('seed-prop-v2-' || k)::uuid;
      insert into public.propostas (id, negocio_id, numero, versao, titulo, validade, condicoes_pagamento, prazo_entrega, observacoes, created_at)
      select v_prop2, p.negocio_id, p.numero, 2, p.titulo, public.hoje_br() + 12,
             'Entrada de 20% e saldo em 4x (30/60/90/120 dias) no boleto.', p.prazo_entrega,
             'Versão 2: condições de pagamento ajustadas a pedido do cliente.', now() - interval '1 day'
        from public.propostas p where p.id = v_prop;
      insert into public.proposta_itens (proposta_id, produto_id, descricao, detalhes, unidade, quantidade, preco_unitario, desconto_pct, ordem)
      select v_prop2, i.produto_id, i.descricao, i.detalhes, i.unidade, i.quantidade, i.preco_unitario, i.desconto_pct, i.ordem
        from public.proposta_itens i where i.proposta_id = v_prop;
      update public.propostas set status = 'substituida' where id = v_prop;
      update public.propostas set status = 'enviada', enviada_em = now() - interval '20 hours' where id = v_prop2;
    end if;
  end loop;

  -- A 1ª proposta é ACEITA pelo cliente no link público (mesma função usada pelo app).
  -- O histórico deste fechamento é gravado automaticamente (app.seed desligado).
  perform set_config('app.seed', 'off', false);
  select p.codigo into v_cod from public.propostas p where p.id = md5('seed-prop-1')::uuid;
  if v_cod is not null then
    perform public.aceitar_proposta_publica(v_cod, 'Carlos Eduardo (Diretor)', '200.150.10.20',
                                            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)');
  end if;
end $$;

-- Liga de novo o histórico automático e a auditoria
do $$ begin
  perform set_config('app.seed', 'off', false);
  perform set_config('app.sem_auditoria', 'off', false);
end $$;
