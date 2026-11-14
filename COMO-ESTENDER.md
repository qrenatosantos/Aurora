# Como estender esta base

Guia para quem (pessoa ou IA) vai construir um app em cima desta base. Siga os padrões abaixo para que todos os apps Tetra fiquem iguais por dentro.

## O que a Aurora acrescentou a esta base

Este projeto é a base "Gestão Comercial" adaptada para a Aurora Bartenders. Além do que este guia
descreve, existem:

```
app/(app)/eventos/           agenda de eventos, consulta de data e bloqueios
app/(app)/catalogo/          pacotes, drinks (receitas), insumos e calculadora de preço
app/(app)/integracoes/       chaves do agente, avisos (webhooks), fila e registro do agente
app/(app)/negocios/[id]/     cartao-evento.tsx e atendimento.tsx (agente/humano + conversa)
app/(app)/propostas/[id]/    editor-proposta.tsx e acoes-proposta.tsx (fluxo de aprovação)
app/proposta/[codigo]/       página pública da proposta (aceite do cliente)
app/api/v1/[...rota]/        API do agente (só traduz HTTP → função api_agente do banco)
app/api/publico/leads/       entrada dos pedidos do site (função receber_lead_site)
components/aurora/           documento-aurora.tsx (proposta em páginas) e memoria-calculo.tsx
lib/aurora.ts                listas e textos da Aurora (tipos de evento, situações, permissões)
lib/proposta-textos.ts       textos padrão da proposta
lib/api/rotas-agente.ts      ÚNICA lista de endereços da API (a documentação e o OpenAPI saem daqui)
supabase/dados-iniciais.sql  cadastros reais da Aurora (substitui o seed de exemplo)
supabase/testes/             testes das regras do banco (npm run test:banco)
docs/  integracao-site/      guias e pacote para o site
```

Regras próprias deste projeto:

- **Regra importante mora no banco.** Aprovação de proposta, preço, agenda, permissões do agente
  e LGPD são funções e gatilhos do `schema.sql` (seções A1 a A15). A tela e a API só chamam.
  Ao mudar uma regra, acrescente ou ajuste um teste em `supabase/testes/regras.test.mjs`.
- **Funções internas ficam no esquema `privado`** (não exposto pela API do Supabase). As públicas
  conferem quem chamou e repassam.
- **Nova ação do agente**: função em `privado.agente_executar`, permissão em
  `privado.escopo_da_acao`, e a rota em `lib/api/rotas-agente.ts`. Depois, atualize
  `docs/API-DO-AGENTE.md`.
- **Sem chave secreta.** O sistema usa só a chave pública do Supabase; não adicione `service_role`.
- **Hospedagem**: Cloudflare Workers via OpenNext (`wrangler.jsonc`, `open-next.config.ts`).
  O limite do plano gratuito é 3 MB compactados: confira com `npx wrangler deploy --dry-run`
  antes de adicionar bibliotecas grandes.

## Estrutura

```
app/
  layout.tsx                 raiz: aplica a MARCA (cores, fonte, raio, tema padrão, título, favicon), toasts, confirmação
  fontes.ts                  as fontes das 6 combinações (next/font, variáveis --ff-*)
  globals.css                tokens de cor (:root/.dark → bg-marca, bg-destaque, text-texto-2...), data-fonte, data-raio
  icone/route.tsx            favicon com as iniciais na cor da marca (quando não há logo)
  (app)/                     páginas LOGADAS (o "(app)" não aparece na URL)
    layout.tsx               app shell: sidebar, barra inferior, topo com logo + nome exibido
    loading.tsx / error.tsx  skeleton e tela de erro automáticos
    page.tsx                 "/"  início
    configuracoes/           "/configuracoes"  ← EXEMPLO COMPLETO de leitura + gravação
      page.tsx               lê no servidor
      form-configuracoes.tsx formulário (client) com useAcao
      actions.ts             Server Actions (mutations)
    personalizacao/          "/personalizacao"  logo (Storage), cores, fonte, nome exibido, tema, raio + prévia ao vivo
      actions.ts             upload validado + salvar/restaurar
      botao-restaurar.tsx    ação de 1 clique com confirmação (modelo)
  login/  redefinir-senha/   telas públicas de autenticação
  auth/confirmar/route.ts    recebe o link do e-mail de recuperação
  configurar-ambiente/       tela mostrada quando faltam as variáveis
components/
  ui/                        Botao, Campo/Entrada/AreaTexto/Selecao, Cartao, CabecalhoPagina, Selo,
                             EstadoVazio, Skeleton, toast (useToast), confirmar (useConfirmar), TemaToggle
  shell/                     Sidebar, BottomNav, MenuUsuario
  logo-negocio.tsx           <LogoNegocio /> (logo ou iniciais) — menu, login, documentos impressos
lib/
  navegacao.ts               MENU (sidebar + barra inferior) e NOME_APP
  rotas.ts                   ROTAS PÚBLICAS (único lugar)
  supabase/                  client.ts (browser), server.ts (servidor), middleware.ts (sessão), env.ts
  acoes.ts                   EstadoAcao, sucesso/falha, errosDoZod, mensagemErroBanco
  use-acao.ts                hook de formulário → Server Action (+ toast)
  configuracoes.ts           obterConfiguracoes() (cacheado por requisição)
  marca.ts                   paletas, fontes, contraste WCAG, cssMarca(), normalizarMarca() — puro (servidor e navegador)
  marca-servidor.ts          obterMarca() — marca_publica(), funciona sem login, fallback seguro
  formatar.ts                moeda, datas, telefone BR, hojeISO, lerMoeda, iniciais
  whatsapp.ts                linkWhatsApp(numero, mensagem), preencherModelo("Oi {nome}", {...})
  tipos.ts                   tipos TS das tabelas (formato do `supabase gen types`)
proxy.ts                     Next 16: antigo middleware.ts — renova sessão e protege rotas
supabase/schema.sql          tabelas + RLS (idempotente)   supabase/seed.sql  dados de exemplo
```

