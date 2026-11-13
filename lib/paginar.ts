/**
 * Busca TODAS as linhas de uma consulta, de 1000 em 1000.
 * O Supabase devolve no máximo 1000 linhas por consulta (Settings ▸ API ▸ Max rows):
 * sem isto, listas grandes (ex.: corrida com 1.500 inscritos) viriam cortadas.
 *
 *   const linhas = await todasAsLinhas((de, ate) =>
 *     supabase.from("inscricoes").select("id, nome").eq("evento_id", id).order("created_at").order("id").range(de, ate));
 *
 * Use sempre um .order() estável (de preferência terminando em "id").
 */
import "server-only";

const PAGINA = 1000;
const LIMITE = 50_000; // trava de segurança

export async function todasAsLinhas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; de < LIMITE; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) {
      console.error("[todasAsLinhas]", error.message);
      break;
    }
    tudo.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return tudo;
}
