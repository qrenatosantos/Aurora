/**
 * DOCUMENTO A4 da proposta — usado na tela interna (prévia/impressão) e no link público.
 * As cores aqui são FIXAS de propósito: o documento é "papel branco" (também no modo
 * escuro e na impressão). Só a cor de destaque vem da marca (Personalização) e a LOGO
 * também (sem logo, mostra as iniciais).
 */
import { fmtQtd } from "@/lib/comercial";
import { formatarData, formatarMoeda, formatarTelefone, iniciais } from "@/lib/formatar";

export type EmpresaDoc = {
  nome: string;
  documento?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  site?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  rodape?: string | null;
};

export type PropostaDoc = {
  numero: string;
  versao: number;
  titulo: string;
  status: string;
  validade: string;
  emitida_em: string;
  condicoes_pagamento: string | null;
  prazo_entrega: string | null;
  observacoes: string | null;
  subtotal: number;
  desconto_total: number;
  total: number;
  aceita_em: string | null;
  aceite_nome: string | null;
};

export type ItemDoc = {
  descricao: string;
  detalhes: string | null;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
  total: number;
};

export type ClienteDoc = { empresa?: string | null; contato?: string | null; cargo?: string | null; cidade?: string | null };
export type VendedorDoc = { nome?: string | null; email?: string | null; telefone?: string | null };

/** Texto preto ou branco sobre a cor (contraste simples). */
function textoSobre(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111827" : "#FFFFFF";
}

