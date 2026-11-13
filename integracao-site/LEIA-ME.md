# Integração do site com o sistema comercial

Este pacote é para **quem cuida do site** `aurorabartendersaraxa.com.br` (o "chat do site").
Objetivo: todo pedido de orçamento feito no site entra sozinho no funil do sistema, em
"Novo lead", **sem mudar nada do que o cliente vê**: o WhatsApp continua abrindo com a mensagem
pronta, como hoje.

Testado numa cópia do site atual (celular e computador): o pedido chega ao sistema com a mesma
referência que aparece na mensagem do WhatsApp (`Ref. XK4A`), inclusive quando o celular sai da
página para abrir o WhatsApp.

## O que muda no site (5 passos)

### 1. Publicar o arquivo `aurora-lead.js`

Copie `aurora-lead.js` para `assets/js/` e carregue **antes** do script principal:

```html
<script src="assets/js/aurora-lead.js" defer></script>
<script src="assets/js/main.XXXXXXXX.js" defer></script>
```

### 2. Informar o endereço do sistema

No bloco de configuração que já existe no fim do `index.html`, acrescente `"sistema"`:

```html
<script type="application/json" id="aurora-cfg">{"sistema":"https://ENDEREÇO-DO-SISTEMA","wa":"5534988935223", ...}</script>
```

Sem `"sistema"`, o arquivo não faz nada (o site segue funcionando como hoje).

### 3. Chamar o registro no envio do formulário

No código-fonte do script principal, dentro do envio do formulário (`submit`), logo depois que
a referência e a mensagem são geradas, acrescente **uma linha**. Na versão publicada hoje
(minificada), o trecho é `const e=we(),a=xe(e);` — `e` é a referência e `d` é o formulário:

```js
const ref = gerarReferencia();        // hoje: we()
const mensagem = montarMensagem(ref); // hoje: xe(ref)
window.auroraRegistrarPedido && window.auroraRegistrarPedido(formulario, ref); // ← linha nova
```

Importante: passar a **mesma referência** que vai na mensagem do WhatsApp. É por ela que a
Aurora (e, no futuro, o agente) liga a conversa do WhatsApp ao pedido do sistema.

### 4. Campo-armadilha contra robôs

Dentro do `<form id="form-orcamento">`, em qualquer ponto, acrescente um campo que pessoas não veem:

```html
<div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true">
  <label>Não preencha este campo <input type="text" name="site_web" tabindex="-1" autocomplete="off"></label>
</div>
```

O sistema descarta em silêncio qualquer pedido que venha com esse campo preenchido.

### 5. Textos e política de privacidade (obrigatório, LGPD)

O site hoje afirma que não guarda dados. A partir desta integração isso deixa de ser verdade,
então **estes textos precisam mudar no mesmo dia** em que a integração for publicada:

| Onde | Texto atual | Texto novo |
|---|---|---|
| Abaixo do botão do formulário | "O WhatsApp abre com a mensagem pronta e só envia quando você tocar em enviar. Este site não guarda seus dados." | "O WhatsApp abre com a mensagem pronta e só envia quando você tocar em enviar. Seu pedido também fica registrado no sistema de atendimento da Aurora, para prepararmos a proposta." |
| Lista de garantias | "Sem cadastro" | "Sem criar conta" |
| Página `politica-de-privacidade.html` | texto atual | o texto de `politica-de-privacidade.md` (neste pacote) |

## Campo de WhatsApp (opcional)

O sistema aceita um campo `name="whatsapp"` no formulário. Se o site passar a pedir o número,
o contato já nasce com telefone e o sistema evita pedidos repetidos do mesmo número em 24 horas.
Não é obrigatório: sem ele, a ligação entre o pedido e a conversa é feita pela referência.
Se for incluir, deixe claro que é opcional e atualize o item "Quais dados pedimos" da política.

## O que o sistema recebe

Os mesmos campos do formulário, com os mesmos nomes: `nome`, `tipo`, `data` (ou `mes`, quando a
data está a definir), `cidadeop`, `cidade`, `convidados`, `pacote`, `drinks`, `obs`, mais `ref`
(a referência), `origem_site` (de onde a pessoa veio, que o site já calcula) e `site_web` (a armadilha).

- Endereço: `POST https://ENDEREÇO-DO-SISTEMA/api/publico/leads`
- Só aceita pedidos vindos de `aurorabartendersaraxa.com.br`, `www.aurorabartendersaraxa.com.br`
  e `aurorabartenders.pages.dev`. Outro endereço (ex.: uma prévia) precisa ser liberado na
  variável `ORIGENS_DO_SITE` do sistema.
- Limites: 5 pedidos a cada 10 minutos por visitante e 30 no total. Reenvio do mesmo pedido
  (mesma referência) atualiza o pedido em vez de duplicar.
- O site não lê a resposta e não depende dela.

## Como conferir depois de publicar

1. Faça um pedido de teste no site, com o nome "TESTE".
2. No sistema, abra **Funil**: o pedido aparece em "Novo lead", com origem "Site".
3. Em **Negócios**, busque pela referência que apareceu na mensagem do WhatsApp (ex.: `XK4A`).
4. Se o pedido não aparecer: em **Integrações**, o cartão "Pedidos que não entraram no funil"
   mostra o que chegou e por que não foi registrado.

## O que NÃO muda

- O formulário, as etapas, a mensagem e a abertura do WhatsApp.
- O site continua sem cookies e sem rastreadores.
- Se o sistema estiver fora do ar, o cliente não percebe nada: o WhatsApp abre do mesmo jeito.
