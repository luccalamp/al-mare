import type { FichaAnamneseCapilarDados } from "@/types/anamneseCapilar";

export type TriageAttentionLevel = "baixo" | "moderado" | "alto";

export type TriagePattern = {
  id: string;
  title: string;
  evidence: string[];
  explanation: string;
};

export type TriageRedFlag = {
  id: string;
  title: string;
  evidence: string[];
  recommendation: string;
};

export type CapillaryTriageResult = {
  complaintSummary: string;
  attentionLevel: TriageAttentionLevel;
  patterns: TriagePattern[];
  redFlags: TriageRedFlag[];
  pendingQuestions: string[];
  nextSteps: string[];
  disclaimer: string;
};

export type CapillaryTriageInput = FichaAnamneseCapilarDados;
