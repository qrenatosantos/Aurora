/**
 * MENU DO APP — sidebar (computador) e barra inferior (celular) são geradas daqui.
 *
 * Para adicionar uma página ao menu:
 *   1. crie app/(app)/minha-pagina/page.tsx
 *   2. adicione um item abaixo (ícones: https://lucide.dev/icons — importe de "lucide-react")
 *
 * No celular aparecem no máximo 4 itens com `celular: true`; o restante vai para o botão "Mais".
 * `gestor: true` = só aparece para o gestor (a regra de verdade fica no banco, RLS).
 * `modulo` = só aparece com o módulo ligado em Configurações ▸ Módulos (nada é apagado ao desligar).
 */
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  GlassWater,
  Handshake,
  History,
  Home,
  KanbanSquare,
  ListChecks,
  Palette,
  Percent,
  PlugZap,
  Settings,
  Target,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/** Módulos da base que podem ser ligados/desligados em Configurações. */
export type Modulos = { empresas: boolean; funis: boolean; metas: boolean; comissoes: boolean };
export const MODULOS_PADRAO: Modulos = { empresas: false, funis: false, metas: false, comissoes: false };

export type ItemNavegacao = {
  titulo: string;
  href: string;
  icone: LucideIcon;
  /** Mostrar direto na barra inferior do celular (máx. 4). Padrão: false. */
  celular?: boolean;
  /** Só para o gestor (administrador). */
  gestor?: boolean;
  /** Só aparece com este módulo ligado. */
  modulo?: keyof Modulos;
  /** Separador visual antes do item (sidebar). */
  grupo?: string;
};

export const NAVEGACAO: ItemNavegacao[] = [
  { titulo: "Início", href: "/", icone: Home, celular: true },
  { titulo: "Funil", href: "/funil", icone: KanbanSquare, celular: true },
  { titulo: "Agenda de eventos", href: "/eventos", icone: CalendarDays, celular: true },
  { titulo: "Propostas", href: "/propostas", icone: FileText, celular: true },
  { titulo: "Tarefas", href: "/agenda", icone: ListChecks },
  { titulo: "Contatos", href: "/contatos", icone: Users },
  { titulo: "Empresas", href: "/empresas", icone: Building2, modulo: "empresas" },
  { titulo: "Negócios", href: "/negocios", icone: Handshake },
  { titulo: "Catálogo", href: "/catalogo", icone: GlassWater, grupo: "Cardápio e preços" },
  { titulo: "Relatórios", href: "/relatorios", icone: BarChart3, grupo: "Resultados" },
  { titulo: "Metas", href: "/metas", icone: Target, modulo: "metas" },
  { titulo: "Comissões", href: "/comissoes", icone: Percent, modulo: "comissoes" },
  { titulo: "Equipe", href: "/equipe", icone: UsersRound, gestor: true, grupo: "Administração" },
  { titulo: "Configurações", href: "/configuracoes", icone: Settings, gestor: true },
  { titulo: "Integrações", href: "/integracoes", icone: PlugZap, gestor: true },
  { titulo: "Personalização", href: "/personalizacao", icone: Palette, gestor: true },
  { titulo: "Auditoria", href: "/auditoria", icone: History, gestor: true },
];

/** Itens que o usuário pode ver. */
export function menuPara(gestor: boolean, modulos: Modulos = MODULOS_PADRAO) {
  return NAVEGACAO.filter((i) => (gestor || !i.gestor) && (!i.modulo || modulos[i.modulo]));
}

/**
 * Nome do produto e descrição PADRÃO. Aparecem enquanto o dono não preencher
 * "Nome exibido" e "Subtítulo" na tela Personalização (e quando o banco está fora).
 */
export const NOME_APP = "Aurora Bartenders";
export const DESCRICAO_APP = "Gestão comercial: leads, agenda de eventos e propostas";

/** Item ativo: "/" só quando exato; demais por prefixo. */
export function itemAtivo(caminho: string, href: string) {
  if (href === "/") return caminho === "/";
  return caminho === href || caminho.startsWith(href + "/");
}
