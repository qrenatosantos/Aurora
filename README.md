# Gestão Comercial (CRM + Vendas) — Next.js + Supabase

Sistema comercial completo para pequenas e médias empresas que vendem para outras empresas ou para o consumidor (exemplo: **Lumen Soluções em TI**, revenda de equipamentos e serviços de TI). Funil de vendas arrastável, contatos e empresas, agenda de follow-up, propostas com **link para o cliente aceitar**, metas, comissões e relatórios. Funciona no celular e no computador (o vendedor usa na rua), com login da equipe, dados na nuvem (Supabase) e hospedagem grátis (Vercel).

**Telas**
- **Início** — lembretes do dia (atividades atrasadas e de hoje), vendido no mês, valor em aberto, negócios "esfriando" (sem contato há X dias), negócios sem próxima atividade, meta do mês com projeção, propostas aceitas e (para o gestor) propostas aguardando aprovação de desconto.
- **Funil** — kanban arrastável (mouse e dedo) com valor total e probabilidade por etapa, previsão ponderada, áreas **Ganho** e **Perdido** para soltar o card, próxima atividade e "dias sem contato" em cada card. Filtros por funil, vendedor, etiqueta, data de criação e previsão de fechamento.
- **Negócio** — barra de etapas (toque para mudar), Ganho / Perdido (motivo obrigatório) / Reabrir, **produtos** com desconto (respeitando o máximo), **registro rápido de interação**, agenda de próximos passos, botão **WhatsApp e e-mail com modelos de mensagem**, propostas, **histórico de etapas com o tempo em cada uma** e a comissão calculada.
- **Negócios** — lista com ganhos e perdidos, busca, filtros e exportação CSV.
- **Agenda** — atrasadas, hoje, próximas e concluídas; concluir com 1 toque, adiar 1 dia/1 semana, editar.
- **Contatos** — pessoas (física ou ligadas a uma empresa), etiquetas, origem do lead, responsável, WhatsApp direto, **aviso de duplicado** (e-mail/telefone) ao cadastrar e exportação CSV.
- **Importar leads (CSV)** — escolha o arquivo, ligue as colunas (adivinhadas pelo cabeçalho), **confira duplicados** antes de gravar e importe (até 2.000 linhas por vez; cria as empresas que não existem).
- **Empresas** — pessoa jurídica com vários contatos, negócios, atividades, quanto já comprou e quanto está em negociação.
- **Propostas** — montadas a partir do negócio (itens, descontos, condições de pagamento, prazo, validade), **aprovação do gestor** quando o desconto passa do limite, envio com **link público**, aviso de quando o cliente abriu, **versões** (v1, v2…), aceite manual ou pelo cliente, documento **imprimível/PDF com a logo**.
- **`/proposta/[código]` (página pública do cliente)** — o cliente vê a proposta com a marca da empresa e clica em **Aceitar proposta** (registra nome, data, hora, IP e navegador).
- **Produtos e serviços** — preço, unidade e **desconto máximo permitido**.
- **Metas** — por vendedor e por equipe, mensais (valor e nº de vendas), barras de progresso e **projeção** para o fim do mês; o gestor define e copia do mês anterior.
- **Comissões** — extrato do mês com "como foi calculada", totais pagos/a pagar, **marcar como paga** (gestor) e **Regras de comissão** (por vendedor, por produto, com faixas de valor).
- **Relatórios** — funil de conversão por etapa, taxa de conversão, ciclo médio de venda, ticket médio, ganhos × perdidos, motivos de perda, receita prevista ponderada, ranking de vendedores, tempo médio em cada etapa, origens que mais convertem e atividades realizadas. Filtros de período/funil/vendedor e **exportar CSV**.
- **Equipe** (gestor) — vendedores, papéis (gestor/vendedor), equipes, cor, ativo e quem ainda não entrou.
- **Configurações** (gestor) — empresa e regras comerciais ("vendedores veem tudo", validade padrão, dias para "esfriar", condições padrão, rodapé da proposta), **funis e etapas** (com % de probabilidade), **origens e motivos de perda** e **modelos de mensagem**.
- **Personalização** (gestor) — logo, cores (9 paletas prontas ou as suas), fonte, nome exibido, subtítulo, tema padrão e cantos, com prévia ao vivo. Sem mexer em código.
- **Auditoria** — quem criou, alterou ou excluiu negócios, propostas, comissões, metas e cadastros.

