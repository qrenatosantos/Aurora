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
  -- Celular antigo sem o 9 (DDD + 8 dígitos começando por 6, 7, 8 ou 9) vira DDD + 9 + 8 dígitos:
  -- "34 8893-5223" e "34 98893-5223" são o mesmo número. Fixo (começa por 2 a 5) fica como está.
  select case
    when d is null then null
    when char_length(d) = 10 and substr(d, 3, 1) in ('6', '7', '8', '9') then substr(d, 1, 2) || '9' || substr(d, 3)
    else d
  end
  from (select case when char_length(x) in (12, 13) and x like '55%' then substr(x, 3) else nullif(x, '') end as d
          from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x) a) b;
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
  check (fonte in ('aurora', 'moderna', 'elegante', 'amigavel', 'classica', 'tecnica', 'divertida')); -- 'aurora' = Cormorant Garamond + DM Sans
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

-- #####################################################################
-- #####################################################################
--
--   AURORA BARTENDERS — tudo o que este sistema acrescenta à base
--
--   Daqui até o bloco "PERMISSÕES DA API" ficam as tabelas, regras e
--   funções próprias da Aurora: evento no negócio, agenda de eventos,
--   catálogo e calculadora de insumos, proposta no padrão da Aurora com
--   aprovação obrigatória, atendimento (agente ou humano), conversa,
--   entrada de leads, API do agente, avisos (webhooks) e LGPD.
--
--   Algumas funções da base são REDEFINIDAS aqui (create or replace):
--   vale sempre a última definição do arquivo.
--
-- #####################################################################
-- #####################################################################

-- Esquema "privado": funções internas que a API pública (PostgREST) NÃO
-- enxerga. Só são chamadas por outras funções do banco.
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- =====================================================================
-- A1. CONFIGURAÇÕES DA AURORA (colunas novas em configuracoes)
-- =====================================================================
alter table public.configuracoes add column if not exists responsavel text;      -- quem assina as propostas
alter table public.configuracoes add column if not exists uf text;
-- Módulos da base que a Aurora não usa hoje: ficam DESLIGADOS (nada é apagado).
alter table public.configuracoes add column if not exists mod_empresas  boolean not null default false;
alter table public.configuracoes add column if not exists mod_funis     boolean not null default false; -- vários funis
alter table public.configuracoes add column if not exists mod_metas     boolean not null default false;
alter table public.configuracoes add column if not exists mod_comissoes boolean not null default false;
alter table public.configuracoes add column if not exists mod_equipe    boolean not null default false;
-- Agenda de eventos
alter table public.configuracoes add column if not exists capacidade_simultanea integer not null default 3;
alter table public.configuracoes add column if not exists duracao_padrao_horas  numeric(4,1) not null default 4;
-- Atendimento: quem recebe os leads novos ("humano" até o agente estar ligado)
alter table public.configuracoes add column if not exists atendimento_novos_leads text not null default 'humano';
-- Condições comerciais padrão das propostas. Ficam VAZIAS até o gestor confirmar.
alter table public.configuracoes add column if not exists entrada_pct             numeric(5,2);
alter table public.configuracoes add column if not exists entrada_dias_antes      integer;
alter table public.configuracoes add column if not exists saldo_dias_antes        integer;
alter table public.configuracoes add column if not exists cancelamento_aviso_dias integer;
alter table public.configuracoes add column if not exists cancelamento_multa_pct  numeric(5,2);
alter table public.configuracoes add column if not exists taxa_quebra             numeric(12,2);
alter table public.configuracoes add column if not exists foro                    text;
-- Documento da proposta
alter table public.configuracoes add column if not exists prefixo_proposta text not null default 'PROP';
alter table public.configuracoes add column if not exists proposta_textos  jsonb not null default '{}'::jsonb;
alter table public.configuracoes add column if not exists proposta_fotos   jsonb not null default '{}'::jsonb;
-- LGPD
alter table public.configuracoes add column if not exists retencao_leads_meses integer not null default 12;
alter table public.configuracoes add column if not exists email_privacidade    text;
-- true = o banco apaga sozinho, toda semana, os leads fora do prazo de guarda (LGPD)
alter table public.configuracoes add column if not exists retencao_automatica  boolean not null default true;

alter table public.configuracoes drop constraint if exists configuracoes_responsavel_ck;
alter table public.configuracoes add constraint configuracoes_responsavel_ck
  check (responsavel is null or char_length(responsavel) <= 80);
alter table public.configuracoes drop constraint if exists configuracoes_uf_ck;
alter table public.configuracoes add constraint configuracoes_uf_ck check (uf is null or uf ~ '^[A-Z]{2}$');
alter table public.configuracoes drop constraint if exists configuracoes_capacidade_ck;
alter table public.configuracoes add constraint configuracoes_capacidade_ck check (capacidade_simultanea between 1 and 50);
alter table public.configuracoes drop constraint if exists configuracoes_duracao_padrao_ck;
alter table public.configuracoes add constraint configuracoes_duracao_padrao_ck check (duracao_padrao_horas between 0.5 and 24);
alter table public.configuracoes drop constraint if exists configuracoes_atendimento_ck;
alter table public.configuracoes add constraint configuracoes_atendimento_ck
  check (atendimento_novos_leads in ('humano', 'agente'));
alter table public.configuracoes drop constraint if exists configuracoes_condicoes_aurora_ck;
alter table public.configuracoes add constraint configuracoes_condicoes_aurora_ck check (
      (entrada_pct is null or entrada_pct between 0 and 100)
  and (entrada_dias_antes is null or entrada_dias_antes between 0 and 365)
  and (saldo_dias_antes is null or saldo_dias_antes between 0 and 365)
  and (cancelamento_aviso_dias is null or cancelamento_aviso_dias between 0 and 365)
  and (cancelamento_multa_pct is null or cancelamento_multa_pct between 0 and 100)
  and (taxa_quebra is null or taxa_quebra >= 0)
  and (foro is null or char_length(foro) <= 120));
alter table public.configuracoes drop constraint if exists configuracoes_prefixo_ck;
alter table public.configuracoes add constraint configuracoes_prefixo_ck check (prefixo_proposta ~ '^[A-Z0-9]{2,8}$');
alter table public.configuracoes drop constraint if exists configuracoes_retencao_ck;
alter table public.configuracoes add constraint configuracoes_retencao_ck check (retencao_leads_meses between 1 and 120);
alter table public.configuracoes drop constraint if exists configuracoes_email_priv_ck;
alter table public.configuracoes add constraint configuracoes_email_priv_ck
  check (email_privacidade is null or char_length(email_privacidade) <= 160);
alter table public.configuracoes drop constraint if exists configuracoes_proposta_json_ck;
alter table public.configuracoes add constraint configuracoes_proposta_json_ck
  check (jsonb_typeof(proposta_textos) = 'object' and jsonb_typeof(proposta_fotos) = 'object');

-- Telefones: tel_norm() passou a tratar celular com e sem o 9 como o mesmo número.
-- Bancos criados antes disso precisam recalcular o índice (rápido; pode rodar sempre).
reindex index public.contatos_tel_idx;

-- Contato que pediu para não receber mensagens, e consentimento para retomadas (LGPD e regras
-- da Meta). As datas são preenchidas pelo banco; o "não contatar" desliga as retomadas.
alter table public.contatos add column if not exists nao_contatar        boolean not null default false;
alter table public.contatos add column if not exists nao_contatar_em     timestamptz;
alter table public.contatos add column if not exists nao_contatar_motivo text;
alter table public.contatos add column if not exists aceita_retomadas    boolean not null default false;
alter table public.contatos add column if not exists aceita_retomadas_em timestamptz;
alter table public.contatos drop constraint if exists contatos_nao_contatar_motivo_ck;
alter table public.contatos add constraint contatos_nao_contatar_motivo_ck
  check (nao_contatar_motivo is null or char_length(nao_contatar_motivo) <= 200);

create or replace function public.contato_preferencias()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- as datas não são editáveis: o banco registra quando cada escolha foi feita
    new.nao_contatar_em := old.nao_contatar_em;
    new.aceita_retomadas_em := old.aceita_retomadas_em;
  else
    new.nao_contatar_em := null;
    new.aceita_retomadas_em := null;
  end if;
  if new.nao_contatar then
    new.aceita_retomadas := false;
    if tg_op = 'INSERT' or not old.nao_contatar then
      new.nao_contatar_em := now();
    end if;
    new.nao_contatar_motivo := nullif(left(trim(new.nao_contatar_motivo), 200), '');
  else
    new.nao_contatar_em := null;
    new.nao_contatar_motivo := null;
  end if;
  if (tg_op = 'INSERT' and new.aceita_retomadas) or (tg_op = 'UPDATE' and new.aceita_retomadas is distinct from old.aceita_retomadas) then
    new.aceita_retomadas_em := now();
  end if;
  return new;
end;
$$;
revoke all on function public.contato_preferencias() from public, anon, authenticated;
drop trigger if exists trg_contatos_preferencias on public.contatos;
create trigger trg_contatos_preferencias before insert or update on public.contatos
  for each row execute function public.contato_preferencias();

-- =====================================================================
-- A2. O AGENTE COMO "VENDEDOR" ESPECIAL (sem login)
-- Assim cada ação dele aparece na auditoria e no histórico com o nome "Agente SDR".
-- =====================================================================
alter table public.vendedores add column if not exists tipo text not null default 'humano';
alter table public.vendedores drop constraint if exists vendedores_tipo_ck;
alter table public.vendedores add constraint vendedores_tipo_ck check (tipo in ('humano', 'agente'));
-- O agente nunca é gestor e nunca tem login.
alter table public.vendedores drop constraint if exists vendedores_agente_ck;
alter table public.vendedores add constraint vendedores_agente_ck
  check (tipo = 'humano' or (papel = 'vendedor' and user_id is null));
create unique index if not exists vendedores_um_agente_uidx on public.vendedores ((true)) where tipo = 'agente';

do $$
begin
  if not exists (select 1 from public.vendedores where tipo = 'agente') then
    perform set_config('app.sem_auditoria', 'on', true);
    insert into public.vendedores (nome, papel, tipo, cor) values ('Agente SDR', 'vendedor', 'agente', '#C6A86A');
    perform set_config('app.sem_auditoria', '', true);
  end if;
end $$;

-- Quem está agindo agora? (login humano, ou o agente pela API, ou o cliente/site por função pública)
-- ATENÇÃO: servem só para REGISTRAR o autor (auditoria, histórico). Nunca para liberar acesso.
create or replace function public.ator_vendedor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.meu_vendedor_id(), nullif(current_setting('app.agente_vendedor_id', true), '')::uuid);
$$;

create or replace function public.ator_tipo()
returns text
language sql
stable
set search_path = public
as $$
  select case
    when nullif(current_setting('app.agente_chave_id', true), '') is not null then 'agente'
    when auth.uid() is not null then 'humano'
    when nullif(current_setting('app.ator', true), '') in ('cliente', 'site') then current_setting('app.ator', true)
    else 'sistema'
  end;
$$;
revoke all on function public.ator_vendedor_id() from public, anon;
revoke all on function public.ator_tipo() from public, anon;

-- Primeiro gestor humano ativo: "dono" padrão dos leads que chegam sozinhos (site, agente).
create or replace function privado.gestor_padrao()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id from public.vendedores v
   where v.papel = 'gestor' and v.tipo = 'humano' and v.ativo
   order by (v.user_id is not null) desc, v.created_at
   limit 1;
$$;

create or replace function privado.agente_vendedor()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id from public.vendedores v where v.tipo = 'agente' limit 1;
$$;

-- Comissões desligadas (módulo): não calcula nada ao ganhar um negócio.
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

  if not coalesce((select c.mod_comissoes from public.configuracoes c where c.unica limit 1), false) then
    delete from public.comissoes where negocio_id = p_negocio and status <> 'paga';
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

-- =====================================================================
-- A3. CATÁLOGO: insumos, drinks (com receita), pacotes
-- Todos os vendedores leem; só o gestor cadastra.
-- =====================================================================

-- INSUMOS — o que se compra para fazer os drinks. Preço por EMBALAGEM
-- (ex.: garrafa de 1000 ml). Duas linhas de preço: tradicional e premium.
-- preco_premium vazio = o insumo não tem versão premium (usa o tradicional).
create table if not exists public.insumos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (char_length(nome) between 2 and 80),
  categoria         text not null default 'outro'
                    check (categoria in ('destilado', 'licor', 'vinho', 'fruta', 'xarope', 'suco', 'refrigerante', 'gelo', 'guarnicao', 'descartavel', 'outro')),
  unidade           text not null default 'ml' check (unidade in ('ml', 'g', 'un')),
  embalagem         numeric(12,3) not null default 1 check (embalagem > 0),  -- quantas unidades vêm na embalagem
  preco_tradicional numeric(12,2) check (preco_tradicional is null or preco_tradicional >= 0),
  preco_premium     numeric(12,2) check (preco_premium is null or preco_premium >= 0),
  marca_tradicional text check (marca_tradicional is null or char_length(marca_tradicional) <= 80),
  marca_premium     text check (marca_premium is null or char_length(marca_premium) <= 80),
  observacoes       text check (observacoes is null or char_length(observacoes) <= 500),
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists insumos_nome_uidx on public.insumos (lower(nome));

-- DRINKS — o que aparece no cardápio da proposta.
create table if not exists public.drinks (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 80),
  descricao  text check (descricao is null or char_length(descricao) <= 300),
  categoria  text not null default 'classico' check (categoria in ('classico', 'premium', 'sem_alcool', 'autoral')),
  alcoolico  boolean not null default true,
  copo       text check (copo is null or copo in ('long_drink', 'baixo', 'caneca', 'taca', 'outro')),
  foto_url   text check (foto_url is null or (char_length(foto_url) <= 500 and foto_url ~ '^(https?://|/)')),
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists drinks_nome_uidx on public.drinks (lower(nome));

-- RECEITA — quanto de cada insumo vai em 1 drink (na unidade do insumo).
create table if not exists public.drink_insumos (
  id         uuid primary key default gen_random_uuid(),
  drink_id   uuid not null references public.drinks (id) on delete cascade,
  insumo_id  uuid not null references public.insumos (id) on delete restrict,
  quantidade numeric(12,3) not null check (quantidade > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drink_id, insumo_id)
);
create index if not exists drink_insumos_insumo_idx on public.drink_insumos (insumo_id);

-- PACOTES — Essencial, Signature, Reserve, Exclusive...
create table if not exists public.pacotes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 60),
  slogan     text check (slogan is null or char_length(slogan) <= 160),
  descricao  text check (descricao is null or char_length(descricao) <= 500),
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pacotes_nome_uidx on public.pacotes (lower(nome));
-- Acréscimo do pacote sobre o preço calculado: os pacotes de cima têm mais drinks, mais preparo e
-- mais variedade, mas a conta de insumos divide o consumo entre os drinks e pode sair mais barata.
alter table public.pacotes add column if not exists acrescimo_pct numeric(5,2) not null default 0;
alter table public.pacotes drop constraint if exists pacotes_acrescimo_ck;
alter table public.pacotes add constraint pacotes_acrescimo_ck check (acrescimo_pct between 0 and 300);

create table if not exists public.pacote_drinks (
  pacote_id  uuid not null references public.pacotes (id) on delete cascade,
  drink_id   uuid not null references public.drinks (id) on delete cascade,
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (pacote_id, drink_id)
);

