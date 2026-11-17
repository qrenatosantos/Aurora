"use client";

/**
 * QUADRO KANBAN do funil.
 * - Arrastar e soltar com mouse (arrasta ao mover 6px) e com o dedo (toque e segure ~0,3 s),
 *   usando pointer events. Perto das bordas o quadro/página rolam sozinhos.
 * - Enquanto arrasta, aparecem as áreas "Ganho" e "Perdido" no rodapé.
 * - Botão "⋯" abre o menu "Mover para…" (funciona com teclado: setas, Enter, Esc).
 * - Atualização otimista: o card muda de coluna na hora; se o banco recusar, volta e avisa.
 * - Perdido pede o motivo (obrigatório também no banco). Ganho exige valor > 0 (banco).
 */
import { Building2, CalendarClock, Hourglass, MoreHorizontal, Move, Plus, Search, ThumbsDown, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ganharNegocio, moverNegocio } from "@/app/(app)/negocios/actions";
import { Botao } from "@/components/ui/botao";
import { Chip, Fab } from "@/components/ui/controles";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { useToast } from "@/components/ui/toast";
import { diasDesde, moedaCurta, moedaInteira, primeiroNome, rotuloQuando, situacaoAtividade } from "@/lib/comercial";
import { iniciais } from "@/lib/formatar";
import type { Etapa, MotivoPerda, Negocio } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { DialogoNegocio, type OpcoesNegocio } from "./dialogo-negocio";
import { DialogoPerda } from "./dialogo-perda";

export type CardFunil = Negocio & {
  empresaNome: string | null;
  contatoNome: string | null;
  proxima: { quando: string; titulo: string } | null;
};

type Movimento = { id: string; etapaId: string | null };

type Arraste = {
  card: HTMLElement;
  id: string;
  pointerId: number;
  mouse: boolean;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  x: number;
  y: number;
  ativo: boolean;
  timer?: ReturnType<typeof setTimeout>;
  fantasma?: HTMLElement;
  alvo: string | null;
};

const GANHO = "__ganho";
const PERDIDO = "__perdido";