**Tabelas:** `configuracoes`, `equipes`, `vendedores`, `origens`, `motivos_perda`, `modelos_mensagem`, `funis`, `etapas`, `produtos`, `empresas`, `contatos`, `negocios`, `negocio_produtos`, `historico_etapas`, `atividades`, `propostas`, `proposta_itens`, `metas`, `regras_comissao`, `comissoes`, `auditoria` e `contadores`. Funções públicas seguras da proposta: `proposta_publica` e `aceitar_proposta_publica`.

**Papéis (regra no banco, RLS de verdade):**
- **Gestor comercial (administrador)** — vê e edita tudo, define metas, regras e pagamentos de comissão, aprova descontos, vê os relatórios do time, a Equipe, as Configurações e a Auditoria.
- **Vendedor** — vê e edita **só os próprios** contatos, empresas, negócios, propostas e atividades; vê o ranking e as metas do time; vê só as próprias comissões. Com **"Vendedores veem tudo"** ligado (Configurações), passa a *ver* os dados do time, mas continua *editando* só os seus.
- O vínculo do login é pelo **e-mail**; o **primeiro usuário** a entrar vira gestor.

**Regras que ficam no banco (não dá para burlar pelo navegador):**
- **Histórico de etapas automático**: toda mudança de etapa ou de situação grava de → para, quem moveu e quanto tempo o negócio ficou na etapa anterior.
- **Ganho exige valor maior que zero**; **perda exige motivo**; a etapa é sempre do mesmo funil do negócio.
- **Desconto acima do máximo do produto**: no negócio, só o gestor; na proposta, ela só pode ser **enviada** (e aceita) depois da **aprovação do gestor**. Mudar os itens desfaz a aprovação.
- **Comissão calculada pelo banco** ao ganhar o negócio (regra mais específica: vendedor + produto > produto > vendedor > geral; faixas pelo valor do negócio). Se o negócio mudar **antes** de a comissão ser paga, ela é recalculada; depois de paga, o negócio fica travado (valor, vendedor e situação) até o gestor desfazer o pagamento.
- **Aceite da proposta atômico e único**: trava a proposta, confere situação e validade, registra nome/data/IP e não deixa aceitar duas vezes (nem duas propostas do mesmo negócio). O aceite marca o negócio como **ganho** com o valor da proposta (e os itens viram os produtos do negócio).
- Proposta enviada não muda: para alterar, **nova versão** (a anterior fica "substituída" e o link antigo avisa o cliente).
- **Importação**: duplicados por e-mail ou telefone (com ou sem +55) são detectados em toda a base, inclusive dentro do próprio arquivo.
- Funções internas sem permissão para `public` e `anon`; o visitante **não lê nenhuma tabela**.

**Rotas públicas:** `/proposta/[código]` (proposta do cliente), login, recuperação de senha e o ícone da aba (`/icone`). Tudo o mais exige login.

---

## Mapa de telas (URLs)

Troque `seu-app.vercel.app` pelo endereço do seu projeto na Vercel.

| Endereço | O que é | Acesso |
|---|---|---|
| `seu-app.vercel.app` | Início: lembretes, meta do mês, negócios esfriando | 🔒 Login |
| `seu-app.vercel.app/funil` | Funil de vendas (kanban arrastável) | 🔒 Login |
| `seu-app.vercel.app/negocios` | Lista de negócios (abertos, ganhos e perdidos) e CSV | 🔒 Login |
| `seu-app.vercel.app/negocios/[id]` | Negócio: etapas, produtos, atividades, propostas, histórico e comissão | 🔒 Login |
| `seu-app.vercel.app/agenda` | Agenda: atrasadas, hoje, próximas e concluídas | 🔒 Login |
| `seu-app.vercel.app/contatos` | Contatos (leads e clientes) | 🔒 Login |
| `seu-app.vercel.app/contatos/[id]` | Ficha do contato | 🔒 Login |
| `seu-app.vercel.app/contatos/importar` | Importar leads por CSV | 🔒 Login |
| `seu-app.vercel.app/empresas` | Empresas (pessoa jurídica) | 🔒 Login |
| `seu-app.vercel.app/empresas/[id]` | Ficha da empresa com os contatos dela | 🔒 Login |
| `seu-app.vercel.app/propostas` | Todas as propostas (e as que aguardam aprovação) | 🔒 Login |
| `seu-app.vercel.app/propostas/[id]` | Montar, aprovar, enviar, versões e documento/PDF | 🔒 Login |
| `seu-app.vercel.app/proposta/[código]` | Proposta para o cliente ver e **aceitar** (link enviado pelo vendedor) | 🌐 Pública |
| `seu-app.vercel.app/produtos` | Produtos e serviços: preço, unidade e desconto máximo | 🔒 Login |
| `seu-app.vercel.app/metas` | Metas do mês por vendedor e equipe, com projeção | 🔒 Login |
| `seu-app.vercel.app/comissoes` | Extrato de comissões do mês | 🔒 Login |
| `seu-app.vercel.app/comissoes/regras` | Regras de comissão | 🔒 Login |
| `seu-app.vercel.app/relatorios` | Painel e relatórios (com exportação CSV) | 🔒 Login |
| `seu-app.vercel.app/equipe` | Vendedores e equipes | 🔒 Gestor |
| `seu-app.vercel.app/configuracoes` | Empresa e regras comerciais (+ abas Funis, Origens e motivos, Modelos de mensagem) | 🔒 Gestor |
| `seu-app.vercel.app/personalizacao` | Logo, cores, fonte, nome exibido e tema — sem código | 🔒 Gestor |
| `seu-app.vercel.app/auditoria` | Quem alterou o quê | 🔒 Login (gestor vê tudo) |
| `seu-app.vercel.app/login` | Entrar no app (e-mail e senha criados no Supabase) | 🌐 Pública |
| `seu-app.vercel.app/redefinir-senha` | Criar senha nova (aberto pelo link do e-mail "Esqueci minha senha") | 🌐 Pública |
| `seu-app.vercel.app/configurar-ambiente` | Aparece sozinha quando faltam as variáveis do Supabase na Vercel | 🌐 Pública |

