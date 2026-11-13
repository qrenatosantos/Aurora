import Link from "next/link";
import { PowerOff } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";

/** Tela de um módulo opcional que está desligado em Configurações ▸ Módulos e dados. */
export function ModuloDesligado({ nome, gestor }: { nome: string; gestor: boolean }) {
  return (
    <EstadoVazio
      icone={PowerOff}
      titulo={`${nome}: módulo desligado`}
      descricao={
        gestor
          ? "A Aurora não usa esta parte hoje. Se precisar dela, ligue em Configurações ▸ Módulos e dados. Nada foi apagado."
          : "Esta parte do sistema não está em uso. Se precisar dela, fale com o gestor."
      }
      acao={
        gestor ? (
          <Link href="/configuracoes/modulos" className={classesBotao("secundario")}>
            Abrir Módulos e dados
          </Link>
        ) : undefined
      }
    />
  );
}