export function Quadro({
  etapas,
  negocios: negociosServidor,
  opcoes,
  motivos,
  diasParado,
  agora,
  hoje,
  vendedores,
  mostrarVendedor,
  fechados = [],
}: {
  /** Negócios ganhos recentes: coluna final "Negócio fechado" (só leitura; soltar ali = ganho). */
  fechados?: { id: string; titulo: string; valor: number; fechado_em: string | null; contatoNome: string | null }[];
  etapas: Etapa[];
  negocios: CardFunil[];
  opcoes: OpcoesNegocio;
  motivos: MotivoPerda[];
  diasParado: number;
  agora: number;
  hoje: string;
  vendedores: Record<string, { nome: string; cor: string }>;
  mostrarVendedor: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, iniciar] = useTransition();
  // etapaId null = saiu do quadro (ganho/perdido)
  const [negocios, moverOtimista] = useOptimistic(negociosServidor, (lista: CardFunil[], m: Movimento) =>
    m.etapaId === null
      ? lista.filter((n) => n.id !== m.id)
      : lista.map((n) => (n.id === m.id ? { ...n, etapa_id: m.etapaId! } : n)),
  );

  const [busca, setBusca] = useState("");
  const [soParados, setSoParados] = useState(false);
  const [novo, setNovo] = useState<{ etapaId?: string } | null>(null);
  const [perda, setPerda] = useState<CardFunil | null>(null);
  const [menu, setMenu] = useState<{ negocio: CardFunil; botao: HTMLButtonElement } | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const quadroRef = useRef<HTMLDivElement>(null);
  const arraste = useRef<Arraste | null>(null);
  const suprimirClique = useRef(false);

  const etapaPorId = new Map(etapas.map((e) => [e.id, e]));

  // ---------------- mover ----------------
  function pedirMover(n: CardFunil, destino: string) {
    if (destino === n.etapa_id) return;
    if (destino === PERDIDO) {
      setPerda(n);
      return;
    }
    if (destino === GANHO) {
      if (!(Number(n.valor) > 0)) {
        toast.erro("Para ganhar, o negócio precisa ter valor. Abra o negócio e adicione produtos ou o valor.");
        return;
      }
      iniciar(async () => {
        moverOtimista({ id: n.id, etapaId: null });
        const r = await ganharNegocio(n.id);
        if (!r.ok) toast.erro(r.mensagem ?? "Não foi possível.");
        else toast.sucesso(`Parabéns! Negócio ganho: ${moedaInteira(n.valor)}`);
        router.refresh();
      });
      return;
    }
    const etapa = etapaPorId.get(destino);
    if (!etapa) return;
    iniciar(async () => {
      moverOtimista({ id: n.id, etapaId: destino });
      const r = await moverNegocio(n.id, destino);
      if (!r.ok) toast.erro(r.mensagem ?? "Não foi possível mover.");
      else toast.sucesso(`Movido para ${etapa.nome}`);
    });
  }

  // Referência sempre atual para os ouvintes globais do arraste (registrados uma vez só).
  const atual = useRef({ negocios, pedirMover });
  useEffect(() => {
    atual.current = { negocios, pedirMover };
  });

  // ---------------- arrastar e soltar (pointer events) ----------------
  useEffect(() => {
    let quadroRaf = 0;

    function prevenirRolagem(e: TouchEvent) {
      if (arraste.current?.ativo) e.preventDefault();
    }

    function limpar() {
      const a = arraste.current;
      if (!a) return;
      clearTimeout(a.timer);
      a.fantasma?.remove();
      a.card.style.opacity = "";
      a.card.classList.remove("ring-2", "ring-marca");
      document.body.classList.remove("arrastando");
      document.removeEventListener("touchmove", prevenirRolagem);
      cancelAnimationFrame(quadroRaf);
      arraste.current = null;
      setAlvo(null);
      setArrastando(false);
    }

    function moverFantasma(x: number, y: number) {
      const a = arraste.current;
      if (!a?.fantasma) return;
      a.x = x;
      a.y = y;
      a.fantasma.style.left = `${x - a.dx}px`;
      a.fantasma.style.top = `${y - a.dy}px`;
      const coluna = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-etapa]");
      const novoAlvo = coluna?.dataset.etapa ?? null;
      if (novoAlvo !== a.alvo) {
        a.alvo = novoAlvo;
        setAlvo(novoAlvo);
      }
    }

    function rolarNasBordas() {
      const a = arraste.current;
      if (!a?.ativo) return;
      const q = quadroRef.current;
      let rolou = false;
      if (q) {
        const r = q.getBoundingClientRect();
        const antes = q.scrollLeft;
        if (a.x < r.left + 40) q.scrollLeft -= 12;
        else if (a.x > r.right - 40) q.scrollLeft += 12;
        rolou = q.scrollLeft !== antes;
      }
      if (a.y < 90) {
        window.scrollBy(0, -8);
        rolou = true;
      } else if (a.y > window.innerHeight - 160 && a.y < window.innerHeight - 110) {
        window.scrollBy(0, 8);
        rolou = true;
      }
      if (rolou) moverFantasma(a.x, a.y);
      quadroRaf = requestAnimationFrame(rolarNasBordas);
    }

    function comecar(x: number, y: number) {
      const a = arraste.current;
      if (!a) return;
      const r = a.card.getBoundingClientRect();
      a.dx = x - r.left;
      a.dy = y - r.top;
      const f = a.card.cloneNode(true) as HTMLElement;
      f.classList.remove("ring-2", "ring-marca");
      f.classList.add("card-fantasma");
      f.setAttribute("aria-hidden", "true");
      f.style.width = `${r.width}px`;
      document.body.appendChild(f);
      a.fantasma = f;
      a.ativo = true;
      a.card.classList.remove("ring-2", "ring-marca");
      a.card.style.opacity = "0.35";
      document.body.classList.add("arrastando");
      document.addEventListener("touchmove", prevenirRolagem, { passive: false });
      navigator.vibrate?.(15);
      setArrastando(true);
      moverFantasma(x, y);
      quadroRaf = requestAnimationFrame(rolarNasBordas);
    }

    function aoMover(e: PointerEvent) {
      const a = arraste.current;
      if (!a || e.pointerId !== a.pointerId) return;
      if (!a.ativo) {
        const dist = Math.hypot(e.clientX - a.x0, e.clientY - a.y0);
        if (a.mouse && dist > 6) comecar(e.clientX, e.clientY);
        else if (!a.mouse && dist > 10) limpar(); // o dedo se mexeu antes do tempo: é rolagem, não arraste
        return;
      }
      moverFantasma(e.clientX, e.clientY);
    }

    function aoSoltar(e: PointerEvent) {
      const a = arraste.current;
      if (!a || e.pointerId !== a.pointerId) return;
      if (a.ativo) {
        suprimirClique.current = true;
        setTimeout(() => (suprimirClique.current = false), 80);
        const { id, alvo: destino } = a;
        limpar();
        const n = atual.current.negocios.find((x) => x.id === id);
        if (n && destino) atual.current.pedirMover(n, destino);
      } else limpar();
    }

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && arraste.current?.ativo) limpar();
    }
    function semMenuDeContexto(e: Event) {
      if (arraste.current) e.preventDefault();
    }

    function aoPressionar(e: PointerEvent) {
      const alvoEl = e.target as HTMLElement;
      const card = alvoEl.closest<HTMLElement>("[data-card-negocio]");
      if (!card || !quadroRef.current?.contains(card) || e.button > 0 || alvoEl.closest("[data-sem-arraste]")) return;
      limpar();
      arraste.current = {
        card,
        id: card.dataset.cardNegocio ?? "",
        pointerId: e.pointerId,
        mouse: e.pointerType === "mouse",
        x0: e.clientX,
        y0: e.clientY,
        dx: 0,
        dy: 0,
        x: e.clientX,
        y: e.clientY,
        ativo: false,
        alvo: null,
      };
      if (e.pointerType !== "mouse") {
        // No toque é preciso segurar um instante (assim a rolagem da tela continua funcionando).
        arraste.current.timer = setTimeout(() => {
          card.classList.add("ring-2", "ring-marca");
          comecar(e.clientX, e.clientY);
        }, 320);
      }
    }

    document.addEventListener("pointerdown", aoPressionar);
    document.addEventListener("pointermove", aoMover);
    document.addEventListener("pointerup", aoSoltar);
    document.addEventListener("pointercancel", limpar);
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("contextmenu", semMenuDeContexto);
    return () => {
      limpar();
      document.removeEventListener("pointerdown", aoPressionar);
      document.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerup", aoSoltar);
      document.removeEventListener("pointercancel", limpar);
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("contextmenu", semMenuDeContexto);
    };
  }, []);

  // ---------------- filtros ----------------
  const termo = busca.trim().toLowerCase();
  const parado = (n: CardFunil) => diasDesde(n.ultima_atividade_em ?? n.created_at, agora) >= diasParado;
  const qtdParados = negocios.filter(parado).length;
  const visiveis = negocios.filter(
    (n) =>
      (!soParados || parado(n)) &&
      (!termo || [n.titulo, n.empresaNome, n.contatoNome, ...(n.tags ?? [])].join(" ").toLowerCase().includes(termo)),
  );

  function irParaColuna(etapaId: string) {
    const q = quadroRef.current;
    const col = q?.querySelector<HTMLElement>(`[data-etapa="${etapaId}"]`);
    if (q && col) q.scrollTo({ left: col.offsetLeft - q.offsetLeft - 16, behavior: "smooth" });
  }

  const dialogos = (
    <>
      <DialogoNegocio
        key={novo ? `novo-${novo.etapaId ?? ""}` : "fechado"}
        aberto={novo !== null}
        aoFechar={() => setNovo(null)}
        opcoes={opcoes}
        inicial={{ funilId: etapas[0]?.funil_id, etapaId: novo?.etapaId }}
      />
      <DialogoPerda
        aberto={perda !== null}
        aoFechar={() => setPerda(null)}
        aoPerder={() => router.refresh()}
        negocio={perda}
        motivos={motivos}
      />
    </>
  );

  if (negociosServidor.length === 0) {
    return (
      <>
        <EstadoVazio
          titulo="Nenhum negócio em aberto neste funil"
          descricao="Crie um negócio para acompanhar cada venda, do primeiro contato ao fechamento. Confira também os filtros acima."
          acao={
            <Botao onClick={() => setNovo({})}>
              <Plus className="size-4" aria-hidden /> Novo negócio
            </Botao>
          }
        />
        {dialogos}
      </>
    );
  }

  const totalGeral = visiveis.reduce((s, n) => s + Number(n.valor), 0);
  const ponderadoGeral = visiveis.reduce((s, n) => s + (Number(n.valor) * (etapaPorId.get(n.etapa_id)?.probabilidade ?? 0)) / 100, 0);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1">
          <label htmlFor="busca-funil" className="sr-only">
            Buscar negócio, contato ou empresa
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-2" aria-hidden />
          <input
            id="busca-funil"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar negócio, contato ou empresa"
            autoComplete="off"
            className="block min-h-11 w-full rounded-xl border border-borda bg-superficie py-2 pr-3 pl-10 text-base focus:border-marca focus:ring-2 focus:ring-foco/40 focus:outline-none"
          />
        </div>
        <Chip
          ativo={soParados}
          onClick={() => setSoParados((v) => !v)}
          className={cn(soParados && "border-alerta-forte bg-alerta-suave text-alerta")}
        >
          <Hourglass className="size-4" aria-hidden /> Sem contato há {diasParado}+ dias ({qtdParados})
        </Chip>
      </div>

      <p className="mb-2 text-sm text-texto-2">
        <strong className="num text-texto">{visiveis.length}</strong> em aberto ·{" "}
        <strong className="num text-texto">{moedaInteira(totalGeral)}</strong> no funil · previsão ponderada{" "}
        <strong className="num text-texto">{moedaInteira(ponderadoGeral)}</strong>
      </p>

      <div role="group" aria-label="Ir para a etapa" className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1.5 lg:hidden">
        {etapas.map((e) => (
          <Chip key={e.id} onClick={() => irParaColuna(e.id)} className="min-h-9 text-xs">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: e.cor }} />
            {e.nome} · {visiveis.filter((n) => n.etapa_id === e.id).length}
          </Chip>
        ))}
      </div>

      <div
        ref={quadroRef}
        onClickCapture={(e) => {
          if (suprimirClique.current) {
            e.preventDefault();
            e.stopPropagation();
            suprimirClique.current = false;
          }
        }}
        className="-mx-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col items-start gap-3 overflow-x-auto px-4 pt-1 pb-4 sm:auto-cols-[18.5rem] lg:mx-0 lg:snap-none lg:auto-cols-[minmax(14.5rem,1fr)] lg:px-0 [body.arrastando_&]:snap-none"
      >
        {etapas.map((e) => {
          const lista = visiveis
            .filter((n) => n.etapa_id === e.id)
            .sort((a, b) => (a.proxima?.quando ?? "9999").localeCompare(b.proxima?.quando ?? "9999"));
          const total = lista.reduce((s, n) => s + Number(n.valor), 0);
          return (
            <section
              key={e.id}
              data-etapa={e.id}
              aria-labelledby={`col-${e.id}`}
              className={cn(
                "min-h-48 snap-start rounded-2xl border-2 p-2.5 transition-colors",
                alvo === e.id ? "border-marca bg-marca-suave" : "border-transparent bg-superficie-2",
              )}
            >
              <header className="flex items-center gap-2 px-1 pt-1 pb-1">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: e.cor }} />
                <h2 id={`col-${e.id}`} className="min-w-0 flex-1 truncate text-sm font-bold">
                  {e.nome}
                </h2>
                <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-extrabold text-texto-2" aria-label={`${lista.length} negócios`}>
                  {lista.length}
                </span>
              </header>
              <p className="num px-1 pb-2.5 text-xs font-bold text-texto-2" title={`Probabilidade de fechar: ${e.probabilidade}%`}>
                {moedaCurta(total)} · {e.probabilidade}%
              </p>
              <div className="flex min-h-16 flex-col gap-2.5">
                {lista.length === 0 && (
                  <p className="rounded-xl border-2 border-dashed border-borda px-2.5 py-4 text-center text-sm text-texto-2">
                    Solte um negócio aqui
                  </p>
                )}
                {lista.map((n) => (
                  <CardNegocio
                    key={n.id}
                    n={n}
                    parado={parado(n)}
                    agora={agora}
                    hoje={hoje}
                    vendedor={mostrarVendedor ? vendedores[n.vendedor_id] : undefined}
                    menuAberto={menu?.negocio.id === n.id}
                    aoAbrir={() => router.push(`/negocios/${n.id}`)}
                    aoMenu={(botao) => setMenu(menu?.negocio.id === n.id ? null : { negocio: n, botao })}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setNovo({ etapaId: e.id })}
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl text-sm font-semibold text-texto-2 hover:bg-superficie hover:text-texto"
                >
                  <Plus className="size-4" aria-hidden /> Adicionar
                </button>
              </div>
            </section>
          );
        })}
        <section
          data-etapa={GANHO}
          aria-labelledby="col-fechado"
          className={cn("min-h-48 snap-start rounded-2xl border-2 p-2.5 transition-colors", alvo === GANHO ? "border-ok bg-ok-suave" : "border-transparent bg-ok-suave/60")}
        >
          <header className="flex items-center gap-2 px-1 pt-1 pb-1">
            <Trophy className="size-4 shrink-0 text-ok" aria-hidden />
            <h2 id="col-fechado" className="min-w-0 flex-1 truncate text-sm font-bold">
              Negócio fechado
            </h2>
            <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-extrabold text-texto-2">{fechados.length}</span>
          </header>
          <p className="num px-1 pb-2.5 text-xs font-bold text-texto-2">
            {moedaCurta(fechados.reduce((s, n) => s + Number(n.valor), 0))} · últimos 60 dias
          </p>
          <div className="flex min-h-16 flex-col gap-2.5">
            {fechados.length === 0 && (
              <p className="rounded-xl border-2 border-dashed border-borda px-2.5 py-4 text-center text-sm text-texto-2">Solte aqui para fechar o negócio</p>
            )}
            {fechados.map((n) => (
              <a key={n.id} href={`/negocios/${n.id}`} className="block rounded-xl border border-borda bg-superficie p-3 text-sm hover:border-ok">
                <span className="block font-semibold">{n.titulo}</span>
                <span className="mt-1 flex justify-between gap-2 text-xs text-texto-2">
                  <span className="truncate">{n.contatoNome ?? ""}</span>
                  <span className="num font-bold text-ok">{moedaInteira(n.valor)}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* Áreas de soltar para fechar o negócio (aparecem durante o arraste) */}
      <div
        aria-hidden={!arrastando}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[80] grid grid-cols-2 gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform md:left-64",
          arrastando ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
      >
        <div
          data-etapa={PERDIDO}
          className={cn(
            "flex min-h-20 items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-base font-extrabold shadow-lg",
            alvo === PERDIDO ? "border-perigo bg-perigo text-white dark:text-black" : "border-perigo bg-perigo-suave text-perigo",
          )}
        >
          <ThumbsDown className="size-5" aria-hidden /> Perdido
        </div>
        <div
          data-etapa={GANHO}
          className={cn(
            "flex min-h-20 items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-base font-extrabold shadow-lg",
            alvo === GANHO ? "border-ok bg-ok text-white dark:text-black" : "border-ok bg-ok-suave text-ok",
          )}
        >
          <Trophy className="size-5" aria-hidden /> Ganho
        </div>
      </div>

      <p className="mt-2 flex items-center gap-2 text-sm text-texto-2">
        <Move className="size-4 shrink-0" aria-hidden /> Arraste os cards entre as etapas (no celular: toque, segure e arraste). Solte em
        Ganho ou Perdido para fechar. Ou use o botão de três pontos.
      </p>

      {menu && (
        <MenuMover
          negocio={menu.negocio}
          botao={menu.botao}
          etapas={etapas}
          aoFechar={(devolverFoco) => {
            const b = menu.botao;
            setMenu(null);
            if (devolverFoco) b.focus();
          }}
          aoEscolher={(destino) => {
            const b = menu.botao;
            setMenu(null);
            pedirMover(menu.negocio, destino);
            b.focus({ preventScroll: true });
          }}
        />
      )}

      <Fab onClick={() => setNovo({})}>
        <Plus className="size-6" strokeWidth={2.6} aria-hidden /> Novo negócio
      </Fab>

      {dialogos}
    </>
  );
}

