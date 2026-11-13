/**
 * TESTES DAS REGRAS DO BANCO — rodam num Postgres embutido (PGlite), sem Supabase.
 *
 *   npm run test:banco
 *
 * Carrega supabase/schema.sql e supabase/dados-iniciais.sql DUAS vezes (prova de que
 * podem rodar de novo sem estragar nada) e depois exercita as regras como cada "papel"
 * faria: visitante do site (anon), usuário logado (authenticated) e o agente (API).
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const pasta = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (nome) => readFileSync(join(pasta, nome), "utf8");

const ANDRE = "11111111-1111-4111-8111-111111111111"; // 1º login = gestor
const BRUNA = "22222222-2222-4222-8222-222222222222"; // 2º login = vendedora (não gestora)

const db = new PGlite({ extensions: { pgcrypto } });

/** Executa como um papel do Supabase. Erro = desfaz tudo e propaga. */
async function como(papel, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    if (papel) await tx.exec(`set local role ${papel}`);
    return fn(tx);
  });
}
const gestor = (fn) => como("authenticated", ANDRE, fn);
const vendedora = (fn) => como("authenticated", BRUNA, fn);
const visitante = (fn) => como("anon", null, fn);
const banco = (fn) => como(null, null, fn); // dono do banco (como uma função interna)

const um = async (tx, sql, params = []) => (await tx.query(sql, params)).rows[0];
const valor = async (tx, sql, params = []) => Object.values((await um(tx, sql, params)) ?? {})[0];

/** Chamada da API do agente. */
async function api(chave, acao, dados = {}, meta = { base_url: "https://app.exemplo.com.br/", ip: "203.0.113.9" }) {
  return visitante((tx) =>
    valor(tx, "select public.api_agente($1, $2, $3::jsonb, $4::jsonb)", [chave, acao, JSON.stringify(dados), JSON.stringify(meta)]),
  );
}

const amanha = (dias = 30) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);

before(async () => {
  await db.exec(`
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated; create role service_role;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    -- imitação do pg_net: guarda os envios numa tabela para os testes conferirem
    create schema net;
    create table net.envios(id bigserial primary key, url text, body jsonb, headers jsonb);
    create table net._http_response(id bigint primary key, status_code int, error_msg text, timed_out boolean);
    create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int) returns bigint
      language sql as $$ insert into net.envios(url, body, headers) values (url, body, headers) returning id $$;
    insert into auth.users values ('${ANDRE}', 'andre@aurora.test'), ('${BRUNA}', 'bruna@aurora.test');
  `);
  for (let i = 0; i < 2; i++) {
    await db.exec(ler("schema.sql"));
    await db.exec(ler("dados-iniciais.sql"));
  }
  // 1º login vira gestor; 2º vira vendedor
  await gestor((tx) => tx.query("select public.meu_perfil()"));
  await vendedora((tx) => tx.query("select public.meu_perfil()"));
});

describe("base", () => {
  test("schema e dados iniciais rodam 2 vezes e criam a Aurora", async () => {
    await banco(async (tx) => {
      assert.equal(await valor(tx, "select nome_negocio from configuracoes"), "Aurora Bartenders");
      assert.equal(await valor(tx, "select count(*)::int from pacotes"), 4);
      assert.equal(await valor(tx, "select count(*)::int from etapas"), 6);
      assert.equal(await valor(tx, "select count(*)::int from vendedores where tipo = 'agente'"), 1);
      assert.equal(await valor(tx, "select capacidade_simultanea from configuracoes"), 3);
    });
  });

  test("1º usuário é gestor, 2º não; o agente nunca é gestor", async () => {
    assert.equal(await gestor((tx) => valor(tx, "select public.sou_gestor()")), true);
    assert.equal(await vendedora((tx) => valor(tx, "select public.sou_gestor()")), false);
    await assert.rejects(banco((tx) => tx.query("update vendedores set papel = 'gestor' where tipo = 'agente'")), /vendedores_agente_ck/);
  });

  test("visitante não lê nenhuma tabela", async () => {
    for (const t of ["contatos", "negocios", "propostas", "eventos", "mensagens", "chaves_api", "configuracoes", "calculadora"]) {
      await assert.rejects(visitante((tx) => tx.query(`select * from ${t} limit 1`)), /permission denied/, t);
    }
  });

  test("funções internas (esquema privado) são inacessíveis para visitante e para usuário logado", async () => {
    await assert.rejects(visitante((tx) => tx.query("select privado.gestor_padrao()")), /permission denied/);
    await assert.rejects(gestor((tx) => tx.query("select privado.agente_executar('ping', '{}')")), /permission denied/);
  });
});

