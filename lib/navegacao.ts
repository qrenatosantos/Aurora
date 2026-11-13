/**
 * MENU DO APP — sidebar (computador) e barra inferior (celular) são geradas daqui.
 *
 * Para adicionar uma página ao menu:
 *   1. crie app/(app)/minha-pagina/page.tsx
 *   2. adicione um item abaixo (ícones: https://lucide.dev/icons — importe de "lucide-react")
 *
 * No celular aparecem no máximo 4 itens com `celular: true`; o restante vai para o botão "Mais".
 * `gestor: true` = só aparece para o gestor (a regra de verdade fica no banco, RLS).
 */
import {
  BarChart3,
  Building2,
  CalendarCheck,
  FileText,
  Handshake,
  History,
  Home,
  KanbanSquare,
  Package,
  Palette,
  Percent,
  Settings,
  Target,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type ItemNavegacao = {
  titulo: string;
  href: string;
  icone: LucideIcon;
  /** Mostrar direto na barra inferior do celular (máx. 4). Padrão: false. */
  celular?: boolean;
  /** Só para o gestor (administrador). */
  gestor?: boolean;
  /** Separador visual antes do item (sidebar). */
  grupo?: string;
};

export const NAVEGACAO: ItemNavegacao[] = [
  { titulo: "Início", href: "/", icone: Home, celular: true },
  { titulo: "Funil", href: "/funil", icone: KanbanSquare, celular: true },
  { titulo: "Agenda", href: "/agenda", icone: CalendarCheck, celular: true },
  { titulo: "Contatos", href: "/contatos", icone: Users, celular: true },
  { titulo: "Empresas", href: "/empresas", icone: Building2 },
  { titulo: "Negócios", href: "/negocios", icone: Handshake },
  { titulo: "Propostas", href: "/propostas", icone: FileText },
  { titulo: "Produtos", href: "/produtos", icone: Package },
  { titulo: "Metas", href: "/metas", icone: Target, grupo: "Resultados" },
  { titulo: "Comissões", href: "/comissoes", icone: Percent },
  { titulo: "Relatórios", href: "/relatorios", icone: BarChart3 },
  { titulo: "Equipe", href: "/equipe", icone: UsersRound, gestor: true, grupo: "Administração" },
  { titulo: "Configurações", href: "/configuracoes", icone: Settings, gestor: true },
  { titulo: "Personalização", href: "/personalizacao", icone: Palette, gestor: true },
  { titulo: "Auditoria", href: "/auditoria", icone: History, gestor: true },
];

/** Itens que o usuário pode ver. */
export function menuPara(gestor: boolean) {
  return NAVEGACAO.filter((i) => gestor || !i.gestor);
}

/**
 * Nome do produto e descrição PADRÃO. Aparecem enquanto o dono não preencher
 * "Nome exibido" e "Subtítulo" na tela Personalização (e quando o banco está fora).
 */
export const NOME_APP = "Gestão Comercial";
export const DESCRICAO_APP = "CRM e vendas: funil, propostas, metas e comissões";

/** Item ativo: "/" só quando exato; demais por prefixo. */
export function itemAtivo(caminho: string, href: string) {
  if (href === "/") return caminho === "/";
  return caminho === href || caminho.startsWith(href + "/");
}
