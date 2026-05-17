import { Client } from "@/types";

export type ChemicalType =
  | "progressiva"
  | "relaxamento"
  | "permanente"
  | "descoloracao"
  | "coloracao"
  | "tonalizacao"
  | "outra";

export type ProcedureType =
  | "corte"
  | "coloracao"
  | "descoloracao"
  | "progressiva"
  | "hidratacao"
  | "escova"
  | "manicure"
  | "pedicure"
  | "depilacao"
  | "sobrancelha"
  | "maquiagem"
  | "outro";

export type AllergyStatus =
  | "nenhuma"
  | "amonia"
  | "parabenos"
  | "resorcinol"
  | "ppd"
  | "formaldeido"
  | "outras";

export const SAMPLE_CLIENTS: Client[] = [];

export const CHEMICAL_TYPES: { value: ChemicalType; label: string }[] = [
  { value: "progressiva", label: "Progressiva" },
  { value: "relaxamento", label: "Relaxamento" },
  { value: "permanente", label: "Permanente" },
  { value: "descoloracao", label: "Descoloração / Mechas" },
  { value: "coloracao", label: "Coloração" },
  { value: "tonalizacao", label: "Tonalização" },
  { value: "outra", label: "Outra" },
];

export const PROCEDURE_TYPES: { value: ProcedureType; label: string }[] = [
  { value: "corte", label: "Corte" },
  { value: "coloracao", label: "Coloração" },
  { value: "descoloracao", label: "Descoloração / Mechas" },
  { value: "progressiva", label: "Progressiva" },
  { value: "hidratacao", label: "Hidratação" },
  { value: "escova", label: "Escova" },
  { value: "manicure", label: "Manicure" },
  { value: "pedicure", label: "Pedicure" },
  { value: "depilacao", label: "Depilação" },
  { value: "sobrancelha", label: "Sobrancelha" },
  { value: "maquiagem", label: "Maquiagem" },
  { value: "outro", label: "Outro" },
];

export const ALLERGY_OPTIONS: { value: AllergyStatus; label: string }[] = [
  { value: "nenhuma", label: "Nenhuma alergia conhecida" },
  { value: "amonia", label: "Amônia" },
  { value: "parabenos", label: "Parabenos" },
  { value: "resorcinol", label: "Resorcinol" },
  { value: "ppd", label: "PPD (Parafenilenodiamina)" },
  { value: "formaldeido", label: "Formaldeído / Formol" },
  { value: "outras", label: "Outras (especificar)" },
];
