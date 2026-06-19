import type { FichaCapilar360MapaCouroCabeludo } from "@/types/anamneseCapilar";
import type { CapillaryTriageInput, TriageRedFlag } from "./types";

function hasBoolean(map: Record<string, boolean | undefined> | undefined, keys: string[]) {
  return keys.some((key) => Boolean(map?.[key]));
}

function includesAny(value: string | undefined, tokens: string[]) {
  const normalized = (value || "").toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function collectScalpFindings(mapa?: FichaCapilar360MapaCouroCabeludo) {
  if (!mapa) return [];
  return Object.entries(mapa).flatMap(([region, value]) =>
    Object.entries(value?.achados || {})
      .filter(([, checked]) => checked)
      .map(([finding]) => `${region}:${finding}`)
  );
}

export function detectTriageRedFlags(data: CapillaryTriageInput): TriageRedFlag[] {
  const capilar360 = data.capilar360;
  const triagem = capilar360?.triagemQueixa;
  const fatores = capilar360?.fatoresRecentes;
  const historicoQuimico = capilar360?.historicoQuimico;
  const findings = collectScalpFindings(capilar360?.mapaCouroCabeludo);
  const redFlags: TriageRedFlag[] = [];

  if (hasBoolean(triagem?.queixas, ["falhas"]) || includesAny(data.queixaPrincipal, ["falha", "placa", "buraco"])) {
    redFlags.push({
      id: "patchy-loss",
      title: "Falhas ou placas localizadas",
      evidence: ["Relato ou marcacao de falhas no couro cabeludo."],
      recommendation: "Considerar avaliacao dermatologica se o achado for subito, circular, progressivo ou recorrente.",
    });
  }

  if (hasBoolean(triagem?.queixas, ["ardencia", "dor"]) || findings.some((item) => /feridas|crostas|dor|ardencia/.test(item))) {
    redFlags.push({
      id: "pain-lesion",
      title: "Dor, ardencia, feridas ou crostas",
      evidence: ["Sinais de desconforto ou lesao no couro cabeludo foram informados."],
      recommendation: "Evitar procedimentos agressivos e considerar avaliacao dermatologica antes de seguir.",
    });
  }

  if (findings.some((item) => /vermelhidao|feridas|crostas/.test(item)) && findings.some((item) => /descamacao/.test(item))) {
    redFlags.push({
      id: "inflammatory-scaling",
      title: "Descamacao com sinais inflamatorios",
      evidence: ["Descamacao associada a vermelhidao, feridas ou crostas no mapa do couro cabeludo."],
      recommendation: "Registrar fotos, evitar irritantes e considerar avaliacao dermatologica se persistente ou intensa.",
    });
  }

  if (hasBoolean(fatores?.fatores, ["febreInfeccao", "cirurgia", "perdaPeso", "dietaRestritiva"])) {
    redFlags.push({
      id: "recent-systemic-trigger",
      title: "Evento sistemico recente",
      evidence: ["Ha fator recente que pode estar associado a queda difusa."],
      recommendation: "Revisar exames e historico de saude com a profissional responsavel antes de prometer resultados.",
    });
  }

  if (includesAny(historicoQuimico?.corteQuimico, ["sim", "intenso"]) || includesAny(historicoQuimico?.quebraAposQuimica, ["sim", "muita", "intensa"])) {
    redFlags.push({
      id: "chemical-breakage",
      title: "Quebra importante apos quimica",
      evidence: ["Historico sugere fragilidade ou ruptura de fibra."],
      recommendation: "Priorizar teste de mecha, pausa em quimicas fortes e plano reconstrutor conservador.",
    });
  }

  return redFlags;
}
