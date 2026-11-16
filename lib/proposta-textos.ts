/**
 * TEXTOS FIXOS DA PROPOSTA (páginas "Objeto da proposta", "Compromissos", "Responsabilidades"...).
 * Os padrões abaixo vêm da proposta-modelo da Aurora. O gestor pode trocá-los em
 * Configurações ▸ Propostas e agenda (ficam em configuracoes.proposta_textos).
 *
 * Listas são guardadas como texto, UMA LINHA POR ITEM. Onde o item tem título,
 * o formato é "Título: texto".
 */
export const TEXTOS_PADRAO = {
  capa_titulo: "Um brinde ao seu melhor momento.",
  capa_subtitulo: "Drinks preparados com cuidado para celebrar uma data especial.",
  frase_apresentacao: "A Aurora cuida dos coquetéis. Você aproveita a festa.",
  objeto_intro: "O serviço de coquetelaria contempla preparo técnico, insumos e cuidado durante o evento.",
  objeto:
    "Serviço profissional: Preparo e atendimento de drinks clássicos e opções sem álcool, conforme o cardápio.\n" +
    "Gestão de insumos: Aquisição, transporte e organização dos ingredientes necessários às receitas.\n" +
    "Higiene e organização: Ambiente de preparo limpo, organizado e pronto para o atendimento.",
  compromissos_intro: "O cuidado com cada detalhe faz diferença na experiência dos convidados.",
  compromissos:
    "Pontualidade: Cumprimento dos horários combinados, com postura profissional durante o atendimento.\n" +
    "Qualidade: Ingredientes selecionados, frutas frescas e preparo cuidadoso de cada receita.\n" +
    "Organização: Higiene, atenção à montagem e cuidado constante com a área de serviço.",
  responsabilidades_intro: "Alguns pontos simples para que a Aurora possa atender com conforto e organização.",
  responsabilidades:
    "Espaço adequado para preparo e serviço.\n" +
    "Acesso aos refrigeradores e à pia.\n" +
    "Pagamentos conforme o cronograma acordado.\n" +
    "Responsabilidade por extravios e quebras.",
  investimento_intro: "A Aurora cuida da compra, do transporte e da organização dos insumos do cardápio.",
  termos_intro: "Condições comerciais e orientações para uma contratação transparente.",
  disposicoes: "Prestação de serviço autônomo, sem vínculo empregatício entre as partes.",
  termos_rodape: "Esta proposta deve ser confirmada pelas partes antes da formalização do evento.",
  mensagem_final: "Conte com o nosso melhor, em cada detalhe, para tornar essa comemoração ainda mais especial.",
} as const;

export type ChaveTexto = keyof typeof TEXTOS_PADRAO;

/** Campos mostrados na tela de Configurações, na ordem do documento. */
export const CAMPOS_TEXTO: { chave: ChaveTexto; rotulo: string; linhas: number; ajuda?: string }[] = [
  { chave: "capa_titulo", rotulo: "Capa: título padrão", linhas: 1, ajuda: "Pode ser trocado em cada proposta (ex.: “Um brinde ao primeiro ano do José Miguel.”)." },
  { chave: "capa_subtitulo", rotulo: "Capa: frase de apoio", linhas: 1 },
  { chave: "frase_apresentacao", rotulo: "Apresentação: frase da Aurora", linhas: 1 },
  { chave: "objeto", rotulo: "Objeto da proposta", linhas: 4, ajuda: "Uma linha por item, no formato “Título: texto”. A validade da proposta entra sozinha no fim." },
  { chave: "compromissos", rotulo: "Compromissos da Aurora", linhas: 4, ajuda: "Uma linha por compromisso, no formato “Título: texto”." },
  { chave: "responsabilidades", rotulo: "Responsabilidades do cliente", linhas: 5, ajuda: "Uma linha por item." },
  { chave: "disposicoes", rotulo: "Disposições gerais", linhas: 3, ajuda: "Uma linha por item. O foro entra sozinho, se preenchido." },
  { chave: "mensagem_final", rotulo: "Página final: mensagem de agradecimento", linhas: 2 },
];

/** Texto em vigor: o do gestor, se houver; senão o padrão. */
export function textoProposta(textos: Record<string, string> | null | undefined, chave: ChaveTexto) {
  const v = textos?.[chave];
  return typeof v === "string" && v.trim() !== "" ? v : TEXTOS_PADRAO[chave];
}

/** "Título: texto" por linha → [{ titulo, texto }] */
export function itensComTitulo(bloco: string) {
  return bloco
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i > 0 && i < 60 ? { titulo: l.slice(0, i).trim(), texto: l.slice(i + 1).trim() } : { titulo: "", texto: l };
    });
}

export const linhasDe = (bloco: string) =>
  bloco
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