describe("entrada de leads pelo site", () => {
  let codigo;
  test("pedido do site vira contato + negócio em Novo lead + evento, com origem Site", async () => {
    const r = await visitante((tx) =>
      valor(tx, "select public.receber_lead_site($1::jsonb, $2)", [
        JSON.stringify({
          nome: "Ana  Paula", whatsapp: "(34) 99911-2233", tipo: "Casamento", data: amanha(60), cidadeop: "Araxá",
          convidados: "101 a 150", pacote: "Signature", drinks: ["opções sem álcool"], obs: "Festa ao ar livre",
        }),
        "198.51.100.7",
      ]),
    );
    assert.equal(r.ok, true);
    assert.match(r.codigo, /^A[2-9A-Z]{5}$/);
    codigo = r.codigo;
    await banco(async (tx) => {
      const n = await um(tx, `select n.*, e.nome as etapa, o.nome as origem, c.nome as contato, c.telefone
                                from negocios n join etapas e on e.id = n.etapa_id join origens o on o.id = n.origem_id
                                join contatos c on c.id = n.contato_id where n.codigo = $1`, [codigo]);
      assert.equal(n.etapa, "Novo lead");
      assert.equal(n.origem, "Site");
      assert.equal(n.contato, "Ana Paula");
      assert.equal(n.telefone, "34999112233");
      assert.equal(n.atendimento, "humano");
      assert.equal(n.titulo, "Casamento · Ana Paula");
      const ev = await um(tx, "select e.*, p.nome as pacote from eventos e left join pacotes p on p.id = e.pacote_id where e.negocio_id = $1", [n.id]);
      assert.equal(ev.tipo, "casamento");
      assert.equal(ev.cidade, "Araxá");
      assert.equal(ev.convidados_faixa, "101 a 150");
      assert.equal(ev.pacote, "Signature");
      assert.deepEqual(ev.preferencias, ["opções sem álcool"]);
      assert.equal(ev.situacao_data, "consulta");
      assert.equal(await valor(tx, "select count(*)::int from eventos_saida where tipo = 'lead.criado' and negocio_id = $1", [n.id]), 1);
      assert.equal(await valor(tx, "select ator_tipo from auditoria where tabela = 'negocios' and negocio_id = $1 and acao = 'criou'", [n.id]), "site");
    });
  });

  test("mesmo telefone em 24h atualiza o pedido em vez de duplicar; sem data usa o mês previsto", async () => {
    const r = await visitante((tx) =>
      valor(tx, "select public.receber_lead_site($1::jsonb, $2)", [
        JSON.stringify({ nome: "Ana Paula", whatsapp: "34999112233", tipo: "Casamento", mes: "mar/2028", pacote: "ajuda para escolher" }),
        "198.51.100.8",
      ]),
    );
    assert.equal(r.codigo, codigo);
    await banco(async (tx) => {
      assert.equal(await valor(tx, "select count(*)::int from negocios where codigo = $1", [codigo]), 1);
      assert.equal(await valor(tx, "select quer_ajuda_pacote from eventos e join negocios n on n.id = e.negocio_id where n.codigo = $1", [codigo]), true);
    });
  });

  test("pedido sem telefone: a referência do site vira o código do pedido e não duplica", async () => {
    const pedido = { nome: "Clara", tipo: "15 anos", semdata: "on", mes: "jun/2028", convidados: "51 a 100", ref: "xk4a" };
    const antes = await banco((tx) => valor(tx, "select count(*)::int from negocios"));
    const r1 = await visitante((tx) => valor(tx, "select public.receber_lead_site($1::jsonb, $2)", [JSON.stringify(pedido), "198.51.100.7"]));
    assert.deepEqual(r1, { ok: true, codigo: "XK4A" });
    // toque duplo / voltar e reenviar: mesmo pedido, agora com a cidade
    const r2 = await visitante((tx) =>
      valor(tx, "select public.receber_lead_site($1::jsonb, $2)", [JSON.stringify({ ...pedido, cidade: "Uberaba" }), "198.51.100.7"]));
    assert.deepEqual(r2, { ok: true, codigo: "XK4A" });
    await banco(async (tx) => {
      assert.equal(await valor(tx, "select count(*)::int from negocios"), antes + 1);
      const n = await um(tx, "select n.*, c.telefone from negocios n join contatos c on c.id = n.contato_id where n.codigo = 'XK4A'");
      assert.equal(n.telefone, null);
      assert.equal(n.titulo, "15 anos · Clara");
      assert.equal(await valor(tx, "select cidade from eventos where negocio_id = $1", [n.id]), "Uberaba");
      assert.equal(await valor(tx, "select status from leads_recebidos where negocio_id = $1 order by created_at desc limit 1", [n.id]), "duplicado");
    });
    // referência já usada por um pedido antigo, ou fora do formato: o banco gera outro código
    await banco((tx) => tx.query("update negocios set created_at = now() - interval '3 days' where codigo = 'XK4A'"));
    const r3 = await visitante((tx) =>
      valor(tx, "select public.receber_lead_site($1::jsonb, $2)", [JSON.stringify({ nome: "Outra pessoa", ref: "XK4A" }), "198.51.100.8"]));
    assert.equal(r3.ok, true);
    assert.match(r3.codigo, /^A[2-9A-Z]{5}$/);
    const r4 = await visitante((tx) =>
      valor(tx, "select public.receber_lead_site($1::jsonb, $2)", [JSON.stringify({ nome: "Mais uma", ref: "'; drop table x; --" }), "198.51.100.9"]));
    assert.match(r4.codigo, /^A[2-9A-Z]{5}$/);
  });

  test("robô (campo-armadilha), nome vazio e excesso de pedidos são barrados", async () => {
    const antes = await banco((tx) => valor(tx, "select count(*)::int from negocios"));
    const robo = await visitante((tx) => valor(tx, "select public.receber_lead_site($1::jsonb)", [JSON.stringify({ nome: "Bot", site_web: "http://x" })]));
    assert.equal(robo.ok, true); // responde "ok" para não ensinar o robô, mas não cria nada
    const semNome = await visitante((tx) => valor(tx, "select public.receber_lead_site($1::jsonb)", [JSON.stringify({ nome: " " })]));
    assert.equal(semNome.ok, false);
    let ultimo;
    for (let i = 0; i < 7; i++) {
      ultimo = await visitante((tx) =>
        valor(tx, "select public.receber_lead_site($1::jsonb, $2)", [JSON.stringify({ nome: `Pessoa ${i}`, tipo: "Aniversário" }), "192.0.2.50"]));
    }
    assert.equal(ultimo.ok, false);
    assert.match(ultimo.mensagem, /Muitos pedidos/);
    assert.equal(await banco((tx) => valor(tx, "select count(*)::int from negocios")), antes + 5);
  });
});