-- =====================================================================
-- A4. CALCULADORA DE INSUMOS E PREÇO (linha única de parâmetros)
-- O preço sugerido sai de: insumos do cardápio + mão de obra + custos fixos + margem.
-- "aprovada" = o gestor conferiu as regras. Só com ela o AGENTE pode informar preço.
-- Qualquer mudança em preço de insumo, receita, pacote ou parâmetro DESFAZ a aprovação.
-- =====================================================================
create table if not exists public.calculadora (
  id                        uuid primary key default gen_random_uuid(),
  unica                     boolean not null default true unique check (unica),
  drinks_por_convidado_hora numeric(5,2) check (drinks_por_convidado_hora is null or drinks_por_convidado_hora > 0),
  convidados_por_bartender  integer check (convidados_por_bartender is null or convidados_por_bartender > 0),
  minimo_bartenders         integer not null default 1 check (minimo_bartenders between 1 and 50),
  custo_bartender_hora      numeric(12,2) check (custo_bartender_hora is null or custo_bartender_hora >= 0),
  horas_montagem            numeric(4,1) not null default 0 check (horas_montagem between 0 and 24),
  custo_fixo                numeric(12,2) not null default 0 check (custo_fixo >= 0),
  taxa_outra_cidade         numeric(12,2) not null default 0 check (taxa_outra_cidade >= 0),
  perdas_pct                numeric(5,2) not null default 0 check (perdas_pct between 0 and 100),
  margem_pct                numeric(6,2) check (margem_pct is null or margem_pct between 0 and 1000),
  arredondar_para           numeric(12,2) not null default 0 check (arredondar_para >= 0),
  preco_minimo              numeric(12,2) not null default 0 check (preco_minimo >= 0),
  aprovada                  boolean not null default false,
  aprovada_em               timestamptz,
  aprovada_por              uuid references public.vendedores (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
insert into public.calculadora (unica) values (true) on conflict (unica) do nothing;

-- updated_at + RLS dos cadastros do catálogo (leitura: vendedor ativo; escrita: gestor)
do $$
declare
  t text;
begin
  foreach t in array array['insumos', 'drinks', 'drink_insumos', 'pacotes', 'calculadora'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   'trg_' || t || '_updated_at', t);
  end loop;
  foreach t in array array['insumos', 'drinks', 'drink_insumos', 'pacotes', 'pacote_drinks', 'calculadora'] loop
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

-- A aprovação das regras de preço cai quando algo que entra na conta muda.
create or replace function public.calculadora_desaprovar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'insumos' and tg_op = 'UPDATE' then
    if (new.unidade, new.embalagem, new.preco_tradicional, new.preco_premium, new.ativo)
       is not distinct from (old.unidade, old.embalagem, old.preco_tradicional, old.preco_premium, old.ativo) then
      return null; -- só mudou nome/marca/observação: não afeta o preço
    end if;
  end if;
  update public.calculadora set aprovada = false, aprovada_em = null, aprovada_por = null where unica and aprovada;
  return null;
end;
$$;
revoke all on function public.calculadora_desaprovar() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['insumos', 'drink_insumos', 'pacote_drinks'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_desaprovar', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.calculadora_desaprovar()',
                   'trg_' || t || '_desaprovar', t);
  end loop;
end $$;

-- Na própria calculadora: mudar um parâmetro desfaz a aprovação; aprovar só pela função aprovar_calculadora().
-- SEM "security definer": current_user = quem chamou ('authenticated' = app).
create or replace function public.calculadora_antes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.drinks_por_convidado_hora, new.convidados_por_bartender, new.minimo_bartenders, new.custo_bartender_hora,
      new.horas_montagem, new.custo_fixo, new.taxa_outra_cidade, new.perdas_pct, new.margem_pct, new.arredondar_para, new.preco_minimo)
     is distinct from
     (old.drinks_por_convidado_hora, old.convidados_por_bartender, old.minimo_bartenders, old.custo_bartender_hora,
      old.horas_montagem, old.custo_fixo, old.taxa_outra_cidade, old.perdas_pct, old.margem_pct, old.arredondar_para, old.preco_minimo) then
    new.aprovada := false; new.aprovada_em := null; new.aprovada_por := null;
  elsif current_user in ('authenticated', 'anon') then
    -- pelo app, os campos de aprovação só mudam pela função aprovar_calculadora()
    new.aprovada := old.aprovada; new.aprovada_em := old.aprovada_em; new.aprovada_por := old.aprovada_por;
  end if;
  return new;
end;
$$;
revoke all on function public.calculadora_antes() from public, anon, authenticated;
drop trigger if exists trg_calculadora_antes on public.calculadora;
create trigger trg_calculadora_antes before update on public.calculadora
  for each row execute function public.calculadora_antes();

-- O que falta para a calculadora funcionar? (lista em português; vazia = está completa)
create or replace function privado.calculadora_pendencias()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c   public.calculadora%rowtype;
  v_p   text[] := '{}';
  v_txt text;
begin
  select * into v_c from public.calculadora where unica limit 1;
  if v_c.drinks_por_convidado_hora is null then v_p := v_p || 'Informe o consumo médio (drinks por convidado por hora).'::text; end if;
  if v_c.convidados_por_bartender is null then v_p := v_p || 'Informe quantos convidados cada bartender atende.'::text; end if;
  if v_c.custo_bartender_hora is null then v_p := v_p || 'Informe o custo por hora de um bartender.'::text; end if;
  if v_c.margem_pct is null then v_p := v_p || 'Informe a margem sobre o custo.'::text; end if;

  select string_agg(d.nome, ', ' order by d.nome) into v_txt
    from public.drinks d
   where d.ativo
     and exists (select 1 from public.pacote_drinks pd join public.pacotes p on p.id = pd.pacote_id and p.ativo where pd.drink_id = d.id)
     and not exists (select 1 from public.drink_insumos di where di.drink_id = d.id);
  if v_txt is not null then v_p := v_p || ('Drinks de pacote sem receita: ' || v_txt || '.'); end if;

  select string_agg(distinct i.nome, ', ' order by i.nome) into v_txt
    from public.insumos i
    join public.drink_insumos di on di.insumo_id = i.id
    join public.drinks d on d.id = di.drink_id and d.ativo
   where i.preco_tradicional is null;
  if v_txt is not null then v_p := v_p || ('Insumos sem preço: ' || v_txt || '.'); end if;

  if not exists (select 1 from public.pacotes p join public.pacote_drinks pd on pd.pacote_id = p.id where p.ativo) then
    v_p := v_p || 'Cadastre pelo menos um pacote com drinks.'::text;
  end if;
  return v_p;
end;
$$;

-- A CONTA. Entrada (jsonb): pacote_id OU drinks (lista de ids), drinks_extras (ids),
-- convidados, duracao_horas, linha ('tradicional' | 'premium'), outra_cidade (bool).
-- Devolve a memória de cálculo completa (lista de compras + custos + preço sugerido).
create or replace function privado.calcular_preco(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c          public.calculadora%rowtype;
  v_pacote     public.pacotes%rowtype;
  v_ids        uuid[] := '{}';
  v_conv       integer;
  v_horas      numeric;
  v_linha      text := coalesce(nullif(p ->> 'linha', ''), 'tradicional');
  v_fora       boolean := false;
  v_pend       text[] := '{}';
  v_txt        text;
  v_n          integer;
  v_total_dr   numeric;
  v_por_drink  numeric;
  v_drinks     jsonb;
  v_insumos    jsonb;
  v_c_insumos  numeric := 0;
  v_compra     numeric := 0;
  v_bart       integer;
  v_c_mao      numeric;
  v_c_total    numeric;
  v_preco      numeric;
begin
  select * into v_c from public.calculadora where unica limit 1;

  begin
    v_conv := (p ->> 'convidados')::integer;
    v_horas := (p ->> 'duracao_horas')::numeric;
    v_fora := coalesce((p ->> 'outra_cidade')::boolean, false);
  exception when others then
    v_conv := null; v_horas := null;
  end;
  if v_conv is null or v_conv < 1 or v_conv > 5000 then v_pend := v_pend || 'Informe o número de convidados.'::text; end if;
  if v_horas is null or v_horas < 0.5 or v_horas > 24 then v_pend := v_pend || 'Informe a duração do serviço em horas.'::text; end if;
  if v_linha not in ('tradicional', 'premium') then v_pend := v_pend || 'Linha inválida: use tradicional ou premium.'::text; end if;

  -- Cardápio: lista explícita de drinks, ou os drinks do pacote; mais os extras.
  if nullif(p ->> 'pacote_id', '') ~ '^[0-9a-fA-F-]{36}$' then
    select * into v_pacote from public.pacotes where id = (p ->> 'pacote_id')::uuid;
  end if;
  if jsonb_typeof(p -> 'drinks') = 'array' and jsonb_array_length(p -> 'drinks') > 0 then
    select coalesce(array_agg(d.id), '{}') into v_ids
      from public.drinks d
     where d.id in (select x::uuid from jsonb_array_elements_text(p -> 'drinks') x where x ~ '^[0-9a-fA-F-]{36}$');
  elsif v_pacote.id is not null then
    select coalesce(array_agg(pd.drink_id), '{}') into v_ids from public.pacote_drinks pd where pd.pacote_id = v_pacote.id;
  end if;
  if jsonb_typeof(p -> 'drinks_extras') = 'array' then
    select v_ids || coalesce(array_agg(d.id), '{}') into v_ids
      from public.drinks d
     where d.id in (select x::uuid from jsonb_array_elements_text(p -> 'drinks_extras') x where x ~ '^[0-9a-fA-F-]{36}$')
       and not (d.id = any(v_ids));
  end if;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then v_pend := v_pend || 'Escolha um pacote ou os drinks do cardápio.'::text; end if;

  if v_c.drinks_por_convidado_hora is null then v_pend := v_pend || 'Calculadora: falta o consumo médio (drinks por convidado por hora).'::text; end if;
  if v_c.convidados_por_bartender is null then v_pend := v_pend || 'Calculadora: falta quantos convidados cada bartender atende.'::text; end if;
  if v_c.custo_bartender_hora is null then v_pend := v_pend || 'Calculadora: falta o custo por hora do bartender.'::text; end if;
  if v_c.margem_pct is null then v_pend := v_pend || 'Calculadora: falta a margem sobre o custo.'::text; end if;

  if v_n > 0 then
    select string_agg(d.nome, ', ' order by d.nome) into v_txt
      from public.drinks d
     where d.id = any(v_ids) and not exists (select 1 from public.drink_insumos di where di.drink_id = d.id);
    if v_txt is not null then v_pend := v_pend || ('Drinks sem receita: ' || v_txt || '.'); end if;
    select string_agg(distinct i.nome, ', ' order by i.nome) into v_txt
      from public.drink_insumos di join public.insumos i on i.id = di.insumo_id
     where di.drink_id = any(v_ids) and i.preco_tradicional is null;
    if v_txt is not null then v_pend := v_pend || ('Insumos sem preço: ' || v_txt || '.'); end if;
  end if;

  if array_length(v_pend, 1) is not null then
    return jsonb_build_object('ok', false, 'aprovada', v_c.aprovada, 'pendencias', to_jsonb(v_pend));
  end if;

  v_total_dr := ceil(v_conv * v_horas * v_c.drinks_por_convidado_hora);
  v_por_drink := v_total_dr / v_n;

  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nome', d.nome, 'quantidade', round(v_por_drink, 1)) order by d.ordem, d.nome), '[]'::jsonb)
    into v_drinks
    from public.drinks d where d.id = any(v_ids);

  with necessidade as (
    select i.id, i.nome, i.categoria, i.unidade, i.embalagem,
           sum(di.quantidade) * v_por_drink * (1 + v_c.perdas_pct / 100) as qtd,
           case when v_linha = 'premium' and i.preco_premium is not null then i.preco_premium else i.preco_tradicional end as preco,
           case when v_linha = 'premium' and i.preco_premium is not null then 'premium' else 'tradicional' end as linha_usada,
           case when v_linha = 'premium' and i.preco_premium is not null then i.marca_premium else i.marca_tradicional end as marca
      from public.drink_insumos di
      join public.insumos i on i.id = di.insumo_id
     where di.drink_id = any(v_ids)
     group by i.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'nome', n.nome, 'categoria', n.categoria, 'unidade', n.unidade,
           'quantidade', round(n.qtd, 1), 'embalagem', n.embalagem,
           'embalagens', ceil(n.qtd / n.embalagem), 'preco_embalagem', n.preco,
           'linha', n.linha_usada, 'marca', n.marca,
           'custo', round(n.qtd * n.preco / n.embalagem, 2),
           'compra', round(ceil(n.qtd / n.embalagem) * n.preco, 2)) order by n.categoria, n.nome), '[]'::jsonb),
         coalesce(sum(round(n.qtd * n.preco / n.embalagem, 2)), 0),
         coalesce(sum(round(ceil(n.qtd / n.embalagem) * n.preco, 2)), 0)
    into v_insumos, v_c_insumos, v_compra
    from necessidade n;

  v_bart := greatest(v_c.minimo_bartenders, ceil(v_conv::numeric / v_c.convidados_por_bartender)::integer);
  v_c_mao := round(v_bart * (v_horas + v_c.horas_montagem) * v_c.custo_bartender_hora, 2);
  v_c_total := v_c_insumos + v_c_mao + v_c.custo_fixo + case when v_fora then v_c.taxa_outra_cidade else 0 end;
  v_preco := round(v_c_total * (1 + v_c.margem_pct / 100) * (1 + coalesce(v_pacote.acrescimo_pct, 0) / 100), 2);
  if v_c.arredondar_para > 0 then
    v_preco := ceil(v_preco / v_c.arredondar_para) * v_c.arredondar_para;
  end if;
  v_preco := greatest(v_preco, v_c.preco_minimo);

  return jsonb_build_object(
    'ok', true,
    'aprovada', v_c.aprovada,
    'pendencias', '[]'::jsonb,
    'entrada', jsonb_build_object('pacote_id', v_pacote.id, 'pacote', v_pacote.nome, 'convidados', v_conv,
                                  'duracao_horas', v_horas, 'linha', v_linha, 'outra_cidade', v_fora),
    'total_drinks', v_total_dr,
    'drinks', v_drinks,
    'insumos', v_insumos,
    'bartenders', v_bart,
    'custos', jsonb_build_object('insumos', v_c_insumos, 'compra_embalagens_inteiras', v_compra, 'mao_de_obra', v_c_mao,
                                 'fixo', v_c.custo_fixo, 'outra_cidade', case when v_fora then v_c.taxa_outra_cidade else 0 end,
                                 'total', v_c_total, 'margem_pct', v_c.margem_pct,
                                 'acrescimo_pacote_pct', coalesce(v_pacote.acrescimo_pct, 0)),
    'preco_sugerido', v_preco,
    'calculado_em', now());
end;
$$;

