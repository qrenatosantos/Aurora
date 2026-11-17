-- =====================================================================
-- DADOS INICIAIS DA AURORA BARTENDERS
-- Rode UMA vez, DEPOIS do schema.sql (Supabase ▸ SQL Editor ▸ New query ▸ Run).
-- Pode rodar de novo sem medo: só cria o que ainda não existe e NÃO sobrescreve
-- nada que já tenha sido editado nas telas.
--
-- O que entra:
--   * dados da empresa e identidade visual (cores, fonte, nome)
--   * funil de eventos, origens dos leads, motivos de perda e modelos de mensagem
--   * pacotes e drinks do site (Essencial, Signature, Reserve, Exclusive)
--   * lista de insumos e receitas dos drinks clássicos (SUGESTÃO para revisar)
--
-- O que NÃO entra, de propósito (o gestor preenche nas telas):
--   * preços dos insumos e parâmetros da calculadora (Catálogo ▸ Calculadora)
--   * condições comerciais das propostas (Configurações ▸ Propostas)
-- =====================================================================

do $$ begin perform set_config('app.sem_auditoria', 'on', false); end $$;

-- Empresa e identidade visual (só enquanto ainda estiver com o nome padrão da base) ----------
update public.configuracoes
   set nome_negocio = 'Aurora Bartenders',
       subtitulo    = 'Gestão comercial',
       responsavel  = 'André Procácio',
       duracao_padrao_horas = 6,
       whatsapp     = '34988935223',
       instagram    = '@aurora.bartenders',
       cidade       = 'Araxá',
       uf           = 'MG',
       documento    = '67.539.790/0001-59',
       site         = 'https://aurorabartendersaraxa.com.br',
       cor_primaria = '#021938',
       cor_destaque = '#C6A86A',
       fonte        = 'aurora',
       raio         = 'reto',
       tema_padrao  = 'claro',
       capacidade_simultanea = 3
 where unica and nome_negocio = 'Meu Negócio';

-- Funil de eventos (só se ainda não houver nenhum funil) ---------------------------------------
do $$
declare
  v_funil uuid;
begin
  if not exists (select 1 from public.funis) then
    insert into public.funis (nome, ordem) values ('Eventos', 1) returning id into v_funil;
    insert into public.etapas (funil_id, nome, ordem, probabilidade, cor) values
      (v_funil, 'Novo lead',               1, 10, '#64748B'),
      (v_funil, 'Em atendimento',          2, 25, '#0E7490'),
      (v_funil, 'Proposta em preparação',  3, 40, '#6D4BA8'),
      (v_funil, 'Aguardando aprovação',    4, 50, '#B45309'),
      (v_funil, 'Proposta enviada',        5, 65, '#1D4E89'),
      (v_funil, 'Negociação',              6, 80, '#2D6A4F');
  end if;
end $$;

-- Origens dos leads ------------------------------------------------------------------------------
insert into public.origens (nome, ordem)
select x.nome, x.ordem
  from (values ('Site', 1), ('WhatsApp', 2), ('Instagram', 3), ('Indicação', 4),
               ('Encaminhado pelo André', 5), ('Cadastro manual', 6)) as x(nome, ordem)
 where not exists (select 1 from public.origens o where lower(o.nome) = lower(x.nome));

-- Motivos de perda -----------------------------------------------------------------------------
insert into public.motivos_perda (nome, ordem)
select x.nome, x.ordem
  from (values ('Preço', 1), ('Data indisponível', 2), ('Fechou com outro fornecedor', 3), ('Evento cancelado', 4),
               ('Sem resposta', 5), ('Fora da região de atendimento', 6), ('Outro', 7)) as x(nome, ordem)
 where not exists (select 1 from public.motivos_perda m where lower(m.nome) = lower(x.nome));

