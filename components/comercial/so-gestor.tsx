import { Lock } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";

/** Aviso para telas que só o gestor acessa (a regra de verdade está no banco). */
export function SoGestor({ titulo = "Área do gestor" }: { titulo?: string }) {
  return (
    <EstadoVazio
      icone={Lock}
      titulo={titulo}
      descricao="Só o gestor (administrador) acessa esta tela. Se precisar mudar algo aqui, fale com ele."
    />
  );
}
