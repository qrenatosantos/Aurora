/** Documento OpenAPI 3.1 da API do agente, gerado da tabela de rotas (lib/api/rotas-agente.ts). */
import { ROTAS_AGENTE } from "@/lib/api/rotas-agente";

export function documentoOpenApi(servidor: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of ROTAS_AGENTE) {
    const caminho = r.caminho.replace(/:(\w+)/g, "{$1}");
    const campos = Object.entries(r.campos ?? {});
    const comCorpo = r.metodo !== "GET";
    const parametros = [
      ...(r.caminho.includes(":id") ? [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }] : []),
      ...(!comCorpo ? campos.map(([nome, descricao]) => ({ name: nome, in: "query", required: false, description: descricao || undefined, schema: { type: "string" } })) : []),
    ];
    paths[caminho] = {
      ...(paths[caminho] ?? {}),
      [r.metodo.toLowerCase()]: {
        operationId: r.acao.replace(/\./g, "_"),
        summary: r.resumo,
        description: r.escopo ? `Permissão exigida: \`${r.escopo}\`.` : "Qualquer chave válida.",
        ...(parametros.length ? { parameters: parametros } : {}),
        ...(comCorpo && campos.length
          ? {
              requestBody: {
                required: false,
                content: {
                  "application/json": {
                    schema: { type: "object", properties: Object.fromEntries(campos.map(([nome, descricao]) => [nome, { description: descricao || undefined }])) },
                  },
                },
              },
            }
          : {}),
        responses: {
          "200": { description: "Certo. O resultado vem em `dados`.", content: { "application/json": { schema: { type: "object", properties: { dados: {} } } } } },
          "201": { description: "Criado. O resultado vem em `dados`." },
          "400": { $ref: "#/components/responses/Erro" },
          "401": { $ref: "#/components/responses/Erro" },
          "403": { $ref: "#/components/responses/Erro" },
          "404": { $ref: "#/components/responses/Erro" },
          "409": { $ref: "#/components/responses/Erro" },
          "422": { $ref: "#/components/responses/Erro" },
          "429": { $ref: "#/components/responses/Erro" },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Aurora Bartenders — API do agente",
      version: "1.0.0",
      description:
        "API para o agente SDR ler e gravar contatos, negócios, dados do evento, agenda, catálogo, propostas e conversa. " +
        "Toda proposta precisa da aprovação do gestor antes de ser enviada ao cliente. Preços, disponibilidade e condições vêm sempre do que está cadastrado e aprovado no sistema.",
    },
    servers: [{ url: `${servidor}/api/v1` }],
    security: [{ chave: [] }],
    paths,
    components: {
      securitySchemes: { chave: { type: "http", scheme: "bearer", description: "Chave criada em Integrações (começa com aur_)." } },
      responses: {
        Erro: {
          description: "Erro. `erro.codigo` é fixo (bom para o programa); `erro.mensagem` explica em português.",
          content: {
            "application/json": {
              schema: { type: "object", properties: { erro: { type: "object", properties: { codigo: { type: "string" }, mensagem: { type: "string" } } } } },
            },
          },
        },
      },
    },
  };
}