export function DocumentoProposta({
  proposta: p,
  itens,
  empresa,
  cliente,
  vendedor,
  logoUrl,
  cor,
}: {
  proposta: PropostaDoc;
  itens: ItemDoc[];
  empresa: EmpresaDoc;
  cliente: ClienteDoc;
  vendedor: VendedorDoc;
  logoUrl?: string | null;
  /** Cor principal da marca (#RRGGBB já validada) */
  cor: string;
}) {
  const corTexto = textoSobre(cor);
  const temDesconto = itens.some((i) => Number(i.desconto_pct) > 0);
  const aceita = p.status === "aceita";

  return (
    <article
      className="doc mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-[#E3E7EE] bg-white p-5 text-[12px] leading-snug text-[#111827] shadow-md sm:p-10 sm:text-[13px] print:rounded-none print:border-0 print:p-0 print:shadow-none"
      aria-label={`Proposta ${p.numero} versão ${p.versao}`}
    >
      <header className="flex flex-wrap justify-between gap-4 border-b-[3px] pb-4" style={{ borderColor: cor }}>
        <div className="flex min-w-0 flex-[1_1_260px] gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo vem do Supabase Storage (qualquer domínio)
            <img src={logoUrl} alt={`Logo de ${empresa.nome}`} className="size-[56px] shrink-0 rounded-[10px] object-contain" />
          ) : (
            <div
              className="grid size-[56px] shrink-0 place-items-center rounded-[10px] text-lg font-extrabold"
              style={{ background: cor, color: corTexto }}
              aria-hidden
            >
              {iniciais(empresa.nome.replace(/&/g, " "))}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-[#111827]">{empresa.nome}</h2>
            <div className="text-[11.5px] text-[#4B5566]">
              {empresa.documento && <p>CNPJ {empresa.documento}</p>}
              <p>{[formatarTelefone(empresa.whatsapp), empresa.email, empresa.site].filter(Boolean).join(" · ")}</p>
              {(empresa.endereco || empresa.cidade) && <p>{[empresa.endereco, empresa.cidade].filter(Boolean).join(" — ")}</p>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-extrabold tracking-[0.06em]" style={{ color: cor }}>
            PROPOSTA
          </p>
          <p className="text-sm font-bold">
            {p.numero} {p.versao > 1 ? `· versão ${p.versao}` : ""}
          </p>
          <div className="text-[11.5px] text-[#4B5566]">
            <p>Emissão: {formatarData(p.emitida_em)}</p>
            <p>Válida até: {formatarData(p.validade)}</p>
          </div>
        </div>
      </header>

      <h3 className="mt-4 text-base font-extrabold">{p.titulo}</h3>

      <div className="my-4 grid gap-3 rounded-lg bg-[#F4F6F9] px-3.5 py-3 sm:grid-cols-2">
        <div>
          <span className="block text-[10.5px] font-bold tracking-[0.06em] text-[#6B7485] uppercase">Cliente</span>
          <strong>{cliente.empresa || cliente.contato || "—"}</strong>
          {cliente.empresa && cliente.contato && (
            <span className="block">
              A/C {cliente.contato}
              {cliente.cargo ? ` — ${cliente.cargo}` : ""}
            </span>
          )}
          {cliente.cidade && <span className="block text-[#4B5566]">{cliente.cidade}</span>}
        </div>
        <div>
          <span className="block text-[10.5px] font-bold tracking-[0.06em] text-[#6B7485] uppercase">Seu consultor</span>
          <strong>{vendedor.nome || "—"}</strong>
          <span className="block text-[#4B5566]">{[formatarTelefone(vendedor.telefone), vendedor.email].filter(Boolean).join(" · ")}</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse">
          <thead>
            <tr style={{ background: cor, color: corTexto }}>
              <th className="px-2 py-1.5 text-left font-bold">Item</th>
              <th className="px-2 py-1.5 text-right font-bold">Qtd.</th>
              <th className="px-2 py-1.5 text-right font-bold">Unitário</th>
              {temDesconto && <th className="px-2 py-1.5 text-right font-bold">Desc.</th>}
              <th className="px-2 py-1.5 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i, n) => (
              <tr key={n} className="border-b border-[#E3E7EE] align-top">
                <td className="px-2 py-2">
                  <strong className="block">{i.descricao}</strong>
                  {i.detalhes && <span className="block text-[11px] text-[#4B5566]">{i.detalhes}</span>}
                </td>
                <td className="num px-2 py-2 text-right whitespace-nowrap">
                  {fmtQtd(i.quantidade)} {i.unidade}
                </td>
                <td className="num px-2 py-2 text-right whitespace-nowrap">{formatarMoeda(i.preco_unitario)}</td>
                {temDesconto && (
                  <td className="num px-2 py-2 text-right whitespace-nowrap">{Number(i.desconto_pct) > 0 ? `${fmtQtd(i.desconto_pct)}%` : "—"}</td>
                )}
                <td className="num px-2 py-2 text-right font-bold whitespace-nowrap">{formatarMoeda(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto grid w-full max-w-[300px] gap-1">
        {Number(p.desconto_total) > 0 && (
          <>
            <p className="flex justify-between gap-2">
              <span>Subtotal</span>
              <span className="num">{formatarMoeda(p.subtotal)}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span>Descontos</span>
              <span className="num">−{formatarMoeda(p.desconto_total)}</span>
            </p>
          </>
        )}
        <p className="mt-1 flex justify-between gap-2 rounded-md px-3 py-2.5 text-[17px] font-extrabold" style={{ background: cor, color: corTexto }}>
          <span>TOTAL</span>
          <span className="num">{formatarMoeda(p.total)}</span>
        </p>
      </div>

      <div className="mt-5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {p.condicoes_pagamento && <Bloco rotulo="Condições de pagamento" texto={p.condicoes_pagamento} />}
        {p.prazo_entrega && <Bloco rotulo="Prazo de entrega" texto={p.prazo_entrega} />}
        <Bloco rotulo="Validade" texto={`Esta proposta vale até ${formatarData(p.validade)}.`} />
        {p.observacoes && <Bloco rotulo="Observações" texto={p.observacoes} />}
      </div>

      {aceita ? (
        <p className="mt-6 text-center">
          <span className="inline-block rounded-md border-2 border-[#1B6B3A] px-3 py-1 text-[12px] font-extrabold tracking-[0.06em] text-[#1B6B3A]">
            ACEITA EM {formatarData(p.aceita_em)} {p.aceite_nome ? `POR ${p.aceite_nome.toUpperCase()}` : ""}
          </span>
        </p>
      ) : (
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <Assinatura rotulo={empresa.nome} />
          <Assinatura rotulo={`De acordo — ${cliente.empresa || cliente.contato || "cliente"}`} />
        </div>
      )}

      {empresa.rodape && <p className="mt-6 border-t border-[#E3E7EE] pt-3 text-center text-[10.5px] text-[#6B7485]">{empresa.rodape}</p>}
    </article>
  );
}

function Bloco({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div>
      <span className="block text-[10.5px] font-bold tracking-[0.06em] text-[#6B7485] uppercase">{rotulo}</span>
      <p className="whitespace-pre-line">{texto}</p>
    </div>
  );
}

function Assinatura({ rotulo }: { rotulo: string }) {
  return (
    <div className="border-t border-[#9AA3B2] pt-1 text-center text-[11px] text-[#4B5566]">
      {rotulo}
    </div>
  );
}