-- Para as telas (usuário logado): memória de cálculo completa.
create or replace function public.calcular_preco(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.meu_vendedor_id() is null then
    raise exception 'Faça login novamente.';
  end if;
  return privado.calcular_preco(coalesce(p, '{}'::jsonb));
end;
$$;
revoke all on function public.calcular_preco(jsonb) from public, anon;
grant execute on function public.calcular_preco(jsonb) to authenticated;

create or replace function public.calculadora_pendencias()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.meu_vendedor_id() is null then
    raise exception 'Faça login novamente.';
  end if;
  return privado.calculadora_pendencias();
end;
$$;
revoke all on function public.calculadora_pendencias() from public, anon;
grant execute on function public.calculadora_pendencias() to authenticated;

-- O gestor confere e aprova as regras de preço (só com tudo preenchido).
create or replace function public.aprovar_calculadora()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p text[];
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor aprova as regras de preço.';
  end if;
  v_p := privado.calculadora_pendencias();
  if array_length(v_p, 1) is not null then
    raise exception '%', 'Ainda falta: ' || array_to_string(v_p, ' ');
  end if;
  update public.calculadora
     set aprovada = true, aprovada_em = now(), aprovada_por = public.meu_vendedor_id()
   where unica;
end;
$$;
revoke all on function public.aprovar_calculadora() from public, anon;
grant execute on function public.aprovar_calculadora() to authenticated;

-- =====================================================================
-- A5. EVENTO DO NEGÓCIO e AGENDA DE EVENTOS
-- Cada negócio tem (no máximo) um evento. A "situação da data" diz se a data
-- está só em consulta, reservada (proposta enviada), confirmada (fechou) ou liberada.
-- =====================================================================
create table if not exists public.eventos (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null unique references public.negocios (id) on delete cascade,
  tipo             text check (tipo is null or tipo in ('casamento', '15_anos', 'aniversario', 'formatura', 'empresa', 'outro')),
  nome             text check (nome is null or char_length(nome) <= 120),      -- ex.: "1 ano do José Miguel"
  data             date,                                                        -- vazia = "a definir"
  mes_previsto     date check (mes_previsto is null or extract(day from mes_previsto) = 1),
  hora_inicio      time,
  duracao_horas    numeric(4,1) check (duracao_horas is null or duracao_horas between 0.5 and 24),
  cidade           text check (cidade is null or char_length(cidade) <= 80),
  uf               text check (uf is null or uf ~ '^[A-Z]{2}$'),
  local            text check (local is null or char_length(local) <= 160),
  convidados       integer check (convidados is null or convidados between 1 and 5000),
  convidados_faixa text check (convidados_faixa is null or char_length(convidados_faixa) <= 40), -- ex.: "51 a 100"
  pacote_id        uuid references public.pacotes (id) on delete set null,
  quer_ajuda_pacote boolean not null default false,
  linha            text check (linha is null or linha in ('tradicional', 'premium')),
  preferencias     text[] not null default '{}',                                -- ex.: {"sem álcool","drinks premium"}
  observacoes      text check (observacoes is null or char_length(observacoes) <= 2000),
  situacao_data    text not null default 'consulta' check (situacao_data in ('consulta', 'reservada', 'confirmada', 'liberada')),
  reservada_ate    date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists eventos_data_idx on public.eventos (data) where data is not null;
drop trigger if exists trg_eventos_updated_at on public.eventos;
create trigger trg_eventos_updated_at before update on public.eventos
  for each row execute function public.set_updated_at();

create or replace function public.evento_antes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.data is null then
    new.situacao_data := 'consulta';
  end if;
  if new.situacao_data <> 'reservada' then
    new.reservada_ate := null;
  end if;
  if new.data is not null then
    new.mes_previsto := null;
  end if;
  return new;
end;
$$;
revoke all on function public.evento_antes() from public, anon, authenticated;
drop trigger if exists trg_eventos_antes on public.eventos;
create trigger trg_eventos_antes before insert or update on public.eventos
  for each row execute function public.evento_antes();

alter table public.eventos enable row level security;
drop policy if exists "eventos_select" on public.eventos;
create policy "eventos_select" on public.eventos for select to authenticated
  using (public.pode_ver_negocio(negocio_id));
drop policy if exists "eventos_insert" on public.eventos;
create policy "eventos_insert" on public.eventos for insert to authenticated
  with check (public.pode_editar_negocio(negocio_id));
drop policy if exists "eventos_update" on public.eventos;
create policy "eventos_update" on public.eventos for update to authenticated
  using (public.pode_editar_negocio(negocio_id)) with check (public.pode_editar_negocio(negocio_id));
drop policy if exists "eventos_delete" on public.eventos;
create policy "eventos_delete" on public.eventos for delete to authenticated
  using (public.pode_editar_negocio(negocio_id));

-- Datas que o gestor fecha manualmente (folga, viagem, feriado...).
create table if not exists public.bloqueios_agenda (
  id         uuid primary key default gen_random_uuid(),
  inicio     date not null,
  fim        date not null,
  motivo     text check (motivo is null or char_length(motivo) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bloqueios_periodo_ck check (fim >= inicio and fim <= inicio + 366)
);
create index if not exists bloqueios_periodo_idx on public.bloqueios_agenda (inicio, fim);
drop trigger if exists trg_bloqueios_agenda_updated_at on public.bloqueios_agenda;
create trigger trg_bloqueios_agenda_updated_at before update on public.bloqueios_agenda
  for each row execute function public.set_updated_at();
alter table public.bloqueios_agenda enable row level security;
drop policy if exists "bloqueios_select" on public.bloqueios_agenda;
create policy "bloqueios_select" on public.bloqueios_agenda for select to authenticated
  using (public.meu_vendedor_id() is not null);
drop policy if exists "bloqueios_insert" on public.bloqueios_agenda;
create policy "bloqueios_insert" on public.bloqueios_agenda for insert to authenticated with check (public.sou_gestor());
drop policy if exists "bloqueios_update" on public.bloqueios_agenda;
create policy "bloqueios_update" on public.bloqueios_agenda for update to authenticated
  using (public.sou_gestor()) with check (public.sou_gestor());
drop policy if exists "bloqueios_delete" on public.bloqueios_agenda;
create policy "bloqueios_delete" on public.bloqueios_agenda for delete to authenticated using (public.sou_gestor());

-- DISPONIBILIDADE de uma data. Conta os eventos confirmados e os reservados (com
-- reserva ainda válida) que BATEM no horário. Sem horário informado (de um lado ou
-- do outro), considera que batem. Não devolve nenhum dado de cliente.
create or replace function privado.disponibilidade(p_data date, p_hora time, p_duracao numeric, p_ignorar uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cap     integer;
  v_padrao  numeric;
  v_ini     timestamp;
  v_fim     timestamp;
  v_bloq    public.bloqueios_agenda%rowtype;
  v_conf    integer := 0;
  v_res     integer := 0;
  v_lista   jsonb;
  v_ocup    integer;
begin
  if p_data is null then
    raise exception 'Informe a data.' using errcode = 'AU400';
  end if;
  select c.capacidade_simultanea, c.duracao_padrao_horas into v_cap, v_padrao from public.configuracoes c where c.unica limit 1;
  v_cap := coalesce(v_cap, 3);
  v_padrao := coalesce(v_padrao, 4);
  if p_hora is not null then
    v_ini := p_data + p_hora;
    v_fim := v_ini + make_interval(mins => (coalesce(p_duracao, v_padrao) * 60)::integer);
  end if;

  select * into v_bloq from public.bloqueios_agenda b where p_data between b.inicio and b.fim order by b.inicio limit 1;

  with candidatos as (
    select e.hora_inicio, e.duracao_horas, e.data,
           case when e.situacao_data = 'confirmada' then 'confirmada' else 'reservada' end as situacao,
           case
             when e.data = p_data and (p_hora is null or e.hora_inicio is null) then true
             when p_hora is null or e.hora_inicio is null then false
             else (e.data + e.hora_inicio) < v_fim
                  and v_ini < (e.data + e.hora_inicio) + make_interval(mins => (coalesce(e.duracao_horas, v_padrao) * 60)::integer)
           end as bate
      from public.eventos e
      join public.negocios n on n.id = e.negocio_id
     where e.data between p_data - 1 and p_data + 1
       and n.status <> 'perdido'
       and (p_ignorar is null or e.negocio_id <> p_ignorar)
       and (e.situacao_data = 'confirmada'
            or (e.situacao_data = 'reservada' and (e.reservada_ate is null or e.reservada_ate >= public.hoje_br())))
  )
  select count(*) filter (where c.bate and c.situacao = 'confirmada'),
         count(*) filter (where c.bate and c.situacao = 'reservada'),
         coalesce(jsonb_agg(jsonb_build_object('hora_inicio', to_char(c.hora_inicio, 'HH24:MI'), 'duracao_horas', c.duracao_horas,
                                               'situacao', c.situacao, 'bate_no_horario', c.bate)
                            order by c.hora_inicio nulls first) filter (where c.data = p_data), '[]'::jsonb)
    into v_conf, v_res, v_lista
    from candidatos c;

  v_ocup := v_conf + v_res;
  return jsonb_build_object(
    'data', p_data,
    'hora_inicio', to_char(p_hora, 'HH24:MI'),
    'capacidade', v_cap,
    'confirmados', v_conf,
    'reservados', v_res,
    'vagas', greatest(v_cap - v_ocup, 0),
    'bloqueada', v_bloq.id is not null,
    'motivo_bloqueio', v_bloq.motivo,
    'situacao', case when v_bloq.id is not null then 'bloqueada'
                     when v_ocup >= v_cap then 'lotada'
                     when v_ocup > 0 then 'parcial'
                     else 'livre' end,
    'eventos_no_dia', v_lista);
end;
$$;

create or replace function public.disponibilidade_data(p_data date, p_hora time default null, p_duracao numeric default null,
                                                       p_ignorar uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.meu_vendedor_id() is null then
    raise exception 'Faça login novamente.';
  end if;
  return privado.disponibilidade(p_data, p_hora, p_duracao, p_ignorar);
end;
$$;
revoke all on function public.disponibilidade_data(date, time, numeric, uuid) from public, anon;
grant execute on function public.disponibilidade_data(date, time, numeric, uuid) to authenticated;

-- =====================================================================
-- A6. NEGÓCIO: código curto do pedido e responsável pelo atendimento
-- =====================================================================
alter table public.negocios add column if not exists codigo            text;        -- ex.: A7K2Q9 (vai na mensagem do site)
alter table public.negocios add column if not exists atendimento       text not null default 'humano';
alter table public.negocios add column if not exists atendimento_desde timestamptz not null default now();
alter table public.negocios drop constraint if exists negocios_atendimento_ck;
alter table public.negocios add constraint negocios_atendimento_ck check (atendimento in ('humano', 'agente'));
create unique index if not exists negocios_codigo_uidx on public.negocios (codigo) where codigo is not null;
create index if not exists negocios_atendimento_idx on public.negocios (atendimento, status);

create or replace function privado.novo_codigo_negocio()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- sem 0/O e 1/I, para ditar por telefone
  v_codigo   text;
  i          integer;
begin
  loop
    v_codigo := 'A';
    for i in 1..5 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * 32)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.negocios n where n.codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

create or replace function public.negocio_codigo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or new.codigo = '' then
      new.codigo := privado.novo_codigo_negocio();
    end if;
  else
    new.codigo := old.codigo; -- o código nunca muda
  end if;
  return new;
end;
$$;
revoke all on function public.negocio_codigo() from public, anon, authenticated;
drop trigger if exists trg_negocios_0_codigo on public.negocios;
create trigger trg_negocios_0_codigo before insert or update on public.negocios
  for each row execute function public.negocio_codigo();

-- negócios que já existiam antes desta coluna
do $$
declare
  r record;
begin
  perform set_config('app.sem_auditoria', 'on', true);
  for r in select id from public.negocios where codigo is null loop
    update public.negocios set codigo = privado.novo_codigo_negocio() where id = r.id;
  end loop;
  perform set_config('app.sem_auditoria', '', true);
exception when others then
  perform set_config('app.sem_auditoria', '', true);
  raise;
end $$;

-- Pelo app, o responsável pelo atendimento só muda pela função transferir_atendimento()
-- (que registra quem passou, para quem e por quê).
-- SEM "security definer": current_user = quem chamou ('authenticated' = app).
create or replace function public.negocio_atendimento_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.atendimento := 'humano';
      new.atendimento_desde := now();
    else
      new.atendimento := old.atendimento;
      new.atendimento_desde := old.atendimento_desde;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.negocio_atendimento_guarda() from public, anon, authenticated;
drop trigger if exists trg_negocios_1_atendimento on public.negocios;
create trigger trg_negocios_1_atendimento before insert or update on public.negocios
  for each row execute function public.negocio_atendimento_guarda();

-- Histórico de etapas: o autor também pode ser o agente (redefine a função da base).
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
      values (new.id, new.funil_id, null, new.etapa_id, null, new.status, now(), public.ator_vendedor_id());
    elsif new.etapa_id is distinct from old.etapa_id or new.status is distinct from old.status then
      insert into public.historico_etapas (negocio_id, funil_id, de_etapa_id, para_etapa_id, de_status, para_status,
                                           movido_em, segundos_na_etapa, autor_id)
      values (new.id, new.funil_id, old.etapa_id, new.etapa_id, old.status, new.status, now(),
              case when old.status = 'aberto' then greatest(0, extract(epoch from now() - old.etapa_desde))::bigint end,
              public.ator_vendedor_id());
    end if;
  end if;

  if new.status = 'ganho' or (tg_op = 'UPDATE' and old.status = 'ganho') then
    perform public.calcular_comissao(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.negocio_depois() from public, anon, authenticated;

-- =====================================================================
-- A7. PROPOSTA DA AURORA
-- Situações: rascunho → aguardando_aprovacao → (ajustes_solicitados ↔) → aprovada → enviada → aceita | recusada
-- REGRA CENTRAL (vale para a tela, para a API do agente e para qualquer função):
--   * só o GESTOR HUMANO aprova;
--   * só proposta APROVADA pode ser enviada (e só a enviada abre o link público);
--   * conteúdo aprovado não muda: para alterar, reabre (volta a rascunho e perde a aprovação).
-- =====================================================================
alter table public.propostas add column if not exists origem            text not null default 'humano';
alter table public.propostas add column if not exists evento            jsonb not null default '{}'::jsonb; -- cópia dos dados do evento
alter table public.propostas add column if not exists cardapio          jsonb not null default '[]'::jsonb; -- drinks desta proposta
alter table public.propostas add column if not exists pacote_nome       text;
alter table public.propostas add column if not exists linha             text;
alter table public.propostas add column if not exists capa_titulo       text;
alter table public.propostas add column if not exists capa_subtitulo    text;
alter table public.propostas add column if not exists capa_foto_url     text;
alter table public.propostas add column if not exists apresentacao      text;
alter table public.propostas add column if not exists descricao_servico text;
alter table public.propostas add column if not exists mensagem_final    text;
alter table public.propostas add column if not exists foto_final_url    text;
alter table public.propostas add column if not exists entrada_pct             numeric(5,2);
alter table public.propostas add column if not exists entrada_dias_antes      integer;
alter table public.propostas add column if not exists saldo_dias_antes        integer;
alter table public.propostas add column if not exists cancelamento_aviso_dias integer;
alter table public.propostas add column if not exists cancelamento_multa_pct  numeric(5,2);
alter table public.propostas add column if not exists taxa_quebra             numeric(12,2);
alter table public.propostas add column if not exists foro                    text;
alter table public.propostas add column if not exists calculo           jsonb;                 -- memória de cálculo (interna, nunca vai ao cliente)
alter table public.propostas add column if not exists preco_pendente    boolean not null default false; -- o agente não tinha regra de preço: o gestor define
alter table public.propostas add column if not exists nota_interna      text;                  -- recado de quem montou para quem aprova
alter table public.propostas add column if not exists submetida_por     uuid references public.vendedores (id) on delete set null;
alter table public.propostas add column if not exists ajustes_comentario text;
alter table public.propostas add column if not exists ajustes_em        timestamptz;
alter table public.propostas add column if not exists ajustes_por       uuid references public.vendedores (id) on delete set null;

alter table public.propostas drop constraint if exists propostas_status_check;
alter table public.propostas add constraint propostas_status_check
  check (status in ('rascunho', 'aguardando_aprovacao', 'ajustes_solicitados', 'aprovada', 'enviada', 'aceita', 'recusada', 'substituida'));
-- A trava: aprovada, enviada ou aceita SÓ com aprovação registrada.
alter table public.propostas drop constraint if exists propostas_aprovacao_ck;
alter table public.propostas add constraint propostas_aprovacao_ck
  check (status not in ('aprovada', 'enviada', 'aceita') or aprovada_em is not null);
alter table public.propostas drop constraint if exists propostas_origem_ck;
alter table public.propostas add constraint propostas_origem_ck check (origem in ('humano', 'agente'));
alter table public.propostas drop constraint if exists propostas_linha_ck;
alter table public.propostas add constraint propostas_linha_ck check (linha is null or linha in ('tradicional', 'premium'));
alter table public.propostas drop constraint if exists propostas_aurora_json_ck;
alter table public.propostas add constraint propostas_aurora_json_ck
  check (jsonb_typeof(evento) = 'object' and jsonb_typeof(cardapio) = 'array' and jsonb_array_length(cardapio) <= 30);
alter table public.propostas drop constraint if exists propostas_aurora_textos_ck;
alter table public.propostas add constraint propostas_aurora_textos_ck check (
      (pacote_nome is null or char_length(pacote_nome) <= 80)
  and (capa_titulo is null or char_length(capa_titulo) <= 160)
  and (capa_subtitulo is null or char_length(capa_subtitulo) <= 240)
  and (capa_foto_url is null or (char_length(capa_foto_url) <= 500 and capa_foto_url ~ '^(https?://|/)'))
  and (apresentacao is null or char_length(apresentacao) <= 400)
  and (descricao_servico is null or char_length(descricao_servico) <= 400)
  and (mensagem_final is null or char_length(mensagem_final) <= 400)
  and (foto_final_url is null or (char_length(foto_final_url) <= 500 and foto_final_url ~ '^(https?://|/)'))
  and (nota_interna is null or char_length(nota_interna) <= 1000)
  and (ajustes_comentario is null or char_length(ajustes_comentario) <= 2000)
  and (foro is null or char_length(foro) <= 120));
alter table public.propostas drop constraint if exists propostas_aurora_condicoes_ck;
alter table public.propostas add constraint propostas_aurora_condicoes_ck check (
      (entrada_pct is null or entrada_pct between 0 and 100)
  and (entrada_dias_antes is null or entrada_dias_antes between 0 and 365)
  and (saldo_dias_antes is null or saldo_dias_antes between 0 and 365)
  and (cancelamento_aviso_dias is null or cancelamento_aviso_dias between 0 and 365)
  and (cancelamento_multa_pct is null or cancelamento_multa_pct between 0 and 100)
  and (taxa_quebra is null or taxa_quebra >= 0));

-- Número da proposta com o prefixo escolhido em Configurações (PROP-2026-0001).
create or replace function public.proximo_numero_proposta()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ano     int := extract(year from public.hoje_br())::int;
  v_seq     int;
  v_prefixo text;
begin
  insert into public.contadores (chave, valor) values ('proposta-' || v_ano, 1)
  on conflict (chave) do update set valor = public.contadores.valor + 1
  returning valor into v_seq;
  select c.prefixo_proposta into v_prefixo from public.configuracoes c where c.unica limit 1;
  return coalesce(v_prefixo, 'PROP') || '-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
revoke all on function public.proximo_numero_proposta() from public, anon, authenticated;

-- Regras de situação da proposta (redefine a função da base).
-- SEM "security definer": current_user = quem chamou ('authenticated' = app; dono = funções do banco).
create or replace function public.proposta_antes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_app      boolean := current_user in ('authenticated', 'anon');
  v_gestor   boolean := false;
  v_conteudo boolean;
begin
  if tg_op = 'INSERT' then
    if v_app then
      new.status := 'rascunho';
      new.origem := 'humano';
      new.subtotal := 0; new.desconto_total := 0; new.total := 0; new.precisa_aprovacao := false;
      new.aprovacao_pedida_em := null; new.submetida_por := null;
      new.aprovada_em := null; new.aprovada_por := null; new.enviada_em := null; new.aceita_em := null;
      new.ajustes_comentario := null; new.ajustes_em := null; new.ajustes_por := null;
      new.visualizada_em := null; new.visualizacoes := 0;
      new.aceite_nome := null; new.aceite_ip := null; new.aceite_navegador := null; new.aceite_via := null;
    end if;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------
  v_conteudo := (new.titulo, new.validade, new.condicoes_pagamento, new.prazo_entrega, new.observacoes, new.evento, new.cardapio,
                 new.pacote_nome, new.linha, new.capa_titulo, new.capa_subtitulo, new.capa_foto_url, new.apresentacao,
                 new.descricao_servico, new.mensagem_final, new.foto_final_url, new.entrada_pct, new.entrada_dias_antes,
                 new.saldo_dias_antes, new.cancelamento_aviso_dias, new.cancelamento_multa_pct, new.taxa_quebra, new.foro)
                is distinct from
                (old.titulo, old.validade, old.condicoes_pagamento, old.prazo_entrega, old.observacoes, old.evento, old.cardapio,
                 old.pacote_nome, old.linha, old.capa_titulo, old.capa_subtitulo, old.capa_foto_url, old.apresentacao,
                 old.descricao_servico, old.mensagem_final, old.foto_final_url, old.entrada_pct, old.entrada_dias_antes,
                 old.saldo_dias_antes, old.cancelamento_aviso_dias, old.cancelamento_multa_pct, old.taxa_quebra, old.foro);

  if v_app then
    if old.status = 'aceita' then
      raise exception 'Proposta aceita não pode ser alterada.';
    end if;
    if old.status = 'substituida' then
      raise exception 'Esta versão foi substituída por uma mais nova. Edite a versão atual.';
    end if;
    v_gestor := public.sou_gestor();

    -- campos calculados/controlados pelo banco: o app não muda
    new.numero := old.numero; new.versao := old.versao; new.codigo := old.codigo; new.negocio_id := old.negocio_id;
    new.vendedor_id := old.vendedor_id; new.origem := old.origem;
    new.subtotal := old.subtotal; new.desconto_total := old.desconto_total; new.total := old.total;
    new.precisa_aprovacao := old.precisa_aprovacao; new.preco_pendente := old.preco_pendente;
    new.enviada_em := old.enviada_em;
    new.visualizada_em := old.visualizada_em; new.visualizacoes := old.visualizacoes;
    new.aceite_ip := old.aceite_ip; new.aceite_navegador := old.aceite_navegador; new.aceite_via := old.aceite_via;
    new.aceita_em := old.aceita_em;
    new.aprovada_em := old.aprovada_em; new.aprovada_por := old.aprovada_por;
    new.aprovacao_pedida_em := old.aprovacao_pedida_em; new.submetida_por := old.submetida_por;
    new.ajustes_em := old.ajustes_em; new.ajustes_por := old.ajustes_por;
    if new.status is not distinct from old.status or new.status <> 'ajustes_solicitados' then
      new.ajustes_comentario := old.ajustes_comentario;
    end if;

    if v_conteudo and old.status = 'aguardando_aprovacao' and not v_gestor then
      raise exception 'A proposta está aguardando aprovação: só o gestor altera. Retire o pedido de aprovação para editar.';
    end if;

    if new.status is distinct from old.status then
      if not (
           (old.status = 'rascunho' and new.status in ('aguardando_aprovacao', 'aprovada', 'substituida'))
        or (old.status = 'ajustes_solicitados' and new.status in ('aguardando_aprovacao', 'aprovada', 'rascunho', 'substituida'))
        or (old.status = 'aguardando_aprovacao' and new.status in ('aprovada', 'ajustes_solicitados', 'rascunho', 'substituida'))
        or (old.status = 'aprovada' and new.status in ('enviada', 'rascunho', 'substituida'))
        or (old.status = 'enviada' and new.status in ('aceita', 'recusada', 'substituida'))
        or (old.status = 'recusada' and new.status = 'substituida')
      ) then
        raise exception 'Mudança de situação não permitida (% → %).', old.status, new.status;
      end if;

      if new.status = 'aguardando_aprovacao' then
        new.aprovacao_pedida_em := now();
        new.submetida_por := public.meu_vendedor_id();
      elsif new.status = 'aprovada' then
        if not v_gestor then
          raise exception 'Só o gestor aprova propostas.';
        end if;
        new.aprovada_em := now();
        new.aprovada_por := public.meu_vendedor_id();
      elsif new.status = 'ajustes_solicitados' then
        if not v_gestor then
          raise exception 'Só o gestor pede ajustes.';
        end if;
        if new.ajustes_comentario is null or char_length(trim(new.ajustes_comentario)) < 3 then
          raise exception 'Escreva o que precisa ser ajustado.';
        end if;
        new.ajustes_comentario := trim(new.ajustes_comentario);
        new.ajustes_em := now();
        new.ajustes_por := public.meu_vendedor_id();
      elsif new.status = 'aceita' then -- aceite registrado pela equipe (cliente aceitou por telefone/mensagem)
        new.aceita_em := now();
        new.aceite_via := 'manual';
        new.aceite_nome := coalesce(nullif(trim(new.aceite_nome), ''), 'Registrado pela equipe');
      end if;
    end if;
  end if;

  -- REGRAS QUE VALEM PARA TODOS OS CAMINHOS (tela, API do agente, funções) ----------
  if v_conteudo and old.status not in ('rascunho', 'ajustes_solicitados', 'aguardando_aprovacao') then
    raise exception 'Proposta já aprovada ou enviada: reabra a proposta (antes do envio) ou crie uma nova versão para alterar.';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'aprovada' then
      if new.aprovada_por is null or not exists (
           select 1 from public.vendedores v
            where v.id = new.aprovada_por and v.papel = 'gestor' and v.tipo = 'humano' and v.ativo) then
        raise exception 'Só o gestor aprova propostas.';
      end if;
      if old.total <= 0 then
        raise exception 'Defina o valor da proposta antes de aprovar.';
      end if;
      new.aprovada_em := coalesce(new.aprovada_em, now());
    end if;
    if new.status = 'enviada' then
      if old.status <> 'aprovada' then
        raise exception 'A proposta só pode ser enviada ao cliente depois de aprovada pelo gestor.';
      end if;
      if old.total <= 0 then
        raise exception 'A proposta precisa ter valor total maior que zero para ser enviada.';
      end if;
      if new.validade < public.hoje_br() then
        raise exception 'A validade da proposta já passou. Reabra, ajuste a validade e aprove de novo.';
      end if;
      new.enviada_em := coalesce(new.enviada_em, now());
    end if;
    if new.status = 'aceita' and old.status <> 'enviada' then
      raise exception 'Só uma proposta enviada pode ser aceita.';
    end if;
    -- voltou para trás: a aprovação anterior deixa de valer
    if new.status in ('rascunho', 'ajustes_solicitados', 'aguardando_aprovacao') then
      new.aprovada_em := null;
      new.aprovada_por := null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proposta_antes() from public, anon, authenticated;

-- ITENS: só mudam enquanto a proposta pode ser editada (redefine a função da base).
create or replace function public.proposta_item_antes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_existe boolean;
  v_prod   public.produtos%rowtype;
begin
  select p.status, true into v_status, v_existe from public.propostas p where p.id = coalesce(new.proposta_id, old.proposta_id);
  -- (proposta sendo excluída junto com os itens: v_existe fica nulo e a exclusão segue)
  if v_existe and v_status not in ('rascunho', 'ajustes_solicitados', 'aguardando_aprovacao') then
    raise exception 'Proposta já aprovada ou enviada: reabra a proposta ou crie uma nova versão para alterar os itens.';
  end if;
  if v_existe and v_status = 'aguardando_aprovacao' and current_user in ('authenticated', 'anon') and not public.sou_gestor() then
    raise exception 'A proposta está aguardando aprovação: só o gestor altera os itens.';
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
  new.desconto_limite := 100;   -- na Aurora toda proposta passa pelo gestor: não há limite por item
  new.acima_limite := false;
  return new;
end;
$$;
revoke all on function public.proposta_item_antes() from public, anon, authenticated;

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
         precisa_aprovacao = false,
         preco_pendente    = p.preco_pendente and t.total <= 0
    from (select coalesce(sum(round(i.quantidade * i.preco_unitario, 2)), 0) as subtotal,
                 coalesce(sum(i.total), 0) as total
            from public.proposta_itens i where i.proposta_id = v_id) t
   where p.id = v_id;
  return null;
end;
$$;
revoke all on function public.proposta_item_depois() from public, anon, authenticated;

drop policy if exists "propostas_delete" on public.propostas;
create policy "propostas_delete" on public.propostas for delete to authenticated
  using (public.pode_editar_negocio(negocio_id) and status in ('rascunho', 'ajustes_solicitados', 'aguardando_aprovacao'));

-- Histórico de decisões de cada proposta (preenchido SÓ pelo banco).
create table if not exists public.proposta_revisoes (
  id          uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas (id) on delete cascade,
  de_status   text,
  para_status text not null,
  comentario  text,
  autor_id    uuid references public.vendedores (id) on delete set null,
  autor_tipo  text not null default 'sistema',
  created_at  timestamptz not null default now()
);
create index if not exists proposta_revisoes_proposta_idx on public.proposta_revisoes (proposta_id, created_at);
alter table public.proposta_revisoes enable row level security;
drop policy if exists "proposta_revisoes_select" on public.proposta_revisoes;
create policy "proposta_revisoes_select" on public.proposta_revisoes for select to authenticated
  using (public.pode_ver_proposta(proposta_id));

-- Depois de gravar a proposta: histórico de decisões, reserva da data, negócio ganho no aceite e avisos.
create or replace function public.proposta_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    insert into public.proposta_revisoes (proposta_id, de_status, para_status, autor_id, autor_tipo)
    values (new.id, null, new.status, public.ator_vendedor_id(), public.ator_tipo());
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.proposta_revisoes (proposta_id, de_status, para_status, comentario, autor_id, autor_tipo)
    values (new.id, old.status, new.status,
            case when new.status = 'ajustes_solicitados' then new.ajustes_comentario
                 when new.status = 'aguardando_aprovacao' then new.nota_interna end,
            public.ator_vendedor_id(), public.ator_tipo());

    -- proposta enviada reserva a data (até a validade); recusada libera
    if new.status = 'enviada' then
      update public.eventos e set situacao_data = 'reservada', reservada_ate = new.validade
       where e.negocio_id = new.negocio_id and e.data is not null and e.situacao_data in ('consulta', 'liberada', 'reservada');
    elsif new.status = 'recusada' then
      update public.eventos e set situacao_data = 'liberada'
       where e.negocio_id = new.negocio_id and e.situacao_data = 'reservada'
         and not exists (select 1 from public.propostas x where x.negocio_id = new.negocio_id and x.id <> new.id and x.status = 'enviada');
    end if;

    -- aceita: os itens viram os produtos do negócio e o negócio é marcado como GANHO
    if new.status = 'aceita' then
      delete from public.negocio_produtos where negocio_id = new.negocio_id;
      insert into public.negocio_produtos (negocio_id, produto_id, descricao, quantidade, preco_unitario, desconto_pct, ordem)
      select new.negocio_id, i.produto_id, i.descricao, i.quantidade, i.preco_unitario, i.desconto_pct, i.ordem
        from public.proposta_itens i where i.proposta_id = new.id;
      update public.negocios
         set status = 'ganho', valor = new.total
       where id = new.negocio_id and (status <> 'ganho' or valor <> new.total);
    end if;

    v_tipo := case new.status
      when 'aguardando_aprovacao' then 'proposta.submetida'
      when 'aprovada' then 'proposta.aprovada'
      when 'ajustes_solicitados' then 'proposta.ajustes_solicitados'
      when 'enviada' then 'proposta.enviada'
      when 'aceita' then 'proposta.aceita'
      when 'recusada' then 'proposta.recusada'
    end;
    if v_tipo is not null then
      perform privado.emitir_evento(v_tipo, new.negocio_id, new.id, null,
        jsonb_build_object('numero', new.numero, 'versao', new.versao, 'status', new.status, 'total', new.total,
                           'comentario', case when new.status = 'ajustes_solicitados' then new.ajustes_comentario end));
    end if;
  elsif old.visualizada_em is null and new.visualizada_em is not null then
    perform privado.emitir_evento('proposta.visualizada', new.negocio_id, new.id, null,
      jsonb_build_object('numero', new.numero, 'versao', new.versao));
  end if;
  return null;
end;
$$;
revoke all on function public.proposta_depois() from public, anon, authenticated;
drop trigger if exists trg_propostas_depois on public.propostas;
create trigger trg_propostas_depois after insert or update on public.propostas
  for each row execute function public.proposta_depois();

-- (Re)preenche uma proposta com o que vem do negócio: dados do evento, cardápio,
-- descrição do serviço e o item de preço pela calculadora.
--   p_origem = 'humano' → usa o preço da calculadora sempre que a conta fechar;
--   p_origem = 'agente' → só usa preço se as regras estiverem APROVADAS; senão fica "preço pendente".
--   p_drinks = cardápio escolhido; vazio = mantém o cardápio atual ou, se não houver, o do pacote.
create or replace function privado.preencher_proposta(p_id uuid, p_origem text, p_drinks uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p     public.propostas%rowtype;
  v_ev    public.eventos%rowtype;
  v_cfg   public.configuracoes%rowtype;
  v_pac   public.pacotes%rowtype;
  v_ids   uuid[];
  v_card  jsonb;
  v_calc  jsonb;
  v_preco numeric := 0;
  v_desc  text;
  v_det   text;
begin
  select * into v_p from public.propostas where id = p_id;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'AU404';
  end if;
  select * into v_ev from public.eventos where negocio_id = v_p.negocio_id;
  select * into v_cfg from public.configuracoes where unica limit 1;
  if v_ev.pacote_id is not null then
    select * into v_pac from public.pacotes where id = v_ev.pacote_id;
  end if;

  if p_drinks is not null and array_length(p_drinks, 1) is not null then
    select array_agg(d.id order by array_position(p_drinks, d.id)) into v_ids
      from public.drinks d where d.id = any(p_drinks) and d.ativo;
  elsif jsonb_array_length(v_p.cardapio) > 0 then
    select array_agg(d.id order by c.ord) into v_ids
      from jsonb_array_elements(v_p.cardapio) with ordinality c(item, ord)
      join public.drinks d on d.id::text = c.item ->> 'drink_id' and d.ativo;
  elsif v_pac.id is not null then
    select array_agg(pd.drink_id order by pd.ordem) into v_ids
      from public.pacote_drinks pd join public.drinks d on d.id = pd.drink_id and d.ativo
     where pd.pacote_id = v_pac.id;
  end if;
  v_ids := coalesce(v_ids, '{}');

  select coalesce(jsonb_agg(jsonb_build_object('drink_id', d.id, 'nome', d.nome, 'descricao', d.descricao, 'foto_url', d.foto_url,
                                               'alcoolico', d.alcoolico, 'copo', d.copo, 'categoria', d.categoria)
                            order by array_position(v_ids, d.id)), '[]'::jsonb)
    into v_card
    from public.drinks d where d.id = any(v_ids);

  if v_ev.convidados is not null and v_ev.duracao_horas is not null and array_length(v_ids, 1) is not null then
    v_calc := privado.calcular_preco(jsonb_build_object(
      'pacote_id', v_pac.id, 'drinks', to_jsonb(v_ids), 'convidados', v_ev.convidados, 'duracao_horas', v_ev.duracao_horas,
      'linha', coalesce(v_ev.linha, 'tradicional'),
      'outra_cidade', v_ev.cidade is not null and v_cfg.cidade is not null
                      and lower(trim(v_ev.cidade)) <> lower(trim(split_part(v_cfg.cidade, '/', 1)))));
    if (v_calc ->> 'ok')::boolean and (p_origem = 'humano' or (v_calc ->> 'aprovada')::boolean) then
      v_preco := (v_calc ->> 'preco_sugerido')::numeric;
    end if;
  end if;

  if v_ev.duracao_horas is not null and jsonb_array_length(v_card) > 0 then
    v_desc := replace(trim(trailing '.' from to_char(v_ev.duracao_horas, 'FM990.9')), '.', ',')
              || case when v_ev.duracao_horas = 1 then ' hora' else ' horas' end || ' de atendimento com '
              || case jsonb_array_length(v_card) when 1 then 'a opção' else 'as ' || jsonb_array_length(v_card) || ' opções' end
              || ' do cardápio, preparo na hora e gestão dos insumos.';
  end if;
  v_det := concat_ws(' · ',
    case when v_ev.convidados is not null then v_ev.convidados || ' convidados' else v_ev.convidados_faixa end,
    case when v_ev.duracao_horas is not null
         then replace(trim(trailing '.' from to_char(v_ev.duracao_horas, 'FM990.9')), '.', ',')
              || case when v_ev.duracao_horas = 1 then ' hora de serviço' else ' horas de serviço' end end);

  update public.propostas
     set evento = jsonb_strip_nulls(jsonb_build_object(
           'tipo', v_ev.tipo, 'nome', v_ev.nome, 'data', v_ev.data, 'mes_previsto', v_ev.mes_previsto,
           'hora_inicio', to_char(v_ev.hora_inicio, 'HH24:MI'), 'duracao_horas', v_ev.duracao_horas,
           'cidade', v_ev.cidade, 'uf', coalesce(v_ev.uf, v_cfg.uf), 'local', v_ev.local,
           'convidados', v_ev.convidados, 'convidados_faixa', v_ev.convidados_faixa)),
         cardapio = v_card,
         pacote_nome = v_pac.nome,
         linha = coalesce(v_ev.linha, 'tradicional'),
         descricao_servico = v_desc,
         calculo = v_calc,
         preco_pendente = v_preco <= 0
   where id = p_id;

  delete from public.proposta_itens where proposta_id = p_id;
  insert into public.proposta_itens (proposta_id, descricao, detalhes, unidade, quantidade, preco_unitario, ordem)
  values (p_id, left('Serviço de bar e coquetelaria' || coalesce(' — pacote ' || v_pac.nome, ''), 200),
          nullif(v_det, ''), 'evento', 1, v_preco, 1);
  -- (o gatilho dos itens recalcula o total; "preço pendente" vale enquanto o total for zero)
  update public.propostas set preco_pendente = (total <= 0) where id = p_id;
end;
$$;

-- Cria uma proposta nova para o negócio (casca com condições padrão) e preenche.
create or replace function privado.montar_proposta(p_negocio uuid, p_origem text, p_drinks uuid[] default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n   public.negocios%rowtype;
  v_cfg public.configuracoes%rowtype;
  v_id  uuid;
begin
  select * into v_n from public.negocios where id = p_negocio;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = 'AU404';
  end if;
  select * into v_cfg from public.configuracoes where unica limit 1;
  insert into public.eventos (negocio_id) values (p_negocio) on conflict (negocio_id) do nothing;

  insert into public.propostas (
    negocio_id, numero, titulo, validade, condicoes_pagamento, origem, capa_titulo, capa_subtitulo,
    entrada_pct, entrada_dias_antes, saldo_dias_antes, cancelamento_aviso_dias, cancelamento_multa_pct, taxa_quebra, foro)
  values (
    v_n.id, '', left('Proposta — ' || v_n.titulo, 120), public.hoje_br() + coalesce(v_cfg.validade_proposta_dias, 15),
    v_cfg.condicoes_padrao, p_origem,
    coalesce(nullif(v_cfg.proposta_textos ->> 'capa_titulo', ''), 'Um brinde ao seu melhor momento.'),
    coalesce(nullif(v_cfg.proposta_textos ->> 'capa_subtitulo', ''), 'Drinks preparados com cuidado para celebrar uma data especial.'),
    v_cfg.entrada_pct, v_cfg.entrada_dias_antes, v_cfg.saldo_dias_antes, v_cfg.cancelamento_aviso_dias,
    v_cfg.cancelamento_multa_pct, v_cfg.taxa_quebra, v_cfg.foro)
  returning id into v_id;

  perform privado.preencher_proposta(v_id, p_origem, p_drinks);
  return v_id;
end;
$$;

-- Tela: "Nova proposta" no negócio (redefine a função da base).
create or replace function public.criar_proposta(p_negocio_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode_editar_negocio(p_negocio_id) then
    raise exception 'Negócio não encontrado ou sem permissão.';
  end if;
  return privado.montar_proposta(p_negocio_id, 'humano', null);
end;
$$;
revoke all on function public.criar_proposta(uuid) from public, anon;
grant execute on function public.criar_proposta(uuid) to authenticated;

-- Salva cabeçalho + itens da proposta de uma vez, tudo ou nada (redefine a função da base).
-- "security invoker": as regras de acesso de quem chamou continuam valendo.
create or replace function public.salvar_proposta(p_id uuid, p_dados jsonb, p_itens jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item  jsonb;
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
         observacoes         = nullif(p_dados ->> 'observacoes', ''),
         evento              = case when jsonb_typeof(p_dados -> 'evento') = 'object' then jsonb_strip_nulls(p_dados -> 'evento') else evento end,
         cardapio            = case when jsonb_typeof(p_dados -> 'cardapio') = 'array' then p_dados -> 'cardapio' else cardapio end,
         pacote_nome         = nullif(p_dados ->> 'pacote_nome', ''),
         linha               = coalesce(nullif(p_dados ->> 'linha', ''), linha),
         capa_titulo         = nullif(p_dados ->> 'capa_titulo', ''),
         capa_subtitulo      = nullif(p_dados ->> 'capa_subtitulo', ''),
         capa_foto_url       = nullif(p_dados ->> 'capa_foto_url', ''),
         apresentacao        = nullif(p_dados ->> 'apresentacao', ''),
         descricao_servico   = nullif(p_dados ->> 'descricao_servico', ''),
         mensagem_final      = nullif(p_dados ->> 'mensagem_final', ''),
         foto_final_url      = nullif(p_dados ->> 'foto_final_url', ''),
         entrada_pct             = nullif(p_dados ->> 'entrada_pct', '')::numeric,
         entrada_dias_antes      = nullif(p_dados ->> 'entrada_dias_antes', '')::integer,
         saldo_dias_antes        = nullif(p_dados ->> 'saldo_dias_antes', '')::integer,
         cancelamento_aviso_dias = nullif(p_dados ->> 'cancelamento_aviso_dias', '')::integer,
         cancelamento_multa_pct  = nullif(p_dados ->> 'cancelamento_multa_pct', '')::numeric,
         taxa_quebra             = nullif(p_dados ->> 'taxa_quebra', '')::numeric,
         foro                    = nullif(p_dados ->> 'foro', ''),
         nota_interna            = nullif(p_dados ->> 'nota_interna', ''),
         calculo                 = case when p_dados ? 'calculo' then nullif(p_dados -> 'calculo', 'null'::jsonb) else calculo end
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

-- Copia o conteúdo de uma proposta para outra (uso interno: nova versão e duplicar).
create or replace function privado.copiar_conteudo_proposta(p_de uuid, p_para uuid, p_com_evento boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.propostas%rowtype;
begin
  select * into v from public.propostas where id = p_de;
  update public.propostas
     set condicoes_pagamento = v.condicoes_pagamento, prazo_entrega = v.prazo_entrega, observacoes = v.observacoes,
         evento = case when p_com_evento then v.evento else evento end,
         cardapio = v.cardapio,
         pacote_nome = case when p_com_evento then v.pacote_nome else coalesce(pacote_nome, v.pacote_nome) end,
         linha = v.linha,
         capa_titulo = v.capa_titulo, capa_subtitulo = v.capa_subtitulo,
         capa_foto_url = case when p_com_evento then v.capa_foto_url else capa_foto_url end,
         apresentacao = case when p_com_evento then v.apresentacao else apresentacao end,
         descricao_servico = case when p_com_evento then v.descricao_servico else coalesce(descricao_servico, v.descricao_servico) end,
         mensagem_final = case when p_com_evento then v.mensagem_final else mensagem_final end,
         foto_final_url = case when p_com_evento then v.foto_final_url else foto_final_url end,
         entrada_pct = v.entrada_pct, entrada_dias_antes = v.entrada_dias_antes, saldo_dias_antes = v.saldo_dias_antes,
         cancelamento_aviso_dias = v.cancelamento_aviso_dias, cancelamento_multa_pct = v.cancelamento_multa_pct,
         taxa_quebra = v.taxa_quebra, foro = v.foro,
         calculo = case when p_com_evento then v.calculo else calculo end
   where id = p_para;
end;
$$;

-- Nova versão: copia a proposta (v+1, mesmo número) e marca a anterior como substituída (redefine a da base).
create or replace function public.nova_versao_proposta(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p      public.propostas%rowtype;
  v_novo   uuid;
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
  insert into public.propostas (negocio_id, numero, versao, titulo, validade, origem)
  values (v_p.negocio_id, v_p.numero, v_versao, v_p.titulo, greatest(v_p.validade, public.hoje_br()), 'humano')
  returning id into v_novo;
  perform privado.copiar_conteudo_proposta(v_p.id, v_novo, true);
  insert into public.proposta_itens (proposta_id, produto_id, descricao, detalhes, unidade, quantidade, preco_unitario, desconto_pct, ordem)
  select v_novo, i.produto_id, i.descricao, i.detalhes, i.unidade, i.quantidade, i.preco_unitario, i.desconto_pct, i.ordem
    from public.proposta_itens i where i.proposta_id = v_p.id;
  update public.propostas set status = 'substituida' where id = v_p.id;
  return v_novo;
end;
$$;
revoke all on function public.nova_versao_proposta(uuid) from public, anon;
grant execute on function public.nova_versao_proposta(uuid) to authenticated;

-- Duplicar para OUTRO negócio: número novo, dados do evento do negócio de destino,
-- cardápio, textos, condições e itens copiados da proposta de origem.
create or replace function public.duplicar_proposta(p_id uuid, p_negocio_destino uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo uuid;
  v_ids  uuid[];
begin
  if not public.pode_ver_proposta(p_id) or not public.pode_editar_negocio(p_negocio_destino) then
    raise exception 'Proposta ou negócio não encontrado, ou sem permissão.';
  end if;
  select array_agg((x ->> 'drink_id')::uuid) into v_ids
    from public.propostas p, jsonb_array_elements(p.cardapio) x
   where p.id = p_id and (x ->> 'drink_id') ~ '^[0-9a-fA-F-]{36}$';
  v_novo := privado.montar_proposta(p_negocio_destino, 'humano', v_ids);
  perform privado.copiar_conteudo_proposta(p_id, v_novo, false);
  delete from public.proposta_itens where proposta_id = v_novo;
  insert into public.proposta_itens (proposta_id, produto_id, descricao, detalhes, unidade, quantidade, preco_unitario, desconto_pct, ordem)
  select v_novo, i.produto_id, i.descricao, i.detalhes, i.unidade, i.quantidade, i.preco_unitario, i.desconto_pct, i.ordem
    from public.proposta_itens i where i.proposta_id = p_id;
  return v_novo;
end;
$$;
revoke all on function public.duplicar_proposta(uuid, uuid) from public, anon;
grant execute on function public.duplicar_proposta(uuid, uuid) to authenticated;

-- LINK PÚBLICO (redefine as funções da base). Só propostas já ENVIADAS aparecem.
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
  if not found or v_p.status not in ('enviada', 'aceita', 'recusada', 'substituida') then
    return null;
  end if;

  if v_p.status = 'enviada' then -- registra que o cliente abriu
    perform set_config('app.ator', 'cliente', true);
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
      'aceita_em', v_p.aceita_em, 'aceite_nome', v_p.aceite_nome,
      'evento', v_p.evento, 'cardapio', v_p.cardapio, 'pacote_nome', v_p.pacote_nome, 'linha', v_p.linha,
      'capa_titulo', v_p.capa_titulo, 'capa_subtitulo', v_p.capa_subtitulo, 'capa_foto_url', v_p.capa_foto_url,
      'apresentacao', v_p.apresentacao, 'descricao_servico', v_p.descricao_servico,
      'mensagem_final', v_p.mensagem_final, 'foto_final_url', v_p.foto_final_url,
      'entrada_pct', v_p.entrada_pct, 'entrada_dias_antes', v_p.entrada_dias_antes, 'saldo_dias_antes', v_p.saldo_dias_antes,
      'cancelamento_aviso_dias', v_p.cancelamento_aviso_dias, 'cancelamento_multa_pct', v_p.cancelamento_multa_pct,
      'taxa_quebra', v_p.taxa_quebra, 'foro', v_p.foro),
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
    'vendedor', null,
    'empresa', (
      select jsonb_build_object('nome', coalesce(nullif(trim(c.nome_exibicao), ''), c.nome_negocio), 'documento', c.documento,
                                'whatsapp', c.whatsapp, 'email', c.email, 'site', c.site, 'endereco', c.endereco,
                                'cidade', c.cidade, 'uf', c.uf, 'instagram', c.instagram, 'responsavel', c.responsavel,
                                'rodape', c.rodape_proposta, 'textos', c.proposta_textos, 'fotos', c.proposta_fotos)
        from public.configuracoes c where c.unica limit 1))
  into v_res;
  return v_res;
end;
$$;
revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;

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
  if not found or v_p.status not in ('enviada', 'aceita', 'recusada', 'substituida') then
    return jsonb_build_object('ok', false, 'mensagem', 'Proposta não encontrada.');
  end if;
  if v_p.status = 'aceita' then
    return jsonb_build_object('ok', true, 'ja_aceita', true,
      'mensagem', 'Esta proposta já foi aceita em ' || to_char(v_p.aceita_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || '.');
  end if;
  if v_p.status = 'substituida' then
    return jsonb_build_object('ok', false, 'mensagem', 'Existe uma versão mais nova desta proposta. Peça o link atualizado.');
  end if;
  if v_p.status = 'recusada' then
    return jsonb_build_object('ok', false, 'mensagem', 'Esta proposta foi encerrada. Fale com a gente para uma nova.');
  end if;
  if v_p.validade < public.hoje_br() then
    return jsonb_build_object('ok', false, 'mensagem', 'A validade desta proposta acabou. Peça uma atualizada.');
  end if;
  if v_p.total <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Proposta sem valor. Fale com a gente.');
  end if;
  if exists (select 1 from public.propostas x where x.negocio_id = v_p.negocio_id and x.status = 'aceita') then
    return jsonb_build_object('ok', false, 'mensagem', 'Outra proposta deste pedido já foi aceita. Fale com a gente.');
  end if;

  begin
    v_ip := nullif(trim(p_ip), '')::inet;
  exception when others then
    v_ip := null;
  end;

  perform set_config('app.ator', 'cliente', true);
  update public.propostas
     set status = 'aceita', aceita_em = now(), aceite_nome = v_nome, aceite_ip = v_ip,
         aceite_navegador = left(p_navegador, 300), aceite_via = 'link'
   where id = v_p.id;

  return jsonb_build_object('ok', true, 'mensagem', 'Proposta aceita! Já fomos avisados e vamos entrar em contato para os próximos passos.');
end;
$$;
revoke all on function public.aceitar_proposta_publica(text, text, text, text) from public;
grant execute on function public.aceitar_proposta_publica(text, text, text, text) to anon, authenticated;

-- =====================================================================
-- A8. AVISOS (webhooks): fila de eventos + entregas com novas tentativas
-- Cada fato importante vira uma linha em eventos_saida. O agente recebe de dois jeitos:
--   1. o sistema CHAMA o endereço cadastrado (webhook), com assinatura; e
--   2. o agente PERGUNTA "o que aconteceu desde o evento N?" pela API (nada se perde).
-- O envio usa a extensão pg_net do Supabase. Sem ela, só o caminho 2 funciona.
-- =====================================================================
create table if not exists public.eventos_saida (
  id          bigint generated always as identity primary key,
  tipo        text not null,
  negocio_id  uuid,
  proposta_id uuid,
  contato_id  uuid,
  dados       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists eventos_saida_data_idx on public.eventos_saida (created_at desc);

create table if not exists public.webhooks (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 60),
  url        text not null check (char_length(url) <= 500 and url ~ '^https?://[^[:space:]]+$'),
  segredo    text not null default encode(gen_random_bytes(24), 'hex') check (char_length(segredo) between 16 and 128),
  eventos    text[] not null default '{}',   -- vazio = todos os tipos
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_webhooks_updated_at on public.webhooks;
create trigger trg_webhooks_updated_at before update on public.webhooks
  for each row execute function public.set_updated_at();

create table if not exists public.webhook_entregas (
  id                   bigint generated always as identity primary key,
  evento_id            bigint not null references public.eventos_saida (id) on delete cascade,
  webhook_id           uuid not null references public.webhooks (id) on delete cascade,
  status               text not null default 'pendente' check (status in ('pendente', 'enviando', 'entregue', 'falhou', 'desistiu')),
  tentativas           integer not null default 0,
  pedido_id            bigint,          -- id do pedido no pg_net
  http_status          integer,
  erro                 text,
  proxima_tentativa_em timestamptz not null default now(),
  entregue_em          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (evento_id, webhook_id)
);
create index if not exists webhook_entregas_fila_idx on public.webhook_entregas (status, proxima_tentativa_em);
drop trigger if exists trg_webhook_entregas_updated_at on public.webhook_entregas;
create trigger trg_webhook_entregas_updated_at before update on public.webhook_entregas
  for each row execute function public.set_updated_at();

alter table public.eventos_saida enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_entregas enable row level security;
drop policy if exists "eventos_saida_select" on public.eventos_saida;
create policy "eventos_saida_select" on public.eventos_saida for select to authenticated using (public.sou_gestor());
drop policy if exists "webhook_entregas_select" on public.webhook_entregas;
create policy "webhook_entregas_select" on public.webhook_entregas for select to authenticated using (public.sou_gestor());
drop policy if exists "webhooks_select" on public.webhooks;
create policy "webhooks_select" on public.webhooks for select to authenticated using (public.sou_gestor());
drop policy if exists "webhooks_insert" on public.webhooks;
create policy "webhooks_insert" on public.webhooks for insert to authenticated with check (public.sou_gestor());
drop policy if exists "webhooks_update" on public.webhooks;
create policy "webhooks_update" on public.webhooks for update to authenticated
  using (public.sou_gestor()) with check (public.sou_gestor());
drop policy if exists "webhooks_delete" on public.webhooks;
create policy "webhooks_delete" on public.webhooks for delete to authenticated using (public.sou_gestor());

-- Extensões do Supabase para o envio (ignoradas onde não existirem).
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponível: os avisos ficam só na fila (o agente consulta pela API).';
end $$;

-- Assinatura do aviso: HMAC-SHA256 de "<momento>.<corpo>" com o segredo do webhook.
create or replace function privado.assinar(p_segredo text, p_momento bigint, p_corpo text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(hmac(p_momento::text || '.' || p_corpo, p_segredo, 'sha256'), 'hex');
$$;

-- Corpo do aviso (o mesmo formato devolvido pela API em "eventos").
create or replace function privado.json_evento_saida(e public.eventos_saida)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('id', e.id, 'tipo', e.tipo, 'criado_em', e.created_at, 'negocio_id', e.negocio_id,
                            'proposta_id', e.proposta_id, 'contato_id', e.contato_id, 'dados', e.dados);
$$;

-- Envia o que está na fila (pendentes e falhas que já podem tentar de novo).
create or replace function privado.despachar_webhooks()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r         record;
  v_corpo   jsonb;
  v_momento bigint;
  v_pedido  bigint;
  v_n       integer := 0;
begin
  if to_regproc('net.http_post') is null then
    return 0;
  end if;
  for r in
    select en.id, en.tentativas, w.url, w.segredo, ev as evento
      from public.webhook_entregas en
      join public.webhooks w on w.id = en.webhook_id and w.ativo
      join public.eventos_saida ev on ev.id = en.evento_id
     where en.status in ('pendente', 'falhou') and en.proxima_tentativa_em <= now()
     order by en.id
     limit 50
     for update of en skip locked
  loop
    begin
      v_corpo := privado.json_evento_saida(r.evento);
      v_momento := extract(epoch from now())::bigint;
      execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
        into v_pedido
        using r.url, v_corpo,
              jsonb_build_object('Content-Type', 'application/json',
                                 'User-Agent', 'Aurora-Sistema/1',
                                 'X-Aurora-Evento', (r.evento).tipo,
                                 'X-Aurora-Entrega', r.id::text,
                                 'X-Aurora-Assinatura', 't=' || v_momento || ',v1=' || privado.assinar(r.segredo, v_momento, v_corpo::text));
      update public.webhook_entregas
         set status = 'enviando', tentativas = tentativas + 1, pedido_id = v_pedido, erro = null
       where id = r.id;
      v_n := v_n + 1;
    exception when others then
      update public.webhook_entregas
         set status = case when tentativas + 1 >= 8 then 'desistiu' else 'falhou' end,
             tentativas = tentativas + 1, erro = left(sqlerrm, 300),
             proxima_tentativa_em = now() + make_interval(mins => power(2, least(tentativas + 1, 8))::integer)
       where id = r.id;
    end;
  end loop;
  return v_n;
end;
$$;

-- Confere as respostas dos envios e agenda nova tentativa quando falhou
-- (1, 2, 4, 8... minutos; desiste depois de 8 tentativas — o evento continua na fila para consulta).
create or replace function privado.conferir_webhooks()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r        record;
  v_status integer;
  v_erro   text;
  v_tempo  boolean;
  v_achou  boolean;
  v_n      integer := 0;
begin
  if to_regclass('net._http_response') is null then
    return 0;
  end if;
  for r in
    select en.id, en.pedido_id, en.tentativas, en.updated_at
      from public.webhook_entregas en
     where en.status = 'enviando'
     order by en.id
     limit 200
     for update of en skip locked
  loop
    v_achou := false;
    execute 'select true, status_code, error_msg, timed_out from net._http_response where id = $1'
      into v_achou, v_status, v_erro, v_tempo using r.pedido_id;
    if coalesce(v_achou, false) then
      if v_status between 200 and 299 then
        update public.webhook_entregas set status = 'entregue', http_status = v_status, entregue_em = now(), erro = null where id = r.id;
      else
        update public.webhook_entregas
           set status = case when r.tentativas >= 8 then 'desistiu' else 'falhou' end,
               http_status = v_status,
               erro = left(coalesce(v_erro, case when v_tempo then 'Tempo esgotado.' else 'Resposta ' || coalesce(v_status::text, 'vazia') end), 300),
               proxima_tentativa_em = now() + make_interval(mins => power(2, least(r.tentativas, 8))::integer)
         where id = r.id;
      end if;
      v_n := v_n + 1;
    elsif r.updated_at < now() - interval '3 minutes' then
      update public.webhook_entregas
         set status = case when r.tentativas >= 8 then 'desistiu' else 'falhou' end,
             erro = 'Sem resposta do endereço.',
             proxima_tentativa_em = now() + make_interval(mins => power(2, least(r.tentativas, 8))::integer)
       where id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

create or replace function privado.processar_webhooks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform privado.conferir_webhooks();
  perform privado.despachar_webhooks();
end;
$$;

-- Registra o fato e põe na fila de cada webhook interessado.
create or replace function privado.emitir_evento(p_tipo text, p_negocio uuid, p_proposta uuid, p_contato uuid, p_dados jsonb,
                                                 p_so_webhook uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      bigint;
  v_contato uuid := p_contato;
begin
  if coalesce(current_setting('app.seed', true), '') = 'on' then
    return null; -- dados de exemplo não geram avisos
  end if;
  if v_contato is null and p_negocio is not null then
    select n.contato_id into v_contato from public.negocios n where n.id = p_negocio;
  end if;
  insert into public.eventos_saida (tipo, negocio_id, proposta_id, contato_id, dados)
  values (p_tipo, p_negocio, p_proposta, v_contato, coalesce(jsonb_strip_nulls(p_dados), '{}'::jsonb))
  returning id into v_id;

  insert into public.webhook_entregas (evento_id, webhook_id)
  select v_id, w.id from public.webhooks w
   where w.ativo
     and case when p_so_webhook is not null then w.id = p_so_webhook
              else (w.eventos = '{}' or p_tipo = any(w.eventos)) end;

  begin
    perform privado.despachar_webhooks();
  exception when others then
    null; -- o envio nunca pode derrubar a operação principal; a fila tenta de novo depois
  end;
  return v_id;
end;
$$;

-- Tela Integrações: "Enviar aviso de teste" e "Processar fila agora" (só o gestor).
create or replace function public.testar_webhook(p_webhook uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor testa os avisos.';
  end if;
  if not exists (select 1 from public.webhooks w where w.id = p_webhook and w.ativo) then
    raise exception 'Aviso não encontrado ou desligado.';
  end if;
  return privado.emitir_evento('teste.ping', null, null, null, jsonb_build_object('mensagem', 'Aviso de teste do sistema da Aurora.'), p_webhook);
end;
$$;
revoke all on function public.testar_webhook(uuid) from public, anon;
grant execute on function public.testar_webhook(uuid) to authenticated;

create or replace function public.processar_webhooks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor processa a fila de avisos.';
  end if;
  update public.webhook_entregas set status = 'falhou', proxima_tentativa_em = now(), tentativas = 0
   where status = 'desistiu' and created_at > now() - interval '7 days';
  update public.webhook_entregas set proxima_tentativa_em = now() where status = 'falhou';
  perform privado.processar_webhooks();
end;
$$;
revoke all on function public.processar_webhooks() from public, anon;
grant execute on function public.processar_webhooks() to authenticated;

-- Reenvio automático a cada minuto (pg_cron do Supabase; ignorado onde não existir).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'aurora-webhooks';
  perform cron.schedule('aurora-webhooks', '* * * * *', 'select privado.processar_webhooks()');
exception when others then
  raise notice 'pg_cron indisponível: o reenvio dos avisos fica manual (tela Integrações).';
end $$;

-- =====================================================================
-- A9. ATENDIMENTO: quem conversa com o cliente (agente ou humano) e as passagens
-- =====================================================================
create table if not exists public.transferencias (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  de         text not null check (de in ('humano', 'agente')),
  para       text not null check (para in ('humano', 'agente')),
  motivo     text check (motivo is null or char_length(motivo) <= 500),
  autor_id   uuid references public.vendedores (id) on delete set null,
  autor_tipo text not null default 'humano' check (autor_tipo in ('humano', 'agente', 'sistema')),
  created_at timestamptz not null default now()
);
create index if not exists transferencias_negocio_idx on public.transferencias (negocio_id, created_at desc);
alter table public.transferencias enable row level security;
drop policy if exists "transferencias_select" on public.transferencias;
create policy "transferencias_select" on public.transferencias for select to authenticated
  using (public.pode_ver_negocio(negocio_id));

create or replace function privado.transferir(p_negocio uuid, p_para text, p_motivo text, p_autor uuid, p_autor_tipo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n public.negocios%rowtype;
begin
  if p_para not in ('humano', 'agente') then
    raise exception 'Destino inválido.' using errcode = 'AU400';
  end if;
  select * into v_n from public.negocios where id = p_negocio for update;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = 'AU404';
  end if;
  if v_n.atendimento = p_para then
    return false; -- já está com quem foi pedido
  end if;
  if p_para = 'agente' and v_n.status <> 'aberto' then
    raise exception 'Só negócios em aberto podem ser passados para o agente.';
  end if;
  update public.negocios set atendimento = p_para, atendimento_desde = now() where id = p_negocio;
  insert into public.transferencias (negocio_id, de, para, motivo, autor_id, autor_tipo)
  values (p_negocio, v_n.atendimento, p_para, nullif(trim(left(p_motivo, 500)), ''), p_autor, p_autor_tipo);

  -- o agente pediu um humano: vira tarefa para o dono do negócio
  if p_para = 'humano' and p_autor_tipo = 'agente' then
    insert into public.atividades (tipo, titulo, descricao, quando, vendedor_id, negocio_id, contato_id)
    values ('tarefa', left('Assumir atendimento: ' || v_n.titulo, 160),
            'O agente pediu atendimento humano.' || coalesce(' Motivo: ' || nullif(trim(p_motivo), ''), ''),
            now(), v_n.vendedor_id, v_n.id, v_n.contato_id);
  end if;

  perform privado.emitir_evento(
    case when p_para = 'agente' then 'atendimento.encaminhado_agente'
         when p_autor_tipo = 'agente' then 'atendimento.pedido_humano'
         else 'atendimento.assumido_humano' end,
    p_negocio, null, v_n.contato_id,
    jsonb_build_object('codigo', v_n.codigo, 'titulo', v_n.titulo, 'motivo', nullif(trim(p_motivo), '')));
  return true;
end;
$$;

-- Botões "Passar para o agente" e "Assumir atendimento".
create or replace function public.transferir_atendimento(p_negocio uuid, p_para text, p_motivo text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode_editar_negocio(p_negocio) then
    raise exception 'Negócio não encontrado ou sem permissão.';
  end if;
  return privado.transferir(p_negocio, p_para, p_motivo, public.meu_vendedor_id(), 'humano');
end;
$$;
revoke all on function public.transferir_atendimento(uuid, text, text) from public, anon;
grant execute on function public.transferir_atendimento(uuid, text, text) to authenticated;

-- =====================================================================
-- A10. CONVERSA com o cliente (histórico visível na ficha do negócio)
-- =====================================================================
create table if not exists public.mensagens (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios (id) on delete cascade,
  contato_id  uuid references public.contatos (id) on delete set null,
  canal       text not null default 'whatsapp' check (canal in ('whatsapp', 'instagram', 'email', 'telefone', 'site', 'outro')),
  direcao     text not null check (direcao in ('entrada', 'saida')),          -- entrada = o cliente falou
  autor       text not null check (autor in ('cliente', 'agente', 'humano', 'sistema')),
  texto       text not null check (char_length(texto) between 1 and 8000),
  enviada_em  timestamptz not null default now(),
  id_externo  text check (id_externo is null or char_length(id_externo) <= 200),   -- id da mensagem no canal (evita duplicar)
  created_at  timestamptz not null default now(),
  constraint mensagens_coerencia_ck check ((direcao = 'entrada') = (autor = 'cliente'))
);
create index if not exists mensagens_negocio_idx on public.mensagens (negocio_id, enviada_em);
create unique index if not exists mensagens_id_externo_uidx on public.mensagens (id_externo) where id_externo is not null;
alter table public.mensagens enable row level security;
drop policy if exists "mensagens_select" on public.mensagens;
create policy "mensagens_select" on public.mensagens for select to authenticated
  using (public.pode_ver_negocio(negocio_id));
-- Pela tela, a equipe registra o que o cliente disse ou o que ela mesma respondeu.
drop policy if exists "mensagens_insert" on public.mensagens;
create policy "mensagens_insert" on public.mensagens for insert to authenticated
  with check (public.pode_editar_negocio(negocio_id) and autor in ('cliente', 'humano'));
drop policy if exists "mensagens_delete" on public.mensagens;
create policy "mensagens_delete" on public.mensagens for delete to authenticated
  using (public.sou_gestor());

create or replace function public.mensagem_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.negocios
     set ultima_atividade_em = greatest(coalesce(ultima_atividade_em, new.enviada_em), new.enviada_em)
   where id = new.negocio_id and (ultima_atividade_em is null or ultima_atividade_em < new.enviada_em);
  return null;
end;
$$;
revoke all on function public.mensagem_depois() from public, anon, authenticated;
drop trigger if exists trg_mensagens_depois on public.mensagens;
create trigger trg_mensagens_depois after insert on public.mensagens
  for each row execute function public.mensagem_depois();

-- =====================================================================
-- A11. NEGÓCIO: avisos e situação da data conforme o negócio anda
-- =====================================================================
create or replace function public.negocio_aurora_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform privado.emitir_evento('lead.criado', new.id, null, new.contato_id,
      jsonb_build_object('codigo', new.codigo, 'titulo', new.titulo, 'atendimento', new.atendimento,
                         'origem', (select o.nome from public.origens o where o.id = new.origem_id)));
    return null;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'ganho' then
      update public.eventos set situacao_data = 'confirmada' where negocio_id = new.id and data is not null;
      perform privado.emitir_evento('negocio.ganho', new.id, null, new.contato_id,
        jsonb_build_object('codigo', new.codigo, 'titulo', new.titulo, 'valor', new.valor));
    elsif new.status = 'perdido' then
      update public.eventos set situacao_data = 'liberada' where negocio_id = new.id and data is not null;
      perform privado.emitir_evento('negocio.perdido', new.id, null, new.contato_id,
        jsonb_build_object('codigo', new.codigo, 'titulo', new.titulo,
                           'motivo', (select m.nome from public.motivos_perda m where m.id = new.motivo_perda_id)));
    else -- reaberto
      update public.eventos e
         set situacao_data = case when exists (select 1 from public.propostas p where p.negocio_id = new.id and p.status = 'enviada')
                                  then 'reservada' else 'consulta' end,
             reservada_ate = (select max(p.validade) from public.propostas p where p.negocio_id = new.id and p.status = 'enviada')
       where e.negocio_id = new.id and e.data is not null;
    end if;
    -- negócio fechado volta para o humano (o agente não acompanha pós-venda)
    if new.status <> 'aberto' and new.atendimento = 'agente' then
      update public.negocios set atendimento = 'humano', atendimento_desde = now() where id = new.id;
      insert into public.transferencias (negocio_id, de, para, motivo, autor_tipo)
      values (new.id, 'agente', 'humano', 'Negócio encerrado (' || new.status || ').', 'sistema');
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.negocio_aurora_depois() from public, anon, authenticated;
drop trigger if exists trg_negocios_zz_aurora on public.negocios;
create trigger trg_negocios_zz_aurora after insert or update on public.negocios
  for each row execute function public.negocio_aurora_depois();

-- =====================================================================
-- A12. ENTRADA DE LEADS (site, agente, cadastro manual) com a origem registrada
-- =====================================================================
create table if not exists public.leads_recebidos (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  origem     text not null check (char_length(origem) <= 40),
  dados      jsonb not null default '{}'::jsonb,   -- o pedido como chegou
  ip_hash    text,
  contato_id uuid references public.contatos (id) on delete set null,
  negocio_id uuid references public.negocios (id) on delete set null,
  status     text not null default 'processado' check (status in ('processado', 'duplicado', 'rejeitado')),
  motivo     text
);
create index if not exists leads_recebidos_data_idx on public.leads_recebidos (created_at desc);
alter table public.leads_recebidos enable row level security;
drop policy if exists "leads_recebidos_select" on public.leads_recebidos;
create policy "leads_recebidos_select" on public.leads_recebidos for select to authenticated using (public.sou_gestor());

-- Telefone como o banco guarda (só dígitos, 10 a 13); nulo se não der para aproveitar.
create or replace function privado.telefone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  -- guarda no formato de comparação (sem o 55, celular com o 9)
  select case when d ~ '^[0-9]{10,13}$' then d end
    from (select public.tel_norm(p) as d) x;
$$;

create or replace function privado.tipo_evento(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p is null or trim(p) = '' then null
    when lower(p) in ('casamento', '15_anos', 'aniversario', 'formatura', 'empresa', 'outro') then lower(p)
    when lower(p) like '%casament%' then 'casamento'
    when lower(p) like '%15%' or lower(p) like '%debut%' then '15_anos'
    when lower(p) like '%anivers%' then 'aniversario'
    when lower(p) like '%formatura%' then 'formatura'
    when lower(p) like '%empresa%' or lower(p) like '%corporat%' or lower(p) like '%confratern%' then 'empresa'
    else 'outro'
  end;
$$;

create or replace function privado.rotulo_tipo_evento(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p when 'casamento' then 'Casamento' when '15_anos' then '15 anos' when 'aniversario' then 'Aniversário'
                when 'formatura' then 'Formatura' when 'empresa' then 'Evento de empresa' when 'outro' then 'Evento' else 'Evento' end;
$$;

-- "nov/2026", "novembro de 2026" ou "2026-11" → 2026-11-01
create or replace function privado.mes_previsto(p text)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  v_txt text := lower(trim(coalesce(p, '')));
  v_m   text[];
  v_mes integer;
begin
  if v_txt ~ '^\d{4}-\d{2}(-\d{2})?$' then
    return make_date(substr(v_txt, 1, 4)::int, substr(v_txt, 6, 2)::int, 1);
  end if;
  v_m := regexp_match(v_txt, '^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*[ /de]+(\d{4})$');
  if v_m is null then
    return null;
  end if;
  v_mes := array_position(array['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], v_m[1]);
  return make_date(v_m[2]::int, v_mes, 1);
exception when others then
  return null;
end;
$$;

-- Grava (cria ou atualiza) o evento de um negócio. Só mexe nos campos que vierem em "e".
create or replace function privado.gravar_evento(p_negocio uuid, e jsonb)
returns public.eventos
language plpgsql
security definer
set search_path = public
as $$
declare
  v       public.eventos%rowtype;
  v_pac   uuid;
  v_prefs text[];
begin
  if e is null or jsonb_typeof(e) <> 'object' then
    raise exception 'Dados do evento inválidos.' using errcode = 'AU400';
  end if;
  insert into public.eventos (negocio_id) values (p_negocio) on conflict (negocio_id) do nothing;
  select * into v from public.eventos where negocio_id = p_negocio for update;

  if e ? 'pacote_id' or e ? 'pacote' then
    if nullif(e ->> 'pacote_id', '') ~ '^[0-9a-fA-F-]{36}$' then
      select p.id into v_pac from public.pacotes p where p.id = (e ->> 'pacote_id')::uuid;
    elsif nullif(trim(e ->> 'pacote'), '') is not null then
      select p.id into v_pac from public.pacotes p where lower(p.nome) = lower(trim(e ->> 'pacote')) limit 1;
    end if;
    if v_pac is null and (nullif(e ->> 'pacote_id', '') is not null
                          or (nullif(trim(e ->> 'pacote'), '') is not null and lower(e ->> 'pacote') not like '%ajuda%')) then
      raise exception 'Pacote não encontrado no catálogo.' using errcode = 'AU400';
    end if;
    v.pacote_id := v_pac;
    if lower(coalesce(e ->> 'pacote', '')) like '%ajuda%' then
      v.quer_ajuda_pacote := true;
    elsif v_pac is not null then
      v.quer_ajuda_pacote := false;
    end if;
  end if;
  if e ? 'quer_ajuda_pacote' then v.quer_ajuda_pacote := coalesce((e ->> 'quer_ajuda_pacote')::boolean, false); end if;
  if e ? 'tipo' then v.tipo := privado.tipo_evento(e ->> 'tipo'); end if;
  if e ? 'nome' then v.nome := nullif(left(trim(e ->> 'nome'), 120), ''); end if;
  if e ? 'data' then v.data := nullif(e ->> 'data', '')::date; end if;
  if e ? 'mes_previsto' then v.mes_previsto := privado.mes_previsto(e ->> 'mes_previsto'); end if;
  if e ? 'hora_inicio' then v.hora_inicio := nullif(e ->> 'hora_inicio', '')::time; end if;
  if e ? 'duracao_horas' then v.duracao_horas := nullif(e ->> 'duracao_horas', '')::numeric; end if;
  if e ? 'cidade' then v.cidade := nullif(left(trim(e ->> 'cidade'), 80), ''); end if;
  if e ? 'uf' then v.uf := nullif(upper(trim(e ->> 'uf')), ''); end if;
  if e ? 'local' then v.local := nullif(left(trim(e ->> 'local'), 160), ''); end if;
  if e ? 'convidados' then v.convidados := nullif(e ->> 'convidados', '')::integer; end if;
  if e ? 'convidados_faixa' then v.convidados_faixa := nullif(left(trim(e ->> 'convidados_faixa'), 40), ''); end if;
  if e ? 'linha' then v.linha := nullif(lower(trim(e ->> 'linha')), ''); end if;
  if e ? 'observacoes' then v.observacoes := nullif(left(trim(e ->> 'observacoes'), 2000), ''); end if;
  if e ? 'preferencias' and jsonb_typeof(e -> 'preferencias') = 'array' then
    select coalesce(array_agg(left(trim(x), 40)), '{}') into v_prefs
      from jsonb_array_elements_text(e -> 'preferencias') x where trim(x) <> '';
    v.preferencias := v_prefs[1:10];
  end if;
  if v.data is not null and v.data < public.hoje_br() - 1 and v.situacao_data = 'consulta' and e ? 'data' then
    raise exception 'A data do evento já passou.' using errcode = 'AU400';
  end if;

  update public.eventos
     set tipo = v.tipo, nome = v.nome, data = v.data, mes_previsto = v.mes_previsto, hora_inicio = v.hora_inicio,
         duracao_horas = v.duracao_horas, cidade = v.cidade, uf = v.uf, local = v.local, convidados = v.convidados,
         convidados_faixa = v.convidados_faixa, pacote_id = v.pacote_id, quer_ajuda_pacote = v.quer_ajuda_pacote,
         linha = v.linha, preferencias = v.preferencias, observacoes = v.observacoes
   where id = v.id
  returning * into v;
  return v;
end;
$$;

-- Cria contato (ou reaproveita pelo telefone) + negócio em "Novo lead" + evento.
-- p_codigo: referência que o SITE já mostrou ao cliente na mensagem do WhatsApp ("Ref. XK4A").
-- Vira o código do pedido, para a mensagem e o sistema falarem do mesmo número.
drop function if exists privado.criar_lead(jsonb, jsonb, text, text, text, text);
create or replace function privado.criar_lead(p_contato jsonb, p_evento jsonb, p_titulo text, p_origem text,
                                              p_atendimento text, p_observacoes text, p_codigo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono    uuid := privado.gestor_padrao();
  v_funil   uuid;
  v_etapa   uuid;
  v_origem  uuid;
  v_tel     text := privado.telefone(p_contato ->> 'telefone');
  v_nome    text := nullif(left(trim(regexp_replace(coalesce(p_contato ->> 'nome', ''), '\s+', ' ', 'g')), 120), '');
  v_email   text := nullif(lower(trim(p_contato ->> 'email')), '');
  v_contato uuid;
  v_existia boolean := false;
  v_negocio uuid;
  v_codigo  text;
  v_tipo    text := privado.tipo_evento(p_evento ->> 'tipo');
  v_titulo  text;
begin
  if v_dono is null then
    raise exception 'O sistema ainda não tem um gestor. Entre no sistema uma vez antes de receber leads.' using errcode = 'AU409';
  end if;
  select f.id into v_funil from public.funis f where f.ativo order by f.ordem, f.created_at limit 1;
  select e.id into v_etapa from public.etapas e where e.funil_id = v_funil order by e.ordem, e.created_at limit 1;
  if v_etapa is null then
    raise exception 'Cadastre o funil e as etapas em Configurações antes de receber leads.' using errcode = 'AU409';
  end if;

  if nullif(trim(p_origem), '') is not null then
    select o.id into v_origem from public.origens o where lower(o.nome) = lower(trim(p_origem)) limit 1;
    if v_origem is null then
      insert into public.origens (nome, ordem) values (left(trim(p_origem), 60), 99) returning id into v_origem;
    end if;
  end if;

  if nullif(p_contato ->> 'id', '') ~ '^[0-9a-fA-F-]{36}$' then
    select c.id into v_contato from public.contatos c where c.id = (p_contato ->> 'id')::uuid;
    if v_contato is null then
      raise exception 'Contato não encontrado.' using errcode = 'AU404';
    end if;
    v_existia := true;
  elsif v_tel is not null then
    select c.id into v_contato from public.contatos c
     where public.tel_norm(c.telefone) = public.tel_norm(v_tel) order by c.created_at limit 1;
    v_existia := v_contato is not null;
  end if;
  if v_contato is null then
    if v_nome is null or char_length(v_nome) < 2 then
      raise exception 'Informe o nome do contato.' using errcode = 'AU400';
    end if;
    if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      v_email := null;
    end if;
    insert into public.contatos (nome, telefone, email, cidade, origem_id, responsavel_id, observacoes)
    values (v_nome, v_tel, v_email, nullif(left(trim(coalesce(p_contato ->> 'cidade', p_evento ->> 'cidade')), 80), ''),
            v_origem, v_dono, nullif(left(trim(p_contato ->> 'observacoes'), 2000), ''))
    returning id into v_contato;
  end if;
  if v_nome is null then
    select c.nome into v_nome from public.contatos c where c.id = v_contato;
  end if;

  v_titulo := left(coalesce(nullif(trim(p_titulo), ''), privado.rotulo_tipo_evento(v_tipo) || ' · ' || v_nome), 120);
  insert into public.negocios (titulo, funil_id, etapa_id, vendedor_id, contato_id, origem_id, observacoes, atendimento, codigo)
  values (v_titulo, v_funil, v_etapa, v_dono, v_contato, v_origem, nullif(left(trim(p_observacoes), 4000), ''),
          case when p_atendimento = 'agente' then 'agente' else 'humano' end,
          -- código já em uso (raro): o banco gera outro
          case when p_codigo ~ '^[A-Z0-9]{4,10}$' and not exists (select 1 from public.negocios x where x.codigo = p_codigo) then p_codigo end)
  returning id, codigo into v_negocio, v_codigo;

  if p_evento is not null and jsonb_typeof(p_evento) = 'object' then
    perform privado.gravar_evento(v_negocio, p_evento);
  else
    insert into public.eventos (negocio_id) values (v_negocio) on conflict (negocio_id) do nothing;
  end if;

  return jsonb_build_object('negocio_id', v_negocio, 'contato_id', v_contato, 'codigo', v_codigo, 'contato_ja_existia', v_existia);
end;
$$;

-- FORMULÁRIO DO SITE. Pública (sem login): por isso valida tudo, limita a quantidade
-- de pedidos e NÃO devolve nenhum dado além do código do pedido.
create or replace function public.receber_lead_site(p jsonb, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text := case when nullif(trim(p_ip), '') is not null then encode(sha256(convert_to(trim(p_ip), 'utf8')), 'hex') end;
  v_nome    text;
  v_tel     text;
  v_evento  jsonb;
  v_prefs   jsonb := '[]'::jsonb;
  v_obs     text;
  v_res     jsonb;
  v_existe  record;
  v_atend   text;
  v_ref     text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 6000 then
    return jsonb_build_object('ok', false, 'mensagem', 'Pedido inválido.');
  end if;
  -- campo-armadilha: pessoas não veem; robôs preenchem
  if nullif(trim(p ->> 'site_web'), '') is not null then
    insert into public.leads_recebidos (origem, dados, ip_hash, status, motivo) values ('site', '{}', v_ip_hash, 'rejeitado', 'robô');
    return jsonb_build_object('ok', true);
  end if;
  -- limite de pedidos: 30 a cada 10 minutos no total, 5 por endereço
  if (select count(*) from public.leads_recebidos l where l.origem = 'site' and l.created_at > now() - interval '10 minutes') >= 30
     or (v_ip_hash is not null and (select count(*) from public.leads_recebidos l
                                     where l.origem = 'site' and l.ip_hash = v_ip_hash and l.created_at > now() - interval '10 minutes') >= 5) then
    return jsonb_build_object('ok', false, 'mensagem', 'Muitos pedidos em pouco tempo. Tente de novo em alguns minutos.');
  end if;

  v_nome := nullif(left(trim(regexp_replace(coalesce(p ->> 'nome', ''), '\s+', ' ', 'g')), 60), '');
  if v_nome is null or char_length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'mensagem', 'Informe o seu nome.');
  end if;
  v_tel := privado.telefone(coalesce(p ->> 'whatsapp', p ->> 'telefone'));

  if jsonb_typeof(p -> 'drinks') = 'array' then
    select coalesce(jsonb_agg(left(x, 40)), '[]'::jsonb) into v_prefs
      from (select x from jsonb_array_elements_text(p -> 'drinks') x limit 10) t;
  end if;
  v_obs := nullif(left(trim(p ->> 'obs'), 500), '');
  v_evento := jsonb_strip_nulls(jsonb_build_object(
    'tipo', nullif(p ->> 'tipo', ''),
    'data', case when (p ->> 'data') ~ '^\d{4}-\d{2}-\d{2}$' and (p ->> 'data')::date >= public.hoje_br() then p ->> 'data' end,
    'mes_previsto', nullif(p ->> 'mes', ''),
    'cidade', coalesce(nullif(left(trim(p ->> 'cidade'), 80), ''), case when p ->> 'cidadeop' = 'Araxá' then 'Araxá' end),
    'convidados_faixa', nullif(left(trim(p ->> 'convidados'), 40), ''),
    'pacote', nullif(left(trim(p ->> 'pacote'), 60), ''),
    'observacoes', v_obs)) || jsonb_build_object('preferencias', v_prefs);
  -- pacote desconhecido não pode travar o pedido: vai para as observações
  if v_evento ? 'pacote' and lower(v_evento ->> 'pacote') not like '%ajuda%'
     and not exists (select 1 from public.pacotes pc where lower(pc.nome) = lower(v_evento ->> 'pacote')) then
    v_evento := (v_evento - 'pacote') || jsonb_build_object('observacoes',
      concat_ws(' · ', 'Pacote citado: ' || (v_evento ->> 'pacote'), v_obs));
  end if;

  -- referência que o site escreveu na mensagem do WhatsApp (ex.: "Ref. XK4A")
  v_ref := upper(trim(coalesce(p ->> 'ref', '')));
  if v_ref !~ '^[A-Z0-9]{4,10}$' then
    v_ref := null;
  end if;

  perform set_config('app.ator', 'site', true);

  -- o mesmo pedido chegando de novo (toque duplo, voltar e reenviar): atualiza, não duplica
  if v_ref is not null then
    select n.id, n.codigo, n.contato_id into v_existe
      from public.negocios n
     where n.codigo = v_ref and n.status = 'aberto' and n.created_at > now() - interval '24 hours'
       and n.origem_id = (select o.id from public.origens o where lower(o.nome) = 'site' limit 1);
    if v_existe.id is not null then
      perform privado.gravar_evento(v_existe.id, v_evento);
      insert into public.leads_recebidos (origem, dados, ip_hash, contato_id, negocio_id, status, motivo)
      values ('site', p - 'site_web', v_ip_hash, v_existe.contato_id, v_existe.id, 'duplicado', 'Mesma referência do site.');
      return jsonb_build_object('ok', true, 'codigo', v_existe.codigo);
    end if;
  end if;

  -- mesma pessoa (telefone) mandando de novo em 24 horas: atualiza o pedido em aberto, não duplica
  if v_tel is not null then
    select n.id, n.codigo, n.contato_id into v_existe
      from public.negocios n join public.contatos c on c.id = n.contato_id
     where public.tel_norm(c.telefone) = public.tel_norm(v_tel) and n.status = 'aberto'
       and n.created_at > now() - interval '24 hours'
     order by n.created_at desc limit 1;
    if v_existe.id is not null then
      perform privado.gravar_evento(v_existe.id, v_evento);
      insert into public.leads_recebidos (origem, dados, ip_hash, contato_id, negocio_id, status, motivo)
      values ('site', p - 'site_web', v_ip_hash, v_existe.contato_id, v_existe.id, 'duplicado', 'Mesmo telefone em menos de 24 horas.');
      return jsonb_build_object('ok', true, 'codigo', v_existe.codigo);
    end if;
  end if;

  select c.atendimento_novos_leads into v_atend from public.configuracoes c where c.unica limit 1;
  begin
    v_res := privado.criar_lead(jsonb_build_object('nome', v_nome, 'telefone', v_tel), v_evento, null, 'Site',
                                coalesce(v_atend, 'humano'),
                                case when v_tel is null and nullif(trim(coalesce(p ->> 'whatsapp', p ->> 'telefone')), '') is not null
                                     then 'Telefone informado no site (formato não reconhecido): ' || left(trim(coalesce(p ->> 'whatsapp', p ->> 'telefone')), 30) end,
                                v_ref);
  exception when others then
    insert into public.leads_recebidos (origem, dados, ip_hash, status, motivo)
    values ('site', p - 'site_web', v_ip_hash, 'rejeitado', left(sqlerrm, 300));
    return jsonb_build_object('ok', false, 'mensagem', 'Não foi possível registrar o pedido agora.');
  end;

  insert into public.leads_recebidos (origem, dados, ip_hash, contato_id, negocio_id, status)
  values ('site', p - 'site_web', v_ip_hash, (v_res ->> 'contato_id')::uuid, (v_res ->> 'negocio_id')::uuid, 'processado');
  return jsonb_build_object('ok', true, 'codigo', v_res ->> 'codigo');
end;
$$;
revoke all on function public.receber_lead_site(jsonb, text) from public;
grant execute on function public.receber_lead_site(jsonb, text) to anon, authenticated;

-- =====================================================================
-- A13. API DO AGENTE
-- O agente NÃO acessa tabelas. Ele chama UMA função pública, api_agente(chave, ação, dados),
-- que: confere a chave, o limite por minuto e a permissão da ação; executa; e registra
-- tudo em agente_log. As ações em si ficam no esquema "privado".
-- A chave é guardada só como resumo (SHA-256): nem o gestor consegue lê-la depois de criada.
-- =====================================================================
create table if not exists public.chaves_api (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (char_length(nome) between 2 and 60),
  prefixo           text not null,                 -- começo da chave, só para reconhecê-la na lista
  hash              text not null unique,
  escopos           text[] not null default '{}',
  limite_por_minuto integer not null default 120 check (limite_por_minuto between 1 and 6000),
  ativa             boolean not null default true,
  criada_por        uuid references public.vendedores (id) on delete set null,
  ultimo_uso_em     timestamptz,
  revogada_em       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_chaves_api_updated_at on public.chaves_api;
create trigger trg_chaves_api_updated_at before update on public.chaves_api
  for each row execute function public.set_updated_at();

create table if not exists public.agente_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  chave_id    uuid references public.chaves_api (id) on delete set null,
  acao        text not null,
  status      integer not null,
  ok          boolean not null,
  negocio_id  uuid,
  registro_id uuid,
  resumo      text,
  erro        text,
  pedido      jsonb,
  ip          text,
  duracao_ms  integer
);
create index if not exists agente_log_data_idx on public.agente_log (created_at desc);
create index if not exists agente_log_chave_idx on public.agente_log (chave_id, created_at desc);
create index if not exists agente_log_negocio_idx on public.agente_log (negocio_id, created_at desc);

alter table public.chaves_api enable row level security;
alter table public.agente_log enable row level security;
-- Só leitura para o gestor; criar e revogar chave é pelas funções abaixo.
drop policy if exists "chaves_api_select" on public.chaves_api;
create policy "chaves_api_select" on public.chaves_api for select to authenticated using (public.sou_gestor());
drop policy if exists "agente_log_select" on public.agente_log;
create policy "agente_log_select" on public.agente_log for select to authenticated using (public.sou_gestor());

-- Lista de permissões (escopos) que uma chave pode ter.
create or replace function privado.escopos_validos()
returns text[]
language sql
immutable
as $$
  select array['contatos.ler', 'contatos.gravar', 'negocios.ler', 'negocios.gravar', 'agenda.ler', 'catalogo.ler',
               'precos.calcular', 'propostas.ler', 'propostas.gravar', 'propostas.enviar', 'mensagens.ler',
               'mensagens.gravar', 'atendimento.transferir', 'eventos.ler', 'atendimento.devolver'];
$$;

-- Qual permissão cada ação exige ('' = qualquer chave válida; nulo = ação desconhecida).
create or replace function privado.escopo_da_acao(p_acao text)
returns text
language sql
immutable
as $$
  select case p_acao
    when 'ping' then ''
    when 'contatos.buscar' then 'contatos.ler'
    when 'contatos.obter' then 'contatos.ler'
    when 'contatos.criar' then 'contatos.gravar'
    when 'contatos.atualizar' then 'contatos.gravar'
    when 'negocios.listar' then 'negocios.ler'
    when 'negocios.obter' then 'negocios.ler'
    when 'negocios.criar' then 'negocios.gravar'
    when 'negocios.atualizar' then 'negocios.gravar'
    when 'negocios.mover_etapa' then 'negocios.gravar'
    when 'negocios.marcar_perdido' then 'negocios.gravar'
    when 'evento.atualizar' then 'negocios.gravar'
    when 'agenda.disponibilidade' then 'agenda.ler'
    when 'catalogo.pacotes' then 'catalogo.ler'
    when 'catalogo.drinks' then 'catalogo.ler'
    when 'catalogo.condicoes' then 'catalogo.ler'
    when 'catalogo.funil' then 'catalogo.ler'
    when 'precos.calcular' then 'precos.calcular'
    when 'propostas.listar' then 'propostas.ler'
    when 'propostas.obter' then 'propostas.ler'
    when 'propostas.criar' then 'propostas.gravar'
    when 'propostas.atualizar' then 'propostas.gravar'
    when 'propostas.submeter' then 'propostas.gravar'
    when 'propostas.enviar' then 'propostas.enviar'
    when 'mensagens.listar' then 'mensagens.ler'
    when 'mensagens.registrar' then 'mensagens.gravar'
    when 'atendimento.pedir_humano' then 'atendimento.transferir'
    when 'eventos.listar' then 'eventos.ler'
    when 'atendimento.encaminhar_agente' then 'atendimento.devolver'
  end;
$$;

-- Tela Integrações: criar chave (devolve a chave UMA vez) e revogar. Só o gestor.
create or replace function public.criar_chave_api(p_nome text, p_escopos text[] default null, p_limite integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_chave   text;
  -- padrão: tudo menos "devolver ao agente", que é só da chave do painel (a IA não pega conversas sozinha)
  v_escopos text[] := coalesce(p_escopos, array_remove(privado.escopos_validos(), 'atendimento.devolver'));
  v_id      uuid;
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor cria chaves de acesso.';
  end if;
  if nullif(trim(p_nome), '') is null or char_length(trim(p_nome)) < 2 then
    raise exception 'Dê um nome à chave (ex.: Agente SDR).';
  end if;
  if not (v_escopos <@ privado.escopos_validos()) or array_length(v_escopos, 1) is null then
    raise exception 'Escolha pelo menos uma permissão válida.';
  end if;
  v_chave := 'aur_' || encode(gen_random_bytes(24), 'hex');
  insert into public.chaves_api (nome, prefixo, hash, escopos, limite_por_minuto, criada_por)
  values (left(trim(p_nome), 60), left(v_chave, 12), encode(sha256(convert_to(v_chave, 'utf8')), 'hex'), v_escopos,
          least(greatest(coalesce(p_limite, 120), 1), 6000), public.meu_vendedor_id())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'chave', v_chave);
end;
$$;
revoke all on function public.criar_chave_api(text, text[], integer) from public, anon;
grant execute on function public.criar_chave_api(text, text[], integer) to authenticated;

create or replace function public.revogar_chave_api(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor revoga chaves de acesso.';
  end if;
  update public.chaves_api set ativa = false, revogada_em = coalesce(revogada_em, now()) where id = p_id;
  if not found then
    raise exception 'Chave não encontrada.';
  end if;
end;
$$;
revoke all on function public.revogar_chave_api(uuid) from public, anon;
grant execute on function public.revogar_chave_api(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Formatos de resposta (o "contrato" da API)
-- ---------------------------------------------------------------------
create or replace function privado.id_de(d jsonb, p_chave text, p_obrigatorio boolean default true)
returns uuid
language plpgsql
immutable
as $$
declare
  v text := nullif(trim(d ->> p_chave), '');
begin
  if v is null then
    if p_obrigatorio then
      raise exception 'Informe "%".', p_chave using errcode = 'AU400';
    end if;
    return null;
  end if;
  if v !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception 'O campo "%" não é um id válido.', p_chave using errcode = 'AU400';
  end if;
  return v::uuid;
end;
$$;

-- Endereço completo de um arquivo do sistema (ex.: foto de drink em /aurora/drinks/...).
create or replace function privado.url_publica(p text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p is null or trim(p) = '' then null
    when p ~ '^https?://' then p
    when nullif(current_setting('app.base_url', true), '') is not null then current_setting('app.base_url', true) || p
  end;
$$;

create or replace function privado.json_contato(c public.contatos)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'telefone', c.telefone, 'email', c.email, 'cidade', c.cidade,
    'observacoes', c.observacoes, 'tags', to_jsonb(c.tags),
    'nao_contatar', c.nao_contatar, 'nao_contatar_em', c.nao_contatar_em, 'nao_contatar_motivo', c.nao_contatar_motivo,
    'aceita_retomadas', c.aceita_retomadas, 'aceita_retomadas_em', c.aceita_retomadas_em,
    'origem', (select o.nome from public.origens o where o.id = c.origem_id),
    'criado_em', c.created_at, 'atualizado_em', c.updated_at) end;
$$;

create or replace function privado.json_evento(e public.eventos)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when e.id is null then null else jsonb_build_object(
    'tipo', e.tipo, 'nome', e.nome, 'data', e.data, 'mes_previsto', e.mes_previsto,
    'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'duracao_horas', e.duracao_horas,
    'cidade', e.cidade, 'uf', e.uf, 'local', e.local,
    'convidados', e.convidados, 'convidados_faixa', e.convidados_faixa,
    'pacote_id', e.pacote_id, 'pacote', (select p.nome from public.pacotes p where p.id = e.pacote_id),
    'quer_ajuda_pacote', e.quer_ajuda_pacote, 'linha', e.linha, 'preferencias', to_jsonb(e.preferencias),
    'observacoes', e.observacoes, 'situacao_data', e.situacao_data, 'reservada_ate', e.reservada_ate) end;
$$;

create or replace function privado.json_proposta(p public.propostas, p_completa boolean default true)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'negocio_id', p.negocio_id, 'numero', p.numero, 'versao', p.versao, 'status', p.status, 'origem', p.origem,
    'titulo', p.titulo, 'validade', p.validade, 'total', p.total, 'preco_pendente', p.preco_pendente,
    'submetida_em', p.aprovacao_pedida_em, 'aprovada_em', p.aprovada_em, 'enviada_em', p.enviada_em,
    'visualizada_em', p.visualizada_em, 'aceita_em', p.aceita_em,
    'ajustes', case when p.ajustes_comentario is not null
                    then jsonb_build_object('comentario', p.ajustes_comentario, 'pedido_em', p.ajustes_em) end,
    'link', case when p.status in ('enviada', 'aceita')
                 then coalesce(nullif(current_setting('app.base_url', true), ''), '') || '/proposta/' || p.codigo end)
  || case when not p_completa then '{}'::jsonb else jsonb_build_object(
    'evento', p.evento, 'cardapio', p.cardapio, 'pacote', p.pacote_nome, 'linha', p.linha,
    'capa_titulo', p.capa_titulo, 'capa_subtitulo', p.capa_subtitulo, 'apresentacao', p.apresentacao,
    'descricao_servico', p.descricao_servico, 'mensagem_final', p.mensagem_final, 'nota_interna', p.nota_interna,
    'condicoes', jsonb_build_object('entrada_pct', p.entrada_pct, 'entrada_dias_antes', p.entrada_dias_antes,
                                    'saldo_dias_antes', p.saldo_dias_antes, 'cancelamento_aviso_dias', p.cancelamento_aviso_dias,
                                    'cancelamento_multa_pct', p.cancelamento_multa_pct, 'taxa_quebra', p.taxa_quebra, 'foro', p.foro),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('descricao', i.descricao, 'detalhes', i.detalhes, 'quantidade', i.quantidade,
                                                            'preco_unitario', i.preco_unitario, 'total', i.total) order by i.ordem)
                         from public.proposta_itens i where i.proposta_id = p.id), '[]'::jsonb)) end;
$$;

create or replace function privado.json_negocio(n public.negocios)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', n.id, 'codigo', n.codigo, 'titulo', n.titulo, 'status', n.status, 'valor', n.valor,
    'atendimento', n.atendimento, 'atendimento_desde', n.atendimento_desde,
    'etapa', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'ordem', e.ordem) from public.etapas e where e.id = n.etapa_id),
    'origem', (select o.nome from public.origens o where o.id = n.origem_id),
    'motivo_perda', (select m.nome from public.motivos_perda m where m.id = n.motivo_perda_id),
    'observacoes', n.observacoes, 'tags', to_jsonb(n.tags),
    'criado_em', n.created_at, 'atualizado_em', n.updated_at, 'ultima_atividade_em', n.ultima_atividade_em,
    'contato', (select privado.json_contato(c) from public.contatos c where c.id = n.contato_id),
    'evento', (select privado.json_evento(e) from public.eventos e where e.negocio_id = n.id),
    'propostas', coalesce((select jsonb_agg(privado.json_proposta(p, false) order by p.created_at)
                             from public.propostas p where p.negocio_id = n.id and p.status <> 'substituida'), '[]'::jsonb));
$$;

-- O negócio existe? E, para ALTERAR, o atendimento está com o agente?
create or replace function privado.negocio_do_agente(p_id uuid, p_escrita boolean)
returns public.negocios
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.negocios%rowtype;
begin
  select * into v from public.negocios where id = p_id;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = 'AU404';
  end if;
  if p_escrita then
    if v.status <> 'aberto' then
      raise exception 'Este negócio já foi encerrado (%).', v.status using errcode = 'AU409';
    end if;
    if v.atendimento <> 'agente' then
      raise exception 'Este atendimento está com um humano: o agente não pode alterar. Aguarde o aviso "atendimento.encaminhado_agente".'
        using errcode = 'AU409';
    end if;
  end if;
  return v;
end;
$$;

create or replace function privado.resposta(p_dados jsonb, p_resumo text default null, p_negocio uuid default null,
                                            p_registro uuid default null, p_status integer default 200)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('status', p_status, 'dados', p_dados, 'resumo', p_resumo, 'negocio_id', p_negocio, 'registro_id', p_registro);
$$;

-- ---------------------------------------------------------------------
-- AS AÇÕES. Cada uma devolve privado.resposta(...). Erros de regra usam
-- "raise exception ... using errcode": AU400 dado inválido, AU404 não encontrado,
-- AU409 situação não permite. As regras das tabelas (gatilhos) continuam valendo.
-- ---------------------------------------------------------------------
create or replace function privado.agente_executar(p_acao text, d jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agente  uuid := nullif(current_setting('app.agente_vendedor_id', true), '')::uuid;
  v_id      uuid;
  v_n       public.negocios%rowtype;
  v_c       public.contatos%rowtype;
  v_p       public.propostas%rowtype;
  v_ev      public.eventos%rowtype;
  v_cfg     public.configuracoes%rowtype;
  v_json    jsonb;
  v_calc    jsonb;
  v_txt     text;
  v_tel     text;
  v_lim     integer;
  v_int     integer;
  v_int2    integer;
  v_big     bigint;
  v_ids     uuid[];
  v_item    jsonb;
  v_res     jsonb;
begin
  -- ================= GERAL =================
  if p_acao = 'ping' then
    return privado.resposta(jsonb_build_object(
      'ok', true, 'agora', now(),
      'chave', (select jsonb_build_object('nome', k.nome, 'escopos', to_jsonb(k.escopos), 'limite_por_minuto', k.limite_por_minuto)
                  from public.chaves_api k where k.id = nullif(current_setting('app.agente_chave_id', true), '')::uuid),
      'empresa', (select coalesce(nullif(trim(c.nome_exibicao), ''), c.nome_negocio) from public.configuracoes c where c.unica limit 1)),
      'Teste de conexão.');

  -- ================= CONTATOS =================
  elsif p_acao = 'contatos.buscar' then
    v_tel := privado.telefone(d ->> 'telefone');
    if v_tel is null and nullif(trim(d ->> 'email'), '') is null and char_length(coalesce(trim(d ->> 'nome'), '')) < 2 then
      raise exception 'Informe "telefone", "email" ou "nome" (2 letras ou mais) para buscar.' using errcode = 'AU400';
    end if;
    v_lim := least(greatest(coalesce(nullif(d ->> 'limite', '')::integer, 10), 1), 20);
    select coalesce(jsonb_agg(privado.json_contato(c)), '[]'::jsonb) into v_json
      from (select c.* from public.contatos c
             where (v_tel is null or public.tel_norm(c.telefone) = public.tel_norm(v_tel))
               and (nullif(trim(d ->> 'email'), '') is null or lower(c.email) = lower(trim(d ->> 'email')))
               and (char_length(coalesce(trim(d ->> 'nome'), '')) < 2 or c.nome ilike '%' || replace(replace(trim(d ->> 'nome'), '%', ''), '_', '') || '%')
             order by c.updated_at desc limit v_lim) c;
    return privado.resposta(jsonb_build_object('contatos', v_json), 'Busca de contatos: ' || jsonb_array_length(v_json) || ' encontrado(s).');

  elsif p_acao = 'contatos.obter' then
    select * into v_c from public.contatos where id = privado.id_de(d, 'id');
    if not found then raise exception 'Contato não encontrado.' using errcode = 'AU404'; end if;
    return privado.resposta(privado.json_contato(v_c), 'Leu o contato ' || v_c.nome || '.', null, v_c.id);

  elsif p_acao = 'contatos.criar' then
    v_txt := nullif(left(trim(regexp_replace(coalesce(d ->> 'nome', ''), '\s+', ' ', 'g')), 120), '');
    if v_txt is null or char_length(v_txt) < 2 then
      raise exception 'Informe o nome do contato.' using errcode = 'AU400';
    end if;
    v_tel := privado.telefone(d ->> 'telefone');
    if v_tel is null and nullif(trim(d ->> 'telefone'), '') is not null then
      raise exception 'Telefone inválido: use DDD + número, só dígitos (ex.: 34988887777).' using errcode = 'AU400';
    end if;
    if v_tel is not null then
      select * into v_c from public.contatos c where public.tel_norm(c.telefone) = public.tel_norm(v_tel) order by c.created_at limit 1;
      if found then
        return privado.resposta(privado.json_contato(v_c) || jsonb_build_object('ja_existia', true),
                                'Contato já existia: ' || v_c.nome || '.', null, v_c.id);
      end if;
    end if;
    insert into public.contatos (nome, telefone, email, cidade, observacoes, responsavel_id, origem_id)
    values (v_txt, v_tel, nullif(lower(trim(d ->> 'email')), ''), nullif(left(trim(d ->> 'cidade'), 80), ''),
            nullif(left(trim(d ->> 'observacoes'), 2000), ''), privado.gestor_padrao(),
            (select o.id from public.origens o where lower(o.nome) = lower(trim(d ->> 'origem')) limit 1))
    returning * into v_c;
    return privado.resposta(privado.json_contato(v_c) || jsonb_build_object('ja_existia', false),
                            'Criou o contato ' || v_c.nome || '.', null, v_c.id, 201);

  elsif p_acao = 'contatos.atualizar' then
    select * into v_c from public.contatos where id = privado.id_de(d, 'id') for update;
    if not found then raise exception 'Contato não encontrado.' using errcode = 'AU404'; end if;
    if d ? 'telefone' then
      v_tel := privado.telefone(d ->> 'telefone');
      if v_tel is null and nullif(trim(d ->> 'telefone'), '') is not null then
        raise exception 'Telefone inválido: use DDD + número, só dígitos (ex.: 34988887777).' using errcode = 'AU400';
      end if;
    end if;
    update public.contatos
       set nome = case when d ? 'nome' and char_length(trim(d ->> 'nome')) >= 2 then left(trim(d ->> 'nome'), 120) else nome end,
           telefone = case when d ? 'telefone' then v_tel else telefone end,
           email = case when d ? 'email' then nullif(lower(trim(d ->> 'email')), '') else email end,
           cidade = case when d ? 'cidade' then nullif(left(trim(d ->> 'cidade'), 80), '') else cidade end,
           observacoes = case when d ? 'observacoes' then nullif(left(trim(d ->> 'observacoes'), 2000), '') else observacoes end,
           nao_contatar = case when jsonb_typeof(d -> 'nao_contatar') = 'boolean' then (d ->> 'nao_contatar')::boolean else nao_contatar end,
           nao_contatar_motivo = case when d ? 'nao_contatar_motivo' then d ->> 'nao_contatar_motivo' else nao_contatar_motivo end,
           aceita_retomadas = case when jsonb_typeof(d -> 'aceita_retomadas') = 'boolean' then (d ->> 'aceita_retomadas')::boolean else aceita_retomadas end
     where id = v_c.id
    returning * into v_c;
    return privado.resposta(privado.json_contato(v_c), 'Atualizou o contato ' || v_c.nome || '.', null, v_c.id);

  -- ================= NEGÓCIOS =================
  elsif p_acao = 'negocios.listar' then
    v_tel := privado.telefone(d ->> 'telefone');
    v_lim := least(greatest(coalesce(nullif(d ->> 'limite', '')::integer, 20), 1), 50);
    v_id := privado.id_de(d, 'contato_id', false);
    select coalesce(jsonb_agg(privado.json_negocio(n)), '[]'::jsonb) into v_json
      from (select n.* from public.negocios n
             where (nullif(d ->> 'status', '') is null and n.status = 'aberto' or n.status = d ->> 'status' or d ->> 'status' = 'todos')
               and (nullif(d ->> 'atendimento', '') is null or n.atendimento = d ->> 'atendimento')
               and (v_id is null or n.contato_id = v_id)
               and (nullif(trim(d ->> 'codigo'), '') is null or n.codigo = upper(trim(d ->> 'codigo')))
               and (v_tel is null or exists (select 1 from public.contatos c
                                              where c.id = n.contato_id and public.tel_norm(c.telefone) = public.tel_norm(v_tel)))
             order by n.updated_at desc limit v_lim) n;
    return privado.resposta(jsonb_build_object('negocios', v_json), 'Listou negócios: ' || jsonb_array_length(v_json) || '.');

  elsif p_acao = 'negocios.obter' then
    if nullif(trim(d ->> 'codigo'), '') is not null and nullif(d ->> 'id', '') is null then
      select * into v_n from public.negocios where codigo = upper(trim(d ->> 'codigo'));
      if not found then raise exception 'Negócio não encontrado.' using errcode = 'AU404'; end if;
    else
      v_n := privado.negocio_do_agente(privado.id_de(d, 'id'), false);
    end if;
    return privado.resposta(privado.json_negocio(v_n), 'Leu o negócio ' || v_n.codigo || '.', v_n.id, v_n.id);

  elsif p_acao = 'negocios.criar' then
    v_json := case when jsonb_typeof(d -> 'contato') = 'object' then d -> 'contato' else '{}'::jsonb end;
    if nullif(d ->> 'contato_id', '') is not null then
      v_json := v_json || jsonb_build_object('id', privado.id_de(d, 'contato_id'));
    end if;
    v_res := privado.criar_lead(v_json, case when jsonb_typeof(d -> 'evento') = 'object' then d -> 'evento' end,
                                d ->> 'titulo', coalesce(nullif(trim(d ->> 'origem'), ''), 'WhatsApp'), 'agente', d ->> 'observacoes');
    select * into v_n from public.negocios where id = (v_res ->> 'negocio_id')::uuid;
    return privado.resposta(privado.json_negocio(v_n) || jsonb_build_object('contato_ja_existia', v_res -> 'contato_ja_existia'),
                            'Criou o negócio ' || v_n.codigo || ' (' || v_n.titulo || ').', v_n.id, v_n.id, 201);

  elsif p_acao = 'negocios.atualizar' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'id'), true);
    update public.negocios
       set titulo = case when d ? 'titulo' and char_length(trim(d ->> 'titulo')) >= 2 then left(trim(d ->> 'titulo'), 120) else titulo end,
           observacoes = case when d ? 'observacoes' then nullif(left(trim(d ->> 'observacoes'), 4000), '') else observacoes end,
           tags = case when d ? 'tags' and jsonb_typeof(d -> 'tags') = 'array'
                       then coalesce((select array_agg(left(trim(x), 30)) from (select x from jsonb_array_elements_text(d -> 'tags') x
                                                                                where trim(x) <> '' limit 10) t), '{}')
                       else tags end
     where id = v_n.id
    returning * into v_n;
    return privado.resposta(privado.json_negocio(v_n), 'Atualizou o negócio ' || v_n.codigo || '.', v_n.id, v_n.id);

  elsif p_acao = 'negocios.mover_etapa' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'id'), true);
    v_id := privado.id_de(d, 'etapa_id', false);
    if v_id is null then
      select e.id into v_id from public.etapas e
       where e.funil_id = v_n.funil_id and lower(e.nome) = lower(trim(coalesce(d ->> 'etapa', ''))) limit 1;
    else
      select e.id into v_id from public.etapas e where e.id = v_id and e.funil_id = v_n.funil_id;
    end if;
    if v_id is null then
      raise exception 'Etapa não encontrada neste funil. Consulte as etapas em catalogo/funil.' using errcode = 'AU400';
    end if;
    update public.negocios set etapa_id = v_id where id = v_n.id returning * into v_n;
    return privado.resposta(privado.json_negocio(v_n),
      'Moveu ' || v_n.codigo || ' para a etapa "' || (select e.nome from public.etapas e where e.id = v_id) || '".', v_n.id, v_n.id);

  elsif p_acao = 'negocios.marcar_perdido' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'id'), true);
    v_id := privado.id_de(d, 'motivo_id', false);
    if v_id is null then
      select m.id into v_id from public.motivos_perda m where lower(m.nome) = lower(trim(coalesce(d ->> 'motivo', ''))) and m.ativo limit 1;
    else
      select m.id into v_id from public.motivos_perda m where m.id = v_id;
    end if;
    if v_id is null then
      raise exception 'Informe um motivo de perda cadastrado ("motivo" ou "motivo_id"). Consulte em catalogo/funil.' using errcode = 'AU400';
    end if;
    update public.negocios
       set status = 'perdido', motivo_perda_id = v_id, motivo_perda_detalhe = nullif(left(trim(d ->> 'detalhe'), 500), '')
     where id = v_n.id;
    select * into v_n from public.negocios where id = v_n.id;
    return privado.resposta(privado.json_negocio(v_n), 'Marcou ' || v_n.codigo || ' como perdido.', v_n.id, v_n.id);

  elsif p_acao = 'evento.atualizar' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'negocio_id'), true);
    v_ev := privado.gravar_evento(v_n.id, case when jsonb_typeof(d -> 'evento') = 'object' then d -> 'evento' else d - 'negocio_id' end);
    return privado.resposta(jsonb_build_object(
        'evento', privado.json_evento(v_ev),
        'disponibilidade', case when v_ev.data is not null
                                then privado.disponibilidade(v_ev.data, v_ev.hora_inicio, v_ev.duracao_horas, v_n.id) end),
      'Atualizou o evento de ' || v_n.codigo || '.', v_n.id, v_ev.id);

  -- ================= AGENDA =================
  elsif p_acao = 'agenda.disponibilidade' then
    if coalesce(d ->> 'data', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Informe "data" no formato AAAA-MM-DD.' using errcode = 'AU400';
    end if;
    v_json := privado.disponibilidade((d ->> 'data')::date, nullif(d ->> 'hora_inicio', '')::time,
                                      nullif(d ->> 'duracao_horas', '')::numeric, privado.id_de(d, 'negocio_id', false));
    return privado.resposta(v_json, 'Consultou a agenda de ' || to_char((d ->> 'data')::date, 'DD/MM/YYYY') || ': ' || (v_json ->> 'situacao') || '.');

  -- ================= CATÁLOGO =================
  elsif p_acao = 'catalogo.pacotes' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'nome', p.nome, 'slogan', p.slogan, 'descricao', p.descricao,
             'drinks', coalesce((select jsonb_agg(jsonb_build_object('id', dr.id, 'nome', dr.nome, 'descricao', dr.descricao,
                                                                     'alcoolico', dr.alcoolico, 'categoria', dr.categoria,
                                                                     'foto_url', privado.url_publica(dr.foto_url)) order by pd.ordem)
                                   from public.pacote_drinks pd join public.drinks dr on dr.id = pd.drink_id and dr.ativo
                                  where pd.pacote_id = p.id), '[]'::jsonb)) order by p.ordem, p.nome), '[]'::jsonb)
      into v_json from public.pacotes p where p.ativo;
    return privado.resposta(jsonb_build_object('pacotes', v_json), 'Leu os pacotes.');

  elsif p_acao = 'catalogo.drinks' then
    select coalesce(jsonb_agg(jsonb_build_object('id', dr.id, 'nome', dr.nome, 'descricao', dr.descricao, 'alcoolico', dr.alcoolico,
                                                 'categoria', dr.categoria, 'copo', dr.copo, 'foto_url', privado.url_publica(dr.foto_url),
                                                 'em_pacote', exists (select 1 from public.pacote_drinks pd where pd.drink_id = dr.id))
                              order by dr.ordem, dr.nome), '[]'::jsonb)
      into v_json from public.drinks dr where dr.ativo;
    return privado.resposta(jsonb_build_object('drinks', v_json), 'Leu os drinks.');

  elsif p_acao = 'catalogo.condicoes' then
    select * into v_cfg from public.configuracoes where unica limit 1;
    return privado.resposta(jsonb_build_object(
        'empresa', jsonb_build_object('nome', coalesce(nullif(trim(v_cfg.nome_exibicao), ''), v_cfg.nome_negocio), 'responsavel', v_cfg.responsavel,
                                      'whatsapp', v_cfg.whatsapp, 'instagram', v_cfg.instagram, 'cidade', v_cfg.cidade, 'uf', v_cfg.uf, 'site', v_cfg.site),
        'condicoes', jsonb_build_object('validade_proposta_dias', v_cfg.validade_proposta_dias,
                                        'entrada_pct', v_cfg.entrada_pct, 'entrada_dias_antes', v_cfg.entrada_dias_antes,
                                        'saldo_dias_antes', v_cfg.saldo_dias_antes, 'cancelamento_aviso_dias', v_cfg.cancelamento_aviso_dias,
                                        'cancelamento_multa_pct', v_cfg.cancelamento_multa_pct, 'taxa_quebra', v_cfg.taxa_quebra, 'foro', v_cfg.foro),
        'condicoes_confirmadas', v_cfg.entrada_pct is not null and v_cfg.entrada_dias_antes is not null and v_cfg.saldo_dias_antes is not null,
        'agenda', jsonb_build_object('capacidade_simultanea', v_cfg.capacidade_simultanea),
        'precos_aprovados', (select k.aprovada from public.calculadora k where k.unica limit 1),
        'orientacao', 'Informe ao cliente só o que estiver preenchido aqui. Campo vazio = ainda não definido: não invente; peça atendimento humano.'),
      'Leu as condições comerciais.');

  elsif p_acao = 'catalogo.funil' then
    return privado.resposta(jsonb_build_object(
        'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'ordem', e.ordem) order by e.ordem)
                              from public.etapas e
                             where e.funil_id = (select f.id from public.funis f where f.ativo order by f.ordem, f.created_at limit 1)), '[]'::jsonb),
        'motivos_perda', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) order by m.ordem, m.nome)
                                     from public.motivos_perda m where m.ativo), '[]'::jsonb),
        'origens', coalesce((select jsonb_agg(o.nome order by o.ordem, o.nome) from public.origens o where o.ativo), '[]'::jsonb),
        'tipos_evento', jsonb_build_array('casamento', '15_anos', 'aniversario', 'formatura', 'empresa', 'outro'),
        'linhas', jsonb_build_array('tradicional', 'premium')),
      'Leu o funil.');

  -- ================= PREÇO =================
  elsif p_acao = 'precos.calcular' then
    v_calc := privado.calcular_preco(d);
    if not (v_calc ->> 'ok')::boolean or not (v_calc ->> 'aprovada')::boolean then
      return privado.resposta(jsonb_build_object(
          'disponivel', false,
          'motivos', case when (v_calc ->> 'ok')::boolean
                          then jsonb_build_array('As regras de preço ainda não foram aprovadas pelo gestor.')
                          else v_calc -> 'pendencias' end,
          'orientacao', 'Não informe preço ao cliente. Monte a proposta mesmo assim (o gestor define o valor) ou peça atendimento humano.'),
        'Pediu preço: indisponível.');
    end if;
    return privado.resposta(jsonb_build_object(
        'disponivel', true, 'preco', v_calc -> 'preco_sugerido',
        'pacote', v_calc #> '{entrada,pacote}', 'convidados', v_calc #> '{entrada,convidados}',
        'duracao_horas', v_calc #> '{entrada,duracao_horas}', 'linha', v_calc #> '{entrada,linha}',
        'bartenders', v_calc -> 'bartenders',
        'drinks', (select jsonb_agg(x ->> 'nome') from jsonb_array_elements(v_calc -> 'drinks') x),
        'orientacao', 'Valor de referência pelas regras aprovadas. A proposta ainda passa pela aprovação do gestor antes de ir ao cliente.'),
      'Calculou preço: R$ ' || (v_calc ->> 'preco_sugerido') || '.');

  -- ================= PROPOSTAS =================
  elsif p_acao = 'propostas.listar' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'negocio_id'), false);
    select coalesce(jsonb_agg(privado.json_proposta(p, false) order by p.created_at), '[]'::jsonb) into v_json
      from public.propostas p where p.negocio_id = v_n.id;
    return privado.resposta(jsonb_build_object('propostas', v_json), 'Listou as propostas de ' || v_n.codigo || '.', v_n.id);

  elsif p_acao = 'propostas.obter' then
    select * into v_p from public.propostas where id = privado.id_de(d, 'id');
    if not found then raise exception 'Proposta não encontrada.' using errcode = 'AU404'; end if;
    return privado.resposta(privado.json_proposta(v_p), 'Leu a proposta ' || v_p.numero || ' v' || v_p.versao || ' (' || v_p.status || ').',
                            v_p.negocio_id, v_p.id);

  elsif p_acao = 'propostas.criar' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'negocio_id'), true);
    select p.id into v_id from public.propostas p
     where p.negocio_id = v_n.id and p.status in ('rascunho', 'aguardando_aprovacao', 'ajustes_solicitados', 'aprovada', 'enviada')
     order by p.created_at desc limit 1;
    if v_id is not null then
      raise exception 'Já existe uma proposta em andamento neste negócio (id %). Atualize essa em vez de criar outra.', v_id
        using errcode = 'AU409';
    end if;
    if jsonb_typeof(d -> 'drinks') = 'array' then
      select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(d -> 'drinks') x
       where x ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    end if;
    v_id := privado.montar_proposta(v_n.id, 'agente', v_ids);
    update public.propostas
       set capa_titulo = coalesce(nullif(left(trim(d ->> 'capa_titulo'), 160), ''), capa_titulo),
           capa_subtitulo = coalesce(nullif(left(trim(d ->> 'capa_subtitulo'), 240), ''), capa_subtitulo),
           apresentacao = coalesce(nullif(left(trim(d ->> 'apresentacao'), 400), ''), apresentacao),
           descricao_servico = coalesce(nullif(left(trim(d ->> 'descricao_servico'), 400), ''), descricao_servico),
           mensagem_final = coalesce(nullif(left(trim(d ->> 'mensagem_final'), 400), ''), mensagem_final),
           nota_interna = nullif(left(trim(d ->> 'nota'), 1000), '')
     where id = v_id
    returning * into v_p;
    return privado.resposta(privado.json_proposta(v_p),
      'Criou o rascunho ' || v_p.numero || case when v_p.preco_pendente then ' (preço a definir pelo gestor).' else '.' end,
      v_n.id, v_p.id, 201);

  elsif p_acao = 'propostas.atualizar' then
    select * into v_p from public.propostas where id = privado.id_de(d, 'id') for update;
    if not found then raise exception 'Proposta não encontrada.' using errcode = 'AU404'; end if;
    v_n := privado.negocio_do_agente(v_p.negocio_id, true);
    if v_p.status not in ('rascunho', 'ajustes_solicitados') then
      raise exception 'A proposta está "%": só rascunhos e propostas com ajustes solicitados podem ser alteradas.', v_p.status
        using errcode = 'AU409';
    end if;
    if jsonb_typeof(d -> 'drinks') = 'array' then
      select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(d -> 'drinks') x
       where x ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
      if v_ids is null then
        raise exception 'Nenhum drink válido em "drinks". Use os ids de catalogo/drinks.' using errcode = 'AU400';
      end if;
    end if;
    -- cardápio novo ou "sincronizar": refaz dados do evento, cardápio e preço pelas regras aprovadas
    if v_ids is not null or coalesce((d ->> 'sincronizar')::boolean, false) then
      perform privado.preencher_proposta(v_p.id, 'agente', v_ids);
    end if;
    update public.propostas
       set capa_titulo = case when d ? 'capa_titulo' then nullif(left(trim(d ->> 'capa_titulo'), 160), '') else capa_titulo end,
           capa_subtitulo = case when d ? 'capa_subtitulo' then nullif(left(trim(d ->> 'capa_subtitulo'), 240), '') else capa_subtitulo end,
           apresentacao = case when d ? 'apresentacao' then nullif(left(trim(d ->> 'apresentacao'), 400), '') else apresentacao end,
           descricao_servico = case when d ? 'descricao_servico' then nullif(left(trim(d ->> 'descricao_servico'), 400), '') else descricao_servico end,
           mensagem_final = case when d ? 'mensagem_final' then nullif(left(trim(d ->> 'mensagem_final'), 400), '') else mensagem_final end,
           nota_interna = case when d ? 'nota' then nullif(left(trim(d ->> 'nota'), 1000), '') else nota_interna end
     where id = v_p.id
    returning * into v_p;
    return privado.resposta(privado.json_proposta(v_p), 'Atualizou a proposta ' || v_p.numero || ' v' || v_p.versao || '.', v_n.id, v_p.id);

  elsif p_acao = 'propostas.submeter' then
    select * into v_p from public.propostas where id = privado.id_de(d, 'id') for update;
    if not found then raise exception 'Proposta não encontrada.' using errcode = 'AU404'; end if;
    v_n := privado.negocio_do_agente(v_p.negocio_id, true);
    if v_p.status not in ('rascunho', 'ajustes_solicitados') then
      raise exception 'A proposta está "%": só rascunhos e propostas com ajustes solicitados podem ser submetidas.', v_p.status
        using errcode = 'AU409';
    end if;
    update public.propostas
       set status = 'aguardando_aprovacao', aprovacao_pedida_em = now(), submetida_por = v_agente,
           nota_interna = case when d ? 'nota' then nullif(left(trim(d ->> 'nota'), 1000), '') else nota_interna end
     where id = v_p.id
    returning * into v_p;
    return privado.resposta(privado.json_proposta(v_p), 'Submeteu ' || v_p.numero || ' v' || v_p.versao || ' à aprovação do gestor.', v_n.id, v_p.id);

  elsif p_acao = 'propostas.enviar' then
    select * into v_p from public.propostas where id = privado.id_de(d, 'id') for update;
    if not found then raise exception 'Proposta não encontrada.' using errcode = 'AU404'; end if;
    v_n := privado.negocio_do_agente(v_p.negocio_id, true);
    if v_p.status = 'enviada' then
      return privado.resposta(privado.json_proposta(v_p), 'A proposta ' || v_p.numero || ' já estava enviada.', v_n.id, v_p.id);
    end if;
    if v_p.status <> 'aprovada' then
      raise exception 'A proposta está "%". Só propostas APROVADAS pelo gestor podem ser enviadas ao cliente.', v_p.status
        using errcode = 'AU409';
    end if;
    update public.propostas set status = 'enviada' where id = v_p.id returning * into v_p;
    return privado.resposta(privado.json_proposta(v_p), 'Enviou a proposta ' || v_p.numero || ' v' || v_p.versao || ' (link liberado).', v_n.id, v_p.id);

  -- ================= CONVERSA =================
  elsif p_acao = 'mensagens.registrar' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'negocio_id'), false);
    v_json := case when jsonb_typeof(d -> 'mensagens') = 'array' then d -> 'mensagens' else jsonb_build_array(d - 'negocio_id') end;
    if jsonb_array_length(v_json) = 0 or jsonb_array_length(v_json) > 50 then
      raise exception 'Envie de 1 a 50 mensagens por chamada.' using errcode = 'AU400';
    end if;
    v_int := 0; v_int2 := 0;
    for v_item in select * from jsonb_array_elements(v_json) loop
      if coalesce(v_item ->> 'direcao', '') not in ('entrada', 'saida') then
        raise exception 'Cada mensagem precisa de "direcao": "entrada" (o cliente falou) ou "saida".' using errcode = 'AU400';
      end if;
      if nullif(trim(v_item ->> 'texto'), '') is null then
        raise exception 'Cada mensagem precisa de "texto".' using errcode = 'AU400';
      end if;
      insert into public.mensagens (negocio_id, contato_id, canal, direcao, autor, texto, enviada_em, id_externo)
      values (v_n.id, v_n.contato_id,
              case when v_item ->> 'canal' in ('whatsapp', 'instagram', 'email', 'telefone', 'site', 'outro') then v_item ->> 'canal' else 'whatsapp' end,
              v_item ->> 'direcao',
              case when v_item ->> 'direcao' = 'entrada' then 'cliente'
                   when v_item ->> 'autor' in ('humano', 'sistema') then v_item ->> 'autor' else 'agente' end,
              left(v_item ->> 'texto', 8000),
              coalesce(nullif(v_item ->> 'enviada_em', '')::timestamptz, now()),
              nullif(left(trim(v_item ->> 'id_externo'), 200), ''))
      on conflict (id_externo) where id_externo is not null do nothing;
      if found then v_int := v_int + 1; else v_int2 := v_int2 + 1; end if;
    end loop;
    return privado.resposta(jsonb_build_object('gravadas', v_int, 'ja_existiam', v_int2),
                            'Registrou ' || v_int || ' mensagem(ns) em ' || v_n.codigo || '.', v_n.id, null, 201);

  elsif p_acao = 'mensagens.listar' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'negocio_id'), false);
    v_lim := least(greatest(coalesce(nullif(d ->> 'limite', '')::integer, 50), 1), 200);
    select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'direcao', m.direcao, 'autor', m.autor, 'canal', m.canal, 'texto', m.texto,
                                                 'enviada_em', m.enviada_em, 'id_externo', m.id_externo) order by m.enviada_em, m.created_at), '[]'::jsonb)
      into v_json
      from (select * from public.mensagens m
             where m.negocio_id = v_n.id
               and (nullif(d ->> 'antes', '') is null or m.enviada_em < (d ->> 'antes')::timestamptz)
             order by m.enviada_em desc, m.created_at desc limit v_lim) m;
    return privado.resposta(jsonb_build_object('mensagens', v_json), 'Leu a conversa de ' || v_n.codigo || '.', v_n.id);

  -- ================= ATENDIMENTO =================
  elsif p_acao = 'atendimento.pedir_humano' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'negocio_id'), false);
    if char_length(coalesce(trim(d ->> 'motivo'), '')) < 3 then
      raise exception 'Informe o "motivo" do pedido de atendimento humano.' using errcode = 'AU400';
    end if;
    return privado.resposta(jsonb_build_object(
        'transferido', privado.transferir(v_n.id, 'humano', d ->> 'motivo', v_agente, 'agente'), 'atendimento', 'humano'),
      'Pediu atendimento humano em ' || v_n.codigo || ': ' || left(trim(d ->> 'motivo'), 120), v_n.id);

  -- Painel do agente: uma PESSOA devolve a conversa ao agente (permissão atendimento.devolver,
  -- que fica só na chave do painel). Mesmo efeito do botão "Passar para o agente" do CRM.
  elsif p_acao = 'atendimento.encaminhar_agente' then
    v_n := privado.negocio_do_agente(privado.id_de(d, 'negocio_id'), false);
    if char_length(coalesce(trim(d ->> 'autor'), '')) < 2 then
      raise exception 'Informe em "autor" o nome da pessoa que pediu a devolução.' using errcode = 'AU400';
    end if;
    if v_n.status <> 'aberto' then
      raise exception 'Este negócio já foi encerrado (%).', v_n.status using errcode = 'AU409';
    end if;
    perform set_config('app.autor_painel', left(trim(d ->> 'autor'), 80), true);
    return privado.resposta(jsonb_build_object(
        'transferido', privado.transferir(v_n.id, 'agente',
                         concat_ws(': ', 'Pelo painel do agente, por ' || left(trim(d ->> 'autor'), 80), nullif(left(trim(d ->> 'motivo'), 400), '')),
                         null, 'humano'),
        'atendimento', 'agente'),
      'Devolveu ' || v_n.codigo || ' ao agente, a pedido de ' || left(trim(d ->> 'autor'), 80) || '.', v_n.id);

  -- ================= AVISOS (consulta) =================
  elsif p_acao = 'eventos.listar' then
    v_big := coalesce(nullif(d ->> 'depois', '')::bigint, 0);
    v_lim := least(greatest(coalesce(nullif(d ->> 'limite', '')::integer, 50), 1), 200);
    select coalesce(jsonb_agg(privado.json_evento_saida(e) order by e.id), '[]'::jsonb), coalesce(max(e.id), v_big)
      into v_json, v_big
      from (select * from public.eventos_saida e where e.id > v_big and e.tipo <> 'teste.ping' order by e.id limit v_lim) e;
    return privado.resposta(jsonb_build_object('eventos', v_json, 'proximo', v_big), null);
  end if;

  raise exception 'Ação desconhecida: %.', p_acao using errcode = 'AU404';