-- Modelos de mensagem (variáveis: {nome} {negocio} {valor} {link_proposta} {validade} {vendedor}) ---
insert into public.modelos_mensagem (titulo, canal, texto, ordem)
select x.titulo, x.canal, x.texto, x.ordem
  from (values
    ('Primeiro contato', 'whatsapp',
     'Olá, {nome}! Aqui é da Aurora Bartenders. Recebemos o seu pedido de orçamento e já estamos cuidando dele. Posso confirmar alguns detalhes da festa com você?', 1),
    ('Envio de proposta', 'whatsapp',
     'Olá, {nome}! A proposta da Aurora Bartenders para a sua festa está pronta:' || E'\n' || '{link_proposta}' || E'\n\n' ||
     'Ela vale até {validade}. É só abrir o link para ver os detalhes e aceitar. Qualquer dúvida, estou por aqui.', 2),
    ('Retomada', 'whatsapp',
     'Olá, {nome}! Tudo bem? Passando para saber se ficou alguma dúvida sobre a proposta da Aurora. Se quiser ajustar o cardápio ou a duração, é só me dizer.', 3),
    ('Proposta por e-mail', 'email',
     'Olá, {nome}!' || E'\n\n' || 'Segue a proposta da Aurora Bartenders para a sua festa: {link_proposta}' || E'\n' ||
     'Ela vale até {validade}.' || E'\n\n' || 'Um abraço,' || E'\n' || '{vendedor}', 4)
  ) as x(titulo, canal, texto, ordem)
 where not exists (select 1 from public.modelos_mensagem m where lower(m.titulo) = lower(x.titulo));

-- Drinks (nomes e descrições do site e da proposta de exemplo; descrições vazias = preencher) ----
insert into public.drinks (nome, descricao, categoria, alcoolico, copo, foto_url, ordem)
select x.nome, x.descricao, x.categoria, x.alcoolico, x.copo, x.foto_url, x.ordem
  from (values
    ('Caipirinha', 'Cachaça, frutas selecionadas, açúcar e gelo.', 'classico', true, 'baixo', null, 1),
    ('Caipiroska', 'Vodka, frutas selecionadas, açúcar e gelo. Destaque para a versão de morango.', 'classico', true, 'baixo', null, 2),
    ('Gin tônica', 'Refrescante, com limão-siciliano e ervas.', 'classico', true, null, '/aurora/drinks/gin-tonica.webp', 3),
    ('Aperol Spritz', 'Leve e borbulhante, para abrir a noite.', 'classico', true, null, '/aurora/drinks/spritz.webp', 4),
    ('Moscow Mule', 'Vodka, limão, xarope de gengibre, água gaseificada, gelo e espuma cítrica.', 'classico', true, 'caneca', '/aurora/drinks/moscow-mule.webp', 5),
    ('Fitzgerald', null, 'classico', true, null, null, 6),
    ('Aurora Boreal', 'Autoral da casa, sem álcool: hibisco, lavanda e limão-siciliano.', 'autoral', false, null, '/aurora/drinks/aurora-boreal.webp', 7),
    ('Estrela do Norte', 'Sem álcool, com o pirulito de especiarias, que perfuma o drink a cada gole.', 'autoral', false, null, '/aurora/drinks/estrela-do-norte.webp', 8),
    ('Moscow Mule sem álcool', 'Limão, xarope de gengibre, água gaseificada, gelo e espuma cítrica.', 'sem_alcool', false, 'caneca', '/aurora/drinks/moscow-mule.webp', 9),
    ('Coquetel sem álcool', 'Morango, leite condensado, suco de abacaxi, suco de laranja e groselha.', 'sem_alcool', false, 'long_drink', null, 10),
    ('Mojito Virgin', null, 'sem_alcool', false, 'long_drink', null, 11),
    ('Piña Colada sem álcool', null, 'sem_alcool', false, 'long_drink', null, 12),
    ('Negroni', null, 'premium', true, 'baixo', null, 20),
    ('Cosmopolitan', null, 'premium', true, 'taca', null, 21),
    ('Margarita', null, 'premium', true, 'taca', null, 22),
    ('Whisky Sour', null, 'premium', true, 'baixo', null, 23)
  ) as x(nome, descricao, categoria, alcoolico, copo, foto_url, ordem)
 where not exists (select 1 from public.drinks d where lower(d.nome) = lower(x.nome));

