import { TRIAGE_DISCLAIMER } from "./knowledge";
import { getPendingTriageQuestions } from "./questions";
import { detectTriageRedFlags } from "./redFlags";
import { detectTriagePatterns } from "./rules";
import type { CapillaryTriageInput, CapillaryTriageResult, TriageAttentionLevel } from "./types";

const COMPLAINT_LABELS: Record<string, string> = {
  queda: "queda",
  quebra: "quebra",
  oleosidade: "oleosidade",
  descamacaoCaspa: "descamacao/caspa",
  coceira: "coceira",
  ardencia: "ardencia",
  dor: "dor",
  falhas: "falhas",
  afinamento: "afinamento",
  crescimentoLento: "crescimento lento",
  danoQuimico: "dano quimico",
  manutencaoPreventiva: "manutencao preventiva",
};

function getSelectedComplaints(data: CapillaryTriageInput) {
  const queixas = data.capilar360?.triagemQueixa?.queixas || {};
  return Object.entries(queixas)
    .filter(([, checked]) => checked)
    .map(([key]) => COMPLAINT_LABELS[key] || key);
}

function buildComplaintSummary(data: CapillaryTriageInput) {
  const complaints = getSelectedComplaints(data);
  const legacyComplaint = data.queixaPrincipal?.trim();
  const start = data.capilar360?.triagemQueixa?.inicio?.trim();
  const evolution = data.capilar360?.triagemQueixa?.evolucao?.trim();

  if (complaints.length === 0 && !legacyComplaint) {
    return "A queixa principal ainda nao foi detalhada na Ficha Capilar 360.";
  }

  const pieces = [
    complaints.length ? `Queixa registrada: ${complaints.join(", ")}.` : undefined,
    legacyComplaint ? `Relato livre: ${legacyComplaint}` : undefined,
    start ? `Inicio informado: ${start}.` : undefined,
    evolution ? `Evolucao: ${evolution}.` : undefined,
  ].filter(Boolean);

  return pieces.join(" ");
}

function getAttentionLevel(redFlagCount: number, patternCount: number, pendingQuestionCount: number): TriageAttentionLevel {
  if (redFlagCount > 0) return "alto";
  if (patternCount >= 3 || pendingQuestionCount >= 4) return "moderado";
  if (patternCount >= 1) return "moderado";
  return "baixo";
}

function getNextSteps(result: {
  level: TriageAttentionLevel;
  hasRedFlags: boolean;
  hasChemicalPattern: boolean;
  pendingQuestionCount: number;
}) {
  const steps: string[] = [];

  if (result.pendingQuestionCount > 0) {
    steps.push("Completar as perguntas pendentes antes de fechar o plano de cuidado.");
  }

  if (result.hasRedFlags) {
    steps.push("Considerar avaliacao dermatologica antes de procedimentos quimicos ou protocolos intensivos.");
  }

  if (result.hasChemicalPattern) {
    steps.push("Priorizar teste de mecha, registro fotografico e conduta conservadora para preservar a fibra.");
  }

  steps.push("Registrar fotos padronizadas e comparar evolucao a cada sessao.");
  steps.push("Revisar home care, frequencia de lavagem e habitos que possam irritar o couro cabeludo.");

  if (result.level === "baixo") {
    steps.unshift("Seguir com acompanhamento profissional e observacao da evolucao.");
  }

  return Array.from(new Set(steps)).slice(0, 5);
}

export function analyzeCapillaryTriage(data: CapillaryTriageInput): CapillaryTriageResult {
  const patterns = detectTriagePatterns(data);
  const redFlags = detectTriageRedFlags(data);
  const pendingQuestions = getPendingTriageQuestions(data);
  const attentionLevel = getAttentionLevel(redFlags.length, patterns.length, pendingQuestions.length);
  const hasChemicalPattern = patterns.some((item) => item.id === "chemicalDamage");

  return {
    complaintSummary: buildComplaintSummary(data),
    attentionLevel,
    patterns,
    redFlags,
    pendingQuestions,
    nextSteps: getNextSteps({
      level: attentionLevel,
      hasRedFlags: redFlags.length > 0,
      hasChemicalPattern,
      pendingQuestionCount: pendingQuestions.length,
    }),
    disclaimer: TRIAGE_DISCLAIMER,
  };
}