## Padrão de dados (OBRIGATÓRIO em todos os apps)

- **Ler**: em Server Components (`page.tsx` async) com `const supabase = await createClient()` de `@/lib/supabase/server`.
- **Gravar (mutations)**: **Server Actions** em `actions.ts` (arquivo com `"use server"`), sempre:
  1. validar com **zod** → `falha("Confira os campos destacados.", errosDoZod(erro))`
  2. gravar com o cliente do servidor (respeita RLS)
  3. `revalidatePath("/rota")` (ou `revalidatePath("/", "layout")` se o topo/menu mudar)
  4. devolver `EstadoAcao` via `sucesso("Cliente salvo.")` / `falha(mensagemErroBanco(error))`
- **Formulários** (client): `const { onSubmit, erros, pendente } = useAcao(minhaAction)` + `<form onSubmit={onSubmit} noValidate>` + `<Botao type="submit" carregando={pendente}>`. O hook já mostra o toast. Use `aoSucesso` para fechar modal/limpar/navegar.
- **Ações de 1 clique** (excluir, mudar status, arrastar card): `useTransition` + chamar a action direto (`await excluirCliente(id)`) + toast. **Excluir sempre com `useConfirmar()`** (veja `personalizacao/botao-restaurar.tsx`).
- Telas muito interativas (PDV, kanban) podem manter estado local no client e chamar actions para persistir (atualização otimista com `useOptimistic` se quiser). **Não** use o cliente browser do Supabase para gravar.
- O cliente browser (`lib/supabase/client.ts`) fica só para coisas que exigem browser (ex.: realtime).

Exemplo mínimo de action com id:
```ts
"use server";
export async function excluirCliente(id: string): Promise<EstadoAcao> {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return falha(mensagemErroBanco(error));
  revalidatePath("/clientes");
  return sucesso("Cliente excluído.");
}
```
Para passar um id num formulário: `<input type="hidden" name="id" value={cliente.id} />`.

## Adicionar uma tabela
1. **`supabase/schema.sql`**: copie o modelo comentado no fim do arquivo. Regras:
   - `create table if not exists`, `id uuid primary key default gen_random_uuid()`, `created_at`, `updated_at`
   - trigger `set_updated_at` (com `drop trigger if exists` antes)
   - FKs (`references public.x(id) on delete cascade|restrict|set null`), `check`s e `create index if not exists`
   - `alter table ... enable row level security` + as 4 políticas `to authenticated using (true) with check (true)` (com `drop policy if exists` antes)
   - valores monetários: `numeric(12,2)`; datas sem hora: `date`; data/hora: `timestamptz`; status: `text` + `check (status in (...))`
   - se adicionar coluna a uma tabela existente: `alter table ... add column if not exists ...`
2. **`supabase/seed.sql`**: dados de exemplo com datas relativas (`now() + interval '2 days'`, `current_date - 3`), idempotente (ids fixos + `on conflict (id) do nothing`, ou `delete` dos exemplos antes). Nunca coloque seed no schema.
3. **`lib/tipos.ts`**: copie o bloco de `configuracoes` (Row / Insert / Update / Relationships) e crie o atalho `export type Cliente = Linha<"clientes">`.
4. Valide o SQL (seção abaixo).

