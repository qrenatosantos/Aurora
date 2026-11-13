/**
 * DOCUMENTO DA PROPOSTA DA AURORA — as "páginas" no padrão da proposta-modelo:
 * capa, partes, objeto do contrato, detalhes do evento, cardápio, compromissos,
 * vidraria, responsabilidades, investimento (entrada e saldo), termos e agradecimento.
 *
 * Usado na tela interna (prévia e impressão/PDF) e no link público do cliente.
 * Sem hooks: funciona em Server e Client Components. Estilos: bloco "PROPOSTA DA AURORA"
 * em app/globals.css (classes pa-*). As cores são fixas de propósito.
 *
 * Página que não tem conteúdo (ex.: nenhum drink com copo definido, nenhuma condição
 * de cancelamento) simplesmente não aparece: o documento nunca mostra dado inventado.
 */
import { COPOS, dataPorExtenso, diaDaSemana, entradaESaldo, horasTexto, mesPorExtenso, nomeTipoEvento } from "@/lib/aurora";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { itensComTitulo, linhasDe, textoProposta } from "@/lib/proposta-textos";
import type { Copo, DrinkCardapio, EventoProposta } from "@/lib/tipos";

export type PropostaAurora = {
  numero: string;
  versao: number;
  status: string;
  validade: string;
  total: number;
  evento: EventoProposta;
  cardapio: DrinkCardapio[];
  pacote_nome: string | null;
  linha: string | null;
  capa_titulo: string | null;
  capa_subtitulo: string | null;
  capa_foto_url: string | null;
  apresentacao: string | null;
  descricao_servico: string | null;
  mensagem_final: string | null;
  foto_final_url: string | null;
  condicoes_pagamento: string | null;
  observacoes: string | null;
  entrada_pct: number | null;
  entrada_dias_antes: number | null;
  saldo_dias_antes: number | null;
  cancelamento_aviso_dias: number | null;
  cancelamento_multa_pct: number | null;
  taxa_quebra: number | null;
  foro: string | null;
  aceita_em: string | null;
  aceite_nome: string | null;
};

export type ItemAurora = { descricao: string; detalhes: string | null; quantidade: number; preco_unitario: number; total: number };

export type EmpresaAurora = {
  nome: string;
  responsavel?: string | null;
  cidade?: string | null;
  uf?: string | null;
  instagram?: string | null;
  rodape?: string | null;
  textos?: Record<string, string> | null;
  fotos?: Record<string, string> | null;
};

const FOTOS_PADRAO = {
  capa: "/aurora/fotos/brinde.webp",
  apresentacao: "/aurora/fotos/equipe.webp",
  responsabilidades: "/aurora/fotos/frutas.webp",
  investimento: "/aurora/fotos/bar.webp",
  final: "/aurora/fotos/capa.webp",
};

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
const pct = (n: number) => `${String(Number(n)).replace(".", ",")}%`;
const cidadeUf = (cidade?: string | null, uf?: string | null) => [cidade, uf].filter(Boolean).join(" / ");

