import type { FichaCapilar360MapaCouroCabeludo } from "@/types/anamneseCapilar";
import { TRIAGE_PATTERN_COPY } from "./knowledge";
import type { CapillaryTriageInput, TriagePattern } from "./types";

function hasBoolean(map: Record<string, boolean | undefined> | undefined, keys: string[]) {
  return keys.some((key) => Boolean(map?.[key]));
}

function includesAny(value: string | undefined, tokens: string[]) {
  const normalized = (value || "").toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function hasScalpFinding(mapa: FichaCapilar360MapaCouroCabeludo | undefined, keys: string[]) {
  if (!mapa) return false;
  return Object.values(mapa).some((region) => hasBoolean(region?.achados, keys));
}

function pattern(id: keyof typeof TRIAGE_PATTERN_COPY, evidence: string[]): TriagePattern {
  const copy = TRIAGE_PATTERN_COPY[id];
  return {
    id,
    title: copy.title,
    explanation: copy.explanation,
    evidence,
  };
}

export function detectTriagePatterns(data: CapillaryTriageInput): TriagePattern[] {
  const capilar360 = data.capilar360;
  const triagem = capilar360?.triagemQueixa;
  const fatores = capilar360?.fatoresRecentes;
  const rotina = capilar360?.rotinaCapilar;
  const historicoQuimico = capilar360?.historicoQuimico;
  const patterns: TriagePattern[] = [];

  if (
    hasBoolean(triagem?.queixas, ["queda"]) &&
    (includesAny(triagem?.quedaRaizOuQuebra, ["raiz"]) || hasBoolean(fatores?.fatores, ["estresse", "febreInfeccao", "posParto", "cirurgia", "dietaRestritiva", "perdaPeso"]))
  ) {
    patterns.push(pattern("diffuseShedding", ["Queda marcada na triagem.", "Fatores recentes ou queda pela raiz foram informados."]));
  }

  if (
    hasBoolean(triagem?.queixas, ["afinamento", "crescimentoLento"]) ||
    hasScalpFinding(capilar360?.mapaCouroCabeludo, ["afinamento", "baixaDensidade"])
  ) {
    patterns.push(pattern("patternThinning", ["Afinamento, baixa densidade ou crescimento lento aparecem no registro."]));
  }

  if (hasBoolean(triagem?.queixas, ["falhas"]) || includesAny(data.queixaPrincipal, ["falha", "placa", "buraco"])) {
    patterns.push(pattern("patchyLoss", ["Falhas localizadas foram registradas."]));
  }

  if (includesAny(rotina?.penteadosApertados, ["sim", "frequente", "apertado"]) || includesAny(data.habitos?.penteadosComTracao, ["sim", "tranca", "rabo", "apertado"])) {
    patterns.push(pattern("traction", ["Rotina com tracao ou penteados apertados foi informada."]));
  }

  if (
    hasBoolean(triagem?.queixas, ["coceira", "ardencia", "dor", "descamacaoCaspa", "oleosidade"]) ||
    hasScalpFinding(capilar360?.mapaCouroCabeludo, ["vermelhidao", "coceira", "ardencia", "dor", "descamacao"])
  ) {
    patterns.push(pattern("scalpInflammation", ["Sinais de sensibilidade, descamacao ou desconforto no couro cabeludo foram marcados."]));
  }

  if (
    hasBoolean(historicoQuimico?.procedimentos, ["mechas", "descoloracao", "progressiva", "relaxamento", "hene"]) ||
    includesAny(historicoQuimico?.quebraAposQuimica, ["sim", "quebra"]) ||
    includesAny(triagem?.quedaRaizOuQuebra, ["quebra"])
  ) {
    patterns.push(pattern("chemicalDamage", ["Historico quimico ou quebra de comprimento aparece no registro."]));
  }

  if (hasBoolean(triagem?.queixas, ["oleosidade", "descamacaoCaspa", "coceira"]) || hasScalpFinding(capilar360?.mapaCouroCabeludo, ["oleosidade", "descamacao"])) {
    patterns.push(pattern("seborrheicPattern", ["Oleosidade, descamacao ou coceira aparecem na ficha."]));
  }

  return patterns;
}
