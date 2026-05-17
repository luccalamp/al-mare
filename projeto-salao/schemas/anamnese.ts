/**
 * schemas/anamnese.ts
 * Zod schemas para validação e sanitização dos dados do SalãoApp.
 * O transform() em campos de texto remove caracteres XSS (<, >, ", ') antes de salvar.
 */

import { z } from "zod";

// ---- Sanitizador XSS reutilizável ----
const sanitize = (val: string) =>
  val
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();

/** Campo de texto seguro — aplica sanitização XSS automaticamente */
const safeText = (max = 500) =>
  z
    .string()
    .max(max, `Máximo de ${max} caracteres`)
    .transform(sanitize);

const safeOptionalText = (max = 500) =>
  z
    .string()
    .max(max, `Máximo de ${max} caracteres`)
    .transform(sanitize)
    .optional();

// ---- Redes Sociais ----
export const SocialMediaSchema = z.object({
  instagram: safeOptionalText(100),
  tiktok: safeOptionalText(100),
  facebook: safeOptionalText(100),
  whatsapp: safeOptionalText(20),
});

// ---- Perfil da Cliente ----
export const ClientProfileSchema = z.object({
  name: safeText(120).pipe(z.string().min(2, "Nome deve ter pelo menos 2 caracteres")),
  phone: z
    .string()
    .min(8, "Telefone inválido")
    .max(20)
    .transform(sanitize),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("E-mail inválido")
    .max(200)
    .transform(sanitize)
    .optional()
    .or(z.literal("")),
  socialMedia: SocialMediaSchema.optional().default({}),
  notes: safeOptionalText(1000),
});

// ---- Histórico Químico ----
export const ChemicalHistorySchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  type: z.enum([
    "progressiva",
    "relaxamento",
    "permanente",
    "descoloração",
    "coloração",
    "tonalização",
    "outra",
  ]),
  brand: safeOptionalText(200),
  observations: safeOptionalText(1000),
  technician: safeOptionalText(100),
});

// ---- Ficha Capilar ----
export const HairProfileSchema = z.object({
  structure: z.enum(["liso", "ondulado", "cacheado", "crespo"]),
  thickness: z.enum(["fino", "médio", "grosso"]),
  porosity: z.enum(["baixa", "média", "alta"]),
  scalpCondition: z.enum(["normal", "oleoso", "seco", "sensível"]),
  chemicalHistory: z.array(ChemicalHistorySchema).default([]),
  knownAllergies: z
    .array(
      z.enum(["nenhuma", "amônia", "parabenos", "resorcinol", "ppd", "formaldeído", "outras"])
    )
    .default(["nenhuma"]),
  allergyDetails: safeOptionalText(1000),
  strandTestObservations: safeOptionalText(1000),
  homeCareBrands: safeOptionalText(300),
  homeCareFrequency: safeOptionalText(200),
  lifestyleNotes: safeOptionalText(1000),
});

// ---- Procedimento ----
export const ProcedureSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  type: z.enum([
    "corte",
    "coloração",
    "descoloração",
    "progressiva",
    "hidratação",
    "escova",
    "manicure",
    "pedicure",
    "depilação",
    "sobrancelha",
    "maquiagem",
    "outro",
  ]),
  description: safeText(500).pipe(z.string().min(3, "Descrição muito curta")),
  products: safeOptionalText(300),
  value: z.number().min(0).max(99999).optional(),
  technician: safeOptionalText(100),
  result: z.enum(["ótimo", "bom", "regular", "pendente"]).optional(),
  notes: safeOptionalText(1000),
});

// ---- Schema do Novo Cliente (formulário) ----
export const NewClientSchema = z.object({
  name: safeText(120).pipe(z.string().min(2, "Nome inválido")),
  phone: z.string().min(8, "Telefone inválido").max(20).transform(sanitize),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("E-mail inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? sanitize(v) : undefined)),
  instagram: safeOptionalText(100),
  notes: safeOptionalText(1000),
});

export type NewClientInput = z.infer<typeof NewClientSchema>;
export type ClientProfileInput = z.infer<typeof ClientProfileSchema>;
export type HairProfileInput = z.infer<typeof HairProfileSchema>;
export type ProcedureInput = z.infer<typeof ProcedureSchema>;
export type ChemicalHistoryInput = z.infer<typeof ChemicalHistorySchema>;
