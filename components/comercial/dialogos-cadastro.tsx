"use client";

/**
 * Cadastro/edição de CONTATO (pessoa) e de EMPRESA (pessoa jurídica).
 * O contato avisa na hora se o e-mail ou telefone já existe na base (duplicado).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { salvarContato, salvarEmpresa, verificarDuplicado } from "@/app/(app)/contatos/actions";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { PORTES } from "@/lib/comercial";
import { formatarTelefone } from "@/lib/formatar";
import type { Contato, Empresa } from "@/lib/tipos";
import { useAcao } from "@/lib/use-acao";

type Opcao = { id: string; nome: string };
export type OpcoesCadastro = { empresas: Opcao[]; origens: Opcao[]; vendedores: Opcao[]; gestor: boolean; meuId: string | null };

type Duplicado = { id: string | null; nome: string; motivo: string; responsavel: string | null };

function Rodape({ aoFechar, pendente, texto }: { aoFechar: () => void; pendente: boolean; texto: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
      <Botao variante="secundario" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao type="submit" carregando={pendente}>
        {texto}
      </Botao>
    </div>
  );
}

function CamposComuns({
  e,
  opcoes,
  tags,
  origem,
  responsavel,
}: {
  e: Record<string, string>;
  opcoes: OpcoesCadastro;
  tags?: string[];
  origem?: string | null;
  responsavel?: string | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Campo rotulo="Origem do lead" nome="origem_id" erro={e.origem_id}>
        {(p) => (
          <Selecao {...p} defaultValue={origem ?? ""}>
            <option value="">— não informada —</option>
            {opcoes.origens.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Etiquetas" nome="tags" erro={e.tags} ajuda="Separe por vírgula">
        {(p) => <Entrada {...p} defaultValue={tags?.join(", ") ?? ""} maxLength={300} placeholder="Decisor, Grande conta" />}
      </Campo>
      {opcoes.gestor ? (
        <Campo rotulo="Responsável" nome="responsavel_id" erro={e.responsavel_id}>
          {(p) => (
            <Selecao {...p} defaultValue={responsavel ?? opcoes.meuId ?? ""}>
              {opcoes.vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
      ) : (
        <div />
      )}
    </div>
  );
}

export function DialogoContato({
  aberto,
  aoFechar,
  opcoes,
  contato,
  empresaInicial,
  irParaFicha = true,
}: {
  aberto: boolean;
  aoFechar: () => void;
  opcoes: OpcoesCadastro;
  contato?: Contato | null;
  empresaInicial?: string;
  irParaFicha?: boolean;
}) {
  const router = useRouter();
  const [dups, setDups] = useState<Duplicado[]>([]);
  const { onSubmit, erros: e, pendente } = useAcao(salvarContato, {
    aoSucesso: (r) => {
      aoFechar();
      if (!contato && irParaFicha && r.dados?.id) router.push(`/contatos/${r.dados.id}`);
      else router.refresh();
    },
  });

  async function conferir(form: HTMLFormElement | null) {
    if (!form) return;
    const f = new FormData(form);
    const email = String(f.get("email") ?? "");
    const tel = String(f.get("telefone") ?? "");
    if (!email.includes("@") && tel.replace(/\D/g, "").length < 10) {
      setDups([]);
      return;
    }
    setDups(await verificarDuplicado(email, tel, contato?.id));
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={contato ? "Editar contato" : "Novo contato"} largo>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {contato && <input type="hidden" name="id" value={contato.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" nome="nome" erro={e.nome}>
            {(p) => <Entrada {...p} defaultValue={contato?.nome ?? ""} maxLength={120} required autoFocus={!contato} autoComplete="off" />}
          </Campo>
          <Campo rotulo="Empresa" nome="empresa_id" erro={e.empresa_id} ajuda="Vazio = pessoa física">
            {(p) => (
              <Selecao {...p} defaultValue={contato?.empresa_id ?? empresaInicial ?? ""}>
                <option value="">— pessoa física / sem empresa —</option>
                {opcoes.empresas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Telefone / WhatsApp" nome="telefone" erro={e.telefone}>
            {(p) => (
              <Entrada
                {...p}
                type="tel"
                inputMode="tel"
                defaultValue={formatarTelefone(contato?.telefone)}
                placeholder="(11) 90000-0000"
                onBlur={(ev) => conferir(ev.currentTarget.form)}
              />
            )}
          </Campo>
          <Campo rotulo="E-mail" nome="email" erro={e.email}>
            {(p) => (
              <Entrada
                {...p}
                type="email"
                inputMode="email"
                defaultValue={contato?.email ?? ""}
                autoComplete="off"
                onBlur={(ev) => conferir(ev.currentTarget.form)}
              />
            )}
          </Campo>
          <Campo rotulo="Cargo" nome="cargo" erro={e.cargo}>
            {(p) => <Entrada {...p} defaultValue={contato?.cargo ?? ""} maxLength={80} placeholder="Ex.: Gerente de compras" />}
          </Campo>
          <Campo rotulo="Cidade" nome="cidade" erro={e.cidade}>
            {(p) => <Entrada {...p} defaultValue={contato?.cidade ?? ""} maxLength={80} />}
          </Campo>
        </div>

        {dups.length > 0 && (
          <div role="status" className="rounded-xl border border-alerta-forte bg-alerta-suave p-3 text-sm text-alerta">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" aria-hidden /> Possível duplicado
            </p>
            <ul className="mt-1 list-disc pl-5">
              {dups.map((d, i) => (
                <li key={i}>
                  Mesmo {d.motivo === "email" ? "e-mail" : "telefone"}:{" "}
                  {d.id ? (
                    <Link href={`/contatos/${d.id}`} className="font-semibold underline">
                      {d.nome}
                    </Link>
                  ) : (
                    d.nome
                  )}
                  {d.responsavel ? ` (responsável: ${d.responsavel})` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1">Você pode salvar mesmo assim, se for outra pessoa.</p>
          </div>
        )}

        <CamposComuns e={e} opcoes={opcoes} tags={contato?.tags} origem={contato?.origem_id} responsavel={contato?.responsavel_id} />
        <Campo rotulo="CPF (opcional)" nome="cpf" erro={e.cpf}>
          {(p) => <Entrada {...p} inputMode="numeric" defaultValue={contato?.cpf ?? ""} className="sm:max-w-60" />}
        </Campo>
        <Campo rotulo="Observações" nome="observacoes" erro={e.observacoes}>
          {(p) => <AreaTexto {...p} rows={3} maxLength={2000} defaultValue={contato?.observacoes ?? ""} />}
        </Campo>
        <Rodape aoFechar={aoFechar} pendente={pendente} texto={contato ? "Salvar" : "Cadastrar"} />
      </form>
    </Modal>
  );
}

export function DialogoEmpresa({
  aberto,
  aoFechar,
  opcoes,
  empresa,
}: {
  aberto: boolean;
  aoFechar: () => void;
  opcoes: OpcoesCadastro;
  empresa?: Empresa | null;
}) {
  const router = useRouter();
  const { onSubmit, erros: e, pendente } = useAcao(salvarEmpresa, {
    aoSucesso: (r) => {
      aoFechar();
      if (!empresa && r.dados?.id) router.push(`/empresas/${r.dados.id}`);
      else router.refresh();
    },
  });
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={empresa ? "Editar empresa" : "Nova empresa"} largo>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {empresa && <input type="hidden" name="id" value={empresa.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome da empresa" nome="nome" erro={e.nome}>
            {(p) => <Entrada {...p} defaultValue={empresa?.nome ?? ""} maxLength={120} required autoFocus={!empresa} />}
          </Campo>
          <Campo rotulo="CNPJ" nome="cnpj" erro={e.cnpj}>
            {(p) => <Entrada {...p} inputMode="numeric" defaultValue={empresa?.cnpj ?? ""} placeholder="00.000.000/0000-00" />}
          </Campo>
          <Campo rotulo="Segmento" nome="segmento" erro={e.segmento}>
            {(p) => <Entrada {...p} defaultValue={empresa?.segmento ?? ""} maxLength={60} placeholder="Ex.: Indústria, Saúde, Varejo" />}
          </Campo>
          <Campo rotulo="Porte" nome="porte" erro={e.porte}>
            {(p) => (
              <Selecao {...p} defaultValue={empresa?.porte ?? ""}>
                <option value="">— não informado —</option>
                {PORTES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Telefone" nome="telefone" erro={e.telefone}>
            {(p) => <Entrada {...p} type="tel" inputMode="tel" defaultValue={formatarTelefone(empresa?.telefone)} />}
          </Campo>
          <Campo rotulo="E-mail" nome="email" erro={e.email}>
            {(p) => <Entrada {...p} type="email" defaultValue={empresa?.email ?? ""} />}
          </Campo>
          <Campo rotulo="Site" nome="site" erro={e.site}>
            {(p) => <Entrada {...p} defaultValue={empresa?.site ?? ""} maxLength={160} placeholder="www.empresa.com.br" />}
          </Campo>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <Campo rotulo="Cidade" nome="cidade" erro={e.cidade}>
              {(p) => <Entrada {...p} defaultValue={empresa?.cidade ?? ""} maxLength={80} />}
            </Campo>
            <Campo rotulo="UF" nome="uf" erro={e.uf}>
              {(p) => <Entrada {...p} defaultValue={empresa?.uf ?? ""} maxLength={2} className="uppercase" />}
            </Campo>
          </div>
        </div>
        <Campo rotulo="Endereço" nome="endereco" erro={e.endereco}>
          {(p) => <Entrada {...p} defaultValue={empresa?.endereco ?? ""} maxLength={200} />}
        </Campo>
        <CamposComuns e={e} opcoes={opcoes} tags={empresa?.tags} origem={empresa?.origem_id} responsavel={empresa?.responsavel_id} />
        <Campo rotulo="Observações" nome="observacoes" erro={e.observacoes}>
          {(p) => <AreaTexto {...p} rows={3} maxLength={2000} defaultValue={empresa?.observacoes ?? ""} />}
        </Campo>
        <Rodape aoFechar={aoFechar} pendente={pendente} texto={empresa ? "Salvar" : "Cadastrar"} />
      </form>
    </Modal>
  );
}
