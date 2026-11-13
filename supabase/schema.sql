-- =====================================================================
-- SCHEMA DO BANCO — GESTÃO COMERCIAL (CRM + VENDAS)
-- Cole TUDO no Supabase ▸ SQL Editor ▸ New query ▸ Run
--
-- Pode rodar quantas vezes quiser (é idempotente): não apaga dados.
--
-- Segurança (RLS ligado em TODAS as tabelas; visitantes anônimos não leem nada):
--   * Cada usuário logado é um VENDEDOR (tabela vendedores), com papel
--     "gestor" (administrador: vê e edita tudo, metas, comissões, relatórios do time)
--     ou "vendedor" (vê e edita só os PRÓPRIOS contatos, empresas, negócios e atividades).
--   * Configuração "vendedores veem tudo": vendedores passam a VER os dados do time
--     (continuam editando só os próprios). A regra fica NO BANCO.
--   * O cliente final só acessa a proposta pelo link público /proposta/<código>,
--     por funções seguras que devolvem apenas o necessário.
--   * Regras de negócio no banco: histórico de etapas automático, ganho exige valor,
--     perda exige motivo, desconto acima do limite exige aprovação do gestor,
--     comissão calculada pelo banco e aceite de proposta único.
--   * Alterações importantes ficam registradas na tabela auditoria.
-- =====================================================================

-- Extensões ------------------------------------------------------------
create extension if not exists pgcrypto; -- gen_random_uuid(), gen_random_bytes()

-- Função que atualiza a coluna updated_at em todo UPDATE ----------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Data de hoje no fuso de Brasília
create or replace function public.hoje_br()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Telefone normalizado para comparar duplicados: só dígitos, sem o 55 do Brasil.
create or replace function public.tel_norm(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then null
    when char_length(regexp_replace(p, '\D', '', 'g')) in (12, 13) and regexp_replace(p, '\D', '', 'g') like '55%'
      then substr(regexp_replace(p, '\D', '', 'g'), 3)
    else nullif(regexp_replace(p, '\D', '', 'g'), '')
  end;
$$;

-- =====================================================================
-- CONFIGURACOES — linha única com os dados do negócio
-- (a coluna "unica" só aceita TRUE e é UNIQUE, então nunca haverá 2 linhas)
-- As regras de acesso (RLS) ficam mais abaixo, depois da tabela vendedores.
-- =====================================================================
create table if not exists public.configuracoes (
  id                uuid primary key default gen_random_uuid(),
  unica             boolean not null default true unique check (unica),
  nome_negocio      text not null default 'Meu Negócio' check (char_length(nome_negocio) between 1 and 80),
  whatsapp          text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  cidade            text,
  endereco          text,
  instagram         text,
  cor_primaria      text not null default '#1E40AF' check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  mensagem_whatsapp text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_configuracoes_updated_at on public.configuracoes;
create trigger trg_configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.set_updated_at();

alter table public.configuracoes enable row level security;

-- Garante que a linha de configuração exista (não altera se já existir).
insert into public.configuracoes (unica) values (true)
on conflict (unica) do nothing;

-- =====================================================================
-- PERSONALIZAÇÃO DA MARCA (tela /personalizacao)
-- Logo, cores, fonte, nome exibido, subtítulo, tema padrão e arredondamento.
-- Colunas novas em "configuracoes" (add column if not exists = seguro rodar de novo).
-- =====================================================================
alter table public.configuracoes add column if not exists nome_exibicao text;
alter table public.configuracoes add column if not exists subtitulo     text;
alter table public.configuracoes add column if not exists logo_url      text;
alter table public.configuracoes add column if not exists cor_destaque  text not null default '#F59E0B';
alter table public.configuracoes add column if not exists fonte         text not null default 'moderna';
alter table public.configuracoes add column if not exists raio          text not null default 'medio';
alter table public.configuracoes add column if not exists tema_padrao   text not null default 'sistema';

-- Regras (drop + add = pode rodar de novo)
alter table public.configuracoes drop constraint if exists configuracoes_nome_exibicao_ck;
alter table public.configuracoes add constraint configuracoes_nome_exibicao_ck
  check (nome_exibicao is null or char_length(nome_exibicao) between 1 and 60);
alter table public.configuracoes drop constraint if exists configuracoes_subtitulo_ck;
alter table public.configuracoes add constraint configuracoes_subtitulo_ck
  check (subtitulo is null or char_length(subtitulo) between 1 and 60);
alter table public.configuracoes drop constraint if exists configuracoes_logo_url_ck;
alter table public.configuracoes add constraint configuracoes_logo_url_ck
  check (logo_url is null or (char_length(logo_url) <= 500 and logo_url ~ '^https?://'));
alter table public.configuracoes drop constraint if exists configuracoes_cor_destaque_ck;
alter table public.configuracoes add constraint configuracoes_cor_destaque_ck
  check (cor_destaque ~ '^#[0-9A-Fa-f]{6}$');
alter table public.configuracoes drop constraint if exists configuracoes_fonte_ck;
alter table public.configuracoes add constraint configuracoes_fonte_ck
  check (fonte in ('moderna', 'elegante', 'amigavel', 'classica', 'tecnica', 'divertida'));
alter table public.configuracoes drop constraint if exists configuracoes_raio_ck;
alter table public.configuracoes add constraint configuracoes_raio_ck
  check (raio in ('reto', 'medio', 'redondo'));
alter table public.configuracoes drop constraint if exists configuracoes_tema_padrao_ck;
alter table public.configuracoes add constraint configuracoes_tema_padrao_ck
  check (tema_padrao in ('claro', 'escuro', 'sistema'));

-- Leitura PÚBLICA só dos campos de marca (login, redefinir senha e páginas públicas).
-- "security definer" = roda com permissão do dono da função, então o visitante
-- anônimo vê a marca SEM ter acesso à tabela configuracoes (WhatsApp, endereço...).
drop function if exists public.marca_publica();
create function public.marca_publica()
returns table (
  nome_exibido text,
  subtitulo    text,
  logo_url     text,
  cor_primaria text,
  cor_destaque text,
  fonte        text,
  raio         text,
  tema_padrao  text
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(c.nome_exibicao), ''), c.nome_negocio),
         c.subtitulo, c.logo_url, c.cor_primaria, c.cor_destaque, c.fonte, c.raio, c.tema_padrao
  from public.configuracoes c
  where c.unica
  limit 1;
$$;
revoke all on function public.marca_publica() from public;
grant execute on function public.marca_publica() to anon, authenticated;

-- Pasta de arquivos (Storage) "marca" para a logo: pública para LEITURA
-- (a logo aparece no login, no ícone da aba e na proposta); só o GESTOR envia/troca/remove
-- (políticas de escrita mais abaixo, depois da função sou_gestor).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 1048576, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "marca_leitura_publica" on storage.objects;
create policy "marca_leitura_publica" on storage.objects
  for select to anon, authenticated using (bucket_id = 'marca');

-- =====================================================================
-- CONFIGURAÇÕES COMERCIAIS (colunas novas em configuracoes)
-- =====================================================================
alter table public.configuracoes add column if not exists vendedores_veem_tudo  boolean not null default false;
alter table public.configuracoes add column if not exists documento             text;  -- CNPJ
alter table public.configuracoes add column if not exists email                 text;
alter table public.configuracoes add column if not exists site                  text;
alter table public.configuracoes add column if not exists validade_proposta_dias integer not null default 15;
alter table public.configuracoes add column if not exists condicoes_padrao      text;
alter table public.configuracoes add column if not exists rodape_proposta       text;
alter table public.configuracoes add column if not exists desconto_max_avulso   numeric(5,2) not null default 5;
alter table public.configuracoes add column if not exists dias_sem_contato      integer not null default 7;

alter table public.configuracoes drop constraint if exists configuracoes_documento_ck;
alter table public.configuracoes add constraint configuracoes_documento_ck
  check (documento is null or char_length(documento) <= 30);
alter table public.configuracoes drop constraint if exists configuracoes_email_ck;
alter table public.configuracoes add constraint configuracoes_email_ck
  check (email is null or char_length(email) <= 160);
alter table public.configuracoes drop constraint if exists configuracoes_site_ck;
alter table public.configuracoes add constraint configuracoes_site_ck
  check (site is null or char_length(site) <= 160);
alter table public.configuracoes drop constraint if exists configuracoes_validade_ck;
alter table public.configuracoes add constraint configuracoes_validade_ck
  check (validade_proposta_dias between 1 and 365);
alter table public.configuracoes drop constraint if exists configuracoes_condicoes_ck;
alter table public.configuracoes add constraint configuracoes_condicoes_ck
  check (condicoes_padrao is null or char_length(condicoes_padrao) <= 1000);
alter table public.configuracoes drop constraint if exists configuracoes_rodape_ck;
alter table public.configuracoes add constraint configuracoes_rodape_ck
  check (rodape_proposta is null or char_length(rodape_proposta) <= 500);
alter table public.configuracoes drop constraint if exists configuracoes_desconto_avulso_ck;
alter table public.configuracoes add constraint configuracoes_desconto_avulso_ck
  check (desconto_max_avulso between 0 and 100);
alter table public.configuracoes drop constraint if exists configuracoes_dias_sem_contato_ck;
alter table public.configuracoes add constraint configuracoes_dias_sem_contato_ck
  check (dias_sem_contato between 1 and 90);

-- =====================================================================
-- EQUIPES e VENDEDORES — cada usuário de login é um vendedor.
-- O vínculo com o login (user_id) é feito sozinho no 1º acesso, pelo e-mail
-- (função meu_perfil). O 1º usuário a entrar vira GESTOR (administrador).
-- =====================================================================
create table if not exists public.equipes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists equipes_nome_uidx on public.equipes (lower(nome));
drop trigger if exists trg_equipes_updated_at on public.equipes;
create trigger trg_equipes_updated_at before update on public.equipes
  for each row execute function public.set_updated_at();

create table if not exists public.vendedores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users (id) on delete set null,
  email      text,
  nome       text not null check (char_length(nome) between 2 and 120),
  telefone   text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  papel      text not null default 'vendedor' check (papel in ('gestor', 'vendedor')),
  equipe_id  uuid references public.equipes (id) on delete set null,
  cor        text not null default '#2563EB' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vendedores drop constraint if exists vendedores_email_ck;
alter table public.vendedores add constraint vendedores_email_ck
  check (email is null or (char_length(email) <= 160 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));
create unique index if not exists vendedores_email_uidx on public.vendedores (lower(email)) where email is not null;
create index if not exists vendedores_nome_idx on public.vendedores (nome);
drop trigger if exists trg_vendedores_updated_at on public.vendedores;
create trigger trg_vendedores_updated_at before update on public.vendedores
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Funções de permissão (usadas pelas regras RLS). "security definer" para
-- poderem consultar vendedores/configuracoes sem cair em recursão de RLS.
-- ---------------------------------------------------------------------
create or replace function public.meu_vendedor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id from public.vendedores v where v.user_id = auth.uid() and v.ativo limit 1;
$$;

create or replace function public.sou_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select v.papel = 'gestor' from public.vendedores v where v.user_id = auth.uid() and v.ativo limit 1), false);
$$;

-- Vê os dados do time inteiro? (gestor sempre; vendedor só com "vendedores veem tudo")
create or replace function public.vejo_tudo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sou_gestor()
      or (public.meu_vendedor_id() is not null
          and coalesce((select c.vendedores_veem_tudo from public.configuracoes c where c.unica limit 1), false));
$$;