describe("agenda de eventos", () => {
  const dia = amanha(90);
  test("capacidade de 3 no mesmo horário, horários que não batem e bloqueio", async () => {
    await gestor(async (tx) => {
      const funil = await um(tx, "select f.id as funil, (select id from etapas where funil_id = f.id order by ordem limit 1) as etapa from funis f limit 1");
      const eu = await valor(tx, "select public.meu_vendedor_id()");
      const livre = await valor(tx, "select public.disponibilidade_data($1::date, '19:00')", [dia]);
      assert.equal(livre.situacao, "livre");
      assert.equal(livre.capacidade, 3);
      for (let i = 0; i < 3; i++) {
        const id = await valor(tx, "insert into negocios (titulo, funil_id, etapa_id, vendedor_id, valor) values ($1, $2, $3, $4, 1000) returning id",
          [`Festa ${i}`, funil.funil, funil.etapa, eu]);
        await tx.query("insert into eventos (negocio_id, data, hora_inicio, duracao_horas, situacao_data) values ($1, $2, '20:00', 4, $3)",
          [id, dia, i === 0 ? "reservada" : "confirmada"]);
      }
      const noite = await valor(tx, "select public.disponibilidade_data($1::date, '21:00', 4)", [dia]);
      assert.equal(noite.situacao, "lotada");
      assert.equal(noite.confirmados, 2);
      assert.equal(noite.reservados, 1);
      assert.equal(noite.vagas, 0);
      // almoço do mesmo dia não bate com as festas da noite
      const almoco = await valor(tx, "select public.disponibilidade_data($1::date, '11:00', 4)", [dia]);
      assert.equal(almoco.situacao, "livre");
      assert.equal(almoco.eventos_no_dia.length, 3);
      // sem horário informado, considera o dia todo
      assert.equal((await valor(tx, "select public.disponibilidade_data($1::date)", [dia])).situacao, "lotada");
      // festa que começa 23h do dia anterior e vai até 3h não bate com 20h, mas bate com 01h
      const vespera = new Date(new Date(dia).getTime() - 864e5).toISOString().slice(0, 10);
      assert.equal((await valor(tx, "select public.disponibilidade_data($1::date, '23:30', 4)", [vespera])).situacao, "livre");
      await tx.query("insert into bloqueios_agenda (inicio, fim, motivo) values ($1, $1, 'Folga da equipe')", [vespera]);
      const bloq = await valor(tx, "select public.disponibilidade_data($1::date)", [vespera]);
      assert.equal(bloq.situacao, "bloqueada");
      assert.equal(bloq.motivo_bloqueio, "Folga da equipe");
    });
  });

  test("reserva vencida deixa de ocupar a data", async () => {
    await banco((tx) => tx.query("update eventos set reservada_ate = public.hoje_br() - 1 where data = $1 and situacao_data = 'reservada'", [dia]));
    const d = await gestor((tx) => valor(tx, "select public.disponibilidade_data($1::date, '20:00')", [dia]));
    assert.equal(d.situacao, "parcial");
    assert.equal(d.vagas, 1);
  });
});

describe("calculadora de insumos e preço", () => {
  test("lista o que falta; com tudo preenchido calcula; aprovação cai quando algo muda", async () => {
    const pend = await gestor((tx) => valor(tx, "select public.calculadora_pendencias()"));
    assert.ok(pend.some((p) => p.includes("Insumos sem preço")));
    await assert.rejects(gestor((tx) => tx.query("select public.aprovar_calculadora()")), /Ainda falta/);

    await gestor(async (tx) => {
      // números redondos SÓ para o teste (não são preços reais da Aurora)
      await tx.query("update insumos set preco_tradicional = 10");
      await tx.query("update insumos set preco_tradicional = 40, preco_premium = 100, marca_premium = 'Marca premium' where nome in ('Vodka', 'Gin')");
      await tx.query(`update calculadora set drinks_por_convidado_hora = 1, convidados_por_bartender = 50, custo_bartender_hora = 30,
                        horas_montagem = 1, custo_fixo = 100, taxa_outra_cidade = 200, perdas_pct = 0, margem_pct = 100,
                        arredondar_para = 50, preco_minimo = 0`);
    });
    const essencial = await banco((tx) => valor(tx, "select id from pacotes where nome = 'Essencial'"));
    const c = await gestor((tx) => valor(tx, "select public.calcular_preco($1::jsonb)", [JSON.stringify({ pacote_id: essencial, convidados: 60, duracao_horas: 4 })]));
    assert.equal(c.ok, true);
    assert.equal(c.total_drinks, 240); // 60 convidados × 4 h × 1 drink
    assert.equal(c.drinks.length, 3);
    assert.equal(c.bartenders, 2); // 60 ÷ 50 → 2
    const vodka = c.insumos.find((i) => i.nome === "Vodka");
    assert.equal(Number(vodka.quantidade), 4000); // 80 caipiroskas × 50 ml
    assert.equal(Number(vodka.embalagens), 4);
    assert.equal(Number(vodka.custo), 160);
    assert.equal(Number(c.custos.mao_de_obra), 300); // 2 × (4 + 1) h × R$ 30
    const custoInsumos = c.insumos.reduce((s, i) => s + Number(i.custo), 0);
    assert.equal(Number(c.custos.insumos), custoInsumos);
    assert.equal(Number(c.custos.total), custoInsumos + 300 + 100);
    assert.equal(Number(c.preco_sugerido) % 50, 0);
    assert.ok(Number(c.preco_sugerido) >= Number(c.custos.total) * 2);

    // linha premium troca só os insumos que têm versão premium
    const p = await gestor((tx) => valor(tx, "select public.calcular_preco($1::jsonb)",
      [JSON.stringify({ pacote_id: essencial, convidados: 60, duracao_horas: 4, linha: "premium", outra_cidade: true })]));
    assert.equal(p.insumos.find((i) => i.nome === "Vodka").linha, "premium");
    assert.equal(p.insumos.find((i) => i.nome === "Cachaça").linha, "tradicional");
    assert.equal(Number(p.custos.outra_cidade), 200);
    assert.ok(Number(p.preco_sugerido) > Number(c.preco_sugerido));

    // Aurora Boreal (autoral) continua sem receita: completa e aprova
    await gestor(async (tx) => {
      await tx.query(`insert into drink_insumos (drink_id, insumo_id, quantidade)
                      select d.id, i.id, 100 from drinks d, insumos i where d.nome = 'Aurora Boreal' and i.nome = 'Água com gás'`);
      await tx.query("select public.aprovar_calculadora()");
    });
    assert.equal(await banco((tx) => valor(tx, "select aprovada from calculadora")), true);
    await vendedora(async (tx) => {
      await assert.rejects(tx.query("select public.aprovar_calculadora()"), /Só o gestor/);
    }).catch(() => {});
    // mudar só a marca não desfaz; mudar o preço desfaz
    await gestor((tx) => tx.query("update insumos set marca_tradicional = 'Qualquer' where nome = 'Gin'"));
    assert.equal(await banco((tx) => valor(tx, "select aprovada from calculadora")), true);
    await gestor((tx) => tx.query("update insumos set preco_tradicional = 45 where nome = 'Gin'"));
    assert.equal(await banco((tx) => valor(tx, "select aprovada from calculadora")), false);
    // pelo app não dá para "aprovar na mão"
    await gestor((tx) => tx.query("update calculadora set aprovada = true"));
    assert.equal(await banco((tx) => valor(tx, "select aprovada from calculadora")), false);
    await gestor((tx) => tx.query("select public.aprovar_calculadora()"));
  });
});

