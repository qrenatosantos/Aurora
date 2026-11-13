"use client";

/**
 * IMPORTAÇÃO DE LEADS (CSV) em 3 passos: arquivo → ligar colunas → conferir e importar.
 * - Lê CSV com ";" ou "," (Excel em português salva com ";"), aspas e acentos (UTF-8 ou Windows-1252).
 * - Adivinha as colunas pelo nome do cabeçalho (dá para trocar).
 * - "Conferir" roda no banco SEM gravar: mostra duplicados (e-mail/telefone) e erros.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileUp, ListChecks, Upload } from "lucide-react";
import { importarLeads } from "@/app/(app)/contatos/actions";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { useToast } from "@/components/ui/toast";
import type { ResultadoImportacao } from "@/lib/tipos";

const CAMPOS = [
  { id: "nome", nome: "Nome *", dicas: ["nome", "name", "contato", "cliente", "lead"] },
  { id: "email", nome: "E-mail", dicas: ["email", "e-mail", "mail"] },
  { id: "telefone", nome: "Telefone / WhatsApp", dicas: ["telefone", "fone", "celular", "whats", "phone", "tel"] },
  { id: "empresa", nome: "Empresa", dicas: ["empresa", "company", "razao", "razão", "organizacao", "organização"] },
  { id: "cargo", nome: "Cargo", dicas: ["cargo", "funcao", "função", "title"] },
  { id: "cidade", nome: "Cidade", dicas: ["cidade", "city", "municipio", "município"] },
  { id: "observacoes", nome: "Observações", dicas: ["obs", "observ", "nota", "comentario", "comentário"] },
  { id: "tags", nome: "Etiquetas (separadas por ;)", dicas: ["tag", "etiqueta"] },
] as const;
type CampoId = (typeof CAMPOS)[number]["id"];

/** Parser de CSV simples e robusto (aspas, separador ; ou ,, quebras de linha dentro de aspas). */
function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function Importador({
  vendedores,
  origens,
  gestor,
  meuId,
}: {
  vendedores: { id: string; nome: string }[];
  origens: { id: string; nome: string }[];
  gestor: boolean;
  meuId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const [pendente, iniciar] = useTransition();
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [cabecalho, setCabecalho] = useState<string[]>([]);
  const [dados, setDados] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Record<CampoId, number>>({} as Record<CampoId, number>);
  const [responsavel, setResponsavel] = useState(meuId ?? "");
  const [origem, setOrigem] = useState("");
  const [tags, setTags] = useState("");
  const [pular, setPular] = useState(true);
  const [conferido, setConferido] = useState<ResultadoImportacao | null>(null);
  const [final, setFinal] = useState<ResultadoImportacao | null>(null);

  async function carregar(f: File) {
    if (f.size > 5 * 1024 * 1024) {
      toast.erro("Arquivo maior que 5 MB. Divida a planilha em partes.");
      return;
    }
    const bytes = await f.arrayBuffer();
    let texto = new TextDecoder("utf-8").decode(bytes);
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(bytes); // Excel antigo
    const linhas = lerCsv(texto);
    if (linhas.length < 2) {
      toast.erro("Não encontrei dados. A 1ª linha deve ter os nomes das colunas e as demais, os contatos.");
      return;
    }
    const cab = linhas[0].map((c) => c.trim());
    const novoMapa = {} as Record<CampoId, number>;
    for (const campo of CAMPOS) {
      const i = cab.findIndex((h) => campo.dicas.some((d) => normalizar(h).includes(normalizar(d))));
      if (i >= 0 && !Object.values(novoMapa).includes(i)) novoMapa[campo.id] = i;
    }
    setNomeArquivo(f.name);
    setCabecalho(cab);
    setDados(linhas.slice(1));
    setMapa(novoMapa);
    setConferido(null);
    setFinal(null);
  }

  const linhasMapeadas = () =>
    dados.map((l) => {
      const o: Partial<Record<CampoId, string>> = {};
      for (const c of CAMPOS) if (mapa[c.id] !== undefined && mapa[c.id] >= 0) o[c.id] = (l[mapa[c.id]] ?? "").trim();
      return o;
    });

  function enviar(simular: boolean) {
    if (mapa.nome === undefined || mapa.nome < 0) {
      toast.erro("Escolha qual coluna tem o NOME do contato.");
      return;
    }
    iniciar(async () => {
      const r = await importarLeads({
        linhas: linhasMapeadas(),
        responsavel: gestor ? responsavel || null : null,
        origem: origem || null,
        tags,
        pularDuplicados: pular,
        simular,
      });
      if (!r.ok || !r.resultado) {
        toast.erro(r.mensagem ?? "Não foi possível.");
        return;
      }
      toast.sucesso(r.mensagem ?? "Pronto.");
      if (simular) setConferido(r.resultado);
      else {
        setFinal(r.resultado);
        router.refresh();
      }
    });
  }

  if (final) {
    return (
      <Cartao className="text-center">
        <CheckCircle2 className="mx-auto mb-3 size-12 text-ok" aria-hidden />
        <h2 className="text-lg font-semibold">Importação concluída</h2>
        <p className="mt-1 text-sm text-texto-2">
          {final.criados} contato(s) criado(s){final.empresas ? `, ${final.empresas} empresa(s) nova(s)` : ""}
          {final.duplicados ? `, ${final.duplicados} duplicado(s) ${pular ? "pulado(s)" : "importado(s) mesmo assim"}` : ""}
          {final.erros ? `, ${final.erros} linha(s) com erro` : ""}.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/contatos" className={classesBotao()}>
            Ver contatos
          </Link>
          <Botao variante="secundario" onClick={() => setFinal(null)}>
            Importar outro arquivo
          </Botao>
        </div>
      </Cartao>
    );
  }

  const exemplo = dados.slice(0, 5);
  const problemas = (conferido?.linhas ?? []).filter((l) => l.status !== "ok");

  return (
    <div className="space-y-4">
      <Cartao>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-marca text-sm text-marca-texto">1</span> Escolha o arquivo CSV
        </h2>
        <p className="mb-3 text-sm text-texto-2">
          No Excel ou Google Planilhas: Arquivo ▸ Salvar como / Fazer download ▸ <strong>CSV</strong>. A 1ª linha precisa ter os nomes das
          colunas (ex.: Nome; E-mail; Telefone; Empresa). Até 2.000 linhas por vez.
        </p>
        <input
          ref={arquivo}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          id="arquivo-csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void carregar(f);
            e.target.value = "";
          }}
        />
        <label htmlFor="arquivo-csv" className={classesBotao("secundario", "cursor-pointer")}>
          <FileUp className="size-4" aria-hidden /> {nomeArquivo ? "Trocar arquivo" : "Escolher arquivo"}
        </label>
        {nomeArquivo && (
          <p className="mt-2 text-sm">
            <strong>{nomeArquivo}</strong>: {dados.length} linha(s) de dados, {cabecalho.length} coluna(s).
          </p>
        )}
      </Cartao>

      {cabecalho.length > 0 && (
        <Cartao>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <span className="grid size-7 place-items-center rounded-full bg-marca text-sm text-marca-texto">2</span> Ligue as colunas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <label key={c.id} className="text-sm font-medium">
                {c.nome}
                <Selecao
                  value={mapa[c.id] ?? -1}
                  onChange={(e) => {
                    setMapa((m) => ({ ...m, [c.id]: Number(e.target.value) }));
                    setConferido(null);
                  }}
                >
                  <option value={-1}>— não importar —</option>
                  {cabecalho.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Coluna ${i + 1}`}
                    </option>
                  ))}
                </Selecao>
              </label>
            ))}
          </div>
          <div className="relative mt-4 overflow-x-auto rounded-xl border border-borda">
            <table className="w-full min-w-[520px] text-left text-xs">
              <caption className="bg-superficie-2 px-3 py-2 text-left text-xs font-semibold text-texto-2">Prévia (5 primeiras linhas)</caption>
              <thead>
                <tr className="border-b border-borda">
                  {CAMPOS.filter((c) => (mapa[c.id] ?? -1) >= 0).map((c) => (
                    <th key={c.id} className="px-3 py-2 font-semibold">
                      {c.nome.replace(" *", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exemplo.map((l, i) => (
                  <tr key={i} className="border-b border-borda last:border-0">
                    {CAMPOS.filter((c) => (mapa[c.id] ?? -1) >= 0).map((c) => (
                      <td key={c.id} className="max-w-48 truncate px-3 py-2">
                        {l[mapa[c.id]] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}

      {cabecalho.length > 0 && (
        <Cartao className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="grid size-7 place-items-center rounded-full bg-marca text-sm text-marca-texto">3</span> Conferir e importar
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {gestor && (
              <label className="text-sm font-medium">
                Responsável pelos leads
                <Selecao value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </Selecao>
              </label>
            )}
            <label className="text-sm font-medium">
              Origem dos leads
              <Selecao value={origem} onChange={(e) => setOrigem(e.target.value)}>
                <option value="">— não informada —</option>
                {origens.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </Selecao>
            </label>
            <label className="text-sm font-medium">
              Etiquetas para todos
              <Entrada value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex.: Feira 2026" maxLength={200} />
            </label>
          </div>
          <fieldset className="space-y-1 text-sm">
            <legend className="mb-1 font-medium">Contatos que já existem (mesmo e-mail ou telefone)</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input type="radio" name="dup" checked={pular} onChange={() => {
                  setPular(true);
                  setConferido(null);
                }} className="size-5 accent-[var(--marca)]" /> Pular
              (recomendado)
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input type="radio" name="dup" checked={!pular} onChange={() => {
                  setPular(false);
                  setConferido(null);
                }} className="size-5 accent-[var(--marca)]" /> Importar
              mesmo assim
            </label>
          </fieldset>

          {conferido && (
            <div className="rounded-xl bg-superficie-2 p-3 text-sm">
              <p className="font-semibold">
                {conferido.criados} pronto(s) para importar · {conferido.duplicados} duplicado(s) · {conferido.erros} com erro
              </p>
              {problemas.length > 0 && (
                <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto text-xs text-texto-2">
                  {problemas.slice(0, 100).map((p) => (
                    <li key={p.linha}>
                      Linha {p.linha + 1}: {p.motivo}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Botao variante="secundario" carregando={pendente && !conferido} onClick={() => enviar(true)}>
              <ListChecks className="size-4" aria-hidden /> Conferir duplicados
            </Botao>
            <Botao carregando={pendente && Boolean(conferido)} disabled={!conferido} onClick={() => enviar(false)}>
              <Upload className="size-4" aria-hidden /> Importar {conferido ? conferido.criados : ""} contato(s)
            </Botao>
          </div>
        </Cartao>
      )}
    </div>
  );
}
