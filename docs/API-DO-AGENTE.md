# API e avisos para o agente SDR

Este documento é para **quem vai construir o agente** (atendente automático) da Aurora Bartenders.
O sistema comercial já está pronto para recebê-lo: o agente entra por aqui, com uma chave, e só
consegue fazer o que está nesta página. O agente em si (a inteligência, o WhatsApp, o texto das
conversas) **não faz parte deste sistema**.

- Formato de máquina (OpenAPI 3.1), sempre atualizado: `GET /api/v1/openapi.json`
- Teste de ponta a ponta sem IA: `node scripts/agente-de-teste.mjs https://ENDEREÇO-DO-SISTEMA aur_SUA_CHAVE`
- Tela do gestor: **Integrações** (chaves, avisos, fila e registro de tudo o que o agente fez)

## 1. Regras que o agente não consegue quebrar

Estas regras estão no **banco de dados**. Não dependem da tela nem da boa vontade do agente.

1. **Proposta só sai aprovada.** O agente monta o rascunho e submete. Só um gestor humano aprova.
   `POST /propostas/:id/enviar` em proposta não aprovada devolve `409`.
2. **Preço só de regra aprovada.** `POST /precos/calcular` devolve `disponivel: false` enquanto o
   gestor não aprovar as regras de preço. O agente não consegue gravar valor, desconto nem condição.
3. **Disponibilidade só a da agenda.** `GET /agenda/disponibilidade` é a única fonte. O agente
   consulta; quem reserva a data é o envio da proposta, e quem confirma é o aceite.
4. **Condições comerciais só as confirmadas.** `GET /catalogo/condicoes` traz `null` no que o
   gestor ainda não confirmou. Campo vazio significa "não definido": não informar ao cliente.
5. **Um dono por atendimento.** Cada negócio está com `agente` ou com `humano`. Com `humano`, o
   agente lê, registra mensagens e mais nada: qualquer alteração devolve `409`.
6. **Tudo fica registrado.** Cada chamada (aceita ou recusada) vai para o registro do agente, e
   cada alteração vai para a Auditoria, marcada como feita pelo agente.
7. **O que não existe na API não pode ser feito:** aprovar proposta, dar desconto, mudar preço ou
   receita, excluir qualquer coisa, ler configurações, ver outras chaves, criar usuários.

## 2. Como chamar

| | |
|---|---|
| Endereço base | `https://ENDEREÇO-DO-SISTEMA/api/v1` |
| Autenticação | cabeçalho `Authorization: Bearer aur_...` (chave criada em Integrações; aparece uma única vez) |
| Corpo | JSON (`Content-Type: application/json`), até 200 KB |
| Consulta | parâmetros `?campo=valor` nos `GET` |
| Resposta de sucesso | `{ "dados": ... }` com status `200` ou `201` |
| Resposta de erro | `{ "erro": { "codigo": "...", "mensagem": "..." } }` |

A `mensagem` de erro é escrita para ser lida (em português) e pode ser repassada ao gestor.

| Status | Quando acontece | O que o agente deve fazer |
|---|---|---|
| `400` | dado faltando ou em formato errado | corrigir o pedido |
| `401` | chave ausente, errada ou revogada | parar e avisar o responsável |
| `403` | a chave não tem essa permissão | parar; o gestor decide se libera |
| `404` | registro ou endereço não existe | conferir o id |
| `405` | endereço existe, método errado | corrigir o método |
| `409` | a situação não permite (ex.: atendimento com humano, proposta não aprovada) | não insistir; esperar o aviso correspondente |
| `413` | corpo grande demais | dividir o pedido |
| `422` | uma regra de negócio recusou (ex.: data no passado) | ler a mensagem e corrigir |
| `429` | passou do limite de chamadas por minuto da chave | esperar 1 minuto |
| `502` | banco indisponível no momento | tentar de novo com intervalo crescente |

Repetir uma chamada com segurança: contato é reaproveitado pelo telefone (`ja_existia: true`);
mensagens com `id_externo` não duplicam; `GET` não altera nada. `POST /negocios` **cria um negócio
novo a cada chamada**: antes de criar, busque por telefone em `GET /negocios?telefone=...`.