`[id]` e `[código]` são preenchidos pelo próprio app — os links completos saem prontos nos botões "Copiar link" e de WhatsApp. **Pública** = abre sem login (pode mandar para o cliente final); **Login** = só a equipe, depois de entrar; **Gestor** = só o administrador.


## Passo a passo (do zero ao ar)

Você vai precisar de contas gratuitas em: [supabase.com](https://supabase.com), [github.com](https://github.com) e [vercel.com](https://vercel.com).

### 1. Criar o projeto no Supabase
1. Entre no Supabase ▸ **New project**.
2. Dê um nome (ex.: `comercial-lumen`), crie uma senha forte para o banco (guarde-a) e escolha a região **South America (São Paulo)**.
3. Aguarde uns 2 minutos até o projeto ficar pronto.

> Dica: crie **um projeto Supabase por cliente**. Assim os dados de cada empresa ficam separados.

### 2. Criar as tabelas (schema.sql)
1. No menu lateral, abra **SQL Editor** ▸ **New query**.
2. Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql) deste projeto, copie **tudo** e cole no editor.
3. Clique em **Run**. Deve aparecer "Success. No rows returned".

Pode rodar de novo sem medo: o script não apaga dados.

### 3. (Opcional) Dados de exemplo (seed.sql)
Para demonstrar o app com dados fictícios: nova query ▸ cole [`supabase/seed.sql`](supabase/seed.sql) ▸ **Run**.
Ele cria a **Lumen Soluções em TI**: a gestora **Marina Couto** e 4 vendedores em 2 equipes (Rafael, Juliana, Bruno e Camila), 2 funis, 12 produtos/serviços, 45 empresas, 70 contatos, **150 negócios nos últimos 6 meses** (com histórico de etapas), cerca de 350 atividades, 13 propostas (uma **aceita pelo link**, uma **aguardando aprovação de desconto** e uma com **2 versões**), metas de 6 meses e comissões (os meses anteriores já pagos). Rodar de novo recria os exemplos com datas a partir de hoje.
Para o cliente real, pule este passo.

> **Rode o seed antes de criar os usuários** (passo 4). Para entrar como os vendedores do exemplo, crie usuários com os e-mails deles: `marina.couto@lumenti.com.br` (gestora), `rafael.mendes@lumenti.com.br`, `juliana.prado@lumenti.com.br`, `bruno.takahashi@lumenti.com.br`, `camila.ferraz@lumenti.com.br`.

### 4. Criar o usuário de acesso
1. **Authentication ▸ Users ▸ Add user ▸ Create new user**.
2. Informe e-mail e senha e marque **Auto Confirm User**.
3. **O primeiro usuário que entrar no app vira o GESTOR** (administrador). Se o e-mail já estiver cadastrado como vendedor (seed ou tela Equipe), ele assume aquele cadastro.
4. Para cada vendedor: o gestor cadastra em **Equipe ▸ Novo vendedor** (nome e e-mail) e você cria o login no Supabase com o **mesmo e-mail**. No 1º acesso o sistema liga os dois sozinho.