describe("proposta: aprovação obrigatória antes do envio", () => {
  let negocio, proposta, codigoPublico;
  const dia = amanha(120);

  test("vendedora monta, não consegue aprovar nem enviar; gestor pede ajustes, aprova; conteúdo aprovado trava", async () => {
    // negócio da vendedora, com evento completo → a proposta já nasce com preço da calculadora
    await vendedora(async (tx) => {
      const funil = await um(tx, "select f.id as funil, (select id from etapas where funil_id = f.id order by ordem limit 1) as etapa from funis f limit 1");
      const eu = await valor(tx, "select public.meu_vendedor_id()");
      const contato = await valor(tx, "insert into contatos (nome, telefone, responsavel_id) values ('Vitória Lima', '34988001122', $1) returning id", [eu]);
      negocio = await valor(tx, "insert into negocios (titulo, funil_id, etapa_id, vendedor_id, contato_id) values ('Aniversário · Vitória', $1, $2, $3, $4) returning id",
        [funil.funil, funil.etapa, eu, contato]);
      await tx.query(`insert into eventos (negocio_id, tipo, nome, data, hora_inicio, duracao_horas, cidade, local, convidados, pacote_id)
                      values ($1, 'aniversario', '1 ano do José Miguel', $2, '16:00', 4, 'Araxá', 'Espaço Festa Mágica', 85,
                              (select id from pacotes where nome = 'Signature'))`, [negocio, dia]);
      proposta = await valor(tx, "select public.criar_proposta($1)", [negocio]);
    });
    await banco(async (tx) => {
      const p = await um(tx, "select * from propostas where id = $1", [proposta]);
      assert.equal(p.status, "rascunho");
      assert.equal(p.origem, "humano");
      assert.match(p.numero, /^PROP-\d{4}-\d{4}$/);
      assert.equal(p.cardapio.length, 4);
      assert.equal(p.evento.convidados, 85);
      assert.equal(p.evento.local, "Espaço Festa Mágica");
      assert.equal(p.pacote_nome, "Signature");
      assert.ok(Number(p.total) > 0);
      assert.equal(p.preco_pendente, false);
      assert.equal(p.descricao_servico, "4 horas de atendimento com as 4 opções do cardápio, preparo na hora e gestão dos insumos.");
      assert.equal(p.entrada_pct, null); // condições comerciais só entram depois que o gestor confirmar
    });

    // link público ainda não existe
    codigoPublico = await banco((tx) => valor(tx, "select codigo from propostas where id = $1", [proposta]));
    assert.equal(await visitante((tx) => valor(tx, "select public.proposta_publica($1)", [codigoPublico])), null);

    await assert.rejects(vendedora((tx) => tx.query("update propostas set status = 'enviada' where id = $1", [proposta])), /não permitida/);
    await assert.rejects(vendedora((tx) => tx.query("update propostas set status = 'aprovada' where id = $1", [proposta])), /Só o gestor aprova/);
    // tentar forjar os campos de aprovação pelo app não tem efeito
    await vendedora((tx) => tx.query("update propostas set aprovada_em = now(), aprovada_por = public.meu_vendedor_id() where id = $1", [proposta]));
    assert.equal(await banco((tx) => valor(tx, "select aprovada_em from propostas where id = $1", [proposta])), null);

    await vendedora((tx) => tx.query("update propostas set status = 'aguardando_aprovacao' where id = $1", [proposta]));
    await assert.rejects(vendedora((tx) => tx.query("update propostas set capa_titulo = 'Outro' where id = $1", [proposta])), /só o gestor altera/);
    await assert.rejects(gestor((tx) => tx.query("update propostas set status = 'ajustes_solicitados' where id = $1", [proposta])), /Escreva o que precisa/);
    await gestor((tx) => tx.query("update propostas set status = 'ajustes_solicitados', ajustes_comentario = 'Trocar o título da capa.' where id = $1", [proposta]));

    await vendedora(async (tx) => {
      await tx.query("update propostas set capa_titulo = 'Um brinde ao primeiro ano do José Miguel.' where id = $1", [proposta]);
      await tx.query("update propostas set status = 'aguardando_aprovacao' where id = $1", [proposta]);
    });
    await gestor((tx) => tx.query("update propostas set status = 'aprovada' where id = $1", [proposta]));
    await banco(async (tx) => {
      const p = await um(tx, "select p.*, v.nome as aprovador from propostas p join vendedores v on v.id = p.aprovada_por where p.id = $1", [proposta]);
      assert.equal(p.status, "aprovada");
      assert.ok(p.aprovada_em);
      assert.equal(p.aprovador, "Andre");
      const passos = (await tx.query("select para_status from proposta_revisoes where proposta_id = $1 order by created_at, id", [proposta])).rows.map((r) => r.para_status);
      assert.deepEqual(passos.slice().sort(), ["aguardando_aprovacao", "aguardando_aprovacao", "ajustes_solicitados", "aprovada", "rascunho"].sort());
    });

    // aprovada: conteúdo e itens travados (para todos, inclusive o gestor)
    await assert.rejects(gestor((tx) => tx.query("update propostas set capa_titulo = 'Mudei' where id = $1", [proposta])), /já aprovada ou enviada/);
    await assert.rejects(gestor((tx) => tx.query("update proposta_itens set preco_unitario = 1 where proposta_id = $1", [proposta])), /já aprovada ou enviada/);
    // aprovada ainda não abre o link
    assert.equal(await visitante((tx) => valor(tx, "select public.proposta_publica($1)", [codigoPublico])), null);
  });

  test("a trava vale também para quem mexe direto no banco (fora da tela e da API)", async () => {
    const outra = await vendedora((tx) => valor(tx, "select public.nova_versao_proposta($1)", [proposta]));
    // a versão nova nasce rascunho e SEM aprovação; a anterior fica substituída
    await banco(async (tx) => {
      assert.equal(await valor(tx, "select status from propostas where id = $1", [proposta]), "substituida");
      assert.equal(await valor(tx, "select aprovada_em from propostas where id = $1", [outra]), null);
    });
    await assert.rejects(banco((tx) => tx.query("update propostas set status = 'enviada' where id = $1", [outra])), /depois de aprovada/);
    const agente = await banco((tx) => valor(tx, "select id from vendedores where tipo = 'agente'"));
    await assert.rejects(banco((tx) => tx.query("update propostas set status = 'aprovada', aprovada_em = now(), aprovada_por = $2 where id = $1", [outra, agente])), /Só o gestor aprova/);
    await assert.rejects(banco((tx) => tx.query("update propostas set status = 'aprovada', aprovada_em = now() where id = $1", [outra])), /Só o gestor aprova/);
    await assert.rejects(banco((tx) => tx.query("update propostas set status = 'aceita', aceita_em = now() where id = $1", [outra])), /enviada pode ser aceita|propostas_aprovacao_ck/);
    proposta = outra;
    codigoPublico = await banco((tx) => valor(tx, "select codigo from propostas where id = $1", [proposta]));
  });

  test("gestor aprova e envia; data fica reservada; cliente abre o link e aceita; negócio fecha e data confirma", async () => {
    await gestor(async (tx) => {
      await tx.query("update propostas set status = 'aprovada' where id = $1", [proposta]); // gestor aprova direto do rascunho
      await tx.query("update propostas set status = 'enviada' where id = $1", [proposta]);
    });
    await banco(async (tx) => {
      const ev = await um(tx, "select * from eventos where negocio_id = $1", [negocio]);
      assert.equal(ev.situacao_data, "reservada");
      assert.ok(ev.reservada_ate);
    });
    const pub = await visitante((tx) => valor(tx, "select public.proposta_publica($1)", [codigoPublico]));
    assert.equal(pub.proposta.status, "enviada");
    assert.equal(pub.proposta.cardapio.length, 4);
    assert.equal(pub.proposta.evento.nome, "1 ano do José Miguel");
    assert.equal(pub.empresa.nome, "Aurora Bartenders");
    assert.equal(pub.empresa.responsavel, "André Procácio");
    assert.equal(JSON.stringify(pub).includes("margem_pct"), false, "a memória de cálculo nunca vai para o cliente");
    assert.equal(JSON.stringify(pub).includes("custos"), false);

    const curto = await visitante((tx) => valor(tx, "select public.aceitar_proposta_publica($1, 'V')", [codigoPublico]));
    assert.equal(curto.ok, false);
    const ok = await visitante((tx) => valor(tx, "select public.aceitar_proposta_publica($1, 'Vitória Lima', '203.0.113.5', 'Navegador de teste')", [codigoPublico]));
    assert.equal(ok.ok, true);
    const denovo = await visitante((tx) => valor(tx, "select public.aceitar_proposta_publica($1, 'Vitória Lima')", [codigoPublico]));
    assert.equal(denovo.ja_aceita, true);

    await banco(async (tx) => {
      const n = await um(tx, "select * from negocios where id = $1", [negocio]);
      assert.equal(n.status, "ganho");
      assert.equal(await valor(tx, "select situacao_data from eventos where negocio_id = $1", [negocio]), "confirmada");
      assert.equal(await valor(tx, "select count(*)::int from comissoes where negocio_id = $1", [negocio]), 0, "módulo de comissões desligado");
      const tipos = (await tx.query("select tipo from eventos_saida where negocio_id = $1 order by id", [negocio])).rows.map((r) => r.tipo);
      for (const t of ["lead.criado", "proposta.submetida", "proposta.ajustes_solicitados", "proposta.aprovada", "proposta.enviada", "proposta.visualizada", "proposta.aceita", "negocio.ganho"]) {
        assert.ok(tipos.includes(t), `faltou o aviso ${t}`);
      }
      assert.equal(await valor(tx, "select ator_tipo from auditoria where tabela = 'propostas' and registro_id = $1 order by created_at desc limit 1", [proposta]), "cliente");
    });
    await assert.rejects(gestor((tx) => tx.query("update propostas set observacoes = 'x' where id = $1", [proposta])), /aceita não pode ser alterada/);
  });
});

