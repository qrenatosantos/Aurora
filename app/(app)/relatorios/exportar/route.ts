/**
 * EXPORTAR CSV (abre no Excel): /relatorios/exportar?tipo=negocios|atividades|contatos&...filtros
 * Usa o cliente do servidor: o RLS vale aqui também (cada um exporta só o que pode ver).
 */
import { NextResponse, type NextRequest } from "next/server";
import { STATUS_NEGOCIO, lerPeriodo, linhaCsv, nomeTipoAtividade, somarDias } from "@/lib/comercial";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { todasAsLinhas } from "@/lib/paginar";
import { createClient } from "@/lib/supabase/server";
import type { Atividade, Contato, Negocio } from "@/lib/tipos";

const UUID = /^[0-9a-f-]{36}$/i;

function arquivo(nome: string, linhas: string[]) {
  // BOM + ";" = acentos e colunas certas no Excel em português
  return new NextResponse("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const usaPeriodo = Boolean(sp.periodo);
  const { de, ate } = lerPeriodo(sp);
  const ini = `${de}T00:00:00-03:00`;
  const fim = `${somarDias(ate, 1)}T00:00:00-03:00`;
  const funil = UUID.test(sp.funil ?? "") ? sp.funil : "";
  const vendedor = UUID.test(sp.vendedor ?? "") ? sp.vendedor : "";

  const [{ data: vends }, { data: etapas }, { data: funis }, { data: origens }, { data: motivos }] = await Promise.all([
    supabase.from("vendedores").select("id, nome"),
    supabase.from("etapas").select("id, nome, probabilidade"),
    supabase.from("funis").select("id, nome"),
    supabase.from("origens").select("id, nome"),
    supabase.from("motivos_perda").select("id, nome"),
  ]);
  const nome = (lista: { id: string; nome: string }[] | null) => new Map((lista ?? []).map((x) => [x.id, x.nome]));
  const nV = nome(vends);
  const nE = nome(etapas);
  const nF = nome(funis);
  const nO = nome(origens);
  const nM = nome(motivos);
  const prob = new Map((etapas ?? []).map((e) => [e.id, e.probabilidade]));
  const empresasDe = async (ids: (string | null)[]) => {
    const unicos = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
    const m = new Map<string, string>();
    for (let i = 0; i < unicos.length; i += 100) {
      const { data } = await supabase.from("empresas").select("id, nome").in("id", unicos.slice(i, i + 100));
      for (const e of data ?? []) m.set(e.id, e.nome);
    }
    return m;
  };

  if (sp.tipo === "atividades") {
    const lista = await todasAsLinhas<Atividade>((a, b) => {
      let q = supabase.from("atividades").select("*").gte("quando", ini).lt("quando", fim);
      if (vendedor) q = q.eq("vendedor_id", vendedor);
      return q.order("quando").order("id").range(a, b);
    });
    const linhas = [linhaCsv(["Data/hora", "Tipo", "Título", "Vendedor", "Concluída", "Concluída em", "Resultado", "Descrição"])];
    for (const x of lista)
      linhas.push(
        linhaCsv([
          formatarDataHora(x.quando),
          nomeTipoAtividade(x.tipo),
          x.titulo,
          nV.get(x.vendedor_id),
          x.concluida ? "Sim" : "Não",
          x.concluida_em ? formatarDataHora(x.concluida_em) : "",
          x.resultado,
          x.descricao,
        ]),
      );
    return arquivo(`atividades-${de}-a-${ate}.csv`, linhas);
  }

  if (sp.tipo === "contatos") {
    const qt = (sp.q ?? "").trim().slice(0, 60).replace(/[%_,()]/g, " ");
    const lista = await todasAsLinhas<Contato>((a, b) => {
      let q = supabase.from("contatos").select("*");
      if (qt) q = q.or(`nome.ilike.%${qt}%,email.ilike.%${qt}%,cargo.ilike.%${qt}%`);
      if (sp.tag) q = q.contains("tags", [sp.tag.slice(0, 30)]);
      if (UUID.test(sp.origem ?? "")) q = q.eq("origem_id", sp.origem);
      if (UUID.test(sp.responsavel ?? "")) q = q.eq("responsavel_id", sp.responsavel);
      return q.order("nome").order("id").range(a, b);
    });
    const emp = await empresasDe(lista.map((c) => c.empresa_id));
    const linhas = [linhaCsv(["Nome", "Empresa", "Cargo", "E-mail", "Telefone", "Cidade", "Origem", "Etiquetas", "Responsável", "Cadastrado em"])];
    for (const c of lista)
      linhas.push(
        linhaCsv([
          c.nome,
          c.empresa_id ? emp.get(c.empresa_id) : "",
          c.cargo,
          c.email,
          c.telefone,
          c.cidade,
          c.origem_id ? nO.get(c.origem_id) : "",
          c.tags.join(", "),
          c.responsavel_id ? nV.get(c.responsavel_id) : "",
          formatarData(c.created_at),
        ]),
      );
    return arquivo("contatos.csv", linhas);
  }

  // negócios (padrão)
  const status = ["aberto", "ganho", "perdido"].includes(sp.status ?? "") ? sp.status : "";
  const qt = (sp.q ?? "").trim().slice(0, 60).replace(/[%_,()]/g, " ");
  const lista = await todasAsLinhas<Negocio>((a, b) => {
    let q = supabase.from("negocios").select("*");
    if (funil) q = q.eq("funil_id", funil);
    if (vendedor) q = q.eq("vendedor_id", vendedor);
    if (status) q = q.eq("status", status as Negocio["status"]);
    if (qt) q = q.ilike("titulo", `%${qt}%`);
    if (usaPeriodo) q = q.gte("created_at", ini).lt("created_at", fim);
    return q.order("created_at").order("id").range(a, b);
  });
  const emp = await empresasDe(lista.map((n) => n.empresa_id));
  const linhas = [
    linhaCsv([
      "Negócio",
      "Empresa",
      "Funil",
      "Etapa",
      "Probabilidade (%)",
      "Situação",
      "Valor (R$)",
      "Vendedor",
      "Origem",
      "Criado em",
      "Previsão",
      "Fechado em",
      "Motivo da perda",
      "Etiquetas",
    ]),
  ];
  for (const n of lista)
    linhas.push(
      linhaCsv([
        n.titulo,
        n.empresa_id ? emp.get(n.empresa_id) : "",
        nF.get(n.funil_id),
        nE.get(n.etapa_id),
        prob.get(n.etapa_id) ?? "",
        STATUS_NEGOCIO[n.status].nome,
        Number(n.valor),
        nV.get(n.vendedor_id),
        n.origem_id ? nO.get(n.origem_id) : "",
        formatarData(n.created_at),
        n.previsao_fechamento ? formatarData(n.previsao_fechamento) : "",
        n.fechado_em ? formatarData(n.fechado_em) : "",
        n.motivo_perda_id ? nM.get(n.motivo_perda_id) : "",
        n.tags.join(", "),
      ]),
    );
  return arquivo(usaPeriodo ? `negocios-${de}-a-${ate}.csv` : "negocios.csv", linhas);
}