-- copos e fotos padrão dos drinks da casa (só preenche o que estiver vazio)
update public.drinks d
   set copo = coalesce(d.copo, v.copo),
       foto_url = case when d.foto_url is null or (d.nome = 'Moscow Mule sem álcool' and d.foto_url = '/aurora/drinks/moscow-mule.webp') then v.foto else d.foto_url end
  from (values
    ('Caipirinha', 'baixo', '/aurora/drinks/caipirinha.webp'),
    ('Caipiroska', 'baixo', '/aurora/drinks/caipiroska.webp'),
    ('Gin tônica', 'taca', '/aurora/drinks/gin-tonica.webp'),
    ('Aperol Spritz', 'taca', '/aurora/drinks/spritz.webp'),
    ('Moscow Mule', 'caneca', '/aurora/drinks/moscow-mule.webp'),
    ('Fitzgerald', 'baixo', '/aurora/drinks/fitzgerald.webp'),
    ('Aurora Boreal', 'long_drink', '/aurora/drinks/aurora-boreal.webp'),
    ('Estrela do Norte', 'long_drink', '/aurora/drinks/estrela-do-norte.webp'),
    ('Moscow Mule sem álcool', 'caneca', '/aurora/drinks/moscow-mule-sem-alcool.webp'),
    ('Coquetel sem álcool', 'long_drink', '/aurora/drinks/coquetel-sem-alcool.webp')
  ) as v(nome, copo, foto)
 where d.nome = v.nome;

-- Pacotes do site -----------------------------------------------------------------------------
insert into public.pacotes (nome, slogan, ordem)
select x.nome, x.slogan, x.ordem
  from (values
    ('Essencial', 'Simplicidade que agrada a todos os paladares.', 1),
    ('Signature', 'Os clássicos que nunca falham.', 2),
    ('Reserve', 'Sofisticação em cada detalhe.', 3),
    ('Exclusive', 'A experiência completa para momentos únicos.', 4)
  ) as x(nome, slogan, ordem)
 where not exists (select 1 from public.pacotes p where lower(p.nome) = lower(x.nome));

-- Drinks de cada pacote (só preenche pacote que ainda está vazio)
insert into public.pacote_drinks (pacote_id, drink_id, ordem)
select p.id, d.id, x.ordem
  from (values
    ('Essencial', 'Caipirinha', 1), ('Essencial', 'Caipiroska', 2), ('Essencial', 'Gin tônica', 3),
    ('Signature', 'Caipirinha', 1), ('Signature', 'Caipiroska', 2), ('Signature', 'Gin tônica', 3), ('Signature', 'Aperol Spritz', 4),
    ('Reserve', 'Caipirinha', 1), ('Reserve', 'Caipiroska', 2), ('Reserve', 'Gin tônica', 3), ('Reserve', 'Aperol Spritz', 4),
    ('Reserve', 'Moscow Mule', 5), ('Reserve', 'Fitzgerald', 6),
    ('Exclusive', 'Caipirinha', 1), ('Exclusive', 'Caipiroska', 2), ('Exclusive', 'Gin tônica', 3), ('Exclusive', 'Aperol Spritz', 4),
    ('Exclusive', 'Moscow Mule', 5), ('Exclusive', 'Fitzgerald', 6), ('Exclusive', 'Aurora Boreal', 7)
  ) as x(pacote, drink, ordem)
  join public.pacotes p on lower(p.nome) = lower(x.pacote)
  join public.drinks d on lower(d.nome) = lower(x.drink)
 where not exists (select 1 from public.pacote_drinks pd where pd.pacote_id = p.id);

-- Insumos (SEM preço: o gestor informa em Catálogo ▸ Insumos). "embalagem" = quanto vem em cada
-- embalagem comprada, na unidade indicada (ex.: garrafa de 1000 ml). Ajuste conforme a compra real.
insert into public.insumos (nome, categoria, unidade, embalagem)
select x.nome, x.categoria, x.unidade, x.embalagem
  from (values
    ('Cachaça', 'destilado', 'ml', 1000), ('Vodka', 'destilado', 'ml', 1000), ('Gin', 'destilado', 'ml', 1000),
    ('Aperol', 'licor', 'ml', 750), ('Espumante', 'vinho', 'ml', 750),
    ('Água tônica', 'refrigerante', 'ml', 350), ('Água com gás', 'refrigerante', 'ml', 1500),
    ('Xarope de gengibre', 'xarope', 'ml', 1000), ('Açúcar', 'xarope', 'g', 1000),
    ('Limão-taiti', 'fruta', 'un', 1), ('Limão-siciliano', 'fruta', 'un', 1), ('Laranja', 'fruta', 'un', 1),
    ('Morango', 'fruta', 'g', 1000), ('Gelo', 'gelo', 'g', 5000)
  ) as x(nome, categoria, unidade, embalagem)
 where not exists (select 1 from public.insumos i where lower(i.nome) = lower(x.nome));