## Adicionar uma página
Crie `app/(app)/clientes/page.tsx` (fica protegida automaticamente). Use `CabecalhoPagina`, `Cartao`, `EstadoVazio` quando a lista estiver vazia e, se a página demorar, um `loading.tsx` com `Skeleton`. Detalhe/edição: `app/(app)/clientes/[id]/page.tsx` (no Next 16 `params` é `Promise` → `const { id } = await params`).

## Adicionar um item de menu
Em `lib/navegacao.ts`, adicione `{ titulo: "Clientes", href: "/clientes", icone: Users, celular: true }` (ícone importado de `lucide-react`). No celular aparecem até 4 itens com `celular: true`; os demais vão para "Mais".

## Rota pública (sem login)
Adicione o caminho em `ROTAS_PUBLICAS` (`lib/rotas.ts`). Coloque a página FORA de `app/(app)/` (ex.: `app/cardapio/page.tsx`) para não herdar o app shell. Se ela lê o banco sem login, crie no `schema.sql` uma política só de leitura para `anon`, restrita ao necessário:
```sql
drop policy if exists "itens_select_publico" on public.itens;
create policy "itens_select_publico" on public.itens for select to anon using (ativo = true);
```
Nome, logo, cores e fonte já funcionam sem login: use `const marca = await obterMarca()` (lê a função `marca_publica()`; o layout raiz já aplica cores/fonte). Só se a página pública precisar de outros dados de `configuracoes` (WhatsApp, endereço), crie uma política `to anon` de SELECT nela.

## Configurações do negócio
Novos campos (ex.: `horario_funcionamento`, `chave_pix`): coluna no `schema.sql` via `alter table public.configuracoes add column if not exists ...`, tipo em `lib/tipos.ts`, `CONFIG_PADRAO` em `lib/configuracoes.ts`, campo no zod de `actions.ts` e no formulário. Leia em qualquer Server Component com `await obterConfiguracoes()`.

## Marca do cliente (tela Personalização — sem código)
O dono escolhe logo, cores, fonte, nome exibido, subtítulo, tema padrão e arredondamento em `/personalizacao`.
Colunas em `configuracoes` (`logo_url`, `cor_primaria`, `cor_destaque`, `fonte`, `raio`, `tema_padrao`, `nome_exibicao`, `subtitulo`);
logo no Storage (bucket público `marca`, escrita só `authenticated`); leitura pública pela função `marca_publica()`
(security definer, devolve SÓ campos de marca — `configuracoes` continua fechada para `anon`).
`app/layout.tsx` aplica a marca em TODAS as páginas: `<style id="marca-css">` (cssMarca), `data-fonte`, `data-raio`, script do tema e favicon.

- **Logo em qualquer tela** (inclusive documentos impressos):
  ```tsx
  import { LogoNegocio } from "@/components/logo-negocio";
  import { obterMarca } from "@/lib/marca-servidor";
  const marca = await obterMarca();                       // Server Component
  <LogoNegocio nome={marca.nome} logoUrl={marca.logoUrl} tamanho="lg" decorativa={false} />
  ```
  Tamanhos `sm | md | lg | xl`. Sem logo mostra as iniciais sobre `bg-marca`. `decorativa` (padrão `true`) = o nome já está escrito ao lado.
  Em Client Components, receba `nome`/`logoUrl` por props do Server Component.
- **Nome/subtítulo**: `marca.nome` (nome exibido ou, se vazio, o nome do negócio) e `marca.subtitulo ?? SUBTITULO_PADRAO_MENU`.
  `NOME_APP`/`DESCRICAO_APP` (`lib/navegacao.ts`) são só o padrão.
- **Campo de marca próprio do app** (ex.: `capa_url` do cardápio): coluna + CHECK no SQL, acrescente no `returns table` e no
  `select` de `marca_publica()`, em `lib/tipos.ts` (Row/Insert e `Functions`), em `Marca`/`normalizarMarca` (`lib/marca.ts`, sempre validando),
  no zod de `personalizacao/actions.ts` e no formulário. Leia com `obterMarca()`.
- **Nova paleta ou fonte**: `PALETAS` / `FONTES` em `lib/marca.ts` (fonte: também `app/fontes.ts`, bloco `[data-fonte]` no
  `globals.css` e o `check (fonte in (...))` do SQL). A PRIMEIRA paleta é o padrão do app e do "Restaurar padrão".