### 5. Desligar o cadastro público
**Authentication ▸ Sign In / Providers** (ou *Settings*) ▸ desmarque **Allow new users to sign up** ▸ **Save**.
Assim ninguém de fora consegue criar conta — só você, pelo painel.

### 6. Subir o código no GitHub
1. No GitHub, **New repository** (pode ser privado).
2. Envie os arquivos desta pasta (pelo GitHub Desktop, VS Code ou arrastando os arquivos em *uploading an existing file*).
   Não envie a pasta `node_modules` nem o arquivo `.env.local` (o `.gitignore` já cuida disso).

### 7. Importar na Vercel
Vercel ▸ **Add New ▸ Project** ▸ escolha o repositório ▸ ainda **não** clique em Deploy.

### 8. Colar as 2 variáveis de ambiente
Na mesma tela, abra **Environment Variables** e adicione:

| Nome | Onde achar no Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings ▸ API (ou botão **Connect**) ▸ *Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Mesma tela ▸ chave **anon public** (ou **publishable**, `sb_publishable_...`) |

Se o seu projeto só mostrar a chave *publishable*, você pode usar o nome `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no lugar da anon.
**Nunca** use a chave `service_role` / `secret`.

### 9. Deploy
Clique em **Deploy**. Em 1–2 minutos o app está no ar em `https://seu-projeto.vercel.app`.
Se aparecer a tela "Configure as variáveis de ambiente", confira os nomes/valores e faça **Redeploy**.

**Primeiros ajustes do gestor:** Configurações (dados da empresa que saem na proposta, condições padrão), Funis e etapas, Produtos (com o desconto máximo de cada um), Regras de comissão, Metas e Personalização (logo e cores).

**Último ajuste (para o "Esqueci minha senha" funcionar):** no Supabase, **Authentication ▸ URL Configuration**:
- **Site URL:** o endereço da Vercel (ex.: `https://seu-projeto.vercel.app`)
- **Redirect URLs:** adicione `https://seu-projeto.vercel.app/**` (e `http://localhost:3000/**` para testes locais).

### 10. Rodar no seu computador (opcional)
Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.
```bash
npm install
cp .env.example .env.local   # no Windows: copy .env.example .env.local
# edite .env.local com a URL e a chave do Supabase
npm run dev
```
Abra http://localhost:3000.

---

## Proposta com aceite pelo cliente
1. No **negócio**, adicione os produtos e clique em **Nova proposta** (os itens vêm do negócio).
2. Ajuste quantidades, descontos, condições de pagamento, prazo e validade ▸ **Salvar**.
3. Desconto acima do máximo do produto? Clique em **Pedir aprovação ao gestor**. O gestor vê o aviso no Início e em Propostas e clica em **Aprovar desconto** (ou Não aprovar).
4. **Enviar ao cliente** libera o link `https://seu-projeto.vercel.app/proposta/<código>` (32 caracteres aleatórios, impossível de adivinhar). Use **Mandar no WhatsApp** (modelo "Envio de proposta" já com o link) ou **Copiar link**.
5. O cliente abre no celular, vê a proposta com a sua logo e clica em **Aceitar proposta** informando o nome. A equipe vê "cliente abriu Nx" e, no aceite, o negócio vira **ganho** e a comissão é calculada.
6. Cliente pediu mudança? **Nova versão** (v2). O link da v1 passa a dizer "existe uma versão mais nova".
7. **Imprimir / PDF** gera o documento A4 (no diálogo de impressão, escolha "Salvar como PDF").

O aceite fica registrado com nome, data/hora, IP e navegador. O cliente aceitou por telefone? Use **Cliente aceitou** (aceite manual).

## Comissões
- Crie as regras em **Comissões ▸ Regras de comissão**: % sobre o valor ganho, para todos ou para um vendedor, para qualquer produto ou um específico, e faixas pelo valor do negócio (ex.: 5% até R$ 50 mil, 4% acima).
- Ao marcar um negócio como **ganho**, o banco calcula a comissão item a item (veja "Como foi calculada" no extrato).
- Até ser paga, a comissão acompanha o negócio (mudou o valor → recalcula). Mudou uma regra? **Recalcular a pagar**.
- No fechamento do mês, o gestor seleciona e clica em **Marcar como paga**. Paga, ela não muda mais.

## Recuperação de senha
Na tela de login, **Esqueci minha senha** envia um e-mail com um link. O link abre `/redefinir-senha`, onde a pessoa cria a nova senha.