**Telefones.** Envie com ou sem `+55`, com ou sem pontuação. Celular antigo sem o 9 extra
(DDD + 8 dígitos começando por 6, 7, 8 ou 9, como alguns números chegam pelo WhatsApp) é tratado
como o mesmo número com o 9: `553488935223` e `34988935223` acham o mesmo contato. O sistema
guarda no formato atual (DDD + número, sem `+55`).

**Não contatar.** Contatos e negócios trazem `nao_contatar`, `nao_contatar_em`,
`nao_contatar_motivo`, `aceita_retomadas` e `aceita_retomadas_em`. Com `nao_contatar: true`,
o agente **não puxa conversa nem manda retomada** (responder quando a pessoa chamar continua
liberado). Retomada só para quem tem `aceita_retomadas: true`. Quando a pessoa pedir para parar,
grave com `PATCH /contatos/:id`. As datas são preenchidas pelo sistema.

Exemplo:

```bash
curl -s https://ENDEREÇO-DO-SISTEMA/api/v1/ping -H "Authorization: Bearer aur_..."
```

```json
{
  "dados": {
    "ok": true,
    "agora": "2026-11-13T22:33:16.391153+00:00",
    "chave": { "nome": "Agente SDR", "escopos": ["contatos.ler", "..."], "limite_por_minuto": 120 },
    "empresa": "Aurora Bartenders"
  }
}
```

## 3. Permissões (escopos) de uma chave

O gestor marca, ao criar a chave, o que ela pode fazer. Sem a permissão, a chamada devolve `403`.

`contatos.ler` · `contatos.gravar` · `negocios.ler` · `negocios.gravar` · `agenda.ler` ·
`catalogo.ler` · `precos.calcular` · `propostas.ler` · `propostas.gravar` · `propostas.enviar` ·
`mensagens.ler` · `mensagens.gravar` · `atendimento.transferir` · `eventos.ler` ·
`atendimento.devolver`

Não existe permissão para aprovar proposta. Para um agente que só atende e nunca envia proposta,
basta não marcar `propostas.enviar`.

**Duas chaves.** `atendimento.devolver` (devolver uma conversa ao agente) **não vem marcada** ao
criar uma chave. Ela é para uma **segunda chave, só do painel do agente**, usada quando uma
pessoa clica em "devolver ao agente" ali. A chave usada pela IA não deve ter essa permissão:
assim o agente nunca "pega" uma conversa sozinho. Sugestão para a chave do painel:
`negocios.ler`, `mensagens.ler` e `atendimento.devolver`.

## 4. O caminho de um atendimento

```
cliente chama no WhatsApp
   │
   ├─ GET  /negocios?telefone=...            já existe pedido em aberto deste telefone?
   ├─ POST /negocios                         não: cria contato + negócio em "Novo lead" + evento
   ├─ POST /negocios/:id/mensagens           registra a conversa (as do cliente e as do agente)
   ├─ PUT  /negocios/:id/evento              grava data, cidade, convidados... e já devolve a agenda
   ├─ GET  /agenda/disponibilidade           data livre, com vagas, lotada ou bloqueada
   ├─ GET  /catalogo/pacotes · /catalogo/condicoes      só o que está cadastrado e confirmado
   ├─ POST /precos/calcular                  preço pelas regras aprovadas (ou disponivel: false)
   ├─ POST /negocios/:id/propostas           monta o rascunho
   ├─ POST /propostas/:id/submeter           pede a aprovação do gestor
   │        … espera o aviso proposta.aprovada ou proposta.ajustes_solicitados …
   ├─ PATCH /propostas/:id  +  submeter      se o gestor pediu ajustes (comentário em ajustes_comentario)
   ├─ POST /propostas/:id/enviar             só depois de aprovada: devolve o link do cliente
   ├─ POST /propostas/:id/nova-versao        cliente pediu mudança numa proposta já enviada: nova versão volta ao gestor
   └─ POST /negocios/:id/transferir-humano   a qualquer momento: passa para uma pessoa
```

**Leads do site.** O formulário do site já grava o pedido direto no funil (origem "Site") e avisa
com `lead.criado`. O site não pede telefone: o cliente segue para o WhatsApp com uma mensagem pronta
que termina em `Ref. XK4A`. Essa referência **é o código do pedido** no sistema. Quando a mensagem
chegar no WhatsApp, o agente acha o pedido com `GET /negocios?codigo=XK4A` e grava o telefone no
contato (`PATCH /contatos/:id`), em vez de criar um negócio novo. Esses leads nascem com o atendimento definido em Configurações ▸ Propostas e
agenda ("Leads novos do site vão para"). O agente só deve agir nos que vierem com
`atendimento: "agente"`, ou quando chegar `atendimento.encaminhado_agente`.