### COMO APLICAR ESTA PERSONALIZAÇÃO NUM APP EXISTENTE
Passo a passo completo (com o SQL pronto para colar e os greps de levantamento): [`PERSONALIZACAO-PATCH.md`](PERSONALIZACAO-PATCH.md). Resumo:
1. **SQL**: cole no `schema.sql` do app o bloco "PERSONALIZAÇÃO DA MARCA" da base (colunas + CHECKs, `marca_publica()`, bucket `marca` + 4 políticas em `storage.objects`), logo depois da tabela `configuracoes`.
2. **Copie sem mudar**: `lib/marca.ts`, `lib/marca-servidor.ts`, `app/fontes.ts`, `app/icone/route.tsx`, `components/logo-negocio.tsx`, `app/(app)/personalizacao/` (page, form-personalizacao, previa-marca, actions, botao-restaurar).
3. **Mescle**: `lib/tipos.ts`, `lib/configuracoes.ts` (CONFIG_PADRAO), `lib/rotas.ts` (`/icone`), `lib/navegacao.ts` (item de menu), `next.config.ts` (bodySizeLimit 2mb), `app/globals.css`, `app/layout.tsx`, `app/(app)/layout.tsx` (**apague** o `<style>{--marca}` antigo), `components/shell/*`, `components/tela-auth.tsx`, Configurações (tirar o campo de cor e o restaurar aparência).
4. **Apague** `app/icon.svg`; troque quadradinhos de iniciais e cabeçalhos de documentos por `<LogoNegocio />`.
5. **Valide**: build/lint, PGlite 2× com o stub do `storage` (abaixo), Supabase local 2×, anon (`configuracoes` → `[]`, `marca_publica` ok, upload 403) e o E2E modelo.

## Visual
- Cores: tokens de `app/globals.css`. Use SEMPRE os tokens (`bg-superficie`, `text-texto-2`, `border-borda`, `bg-marca`, `text-marca-forte`, `bg-destaque`, `bg-ok-suave text-ok`...), nunca cores fixas — assim o modo escuro e a marca escolhida pelo dono funcionam sozinhos. **Não** fixe a cor da marca no CSS: ela vem da tela Personalização.
- Cor principal: `bg-marca` + `text-marca-texto` (branco/preto automático), texto colorido `text-marca-forte` (contraste nos dois temas), fundo leve `bg-marca-suave`.
- Cor de destaque: `bg-destaque` + `text-destaque-texto` (selos "Novo", "Hoje"), `bg-destaque-suave` + `text-destaque-forte` (faixas de aviso).
- Fontes: `font-sans` (texto) e `font-titulo` (h1–h3 já usam). A combinação vem de `data-fonte` no `<html>`.
- Cantos: use `rounded-lg`/`rounded-xl`/`rounded-2xl` — o arredondamento escolhido (`data-raio`) ajusta todos.
- Alvos de toque ≥ 44px (`min-h-11`), rótulos em todos os campos (`Campo`), `aria-label` em botões só com ícone.
- Impressão: `.nao-imprimir` esconde elementos; menus/topo já saem da impressão.
- Nome padrão do produto/descrição: `NOME_APP` e `DESCRICAO_APP` em `lib/navegacao.ts` (o dono troca o nome exibido na Personalização); troque também `name` no `package.json`.

## Validar o SQL no PGlite (sem Supabase)
Numa pasta TEMPORÁRIA fora do projeto:
```bash
npm init -y && npm i -D @electric-sql/pglite
```
`validar.mjs`:
```js
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create schema auth; create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role anon; create role authenticated; create role service_role;`);
for (const i of [1, 2]) {            // 2 vezes = prova de idempotência
  await db.exec(readFileSync(process.argv[2], "utf8"));
  await db.exec(readFileSync(process.argv[3], "utf8"));
  console.log("rodada", i, "OK");
}
```
`node validar.mjs caminho/schema.sql caminho/seed.sql`

O `schema.sql` cria o bucket `marca` no schema `storage` (só existe no Supabase). No PGlite, crie antes um stub
(junto com o de `auth`):
```sql
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
```

## Checklist antes de entregar um app
- `npm run build`, `npm run lint` e `npm run test:banco` sem erros
- SQL validado 2× (PGlite ou Supabase local)
- Telas testadas em 390px e 1440px, claro e escuro, sem erros no console
- Pasta limpa: sem `node_modules`, `.next`, `.env.local`, screenshots ou scripts de teste
