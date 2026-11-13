/**
 * METAS do mês: por vendedor e por equipe (valor e nº de vendas), com barra de
 * progresso e PROJEÇÃO (mantendo o ritmo atual até o fim do mês).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { BarraProgresso } from "@/components/comercial/barra-progresso";
import { classesBotao } from "@/components/ui/botao";
import { CabecalhoPagina, Cartao, Selo } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { difDias, fimMes, inicioMes, mesValido, moedaInteira, nomeMes, pct, somarMeses } from "@/lib/comercial";
import { listarEquipes, listarVendedores } from "@/lib/dados";
import { hojeISO } from "@/lib/formatar";
import { ehGestor, obterPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FormMetas } from "./form-metas";
import { ModuloDesligado } from "@/components/comercial/modulo-desligado";
import { obterConfiguracoes } from "@/lib/configuracoes";

export const metadata: Metadata = { title: "Metas" };

export default async function PaginaMetas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const [configModulo, perfilModulo] = await Promise.all([obterConfiguracoes(), obterPerfil()]);
  if (!configModulo.mod_metas) return <ModuloDesligado nome="Metas" gestor={Boolean(ehGestor(perfilModulo.perfil))} />;
  const sp = await searchParams;
  const hoje = hojeISO();
  const competencia = mesValido(sp.mes) ? `${sp.mes}-01` : inicioMes(hoje);
  const supabase = await createClient();
  const [{ perfil }, vendedores, equipes, { data: progresso }] = await Promise.all([
    obterPerfil(),
    listarVendedores(),
    listarEquipes(),
    supabase.rpc("progresso_metas", { p_competencia: competencia }),
  ]);
  const gestor = ehGestor(perfil);
  const metas = progresso ?? [];

  // Projeção: no mês atual, realizado ÷ dias passados × dias do mês
  const diasMes = Number(fimMes(competencia).slice(8));
  const mesAtual = competencia === inicioMes(hoje);
  const futuro = competencia > inicioMes(hoje);
  const diasPassados = mesAtual ? difDias(competencia, hoje) + 1 : diasMes;
  const fator = futuro ? 0 : diasMes / Math.max(1, diasPassados);
  const linkMes = (n: number) => `/metas?mes=${somarMeses(competencia, n).slice(0, 7)}`;

  const alvos = [
    ...vendedores
      .filter((v) => v.ativo && v.papel === "vendedor")
      .map((v) => {
        const m = metas.find((x) => x.vendedor_id === v.id);
        return { vendedor_id: v.id, equipe_id: null, nome: v.nome, meta_valor: Number(m?.meta_valor ?? 0), meta_qtd: m?.meta_qtd ?? 0 };
      }),
    ...equipes.map((e) => {
      const m = metas.find((x) => x.equipe_id === e.id);
      return { vendedor_id: null, equipe_id: e.id, nome: e.nome, meta_valor: Number(m?.meta_valor ?? 0), meta_qtd: m?.meta_qtd ?? 0 };
    }),
  ];

  return (
    <>
      <CabecalhoPagina titulo="Metas" descricao="Vendas ganhas no mês contra a meta. O traço na barra mostra a projeção para o fim do mês." />
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={linkMes(-1)} className={classesBotao("secundario")} aria-label="Mês anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <p className="text-center text-lg font-bold capitalize">{nomeMes(competencia)}</p>
        <Link href={linkMes(1)} className={classesBotao("secundario")} aria-label="Próximo mês">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {mesAtual && (
        <p className="mb-4 text-center text-sm text-texto-2">
          Dia {diasPassados} de {diasMes} ({pct(diasPassados / diasMes)} do mês)
        </p>
      )}

      {metas.length === 0 ? (
        <EstadoVazio
          icone={Target}
          titulo="Sem metas neste mês"
          descricao={gestor ? "Defina abaixo a meta de cada vendedor e de cada equipe." : "O gestor ainda não definiu as metas deste mês."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {metas.map((m) => {
            const real = Number(m.realizado_valor);
            const meta = Number(m.meta_valor);
            const proj = futuro ? null : real * fator;
            const minha = m.vendedor_id === perfil?.id;
            return (
              <Cartao key={m.meta_id} className={cn("space-y-3", minha && "ring-2 ring-marca")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {m.nome} {minha && <span className="text-xs text-marca-forte">(você)</span>}
                  </p>
                  <Selo cor={m.equipe_id ? "info" : "marca"}>{m.equipe_id ? "Equipe" : "Vendedor"}</Selo>
                </div>
                {meta > 0 && (
                  <div>
                    <p className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span>
                        <strong className="num text-base">{moedaInteira(real)}</strong>
                        <span className="text-texto-2"> de {moedaInteira(meta)}</span>
                      </span>
                      <strong className={cn("num", real >= meta ? "text-menta-texto" : "text-texto")}>{pct(real / meta)}</strong>
                    </p>
                    <BarraProgresso atual={real} meta={meta} projecao={mesAtual ? proj : null} rotulo={`Meta em valor de ${m.nome}`} />
                    {mesAtual && proj !== null && (
                      <p className={cn("mt-1 text-xs", proj >= meta ? "text-menta-texto" : "text-alerta")}>
                        Projeção: {moedaInteira(proj)} ({pct(proj / meta)}){" "}
                        {proj < meta ? `· faltam ${moedaInteira(meta - real)}` : "· no ritmo para bater!"}
                      </p>
                    )}
                  </div>
                )}
                {m.meta_qtd > 0 && (
                  <div>
                    <p className="mb-1 flex justify-between text-sm">
                      <span>
                        <strong className="num">{m.realizado_qtd}</strong>
                        <span className="text-texto-2"> de {m.meta_qtd} vendas</span>
                      </span>
                      <strong className="num">{pct(m.realizado_qtd / m.meta_qtd)}</strong>
                    </p>
                    <BarraProgresso
                      atual={m.realizado_qtd}
                      meta={m.meta_qtd}
                      projecao={mesAtual ? m.realizado_qtd * fator : null}
                      rotulo={`Meta de vendas de ${m.nome}`}
                    />
                  </div>
                )}
              </Cartao>
            );
          })}
        </div>
      )}

      {gestor && (
        <div className="mt-6">
          <FormMetas key={competencia + metas.map((m) => `${m.meta_id}${m.meta_valor}${m.meta_qtd}`).join()} competencia={competencia} alvos={alvos} />
        </div>
      )}
    </>
  );
}