**Valor antes da aprovação.** A proposta chega ao gestor já com o valor da calculadora. Enquanto as
regras de preço não forem aprovadas, a API mostra `total: null` e `preco_pendente: true` para o
agente até o gestor aprovar a proposta: não informe valor ao cliente antes disso.

**Duração do serviço: 6 horas é o padrão.** Não pergunte quantas horas o cliente quer: o serviço da
Aurora é de 6 horas. Se `duracao_horas` não for enviado, o sistema grava o padrão (Configurações).
Só mude se o próprio cliente pedir, ou como exceção para baixar o preço (abaixo).

**Quando o cliente acha caro.** Antes de passar para uma pessoa, ofereça, nesta ordem:
1. **reduzir as horas** de serviço (`PUT /negocios/:id/evento` com nova `duracao_horas` e
   `PATCH /propostas/:id {"sincronizar": true}`);
2. **dispensar a vidraria** e usar copos descartáveis (`PATCH /propostas/:id {"sem_vidraria": true}`).
   O valor do desconto vem da calculadora (`POST /precos/calcular` com `sem_vidraria: true`).

Nunca ofereça desconto fora dessas duas opções.

**Título do negócio.** Quando o agente grava o nome do contato ou o tipo do evento, o título
automático do negócio ("Casamento · Ana Paula") é refeito sozinho.

**Aceite da proposta.** Quando o cliente aceita pelo link, o negócio vira ganho, a data fica
confirmada, o gestor recebe a tarefa "Cobrar a entrada" no sistema e chega o aviso
`proposta.aceita`. A página do link oferece ao cliente o botão "Avisar a Aurora pelo WhatsApp",
com a mensagem "Acabei de aceitar a proposta PROP-... (pedido ...)".

**Quando passar para uma pessoa.** Sempre que faltar informação cadastrada (preço indisponível,
condição `null`, data lotada ou bloqueada, pedido fora dos pacotes, pedido de desconto), o caminho
é `transferir-humano` com um motivo claro. O sistema cria uma tarefa para o gestor e mostra o
pedido na tela inicial dele.

## 5. Endereços

### Teste

**`GET /api/v1/ping`** · qualquer chave  
Testa a chave e devolve as permissões dela.


### Contatos

**`GET /api/v1/contatos`** · permissão `contatos.ler`  
Busca contatos por telefone, e-mail ou nome.

| Campo | Como preencher |
|---|---|
| `telefone` | DDD + número |
| `email` | e-mail |
| `nome` | trecho do nome (2+ letras) |
| `limite` | até 20 |

**`POST /api/v1/contatos`** · permissão `contatos.gravar`  
Cria um contato. Se o telefone já existir, devolve o contato existente (ja_existia: true).

| Campo | Como preencher |
|---|---|
| `nome` | obrigatório |
| `telefone` | DDD + número |
| `email` | texto |
| `cidade` | texto |
| `observacoes` | texto |
| `origem` | nome de uma origem cadastrada |

**`GET /api/v1/contatos/:id`** · permissão `contatos.ler`  
Lê um contato.

**`PATCH /api/v1/contatos/:id`** · permissão `contatos.gravar`  
Atualiza só os campos enviados.

| Campo | Como preencher |
|---|---|
| `nome` | texto |
| `telefone` | texto |
| `email` | texto |
| `cidade` | texto |
| `observacoes` | texto |
| `nao_contatar` | `true` ou `false`: pediu para não receber mensagens (desliga as retomadas) |
| `nao_contatar_motivo` | até 200 caracteres |
| `aceita_retomadas` | `true` ou `false`: consentiu receber mensagens de retomada |

As datas `nao_contatar_em` e `aceita_retomadas_em` são preenchidas pelo sistema.


### Negócios, evento, conversa e propostas do negócio

**`GET /api/v1/negocios`** · permissão `negocios.ler`  
Lista negócios (padrão: em aberto).