-- Pode VER um registro cujo dono é p_dono?
create or replace function public.pode_ver_dono(p_dono uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.vejo_tudo() or (p_dono is not null and p_dono = public.meu_vendedor_id());
$$;

-- Pode EDITAR um registro cujo dono é p_dono? (gestor ou o próprio dono)
create or replace function public.pode_editar_dono(p_dono uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sou_gestor() or (p_dono is not null and p_dono = public.meu_vendedor_id());
$$;

revoke all on function public.meu_vendedor_id() from public, anon;
revoke all on function public.sou_gestor() from public, anon;
revoke all on function public.vejo_tudo() from public, anon;
revoke all on function public.pode_ver_dono(uuid) from public, anon;
revoke all on function public.pode_editar_dono(uuid) from public, anon;
grant execute on function public.meu_vendedor_id() to authenticated;
grant execute on function public.sou_gestor() to authenticated;
grant execute on function public.vejo_tudo() to authenticated;
grant execute on function public.pode_ver_dono(uuid) to authenticated;
grant execute on function public.pode_editar_dono(uuid) to authenticated;

-- Protege o cadastro de vendedores quando a alteração vem do app:
-- só o gestor muda papel/ativo/e-mail/vínculo; sempre sobra 1 gestor ativo.
-- SEM "security definer": current_user precisa ser o papel de quem chamou (authenticated = app).
create or replace function public.proteger_vendedor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if current_user in ('authenticated', 'anon') and not public.sou_gestor() then
      if new.papel is distinct from old.papel or new.ativo is distinct from old.ativo
         or new.user_id is distinct from old.user_id or new.equipe_id is distinct from old.equipe_id
         or lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, '')) then
        raise exception 'Só o gestor pode mudar papel, equipe, e-mail ou ativar/desativar vendedores.';
      end if;
    end if;
    if old.papel = 'gestor' and old.ativo and not (new.papel = 'gestor' and new.ativo)
       and not exists (select 1 from public.vendedores v where v.papel = 'gestor' and v.ativo and v.id <> old.id) then
      raise exception 'É preciso ter pelo menos 1 gestor ativo.';
    end if;
    return new;
  end if;
  -- DELETE
  if old.papel = 'gestor' and old.ativo
     and not exists (select 1 from public.vendedores v where v.papel = 'gestor' and v.ativo and v.id <> old.id) then
    raise exception 'É preciso ter pelo menos 1 gestor ativo.';
  end if;
  return old;
end;
$$;
revoke all on function public.proteger_vendedor() from public, anon, authenticated;
drop trigger if exists trg_vendedores_proteger on public.vendedores;
create trigger trg_vendedores_proteger before update or delete on public.vendedores
  for each row execute function public.proteger_vendedor();

-- ---------------------------------------------------------------------
-- meu_perfil(): chamado a cada acesso ao app. Garante que o usuário logado
-- tenha um cadastro de vendedor:
--   1. já vinculado → devolve
--   2. existe vendedor SEM login com o MESMO e-mail → vincula
--   3. senão cria um novo (o 1º usuário do sistema vira gestor)
-- ---------------------------------------------------------------------
create or replace function public.meu_perfil()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_vend  public.vendedores%rowtype;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_vend from public.vendedores where user_id = v_uid limit 1;
  if found then
    return to_jsonb(v_vend);
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  if v_email is not null then
    update public.vendedores
       set user_id = v_uid
     where id = (select v.id from public.vendedores v
                  where v.user_id is null and lower(v.email) = lower(v_email)
                  order by v.created_at limit 1)
    returning * into v_vend;
    if v_vend.id is not null then
      return to_jsonb(v_vend);
    end if;
  end if;

  -- trava curta: dois primeiros acessos simultâneos não viram os 2 gestores
  perform pg_advisory_xact_lock(hashtext('meu_perfil:primeiro_gestor'));
  insert into public.vendedores (user_id, email, nome, papel)
  values (
    v_uid,
    case when exists (select 1 from public.vendedores v where lower(v.email) = lower(v_email)) then null else v_email end,
    coalesce(nullif(initcap(replace(split_part(coalesce(v_email, ''), '@', 1), '.', ' ')), ''), 'Vendedor'),
    case when exists (select 1 from public.vendedores v where v.papel = 'gestor' and v.ativo and v.user_id is not null)
         then 'vendedor' else 'gestor' end
  )
  on conflict (user_id) do nothing -- 2 abas abrindo ao mesmo tempo no 1º acesso: a 2ª só lê
  returning * into v_vend;
  if v_vend.id is null then
    select * into v_vend from public.vendedores where user_id = v_uid limit 1;
  end if;
  return to_jsonb(v_vend);
end;
$$;
revoke all on function public.meu_perfil() from public, anon;
grant execute on function public.meu_perfil() to authenticated;

alter table public.equipes enable row level security;
alter table public.vendedores enable row level security;

drop policy if exists "equipes_select" on public.equipes;
create policy "equipes_select" on public.equipes
  for select to authenticated using (public.meu_vendedor_id() is not null);
drop policy if exists "equipes_insert" on public.equipes;
create policy "equipes_insert" on public.equipes
  for insert to authenticated with check (public.sou_gestor());
drop policy if exists "equipes_update" on public.equipes;
create policy "equipes_update" on public.equipes
  for update to authenticated using (public.sou_gestor()) with check (public.sou_gestor());
drop policy if exists "equipes_delete" on public.equipes;
create policy "equipes_delete" on public.equipes
  for delete to authenticated using (public.sou_gestor());

drop policy if exists "vendedores_select" on public.vendedores;
create policy "vendedores_select" on public.vendedores
  for select to authenticated using (public.meu_vendedor_id() is not null or user_id = auth.uid());
drop policy if exists "vendedores_insert" on public.vendedores;
create policy "vendedores_insert" on public.vendedores
  for insert to authenticated with check (public.sou_gestor());
drop policy if exists "vendedores_update" on public.vendedores;
create policy "vendedores_update" on public.vendedores
  for update to authenticated
  using (public.sou_gestor() or (user_id = auth.uid() and ativo))
  with check (public.sou_gestor() or (user_id = auth.uid() and ativo));
drop policy if exists "vendedores_delete" on public.vendedores;
create policy "vendedores_delete" on public.vendedores
  for delete to authenticated using (public.sou_gestor() and user_id is distinct from auth.uid());

-- Configurações: todos os vendedores LEEM (cabeçalho da proposta, modelos);
-- só o GESTOR grava (inclusive a Personalização e "vendedores veem tudo").
drop policy if exists "configuracoes_select_autenticado" on public.configuracoes;
create policy "configuracoes_select_autenticado" on public.configuracoes
  for select to authenticated using (true);
drop policy if exists "configuracoes_insert_autenticado" on public.configuracoes;
create policy "configuracoes_insert_autenticado" on public.configuracoes
  for insert to authenticated with check (public.sou_gestor());
drop policy if exists "configuracoes_update_autenticado" on public.configuracoes;
create policy "configuracoes_update_autenticado" on public.configuracoes
  for update to authenticated using (public.sou_gestor()) with check (public.sou_gestor());
drop policy if exists "configuracoes_delete_autenticado" on public.configuracoes;
create policy "configuracoes_delete_autenticado" on public.configuracoes
  for delete to authenticated using (public.sou_gestor());

-- Logo (Storage "marca"): só o gestor envia, troca ou remove.
drop policy if exists "marca_envio_autenticado" on storage.objects;
create policy "marca_envio_autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'marca' and public.sou_gestor());
drop policy if exists "marca_atualizacao_autenticado" on storage.objects;
create policy "marca_atualizacao_autenticado" on storage.objects
  for update to authenticated using (bucket_id = 'marca' and public.sou_gestor())
  with check (bucket_id = 'marca' and public.sou_gestor());
drop policy if exists "marca_remocao_autenticado" on storage.objects;
create policy "marca_remocao_autenticado" on storage.objects
  for delete to authenticated using (bucket_id = 'marca' and public.sou_gestor());

-- =====================================================================
-- LISTAS CONFIGURÁVEIS: origens do lead, motivos de perda, modelos de mensagem
-- Todos os vendedores leem; só o gestor cadastra/edita.
-- =====================================================================
create table if not exists public.origens (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 60),
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists origens_nome_uidx on public.origens (lower(nome));

create table if not exists public.motivos_perda (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 80),
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists motivos_perda_nome_uidx on public.motivos_perda (lower(nome));

-- Modelos de mensagem (WhatsApp / e-mail). Variáveis: {nome} {empresa} {vendedor}
-- {negocio} {valor} {link_proposta} {validade}
create table if not exists public.modelos_mensagem (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null check (char_length(titulo) between 2 and 60),
  canal      text not null default 'whatsapp' check (canal in ('whatsapp', 'email')),
  texto      text not null check (char_length(texto) between 5 and 2000),
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- FUNIS e ETAPAS — vários funis; cada etapa com % de probabilidade de fechar.
-- Ganho/Perdido NÃO são etapas: são o "status" do negócio.
-- =====================================================================
create table if not exists public.funis (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 60),
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.etapas (
  id            uuid primary key default gen_random_uuid(),
  funil_id      uuid not null references public.funis (id) on delete cascade,
  nome          text not null check (char_length(nome) between 2 and 40),
  ordem         integer not null default 0,
  probabilidade integer not null default 10 check (probabilidade between 0 and 100),
  cor           text not null default '#64748B' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, funil_id) -- permite a chave composta em negocios (etapa sempre do mesmo funil)
);
create index if not exists etapas_funil_idx on public.etapas (funil_id, ordem);

-- =====================================================================
-- PRODUTOS E SERVIÇOS — preço, unidade e desconto máximo permitido (%)
-- =====================================================================
create table if not exists public.produtos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null check (char_length(nome) between 2 and 120),
  codigo       text check (codigo is null or char_length(codigo) <= 30),
  tipo         text not null default 'produto' check (tipo in ('produto', 'servico')),
  descricao    text check (descricao is null or char_length(descricao) <= 1000),
  unidade      text not null default 'un' check (char_length(unidade) between 1 and 20),
  preco        numeric(12,2) not null default 0 check (preco >= 0),
  desconto_max numeric(5,2) not null default 0 check (desconto_max between 0 and 100),
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists produtos_nome_idx on public.produtos (nome);

-- updated_at + RLS das tabelas de cadastro geral (leitura: vendedor ativo; escrita: gestor)
do $$
declare
  t text;
begin
  foreach t in array array['origens', 'motivos_perda', 'modelos_mensagem', 'funis', 'etapas', 'produtos'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   'trg_' || t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.meu_vendedor_id() is not null)',
                   t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.sou_gestor())', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.sou_gestor()) with check (public.sou_gestor())',
                   t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.sou_gestor())', t || '_delete', t);
  end loop;
end $$;