-- Receitas dos clássicos: medidas usuais de coquetelaria, como PONTO DE PARTIDA.
-- Confira e ajuste em Catálogo ▸ Drinks. Os autorais (Aurora Boreal, Estrela do Norte) ficam sem
-- receita de propósito: só a Aurora conhece. Só preenche drink que ainda não tem receita.
insert into public.drink_insumos (drink_id, insumo_id, quantidade)
select d.id, i.id, x.quantidade
  from (values
    ('Caipirinha', 'Cachaça', 50), ('Caipirinha', 'Limão-taiti', 1), ('Caipirinha', 'Açúcar', 15), ('Caipirinha', 'Gelo', 200),
    ('Caipiroska', 'Vodka', 50), ('Caipiroska', 'Limão-taiti', 1), ('Caipiroska', 'Açúcar', 15), ('Caipiroska', 'Gelo', 200),
    ('Gin tônica', 'Gin', 50), ('Gin tônica', 'Água tônica', 150), ('Gin tônica', 'Limão-siciliano', 0.25), ('Gin tônica', 'Gelo', 200),
    ('Aperol Spritz', 'Aperol', 60), ('Aperol Spritz', 'Espumante', 90), ('Aperol Spritz', 'Água com gás', 30),
    ('Aperol Spritz', 'Laranja', 0.25), ('Aperol Spritz', 'Gelo', 150),
    ('Moscow Mule', 'Vodka', 50), ('Moscow Mule', 'Limão-taiti', 0.5), ('Moscow Mule', 'Xarope de gengibre', 20),
    ('Moscow Mule', 'Água com gás', 100), ('Moscow Mule', 'Gelo', 200),
    ('Fitzgerald', 'Gin', 50), ('Fitzgerald', 'Limão-siciliano', 0.5), ('Fitzgerald', 'Açúcar', 15), ('Fitzgerald', 'Gelo', 150),
    ('Moscow Mule sem álcool', 'Limão-taiti', 0.5), ('Moscow Mule sem álcool', 'Xarope de gengibre', 20),
    ('Moscow Mule sem álcool', 'Água com gás', 150), ('Moscow Mule sem álcool', 'Gelo', 200)
  ) as x(drink, insumo, quantidade)
  join public.drinks d on lower(d.nome) = lower(x.drink)
  join public.insumos i on lower(i.nome) = lower(x.insumo)
 where not exists (select 1 from public.drink_insumos di where di.drink_id = d.id);

do $$ begin perform set_config('app.sem_auditoria', '', false); end $$;
notify pgrst, 'reload schema';

-- funil automático: o que faz o cartão chegar em cada etapa (ver A16 no schema.sql)
update public.etapas e set marco = v.m
  from (values ('novo lead', 'novo'), ('em atendimento', 'atendimento'), ('proposta em preparação', 'preparacao'),
               ('aguardando aprovação', 'aprovacao'), ('proposta enviada', 'enviada'), ('negociação', 'negociacao')) as v(n, m)
 where e.marco is null and lower(e.nome) = v.n
   and not exists (select 1 from public.etapas x where x.funil_id = e.funil_id and x.marco = v.m);


-- descrição de todos os drinks (só onde está vazia): toda proposta mostra uma frase de cada drink
update public.drinks d set descricao = v.descr
  from (values
    ('Fitzgerald', 'Gin com limão-siciliano, um toque de açúcar e gotas de angostura. Cítrico e elegante.'),
    ('Mojito Virgin', 'Hortelã fresca, limão, açúcar e água com gás, sem álcool.'),
    ('Piña Colada sem álcool', 'Abacaxi e leite de coco batidos com gelo, cremoso e tropical.'),
    ('Negroni', 'Clássico italiano de gin, vermute rosso e Campari, com casca de laranja.'),
    ('Cosmopolitan', 'Vodka, licor de laranja, cranberry e limão, servido na taça.'),
    ('Margarita', 'Tequila, licor de laranja e limão, com borda de sal.'),
    ('Whisky Sour', 'Whisky, limão e açúcar, com espuma suave e gotas de angostura.')
  ) as v(nome, descr)
 where d.nome = v.nome and (d.descricao is null or trim(d.descricao) = '');