| Campo | Como preencher |
|---|---|
| `atendimento` | agente ou humano |
| `status` | aberto ou ganho ou perdido ou todos |
| `contato_id` | texto |
| `codigo` | código do pedido (ex.: A7K2Q9) |
| `telefone` | telefone do contato |
| `limite` | até 50 |

**`POST /api/v1/negocios`** · permissão `negocios.gravar`  
Cria contato (ou reaproveita pelo telefone) + negócio em “Novo lead” + evento, já com atendimento do agente.

| Campo | Como preencher |
|---|---|
| `contato_id` | id de um contato existente, OU |
| `contato` | { nome, telefone, email, cidade } |
| `evento` | { tipo, nome, data, mes_previsto, hora_inicio, duracao_horas, cidade, uf, local, convidados, convidados_faixa, pacote ou pacote_id, linha, preferencias[], observacoes } |
| `titulo` | opcional |
| `origem` | padrão: WhatsApp |
| `observacoes` | texto |

**`GET /api/v1/negocios/:id`** · permissão `negocios.ler`  
Lê um negócio com contato, evento e propostas.

**`PATCH /api/v1/negocios/:id`** · permissão `negocios.gravar`  
Atualiza título, observações e etiquetas.

| Campo | Como preencher |
|---|---|
| `titulo` | texto |
| `observacoes` | texto |
| `tags` | lista de textos |

**`PUT /api/v1/negocios/:id/evento`** · permissão `negocios.gravar`  
Atualiza os dados do evento (só os campos enviados) e devolve a disponibilidade da data.

| Campo | Como preencher |
|---|---|
| `tipo` | casamento ou 15_anos ou aniversario ou formatura ou empresa ou outro |
| `nome` | texto |
| `data` | AAAA-MM-DD |
| `mes_previsto` | AAAA-MM |
| `hora_inicio` | HH:MM |
| `duracao_horas` | número |
| `cidade` | texto |
| `uf` | texto |
| `local` | texto |
| `convidados` | número |
| `convidados_faixa` | texto |
| `pacote` | nome do pacote |
| `pacote_id` | texto |
| `linha` | tradicional ou premium |
| `preferencias` | lista de textos |
| `observacoes` | texto |

**`POST /api/v1/negocios/:id/etapa`** · permissão `negocios.gravar`  
Move o negócio no funil.

| Campo | Como preencher |
|---|---|
| `etapa` | nome da etapa, OU |
| `etapa_id` | texto |

**`POST /api/v1/negocios/:id/perdido`** · permissão `negocios.gravar`  
Marca como perdido (exige motivo cadastrado).

| Campo | Como preencher |
|---|---|
| `motivo` | nome do motivo, OU |
| `motivo_id` | texto |
| `detalhe` | texto |

**`GET /api/v1/negocios/:id/mensagens`** · permissão `mensagens.ler`  
Lê a conversa (mais antigas primeiro).

| Campo | Como preencher |
|---|---|
| `limite` | até 200 |
| `antes` | data/hora ISO |

**`POST /api/v1/negocios/:id/mensagens`** · permissão `mensagens.gravar`  
Registra de 1 a 50 mensagens. Com id_externo, repetir a chamada não duplica.

| Campo | Como preencher |
|---|---|
| `mensagens` | [{ direcao: entrada ou saida, texto, enviada_em, canal, id_externo, autor }]. `autor` só vale em `saida`: `agente` (padrão) ou `humano`, quando uma pessoa respondeu pelo painel do agente |

**`POST /api/v1/negocios/:id/transferir-humano`** · permissão `atendimento.transferir`  
Pede atendimento humano. O agente deixa de poder alterar o negócio.

| Campo | Como preencher |
|---|---|
| `motivo` | obrigatório |

**`POST /api/v1/negocios/:id/encaminhar-agente`** · permissão `atendimento.devolver` (só a chave do painel)  
Uma **pessoa** devolve a conversa ao agente pelo painel. Mesmo efeito do botão "Passar para o
agente" do CRM: grava a passagem, dispara `atendimento.encaminhado_agente` e registra o nome de
quem pediu no registro do agente e na Auditoria. Se já estiver com o agente, responde
`transferido: false`. Negócio encerrado: `409`.

| Campo | Como preencher |
|---|---|
| `autor` | obrigatório: nome da pessoa que pediu no painel |
| `motivo` | opcional |

**`GET /api/v1/negocios/:id/propostas`** · permissão `propostas.ler`  
Lista as propostas do negócio.

