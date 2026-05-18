export const CAPILLARY_THERAPY_PAYMENT_POLICY = {
  upfrontDiscountPercent: 10,
  maxInstallments: 4,
  creditLabel: "Cartao de credito em ate 4x",
  upfrontLabel: "A vista com 10% de desconto",
} as const;

export const CAPILLARY_THERAPY_PDFS = [
  {
    id: "manual",
    title: "Manual de Terapia Capilar",
    description: "Orientacoes sobre consulta, avaliacao e condução das sessoes.",
    href: "/pdfs/Manual_Terapia_Capilar_Jak_Oliveira_Atualizado.pdf",
  },
  {
    id: "budget",
    title: "Orcamento Terapia Capilar",
    description: "Consulta, sessao avulsa, pacotes e kit home care alinhados ao PDF.",
    href: "/pdfs/Orcamento_Terapia_Capilar_Jak_Oliveira.pdf",
  },
] as const;

export const CAPILLARY_THERAPY_MANUAL_TOPICS = [
  "Saude do couro cabeludo",
  "Historico capilar",
  "Grau de queda ou oleosidade",
  "Sensibilidade e alteracoes capilares",
  "Qualidade dos fios",
] as const;

export const CAPILLARY_THERAPY_SESSION_STEPS = [
  "Higienizacao",
  "Aplicacao de ativos",
  "Massagens terapeuticas",
  "Uso de aparelhos",
  "Tratamento para os fios",
] as const;

export type CapillaryTherapyBudgetPreset = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly value: number;
  readonly tecnicaUtilizada: string;
  readonly notes: string;
};

export const CAPILLARY_THERAPY_BUDGET_PRESETS: readonly CapillaryTherapyBudgetPreset[] = [
  {
    id: "consulta",
    title: "Consulta",
    description: "Triagem + exame de tricoscopia",
    value: 250,
    tecnicaUtilizada: "Consulta capilar",
    notes: "Consulta de triagem com exame de tricoscopia.",
  },
  {
    id: "sessao-unica",
    title: "1 sessao",
    description: "Sessao avulsa de terapia capilar",
    value: 220,
    tecnicaUtilizada: "Sessao de terapia capilar",
    notes: "Sessao individual de terapia capilar.",
  },
  {
    id: "pacote-4",
    title: "Pacote 4 sessoes",
    description: "Tratamento fechado com 4 sessoes",
    value: 800,
    tecnicaUtilizada: "Pacote terapia capilar 4 sessoes",
    notes: "Pacote terapeutico com 4 sessoes de terapia capilar.",
  },
  {
    id: "pacote-8",
    title: "Pacote 8 sessoes",
    description: "Tratamento fechado com 8 sessoes",
    value: 1500,
    tecnicaUtilizada: "Pacote terapia capilar 8 sessoes",
    notes: "Pacote terapeutico com 8 sessoes de terapia capilar.",
  },
  {
    id: "pacote-12",
    title: "Pacote 12 sessoes",
    description: "Tratamento fechado com 12 sessoes",
    value: 2100,
    tecnicaUtilizada: "Pacote terapia capilar 12 sessoes",
    notes: "Pacote terapeutico com 12 sessoes de terapia capilar.",
  },
] as const;