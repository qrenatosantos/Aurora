/**
 * Peças de validação (zod) reaproveitadas pelas Server Actions.
 * Recebem texto do formulário e devolvem o valor no formato do banco.
 */
import { z } from "zod";
import { lerMoeda, somenteDigitos } from "@/lib/formatar";

/** Texto opcional: "" vira null no banco. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v.length <= max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

export const textoObrigatorio = (min: number, max: number, msg: string) =>
  z.string(msg).trim().min(min, msg).max(max, `Máximo de ${max} caracteres.`);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Id opcional (select "— nenhum —" = ""). */
export const idOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || UUID.test(v), "Escolha uma opção válida.");

export const idObrigatorio = (msg: string) => z.string(msg).trim().regex(UUID, msg);

/** "1.234,56" → 1234.56 (≥ 0) */
export const moeda = z
  .string()
  .optional()
  .transform((v) => Math.round(lerMoeda(v ?? "") * 100) / 100)
  .refine((v) => v >= 0 && v <= 9_999_999_999, "Valor inválido.");

/** Percentual 0–100 (aceita vírgula). */
export const percentual = z
  .string()
  .optional()
  .transform((v) => Number(String(v ?? "0").replace(",", ".") || 0))
  .refine((v) => Number.isFinite(v) && v >= 0 && v <= 100, "Use um número de 0 a 100.");

export const inteiro = (min: number, max: number, msg: string) =>
  z
    .string()
    .optional()
    .transform((v) => Number(v ?? ""))
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, msg);

/** Data opcional AAAA-MM-DD */
export const dataOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");

export const telefoneOpcional = z
  .string()
  .optional()
  .transform((v) => somenteDigitos(v))
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "Telefone com DDD, ex.: (11) 90000-0000.")
  .transform((v) => (v === "" ? null : v));

export const emailOpcional = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim().toLowerCase())
  .refine((v) => v.length <= 160, "E-mail muito longo.")
  .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido.")
  .transform((v) => (v === "" ? null : v));

/** Checkbox: "on"/"1" → true */
export const caixa = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "1" || v === "true");