**`POST /api/v1/negocios/:id/propostas`** · permissão `propostas.gravar`  
Cria o rascunho com os dados do evento, o cardápio e o preço pelas regras aprovadas.

| Campo | Como preencher |
|---|---|
| `drinks` | lista de ids (padrão: os do pacote) |
| `capa_titulo` | texto |
| `capa_subtitulo` | texto |
| `apresentacao` | texto |
| `descricao_servico` | texto |
| `mensagem_final` | texto |
| `nota` | recado para o gestor |


### Propostas

**`GET /api/v1/propostas/:id`** · permissão `propostas.ler`  
Lê a proposta: situação, comentário de ajustes e, depois de enviada, o link do cliente.

**`PATCH /api/v1/propostas/:id`** · permissão `propostas.gravar`  
Altera o rascunho (ou a proposta com ajustes solicitados).

| Campo | Como preencher |
|---|---|
| `drinks` | lista de ids (refaz cardápio e preço) |
| `sincronizar` | true = refaz evento, cardápio e preço a partir do negócio |
| `sem_vidraria` | true ou false: copos descartáveis no lugar da vidraria (refaz o preço com o desconto) |
| `capa_titulo` | texto |
| `capa_subtitulo` | texto |
| `apresentacao` | texto |
| `descricao_servico` | texto |
| `mensagem_final` | texto |
| `nota` | texto |

**`POST /api/v1/propostas/:id/submeter`** · permissão `propostas.gravar`  
Submete à aprovação do gestor. **O sistema recusa (422)** a proposta sem: nome de verdade do
cliente (nomes como "Cliente do WhatsApp" não valem), duração do serviço em horas, número de
convidados e data ou mês previsto. A mensagem diz o que falta: pergunte ao cliente, grave com
`PATCH /contatos/:id` e `PUT /negocios/:id/evento`, atualize a proposta com
`PATCH /propostas/:id {"sincronizar": true}` e submeta de novo.

| Campo | Como preencher |
|---|---|
| `nota` | recado para o gestor |

**`POST /api/v1/propostas/:id/enviar`** · permissão `propostas.enviar`  
Marca como enviada e devolve o link do cliente. Só funciona para proposta APROVADA.