-- =====================================================================
-- EMPRESAS (pessoa jurídica) e CONTATOS (pessoas; com ou sem empresa)
-- "responsavel_id" = vendedor dono do lead.
-- =====================================================================
create table if not exists public.empresas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(nome) between 2 and 120),
  cnpj           text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  segmento       text check (segmento is null or char_length(segmento) <= 60),
  porte          text check (porte is null or porte in ('mei', 'pequena', 'media', 'grande')),
  telefone       text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  email          text check (email is null or char_length(email) <= 160),
  site           text check (site is null or char_length(site) <= 160),
  cidade         text check (cidade is null or char_length(cidade) <= 80),
  uf             text check (uf is null or uf ~ '^[A-Z]{2}$'),
  endereco       text check (endereco is null or char_length(endereco) <= 200),
  tags           text[] not null default '{}',
  origem_id      uuid references public.origens (id) on delete set null,
  responsavel_id uuid references public.vendedores (id) on delete set null,
  observacoes    text check (observacoes is null or char_length(observacoes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists empresas_nome_idx on public.empresas (lower(nome));
create index if not exists empresas_resp_idx on public.empresas (responsavel_id);
create index if not exists empresas_tags_idx on public.empresas using gin (tags);

create table if not exists public.contatos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(nome) between 2 and 120),
  tipo           text not null default 'pf' check (tipo in ('pf', 'pj')),  -- pj = contato que representa uma empresa
  empresa_id     uuid references public.empresas (id) on delete set null,
  cargo          text check (cargo is null or char_length(cargo) <= 80),
  email          text check (email is null or (char_length(email) <= 160 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  telefone       text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  cpf            text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  cidade         text check (cidade is null or char_length(cidade) <= 80),
  tags           text[] not null default '{}',
  origem_id      uuid references public.origens (id) on delete set null,
  responsavel_id uuid references public.vendedores (id) on delete set null,
  observacoes    text check (observacoes is null or char_length(observacoes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists contatos_nome_idx on public.contatos (lower(nome));
create index if not exists contatos_email_idx on public.contatos (lower(email));
create index if not exists contatos_tel_idx on public.contatos (public.tel_norm(telefone));
create index if not exists contatos_empresa_idx on public.contatos (empresa_id);
create index if not exists contatos_resp_idx on public.contatos (responsavel_id);
create index if not exists contatos_tags_idx on public.contatos using gin (tags);

drop trigger if exists trg_empresas_updated_at on public.empresas;
create trigger trg_empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_contatos_updated_at on public.contatos;
create trigger trg_contatos_updated_at before update on public.contatos
  for each row execute function public.set_updated_at();

-- =====================================================================
-- NEGÓCIOS (oportunidades)
-- Regras no banco: ganho exige valor > 0; perda exige motivo; a etapa é
-- sempre do mesmo funil (chave composta); fechado_em automático.
-- =====================================================================
create table if not exists public.negocios (
  id                   uuid primary key default gen_random_uuid(),
  titulo               text not null check (char_length(titulo) between 2 and 120),
  funil_id             uuid not null references public.funis (id) on delete restrict,
  etapa_id             uuid not null,
  vendedor_id          uuid not null references public.vendedores (id) on delete restrict,
  contato_id           uuid references public.contatos (id) on delete set null,
  empresa_id           uuid references public.empresas (id) on delete set null,
  origem_id            uuid references public.origens (id) on delete set null,
  valor                numeric(12,2) not null default 0 check (valor >= 0),
  previsao_fechamento  date,
  status               text not null default 'aberto' check (status in ('aberto', 'ganho', 'perdido')),
  motivo_perda_id      uuid references public.motivos_perda (id) on delete restrict,
  motivo_perda_detalhe text check (motivo_perda_detalhe is null or char_length(motivo_perda_detalhe) <= 500),
  fechado_em           timestamptz,
  etapa_desde          timestamptz,           -- quando entrou na etapa atual (tempo na etapa)
  ultima_atividade_em  timestamptz,
  tags                 text[] not null default '{}',
  observacoes          text check (observacoes is null or char_length(observacoes) <= 4000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint negocios_etapa_fk foreign key (etapa_id, funil_id) references public.etapas (id, funil_id) on delete restrict,
  constraint negocios_ganho_valor_ck check (status <> 'ganho' or valor > 0),
  constraint negocios_perda_motivo_ck check (status <> 'perdido' or motivo_perda_id is not null)
);
create index if not exists negocios_funil_idx on public.negocios (funil_id, status, etapa_id);
create index if not exists negocios_vendedor_idx on public.negocios (vendedor_id, status);
create index if not exists negocios_fechado_idx on public.negocios (fechado_em);
create index if not exists negocios_criado_idx on public.negocios (created_at);
create index if not exists negocios_contato_idx on public.negocios (contato_id);
create index if not exists negocios_empresa_idx on public.negocios (empresa_id);
create index if not exists negocios_tags_idx on public.negocios using gin (tags);

drop trigger if exists trg_negocios_updated_at on public.negocios;
create trigger trg_negocios_updated_at before update on public.negocios
  for each row execute function public.set_updated_at();

-- Produtos do negócio (o valor do negócio = soma dos itens, quando houver itens)
create table if not exists public.negocio_produtos (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios (id) on delete cascade,
  produto_id     uuid references public.produtos (id) on delete set null,
  descricao      text not null check (char_length(descricao) between 1 and 200),
  quantidade     numeric(12,3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0),
  desconto_pct   numeric(5,2) not null default 0 check (desconto_pct between 0 and 100),
  total          numeric(12,2) generated always as (round(quantidade * preco_unitario * (1 - desconto_pct / 100), 2)) stored,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists negocio_produtos_negocio_idx on public.negocio_produtos (negocio_id, ordem);
drop trigger if exists trg_negocio_produtos_updated_at on public.negocio_produtos;
create trigger trg_negocio_produtos_updated_at before update on public.negocio_produtos
  for each row execute function public.set_updated_at();

-- Histórico de mudanças de etapa/status (preenchido SÓ pelo banco).
-- segundos_na_etapa = quanto tempo o negócio ficou na etapa que deixou.
create table if not exists public.historico_etapas (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references public.negocios (id) on delete cascade,
  funil_id          uuid references public.funis (id) on delete set null,
  de_etapa_id       uuid references public.etapas (id) on delete set null,
  para_etapa_id     uuid references public.etapas (id) on delete set null,
  de_status         text,
  para_status       text not null,
  movido_em         timestamptz not null default now(),
  segundos_na_etapa bigint check (segundos_na_etapa is null or segundos_na_etapa >= 0),
  autor_id          uuid references public.vendedores (id) on delete set null
);
create index if not exists historico_negocio_idx on public.historico_etapas (negocio_id, movido_em);
create index if not exists historico_para_idx on public.historico_etapas (para_etapa_id);

-- =====================================================================
-- ATIVIDADES (tarefas, ligações, reuniões, WhatsApp, e-mail, visitas)
-- =====================================================================
create table if not exists public.atividades (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null default 'tarefa' check (tipo in ('tarefa', 'ligacao', 'reuniao', 'whatsapp', 'email', 'visita')),
  titulo       text not null check (char_length(titulo) between 2 and 160),
  descricao    text check (descricao is null or char_length(descricao) <= 2000),
  quando       timestamptz not null default now(),
  duracao_min  integer check (duracao_min is null or duracao_min between 1 and 1440),
  vendedor_id  uuid not null references public.vendedores (id) on delete restrict,
  negocio_id   uuid references public.negocios (id) on delete cascade,
  contato_id   uuid references public.contatos (id) on delete set null,
  empresa_id   uuid references public.empresas (id) on delete set null,
  concluida    boolean not null default false,
  concluida_em timestamptz,
  resultado    text check (resultado is null or char_length(resultado) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists atividades_agenda_idx on public.atividades (vendedor_id, concluida, quando);
create index if not exists atividades_negocio_idx on public.atividades (negocio_id, quando desc);
create index if not exists atividades_contato_idx on public.atividades (contato_id);
create index if not exists atividades_empresa_idx on public.atividades (empresa_id);
drop trigger if exists trg_atividades_updated_at on public.atividades;
create trigger trg_atividades_updated_at before update on public.atividades
  for each row execute function public.set_updated_at();

-- =====================================================================
-- PROPOSTAS (versões) e ITENS
-- codigo = token público de 32 caracteres para o link /proposta/<codigo>
-- =====================================================================
create table if not exists public.contadores (
  chave text primary key,
  valor integer not null default 0
);
alter table public.contadores enable row level security; -- sem políticas: só funções do banco usam

create table if not exists public.propostas (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references public.negocios (id) on delete cascade,
  vendedor_id         uuid references public.vendedores (id) on delete set null,
  numero              text not null,
  versao              integer not null default 1 check (versao between 1 and 99),
  codigo              text not null default encode(gen_random_bytes(16), 'hex') unique check (codigo ~ '^[a-f0-9]{32}$'),
  titulo              text not null check (char_length(titulo) between 2 and 120),
  status              text not null default 'rascunho'
                      check (status in ('rascunho', 'aguardando_aprovacao', 'enviada', 'aceita', 'recusada', 'substituida')),
  validade            date not null default (public.hoje_br() + 15),
  condicoes_pagamento text check (condicoes_pagamento is null or char_length(condicoes_pagamento) <= 1000),
  prazo_entrega       text check (prazo_entrega is null or char_length(prazo_entrega) <= 300),
  observacoes         text check (observacoes is null or char_length(observacoes) <= 2000),
  subtotal            numeric(12,2) not null default 0,
  desconto_total      numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  precisa_aprovacao   boolean not null default false, -- algum item com desconto acima do limite
  aprovacao_pedida_em timestamptz,
  aprovada_em         timestamptz,
  aprovada_por        uuid references public.vendedores (id) on delete set null,
  enviada_em          timestamptz,
  visualizada_em      timestamptz,                    -- 1ª vez que o cliente abriu o link
  visualizacoes       integer not null default 0,
  aceita_em           timestamptz,
  aceite_nome         text check (aceite_nome is null or char_length(aceite_nome) <= 120),
  aceite_ip           inet,
  aceite_navegador    text check (aceite_navegador is null or char_length(aceite_navegador) <= 300),
  aceite_via          text check (aceite_via is null or aceite_via in ('link', 'manual')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (numero, versao),
  -- desconto acima do limite: só envia (ou é aceita) depois da aprovação do gestor
  constraint propostas_aprovacao_ck check (status not in ('enviada', 'aceita') or not precisa_aprovacao or aprovada_em is not null),
  constraint propostas_aceite_ck check (status <> 'aceita' or aceita_em is not null)
);
create index if not exists propostas_negocio_idx on public.propostas (negocio_id, created_at desc);
create index if not exists propostas_status_idx on public.propostas (status);
-- Aceite ÚNICO: no máximo 1 proposta aceita por negócio
create unique index if not exists propostas_uma_aceita_uidx on public.propostas (negocio_id) where status = 'aceita';
drop trigger if exists trg_propostas_updated_at on public.propostas;
create trigger trg_propostas_updated_at before update on public.propostas
  for each row execute function public.set_updated_at();

create table if not exists public.proposta_itens (
  id              uuid primary key default gen_random_uuid(),
  proposta_id     uuid not null references public.propostas (id) on delete cascade,
  produto_id      uuid references public.produtos (id) on delete set null,
  descricao       text not null check (char_length(descricao) between 1 and 200),
  detalhes        text check (detalhes is null or char_length(detalhes) <= 1000),
  unidade         text not null default 'un' check (char_length(unidade) between 1 and 20),
  quantidade      numeric(12,3) not null default 1 check (quantidade > 0),
  preco_unitario  numeric(12,2) not null default 0 check (preco_unitario >= 0),
  desconto_pct    numeric(5,2) not null default 0 check (desconto_pct between 0 and 100),
  desconto_limite numeric(5,2) not null default 0,       -- limite do produto no momento (cópia)
  acima_limite    boolean not null default false,
  total           numeric(12,2) generated always as (round(quantidade * preco_unitario * (1 - desconto_pct / 100), 2)) stored,
  ordem           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists proposta_itens_proposta_idx on public.proposta_itens (proposta_id, ordem);
drop trigger if exists trg_proposta_itens_updated_at on public.proposta_itens;
create trigger trg_proposta_itens_updated_at before update on public.proposta_itens
  for each row execute function public.set_updated_at();

-- =====================================================================
-- METAS (mensais, por vendedor OU por equipe: valor e nº de vendas)
-- =====================================================================
create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  competencia date not null check (extract(day from competencia) = 1), -- 1º dia do mês
  vendedor_id uuid references public.vendedores (id) on delete cascade,
  equipe_id   uuid references public.equipes (id) on delete cascade,
  meta_valor  numeric(12,2) not null default 0 check (meta_valor >= 0),
  meta_qtd    integer not null default 0 check (meta_qtd >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint metas_alvo_ck check ((vendedor_id is null) <> (equipe_id is null)),
  constraint metas_algum_valor_ck check (meta_valor > 0 or meta_qtd > 0)
);
create unique index if not exists metas_vendedor_uidx on public.metas (competencia, vendedor_id) where vendedor_id is not null;
create unique index if not exists metas_equipe_uidx on public.metas (competencia, equipe_id) where equipe_id is not null;
drop trigger if exists trg_metas_updated_at on public.metas;
create trigger trg_metas_updated_at before update on public.metas
  for each row execute function public.set_updated_at();

-- =====================================================================
-- COMISSÕES: regras (por vendedor/produto, % sobre o valor ganho, faixas por
-- valor do negócio) e o extrato (calculado SÓ pelo banco ao ganhar o negócio).
-- Prioridade da regra: vendedor+produto > produto > vendedor > geral.
-- =====================================================================
create table if not exists public.regras_comissao (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 2 and 80),
  vendedor_id uuid references public.vendedores (id) on delete cascade, -- vazio = todos
  produto_id  uuid references public.produtos (id) on delete cascade,   -- vazio = qualquer produto / negócio sem produtos
  percentual  numeric(5,2) not null check (percentual between 0 and 100),
  valor_min   numeric(12,2) check (valor_min is null or valor_min >= 0),  -- faixa: valor do negócio a partir de
  valor_max   numeric(12,2) check (valor_max is null or valor_max >= 0),  -- faixa: até
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint regras_faixa_ck check (valor_max is null or valor_min is null or valor_max >= valor_min)
);
drop trigger if exists trg_regras_comissao_updated_at on public.regras_comissao;
create trigger trg_regras_comissao_updated_at before update on public.regras_comissao
  for each row execute function public.set_updated_at();

create table if not exists public.comissoes (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null unique references public.negocios (id) on delete cascade,
  vendedor_id      uuid not null references public.vendedores (id) on delete restrict,
  competencia      date not null,                 -- mês do ganho (1º dia)
  valor_base       numeric(12,2) not null default 0,
  valor            numeric(12,2) not null default 0 check (valor >= 0),
  percentual_medio numeric(6,3) not null default 0,
  detalhes         jsonb not null default '[]'::jsonb, -- linhas: descricao, base, percentual, regra, comissao
  status           text not null default 'pendente' check (status in ('pendente', 'paga')),
  paga_em          timestamptz,
  paga_por         uuid references public.vendedores (id) on delete set null,
  observacao       text check (observacao is null or char_length(observacao) <= 300),
  calculada_em     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint comissoes_paga_ck check (status <> 'paga' or paga_em is not null)
);
create index if not exists comissoes_competencia_idx on public.comissoes (competencia, vendedor_id);
drop trigger if exists trg_comissoes_updated_at on public.comissoes;
create trigger trg_comissoes_updated_at before update on public.comissoes
  for each row execute function public.set_updated_at();

-- =====================================================================
-- FUNÇÕES DE ACESSO A NEGÓCIOS E PROPOSTAS (para o RLS)
-- =====================================================================
create or replace function public.pode_ver_negocio(p_negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.negocios n where n.id = p_negocio and public.pode_ver_dono(n.vendedor_id));
$$;

create or replace function public.pode_editar_negocio(p_negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.negocios n where n.id = p_negocio and public.pode_editar_dono(n.vendedor_id));
$$;

create or replace function public.pode_editar_proposta(p_proposta uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.propostas p join public.negocios n on n.id = p.negocio_id
                  where p.id = p_proposta and public.pode_editar_dono(n.vendedor_id));
$$;

create or replace function public.pode_ver_proposta(p_proposta uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.propostas p join public.negocios n on n.id = p.negocio_id
                  where p.id = p_proposta and public.pode_ver_dono(n.vendedor_id));
$$;

-- Contato/empresa ligado a um negócio MEU (o vendedor enxerga o cliente do seu negócio)
create or replace function public.contato_do_meu_negocio(p_contato uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.negocios n where n.contato_id = p_contato and n.vendedor_id = public.meu_vendedor_id());
$$;

create or replace function public.empresa_minha(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.negocios n where n.empresa_id = p_empresa and n.vendedor_id = public.meu_vendedor_id())
      or exists (select 1 from public.contatos c where c.empresa_id = p_empresa and c.responsavel_id = public.meu_vendedor_id());
$$;

revoke all on function public.pode_ver_negocio(uuid) from public, anon;
revoke all on function public.pode_editar_negocio(uuid) from public, anon;
revoke all on function public.pode_editar_proposta(uuid) from public, anon;
revoke all on function public.pode_ver_proposta(uuid) from public, anon;
revoke all on function public.contato_do_meu_negocio(uuid) from public, anon;
revoke all on function public.empresa_minha(uuid) from public, anon;
grant execute on function public.pode_ver_negocio(uuid) to authenticated;
grant execute on function public.pode_editar_negocio(uuid) to authenticated;
grant execute on function public.pode_editar_proposta(uuid) to authenticated;
grant execute on function public.pode_ver_proposta(uuid) to authenticated;
grant execute on function public.contato_do_meu_negocio(uuid) to authenticated;
grant execute on function public.empresa_minha(uuid) to authenticated;

-- =====================================================================
-- REGRAS DE NEGÓCIO (gatilhos)
-- =====================================================================

-- % de comissão que vale para (vendedor, produto, valor do negócio)
create or replace function public.regra_comissao_para(p_vendedor uuid, p_produto uuid, p_valor numeric)
returns table (regra_id uuid, regra_nome text, percentual numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.nome, r.percentual
    from public.regras_comissao r
   where r.ativo
     and (r.vendedor_id is null or r.vendedor_id = p_vendedor)
     and (r.produto_id is null or r.produto_id = p_produto)
     and (r.valor_min is null or p_valor >= r.valor_min)
     and (r.valor_max is null or p_valor <= r.valor_max)
   order by ((r.produto_id is not null)::int * 2 + (r.vendedor_id is not null)::int) desc,
            r.valor_min desc nulls last, r.created_at
   limit 1;
$$;
revoke all on function public.regra_comissao_para(uuid, uuid, numeric) from public, anon, authenticated;

-- Calcula (ou recalcula) a comissão de um negócio. Chamada pelos gatilhos.
-- Comissão PAGA nunca é recalculada.
create or replace function public.calcular_comissao(p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n      public.negocios%rowtype;
  v_status text;
  v_det    jsonb := '[]'::jsonb;
  v_total  numeric := 0;
  v_base   numeric := 0;
  v_regra  record;
  v_item   record;
  v_pct    numeric;
  v_nome   text;
begin
  select c.status into v_status from public.comissoes c where c.negocio_id = p_negocio;
  if v_status = 'paga' then
    return;
  end if;

  select * into v_n from public.negocios where id = p_negocio;
  if not found or v_n.status <> 'ganho' then
    delete from public.comissoes where negocio_id = p_negocio and status <> 'paga';
    return;
  end if;

  if exists (select 1 from public.negocio_produtos np where np.negocio_id = v_n.id) then
    for v_item in
      select np.produto_id, np.descricao, np.total from public.negocio_produtos np
       where np.negocio_id = v_n.id order by np.ordem, np.created_at
    loop
      select * into v_regra from public.regra_comissao_para(v_n.vendedor_id, v_item.produto_id, v_n.valor);
      v_pct := coalesce(v_regra.percentual, 0);
      v_nome := coalesce(v_regra.regra_nome, 'Sem regra');
      v_base := v_base + v_item.total;
      v_total := v_total + round(v_item.total * v_pct / 100, 2);
      v_det := v_det || jsonb_build_object('descricao', v_item.descricao, 'base', v_item.total, 'percentual', v_pct,
                                           'regra', v_nome, 'comissao', round(v_item.total * v_pct / 100, 2));
    end loop;
  else
    select * into v_regra from public.regra_comissao_para(v_n.vendedor_id, null, v_n.valor);
    v_pct := coalesce(v_regra.percentual, 0);
    v_base := v_n.valor;
    v_total := round(v_n.valor * v_pct / 100, 2);
    v_det := jsonb_build_array(jsonb_build_object('descricao', v_n.titulo, 'base', v_n.valor, 'percentual', v_pct,
                                                  'regra', coalesce(v_regra.regra_nome, 'Sem regra'), 'comissao', v_total));
  end if;

  insert into public.comissoes (negocio_id, vendedor_id, competencia, valor_base, valor, percentual_medio, detalhes, calculada_em)
  values (v_n.id, v_n.vendedor_id,
          date_trunc('month', (coalesce(v_n.fechado_em, now()) at time zone 'America/Sao_Paulo'))::date,
          v_base, v_total, case when v_base > 0 then round(v_total * 100 / v_base, 3) else 0 end, v_det, now())
  on conflict (negocio_id) do update set
    vendedor_id      = excluded.vendedor_id,
    competencia      = excluded.competencia,
    valor_base       = excluded.valor_base,
    valor            = excluded.valor,
    percentual_medio = excluded.percentual_medio,
    detalhes         = excluded.detalhes,
    calculada_em     = now()
  where public.comissoes.status <> 'paga';
end;
$$;
revoke all on function public.calcular_comissao(uuid) from public, anon, authenticated;

-- Gestor: recalcula todas as comissões PENDENTES (depois de mudar as regras).
create or replace function public.recalcular_comissoes_pendentes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_qtd integer := 0;
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor pode recalcular comissões.';
  end if;
  for v_id in select c.negocio_id from public.comissoes c where c.status = 'pendente' loop
    perform public.calcular_comissao(v_id);
    v_qtd := v_qtd + 1;
  end loop;
  return v_qtd;
end;
$$;
revoke all on function public.recalcular_comissoes_pendentes() from public, anon;
grant execute on function public.recalcular_comissoes_pendentes() to authenticated;

-- NEGÓCIO — antes de gravar: datas automáticas e trava de comissão paga.
create or replace function public.negocio_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.etapa_desde := coalesce(new.etapa_desde, now());
    new.ultima_atividade_em := coalesce(new.ultima_atividade_em, new.created_at, now());
    if new.status = 'aberto' then
      new.fechado_em := null;
    else
      new.fechado_em := coalesce(new.fechado_em, now());
    end if;
    if new.status <> 'perdido' then
      new.motivo_perda_id := null;
      new.motivo_perda_detalhe := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if (new.valor is distinct from old.valor or new.status is distinct from old.status or new.vendedor_id is distinct from old.vendedor_id)
     and exists (select 1 from public.comissoes c where c.negocio_id = old.id and c.status = 'paga') then
    raise exception 'A comissão deste negócio já foi paga. Desmarque o pagamento em Comissões antes de alterar valor, vendedor ou status.';
  end if;

  if new.etapa_id is distinct from old.etapa_id or new.status is distinct from old.status then
    new.etapa_desde := now();
  end if;

  if new.status is distinct from old.status then
    if new.status = 'aberto' then
      new.fechado_em := null;
    elsif new.fechado_em is null or new.fechado_em is not distinct from old.fechado_em then
      new.fechado_em := now();
    end if;
  end if;
  if new.status <> 'perdido' then
    new.motivo_perda_id := null;
    new.motivo_perda_detalhe := null;
  end if;
  return new;
end;
$$;
revoke all on function public.negocio_antes() from public, anon, authenticated;
drop trigger if exists trg_negocios_antes on public.negocios;
create trigger trg_negocios_antes before insert or update on public.negocios
  for each row execute function public.negocio_antes();

-- NEGÓCIO — depois de gravar: histórico de etapas (automático) e comissão.
-- O seed.sql liga "app.seed" para gravar um histórico com datas do passado.
create or replace function public.negocio_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.seed', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      insert into public.historico_etapas (negocio_id, funil_id, de_etapa_id, para_etapa_id, de_status, para_status, movido_em, autor_id)
      values (new.id, new.funil_id, null, new.etapa_id, null, new.status, now(), public.meu_vendedor_id());
    elsif new.etapa_id is distinct from old.etapa_id or new.status is distinct from old.status then
      insert into public.historico_etapas (negocio_id, funil_id, de_etapa_id, para_etapa_id, de_status, para_status,
                                           movido_em, segundos_na_etapa, autor_id)
      values (new.id, new.funil_id, old.etapa_id, new.etapa_id, old.status, new.status, now(),
              case when old.status = 'aberto' then greatest(0, extract(epoch from now() - old.etapa_desde))::bigint end,
              public.meu_vendedor_id());
    end if;
  end if;

  if new.status = 'ganho' or (tg_op = 'UPDATE' and old.status = 'ganho') then
    perform public.calcular_comissao(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.negocio_depois() from public, anon, authenticated;
drop trigger if exists trg_negocios_depois on public.negocios;
create trigger trg_negocios_depois after insert or update on public.negocios
  for each row execute function public.negocio_depois();

-- NEGÓCIO — não exclui negócio com comissão já paga.
create or replace function public.negocio_excluir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.comissoes c where c.negocio_id = old.id and c.status = 'paga') then
    raise exception 'A comissão deste negócio já foi paga: ele não pode ser excluído.';
  end if;
  return old;
end;
$$;
revoke all on function public.negocio_excluir() from public, anon, authenticated;
drop trigger if exists trg_negocios_excluir on public.negocios;
create trigger trg_negocios_excluir before delete on public.negocios
  for each row execute function public.negocio_excluir();

-- PRODUTOS DO NEGÓCIO — preenche preço/descrição do catálogo e barra desconto acima do limite.
-- SEM "security definer": current_user precisa ser o papel de quem chamou (authenticated = app).
create or replace function public.negocio_produto_antes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prod   public.produtos%rowtype;
  v_limite numeric;
begin
  if new.produto_id is not null then
    select * into v_prod from public.produtos where id = new.produto_id;
  end if;
  if tg_op = 'INSERT' and v_prod.id is not null then
    new.descricao := coalesce(nullif(trim(new.descricao), ''), v_prod.nome);
  end if;
  v_limite := coalesce(v_prod.desconto_max, (select c.desconto_max_avulso from public.configuracoes c where c.unica limit 1), 0);
  if new.desconto_pct > v_limite and current_user in ('authenticated', 'anon') and not public.sou_gestor() then
    raise exception '%', format('Desconto de %s%% acima do máximo permitido (%s%%) para "%s". Só o gestor pode dar esse desconto.',
      new.desconto_pct, v_limite, new.descricao);
  end if;
  return new;
end;
$$;
revoke all on function public.negocio_produto_antes() from public, anon, authenticated;
drop trigger if exists trg_negocio_produtos_antes on public.negocio_produtos;
create trigger trg_negocio_produtos_antes before insert or update on public.negocio_produtos
  for each row execute function public.negocio_produto_antes();

-- Valor do negócio = soma dos produtos (quando houver produtos).
create or replace function public.negocio_produto_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.negocio_id, old.negocio_id);
begin
  if exists (select 1 from public.negocio_produtos np where np.negocio_id = v_id) then
    update public.negocios n
       set valor = (select coalesce(sum(np.total), 0) from public.negocio_produtos np where np.negocio_id = v_id)
     where n.id = v_id
       and n.valor is distinct from (select coalesce(sum(np.total), 0) from public.negocio_produtos np where np.negocio_id = v_id);
  end if;
  -- recalcula a comissão também quando só a distribuição dos itens mudou
  if exists (select 1 from public.negocios n where n.id = v_id and n.status = 'ganho') then
    perform public.calcular_comissao(v_id);
  end if;
  return null;
end;
$$;
revoke all on function public.negocio_produto_depois() from public, anon, authenticated;
drop trigger if exists trg_negocio_produtos_depois on public.negocio_produtos;
create trigger trg_negocio_produtos_depois after insert or update or delete on public.negocio_produtos
  for each row execute function public.negocio_produto_depois();

-- ATIVIDADES — data de conclusão automática e "última atividade" do negócio.
create or replace function public.atividade_antes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.concluida and (tg_op = 'INSERT' or not old.concluida) then
    new.concluida_em := coalesce(new.concluida_em, now());
  elsif not new.concluida then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;
revoke all on function public.atividade_antes() from public, anon, authenticated;
drop trigger if exists trg_atividades_antes on public.atividades;
create trigger trg_atividades_antes before insert or update on public.atividades
  for each row execute function public.atividade_antes();

create or replace function public.atividade_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.negocio_id is not null and new.concluida then
    update public.negocios
       set ultima_atividade_em = greatest(coalesce(ultima_atividade_em, new.concluida_em), new.concluida_em)
     where id = new.negocio_id
       and (ultima_atividade_em is null or ultima_atividade_em < new.concluida_em);
  end if;
  return null;
end;
$$;
revoke all on function public.atividade_depois() from public, anon, authenticated;
drop trigger if exists trg_atividades_depois on public.atividades;
create trigger trg_atividades_depois after insert or update on public.atividades
  for each row execute function public.atividade_depois();

-- PROPOSTA — número sequencial (PROP-2026-0001), vendedor, validade padrão
-- e regras de status (o que o app pode ou não pode mudar).
create or replace function public.proximo_numero_proposta()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ano int := extract(year from public.hoje_br())::int;
  v_seq int;
begin
  insert into public.contadores (chave, valor) values ('proposta-' || v_ano, 1)
  on conflict (chave) do update set valor = public.contadores.valor + 1
  returning valor into v_seq;
  return 'PROP-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
revoke all on function public.proximo_numero_proposta() from public, anon, authenticated;

-- Número e vendedor da proposta (security definer: usa o contador interno).
create or replace function public.proposta_numerar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias int;
begin
  if new.numero is null or new.numero = '' then
    new.numero := public.proximo_numero_proposta();
  end if;
  select n.vendedor_id into new.vendedor_id from public.negocios n where n.id = new.negocio_id;
  if new.validade is null then
    select c.validade_proposta_dias into v_dias from public.configuracoes c where c.unica limit 1;
    new.validade := public.hoje_br() + coalesce(v_dias, 15);
  end if;
  return new;
end;
$$;
revoke all on function public.proposta_numerar() from public, anon, authenticated;
drop trigger if exists trg_propostas_0_numerar on public.propostas;
create trigger trg_propostas_0_numerar before insert on public.propostas
  for each row execute function public.proposta_numerar();

-- Regras de status. SEM "security definer": current_user = quem chamou
-- ('authenticated' = app; o dono = funções do banco, como o aceite pelo link).
create or replace function public.proposta_antes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_app boolean := current_user in ('authenticated', 'anon'); -- veio do app (e não de uma função do banco)
begin
  if tg_op = 'INSERT' then
    if v_app then
      new.status := 'rascunho';
      new.subtotal := 0; new.desconto_total := 0; new.total := 0; new.precisa_aprovacao := false;
      new.aprovada_em := null; new.aprovada_por := null; new.enviada_em := null; new.aceita_em := null;
      new.visualizada_em := null; new.visualizacoes := 0;
      new.aceite_nome := null; new.aceite_ip := null; new.aceite_navegador := null; new.aceite_via := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if v_app then
    if old.status = 'aceita' then
      raise exception 'Proposta aceita não pode ser alterada.';
    end if;
    if old.status = 'substituida' then
      raise exception 'Esta versão foi substituída por uma mais nova. Edite a versão atual.';
    end if;
    -- campos calculados/controlados pelo banco: o app não muda
    new.numero := old.numero; new.versao := old.versao; new.codigo := old.codigo; new.negocio_id := old.negocio_id;
    new.vendedor_id := old.vendedor_id;
    new.subtotal := old.subtotal; new.desconto_total := old.desconto_total; new.total := old.total;
    new.precisa_aprovacao := old.precisa_aprovacao; new.enviada_em := old.enviada_em;
    new.visualizada_em := old.visualizada_em; new.visualizacoes := old.visualizacoes;
    new.aceite_ip := old.aceite_ip; new.aceite_navegador := old.aceite_navegador; new.aceite_via := old.aceite_via;
    new.aceita_em := old.aceita_em;

    -- aprovação de desconto: só o gestor
    if (new.aprovada_em is distinct from old.aprovada_em or new.aprovada_por is distinct from old.aprovada_por)
       and not public.sou_gestor() then
      raise exception 'Só o gestor aprova descontos acima do limite.';
    end if;

    -- conteúdo (validade, condições...) só muda em rascunho / aguardando aprovação
    if old.status not in ('rascunho', 'aguardando_aprovacao')
       and (new.titulo, new.validade, new.condicoes_pagamento, new.prazo_entrega, new.observacoes)
           is distinct from (old.titulo, old.validade, old.condicoes_pagamento, old.prazo_entrega, old.observacoes) then
      raise exception 'Proposta já enviada: crie uma nova versão para alterar.';
    end if;

    if new.status is distinct from old.status then
      if not (
           (old.status = 'rascunho' and new.status in ('aguardando_aprovacao', 'enviada', 'substituida'))
        or (old.status = 'aguardando_aprovacao' and new.status in ('rascunho', 'enviada', 'substituida'))
        or (old.status = 'enviada' and new.status in ('aceita', 'recusada', 'substituida'))
        or (old.status = 'recusada' and new.status in ('substituida', 'enviada'))
      ) then
        raise exception 'Mudança de situação não permitida (% → %).', old.status, new.status;
      end if;
      if new.status = 'aguardando_aprovacao' then
        if not old.precisa_aprovacao then
          raise exception 'Esta proposta não tem desconto acima do limite: pode enviar direto.';
        end if;
        new.aprovacao_pedida_em := now();
      end if;
      if new.status = 'enviada' and old.total <= 0 then
        raise exception 'A proposta precisa ter valor total maior que zero para ser enviada.';
      end if;
      if new.status = 'enviada' and new.validade < public.hoje_br() then
        raise exception 'A validade da proposta já passou. Ajuste a validade (nova versão) antes de enviar.';
      end if;
      if new.status = 'aceita' then -- aceite registrado pela equipe (cliente aceitou por telefone/e-mail)
        new.aceita_em := now();
        new.aceite_via := 'manual';
        new.aceite_nome := coalesce(nullif(trim(new.aceite_nome), ''), 'Registrado pela equipe');
      end if;
    end if;
  end if;

  if new.status = 'enviada' and old.status is distinct from 'enviada' then
    new.enviada_em := coalesce(new.enviada_em, now());
  end if;
  return new;
end;
$$;
revoke all on function public.proposta_antes() from public, anon, authenticated;
drop trigger if exists trg_propostas_antes on public.propostas;
create trigger trg_propostas_antes before insert or update on public.propostas
  for each row execute function public.proposta_antes();

-- Proposta ACEITA → os itens viram os produtos do negócio e o negócio é marcado como GANHO
-- (com o valor da proposta). A comissão é calculada em seguida pelo gatilho do negócio.
create or replace function public.proposta_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aceita' and old.status is distinct from 'aceita' then
    delete from public.negocio_produtos where negocio_id = new.negocio_id;
    insert into public.negocio_produtos (negocio_id, produto_id, descricao, quantidade, preco_unitario, desconto_pct, ordem)
    select new.negocio_id, i.produto_id, i.descricao, i.quantidade, i.preco_unitario, i.desconto_pct, i.ordem
      from public.proposta_itens i where i.proposta_id = new.id;
    update public.negocios
       set status = 'ganho', valor = new.total
     where id = new.negocio_id and (status <> 'ganho' or valor <> new.total);
  end if;
  return null;
end;
$$;
revoke all on function public.proposta_depois() from public, anon, authenticated;
drop trigger if exists trg_propostas_depois on public.propostas;
create trigger trg_propostas_depois after update on public.propostas
  for each row execute function public.proposta_depois();

-- ITENS DA PROPOSTA — limite de desconto (cópia do produto) e totais da proposta.
-- SEM "security definer" (current_user = quem chamou).
create or replace function public.proposta_item_antes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_prod   public.produtos%rowtype;
begin
  select p.status into v_status from public.propostas p where p.id = coalesce(new.proposta_id, old.proposta_id);
  if current_user in ('authenticated', 'anon') and v_status not in ('rascunho', 'aguardando_aprovacao') then
    raise exception 'Proposta já enviada: crie uma nova versão para alterar os itens.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.produto_id is not null then
    select * into v_prod from public.produtos where id = new.produto_id;
  end if;
  if tg_op = 'INSERT' and v_prod.id is not null then
    new.descricao := coalesce(nullif(trim(new.descricao), ''), v_prod.nome);
  end if;
  new.desconto_limite := coalesce(v_prod.desconto_max,
                                  (select c.desconto_max_avulso from public.configuracoes c where c.unica limit 1), 0);
  new.acima_limite := new.desconto_pct > new.desconto_limite;
  return new;
end;
$$;
revoke all on function public.proposta_item_antes() from public, anon, authenticated;
drop trigger if exists trg_proposta_itens_antes on public.proposta_itens;
create trigger trg_proposta_itens_antes before insert or update or delete on public.proposta_itens
  for each row execute function public.proposta_item_antes();

create or replace function public.proposta_item_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.proposta_id, old.proposta_id);
begin
  update public.propostas p
     set subtotal          = t.subtotal,
         desconto_total    = t.subtotal - t.total,
         total             = t.total,
         precisa_aprovacao = t.acima,
         -- qualquer mudança nos itens desfaz a aprovação anterior do desconto
         aprovada_em       = case when t.acima then null else p.aprovada_em end,
         aprovada_por      = case when t.acima then null else p.aprovada_por end,
         status            = case when p.status = 'aguardando_aprovacao' and not t.acima then 'rascunho' else p.status end
    from (select coalesce(sum(round(i.quantidade * i.preco_unitario, 2)), 0) as subtotal,
                 coalesce(sum(i.total), 0) as total,
                 coalesce(bool_or(i.acima_limite), false) as acima
            from public.proposta_itens i where i.proposta_id = v_id) t
   where p.id = v_id;
  return null;
end;
$$;
revoke all on function public.proposta_item_depois() from public, anon, authenticated;
drop trigger if exists trg_proposta_itens_depois on public.proposta_itens;
create trigger trg_proposta_itens_depois after insert or update or delete on public.proposta_itens
  for each row execute function public.proposta_item_depois();

-- COMISSÕES — pelo app, o gestor só marca/desmarca como paga (e anota).
create or replace function public.comissao_antes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (new.negocio_id, new.vendedor_id, new.competencia, new.valor_base, new.valor, new.percentual_medio, new.detalhes)
       is distinct from (old.negocio_id, old.vendedor_id, old.competencia, old.valor_base, old.valor, old.percentual_medio, old.detalhes) then
      raise exception 'O valor da comissão é calculado pelo sistema e não pode ser editado.';
    end if;
    if new.status = 'paga' and old.status <> 'paga' then
      new.paga_em := coalesce(new.paga_em, now());
      new.paga_por := public.meu_vendedor_id();
    elsif new.status = 'pendente' then
      new.paga_em := null;
      new.paga_por := null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.comissao_antes() from public, anon, authenticated;
drop trigger if exists trg_comissoes_antes on public.comissoes;
create trigger trg_comissoes_antes before update on public.comissoes
  for each row execute function public.comissao_antes();

-- Ao desmarcar "paga", recalcula (o negócio pode ter mudado de valor/regra).
create or replace function public.comissao_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'paga' and new.status = 'pendente' then
    perform public.calcular_comissao(new.negocio_id);
  end if;
  return null;
end;
$$;
revoke all on function public.comissao_depois() from public, anon, authenticated;
drop trigger if exists trg_comissoes_depois on public.comissoes;
create trigger trg_comissoes_depois after update on public.comissoes
  for each row execute function public.comissao_depois();

-- =====================================================================
-- RLS das tabelas comerciais
-- =====================================================================
alter table public.empresas enable row level security;
alter table public.contatos enable row level security;
alter table public.negocios enable row level security;
alter table public.negocio_produtos enable row level security;
alter table public.historico_etapas enable row level security;
alter table public.atividades enable row level security;
alter table public.propostas enable row level security;
alter table public.proposta_itens enable row level security;
alter table public.metas enable row level security;
alter table public.regras_comissao enable row level security;
alter table public.comissoes enable row level security;

-- EMPRESAS: dono do lead (ou quem vê tudo) + empresas dos MEUS negócios/contatos
drop policy if exists "empresas_select" on public.empresas;
create policy "empresas_select" on public.empresas for select to authenticated
  using (public.pode_ver_dono(responsavel_id) or public.empresa_minha(id));
drop policy if exists "empresas_insert" on public.empresas;
create policy "empresas_insert" on public.empresas for insert to authenticated
  with check (public.pode_editar_dono(responsavel_id));
drop policy if exists "empresas_update" on public.empresas;
create policy "empresas_update" on public.empresas for update to authenticated
  using (public.pode_editar_dono(responsavel_id)) with check (public.pode_editar_dono(responsavel_id));
drop policy if exists "empresas_delete" on public.empresas;
create policy "empresas_delete" on public.empresas for delete to authenticated
  using (public.pode_editar_dono(responsavel_id));

-- CONTATOS
drop policy if exists "contatos_select" on public.contatos;
create policy "contatos_select" on public.contatos for select to authenticated
  using (public.pode_ver_dono(responsavel_id) or public.contato_do_meu_negocio(id));
drop policy if exists "contatos_insert" on public.contatos;
create policy "contatos_insert" on public.contatos for insert to authenticated
  with check (public.pode_editar_dono(responsavel_id));
drop policy if exists "contatos_update" on public.contatos;
create policy "contatos_update" on public.contatos for update to authenticated
  using (public.pode_editar_dono(responsavel_id)) with check (public.pode_editar_dono(responsavel_id));
drop policy if exists "contatos_delete" on public.contatos;
create policy "contatos_delete" on public.contatos for delete to authenticated
  using (public.pode_editar_dono(responsavel_id));

-- NEGÓCIOS: vendedor vê/edita os próprios (gestor tudo). Vendedor não passa negócio para outro.
drop policy if exists "negocios_select" on public.negocios;
create policy "negocios_select" on public.negocios for select to authenticated
  using (public.pode_ver_dono(vendedor_id));
drop policy if exists "negocios_insert" on public.negocios;
create policy "negocios_insert" on public.negocios for insert to authenticated
  with check (public.pode_editar_dono(vendedor_id));
drop policy if exists "negocios_update" on public.negocios;
create policy "negocios_update" on public.negocios for update to authenticated
  using (public.pode_editar_dono(vendedor_id)) with check (public.pode_editar_dono(vendedor_id));
drop policy if exists "negocios_delete" on public.negocios;
create policy "negocios_delete" on public.negocios for delete to authenticated
  using (public.pode_editar_dono(vendedor_id));

drop policy if exists "negocio_produtos_select" on public.negocio_produtos;
create policy "negocio_produtos_select" on public.negocio_produtos for select to authenticated
  using (public.pode_ver_negocio(negocio_id));
drop policy if exists "negocio_produtos_insert" on public.negocio_produtos;
create policy "negocio_produtos_insert" on public.negocio_produtos for insert to authenticated
  with check (public.pode_editar_negocio(negocio_id));
drop policy if exists "negocio_produtos_update" on public.negocio_produtos;
create policy "negocio_produtos_update" on public.negocio_produtos for update to authenticated
  using (public.pode_editar_negocio(negocio_id)) with check (public.pode_editar_negocio(negocio_id));
drop policy if exists "negocio_produtos_delete" on public.negocio_produtos;
create policy "negocio_produtos_delete" on public.negocio_produtos for delete to authenticated
  using (public.pode_editar_negocio(negocio_id));

-- HISTÓRICO: só leitura (quem grava é o gatilho)
drop policy if exists "historico_select" on public.historico_etapas;
create policy "historico_select" on public.historico_etapas for select to authenticated
  using (public.pode_ver_negocio(negocio_id));

-- ATIVIDADES
drop policy if exists "atividades_select" on public.atividades;
create policy "atividades_select" on public.atividades for select to authenticated
  using (public.pode_ver_dono(vendedor_id));
drop policy if exists "atividades_insert" on public.atividades;
create policy "atividades_insert" on public.atividades for insert to authenticated
  with check (public.pode_editar_dono(vendedor_id) and (negocio_id is null or public.pode_editar_negocio(negocio_id)));
drop policy if exists "atividades_update" on public.atividades;
create policy "atividades_update" on public.atividades for update to authenticated
  using (public.pode_editar_dono(vendedor_id))
  with check (public.pode_editar_dono(vendedor_id) and (negocio_id is null or public.pode_editar_negocio(negocio_id)));
drop policy if exists "atividades_delete" on public.atividades;
create policy "atividades_delete" on public.atividades for delete to authenticated
  using (public.pode_editar_dono(vendedor_id));

-- PROPOSTAS e ITENS (seguem o negócio)
drop policy if exists "propostas_select" on public.propostas;
create policy "propostas_select" on public.propostas for select to authenticated
  using (public.pode_ver_negocio(negocio_id));
drop policy if exists "propostas_insert" on public.propostas;
create policy "propostas_insert" on public.propostas for insert to authenticated
  with check (public.pode_editar_negocio(negocio_id));
drop policy if exists "propostas_update" on public.propostas;
create policy "propostas_update" on public.propostas for update to authenticated
  using (public.pode_editar_negocio(negocio_id)) with check (public.pode_editar_negocio(negocio_id));
drop policy if exists "propostas_delete" on public.propostas;
create policy "propostas_delete" on public.propostas for delete to authenticated
  using (public.pode_editar_negocio(negocio_id) and status in ('rascunho', 'aguardando_aprovacao'));

drop policy if exists "proposta_itens_select" on public.proposta_itens;
create policy "proposta_itens_select" on public.proposta_itens for select to authenticated
  using (public.pode_ver_proposta(proposta_id));
drop policy if exists "proposta_itens_insert" on public.proposta_itens;
create policy "proposta_itens_insert" on public.proposta_itens for insert to authenticated
  with check (public.pode_editar_proposta(proposta_id));
drop policy if exists "proposta_itens_update" on public.proposta_itens;
create policy "proposta_itens_update" on public.proposta_itens for update to authenticated
  using (public.pode_editar_proposta(proposta_id)) with check (public.pode_editar_proposta(proposta_id));
drop policy if exists "proposta_itens_delete" on public.proposta_itens;
create policy "proposta_itens_delete" on public.proposta_itens for delete to authenticated
  using (public.pode_editar_proposta(proposta_id));

-- METAS: todos os vendedores leem (ranking/metas do time); só o gestor define
drop policy if exists "metas_select" on public.metas;
create policy "metas_select" on public.metas for select to authenticated using (public.meu_vendedor_id() is not null);
drop policy if exists "metas_insert" on public.metas;
create policy "metas_insert" on public.metas for insert to authenticated with check (public.sou_gestor());
drop policy if exists "metas_update" on public.metas;
create policy "metas_update" on public.metas for update to authenticated
  using (public.sou_gestor()) with check (public.sou_gestor());
drop policy if exists "metas_delete" on public.metas;
create policy "metas_delete" on public.metas for delete to authenticated using (public.sou_gestor());

-- REGRAS DE COMISSÃO: gestor tudo; vendedor vê as regras que valem para ele
drop policy if exists "regras_comissao_select" on public.regras_comissao;
create policy "regras_comissao_select" on public.regras_comissao for select to authenticated
  using (public.sou_gestor() or (public.meu_vendedor_id() is not null
         and (vendedor_id is null or vendedor_id = public.meu_vendedor_id())));
drop policy if exists "regras_comissao_insert" on public.regras_comissao;
create policy "regras_comissao_insert" on public.regras_comissao for insert to authenticated with check (public.sou_gestor());
drop policy if exists "regras_comissao_update" on public.regras_comissao;
create policy "regras_comissao_update" on public.regras_comissao for update to authenticated
  using (public.sou_gestor()) with check (public.sou_gestor());
drop policy if exists "regras_comissao_delete" on public.regras_comissao;
create policy "regras_comissao_delete" on public.regras_comissao for delete to authenticated using (public.sou_gestor());

-- COMISSÕES: cada vendedor vê só as SUAS (mesmo com "vendedores veem tudo"); o gestor marca como paga.
-- Não há regra de insert/delete: só o banco cria e apaga comissões.
drop policy if exists "comissoes_select" on public.comissoes;
create policy "comissoes_select" on public.comissoes for select to authenticated
  using (public.sou_gestor() or (vendedor_id is not null and vendedor_id = public.meu_vendedor_id()));
drop policy if exists "comissoes_update" on public.comissoes;
create policy "comissoes_update" on public.comissoes for update to authenticated
  using (public.sou_gestor()) with check (public.sou_gestor());

-- =====================================================================
-- FUNÇÕES DO APP (chamadas por RPC; conferem o login e respeitam as permissões)
-- =====================================================================

-- Cria a proposta (versão 1) a partir do negócio, copiando os produtos do negócio.
-- "security invoker" (padrão): as regras RLS de quem chamou continuam valendo.
create or replace function public.criar_proposta(p_negocio_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_n   public.negocios%rowtype;
  v_cfg public.configuracoes%rowtype;
  v_id  uuid;
begin
  select * into v_n from public.negocios where id = p_negocio_id;
  if not found or not public.pode_editar_negocio(p_negocio_id) then
    raise exception 'Negócio não encontrado ou sem permissão.';
  end if;
  select * into v_cfg from public.configuracoes where unica limit 1;
  insert into public.propostas (negocio_id, numero, titulo, validade, condicoes_pagamento)
  values (v_n.id, '', left('Proposta — ' || v_n.titulo, 120), public.hoje_br() + coalesce(v_cfg.validade_proposta_dias, 15),
          v_cfg.condicoes_padrao)
  returning id into v_id;
  insert into public.proposta_itens (proposta_id, produto_id, descricao, unidade, quantidade, preco_unitario, desconto_pct, ordem)
  select v_id, np.produto_id, np.descricao, coalesce(pr.unidade, 'un'), np.quantidade, np.preco_unitario, np.desconto_pct, np.ordem
    from public.negocio_produtos np left join public.produtos pr on pr.id = np.produto_id
   where np.negocio_id = v_n.id
   order by np.ordem, np.created_at;
  return v_id;
end;
$$;
revoke all on function public.criar_proposta(uuid) from public, anon;
grant execute on function public.criar_proposta(uuid) to authenticated;

-- Salva cabeçalho + itens da proposta de uma vez (tudo ou nada).
create or replace function public.salvar_proposta(p_id uuid, p_dados jsonb, p_itens jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_ordem int := 0;
begin
  if not public.pode_editar_proposta(p_id) then
    raise exception 'Proposta não encontrada ou sem permissão.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um item à proposta.';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'Máximo de 100 itens por proposta.';
  end if;
  update public.propostas
     set titulo              = p_dados ->> 'titulo',
         validade            = (p_dados ->> 'validade')::date,
         condicoes_pagamento = nullif(p_dados ->> 'condicoes_pagamento', ''),
         prazo_entrega       = nullif(p_dados ->> 'prazo_entrega', ''),
         observacoes         = nullif(p_dados ->> 'observacoes', '')
   where id = p_id;
  delete from public.proposta_itens where proposta_id = p_id;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_ordem := v_ordem + 1;
    insert into public.proposta_itens (proposta_id, produto_id, descricao, detalhes, unidade, quantidade, preco_unitario, desconto_pct, ordem)
    values (p_id, nullif(v_item ->> 'produto_id', '')::uuid, v_item ->> 'descricao', nullif(v_item ->> 'detalhes', ''),
            coalesce(nullif(v_item ->> 'unidade', ''), 'un'), (v_item ->> 'quantidade')::numeric,
            (v_item ->> 'preco_unitario')::numeric, coalesce((v_item ->> 'desconto_pct')::numeric, 0), v_ordem);
  end loop;
end;
$$;
revoke all on function public.salvar_proposta(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_proposta(uuid, jsonb, jsonb) to authenticated;

-- Nova versão: copia a proposta (v+1, mesmo número) e marca a anterior como substituída.
create or replace function public.nova_versao_proposta(p_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_p     public.propostas%rowtype;
  v_novo  uuid;
  v_versao int;
begin
  select * into v_p from public.propostas where id = p_id;
  if not found or not public.pode_editar_proposta(p_id) then
    raise exception 'Proposta não encontrada ou sem permissão.';
  end if;
  if v_p.status = 'aceita' then
    raise exception 'Proposta aceita não ganha nova versão.';
  end if;
  if v_p.status = 'substituida' then
    raise exception 'Esta versão já foi substituída. Abra a versão mais nova.';
  end if;
  select coalesce(max(versao), 0) + 1 into v_versao from public.propostas where numero = v_p.numero;
  insert into public.propostas (negocio_id, numero, versao, titulo, validade, condicoes_pagamento, prazo_entrega, observacoes)
  values (v_p.negocio_id, v_p.numero, v_versao, v_p.titulo, greatest(v_p.validade, public.hoje_br()),
          v_p.condicoes_pagamento, v_p.prazo_entrega, v_p.observacoes)
  returning id into v_novo;
  insert into public.proposta_itens (proposta_id, produto_id, descricao, detalhes, unidade, quantidade, preco_unitario, desconto_pct, ordem)
  select v_novo, i.produto_id, i.descricao, i.detalhes, i.unidade, i.quantidade, i.preco_unitario, i.desconto_pct, i.ordem
    from public.proposta_itens i where i.proposta_id = v_p.id;
  update public.propostas set status = 'substituida' where id = v_p.id;
  return v_novo;
end;
$$;
revoke all on function public.nova_versao_proposta(uuid) from public, anon;
grant execute on function public.nova_versao_proposta(uuid) to authenticated;

-- Ranking de vendedores no período (só números agregados; vendedores veem o ranking).
create or replace function public.ranking_vendedores(p_inicio date, p_fim date)
returns table (vendedor_id uuid, nome text, cor text, equipe text, ganhos integer, valor_ganho numeric,
               perdidos integer, meta_valor numeric, meta_qtd integer)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.nome, v.cor, e.nome,
         count(n.id) filter (where n.status = 'ganho')::int,
         coalesce(sum(n.valor) filter (where n.status = 'ganho'), 0),
         count(n.id) filter (where n.status = 'perdido')::int,
         (select coalesce(sum(m.meta_valor), 0) from public.metas m
           where m.vendedor_id = v.id and m.competencia between date_trunc('month', p_inicio)::date and p_fim),
         (select coalesce(sum(m.meta_qtd), 0)::int from public.metas m
           where m.vendedor_id = v.id and m.competencia between date_trunc('month', p_inicio)::date and p_fim)
    from public.vendedores v
    left join public.equipes e on e.id = v.equipe_id
    left join public.negocios n
           on n.vendedor_id = v.id and n.status in ('ganho', 'perdido')
          and (n.fechado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
   where v.ativo and public.meu_vendedor_id() is not null
   group by v.id, v.nome, v.cor, e.nome
   order by 6 desc, 5 desc, v.nome;
$$;
revoke all on function public.ranking_vendedores(date, date) from public, anon;
grant execute on function public.ranking_vendedores(date, date) to authenticated;

-- Progresso das metas do mês (realizado = negócios ganhos no mês).
create or replace function public.progresso_metas(p_competencia date)
returns table (meta_id uuid, vendedor_id uuid, equipe_id uuid, nome text, meta_valor numeric, meta_qtd integer,
               realizado_valor numeric, realizado_qtd integer)
language sql
stable
security definer
set search_path = public
as $$
  with ganhos as (
    select n.vendedor_id, n.valor
      from public.negocios n
     where n.status = 'ganho'
       and date_trunc('month', (n.fechado_em at time zone 'America/Sao_Paulo'))::date = date_trunc('month', p_competencia)::date
  )
  select m.id, m.vendedor_id, m.equipe_id, coalesce(v.nome, e.nome), m.meta_valor, m.meta_qtd,
         coalesce((select sum(g.valor) from ganhos g
                    where g.vendedor_id = m.vendedor_id
                       or g.vendedor_id in (select x.id from public.vendedores x where x.equipe_id = m.equipe_id)), 0),
         coalesce((select count(*) from ganhos g
                    where g.vendedor_id = m.vendedor_id
                       or g.vendedor_id in (select x.id from public.vendedores x where x.equipe_id = m.equipe_id)), 0)::int
    from public.metas m
    left join public.vendedores v on v.id = m.vendedor_id
    left join public.equipes e on e.id = m.equipe_id
   where m.competencia = date_trunc('month', p_competencia)::date
     and public.meu_vendedor_id() is not null
   order by (m.equipe_id is not null) desc, coalesce(v.nome, e.nome);
$$;
revoke all on function public.progresso_metas(date) from public, anon;
grant execute on function public.progresso_metas(date) to authenticated;

-- Duplicados (e-mail / telefone) em TODA a base — para avisar no cadastro manual.
-- Devolve só o nome se o contato for visível para quem pergunta.
create or replace function public.contatos_duplicados(p_email text, p_telefone text, p_ignorar uuid default null)
returns table (id uuid, nome text, motivo text, responsavel text, visivel boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         case when public.pode_ver_dono(c.responsavel_id) or public.contato_do_meu_negocio(c.id) then c.nome
              else 'Contato de outro vendedor' end,
         case when p_email is not null and lower(c.email) = lower(trim(p_email)) then 'email' else 'telefone' end,
         v.nome,
         public.pode_ver_dono(c.responsavel_id) or public.contato_do_meu_negocio(c.id)
    from public.contatos c
    left join public.vendedores v on v.id = c.responsavel_id
   where public.meu_vendedor_id() is not null
     and (p_ignorar is null or c.id <> p_ignorar)
     and ((nullif(trim(p_email), '') is not null and lower(c.email) = lower(trim(p_email)))
       or (public.tel_norm(p_telefone) is not null and public.tel_norm(c.telefone) = public.tel_norm(p_telefone)))
   limit 5;
$$;
revoke all on function public.contatos_duplicados(text, text, uuid) from public, anon;
grant execute on function public.contatos_duplicados(text, text, uuid) to authenticated;

-- IMPORTAÇÃO DE LEADS (CSV já mapeado pelo app, até 2.000 linhas).
-- p_simular = true: só confere (duplicados e erros) sem gravar nada.
-- Cada linha: {nome, email, telefone, empresa, cargo, cidade, observacoes, tags}
create or replace function public.importar_leads(
  p_linhas jsonb, p_responsavel uuid, p_origem uuid, p_tags text[], p_pular_duplicados boolean, p_simular boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eu        uuid := public.meu_vendedor_id();
  v_resp      uuid;
  v_linha     jsonb;
  v_i         int := 0;
  v_nome      text;
  v_email     text;
  v_tel       text;
  v_empresa   text;
  v_emp_id    uuid;
  v_tags      text[];
  v_dup       text;
  v_emails    text[] := '{}';
  v_tels      text[] := '{}';
  v_res       jsonb := '[]'::jsonb;
  v_criados   int := 0;
  v_dups      int := 0;
  v_erros     int := 0;
  v_empresas  int := 0;
begin
  if v_eu is null then
    raise exception 'Faça login novamente.';
  end if;
  v_resp := coalesce(p_responsavel, v_eu);
  if v_resp <> v_eu and not public.sou_gestor() then
    raise exception 'Só o gestor importa leads para outro vendedor.';
  end if;
  if not exists (select 1 from public.vendedores where id = v_resp and ativo) then
    raise exception 'Vendedor responsável inválido.';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    raise exception 'O arquivo não tem linhas.';
  end if;
  if jsonb_array_length(p_linhas) > 2000 then
    raise exception 'Máximo de 2.000 linhas por importação. Divida o arquivo.';
  end if;

  for v_linha in select * from jsonb_array_elements(p_linhas) loop
    v_i := v_i + 1;
    v_nome := left(nullif(trim(v_linha ->> 'nome'), ''), 120);
    v_email := lower(nullif(trim(v_linha ->> 'email'), ''));
    v_tel := regexp_replace(coalesce(v_linha ->> 'telefone', ''), '\D', '', 'g');
    if char_length(v_tel) not between 10 and 13 then v_tel := null; end if;
    v_empresa := left(nullif(trim(v_linha ->> 'empresa'), ''), 120);

    if v_nome is null or char_length(v_nome) < 2 then
      v_erros := v_erros + 1;
      v_res := v_res || jsonb_build_object('linha', v_i, 'status', 'erro', 'motivo', 'Sem nome');
      continue;
    end if;
    if v_email is not null and (char_length(v_email) > 160 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
      v_email := null; -- e-mail inválido: importa sem e-mail
    end if;

    v_dup := null;
    if v_email is not null and (v_email = any (v_emails) or exists (select 1 from public.contatos c where lower(c.email) = v_email)) then
      v_dup := 'e-mail';
    elsif v_tel is not null and (public.tel_norm(v_tel) = any (v_tels)
          or exists (select 1 from public.contatos c where public.tel_norm(c.telefone) = public.tel_norm(v_tel))) then
      v_dup := 'telefone';
    end if;
    if v_email is not null then v_emails := v_emails || v_email; end if;
    if v_tel is not null then v_tels := v_tels || public.tel_norm(v_tel); end if;

    if v_dup is not null then
      v_dups := v_dups + 1;
      if p_pular_duplicados then
        v_res := v_res || jsonb_build_object('linha', v_i, 'status', 'duplicado', 'motivo', 'Já existe (' || v_dup || ')');
        continue;
      end if;
    end if;

    if not p_simular then
      v_emp_id := null;
      if v_empresa is not null and char_length(v_empresa) >= 2 then
        select e.id into v_emp_id from public.empresas e where lower(e.nome) = lower(v_empresa) order by e.created_at limit 1;
        if v_emp_id is null then
          insert into public.empresas (nome, responsavel_id, origem_id, tags)
          values (v_empresa, v_resp, p_origem, coalesce(p_tags, '{}'))
          returning id into v_emp_id;
          v_empresas := v_empresas + 1;
        end if;
      end if;
      select coalesce(array_agg(distinct left(trim(t), 30)) filter (where trim(t) <> ''), '{}') into v_tags
        from unnest(coalesce(p_tags, '{}') || string_to_array(coalesce(v_linha ->> 'tags', ''), ';')) t;
      insert into public.contatos (nome, tipo, empresa_id, cargo, email, telefone, cidade, tags, origem_id, responsavel_id, observacoes)
      values (v_nome, case when v_emp_id is null then 'pf' else 'pj' end, v_emp_id,
              left(nullif(trim(v_linha ->> 'cargo'), ''), 80), v_email, v_tel,
              left(nullif(trim(v_linha ->> 'cidade'), ''), 80), v_tags, p_origem, v_resp,
              left(nullif(trim(v_linha ->> 'observacoes'), ''), 2000));
    end if;
    v_criados := v_criados + 1;
    v_res := v_res || jsonb_build_object('linha', v_i, 'status', case when v_dup is null then 'ok' else 'duplicado_importado' end,
                                         'motivo', case when v_dup is null then null else 'Duplicado (' || v_dup || '), importado mesmo assim' end);
  end loop;

  return jsonb_build_object('criados', v_criados, 'duplicados', v_dups, 'erros', v_erros, 'empresas', v_empresas,
                            'simulado', p_simular, 'linhas', v_res);
end;
$$;
revoke all on function public.importar_leads(jsonb, uuid, uuid, text[], boolean, boolean) from public, anon;
grant execute on function public.importar_leads(jsonb, uuid, uuid, text[], boolean, boolean) to authenticated;

-- =====================================================================
-- LINK PÚBLICO DA PROPOSTA (/proposta/<codigo>) — o cliente vê e ACEITA sem login.
-- As tabelas continuam fechadas para "anon": estas funções devolvem SÓ o que
-- aparece no documento (sem ids, valor do negócio, comissão ou anotações internas).
-- =====================================================================
create or replace function public.proposta_publica(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p   public.propostas%rowtype;
  v_res jsonb;
begin
  if p_codigo is null or p_codigo !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  select * into v_p from public.propostas where codigo = p_codigo;
  if not found or v_p.status in ('rascunho', 'aguardando_aprovacao') then
    return null;
  end if;

  if v_p.status = 'enviada' then -- registra que o cliente abriu
    update public.propostas
       set visualizada_em = coalesce(visualizada_em, now()), visualizacoes = visualizacoes + 1
     where id = v_p.id;
  end if;

  select jsonb_build_object(
    'proposta', jsonb_build_object(
      'numero', v_p.numero, 'versao', v_p.versao, 'titulo', v_p.titulo,
      'status', case when v_p.status = 'enviada' and v_p.validade < public.hoje_br() then 'expirada' else v_p.status end,
      'validade', v_p.validade, 'emitida_em', coalesce(v_p.enviada_em, v_p.created_at),
      'condicoes_pagamento', v_p.condicoes_pagamento, 'prazo_entrega', v_p.prazo_entrega, 'observacoes', v_p.observacoes,
      'subtotal', v_p.subtotal, 'desconto_total', v_p.desconto_total, 'total', v_p.total,
      'aceita_em', v_p.aceita_em, 'aceite_nome', v_p.aceite_nome),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'descricao', i.descricao, 'detalhes', i.detalhes, 'unidade', i.unidade, 'quantidade', i.quantidade,
               'preco_unitario', i.preco_unitario, 'desconto_pct', i.desconto_pct, 'total', i.total) order by i.ordem)
        from public.proposta_itens i where i.proposta_id = v_p.id), '[]'::jsonb),
    'cliente', (
      select jsonb_build_object('empresa', e.nome, 'contato', c.nome, 'cargo', c.cargo, 'cidade', coalesce(e.cidade, c.cidade))
        from public.negocios n
        left join public.empresas e on e.id = n.empresa_id
        left join public.contatos c on c.id = n.contato_id
       where n.id = v_p.negocio_id),
    'vendedor', (
      select jsonb_build_object('nome', v.nome, 'email', v.email, 'telefone', v.telefone)
        from public.vendedores v where v.id = v_p.vendedor_id),
    'empresa', (
      select jsonb_build_object('nome', coalesce(nullif(trim(c.nome_exibicao), ''), c.nome_negocio), 'documento', c.documento,
                                'whatsapp', c.whatsapp, 'email', c.email, 'site', c.site, 'endereco', c.endereco,
                                'cidade', c.cidade, 'rodape', c.rodape_proposta)
        from public.configuracoes c where c.unica limit 1))
  into v_res;
  return v_res;
end;
$$;
revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;

-- ACEITE pelo cliente: atômico (trava a linha) e único (1 aceite por proposta e por negócio).
-- Registra nome de quem aceitou, data/hora, IP e navegador.
create or replace function public.aceitar_proposta_publica(p_codigo text, p_nome text, p_ip text default null, p_navegador text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p    public.propostas%rowtype;
  v_ip   inet;
  v_nome text := left(nullif(trim(p_nome), ''), 120);
begin
  if p_codigo is null or p_codigo !~ '^[a-f0-9]{32}$' then
    return jsonb_build_object('ok', false, 'mensagem', 'Link inválido.');
  end if;
  if v_nome is null or char_length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'mensagem', 'Informe seu nome completo para registrar o aceite.');
  end if;

  select * into v_p from public.propostas where codigo = p_codigo for update; -- trava: 2 cliques ao mesmo tempo
  if not found or v_p.status in ('rascunho', 'aguardando_aprovacao') then
    return jsonb_build_object('ok', false, 'mensagem', 'Proposta não encontrada.');
  end if;
  if v_p.status = 'aceita' then
    return jsonb_build_object('ok', true, 'ja_aceita', true,
      'mensagem', 'Esta proposta já foi aceita em ' || to_char(v_p.aceita_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || '.');
  end if;
  if v_p.status = 'substituida' then
    return jsonb_build_object('ok', false, 'mensagem', 'Existe uma versão mais nova desta proposta. Peça o link atualizado ao vendedor.');
  end if;
  if v_p.status = 'recusada' then
    return jsonb_build_object('ok', false, 'mensagem', 'Esta proposta foi encerrada. Fale com o vendedor para uma nova.');
  end if;
  if v_p.validade < public.hoje_br() then
    return jsonb_build_object('ok', false, 'mensagem', 'A validade desta proposta acabou. Peça uma atualizada ao vendedor.');
  end if;
  if v_p.total <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Proposta sem valor. Fale com o vendedor.');
  end if;
  if exists (select 1 from public.propostas x where x.negocio_id = v_p.negocio_id and x.status = 'aceita') then
    return jsonb_build_object('ok', false, 'mensagem', 'Outra proposta deste pedido já foi aceita. Fale com o vendedor.');
  end if;

  begin
    v_ip := nullif(trim(p_ip), '')::inet;
  exception when others then
    v_ip := null;
  end;

  update public.propostas
     set status = 'aceita', aceita_em = now(), aceite_nome = v_nome, aceite_ip = v_ip,
         aceite_navegador = left(p_navegador, 300), aceite_via = 'link'
   where id = v_p.id;

  return jsonb_build_object('ok', true, 'mensagem', 'Proposta aceita! O vendedor já foi avisado e vai entrar em contato.');
end;
$$;
revoke all on function public.aceitar_proposta_publica(text, text, text, text) from public;
grant execute on function public.aceitar_proposta_publica(text, text, text, text) to anon, authenticated;

-- =====================================================================
-- AUDITORIA — quem criou/alterou/excluiu o quê (preenchida SÓ por gatilhos).
-- Ninguém edita nem apaga pelo app: não há regra de insert/update/delete.
-- =====================================================================
create table if not exists public.auditoria (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid,
  autor       text not null,
  tabela      text not null,
  registro_id uuid,
  negocio_id  uuid, -- sem chave estrangeira: o registro continua mesmo se o negócio for excluído
  acao        text not null check (acao in ('criou', 'alterou', 'excluiu')),
  campos      text[],
  descricao   text
);
create index if not exists auditoria_data_idx on public.auditoria (created_at desc);
create index if not exists auditoria_negocio_idx on public.auditoria (negocio_id, created_at desc);

alter table public.auditoria enable row level security;
drop policy if exists "auditoria_select" on public.auditoria;
create policy "auditoria_select" on public.auditoria for select to authenticated
  using (public.sou_gestor() or (public.meu_vendedor_id() is not null and user_id = auth.uid()));

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo   jsonb;
  v_velho  jsonb;
  v_linha  jsonb;
  v_campos text[];
  v_autor  text;
begin
  -- O seed.sql desliga a auditoria enquanto cria os dados de exemplo.
  if coalesce(current_setting('app.sem_auditoria', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op <> 'DELETE' then v_novo := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then v_velho := to_jsonb(old); end if;
  v_linha := coalesce(v_novo, v_velho);

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_campos
      from jsonb_object_keys(v_novo) as k
     where k not in ('updated_at', 'created_at', 'ultima_atividade_em', 'etapa_desde', 'visualizada_em', 'visualizacoes',
                     'calculada_em')
       and (v_novo -> k) is distinct from (v_velho -> k);
    if v_campos is null then
      return new; -- nada relevante mudou
    end if;
  end if;

  select v.nome into v_autor from public.vendedores v where v.user_id = auth.uid() limit 1;

  insert into public.auditoria (user_id, autor, tabela, registro_id, negocio_id, acao, campos, descricao)
  values (
    auth.uid(),
    coalesce(v_autor, case when auth.uid() is null then 'Sistema / cliente (link público)' else 'Usuário sem cadastro' end),
    tg_table_name,
    nullif(v_linha ->> 'id', '')::uuid,
    case when tg_table_name = 'negocios' then (v_linha ->> 'id')::uuid
         else nullif(v_linha ->> 'negocio_id', '')::uuid end,
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'excluiu' end,
    v_campos,
    left(case
      when tg_table_name = 'negocios' then v_linha ->> 'titulo'
      when tg_table_name = 'propostas' then (v_linha ->> 'numero') || ' v' || (v_linha ->> 'versao') || ' · ' || (v_linha ->> 'status')
      when tg_table_name = 'metas' then 'Meta de ' || to_char((v_linha ->> 'competencia')::date, 'MM/YYYY')
      when tg_table_name = 'comissoes' then 'Comissão R$ ' || (v_linha ->> 'valor') || ' · ' || (v_linha ->> 'status')
      when tg_table_name = 'regras_comissao' then (v_linha ->> 'nome') || ' (' || (v_linha ->> 'percentual') || '%)'
      when tg_table_name = 'modelos_mensagem' then v_linha ->> 'titulo'
      when tg_table_name = 'configuracoes' then 'Configurações da empresa'
      else v_linha ->> 'nome' end, 160)
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['negocios', 'propostas', 'comissoes', 'metas', 'regras_comissao', 'vendedores', 'equipes',
                           'configuracoes', 'produtos', 'funis', 'etapas', 'contatos', 'empresas', 'motivos_perda',
                           'origens', 'modelos_mensagem'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.registrar_auditoria()', 'trg_' || t || '_auditoria', t);
  end loop;
end $$;

-- Garante que a linha de configuração exista (não altera se já existir).
insert into public.configuracoes (unica) values (true)
on conflict (unica) do nothing;

-- =====================================================================
-- PERMISSÕES DA API (GRANT)
-- Projetos novos do Supabase NÃO liberam as tabelas do schema "public" para a API automaticamente.
-- Sem estes GRANTs a API bloqueia a leitura antes mesmo de checar o RLS ("não foi possível ler ...").
-- O RLS continua valendo: o GRANT só abre a porta, quem decide o que cada um vê são as políticas.
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Páginas públicas (papel anon): só o que as políticas "to anon" já permitem.
do $grant_anon$
declare r record;
begin
  for r in select distinct schemaname, tablename, cmd from pg_policies
           where schemaname = 'public' and 'anon' = any(roles) loop
    execute format('grant %s on %I.%I to anon',
                   case r.cmd when 'ALL' then 'select, insert, update, delete' else r.cmd end, r.schemaname, r.tablename);
  end loop;
end
$grant_anon$;

-- Tabelas e funções criadas no futuro (ex.: ao acrescentar um cadastro) já nascem liberadas.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- Recarrega o cache da API para enxergar as permissões na hora.
notify pgrst, 'reload schema';
