#!/usr/bin/env node
/**
 * AGENTE DE TESTE — faz o papel do agente SDR do começo ao fim, só para provar que o
 * sistema está pronto para recebê-lo. NÃO é o agente de verdade: não usa IA nem WhatsApp.
 *
 *   node scripts/agente-de-teste.mjs https://app.seu-dominio.com.br aur_SUA_CHAVE
 *
 * O que ele faz, pela API (docs/API-DO-AGENTE.md):
 *   1. confere a chave                      6. monta o rascunho da proposta
 *   2. lê catálogo, condições e funil       7. submete à aprovação
 *   3. cria um lead de teste com evento     8. ESPERA você aprovar (ou pedir ajustes) na tela
 *   4. consulta a agenda                    9. ajusta e reenvia, se você pedir
 *   5. registra a conversa e pede o preço  10. envia ao cliente e mostra o link
 *
 * No fim, devolve o atendimento para o humano. O lead criado se chama "TESTE DO AGENTE":
 * pode marcar como perdido ou excluir depois.
 */
const [base, chave] = process.argv.slice(2);
if (!base || !chave) {
  console.error("Uso: node scripts/agente-de-teste.mjs <endereço do sistema> <chave do agente>");
  process.exit(2);
}
const raiz = base.replace(/\/+$/, "") + "/api/v1";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let passo = 0;

async function api(metodo, caminho, corpo) {
  const r = await fetch(raiz + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${chave}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, dados: json.dados, erro: json.erro };
}
function ok(texto) {
  console.log(`  ✔ ${String(++passo).padStart(2, "0")}. ${texto}`);
}
function exigir(r, esperado, oQue) {
  const lista = Array.isArray(esperado) ? esperado : [esperado];
  if (!lista.includes(r.status)) {
    console.error(`\n  ✘ ${oQue}: esperava ${lista.join(" ou ")}, veio ${r.status}${r.erro ? ` — ${r.erro.mensagem}` : ""}`);
    process.exit(1);
  }
  return r.dados;
}

console.log(`\nAgente de teste → ${raiz}\n`);

const ping = exigir(await api("GET", "/ping"), 200, "Chave");
ok(`Chave aceita ("${ping.chave.nome}", ${ping.chave.escopos.length} permissões) · ${ping.empresa}`);

const { pacotes } = exigir(await api("GET", "/catalogo/pacotes"), 200, "Pacotes");
const cond = exigir(await api("GET", "/catalogo/condicoes"), 200, "Condições");
const funil = exigir(await api("GET", "/catalogo/funil"), 200, "Funil");
ok(`Catálogo: ${pacotes.map((p) => p.nome).join(", ") || "nenhum pacote"} · preços aprovados: ${cond.precos_aprovados ? "sim" : "não"} · condições confirmadas: ${cond.condicoes_confirmadas ? "sim" : "não"}`);
if (!pacotes.length) {
  console.error("  ✘ Não há pacotes cadastrados. Rode supabase/dados-iniciais.sql.");
  process.exit(1);
}
const pacote = pacotes[Math.min(1, pacotes.length - 1)];

const quando = new Date(Date.now() + 75 * 864e5).toISOString().slice(0, 10);
const criado = exigir(
  await api("POST", "/negocios", {
    titulo: "TESTE DO AGENTE (pode excluir)",
    contato: { nome: "Marina Teste (agente de teste)", telefone: "34900000001" },
    evento: { tipo: "aniversario", nome: "Festa de teste", data: quando, hora_inicio: "19:00", duracao_horas: 4, cidade: cond.empresa.cidade ?? "Araxá", convidados: 80, pacote: pacote.nome },
    origem: "WhatsApp",
    observacoes: "Criado pelo roteiro scripts/agente-de-teste.mjs.",
  }),
  [200, 201],
  "Criar lead",
);
const negocio = criado.id;
ok(`Lead criado: pedido ${criado.codigo}, etapa "${criado.etapa.nome}", atendimento: ${criado.atendimento}`);

const agenda = exigir(await api("GET", `/agenda/disponibilidade?data=${quando}&hora_inicio=19:00&negocio_id=${negocio}`), 200, "Agenda");
ok(`Agenda em ${quando} às 19h: ${agenda.situacao} (${agenda.vagas} de ${agenda.capacidade} vagas)`);