end;
$$;

-- ---------------------------------------------------------------------
-- A PORTA DE ENTRADA. Única função da API do agente visível de fora.
-- p_meta (opcional): { "ip": "...", "base_url": "https://app..." } vindos do servidor do sistema.
-- Devolve sempre { "status": 200|201|400|401|403|404|409|422|429|500, "dados" | "erro" }.
-- ---------------------------------------------------------------------
create or replace function public.api_agente(p_chave text, p_acao text, p_dados jsonb default '{}'::jsonb, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := clock_timestamp();
  v_ch     public.chaves_api%rowtype;
  v_escopo text;
  v_res    jsonb;
  v_status integer;
  v_cod    text;
  v_msg    text;
  v_state  text;
  v_dados  jsonb := coalesce(p_dados, '{}'::jsonb);
begin
  if p_chave is null or p_chave !~ '^aur_[0-9a-f]{48}$' then
    return jsonb_build_object('status', 401, 'erro', jsonb_build_object('codigo', 'chave_invalida', 'mensagem', 'Chave de acesso ausente ou inválida.'));
  end if;
  select * into v_ch from public.chaves_api k where k.hash = encode(sha256(convert_to(p_chave, 'utf8')), 'hex');
  if not found or not v_ch.ativa then
    return jsonb_build_object('status', 401, 'erro', jsonb_build_object('codigo', 'chave_invalida', 'mensagem', 'Chave de acesso inválida ou revogada.'));
  end if;
  if jsonb_typeof(v_dados) <> 'object' then
    return jsonb_build_object('status', 400, 'erro', jsonb_build_object('codigo', 'dados_invalidos', 'mensagem', 'O corpo do pedido precisa ser um objeto JSON.'));
  end if;
  if (select count(*) from public.agente_log l where l.chave_id = v_ch.id and l.created_at > now() - interval '1 minute') >= v_ch.limite_por_minuto then
    return jsonb_build_object('status', 429, 'erro', jsonb_build_object('codigo', 'limite', 'mensagem',
      'Limite de ' || v_ch.limite_por_minuto || ' chamadas por minuto atingido. Aguarde e tente de novo.'));
  end if;

  v_escopo := privado.escopo_da_acao(p_acao);
  if v_escopo is null then
    v_status := 404; v_cod := 'acao_desconhecida'; v_msg := 'Ação desconhecida.';
  elsif v_escopo <> '' and not (v_escopo = any(v_ch.escopos)) then
    v_status := 403; v_cod := 'sem_permissao'; v_msg := 'Esta chave não tem a permissão "' || v_escopo || '".';
  else
    perform set_config('app.agente_chave_id', v_ch.id::text, true);
    perform set_config('app.agente_vendedor_id', coalesce(privado.agente_vendedor()::text, ''), true);
    perform set_config('app.base_url', coalesce(regexp_replace(left(p_meta ->> 'base_url', 200), '/+$', ''), ''), true);
    begin
      v_res := privado.agente_executar(p_acao, v_dados);
      v_status := coalesce((v_res ->> 'status')::integer, 200);
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      v_res := null;
      v_status := case
        when v_state = 'AU400' then 400 when v_state = 'AU403' then 403 when v_state = 'AU404' then 404
        when v_state = 'AU409' then 409 when v_state = 'P0001' then 422
        when v_state = '23505' then 409 when v_state in ('23503', '23514', '23502') then 422
        when left(v_state, 2) = '22' then 400
        else 500 end;
      v_cod := case v_status when 400 then 'dados_invalidos' when 403 then 'sem_permissao' when 404 then 'nao_encontrado'
                             when 409 then 'conflito' when 422 then 'regra_de_negocio' else 'erro_interno' end;
      if v_status = 500 then
        v_msg := 'Erro interno. O gestor pode ver o detalhe no registro do agente. (' || v_state || ')' || E'\n' || v_msg;
      elsif v_state = '23505' then
        v_msg := 'Já existe um registro com esses dados.';
      elsif v_state in ('23503', '23514', '23502') then
        v_msg := 'Algum valor está fora do permitido.';
      elsif left(v_state, 2) = '22' then
        v_msg := 'Valor em formato inválido (confira datas AAAA-MM-DD, horas HH:MM e números).';
      end if;
    end;
  end if;

  insert into public.agente_log (chave_id, acao, status, ok, negocio_id, registro_id, resumo, erro, pedido, ip, duracao_ms)
  values (v_ch.id, left(p_acao, 60), v_status, v_status < 400,
          nullif(v_res ->> 'negocio_id', '')::uuid, nullif(v_res ->> 'registro_id', '')::uuid,
          left(v_res ->> 'resumo', 300), case when v_status >= 400 then left(v_msg, 500) end,
          case when length(v_dados::text) <= 4000 then v_dados
               else jsonb_build_object('_cortado', true, 'inicio', left(v_dados::text, 1500)) end,
          left(p_meta ->> 'ip', 60),
          (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer);
  update public.chaves_api set ultimo_uso_em = now() where id = v_ch.id and (ultimo_uso_em is null or ultimo_uso_em < now() - interval '1 minute');

  if v_status >= 400 then
    return jsonb_build_object('status', v_status, 'erro', jsonb_build_object('codigo', v_cod, 'mensagem', split_part(v_msg, E'\n', 1)));
  end if;
  return jsonb_build_object('status', v_status, 'dados', v_res -> 'dados');
end;
$$;
revoke all on function public.api_agente(text, text, jsonb, jsonb) from public;
grant execute on function public.api_agente(text, text, jsonb, jsonb) to anon, authenticated;

-- =====================================================================
-- A14. AUDITORIA: quem agiu foi humano, agente, cliente (link), site ou sistema
-- (redefine a função da base e liga a auditoria nas tabelas novas)
-- =====================================================================
alter table public.auditoria add column if not exists ator_tipo    text not null default 'humano';
alter table public.auditoria add column if not exists chave_api_id uuid;
create index if not exists auditoria_ator_idx on public.auditoria (ator_tipo, created_at desc);

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
  v_tipo   text := public.ator_tipo();
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
                     'calculada_em', 'ultimo_uso_em', 'atendimento_desde', 'calculo')
       and (v_novo -> k) is distinct from (v_velho -> k);
    if v_campos is null then
      return new; -- nada relevante mudou
    end if;
  end if;

  if v_tipo = 'humano' then
    select v.nome into v_autor from public.vendedores v where v.user_id = auth.uid() limit 1;
    v_autor := coalesce(v_autor, 'Usuário sem cadastro');
  else
    v_autor := case v_tipo when 'agente' then coalesce('Painel do agente (' || nullif(current_setting('app.autor_painel', true), '') || ')', 'Agente SDR')
                           when 'cliente' then 'Cliente (link da proposta)'
                           when 'site' then 'Site (formulário de orçamento)' else 'Sistema' end;
  end if;

  insert into public.auditoria (user_id, autor, tabela, registro_id, negocio_id, acao, campos, descricao, ator_tipo, chave_api_id)
  values (
    auth.uid(),
    v_autor,
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
      when tg_table_name = 'calculadora' then 'Regras de preço (calculadora)'
      when tg_table_name = 'eventos' then 'Evento' || coalesce(' de ' || to_char((v_linha ->> 'data')::date, 'DD/MM/YYYY'), ' (data a definir)')
      when tg_table_name = 'bloqueios_agenda' then 'Bloqueio de agenda a partir de ' || to_char((v_linha ->> 'inicio')::date, 'DD/MM/YYYY')
      when tg_table_name = 'chaves_api' then 'Chave de acesso: ' || (v_linha ->> 'nome')
      when tg_table_name = 'webhooks' then 'Aviso (webhook): ' || (v_linha ->> 'nome')
      else v_linha ->> 'nome' end, 160),
    v_tipo,
    nullif(current_setting('app.agente_chave_id', true), '')::uuid
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['eventos', 'insumos', 'drinks', 'pacotes', 'calculadora', 'bloqueios_agenda', 'webhooks', 'chaves_api'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.registrar_auditoria()', 'trg_' || t || '_auditoria', t);
  end loop;
end $$;

-- =====================================================================
-- A15. LGPD: exportar e apagar os dados de um contato; prazo de guarda dos leads
-- =====================================================================

-- Tudo o que o sistema guarda sobre um contato (para atender o pedido de acesso do titular).
create or replace function public.exportar_contato(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c public.contatos%rowtype;
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor exporta os dados de um contato.';
  end if;
  select * into v_c from public.contatos where id = p_id;
  if not found then
    raise exception 'Contato não encontrado.';
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'contato', to_jsonb(v_c) - 'responsavel_id' - 'origem_id' - 'empresa_id',
    'negocios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo', n.codigo, 'titulo', n.titulo, 'status', n.status, 'valor', n.valor, 'criado_em', n.created_at,
               'observacoes', n.observacoes,
               'evento', (select to_jsonb(e) - 'id' - 'negocio_id' - 'pacote_id' from public.eventos e where e.negocio_id = n.id),
               'propostas', coalesce((select jsonb_agg(jsonb_build_object('numero', p.numero, 'versao', p.versao, 'status', p.status,
                                                                         'total', p.total, 'enviada_em', p.enviada_em, 'aceita_em', p.aceita_em,
                                                                         'aceite_nome', p.aceite_nome, 'aceite_ip', p.aceite_ip) order by p.created_at)
                                        from public.propostas p where p.negocio_id = n.id), '[]'::jsonb),
               'mensagens', coalesce((select jsonb_agg(jsonb_build_object('quando', m.enviada_em, 'canal', m.canal, 'autor', m.autor, 'texto', m.texto)
                                                       order by m.enviada_em)
                                        from public.mensagens m where m.negocio_id = n.id), '[]'::jsonb),
               'atividades', coalesce((select jsonb_agg(jsonb_build_object('quando', a.quando, 'tipo', a.tipo, 'titulo', a.titulo,
                                                                          'descricao', a.descricao, 'resultado', a.resultado) order by a.quando)
                                         from public.atividades a where a.negocio_id = n.id), '[]'::jsonb)) order by n.created_at)
        from public.negocios n where n.contato_id = v_c.id), '[]'::jsonb),
    'pedidos_recebidos', coalesce((select jsonb_agg(jsonb_build_object('quando', l.created_at, 'origem', l.origem, 'dados', l.dados) order by l.created_at)
                                     from public.leads_recebidos l where l.contato_id = v_c.id), '[]'::jsonb));