function Pagina({ rotulo, titulo, intro, numero, total, children }: { rotulo: string; titulo: string; intro?: string | null; numero: number; total: number; children: React.ReactNode }) {
  return (
    <section className="pa-pagina" aria-label={titulo}>
      <div className="pa-in">
        <div className="pa-regua" />
        <p className="pa-rotulo" style={{ marginTop: "1.1em" }}>
          {rotulo}
        </p>
        <h2 className="pa-titulo" style={{ fontSize: "2.8em", marginTop: "0.2em" }}>
          {titulo}
        </h2>
        <div style={{ width: "6.5em", height: 2, background: "var(--pa-ouro)", margin: "0.7em 0 0.9em" }} />
        {intro && (
          <p className="pa-suave" style={{ marginBottom: "1.2em", maxWidth: "52em" }}>
            {intro}
          </p>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
        <div className="pa-rodape" style={{ marginTop: "1em" }}>
          <span>Aurora Bartenders</span>
          <span>
            {String(numero).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}

/** Desenhos simples dos recipientes (página "Vidraria"). */
function Recipiente({ tipo }: { tipo: Copo }) {
  const vidro = { fill: "rgba(210,235,240,0.16)", stroke: "#cfe8ee", strokeWidth: 2.2, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={COPOS.find((c) => c.id === tipo)?.nome ?? "Recipiente"} style={{ width: "100%", height: "100%" }}>
      <circle cx="60" cy="62" r="50" fill="rgba(247,242,232,0.045)" />
      <circle cx="60" cy="62" r="36" fill="rgba(247,242,232,0.05)" />
      {tipo === "long_drink" && (
        <>
          <path d="M42 20h36l-3 82H45z" {...vidro} />
          <ellipse cx="60" cy="20" rx="18" ry="3.2" {...vidro} />
          <path d="M49 30v60" stroke="#cfe8ee" strokeWidth="1.4" opacity=".6" />
        </>
      )}
      {tipo === "baixo" && (
        <>
          <path d="M34 42h52l-5 56H39z" {...vidro} />
          <ellipse cx="60" cy="42" rx="26" ry="3.6" {...vidro} />
          <path d="M46 52l2 38M60 52v38M74 52l-2 38" stroke="#cfe8ee" strokeWidth="1.2" opacity=".55" />
        </>
      )}
      {tipo === "caneca" && (
        <>
          <path d="M34 34h46v60a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6z" fill="#a8603a" stroke="#f0c08a" strokeWidth="2.2" strokeLinejoin="round" />
          <ellipse cx="57" cy="34" rx="23" ry="3.6" fill="#c98258" stroke="#f0c08a" strokeWidth="2.2" />
          <path d="M80 46h8a12 12 0 0 1 12 12v8a12 12 0 0 1-12 12h-8" fill="none" stroke="#d9a070" strokeWidth="6" strokeLinecap="round" />
          <path d="M42 46v40" stroke="#e8b48a" strokeWidth="5" opacity=".45" strokeLinecap="round" />
        </>
      )}
      {(tipo === "taca" || tipo === "outro") && (
        <>
          <path d="M36 24h48c0 22-10 36-24 38-14-2-24-16-24-38z" {...vidro} />
          <path d="M60 62v32M44 98h32" stroke="#cfe8ee" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function DocumentoAurora({
  proposta: p,
  itens,
  empresa,
  cliente,
  logoUrl,
}: {
  proposta: PropostaAurora;
  itens: ItemAurora[];
  empresa: EmpresaAurora;
  cliente: { nome?: string | null };
  logoUrl?: string | null;
}) {
  const ev = p.evento ?? {};
  const t = (chave: Parameters<typeof textoProposta>[1]) => textoProposta(empresa.textos, chave);
  const foto = (chave: keyof typeof FOTOS_PADRAO, propria?: string | null) => propria || empresa.fotos?.[chave] || FOTOS_PADRAO[chave];
  const logo = logoUrl || "/aurora/aurora-512.png";

  const cardapio = (p.cardapio ?? []).filter((d) => d && d.nome);
  const copos = Array.from(new Set(cardapio.map((d) => d.copo).filter((c): c is Copo => Boolean(c) && c !== "outro"))).slice(0, 4);
  const temCancelamento = p.cancelamento_aviso_dias !== null || p.cancelamento_multa_pct !== null;
  const disposicoes = [...(p.foro ? [`Foro da ${p.foro.replace(/^foro d[aeo] /i, "")}.`] : []), ...linhasDe(t("disposicoes"))];
  const temTermos = temCancelamento || disposicoes.length > 0;
  const pagamento = entradaESaldo(Number(p.total), p.entrada_pct);
  const dataTexto = ev.data ? dataPorExtenso(ev.data) : ev.mes_previsto ? mesPorExtenso(ev.mes_previsto) : null;
  const convidadosTexto = ev.convidados ? `${ev.convidados} convidados` : ev.convidados_faixa ? `${ev.convidados_faixa} convidados` : null;
  const primeiroNome = (cliente.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const itensExtras = itens.length > 1 ? itens : [];

  // páginas presentes (para numerar "02 / 11")
  const paginas = ["capa", "partes", "objeto", "evento", ...(cardapio.length ? ["cardapio"] : []), "compromissos", ...(copos.length ? ["vidraria"] : []), "responsabilidades", "investimento", ...(temTermos ? ["termos"] : []), "final"];
  const total = paginas.length;
  const n = (id: string) => paginas.indexOf(id) + 1;
  const secao = (id: string) => String(paginas.filter((x) => x !== "capa" && x !== "final").indexOf(id) + 1).padStart(2, "0");
  const colunasCardapio = cardapio.length <= 4 ? "pa-grade-2" : cardapio.length <= 9 ? "pa-grade-3" : "pa-grade-4";
  const compacto = cardapio.length > 6;

  return (
    <article className="pa-doc" aria-label={`Proposta ${p.numero}${p.versao > 1 ? ` versão ${p.versao}` : ""}`}>
      {/* ------------------------------------------------------------ CAPA */}
      <section className="pa-pagina" aria-label="Capa">
        <div className="pa-capa">
          <div className="pa-in" style={{ justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- logo da marca (arquivo local ou Storage) */}
            <img src={logo} alt={`Logo de ${empresa.nome}`} style={{ width: "9.5em", height: "9.5em", objectFit: "contain", borderRadius: "0.6em" }} />
            <p className="pa-rotulo" style={{ marginTop: "2em" }}>
              Proposta de serviços
            </p>
            <h1 className="pa-titulo" style={{ fontSize: "4.3em", marginTop: "0.3em", maxWidth: "11em", textWrap: "balance" }}>
              {p.capa_titulo || t("capa_titulo")}
            </h1>
            <p className="pa-suave" style={{ marginTop: "1.6em", fontSize: "1.1em", maxWidth: "34em" }}>
              {p.capa_subtitulo || t("capa_subtitulo")}
            </p>
            <div className="pa-regua" style={{ margin: "2.6em 0 1.2em" }} />
            <p className="pa-rotulo" style={{ letterSpacing: "0.12em" }}>
              {[dataTexto, cidadeUf(ev.cidade, ev.uf)].filter(Boolean).join("  •  ") || `${p.numero}${p.versao > 1 ? ` · v${p.versao}` : ""}`}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid var(--pa-linha)" }}>
            <div className="pa-capa-foto" style={{ flex: 1, minHeight: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto da proposta (qualquer origem) */}
              <img src={foto("capa", p.capa_foto_url)} alt="" className="pa-foto" style={{ position: "absolute", inset: 0 }} />
            </div>
            {(ev.local || convidadosTexto) && (
              <p style={{ padding: "1.6em 2em", fontSize: "0.78em", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {[ev.local, convidadosTexto].filter(Boolean).join("  •  ")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ PARTES */}
      <Pagina rotulo={`${secao("partes")} / Apresentação`} titulo="Partes da proposta" intro={p.apresentacao} numero={n("partes")} total={total}>
        <div className="pa-grade-2" style={{ height: "100%", alignItems: "stretch" }}>
          <div className="pa-so-largo pa-quadro-foto">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto da equipe */}
            <img src={foto("apresentacao")} alt="" />
          </div>
          <div className="pa-cartao" style={{ padding: "1.4em 2em" }}>
            <p className="pa-rotulo">Partes da proposta</p>
            <div className="pa-regua" style={{ margin: "0.9em 0 1em", background: "rgba(247,242,232,0.16)" }} />
            <p className="pa-rotulo">Contratante</p>
            <p className="pa-titulo" style={{ fontSize: "2em", marginTop: "0.2em" }}>
              {cliente.nome || "A definir"}
            </p>
            <p className="pa-suave" style={{ marginTop: "0.4em" }}>
              {[ev.local, cidadeUf(ev.cidade, ev.uf)].filter(Boolean).join("  •  ")}
            </p>
            <div className="pa-regua" style={{ margin: "1em 0", background: "rgba(247,242,232,0.16)" }} />
            <p className="pa-rotulo">Contratado</p>
            <p className="pa-titulo" style={{ fontSize: "2em", marginTop: "0.2em" }}>
              {empresa.nome}
            </p>
            <p className="pa-suave" style={{ marginTop: "0.4em" }}>
              {[empresa.responsavel, cidadeUf(empresa.cidade, empresa.uf)].filter(Boolean).join("  •  ")}
            </p>
            <p style={{ marginTop: "1em" }}>{t("frase_apresentacao")}</p>
          </div>
        </div>
      </Pagina>

      {/* ------------------------------------------------------------ OBJETO */}
      <Pagina rotulo={`${secao("objeto")} / Nossos serviços`} titulo="Objeto do contrato" intro={t("objeto_intro")} numero={n("objeto")} total={total}>
        <ol style={{ display: "grid", gap: "0.65em", listStyle: "none", margin: 0, padding: 0 }}>
          {[...itensComTitulo(t("objeto")), { titulo: "Validade da proposta", texto: `Válida até ${formatarData(p.validade)}, sujeita à disponibilidade da data e a ajustes por proximidade do evento.` }].map((item, i) => (
            <li key={i} className="pa-cartao" style={{ display: "grid", gridTemplateColumns: "4.2em 1fr", alignItems: "center", padding: "0.6em 1.6em" }}>
              <span className="pa-titulo pa-ouro" style={{ fontSize: "1.9em" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                {item.titulo && (
                  <strong className="pa-ouro" style={{ display: "block", fontSize: "0.95em", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {item.titulo}
                  </strong>
                )}
                {item.texto}
              </span>
            </li>
          ))}
        </ol>
      </Pagina>

      {/* ------------------------------------------------------------ EVENTO */}
      <Pagina
        rotulo={`${secao("evento")} / A comemoração`}
        titulo="Detalhes do evento"
        intro={ev.nome ? `${nomeTipoEvento(ev.tipo)}: ${ev.nome}.` : ev.tipo ? `${nomeTipoEvento(ev.tipo)}.` : null}
        numero={n("evento")}
        total={total}
      >
        <div className="pa-grade-2">
          {[
            { rot: "Data", val: dataTexto ?? "A definir", sub: ev.data ? diaDaSemana(ev.data) : ev.mes_previsto ? "Mês previsto" : "" },
            { rot: "Local", val: ev.local || "A definir", sub: cidadeUf(ev.cidade, ev.uf).replace(" / ", " • ") },
            { rot: "Convidados", val: ev.convidados ? `${ev.convidados} pessoas` : ev.convidados_faixa ? `${ev.convidados_faixa} pessoas` : "A definir", sub: "Público estimado" },
            { rot: "Duração", val: ev.duracao_horas ? `${horasTexto(ev.duracao_horas)} de serviço` : "A definir", sub: ev.hora_inicio ? `Início às ${ev.hora_inicio}` : "Horário a combinar" },
          ].map((c) => (
            <div key={c.rot} className="pa-cartao" style={{ padding: "1.2em 2em" }}>
              <p className="pa-rotulo">{c.rot}</p>
              <p className="pa-titulo" style={{ fontSize: "2.1em", margin: "0.45em 0 0.4em" }}>
                {c.val}
              </p>
              <p className="pa-suave">{c.sub || " "}</p>
            </div>
          ))}
        </div>
      </Pagina>

      {/* ------------------------------------------------------------ CARDÁPIO */}
      {cardapio.length > 0 && (
        <Pagina
          rotulo={`${secao("cardapio")} / A seleção`}
          titulo="Cardápio de coquetéis"
          intro={p.pacote_nome ? `Pacote ${p.pacote_nome}${p.linha === "premium" ? ", linha premium" : ""}: ${cardapio.length} ${cardapio.length === 1 ? "opção" : "opções"} para receber os convidados.` : `${cardapio.length} ${cardapio.length === 1 ? "opção" : "opções"} para receber os convidados com sabor, frescor e uma bela apresentação.`}
          numero={n("cardapio")}
          total={total}
        >
          <ul className={colunasCardapio} style={{ listStyle: "none", margin: 0, padding: 0, gap: compacto ? "0.6em" : undefined }}>
            {cardapio.map((d, i) => (
              <li key={i} className="pa-cartao" style={{ display: "grid", gridTemplateColumns: d.foto_url && !compacto ? "8em 1fr" : "1fr", gap: "1.2em", alignItems: "center", padding: compacto ? "0.7em 1.1em" : "0.8em", minHeight: compacto ? undefined : "6em" }}>
                {d.foto_url && !compacto && (
                  // eslint-disable-next-line @next/next/no-img-element -- foto do drink (qualquer origem)
                  <img src={d.foto_url} alt="" style={{ width: "8em", height: "8em", objectFit: "cover", borderRadius: "0.6em" }} />
                )}
                <div style={{ padding: d.foto_url && !compacto ? "0 0.6em 0 0" : "0.2em 0.6em" }}>
                  <p className="pa-titulo pa-ouro" style={{ fontSize: compacto ? "1.15em" : "1.35em", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {d.nome}
                  </p>
                  {d.descricao && (
                    <>
                      <div className="pa-regua" style={{ margin: "0.6em 0", background: "rgba(247,242,232,0.16)" }} />
                      <p style={{ fontSize: compacto ? "0.86em" : "0.95em" }}>{d.descricao}</p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Pagina>
      )}

      {/* ------------------------------------------------------------ COMPROMISSOS */}
      <Pagina rotulo={`${secao("compromissos")} / Nossos compromissos`} titulo="Compromissos Aurora" intro={t("compromissos_intro")} numero={n("compromissos")} total={total}>
        <div className="pa-grade-3" style={{ height: "100%" }}>
          {itensComTitulo(t("compromissos")).map((c, i) => (
            <div key={i} className="pa-cartao" style={{ padding: "1.5em 1.9em" }}>
              <p className="pa-titulo pa-ouro" style={{ fontSize: "2.8em" }}>
                {String(i + 1).padStart(2, "0")}
              </p>
              <div style={{ width: "6em", height: 2, background: "var(--pa-ouro)", margin: "0.7em 0 1.1em" }} />
              {c.titulo && (
                <p className="pa-titulo" style={{ fontSize: "1.9em", marginBottom: "0.6em" }}>
                  {c.titulo}
                </p>
              )}
              <p className="pa-suave" style={{ lineHeight: 1.6 }}>
                {c.texto}
              </p>
            </div>
          ))}
        </div>
      </Pagina>

      {/* ------------------------------------------------------------ VIDRARIA */}
      {copos.length > 0 && (
        <Pagina rotulo={`${secao("vidraria")} / Apresentação`} titulo="Vidraria & drinks" intro="Os recipientes utilizados no serviço." numero={n("vidraria")} total={total}>
          <div className={copos.length >= 4 ? "pa-grade-4" : "pa-grade-3"}>
            {copos.map((c, i) => {
              const info = COPOS.find((x) => x.id === c)!;
              const usados = cardapio.filter((d) => d.copo === c).map((d) => d.nome);
              return (
                <div key={c} className="pa-cartao" style={{ padding: "1.1em 1.6em" }}>
                  <p className="pa-rotulo">{String(i + 1).padStart(2, "0")}</p>
                  <div className="pa-regua" style={{ margin: "0.6em 0", background: "rgba(247,242,232,0.16)" }} />
                  <div style={{ width: "min(9.5em, 55%)", aspectRatio: "1", margin: "0 auto" }}>
                    <Recipiente tipo={c} />
                  </div>
                  <div className="pa-regua" style={{ margin: "0.8em 0", background: "rgba(247,242,232,0.16)" }} />
                  <p className="pa-ouro" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {info.nome}
                  </p>
                  <p style={{ fontSize: "0.9em", marginTop: "0.3em" }}>Para: {usados.join(", ")}.</p>
                </div>
              );
            })}
          </div>
          <p className="pa-suave" style={{ marginTop: "0.7em", fontSize: "0.8em" }}>
            Modelos ilustrativos.
          </p>
        </Pagina>
      )}

      {/* ------------------------------------------------------------ RESPONSABILIDADES */}
      <Pagina rotulo={`${secao("responsabilidades")} / Estrutura necessária`} titulo="Responsabilidades" intro={t("responsabilidades_intro")} numero={n("responsabilidades")} total={total}>
        <div className="pa-grade-2" style={{ height: "100%", alignItems: "stretch" }}>
          <div>
            <p className="pa-rotulo" style={{ marginBottom: "1.1em", fontSize: "0.85em" }}>
              Infraestrutura e acesso
            </p>
            <ol style={{ display: "grid", gap: "1.05em", listStyle: "none", margin: 0, padding: 0 }}>
              {linhasDe(t("responsabilidades")).map((r, i) => (
                <li key={i} style={{ display: "grid", gridTemplateColumns: "3.6em 1fr", alignItems: "center" }}>
                  <span style={{ display: "grid", placeItems: "center", width: "2.6em", height: "2.3em", border: "1px solid var(--pa-ouro)", borderRadius: "0.5em", color: "var(--pa-ouro)", fontWeight: 600 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: "1.05em" }}>{r}</span>
                </li>
              ))}
            </ol>
            {p.taxa_quebra !== null && (
              <p className="pa-ouro" style={{ marginTop: "1.4em", fontSize: "0.9em" }}>
                Taxa de quebra: {formatarMoeda(p.taxa_quebra)} por unidade extraviada.
              </p>
            )}
          </div>
          <div className="pa-so-largo pa-quadro-foto">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa */}
            <img src={foto("responsabilidades")} alt="" />
          </div>
        </div>
      </Pagina>

      {/* ------------------------------------------------------------ INVESTIMENTO */}
      <Pagina rotulo={`${secao("investimento")} / Investimento`} titulo="Pacote de serviços" intro={t("investimento_intro")} numero={n("investimento")} total={total}>
        <div className="pa-cartao pa-cartao-ouro pa-grade-2" style={{ height: "100%", padding: "1.3em", gap: "2.2em", alignItems: "stretch" }}>
          <div className="pa-so-largo pa-quadro-foto">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa */}
            <img src={foto("investimento")} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0.4em 0.8em 0.4em 0" }}>
            <p className="pa-rotulo">{convidadosTexto ? `Serviço para ${convidadosTexto}` : "Serviço de bar e coquetelaria"}</p>
            {p.descricao_servico && <p style={{ fontSize: "1.12em", marginTop: "0.4em" }}>{p.descricao_servico}</p>}
            {itensExtras.length > 0 && (
              <ul style={{ listStyle: "none", margin: "1em 0 0", padding: 0, display: "grid", gap: "0.3em", fontSize: "0.92em" }}>
                {itensExtras.map((i, k) => (
                  <li key={k} style={{ display: "flex", justifyContent: "space-between", gap: "1em" }}>
                    <span>
                      {i.descricao}
                      {i.detalhes ? <span className="pa-suave"> · {i.detalhes}</span> : null}
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>{formatarMoeda(i.total)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="pa-regua" style={{ margin: "1.1em 0 0.9em", background: "rgba(247,242,232,0.16)" }} />
            <p className="pa-rotulo">Investimento total</p>
            <p className="pa-titulo" style={{ fontSize: "3.4em", marginTop: "0.05em" }}>
              {formatarMoeda(p.total)}
            </p>
            {(pagamento || p.condicoes_pagamento) && <div className="pa-regua" style={{ margin: "0.9em 0 0.8em", background: "rgba(247,242,232,0.16)" }} />}
            {pagamento && (
              <>
                <p>
                  Entrada ({pct(pagamento.pctEntrada)}) • {formatarMoeda(pagamento.entrada)}
                </p>
                {pagamento.pctSaldo > 0 && (
                  <p style={{ marginTop: "0.3em" }}>
                    Saldo final ({pct(pagamento.pctSaldo)}) • {formatarMoeda(pagamento.saldo)}
                  </p>
                )}
                {(p.entrada_dias_antes !== null || p.saldo_dias_antes !== null) && (
                  <p className="pa-suave" style={{ marginTop: "0.6em", fontSize: "0.88em" }}>
                    Pagamento:{" "}
                    {[
                      p.entrada_dias_antes !== null ? `entrada até ${dias(p.entrada_dias_antes)} antes` : null,
                      p.saldo_dias_antes !== null && pagamento.pctSaldo > 0 ? `saldo até ${dias(p.saldo_dias_antes)} antes` : null,
                    ]
                      .filter(Boolean)
                      .join(" e ")}
                    .
                  </p>
                )}
              </>
            )}
            {p.condicoes_pagamento && (
              <p className="pa-suave" style={{ marginTop: "0.6em", fontSize: "0.88em", whiteSpace: "pre-line" }}>
                {p.condicoes_pagamento}
              </p>
            )}
          </div>
        </div>
      </Pagina>

      {/* ------------------------------------------------------------ TERMOS */}
      {temTermos && (
        <Pagina rotulo={`${secao("termos")} / Termos`} titulo="Termos de rescisão" intro={t("termos_intro")} numero={n("termos")} total={total}>
          <div className={temCancelamento && disposicoes.length ? "pa-grade-2" : ""} style={{ display: "grid", gap: "1.6em" }}>
            {temCancelamento && (
              <div className="pa-cartao" style={{ padding: "1.8em 2em", minHeight: "12em" }}>
                <p className="pa-titulo pa-ouro" style={{ fontSize: "1.5em", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Cancelamento
                </p>
                <div className="pa-regua" style={{ margin: "1em 0 1.4em", background: "rgba(247,242,232,0.16)" }} />
                <ul style={{ display: "grid", gap: "1em", margin: 0, paddingLeft: "1.2em" }}>
                  {p.cancelamento_aviso_dias !== null && <li>Aviso prévio mínimo de {dias(p.cancelamento_aviso_dias)}.</li>}
                  {p.cancelamento_multa_pct !== null && <li>Multa de {pct(p.cancelamento_multa_pct)} do valor total em caso de descumprimento do prazo de aviso.</li>}
                </ul>
              </div>
            )}
            {disposicoes.length > 0 && (
              <div className="pa-cartao" style={{ padding: "1.8em 2em", minHeight: "12em" }}>
                <p className="pa-titulo pa-ouro" style={{ fontSize: "1.5em", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Disposições gerais
                </p>
                <div className="pa-regua" style={{ margin: "1em 0 1.4em", background: "rgba(247,242,232,0.16)" }} />
                <ul style={{ display: "grid", gap: "1em", margin: 0, paddingLeft: "1.2em" }}>
                  {disposicoes.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="pa-suave" style={{ marginTop: "1.2em", fontSize: "0.85em" }}>
            {[t("termos_rodape"), empresa.rodape, p.observacoes].filter(Boolean).join(" ")}
          </p>
        </Pagina>
      )}

      {/* ------------------------------------------------------------ FINAL */}
      <section className="pa-pagina" aria-label="Agradecimento">
        <div className="pa-capa pa-capa-final">
          <div className="pa-capa-foto pa-so-largo" style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto final (qualquer origem) */}
            <img src={foto("final", p.foto_final_url)} alt="" className="pa-foto" style={{ position: "absolute", inset: 0 }} />
          </div>
          <div className="pa-in" style={{ justifyContent: "center" }}>
            <div className="pa-regua" />
            {/* eslint-disable-next-line @next/next/no-img-element -- logo da marca */}
            <img src={logo} alt="" style={{ width: "8.5em", height: "8.5em", objectFit: "contain", borderRadius: "0.6em", marginTop: "1.6em" }} />
            {(ev.nome || ev.tipo) && (
              <p className="pa-rotulo" style={{ marginTop: "2em" }}>
                {ev.nome || nomeTipoEvento(ev.tipo)}
              </p>
            )}
            <h2 className="pa-titulo" style={{ fontSize: "3.6em", marginTop: "0.4em" }}>
              Obrigado{primeiroNome ? `, ${primeiroNome}` : ""}!
            </h2>
            <p className="pa-suave" style={{ marginTop: "1.4em", fontSize: "1.05em", maxWidth: "30em", lineHeight: 1.6 }}>
              {p.mensagem_final || t("mensagem_final")}
            </p>
            {p.status === "aceita" && p.aceita_em && (
              <p style={{ marginTop: "1.4em", padding: "0.8em 1.1em", border: "1px solid #5fc59a", borderRadius: "0.6em", color: "#9fe3c4", fontSize: "0.95em" }}>
                Proposta aceita em {formatarDataHora(p.aceita_em)}
                {p.aceite_nome ? ` por ${p.aceite_nome}` : ""}.
              </p>
            )}
            <div className="pa-regua" style={{ margin: "2.2em 0 1.1em" }} />
            <p className="pa-rotulo" style={{ letterSpacing: "0.08em", textTransform: "none", fontSize: "0.9em" }}>
              {[empresa.instagram ? `@${empresa.instagram.replace(/^@/, "")}` : null, [empresa.cidade, empresa.uf].filter(Boolean).join(", ")].filter(Boolean).join("  •  ")}
            </p>
            <p className="pa-suave" style={{ marginTop: "0.8em", fontSize: "0.72em" }}>
              Proposta {p.numero}
              {p.versao > 1 ? ` · versão ${p.versao}` : ""} · válida até {formatarData(p.validade)}
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