describe("API do agente", () => {
  let chave, chaveLeitura, negocio, proposta;
  const dia = amanha(150);

  test("só o gestor cria chave; chave inválida, revogada ou sem permissão é recusada", async () => {
    await assert.rejects(vendedora((tx) => tx.query("select public.criar_chave_api('X')")), /Só o gestor/);
    const r = await gestor((tx) => valor(tx, "select public.criar_chave_api('Agente SDR')"));
    chave = r.chave;
    assert.match(chave, /^aur_[0-9a-f]{48}$/);
    // a chave não fica guardada em lugar nenhum
    assert.equal(await banco((tx) => valor(tx, "select count(*)::int from chaves_api where hash = $1 or prefixo = $1", [chave])), 0);
    chaveLeitura = (await gestor((tx) => valor(tx, "select public.criar_chave_api('Só leitura', array['contatos.ler','negocios.ler'])"))).chave;

    assert.equal((await api("aur_" + "0".repeat(48), "ping")).status, 401);
    assert.equal((await api("qualquer coisa", "ping")).status, 401);
    const ping = await api(chave, "ping");
    assert.equal(ping.status, 200);
    assert.equal(ping.dados.empresa, "Aurora Bartenders");
    assert.equal((await api(chaveLeitura, "contatos.criar", { nome: "Não pode" })).status, 403);
    assert.equal((await api(chave, "acao.inexistente")).status, 404);

    const descartavel = await gestor((tx) => valor(tx, "select public.criar_chave_api('Descartável')"));
    await gestor((tx) => tx.query("select public.revogar_chave_api($1)", [descartavel.id]));
    assert.equal((await api(descartavel.chave, "ping")).status, 401);
  });

  test("contato e negócio: cria, reaproveita pelo telefone, atualiza evento e consulta a agenda", async () => {
    const c1 = await api(chave, "contatos.criar", { nome: "Carla Mendes", telefone: "(34) 98877-6655" });
    assert.equal(c1.status, 201);
    const c2 = await api(chave, "contatos.criar", { nome: "Carla M.", telefone: "5534988776655" });
    assert.equal(c2.status, 200);
    assert.equal(c2.dados.ja_existia, true);
    assert.equal(c2.dados.id, c1.dados.id);
    assert.equal((await api(chave, "contatos.criar", { nome: "X", telefone: "123" })).status, 400);
    const busca = await api(chaveLeitura, "contatos.buscar", { telefone: "34988776655" });
    assert.equal(busca.dados.contatos.length, 1);

    const n = await api(chave, "negocios.criar", {
      contato_id: c1.dados.id,
      evento: { tipo: "15 anos", data: dia, hora_inicio: "20:00", duracao_horas: 5, cidade: "Araxá", convidados: 120, pacote: "Reserve" },
    });
    assert.equal(n.status, 201);
    negocio = n.dados.id;
    assert.equal(n.dados.atendimento, "agente");
    assert.equal(n.dados.origem, "WhatsApp");
    assert.equal(n.dados.etapa.nome, "Novo lead");
    assert.equal(n.dados.evento.tipo, "15_anos");
    assert.equal(n.dados.evento.pacote, "Reserve");

    const ev = await api(chave, "evento.atualizar", { negocio_id: negocio, local: "Clube Araxá", convidados: 130 });
    assert.equal(ev.status, 200);
    assert.equal(ev.dados.evento.local, "Clube Araxá");
    assert.equal(ev.dados.evento.data, dia, "os campos não enviados continuam como estavam");
    assert.equal(ev.dados.disponibilidade.situacao, "livre");
    assert.equal((await api(chave, "evento.atualizar", { negocio_id: negocio, pacote: "Pacote Inventado" })).status, 400);
    assert.equal((await api(chave, "evento.atualizar", { negocio_id: negocio, data: "31/12/2030" })).status, 400);

    const ag = await api(chave, "agenda.disponibilidade", { data: dia, hora_inicio: "21:00" });
    assert.equal(ag.dados.capacidade, 3);
    assert.equal(JSON.stringify(ag.dados).includes("Carla"), false, "a agenda não expõe dados de clientes");

    const mv = await api(chave, "negocios.mover_etapa", { id: negocio, etapa: "em atendimento" });
    assert.equal(mv.dados.etapa.nome, "Em atendimento");
    assert.equal((await api(chave, "negocios.mover_etapa", { id: negocio, etapa: "Etapa que não existe" })).status, 400);
    await banco(async (tx) => {
      assert.equal(await valor(tx, `select v.nome from historico_etapas h join vendedores v on v.id = h.autor_id
                                     where h.negocio_id = $1 order by h.movido_em desc limit 1`, [negocio]), "Agente SDR");
    });
  });

  test("catálogo e preço: só o que está cadastrado e aprovado", async () => {
    const pac = await api(chave, "catalogo.pacotes");
    assert.deepEqual(pac.dados.pacotes.map((p) => p.nome), ["Essencial", "Signature", "Reserve", "Exclusive"]);
    assert.equal(pac.dados.pacotes[3].drinks.length, 7);
    const cond = await api(chave, "catalogo.condicoes");
    assert.equal(cond.dados.condicoes.entrada_pct, null);
    assert.equal(cond.dados.condicoes_confirmadas, false);

    const reserve = pac.dados.pacotes.find((p) => p.nome === "Reserve").id;
    const preco = await api(chave, "precos.calcular", { pacote_id: reserve, convidados: 130, duracao_horas: 5 });
    assert.equal(preco.dados.disponivel, true);
    assert.ok(Number(preco.dados.preco) > 0);
    assert.equal(JSON.stringify(preco.dados).includes("custo"), false, "o agente não recebe custos nem margem");
    assert.equal(JSON.stringify(preco.dados).includes("margem"), false);

    // regras desaprovadas → o agente não recebe preço
    await gestor((tx) => tx.query("update calculadora set margem_pct = 90"));
    const sem = await api(chave, "precos.calcular", { pacote_id: reserve, convidados: 130, duracao_horas: 5 });
    assert.equal(sem.dados.disponivel, false);
    assert.equal(sem.dados.preco, undefined);
  });

  test("proposta do agente: rascunho → submete → ajustes → reenvia → aprovada → só então envia", async () => {
    // com as regras de preço desaprovadas, o rascunho nasce com "preço pendente"
    const cr = await api(chave, "propostas.criar", { negocio_id: negocio, capa_titulo: "Um brinde aos 15 anos da Laura.", nota: "Cliente quer fechar esta semana." });
    assert.equal(cr.status, 201);
    proposta = cr.dados.id;
    assert.equal(cr.dados.status, "rascunho");
    assert.equal(cr.dados.origem, "agente");
    assert.equal(cr.dados.preco_pendente, true);
    assert.equal(Number(cr.dados.total), 0);
    assert.equal(cr.dados.cardapio.length, 6);
    assert.equal(cr.dados.link, null);
    assert.equal((await api(chave, "propostas.criar", { negocio_id: negocio })).status, 409, "uma proposta em andamento por negócio");

    const cedo = await api(chave, "propostas.enviar", { id: proposta });
    assert.equal(cedo.status, 409);
    assert.match(cedo.erro.mensagem, /APROVADAS/);

    assert.equal((await api(chave, "propostas.submeter", { id: proposta })).dados.status, "aguardando_aprovacao");
    assert.equal((await api(chave, "propostas.atualizar", { id: proposta, capa_titulo: "x" })).status, 409);
    assert.equal((await api(chave, "propostas.enviar", { id: proposta })).status, 409);

    // gestor não consegue aprovar sem valor; pede ajustes
    await assert.rejects(gestor((tx) => tx.query("update propostas set status = 'aprovada' where id = $1", [proposta])), /Defina o valor/);
    await gestor((tx) => tx.query("select public.aprovar_calculadora()"));
    await gestor((tx) => tx.query("update propostas set status = 'ajustes_solicitados', ajustes_comentario = 'Tirar o Fitzgerald e recalcular.' where id = $1", [proposta]));

    const lida = await api(chave, "propostas.obter", { id: proposta });
    assert.equal(lida.dados.status, "ajustes_solicitados");
    assert.equal(lida.dados.ajustes.comentario, "Tirar o Fitzgerald e recalcular.");

    const drinks = (await api(chave, "catalogo.drinks")).dados.drinks;
    const semFitz = lida.dados.cardapio.filter((d) => d.nome !== "Fitzgerald").map((d) => d.drink_id);
    const at = await api(chave, "propostas.atualizar", { id: proposta, drinks: semFitz });
    assert.equal(at.status, 200);
    assert.equal(at.dados.cardapio.length, 5);
    assert.ok(Number(at.dados.total) > 0, "com as regras aprovadas, o preço vem da calculadora");
    assert.equal(at.dados.preco_pendente, false);
    assert.equal(at.dados.capa_titulo, "Um brinde aos 15 anos da Laura.");
    assert.ok(drinks.length >= 16);
    // o agente não consegue ditar o preço
    const forcar = await api(chave, "propostas.atualizar", { id: proposta, total: 1, itens: [{ descricao: "x", preco_unitario: 1 }] });
    assert.equal(Number(forcar.dados.total), Number(at.dados.total));

    await api(chave, "propostas.submeter", { id: proposta, nota: "Ajustado." });
    await gestor((tx) => tx.query("update propostas set status = 'aprovada' where id = $1", [proposta]));
    const env = await api(chave, "propostas.enviar", { id: proposta });
    assert.equal(env.status, 200);
    assert.equal(env.dados.status, "enviada");
    assert.match(env.dados.link, /^https:\/\/app\.exemplo\.com\.br\/proposta\/[a-f0-9]{32}$/);
    assert.equal((await api(chave, "propostas.enviar", { id: proposta })).status, 200, "repetir o envio não dá erro");
  });

  test("conversa: registra sem duplicar e lê em ordem", async () => {
    const msgs = [
      { direcao: "entrada", texto: "Oi, quero um orçamento.", id_externo: "wamid.1", enviada_em: "2026-11-01T10:00:00Z" },
      { direcao: "saida", texto: "Olá! Qual a data da festa?", id_externo: "wamid.2", enviada_em: "2026-11-01T10:01:00Z" },
    ];
    const r1 = await api(chave, "mensagens.registrar", { negocio_id: negocio, mensagens: msgs });
    assert.equal(r1.status, 201);
    assert.equal(r1.dados.gravadas, 2);
    const r2 = await api(chave, "mensagens.registrar", { negocio_id: negocio, mensagens: msgs });
    assert.equal(r2.dados.gravadas, 0);
    assert.equal(r2.dados.ja_existiam, 2);
    assert.equal((await api(chave, "mensagens.registrar", { negocio_id: negocio, direcao: "lado errado", texto: "x" })).status, 400);
    const lista = await api(chave, "mensagens.listar", { negocio_id: negocio });
    assert.deepEqual(lista.dados.mensagens.map((m) => m.autor), ["cliente", "agente"]);
  });

  test("encaminhamento: agente pede humano e para de alterar; gestor devolve; avisos e registro de tudo", async () => {
    const ped = await api(chave, "atendimento.pedir_humano", { negocio_id: negocio, motivo: "Cliente pediu desconto." });
    assert.equal(ped.dados.transferido, true);
    await banco(async (tx) => {
      assert.equal(await valor(tx, "select atendimento from negocios where id = $1", [negocio]), "humano");
      assert.equal(await valor(tx, "select count(*)::int from atividades where negocio_id = $1 and titulo like 'Assumir atendimento%'", [negocio]), 1);
    });
    const bloqueado = await api(chave, "evento.atualizar", { negocio_id: negocio, convidados: 10 });
    assert.equal(bloqueado.status, 409);
    assert.match(bloqueado.erro.mensagem, /está com um humano/);
    // registrar mensagem continua permitido (o canal segue gravando a conversa)
    assert.equal((await api(chave, "mensagens.registrar", { negocio_id: negocio, direcao: "entrada", texto: "Alô?" })).status, 201);

    // pelo app, mexer direto na coluna não muda o atendimento; só o botão (função) muda
    await gestor((tx) => tx.query("update negocios set atendimento = 'agente' where id = $1", [negocio]));
    assert.equal(await banco((tx) => valor(tx, "select atendimento from negocios where id = $1", [negocio])), "humano");
    assert.equal(await gestor((tx) => valor(tx, "select public.transferir_atendimento($1, 'agente', 'Pode seguir com a proposta.')", [negocio])), true);
    assert.equal((await api(chave, "negocios.obter", { id: negocio })).dados.atendimento, "agente");

    const ev = await api(chave, "eventos.listar", { depois: 0, limite: 200 });
    const tipos = ev.dados.eventos.filter((e) => e.negocio_id === negocio).map((e) => e.tipo);
    for (const t of ["lead.criado", "proposta.ajustes_solicitados", "proposta.aprovada", "atendimento.pedido_humano", "atendimento.encaminhado_agente"]) {
      assert.ok(tipos.includes(t), `faltou o aviso ${t}`);
    }
    const mais = await api(chave, "eventos.listar", { depois: ev.dados.proximo });
    assert.equal(mais.dados.eventos.length, 0);

    await banco(async (tx) => {
      assert.ok((await valor(tx, "select count(*)::int from agente_log")) > 20);
      assert.ok((await valor(tx, "select count(*)::int from agente_log where not ok")) > 5, "as recusas também ficam registradas");
      assert.ok((await valor(tx, "select count(*)::int from auditoria where ator_tipo = 'agente' and autor = 'Agente SDR'")) > 3);
      assert.equal(await valor(tx, "select count(*)::int from auditoria where ator_tipo = 'agente' and chave_api_id is null"), 0);
    });
  });

  test("limite de chamadas por minuto", async () => {
    const r = await gestor((tx) => valor(tx, "select public.criar_chave_api('Limitada', null, 3)"));
    const status = [];
    for (let i = 0; i < 5; i++) status.push((await api(r.chave, "ping")).status);
    assert.deepEqual(status, [200, 200, 200, 429, 429]);
  });

  test("perdido: precisa de motivo cadastrado; negócio encerrado sai do agente", async () => {
    const n = await api(chave, "negocios.criar", { contato: { nome: "Diego Prado", telefone: "34977001122" }, evento: { tipo: "empresa" } });
    assert.equal((await api(chave, "negocios.marcar_perdido", { id: n.dados.id, motivo: "Motivo inventado" })).status, 400);
    const p = await api(chave, "negocios.marcar_perdido", { id: n.dados.id, motivo: "preço", detalhe: "Achou caro." });
    assert.equal(p.dados.status, "perdido");
    assert.equal(p.dados.atendimento, "humano");
    assert.equal((await api(chave, "negocios.atualizar", { id: n.dados.id, titulo: "Reabrir" })).status, 409);
  });
});