end;
$$;
revoke all on function public.exportar_contato(uuid) from public, anon;
grant execute on function public.exportar_contato(uuid) to authenticated;

-- Apaga os dados pessoais de um contato (pedido de eliminação do titular ou fim do prazo de guarda).
-- Negócios FECHADOS (ganhos) são mantidos por padrão: a proposta aceita é o registro do contrato.
create or replace function privado.anonimizar_contato(p_id uuid, p_incluir_fechados boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocios uuid[];
  v_mantidos integer;
  v_tel      text;
begin
  select c.telefone into v_tel from public.contatos c where c.id = p_id;
  select coalesce(array_agg(n.id) filter (where n.status <> 'ganho' or p_incluir_fechados), '{}'),
         count(*) filter (where n.status = 'ganho' and not p_incluir_fechados)
    into v_negocios, v_mantidos
    from public.negocios n where n.contato_id = p_id;

  delete from public.mensagens where negocio_id = any(v_negocios);
  delete from public.propostas where negocio_id = any(v_negocios) and status <> 'aceita';
  update public.atividades set titulo = 'Atividade', descricao = null, resultado = null where negocio_id = any(v_negocios);
  update public.eventos set nome = null, local = null, observacoes = null where negocio_id = any(v_negocios);
  update public.negocios set titulo = 'Negócio ' || coalesce(codigo, 'sem código'), observacoes = null where id = any(v_negocios);
  update public.leads_recebidos set dados = '{}'::jsonb where contato_id = p_id or negocio_id = any(v_negocios);
  -- pedidos do site que não viraram contato (rejeitados), mas são do mesmo telefone
  if v_tel is not null then
    update public.leads_recebidos l set dados = '{}'::jsonb
     where l.contato_id is null and l.dados <> '{}'::jsonb
       and public.tel_norm(coalesce(l.dados ->> 'whatsapp', l.dados ->> 'telefone')) = public.tel_norm(v_tel);
  end if;
  update public.agente_log set pedido = null, resumo = null where negocio_id = any(v_negocios) or registro_id = p_id;
  update public.eventos_saida set dados = '{}'::jsonb where negocio_id = any(v_negocios);
  update public.auditoria set descricao = 'Dados removidos'
   where (tabela = 'contatos' and registro_id = p_id) or negocio_id = any(v_negocios);

  if v_mantidos = 0 then
    update public.contatos
       set nome = 'Contato removido', telefone = null, email = null, cpf = null, cidade = null, cargo = null,
           observacoes = null, tags = '{}', nao_contatar_motivo = null
     where id = p_id;
  end if;
  -- avisa o agente (e quem mais estiver ligado) para apagar as cópias dele; o aviso não leva dado pessoal
  perform privado.emitir_evento('contato.dados_apagados', null, null, p_id,
    jsonb_build_object('negocios', to_jsonb(v_negocios), 'contato_anonimizado', v_mantidos = 0));
  return jsonb_build_object('negocios_limpos', coalesce(array_length(v_negocios, 1), 0), 'negocios_mantidos', v_mantidos,
                            'contato_anonimizado', v_mantidos = 0);
end;
$$;

create or replace function public.anonimizar_contato(p_id uuid, p_incluir_fechados boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor apaga os dados de um contato.';
  end if;
  if not exists (select 1 from public.contatos c where c.id = p_id) then
    raise exception 'Contato não encontrado.';
  end if;
  return privado.anonimizar_contato(p_id, coalesce(p_incluir_fechados, false));
end;
$$;
revoke all on function public.anonimizar_contato(uuid, boolean) from public, anon;
grant execute on function public.anonimizar_contato(uuid, boolean) to authenticated;

-- Prazo de guarda: contatos que nunca fecharam negócio e estão parados há mais tempo que o
-- definido em Configurações (padrão 12 meses). p_simular = true só conta, não apaga.
create or replace function privado.aplicar_retencao(p_simular boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meses integer;
  v_n     integer := 0;
  r       record;
begin
  select c.retencao_leads_meses into v_meses from public.configuracoes c where c.unica limit 1;
  for r in
    select c.id from public.contatos c
     where c.nome <> 'Contato removido'
       and not exists (select 1 from public.negocios n where n.contato_id = c.id and n.status = 'ganho')
       and not exists (select 1 from public.negocios n where n.contato_id = c.id and n.status = 'aberto'
                          and greatest(n.updated_at, coalesce(n.ultima_atividade_em, n.updated_at)) > now() - make_interval(months => coalesce(v_meses, 12)))
       and greatest(c.updated_at, coalesce((select max(greatest(n.updated_at, coalesce(n.ultima_atividade_em, n.updated_at)))
                                              from public.negocios n where n.contato_id = c.id), c.updated_at))
           < now() - make_interval(months => coalesce(v_meses, 12))
  loop
    v_n := v_n + 1;
    if not coalesce(p_simular, true) then
      perform privado.anonimizar_contato(r.id, false);
    end if;
  end loop;
  -- Pedidos recebidos que nunca viraram contato (rejeitados) também vencem no mesmo prazo.
  if not coalesce(p_simular, true) then
    update public.leads_recebidos l set dados = '{}'::jsonb, ip_hash = null
     where l.contato_id is null and (l.dados <> '{}'::jsonb or l.ip_hash is not null)
       and l.created_at < now() - make_interval(months => coalesce(v_meses, 12));
  end if;
  return v_n;
end;
$$;

-- Botão "Verificar contatos fora do prazo de guarda" (só o gestor).
create or replace function public.aplicar_retencao(p_simular boolean default true)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_gestor() then
    raise exception 'Só o gestor aplica o prazo de guarda.';
  end if;
  return privado.aplicar_retencao(coalesce(p_simular, true));
end;
$$;
revoke all on function public.aplicar_retencao(boolean) from public, anon;
grant execute on function public.aplicar_retencao(boolean) to authenticated;

-- Limpeza automática: toda segunda-feira o banco aplica o prazo de guarda sozinho, se a opção
-- estiver ligada em Configurações ▸ Módulos e dados (pg_cron do Supabase; ignorado onde não existir).
create or replace function privado.retencao_automatica()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select c.retencao_automatica from public.configuracoes c where c.unica limit 1), false) then
    return 0;
  end if;
  perform set_config('app.ator', 'sistema', true);
  return privado.aplicar_retencao(false);
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'aurora-retencao';
  perform cron.schedule('aurora-retencao', '17 7 * * 1', 'select privado.retencao_automatica()');
exception when others then
  raise notice 'pg_cron indisponível: o prazo de guarda fica manual (Configurações ▸ Módulos e dados).';
end $$;

-- #####################################################################
--   FIM DA PARTE DA AURORA
-- #####################################################################


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