- O e-mail padrão do Supabase tem limite de poucos envios por hora. Para uso real, configure um SMTP próprio em **Authentication ▸ Emails ▸ SMTP Settings**.
- O link deve ser aberto **no mesmo navegador** em que foi pedido. Para que funcione em qualquer navegador, edite o template **Authentication ▸ Emails ▸ Reset Password** e troque o link por:
  `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha`

## Como funciona

- **Fuso horário:** tudo é mostrado no horário de Brasília (`America/Sao_Paulo`, em `lib/formatar.ts` e `lib/comercial.ts`).
- **Receita prevista:** soma dos negócios em aberto × a probabilidade da etapa em que estão (definida em Configurações ▸ Funis e etapas).
- **Negócio "esfriando":** sem interação registrada há mais dias do que o definido em Configurações (padrão 7). Registre cada ligação/visita/mensagem com **Registrar interação**.
- **WhatsApp:** os botões abrem o WhatsApp com a mensagem pronta (`wa.me`), sem API paga, e registram a mensagem no histórico. Os textos são os **Modelos de mensagem** (Configurações), com `{nome}`, `{empresa}`, `{vendedor}`, `{negocio}`, `{valor}`, `{link_proposta}` e `{validade}`.
- **CSV:** abre direto no Excel em português (separador `;` e acentos). Na importação, o app aceita `;` ou `,`, UTF-8 ou o formato antigo do Excel.
- **Vendedor que saiu da empresa:** em Equipe, desmarque **Ativo** (o histórico e as comissões continuam). Para passar os negócios dele a outro, o gestor edita o negócio e troca o vendedor.

## Personalizar sem código (logo, cores e fonte)
A marca do cliente se troca **dentro do próprio app**, sem mexer em código: menu ▸ **Personalização** (só o gestor).

1. **Logo:** clique em **Enviar logo** (PNG, JPG, SVG ou WebP até 1 MB; quadrada e com fundo transparente fica melhor). Ela aparece no menu, no topo do celular, na tela de login, no ícone da aba do navegador e **no cabeçalho das propostas**. Sem logo, o app mostra as iniciais do nome.
2. **Cores:** escolha uma das 9 paletas prontas com 1 clique ou monte a sua (cor principal + cor de destaque, pelo seletor ou digitando o código `#RRGGBB`). A primeira, **Comercial** (azul royal + âmbar), é o padrão deste app. A cor principal também colore o documento da proposta. O app calcula sozinho a cor do texto (branco ou preto) e avisa se a combinação ficar difícil de ler.
3. **Fonte:** Moderna, Elegante, Amigável, Clássica, Técnica ou Divertida.
4. **Nome exibido e subtítulo** (ex.: "Lumen TI" / "Comercial"), **tema padrão** (claro, escuro ou seguir o sistema — cada pessoa ainda pode trocar no botão de sol/lua) e **arredondamento** dos cantos.
5. Confira na **Prévia ao vivo** e clique em **Salvar**. Mudou de ideia? **Restaurar padrão**.

> A logo fica no Supabase ▸ **Storage** ▸ pasta `marca` (criada pelo `schema.sql`). Se aparecer "A pasta de arquivos marca não existe", rode o `schema.sql` de novo.
> Os dados da empresa (CNPJ, contatos, condições de pagamento e rodapé da proposta) ficam em **Configurações**.

## Personalizar com IA
Abra a pasta no [Claude Code](https://claude.com/claude-code) (ou cole os arquivos no Claude) e peça, por exemplo:

- "Adicione um campo 'segmento de interesse' no negócio e um filtro por ele no Funil (`schema.sql`, `lib/tipos.ts`, formulário e página `/funil`)."
- "Crie uma faixa de comissão por **atingimento da meta** do mês (ex.: acima de 100% da meta, +1%), calculada na função `calcular_comissao` do `schema.sql`."
- "Envie um e-mail automático ao vendedor quando o cliente aceitar a proposta (Supabase Edge Function disparada pela tabela `propostas`)."
- "Mostre no Início um gráfico com as vendas dos últimos 12 meses usando `components/comercial/graficos.tsx`."
- "Adicione o campo 'frete' na proposta, somado ao total, no documento e no link público (`proposta_publica`)."
- "Crie um relatório de 'previsão × realizado' por vendedor na página `/relatorios`."

O arquivo [`COMO-ESTENDER.md`](COMO-ESTENDER.md) explica a estrutura do projeto e os padrões que a IA deve seguir.

## Tecnologias
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage) · lucide-react · zod