describe("avisos (webhooks)", () => {
  test("evento vai para a fila, é enviado com assinatura válida e confirmado; falha agenda nova tentativa", async () => {
    const wh = await gestor(async (tx) => um(tx, "insert into webhooks (nome, url, eventos) values ('Agente', 'https://agente.exemplo/avisos', array['teste.ping','lead.criado']) returning *"));
    assert.equal(wh.segredo.length, 48);
    await assert.rejects(vendedora((tx) => tx.query("select * from webhooks")).then((r) => { if (r.rows.length === 0) throw new Error("sem acesso"); }), /sem acesso/);

    const evento = await gestor((tx) => valor(tx, "select public.testar_webhook($1)", [wh.id]));
    await banco(async (tx) => {
      const en = await um(tx, "select * from webhook_entregas where evento_id = $1", [evento]);
      assert.equal(en.status, "enviando");
      assert.equal(en.tentativas, 1);
      const envio = await um(tx, "select * from net.envios where id = $1", [en.pedido_id]);
      assert.equal(envio.url, "https://agente.exemplo/avisos");
      assert.equal(envio.body.tipo, "teste.ping");
      assert.equal(envio.headers["X-Aurora-Evento"], "teste.ping");
      // confere a assinatura como o agente faria
      const [, t, v1] = envio.headers["X-Aurora-Assinatura"].match(/^t=(\d+),v1=([0-9a-f]{64})$/);
      const corpo = await valor(tx, "select body::text from net.envios where id = $1", [en.pedido_id]);
      const esperado = crypto.createHmac("sha256", wh.segredo).update(`${t}.${corpo}`).digest("hex");
      assert.equal(v1, esperado);

      await tx.query("insert into net._http_response values ($1, 500, null, false)", [en.pedido_id]);
      await tx.query("select privado.conferir_webhooks()");
      const falhou = await um(tx, "select * from webhook_entregas where id = $1", [en.id]);
      assert.equal(falhou.status, "falhou");
      assert.equal(falhou.http_status, 500);
      assert.ok(new Date(falhou.proxima_tentativa_em) > new Date());
    });
    await gestor((tx) => tx.query("select public.processar_webhooks()")); // "Processar fila agora"
    await banco(async (tx) => {
      const en = await um(tx, "select * from webhook_entregas where evento_id = $1", [evento]);
      assert.equal(en.status, "enviando");
      assert.equal(en.tentativas, 2);
      await tx.query("insert into net._http_response values ($1, 204, null, false)", [en.pedido_id]);
      await tx.query("select privado.conferir_webhooks()");
      assert.equal(await valor(tx, "select status from webhook_entregas where id = $1", [en.id]), "entregue");
    });
    // só os tipos escolhidos entram na fila deste webhook
    await banco(async (tx) => {
      assert.equal(await valor(tx, `select count(*)::int from webhook_entregas en join eventos_saida e on e.id = en.evento_id
                                     where en.webhook_id = $1 and e.tipo not in ('teste.ping','lead.criado')`, [wh.id]), 0);
    });
  });
});

