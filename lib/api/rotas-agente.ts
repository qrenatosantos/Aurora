/**
 * API DO AGENTE — tabela de rotas: método + caminho → ação do banco (função api_agente).
 * É a ÚNICA lista de endereços da API: a documentação (docs/API-DO-AGENTE.md) e o
 * arquivo OpenAPI (/api/v1/openapi.json) saem daqui.
 *
 * Em cada rota, ":id" é um trecho variável do endereço. Os parâmetros da consulta
 * (?a=b) e o corpo JSON são juntados e enviados como "dados" da ação.
 */
export type RotaAgente = {
  metodo: "GET" | "POST" | "PATCH" | "PUT";
  caminho: string;
  acao: string;
  /** Nome do campo que recebe o ":id" do endereço. */
  campoId?: string;
  escopo: string;
  resumo: string;
  /** Campos aceitos (documentação). */
  campos?: Record<string, string>;
};

export const ROTAS_AGENTE: RotaAgente[] = [
  { metodo: "GET", caminho: "/ping", acao: "ping", escopo: "", resumo: "Testa a chave e devolve as permissões dela." },

  { metodo: "GET", caminho: "/contatos", acao: "contatos.buscar", escopo: "contatos.ler", resumo: "Busca contatos por telefone, e-mail ou nome.", campos: { telefone: "DDD + número", email: "e-mail", nome: "trecho do nome (2+ letras)", limite: "até 20" } },
  { metodo: "POST", caminho: "/contatos", acao: "contatos.criar", escopo: "contatos.gravar", resumo: "Cria um contato. Se o telefone já existir, devolve o contato existente (ja_existia: true).", campos: { nome: "obrigatório", telefone: "DDD + número", email: "", cidade: "", observacoes: "", origem: "nome de uma origem cadastrada" } },
  { metodo: "GET", caminho: "/contatos/:id", acao: "contatos.obter", campoId: "id", escopo: "contatos.ler", resumo: "Lê um contato." },
  { metodo: "PATCH", caminho: "/contatos/:id", acao: "contatos.atualizar", campoId: "id", escopo: "contatos.gravar", resumo: "Atualiza só os campos enviados.", campos: { nome: "", telefone: "", email: "", cidade: "", observacoes: "" } },

  { metodo: "GET", caminho: "/negocios", acao: "negocios.listar", escopo: "negocios.ler", resumo: "Lista negócios (padrão: em aberto).", campos: { atendimento: "agente | humano", status: "aberto | ganho | perdido | todos", contato_id: "", codigo: "código do pedido (ex.: A7K2Q9)", telefone: "telefone do contato", limite: "até 50" } },
  { metodo: "POST", caminho: "/negocios", acao: "negocios.criar", escopo: "negocios.gravar", resumo: "Cria contato (ou reaproveita pelo telefone) + negócio em “Novo lead” + evento, já com atendimento do agente.", campos: { contato_id: "id de um contato existente, OU", contato: "{ nome, telefone, email, cidade }", evento: "{ tipo, nome, data, mes_previsto, hora_inicio, duracao_horas, cidade, uf, local, convidados, convidados_faixa, pacote | pacote_id, linha, preferencias[], observacoes }", titulo: "opcional", origem: "padrão: WhatsApp", observacoes: "" } },
  { metodo: "GET", caminho: "/negocios/:id", acao: "negocios.obter", campoId: "id", escopo: "negocios.ler", resumo: "Lê um negócio com contato, evento e propostas." },
  { metodo: "PATCH", caminho: "/negocios/:id", acao: "negocios.atualizar", campoId: "id", escopo: "negocios.gravar", resumo: "Atualiza título, observações e etiquetas.", campos: { titulo: "", observacoes: "", tags: "lista de textos" } },
  { metodo: "PUT", caminho: "/negocios/:id/evento", acao: "evento.atualizar", campoId: "negocio_id", escopo: "negocios.gravar", resumo: "Atualiza os dados do evento (só os campos enviados) e devolve a disponibilidade da data.", campos: { tipo: "casamento | 15_anos | aniversario | formatura | empresa | outro", nome: "", data: "AAAA-MM-DD", mes_previsto: "AAAA-MM", hora_inicio: "HH:MM", duracao_horas: "número", cidade: "", uf: "", local: "", convidados: "número", convidados_faixa: "texto", pacote: "nome do pacote", pacote_id: "", linha: "tradicional | premium", preferencias: "lista de textos", observacoes: "" } },
  { metodo: "POST", caminho: "/negocios/:id/etapa", acao: "negocios.mover_etapa", campoId: "id", escopo: "negocios.gravar", resumo: "Move o negócio no funil.", campos: { etapa: "nome da etapa, OU", etapa_id: "" } },
  { metodo: "POST", caminho: "/negocios/:id/perdido", acao: "negocios.marcar_perdido", campoId: "id", escopo: "negocios.gravar", resumo: "Marca como perdido (exige motivo cadastrado).", campos: { motivo: "nome do motivo, OU", motivo_id: "", detalhe: "" } },
  { metodo: "GET", caminho: "/negocios/:id/mensagens", acao: "mensagens.listar", campoId: "negocio_id", escopo: "mensagens.ler", resumo: "Lê a conversa (mais antigas primeiro).", campos: { limite: "até 200", antes: "data/hora ISO" } },
  { metodo: "POST", caminho: "/negocios/:id/mensagens", acao: "mensagens.registrar", campoId: "negocio_id", escopo: "mensagens.gravar", resumo: "Registra de 1 a 50 mensagens. Com id_externo, repetir a chamada não duplica.", campos: { mensagens: "[{ direcao: entrada | saida, texto, enviada_em, canal, id_externo }]" } },
  { metodo: "POST", caminho: "/negocios/:id/transferir-humano", acao: "atendimento.pedir_humano", campoId: "negocio_id", escopo: "atendimento.transferir", resumo: "Pede atendimento humano. O agente deixa de poder alterar o negócio.", campos: { motivo: "obrigatório" } },
  { metodo: "GET", caminho: "/negocios/:id/propostas", acao: "propostas.listar", campoId: "negocio_id", escopo: "propostas.ler", resumo: "Lista as propostas do negócio." },
  { metodo: "POST", caminho: "/negocios/:id/propostas", acao: "propostas.criar", campoId: "negocio_id", escopo: "propostas.gravar", resumo: "Cria o rascunho com os dados do evento, o cardápio e o preço pelas regras aprovadas.", campos: { drinks: "lista de ids (padrão: os do pacote)", capa_titulo: "", capa_subtitulo: "", apresentacao: "", descricao_servico: "", mensagem_final: "", nota: "recado para o gestor" } },

  { metodo: "GET", caminho: "/propostas/:id", acao: "propostas.obter", campoId: "id", escopo: "propostas.ler", resumo: "Lê a proposta: situação, comentário de ajustes e, depois de enviada, o link do cliente." },
  { metodo: "PATCH", caminho: "/propostas/:id", acao: "propostas.atualizar", campoId: "id", escopo: "propostas.gravar", resumo: "Altera o rascunho (ou a proposta com ajustes solicitados).", campos: { drinks: "lista de ids (refaz cardápio e preço)", sincronizar: "true = refaz evento, cardápio e preço a partir do negócio", capa_titulo: "", capa_subtitulo: "", apresentacao: "", descricao_servico: "", mensagem_final: "", nota: "" } },
  { metodo: "POST", caminho: "/propostas/:id/submeter", acao: "propostas.submeter", campoId: "id", escopo: "propostas.gravar", resumo: "Submete à aprovação do gestor.", campos: { nota: "recado para o gestor" } },
  { metodo: "POST", caminho: "/propostas/:id/enviar", acao: "propostas.enviar", campoId: "id", escopo: "propostas.enviar", resumo: "Marca como enviada e devolve o link do cliente. Só funciona para proposta APROVADA." },

  { metodo: "GET", caminho: "/agenda/disponibilidade", acao: "agenda.disponibilidade", escopo: "agenda.ler", resumo: "Diz se a data está livre, com vagas, lotada ou bloqueada.", campos: { data: "AAAA-MM-DD (obrigatório)", hora_inicio: "HH:MM", duracao_horas: "número", negocio_id: "ignora o próprio negócio na conta" } },

  { metodo: "GET", caminho: "/catalogo/pacotes", acao: "catalogo.pacotes", escopo: "catalogo.ler", resumo: "Pacotes ativos com os drinks de cada um." },
  { metodo: "GET", caminho: "/catalogo/drinks", acao: "catalogo.drinks", escopo: "catalogo.ler", resumo: "Drinks ativos." },
  { metodo: "GET", caminho: "/catalogo/condicoes", acao: "catalogo.condicoes", escopo: "catalogo.ler", resumo: "Dados da empresa e condições comerciais confirmadas pelo gestor." },
  { metodo: "GET", caminho: "/catalogo/funil", acao: "catalogo.funil", escopo: "catalogo.ler", resumo: "Etapas do funil, motivos de perda, origens e tipos de evento." },
  { metodo: "POST", caminho: "/precos/calcular", acao: "precos.calcular", escopo: "precos.calcular", resumo: "Preço pelas regras APROVADAS. Sem regra aprovada, devolve disponivel: false.", campos: { pacote_id: "ou drinks: [ids]", convidados: "número", duracao_horas: "número", linha: "tradicional | premium", outra_cidade: "true | false" } },

  { metodo: "GET", caminho: "/eventos", acao: "eventos.listar", escopo: "eventos.ler", resumo: "Avisos a partir de um número: o que aconteceu desde a última consulta.", campos: { depois: "último id recebido (padrão 0)", limite: "até 200" } },
];

/** Encontra a rota de um pedido. Devolve a ação e os dados vindos do endereço. */
export function acharRota(metodo: string, partes: string[]) {
  for (const r of ROTAS_AGENTE) {
    if (r.metodo !== metodo) continue;
    const modelo = r.caminho.split("/").filter(Boolean);
    if (modelo.length !== partes.length) continue;
    const dados: Record<string, string> = {};
    let ok = true;
    modelo.forEach((m, i) => {
      if (m.startsWith(":")) dados[r.campoId ?? "id"] = partes[i];
      else if (m !== partes[i]) ok = false;
    });
    if (ok) return { rota: r, dados };
  }
  return null;
}

/** Existe esse caminho com outro método? (para responder 405 em vez de 404) */
export function caminhoExiste(partes: string[]) {
  return ROTAS_AGENTE.some((r) => {
    const modelo = r.caminho.split("/").filter(Boolean);
    return modelo.length === partes.length && modelo.every((m, i) => m.startsWith(":") || m === partes[i]);
  });
}
