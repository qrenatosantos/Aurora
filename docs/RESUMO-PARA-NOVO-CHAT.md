# Resumo para começar um chat novo (cole isto no início)

Sou o Renato. Não sou programador: fale em português, de forma simples. Não contrate serviço pago nem
crie conta paga sem me perguntar o custo antes. Segredos (chaves, senhas) só pelo formulário seguro,
nunca no chat. Quando der para descobrir algo pesquisando, pesquise em vez de me perguntar.

## O negócio
Aurora Bartenders (Araxá-MG), bar de drinks para eventos: casamentos, 15 anos, aniversários,
formaturas, empresas. Dono/gestor: André Procácio. Pacotes Essencial, Signature, Reserve e Exclusive.
Serviço padrão de 6 horas. Condições padrão: 60% de entrada e 40% de saldo.

## O que já existe
1. **CRM** (repositório `qrenatosantos/Aurora`, no ar em aurora.q-renatosantos.workers.dev):
   Next.js 16 + Supabase (banco) + Cloudflare Workers (hospedagem). Tem funil de vendas automático,
   agenda (até 3 festas no mesmo horário), catálogo com calculadora de preço (preços ainda
   provisórios, para o André revisar), proposta de 11 páginas com link público e aceite, e LGPD.
   Toda regra importante fica no banco. API para o agente com chaves e permissões
   (`docs/API-DO-AGENTE.md`), avisos (webhooks) para o agente, registro de tudo.
2. **Agente "Cecília"** (repositório `qrenatosantos/Agente-aurora`, Workers aurora-motor e
   aurora-agente-painel): atende no WhatsApp (API oficial da Meta) com modelo da OpenAI, monta
   proposta pelo CRM, o André aprova, e ela envia o link ao cliente. Regras de atendimento em
   `docs/REGRAS-DE-ATENDIMENTO.md` do CRM; prompt em `docs/PROMPT-AGENTE-SDR.md`.

## Fluxo da venda
Lead (site ou WhatsApp) → Cecília conversa → cria proposta com preço da calculadora → André aprova
pelo link → Cecília envia → cliente aceita no link → negócio fechado, data reservada na agenda e
tarefa "Cobrar a entrada". Se o cliente pedir mudança, nova versão volta para o André.

## Em aberto
- O André precisa revisar os preços provisórios e aprovar a calculadora (`docs/PRECOS-PROVISORIOS.md`).
- Política de privacidade com o item do atendimento automatizado: publicar antes do primeiro cliente
  real atendido pela Cecília.
