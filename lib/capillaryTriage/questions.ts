import type { CapillaryTriageInput } from "./types";

function isBlank(value?: string) {
  return !value || value.trim().length === 0;
}

export function getPendingTriageQuestions(data: CapillaryTriageInput) {
  const capilar360 = data.capilar360;
  const triagem = capilar360?.triagemQueixa;
  const fatores = capilar360?.fatoresRecentes;
  const rotina = capilar360?.rotinaCapilar;
  const historicoQuimico = capilar360?.historicoQuimico;
  const pending: string[] = [];

  if (!triagem?.queixas || Object.values(triagem.queixas).every((value) => !value)) {
    pending.push("Marcar a queixa principal percebida pela cliente.");
  }

  if (isBlank(triagem?.inicio)) {
    pending.push("Registrar quando a queixa comecou.");
  }

  if (isBlank(triagem?.evolucao)) {
    pending.push("Informar se a evolucao foi subita, gradual, piorou, melhorou ou esta estavel.");
  }

  if (isBlank(fatores?.detalhes) && (!fatores?.fatores || Object.values(fatores.fatores).every((value) => !value))) {
    pending.push("Revisar fatores dos ultimos meses, como estresse, febre, pos-parto, dieta ou cirurgia.");
  }

  if (isBlank(rotina?.frequenciaLavagem) || isBlank(rotina?.produtosUsados)) {
    pending.push("Completar rotina de lavagem e produtos usados em casa.");
  }

  if (isBlank(historicoQuimico?.dataUltimoProcedimento) && !historicoQuimico?.procedimentos) {
    pending.push("Registrar historico quimico e data do ultimo procedimento.");
  }

  return pending.slice(0, 6);
}
