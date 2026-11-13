/** Ícone de cada tipo de atividade. Sem "use client": serve em Server e Client Components. */
import { CheckSquare, Mail, MapPin, MessageCircle, Phone, Users, type LucideIcon } from "lucide-react";
import type { TipoAtividade } from "@/lib/tipos";

const ICONES: Record<TipoAtividade, LucideIcon> = {
  tarefa: CheckSquare,
  ligacao: Phone,
  reuniao: Users,
  whatsapp: MessageCircle,
  email: Mail,
  visita: MapPin,
};

export function IconeAtividade({ tipo, className = "size-4" }: { tipo: TipoAtividade; className?: string }) {
  const Icone = ICONES[tipo] ?? CheckSquare;
  return <Icone className={className} aria-hidden />;
}