function CardNegocio({
  n,
  parado,
  agora,
  hoje,
  vendedor,
  menuAberto,
  aoAbrir,
  aoMenu,
}: {
  n: CardFunil;
  parado: boolean;
  agora: number;
  hoje: string;
  vendedor?: { nome: string; cor: string };
  menuAberto: boolean;
  aoAbrir: () => void;
  aoMenu: (botao: HTMLButtonElement) => void;
}) {
  const sit = n.proxima ? situacaoAtividade(n.proxima.quando, false, agora) : null;
  return (
    <article
      data-card-negocio={n.id}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button")) aoAbrir();
      }}
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        "card-negocio relative cursor-grab rounded-2xl border bg-superficie py-3 pr-2 pl-3.5 shadow-sm transition-colors hover:border-marca/50",
        parado ? "border-alerta-forte shadow-[inset_4px_0_0_var(--alerta-forte)]" : "border-borda",
      )}
    >
      <div className="-mt-1 mb-0.5 flex items-start gap-1">
        <Link href={`/negocios/${n.id}`} draggable={false} className="min-h-9 flex-1 py-1 leading-snug font-bold break-words hover:text-marca-forte">
          {n.titulo}
        </Link>
        <button
          type="button"
          data-sem-arraste
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          aria-label={`Mover ${n.titulo}`}
          onClick={(e) => aoMenu(e.currentTarget)}
          className="-my-1 grid size-11 shrink-0 place-items-center rounded-xl text-texto-2 hover:bg-superficie-2"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </div>
      <p className="mb-2 flex min-w-0 items-center gap-1.5 text-sm text-texto-2">
        <Building2 className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          {n.empresaNome || n.contatoNome || "Sem cliente"}
          {n.empresaNome && n.contatoNome ? ` · ${primeiroNome(n.contatoNome)}` : ""}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <strong className="num mr-auto">{moedaInteira(n.valor)}</strong>
        {n.tags.slice(0, 2).map((t) => (
          <span key={t} className="rounded-full bg-marca-suave px-2 py-0.5 text-xs font-bold text-marca-forte">
            {t}
          </span>
        ))}
        {vendedor && (
          <span
            title={vendedor.nome}
            aria-label={`Vendedor: ${vendedor.nome}`}
            className="grid size-7 place-items-center rounded-full text-[10px] font-extrabold text-white"
            style={{ background: vendedor.cor }}
          >
            {iniciais(vendedor.nome)}
          </span>
        )}
      </div>
      {(n.proxima || parado) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-borda pt-2.5">
          {n.proxima ? (
            <span
              title={n.proxima.titulo}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap",
                sit === "atrasada" ? "bg-perigo-suave text-perigo" : sit === "hoje" ? "bg-destaque-suave text-destaque-forte" : "bg-superficie-2 text-texto-2",
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden /> {rotuloQuando(n.proxima.quando, hoje)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-perigo-suave px-2 py-0.5 text-xs font-bold text-perigo">
              <CalendarClock className="size-3.5" aria-hidden /> Sem próxima atividade
            </span>
          )}
          {parado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-alerta-suave px-2 py-0.5 text-xs font-bold whitespace-nowrap text-alerta">
              <Hourglass className="size-3.5" aria-hidden /> {diasDesde(n.ultima_atividade_em ?? n.created_at, agora)} dias sem contato
            </span>
          )}
        </div>
      )}
    </article>
  );
}

