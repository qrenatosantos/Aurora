# Aurora Bartenders — sistema comercial

Um sistema só para o comercial da **Aurora Bartenders** (serviço de bar e coquetelaria para
eventos, Araxá/MG): funil de pedidos, dados do evento, agenda de datas, catálogo com calculadora
de preço, propostas no padrão da Aurora com link para o cliente aceitar, e a porta de entrada
pronta para um **agente SDR** que será construído depois.

Feito em Next.js 16 + React 19 + Supabase (banco e login), hospedado no Cloudflare Workers.

## Documentos

| Para quem | Documento |
|---|---|
| Colocar no ar (sem ser programador) | [`docs/PUBLICAR-NO-CLOUDFLARE.md`](docs/PUBLICAR-NO-CLOUDFLARE.md) |
| Usar no dia a dia | [`docs/GUIA-DE-USO.md`](docs/GUIA-DE-USO.md) |
| Quem vai construir o agente | [`docs/API-DO-AGENTE.md`](docs/API-DO-AGENTE.md) e `/api/v1/openapi.json` |
| Quem cuida do site | [`integracao-site/LEIA-ME.md`](integracao-site/LEIA-ME.md) |
| Quem vai mexer no código | [`COMO-ESTENDER.md`](COMO-ESTENDER.md) |

## O que o sistema faz

- **Funil** (kanban) com as etapas Novo lead → Em atendimento → Proposta em preparação →
  Aguardando aprovação → Proposta enviada → Negociação, mais Ganho e Perdido.
- **Leads de qualquer origem**, com a origem registrada: site (entra sozinho), WhatsApp,
  Instagram, indicação, agente.
- **Evento dentro do negócio**: tipo, data (ou "a definir" com mês previsto), cidade, local,
  convidados, duração, pacote, linha de bebidas, preferências e observações.
- **Agenda de eventos**: limite de festas no mesmo horário (padrão 3), bloqueios, e aviso de
  data ocupada ao preencher o evento.
- **Catálogo**: pacotes (Essencial, Signature, Reserve, Exclusive), drinks com receita, insumos
  com preço Tradicional e Premium e a **calculadora** que transforma tudo isso em preço.
- **Propostas da Aurora**: documento em páginas (capa, partes, objeto, evento, cardápio,
  compromissos, vidraria, responsabilidades, investimento, termos, encerramento), PDF em
  paisagem, link público, aceite pelo cliente e envio pelo WhatsApp.
- **Aprovação obrigatória**: rascunho → aguardando aprovação → ajustes solicitados → aprovada →
  enviada → aceita/recusada.
- **Agente ou humano** em cada atendimento, com histórico de conversa e de quem passou para quem.
- **Integrações**: API com chave e permissões limitadas, avisos (webhooks) assinados, fila de
  avisos e registro de tudo o que o agente fizer.
- **LGPD**: exportar e apagar dados de um contato, prazo de guarda com limpeza automática,
  auditoria com "quem fez" (pessoa, agente, cliente ou site).
- **Identidade da Aurora** (navy, dourado, creme, Cormorant Garamond + DM Sans), editável em
  Personalização.

Empresas, vários funis, metas, comissões e equipes existem, mas vêm **desligados**
(Configurações ▸ Módulos e dados).

## Regras que ficam no banco (não dá para burlar pela tela nem pela API)

- Proposta só é **enviada** se estiver **aprovada**, e só um gestor humano ativo aprova.
  Conteúdo aprovado fica travado; mudar exige nova versão.
- Preço calculado só existe com as **regras de preço aprovadas**; qualquer mudança em insumo,
  receita, pacote ou parâmetro derruba a aprovação.
- Condições comerciais (entrada, saldo, cancelamento, taxa de quebra) começam **vazias** e só
  aparecem em propostas e na API depois de preenchidas pelo gestor.
- O agente só altera negócios cujo atendimento está com ele; não aprova, não dá desconto, não
  muda preço e não exclui nada. Cada chamada é registrada.
- Disponibilidade de data é calculada pelo banco (reservas valem até a validade da proposta).
- O visitante sem login não lê nenhuma tabela: usa só as funções públicas da proposta, a entrada
  de pedidos do site e a API do agente (que exige chave).
- O sistema não usa nenhuma chave secreta do Supabase: só a chave pública.

## Mapa de telas

| Endereço | O que é | Acesso |
|---|---|---|
| `/` | Início: o que pede atenção, lembretes, próximos eventos | Login |
| `/funil` | Funil de pedidos (kanban) | Login |
| `/eventos` | Agenda de eventos, consulta de data e bloqueios | Login |
| `/propostas`, `/propostas/[id]` | Lista; editor, aprovação, envio e PDF | Login |
| `/agenda` | Tarefas e lembretes | Login |
| `/contatos`, `/contatos/[id]` | Contatos; ficha com privacidade (LGPD) | Login |
| `/negocios`, `/negocios/[id]` | Lista com busca por Ref.; negócio com evento, atendimento e conversa | Login |
| `/catalogo` (+ `/drinks`, `/insumos`, `/calculadora`) | Pacotes, drinks, insumos e regras de preço | Login (gestor altera) |
| `/relatorios` | Conversão, origens, motivos de perda, CSV | Login |
| `/equipe` | Pessoas e papéis | Gestor |
| `/configuracoes` (+ abas) | Empresa, propostas e agenda, funil, listas, mensagens, módulos e dados | Gestor |
| `/integracoes` | Chaves, avisos, fila e registro do agente | Gestor |
| `/personalizacao` | Logo, cores, fonte | Gestor |
| `/auditoria` | Quem fez o quê | Login (gestor vê tudo) |
| `/proposta/[código]` | Proposta para o cliente ver e aceitar | Pública |
| `/api/v1/...` | API do agente | Chave |
| `/api/publico/leads` | Entrada dos pedidos do site | Só o site |
| `/login`, `/redefinir-senha` | Entrar e trocar senha | Pública |

## Para quem mexe no código

```bash
npm install
cp .env.example .env.local     # preencha com o Project URL e a chave pública do Supabase
npm run dev                    # http://localhost:3000

npm run lint                   # padrão de código
npm run build                  # build do Next.js
npm run test:banco             # regras do banco (PGlite, sem Supabase): 27 testes
npm run preview                # monta e roda como no Cloudflare (workerd)
node scripts/agente-de-teste.mjs http://localhost:3000 aur_CHAVE   # ciclo completo do agente
```

- Banco: [`supabase/schema.sql`](supabase/schema.sql) (tabelas, regras e funções; pode rodar de
  novo) e [`supabase/dados-iniciais.sql`](supabase/dados-iniciais.sql) (cadastros da Aurora).
- A seção da Aurora no `schema.sql` vai de A1 a A15 e está comentada bloco a bloco.
- Variáveis: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Opcional: `ORIGENS_DO_SITE` (endereços extras, separados
  por vírgula, autorizados a enviar pedidos do site).

## O que ainda depende de pessoas

- **Condições comerciais**: confirmar e preencher em Configurações ▸ Propostas e agenda.
- **Preços**: preencher insumos e parâmetros da calculadora, conferir as receitas e aprovar.
- **Site**: aplicar `integracao-site/` e publicar a política de privacidade nova no mesmo dia.
- **Avisos automáticos** (`pg_net`/`pg_cron`): conferir uma vez no Supabase de verdade (passo a
  passo no guia de publicação).
- **Agente SDR**: não faz parte deste projeto.