describe("LGPD", () => {
  test("exportar e apagar os dados de um contato; negócio fechado é mantido", async () => {
    const perdido = await banco((tx) => valor(tx, "select contato_id from negocios where titulo like '%Diego Prado%'"));
    const exp = await gestor((tx) => valor(tx, "select public.exportar_contato($1)", [perdido]));
    assert.equal(exp.contato.nome, "Diego Prado");
    assert.equal(exp.negocios.length, 1);
    await assert.rejects(vendedora((tx) => tx.query("select public.anonimizar_contato($1)", [perdido])), /Só o gestor/);
    const r = await gestor((tx) => valor(tx, "select public.anonimizar_contato($1)", [perdido]));
    assert.equal(r.contato_anonimizado, true);
    await banco(async (tx) => {
      const c = await um(tx, "select * from contatos where id = $1", [perdido]);
      assert.equal(c.nome, "Contato removido");
      assert.equal(c.telefone, null);
      assert.equal(await valor(tx, "select count(*)::int from negocios where contato_id = $1 and titulo like '%Diego%'", [perdido]), 0);
      assert.equal(await valor(tx, "select count(*)::int from auditoria where descricao like '%Diego%'"), 0);
      assert.equal(await valor(tx, "select count(*)::int from agente_log where pedido::text like '%Diego%'"), 0);
    });
    // cliente que fechou: mantém o contrato (proposta aceita) e o contato
    const fechou = await banco((tx) => valor(tx, "select contato_id from negocios where status = 'ganho' and contato_id is not null limit 1"));
    const m = await gestor((tx) => valor(tx, "select public.anonimizar_contato($1)", [fechou]));
    assert.equal(m.contato_anonimizado, false);
    assert.equal(m.negocios_mantidos, 1);
    assert.equal(await banco((tx) => valor(tx, "select nome from contatos where id = $1", [fechou])), "Vitória Lima");
  });

  test("prazo de guarda: simula sem apagar", async () => {
    await banco((tx) => tx.query("update contatos set updated_at = now() - interval '2 years' where nome like 'Pessoa %'")).catch(() => {});
    const n = await gestor((tx) => valor(tx, "select public.aplicar_retencao(true)"));
    assert.equal(typeof n, "number");
    assert.equal(await banco((tx) => valor(tx, "select count(*)::int from contatos where nome like 'Pessoa %'")), 5);
  });

  test("pedidos do site que não viraram contato também são limpos", async () => {
    // um pedido rejeitado do mesmo telefone de um contato, e outro antigo, sem contato
    const { id, telefone } = await banco(async (tx) => {
      const { rows } = await tx.query(
        "insert into contatos (nome, telefone) values ('Pessoa do pedido rejeitado', '34988887777') returning id, telefone",
      );
      await tx.query(
        `insert into leads_recebidos (origem, dados, status, motivo) values
           ('site', '{"nome":"Pessoa do pedido rejeitado","whatsapp":"(34) 98888-7777"}', 'rejeitado', 'teste'),
           ('site', '{"nome":"Pedido antigo sem contato","whatsapp":"(34) 97777-6666"}', 'rejeitado', 'teste')`,
      );
      await tx.query("update leads_recebidos set created_at = now() - interval '3 years', ip_hash = 'abc' where dados ->> 'nome' = 'Pedido antigo sem contato'");
      return rows[0];
    });
    assert.ok(telefone);
    await gestor((tx) => tx.query("select public.anonimizar_contato($1)", [id]));
    assert.equal(await banco((tx) => valor(tx, "select count(*)::int from leads_recebidos where dados::text like '%Pessoa do pedido rejeitado%'")), 0);
    // o antigo só sai quando o prazo de guarda é aplicado de verdade
    await gestor((tx) => tx.query("select public.aplicar_retencao(true)"));
    assert.equal(await banco((tx) => valor(tx, "select count(*)::int from leads_recebidos where dados::text like '%Pedido antigo sem contato%'")), 1);
    await gestor((tx) => tx.query("select public.aplicar_retencao(false)"));
    assert.equal(await banco((tx) => valor(tx, "select count(*)::int from leads_recebidos where dados::text like '%Pedido antigo sem contato%' or ip_hash = 'abc'")), 0);
  });
});