/** Menu "Mover para…" acessível (setas ↑ ↓, Home/End, Enter, Esc). */
function MenuMover({
  negocio,
  botao,
  etapas,
  aoFechar,
  aoEscolher,
}: {
  negocio: CardFunil;
  botao: HTMLButtonElement;
  etapas: Etapa[];
  aoFechar: (devolverFoco: boolean) => void;
  aoEscolher: (destino: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opcoes = etapas.filter((e) => e.id !== negocio.etapa_id);
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = botao.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
    el.style.top = `${r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
    el.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [botao]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fora = (e: PointerEvent) => {
      if (!el.contains(e.target as Node) && !botao.contains(e.target as Node)) fechar.current(false);
    };
    const redimensionar = () => fechar.current(false);
    document.addEventListener("pointerdown", fora);
    window.addEventListener("resize", redimensionar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("resize", redimensionar);
    };
  }, [botao]);

  function teclas(e: React.KeyboardEvent) {
    const itens = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itens[(i + 1) % itens.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itens[(i - 1 + itens.length) % itens.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itens[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itens[itens.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      aoFechar(true);
    }
  }

  const item =
    "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left font-semibold hover:bg-marca-suave focus:bg-marca-suave focus:outline-none focus-visible:ring-2 focus-visible:ring-foco";

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Mover ${negocio.titulo} para`}
      onKeyDown={teclas}
      style={{ left: -9999, top: 0 }}
      className="fixed z-50 min-w-56 rounded-2xl border border-borda bg-superficie p-1.5 shadow-xl"
    >
      <p aria-hidden className="px-2.5 pt-2 pb-1 text-xs font-extrabold tracking-wider text-texto-2 uppercase">
        Mover para…
      </p>
      {opcoes.map((e) => (
        <button key={e.id} type="button" role="menuitem" tabIndex={-1} onClick={() => aoEscolher(e.id)} className={item}>
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: e.cor }} />
          {e.nome}
        </button>
      ))}
      <div className="my-1 border-t border-borda" />
      <button type="button" role="menuitem" tabIndex={-1} onClick={() => aoEscolher(GANHO)} className={cn(item, "text-ok")}>
        <Trophy className="size-4" aria-hidden /> Ganho
      </button>
      <button type="button" role="menuitem" tabIndex={-1} onClick={() => aoEscolher(PERDIDO)} className={cn(item, "text-perigo")}>
        <ThumbsDown className="size-4" aria-hidden /> Perdido
      </button>
    </div>
  );
}