const msgs = exigir(
  await api("POST", `/negocios/${negocio}/mensagens`, {
    mensagens: [
      { direcao: "entrada", texto: "Oi! Quero um orçamento para um aniversário.", id_externo: `teste-${negocio}-1` },
      { direcao: "saida", texto: `Olá! Para ${quando.split("-").reverse().join("/")}, 80 convidados, pacote ${pacote.nome}. Vou montar a proposta.`, id_externo: `teste-${negocio}-2` },
    ],
  }),
  201,
  "Registrar conversa",
);
ok(`Conversa registrada (${msgs.gravadas} mensagens)`);

const segunda = funil.etapas[1];
if (segunda) {
  exigir(await api("POST", `/negocios/${negocio}/etapa`, { etapa_id: segunda.id }), 200, "Mover etapa");
  ok(`Negócio movido para "${segunda.nome}"`);
}

const preco = exigir(await api("POST", "/precos/calcular", { pacote_id: pacote.id, convidados: 80, duracao_horas: 4 }), 200, "Preço");
ok(preco.disponivel ? `Preço pelas regras aprovadas: R$ ${Number(preco.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : `Preço indisponível (${(preco.motivos ?? []).join(" ")}) → o agente NÃO informa valor`);

const rasc = exigir(await api("POST", `/negocios/${negocio}/propostas`, { capa_titulo: "Um brinde à festa de teste.", nota: "Proposta do agente de teste." }), 201, "Criar proposta");
ok(`Rascunho ${rasc.numero} criado (${rasc.cardapio.length} drinks, total R$ ${rasc.total}${rasc.preco_pendente ? ", preço a definir pelo gestor" : ""})`);

const cedo = await api("POST", `/propostas/${rasc.id}/enviar`);
exigir(cedo, 409, "Trava de envio sem aprovação");
ok(`Trava conferida: enviar sem aprovação foi recusado ("${cedo.erro.mensagem}")`);

exigir(await api("POST", `/propostas/${rasc.id}/submeter`), 200, "Submeter");
ok("Proposta submetida à aprovação do gestor");

console.log(`\n  ⏳ Agora é com você: abra o sistema ▸ Propostas ▸ ${rasc.numero} e APROVE ou PEÇA AJUSTES.`);
console.log("     (este roteiro confere a cada 5 segundos, por até 15 minutos)\n");
let proposta;
for (let rodada = 0; rodada < 180; rodada++) {
  proposta = exigir(await api("GET", `/propostas/${rasc.id}`), 200, "Ler proposta");
  if (proposta.status === "ajustes_solicitados") {
    ok(`O gestor pediu ajustes: "${proposta.ajustes.comentario}"`);
    exigir(await api("PATCH", `/propostas/${rasc.id}`, { sincronizar: true, nota: "Ajustado conforme pedido." }), 200, "Ajustar");
    exigir(await api("POST", `/propostas/${rasc.id}/submeter`), 200, "Reenviar");
    ok("Ajustes feitos e proposta submetida de novo");
    console.log("\n  ⏳ Aguardando a nova decisão do gestor...\n");
  } else if (proposta.status === "aprovada" || proposta.status === "enviada") break;
  await espera(5000);
}
if (proposta.status !== "aprovada" && proposta.status !== "enviada") {
  console.error("  ✘ A proposta não foi aprovada em 15 minutos. Rode de novo quando quiser.");
  process.exit(1);
}
ok("Proposta aprovada pelo gestor");

const enviada = exigir(await api("POST", `/propostas/${rasc.id}/enviar`), 200, "Enviar");
ok(`Proposta enviada. Link do cliente: ${enviada.link}`);

const avisos = exigir(await api("GET", "/eventos?depois=0&limite=200"), 200, "Avisos");
const meus = avisos.eventos.filter((e) => e.negocio_id === negocio).map((e) => e.tipo);
ok(`Avisos deste negócio na fila: ${[...new Set(meus)].join(", ")}`);

exigir(await api("POST", `/negocios/${negocio}/transferir-humano`, { motivo: "Fim do teste do agente." }), 200, "Transferir");
const depois = await api("PATCH", `/negocios/${negocio}`, { observacoes: "não deveria gravar" });
exigir(depois, 409, "Bloqueio após transferência");
ok("Atendimento devolvido ao humano; a partir daí o agente não altera mais o negócio");

console.log(`\nTudo certo: ${passo} passos. O sistema está pronto para receber o agente.\n`);
