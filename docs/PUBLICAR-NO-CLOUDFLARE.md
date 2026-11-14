# Colocar o sistema no ar (Supabase + Cloudflare)

Passo a passo para quem **não é programador**. Leva cerca de 40 minutos.
Você vai usar duas contas, as duas com plano gratuito para começar:

- **Supabase**: onde ficam os dados (banco) e os logins.
- **Cloudflare**: onde o sistema fica hospedado (o mesmo lugar do site).

Crie as contas **em nome da Aurora** (e-mail da empresa), não no seu e-mail pessoal: quem é dono
da conta é dono dos dados.

> **Custos.** Nada aqui é cobrado ao criar. O sistema hoje cabe no plano gratuito das duas
> contas. O que pode gerar cobrança no futuro está no fim deste documento. Não contrate nenhum
> plano pago sem decidir antes.

---

## Parte 1 — Supabase (o banco de dados)

### 1.1 Criar o projeto
1. Entre em [supabase.com](https://supabase.com) ▸ **New project**.
2. Nome: `aurora-sistema`. Crie uma **senha forte para o banco** e guarde num lugar seguro.
3. Região: **South America (São Paulo)**. Plano: **Free**.
4. Aguarde uns 2 minutos até ficar pronto.

### 1.2 Criar as tabelas e as regras
1. Menu lateral ▸ **SQL Editor** ▸ **New query**.
2. Abra o arquivo `supabase/schema.sql` deste projeto, copie **tudo** e cole no editor ▸ **Run**.
   Deve aparecer "Success. No rows returned".
3. Nova query ▸ cole **tudo** de `supabase/dados-iniciais.sql` ▸ **Run**.
   Ele cadastra a Aurora: funil de eventos, pacotes (Essencial, Signature, Reserve, Exclusive),
   drinks, insumos (sem preço), origens, motivos de perda e modelos de mensagem.

Os dois arquivos podem ser rodados de novo sem medo: não apagam nem duplicam nada. Sempre que o
sistema for atualizado, rode o `schema.sql` de novo.

### 1.3 Criar o seu login
1. **Authentication ▸ Users ▸ Add user ▸ Create new user**.
2. E-mail e senha do André. Marque **Auto Confirm User**.
3. **A primeira pessoa que entrar no sistema vira o gestor** (administrador). Entre você primeiro.

### 1.4 Fechar a porta para cadastros de fora
**Authentication ▸ Sign In / Providers** ▸ desmarque **Allow new users to sign up** ▸ **Save**.
Assim ninguém cria conta sozinho; só você, pelo painel.

### 1.5 Copiar os dois dados de conexão
**Project Settings ▸ API** (ou o botão **Connect**):
- **Project URL** (algo como `https://abcdefgh.supabase.co`)
- **Chave pública**: `anon` ou `publishable` (começa com `eyJ...` ou `sb_publishable_...`)

> Nunca use a chave `service_role` / `secret`. O sistema não precisa dela, e ela ignora toda a
> segurança do banco.

---

## Parte 2 — Cloudflare (a hospedagem)

O código já está no GitHub. O Cloudflare lê o repositório, monta o sistema e publica. A cada
atualização do código, ele publica de novo sozinho.

### 2.1 Criar o Worker a partir do repositório
1. No painel do Cloudflare ▸ **Workers & Pages** ▸ **Create** ▸ **Import a repository**.
2. Autorize o Cloudflare a ver o repositório do sistema no GitHub e selecione-o.
3. Nome do projeto: `aurora-sistema`.
4. Preencha os comandos:
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
5. **Antes de publicar**, abra as **variáveis de build** (Build variables) e cadastre as duas:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | o Project URL do passo 1.5 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave pública do passo 1.5 |

   Elas precisam estar nas variáveis **de build**: o sistema as "embute" na hora de montar.
6. **Save and Deploy**. A primeira publicação leva de 3 a 5 minutos.

Os nomes dos botões no painel do Cloudflare mudam de vez em quando. Se algo estiver diferente,
procure por "Workers Builds" ou "Connect to Git"; os comandos e as variáveis são os mesmos.

### 2.2 Endereço próprio
1. No Worker ▸ **Settings ▸ Domains & Routes ▸ Add ▸ Custom domain**.
2. Digite `app.aurorabartendersaraxa.com.br`. Como o domínio já está no Cloudflare, ele cria o
   registro sozinho. Em alguns minutos o sistema abre nesse endereço.

### 2.3 Avisar o Supabase do endereço
No Supabase ▸ **Authentication ▸ URL Configuration**:
- **Site URL:** `https://app.aurorabartendersaraxa.com.br`
- **Redirect URLs:** adicione `https://app.aurorabartendersaraxa.com.br/**`

Sem isso, o link de "Esqueci minha senha" não volta para o sistema.

### 2.4 Primeiro acesso
1. Abra `https://app.aurorabartendersaraxa.com.br` e entre com o login do passo 1.3.
2. Se aparecer a tela "Configure as variáveis de ambiente", as variáveis do passo 2.1 não foram
   salvas como variáveis de build: corrija e publique de novo (**Deployments ▸ Retry**).

---

## Parte 3 — Deixar pronto para usar

Dentro do sistema, nesta ordem:

1. **Configurações ▸ Empresa**: confira os dados da Aurora.
2. **Configurações ▸ Propostas e agenda**: preencha as **condições comerciais** (entrada, saldo,
   cancelamento, taxa de quebra, validade). Elas começam **vazias de propósito**: enquanto não
   forem confirmadas, não aparecem nas propostas e o agente não as informa.
3. **Catálogo ▸ Insumos**: preço de cada insumo, nas linhas Tradicional e Premium.
4. **Catálogo ▸ Drinks**: confira as receitas (foram cadastradas como sugestão).
5. **Catálogo ▸ Calculadora**: consumo por convidado, bartenders, mão de obra, margem. Use o
   simulador e, quando os valores fizerem sentido, clique em **Conferi e aprovo as regras de preço**.
6. **Personalização**: logo e cores já vêm com a identidade da Aurora; ajuste se quiser.
7. **Equipe**: cadastre outras pessoas (e crie o login de cada uma no Supabase, mesmo e-mail).

Depois disso:

- **Site**: entregue a pasta `integracao-site/` a quem cuida do site (veja o `LEIA-ME.md` dela).
  O site só deve ser alterado **depois** que o sistema estiver no ar e a política de privacidade
  nova estiver pronta para publicar junto.
- **Agente**: quando for construir, entregue `docs/API-DO-AGENTE.md`. A chave é criada em
  **Integrações**.

### Conferir os avisos automáticos (5 minutos, uma vez)
Os avisos para o agente e a limpeza semanal de dados antigos usam dois recursos do Supabase
(`pg_net` e `pg_cron`). O `schema.sql` liga os dois sozinho. Para conferir:
1. Supabase ▸ **Database ▸ Extensions**: `pg_net` e `pg_cron` devem estar ligados.
   Se não estiverem, ligue e rode o `schema.sql` de novo.
2. No sistema ▸ **Integrações ▸ Novo aviso**: cadastre um endereço de teste (por exemplo, um
   endereço gerado em webhook.site) e clique em **Enviar teste**. Em "Últimos avisos" deve
   aparecer "entregue". Depois, exclua o aviso de teste.

Este teste com o Supabase de verdade ainda não foi feito: o ambiente onde o sistema foi
construído não alcança o Supabase. Todo o resto foi testado.

---

## Custos e limites (para decidir com calma)

| Serviço | Hoje | Quando pode passar a custar |
|---|---|---|
| **Supabase Free** | US$ 0 | O projeto gratuito **pausa após cerca de 7 dias sem uso** e não tem backup automático. Para uso de verdade no dia a dia, o plano Pro (cerca de US$ 25/mês) resolve os dois. |
| **Cloudflare Workers Free** | US$ 0 | O sistema ocupa hoje **2,8 MB de um limite de 3 MB** do plano gratuito. Se uma atualização futura passar do limite, a publicação falha (o que já está no ar continua funcionando) e será preciso o plano pago (cerca de US$ 5/mês, limite de 10 MB). |
| Domínio | já existe | — |

Os valores são aproximados e em dólar; confira nas páginas de preço antes de contratar.
WhatsApp oficial (API) e a IA do agente não fazem parte deste sistema e têm custo à parte.

## Segurança e cuidados

- O repositório no GitHub está **público**. Não há senha nem chave nele, mas o recomendado é
  torná-lo **privado**: GitHub ▸ repositório ▸ **Settings ▸ General ▸ Change visibility**.
- Ative a verificação em duas etapas nas contas do Supabase, Cloudflare e GitHub.
- Backup: no plano gratuito do Supabase, faça de tempos em tempos **Database ▸ Backups** (ou
  exporte os dados). No plano Pro o backup é diário e automático.
- Quem sai da equipe: em **Equipe**, desmarque "Ativo". No Supabase, apague o usuário.