**`POST /api/v1/propostas/:id/nova-versao`** · permissão `propostas.gravar`  
Use quando o cliente pede para mudar uma proposta **aprovada, enviada ou recusada** (trocar drinks,
horas, convidados, tirar a vidraria). O sistema:
1. cria a versão seguinte (mesmo número, `versao` + 1) com os dados atuais do evento;
2. marca a anterior como "substituída": **o link antigo deixa de valer** (o cliente vê "existe uma
   versão mais nova");
3. refaz cardápio e preço e **submete de novo ao gestor** (`aguardando_aprovacao`).

Mudou horas, data ou convidados? Grave antes com `PUT /negocios/:id/evento`. Depois espere o aviso
`proposta.aprovada` e envie a versão nova com `POST /propostas/:id/enviar` (o link é outro).
Recusa (409) para proposta em rascunho ou com ajustes (use `PATCH`), aguardando o gestor, aceita
(passe para a equipe) ou já substituída. Responde `201` com a proposta nova (use o `id` dela).

| Campo | Como preencher |
|---|---|
| `drinks` | lista de ids (padrão: o cardápio da versão anterior) |
| `sem_vidraria` | true \| false |
| `nota` | o que o cliente pediu, para o gestor |


### Agenda

**`GET /api/v1/agenda/disponibilidade`** · permissão `agenda.ler`  
Diz se a data está livre, com vagas, lotada ou bloqueada.
Mande sempre `hora_inicio` (e `duracao_horas`, se não for o padrão de 6 h): a conta usa o horário
real de cada festa **mais a folga da equipe** antes (deslocamento e montagem) e depois (desmontagem e
volta), definidas em Configurações. Ex.: um almoço das 12h às 18h ocupa a equipe que atenderia uma
festa às 19h. Sem horário, o sistema considera o dia inteiro. A resposta traz `hora_fim` e, em
`eventos_no_dia`, o início e o término das outras festas. **Lotada ou bloqueada: não ofereça a data**;
sugira outro horário ou outra data e consulte de novo.

| Campo | Como preencher |
|---|---|
| `data` | AAAA-MM-DD (obrigatório) |
| `hora_inicio` | HH:MM |
| `duracao_horas` | número |
| `negocio_id` | ignora o próprio negócio na conta |


### Catálogo e condições

**`GET /api/v1/catalogo/pacotes`** · permissão `catalogo.ler`  
Pacotes ativos com os drinks de cada um. Cada drink traz `foto_url` (endereço público completo da
foto) quando houver.

**`GET /api/v1/catalogo/drinks`** · permissão `catalogo.ler`  
Drinks ativos, com `foto_url` quando houver. Drink sem foto: `null` (não envie imagem).

**`GET /api/v1/catalogo/condicoes`** · permissão `catalogo.ler`  
Dados da empresa e condições comerciais confirmadas pelo gestor.

**`GET /api/v1/catalogo/funil`** · permissão `catalogo.ler`  
Etapas do funil, motivos de perda, origens e tipos de evento.


### Preços

**`POST /api/v1/precos/calcular`** · permissão `precos.calcular`  
Preço pelas regras APROVADAS. Sem regra aprovada, devolve disponivel: false.

| Campo | Como preencher |
|---|---|
| `pacote_id` | ou drinks: [ids] |
| `sem_vidraria` | true = copos descartáveis no lugar da vidraria (aplica o desconto configurado) |
| `convidados` | número |
| `duracao_horas` | número |
| `linha` | tradicional ou premium |
| `outra_cidade` | true ou false |


### Avisos (fila de consulta)

**`GET /api/v1/eventos`** · permissão `eventos.ler`  
Avisos a partir de um número: o que aconteceu desde a última consulta.

| Campo | Como preencher |
|---|---|
| `depois` | último id recebido (padrão 0) |
| `limite` | até 200 |

## 6. Avisos (webhooks)

O sistema avisa o agente quando algo acontece. Há dois jeitos, que podem ser usados juntos:

1. **Chamada automática (webhook):** o gestor cadastra o endereço do agente em Integrações ▸
   Avisos. O sistema faz um `POST` nesse endereço a cada aviso.
2. **Consulta (fila):** o agente pergunta `GET /api/v1/eventos?depois=ÚLTIMO_ID`. Nada se perde:
   os avisos ficam guardados em ordem, e o agente guarda o último `id` que processou.

Recomendação: use o webhook para reagir rápido e a consulta, de tempos em tempos, como rede de
segurança (por exemplo ao iniciar e a cada poucos minutos).

### Formato do aviso

É o mesmo no webhook e na consulta:

```json
{
  "id": 42,
  "tipo": "proposta.aprovada",
  "criado_em": "2026-11-13T18:00:00.000000+00:00",
  "negocio_id": "0b6f6a3e-...",
  "proposta_id": "8c1d2f4a-...",
  "contato_id": null,
  "dados": { "numero": "PROP-2026-0002", "versao": 1, "status": "aprovada", "total": 8850, "comentario": null }
}
```

| Tipo | Quando | O que vem em `dados` |
|---|---|---|
| `lead.criado` | novo negócio (site, agente ou cadastro manual) | `codigo`, `titulo`, `atendimento`, `origem` |
| `atendimento.encaminhado_agente` | o gestor clicou em "Passar para o agente" | `codigo`, `titulo`, `motivo` |
| `atendimento.assumido_humano` | uma pessoa clicou em "Assumir atendimento" | `codigo`, `titulo`, `motivo` |
| `atendimento.pedido_humano` | o próprio agente pediu uma pessoa | `codigo`, `titulo`, `motivo` |
| `proposta.submetida` | proposta enviada para aprovação | `numero`, `versao`, `status`, `total`, `link_aprovacao` (link direto da proposta no sistema, para o gestor) e `gestor` (`nome`, `telefone`). Mande ao gestor no WhatsApp: "Proposta aguardando sua aprovação" + o link |
| `proposta.aprovada` | o gestor aprovou: já pode enviar | `numero`, `versao`, `status`, `total` |
| `proposta.ajustes_solicitados` | o gestor pediu mudanças | o mesmo, mais `comentario` (o que mudar) |
| `proposta.enviada` | marcada como enviada (link liberado) | `numero`, `versao`, `status`, `total` |
| `proposta.visualizada` | o cliente abriu o link pela primeira vez | `numero`, `versao` |
| `proposta.aceita` | o cliente aceitou | `numero`, `versao`, `status`, `total` |
| `proposta.recusada` | marcada como recusada | `numero`, `versao`, `status`, `total` |
| `negocio.ganho` | negócio fechado | `codigo`, `titulo`, `valor` |
| `negocio.perdido` | negócio perdido | `codigo`, `titulo`, `motivo` |
| `contato.dados_apagados` | o gestor apagou os dados pessoais de um contato (LGPD), pela ficha ou pelo prazo de guarda | `negocios` (lista de ids limpos), `contato_anonimizado`; o id do contato vem em `contato_id` |
| `teste.ping` | botão "Enviar teste" em Integrações | `mensagem` |

Os avisos trazem poucos dados de propósito (sem telefone, sem conversa). Para o detalhe, o agente
busca pela API com o `negocio_id` ou o `proposta_id`.

### Cabeçalhos do webhook e assinatura

```
Content-Type: application/json
X-Aurora-Evento: proposta.aprovada
X-Aurora-Entrega: <id da entrega>
X-Aurora-Assinatura: t=1763056800,v1=<assinatura em hexadecimal>
```

Cada endereço cadastrado tem um **segredo** (visível em Integrações). A assinatura prova que o
aviso veio do sistema da Aurora:

```
v1 = HMAC-SHA256( segredo, t + "." + corpo_exatamente_como_chegou )
```

Confira a assinatura sobre os **bytes do corpo como chegaram** (antes de interpretar o JSON) e
recuse avisos com `t` mais antigo que 5 minutos. Exemplo em Node.js:

```js
import crypto from "node:crypto";

export function avisoVerdadeiro(corpoBruto, cabecalho, segredo) {
  const partes = Object.fromEntries(cabecalho.split(",").map((p) => p.split("=")));
  if (!partes.t || !partes.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(partes.t)) > 300) return false;
  const esperado = crypto.createHmac("sha256", segredo).update(`${partes.t}.${corpoBruto}`).digest("hex");
  const a = Buffer.from(esperado), b = Buffer.from(partes.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

### Entrega

- Responda `2xx` em até 8 segundos. Faça o trabalho pesado depois de responder.
- Sem `2xx`, o sistema tenta de novo com intervalo crescente (2, 4, 8... minutos), até 8 tentativas.
  Depois disso o aviso aparece como "não entregue" em Integrações, e continua disponível na consulta.
- O mesmo aviso pode chegar mais de uma vez. Use o `id` para não processar em dobro.
- A ordem de chegada não é garantida no webhook. Na consulta, a ordem é a do `id`.
- O endereço do agente precisa ser `https://` e público.
- Use o botão **Enviar teste** (Integrações) para validar a conferência da assinatura antes de
  ligar o agente.

## 7. Dados pessoais (LGPD)

- O agente trata dados pessoais em nome da Aurora. Guarde do seu lado só o necessário e pelo
  tempo necessário; a fonte da verdade é este sistema.
- Quando o gestor apaga os dados de um contato, as conversas, os pedidos e o conteúdo dos avisos
  daquele negócio são apagados aqui, e chega o aviso `contato.dados_apagados`. Ao recebê-lo, o
  agente apaga a cópia dele (conversas, telefone, nome) ligada àquele `contato_id` e àqueles negócios.
- A política de privacidade do site precisa dizer que há atendimento automatizado quando o agente
  entrar em operação, e o cliente deve poder pedir uma pessoa (use `transferir-humano`).
- A chave do agente é uma senha: guarde-a como segredo do ambiente do agente, nunca no código,
  em conversas ou em e-mails. Se vazar, o gestor revoga em Integrações e cria outra.

## 8. Antes de ligar o agente de verdade

1. O gestor preenche e **aprova as regras de preço** (Catálogo ▸ Calculadora) e confirma as
   **condições comerciais** (Configurações ▸ Propostas e agenda).
2. O gestor cria a chave em Integrações e roda o agente de teste (`scripts/agente-de-teste.mjs`).
3. O gestor cadastra o endereço do agente em Avisos e clica em **Enviar teste**; o agente confere
   a assinatura.
4. Em Configurações ▸ Propostas e agenda ("Leads novos do site vão para"), o gestor escolhe se
   os novos leads começam com uma pessoa (padrão) ou com o agente.
