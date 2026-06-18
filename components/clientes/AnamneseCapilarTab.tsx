"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Client } from "@/types";
import type { FichaAnamneseAssinatura, FichaAnamneseCapilarDados } from "@/types/anamneseCapilar";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import type { BrandingConfig } from "@/lib/brandingConfig";
import { Loader2, Printer, Save } from "lucide-react";

const inp =
  "w-full rounded-2xl border border-white/50 bg-white/40 px-3 py-2 text-sm text-[#1d1d1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#7a4921]/20";
const lab = "block text-[10px] font-bold uppercase tracking-wide text-[#6e6e73]";
const sub = "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]";

const SIM_NAO_OPTIONS = [
  { value: "", label: "—" },
  { value: "Sim", label: "Sim" },
  { value: "Não", label: "Não" },
];

const QUEDA_ACENTUADA_OPTIONS = [
  { key: "ausente", label: "Ausente" },
  { key: "presente", label: "Presente" },
  { key: "localizada", label: "Localizada" },
  { key: "difusa", label: "Difusa" },
];

const AFINAMENTO_DA_HASTE_OPTIONS = [
  { key: "ausente", label: "Ausente" },
  { key: "presente", label: "Presente" },
];

const INFLAMACAO_OPTIONS = [
  { key: "ausente", label: "Ausente" },
  { key: "presente", label: "Presente" },
];

const OSTIOS_FOLICULARES_OPTIONS = [
  { key: "preto", label: "Preto" },
  { key: "branco", label: "Branco" },
  { key: "amarelo", label: "Amarelo" },
  { key: "vermelho", label: "Vermelho" },
  { key: "cinzaAzulado", label: "Cinza/azulado" },
];

const EPIDERME_DESCAMACAO_OPTIONS = [
  { key: "descamacaoAusente", label: "Descamação ausente" },
  { key: "descamacaoLocalizada", label: "Descamação localizada" },
  { key: "descamacaoDifusa", label: "Descamação difusa" },
  { key: "descamacaoPerifolicular", label: "Descamação perifolicular" },
];

const EPIDERME_COLORACAO_OPTIONS = [
  { key: "corCastanha", label: "Cor castanha" },
  { key: "corRosa", label: "Rosa" },
  { key: "corVermelha", label: "Vermelha" },
  { key: "corBranca", label: "Branca" },
  { key: "corAmarela", label: "Amarela" },
  { key: "corAzulViolaceo", label: "Azul/vioáceo" },
];

const ALOPECIA_CARACTERISTICA_OPTIONS = [
  { key: "aag", label: "AAG" },
  { key: "aaSubtipo", label: "AA subtipo" },
  { key: "etAgudo", label: "ET agudo" },
  { key: "etCronico", label: "ET crônico" },
  { key: "tricotilomania", label: "Tricotilomania" },
  { key: "alopeciaCicatricial", label: "Alopecia cicatricial" },
  { key: "inconclusivo", label: "Inconclusivo" },
];

const NORWOOD_OPTIONS = [
  { value: "", label: "—" },
  { value: "I", label: "I" },
  { value: "II", label: "II" },
  { value: "III", label: "III" },
  { value: "Vertex", label: "Vertex" },
  { value: "IV", label: "IV" },
  { value: "V", label: "V" },
  { value: "VI", label: "VI" },
  { value: "VII", label: "VII" },
];

const LUDWIG_OPTIONS = [
  { value: "", label: "—" },
  { value: "I", label: "Grau I (mínima)" },
  { value: "II", label: "Grau II (moderada)" },
  { value: "III", label: "Grau III (intensa)" },
];

const SAVIN_OPTIONS = [
  { value: "", label: "—" },
  { value: "I-1", label: "I-1" },
  { value: "I-2", label: "I-2" },
  { value: "I-3", label: "I-3" },
  { value: "I-4", label: "I-4" },
  { value: "II-1", label: "II-1" },
  { value: "II-2", label: "II-2" },
  { value: "III", label: "III" },
  { value: "Advanced", label: "Advanced" },
  { value: "Frontal", label: "Frontal" },
];

type FeedbackState = {
  tone: "success" | "error";
  text: string;
};

type CheckboxOption = {
  key: string;
  label: string;
};

type PrintRow = [string, string | undefined];

type LegacyFichaAnamneseCapilarDados = {
  identificacao?: {
    nome?: string;
    dataNascimento?: string;
    endereco?: string;
    cidadeEstado?: string;
    celular?: string;
    email?: string;
    profissao?: string;
  };
  queixa?: {
    queixaPrincipal?: string;
    alteracaoOutrasAreas?: boolean;
    alteracaoOutrasAreasQuais?: string;
    fazQuantoTempo?: string;
    problemaEvolucao?: "estavel" | "aumentando" | "diminuindo" | "";
    cabeloFicou?: {
      maisFino?: boolean;
      maisQuebradico?: boolean;
    };
    couroCabeludo?: {
      dor?: boolean;
      coceira?: boolean;
      inflamacao?: boolean;
      caspa?: boolean;
      descamacao?: boolean;
    };
    outrasCrises?: boolean;
    quandoOutrasCrises?: string;
  };
  historicoPessoal?: {
    doencaAtual?: boolean;
    doencaAtualQual?: string;
    problemaEndocrino?: boolean;
    problemaEndocrinoQual?: string;
    medicacao?: boolean;
    medicacaoQual?: string;
    alergia?: boolean;
    alergiaQual?: string;
    filhos?: boolean;
    periodicidadeLavagem?: string;
    cosmeticosCapilares?: string;
    alteracaoMenstrualQual?: string;
    familiaCalvicieMulheres?: string;
    familiaCalvicieHomens?: string;
    familiaCalvicieOutros?: string;
    mesesAnteriores?: {
      detalhes?: string;
    };
  };
  cuidadosCabelos?: {
    fazQuimica?: boolean;
    fazQuimicaQual?: string;
    fazQuimicaFrequencia?: string;
    usa?: {
      escovacao?: boolean;
      pranchaTermica?: boolean;
      penteadosPresos?: boolean;
    };
  };
  exameFisico?: {
    reposicaoFios?: boolean;
    presenca?: {
      entradas?: boolean;
    };
    alopeciaAreataCicatricial?: {
      localizacao?: string;
    };
  };
  conclusao?: {
    alteracaoEncontrada?: string;
    protocoloIndicado?: string;
  };
  assinatura?: FichaAnamneseAssinatura;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value?: string) {
  if (!value) return "";

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return value;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function boolToText(value?: boolean) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "";
}

function joinTexts(values: Array<string | undefined>) {
  return values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" | ");
}

function formatCheckedLabels(options: CheckboxOption[], value?: Record<string, boolean | undefined>) {
  return options.filter((option) => Boolean(value?.[option.key])).map((option) => option.label).join(", ");
}

function renderPrintValue(value?: string) {
  const normalized = value?.trim() ?? "";
  return normalized ? escapeHtml(normalized).replace(/\n/g, "<br />") : "&nbsp;";
}

function renderPrintHeading(title: string) {
  return `
    <section class="print-divider">
      <h2>${escapeHtml(title)}</h2>
    </section>
  `;
}

function renderPrintSection(title: string, rows: PrintRow[], columns = 1) {
  return `
    <section class="print-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="print-fields print-cols-${columns}">
        ${rows
          .map(
            ([label, value]) => `
              <article class="print-field">
                <span class="print-label">${escapeHtml(label)}</span>
                <div class="print-value">${renderPrintValue(value)}</div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPrintLongTextSection(title: string, value?: string, minHeight = 120) {
  return `
    <section class="print-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="print-long-value" style="min-height: ${minHeight}px;">${renderPrintValue(value)}</div>
    </section>
  `;
}

function buildPrintHtml(client: Client, dados: FichaAnamneseCapilarDados, branding: BrandingConfig) {
  const dadosPessoais = dados.dadosPessoais;
  const dadosClinicos = dados.dadosClinicos;
  const quedaAcentuada = dadosClinicos?.quedaAcentuada;
  const afinamentoHaste = dadosClinicos?.afinamentoHaste;
  const inflamacao = dadosClinicos?.inflamacao;
  const tratamentosAnteriores = dados.tratamentosAnteriores;
  const historicoSaudeGeral = dados.historicoSaudeGeral;
  const habitos = dados.habitos;
  const historicoFamiliar = dados.historicoFamiliar;
  const exameFisico = dados.exameFisico;
  const tricoscopia = dados.tricoscopia;
  const classificacaoAag = dados.classificacaoAag;
  const epiderme = tricoscopia?.epidermePeriInterfolicular;
  const alopeciaCaracteristica = tricoscopia?.alopeciaCaracteristica;
  const patientName = dadosPessoais?.nome?.trim() || client.profile.nome;

  const sections = [
    renderPrintSection(
      "DADOS PESSOAIS",
      [
        ["Nome", dadosPessoais?.nome ?? client.profile.nome],
        ["Sexo", dadosPessoais?.sexo],
        ["Data de nascimento", formatDate(dadosPessoais?.dataNascimento)],
        ["Endereço", dadosPessoais?.endereco],
        ["Cidade", dadosPessoais?.cidade],
        ["Profissão", dadosPessoais?.profissao],
        ["E-mail", dadosPessoais?.email],
        ["Celular", dadosPessoais?.celular],
        ["Filhos", dadosPessoais?.filhos],
      ],
      2
    ),
    renderPrintLongTextSection("QUEIXA PRINCIPAL", dados.queixaPrincipal, 120),
    renderPrintHeading("DADOS CLÍNICOS"),
    renderPrintSection("QUEDA ACENTUADA", [
      ["Estado", formatCheckedLabels(QUEDA_ACENTUADA_OPTIONS, quedaAcentuada as Record<string, boolean | undefined> | undefined)],
      ["Há quanto tempo?", quedaAcentuada?.haQuantoTempo],
      ["Tiveram períodos que a queda cessou e depois voltou?", quedaAcentuada?.periodosCessouVoltou],
      ["Os fios que caem estão sendo substituídos?", quedaAcentuada?.fiosSendoSubstituidos],
      ["Como começou? Houve algum evento marcante?", quedaAcentuada?.eventoMarcante],
      ["Houve perda de volume? Qual a intensidade?", quedaAcentuada?.perdaVolumeIntensidade],
      ["Há perda de pelos em outras partes do corpo?", quedaAcentuada?.perdaPelosCorpo],
    ]),
    renderPrintSection("AFINAMENTO DA HASTE", [
      ["Estado", formatCheckedLabels(AFINAMENTO_DA_HASTE_OPTIONS, afinamentoHaste as Record<string, boolean | undefined> | undefined)],
      ["Há quanto tempo?", afinamentoHaste?.haQuantoTempo],
      ["Casos de calvície na família? Qual o parentesco?", afinamentoHaste?.casosCalvicieFamiliaParentesco],
    ]),
    renderPrintSection("INFLAMAÇÃO", [
      ["Estado", formatCheckedLabels(INFLAMACAO_OPTIONS, inflamacao as Record<string, boolean | undefined> | undefined)],
      ["Intensidade", inflamacao?.intensidade],
      ["Sente coceira no couro cabeludo?", inflamacao?.coceiraCouroCabeludo],
      ["Sente dor no couro cabeludo? Com que frequência?", inflamacao?.dorCouroCabeludoFrequencia],
      ["Descamação? Presença de caspa?", inflamacao?.descamacaoCaspa],
      ["Dermatite seborreica?", inflamacao?.dermatiteSeborreica],
    ]),
    renderPrintSection("TRATAMENTOS ANTERIORES", [
      ["Já foi previamente diagnosticado por um médico? Qual foi o diagnóstico?", tratamentosAnteriores?.diagnosticoMedicoPrevio],
      ["Já realizou algum tratamento? Usou algum medicamento antes? Qual?", tratamentosAnteriores?.tratamentosEMedicamentosPrevios],
      ["Os medicamentos/suplementos usados foram de indicação profissional? Obteve resultado?", tratamentosAnteriores?.indicacaoProfissionalEResultados],
    ]),
    renderPrintSection("HISTÓRICO DE SAÚDE GERAL", [
      ["Possui algum problema de saúde atual? Qual(is)?", historicoSaudeGeral?.problemaSaudeAtual],
      ["Possui alguma doença crônica? Qual(is)?", historicoSaudeGeral?.doencaCronica],
      ["Hipertensão", historicoSaudeGeral?.hipertensao],
      ["Diabetes", historicoSaudeGeral?.diabetes],
      ["Arritmia", historicoSaudeGeral?.arritmia],
      ["Doença autoimune? Qual(is)?", historicoSaudeGeral?.doencaAutoimune],
      ["Possui algum problema renal/hepático/gastrintestinal? Qual(is)?", historicoSaudeGeral?.problemaRenalHepaticoGastrintestinal],
      ["Possui algum problema neurológico? Qual(is)?", historicoSaudeGeral?.problemaNeurologico],
      ["Possui algum problema de circulação/histórico de trombose/embolia? Qual(is)?", historicoSaudeGeral?.problemaCirculacaoTromboseEmbolia],
      ["Possui alguma desregulação hormonal? Qual?", historicoSaudeGeral?.desregulacaoHormonal],
      ["Faz uso de anticoncepcional? Qual?", historicoSaudeGeral?.anticoncepcional],
      ["Toma algum medicamento contínuo? Qual(is)? Há quanto tempo toma?", historicoSaudeGeral?.medicamentoContinuo],
      ["Fez algum tratamento medicamentoso no último ano?", historicoSaudeGeral?.tratamentoMedicamentosoUltimoAno],
      ["Está tomando algum medicamento diferente no momento? Qual(is)?", historicoSaudeGeral?.medicamentoAtualDiferente],
      ["Possui alguma alergia? Qual(is)?", historicoSaudeGeral?.alergia],
      ["Histórico de cirurgias? Qual(is)? Quando?", historicoSaudeGeral?.historicoCirurgias],
      ["Gestante", historicoSaudeGeral?.gestante],
      ["Lactante", historicoSaudeGeral?.lactante],
      ["Menopausa", historicoSaudeGeral?.menopausa],
      ["Menstruação (ciclo, fluxo)?", historicoSaudeGeral?.menstruacao],
      ["Síndrome do ovário policístico?", historicoSaudeGeral?.sindromeOvarioPolicistico],
      ["Peso", historicoSaudeGeral?.peso],
      ["Resultado de exames laboratoriais", historicoSaudeGeral?.examesLaboratoriais],
    ]),
    renderPrintSection("HÁBITOS", [
      ["Com que frequência lava os cabelos?", habitos?.frequenciaLavagem],
      ["Costuma usar secador/chapinha? Com que frequência?", habitos?.usoSecadorChapinha],
      ["Faz alisamento? Qual? Tipo? Frequência?", habitos?.alisamentoQualTipoFrequencia],
      ["Quais produtos usa no cabelo?", habitos?.produtosNoCabelo],
      ["Usa rabo de cavalo/trança/ou qualquer outro penteado que cause tração?", habitos?.penteadosComTracao],
      ["Sente dor decorrente dessa tração?", habitos?.dorDecorrenteDaTracao],
      ["Já fez implante/transplante capilar? Quando?", habitos?.implanteOuTransplanteCapilar],
      ["Fumante?", habitos?.fumante],
      ["Faz consumo de bebida alcoólica?", habitos?.bebidaAlcoolica],
      ["Faz exercício físico? Qual? Qual frequência?", habitos?.exercicioFisico],
      ["Alimentação?", habitos?.alimentacao],
      ["Costuma tomar quantos copos de água por dia?", habitos?.coposDeAguaPorDia],
      ["Quantas horas de sono dorme por noite?", habitos?.horasDeSono],
      ["Se julga uma pessoa estressada?", habitos?.pessoaEstressada],
      ["Se julga uma pessoa ansiosa?", habitos?.pessoaAnsiosa],
    ]),
    renderPrintSection("HISTÓRICO FAMILIAR", [
      ["Casos de calvície na família?", historicoFamiliar?.casosCalvicieFamilia],
      ["Casos de alopecia areata ou outras doenças autoimunes na família?", historicoFamiliar?.alopeciaAreataOuAutoimunesFamilia],
      ["Doenças congênitas da haste?", historicoFamiliar?.doencasCongenitasDaHaste],
    ]),
    renderPrintSection(
      "EXAME FÍSICO",
      [
        ["Pull Test", exameFisico?.pullTest],
        ["Card Test", exameFisico?.cardTest],
        ["Tug Test", exameFisico?.tugTest],
        ["Wash Test", exameFisico?.washTest],
      ],
      2
    ),
    renderPrintSection("TRICOSCOPIA", [
      ["Óstios foliculares", formatCheckedLabels(OSTIOS_FOLICULARES_OPTIONS, tricoscopia?.ostiosFoliculares as Record<string, boolean | undefined> | undefined)],
      [
        "Epiderme peri/interfolicular",
        joinTexts([
          epiderme?.normal ? "Normal" : "",
          formatCheckedLabels(EPIDERME_DESCAMACAO_OPTIONS, epiderme as Record<string, boolean | undefined> | undefined),
          formatCheckedLabels(EPIDERME_COLORACAO_OPTIONS, epiderme as Record<string, boolean | undefined> | undefined),
        ]),
      ],
      [
        "Alopecia característica",
        formatCheckedLabels(ALOPECIA_CARACTERISTICA_OPTIONS, alopeciaCaracteristica as Record<string, boolean | undefined> | undefined),
      ],
      ["AA subtipo", alopeciaCaracteristica?.aaSubtipoDescricao],
      ["OBS", tricoscopia?.observacoes],
    ]),
    renderPrintSection(
      "CLASSIFICAÇÃO DA AAG",
      [
        ["Escala de Norwood-Hamilton", classificacaoAag?.norwoodHamilton],
        ["Escala de Ludwig", classificacaoAag?.ludwig],
        ["Escala de Savin", classificacaoAag?.savin],
      ],
      3
    ),
    renderPrintLongTextSection("DIAGNÓSTICO CLÍNICO", dados.diagnosticoClinico, 140),
    renderPrintLongTextSection("CONDUTA PRESCRITA", dados.condutaPrescrita, 160),
  ].join("");

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(branding.clinicalRecordLabel)} - ${escapeHtml(patientName)}</title>
        <style>
          :root {
            color-scheme: light;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 26px;
            font-family: "Segoe UI", Arial, sans-serif;
            color: #1d1d1f;
            background: #f5f1ea;
          }
          .print-shell {
            max-width: 980px;
            margin: 0 auto;
            background: #fffdf9;
            border: 1px solid #e7dccd;
            border-radius: 24px;
            padding: 28px;
          }
          .print-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 18px;
            padding-bottom: 20px;
            border-bottom: 2px solid #dcc5a7;
            margin-bottom: 24px;
            text-align: center;
          }
          .print-brand {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .print-logo {
            max-width: 180px;
            height: auto;
            margin-bottom: 4px;
          }
          .brand-wordmark {
            color: #7a4921;
            font-family: "Georgia", "Times New Roman", serif;
            font-size: 36px;
            letter-spacing: 0.12em;
            line-height: 0.95;
            text-transform: uppercase;
          }
          .brand-subtitle {
            color: #9a6d3a;
            font-size: 11px;
            letter-spacing: 0.32em;
            text-transform: uppercase;
            font-weight: 700;
          }
          .print-eyebrow {
            margin: 0;
            font-size: 12px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #9a6d3a;
            font-weight: 700;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            line-height: 1.2;
          }
          .print-meta {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            text-align: left;
            font-size: 13px;
            color: #5a5348;
          }
          .print-meta-card {
            border: 1px solid #eadfce;
            border-radius: 14px;
            padding: 12px 14px;
            background: #fff;
          }
          .print-divider {
            margin: 26px 0 10px;
            page-break-inside: avoid;
          }
          .print-section {
            margin-bottom: 22px;
            page-break-inside: avoid;
          }
          .print-section h2,
          .print-divider h2 {
            margin: 0 0 12px;
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #354754;
            text-align: center;
          }
          .print-fields {
            display: grid;
            gap: 12px;
          }
          .print-cols-1 {
            grid-template-columns: 1fr;
          }
          .print-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .print-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .print-field {
            page-break-inside: avoid;
          }
          .print-label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.4;
            color: #1d1d1f;
          }
          .print-value,
          .print-long-value {
            margin-top: 6px;
            padding: 8px 0 10px;
            border-bottom: 1px solid #6b7280;
            font-size: 14px;
            line-height: 1.5;
            white-space: normal;
            word-break: break-word;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          @media print {
            body {
              padding: 0;
              background: white;
            }
            .print-shell {
              max-width: none;
              border: none;
              border-radius: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <main class="print-shell">
          <header class="print-header">
            <div class="print-brand">
              <img src="${escapeHtml(window.location.origin + "/logo-al.png")}" alt="Logo" class="print-logo" />
              <div class="brand-wordmark">${escapeHtml(branding.clinicName)}</div>
              <div class="brand-subtitle">${escapeHtml(branding.clinicSubtitle)}</div>
              <p class="print-eyebrow">${escapeHtml(branding.clinicalRecordLabel)}</p>
              <h1>Ficha de Anamnese e Avaliação Clínica do Cabelo e Couro Cabeludo</h1>
            </div>
            <div class="print-meta">
              <div class="print-meta-card"><strong>Paciente:</strong><br />${escapeHtml(patientName)}</div>
              <div class="print-meta-card"><strong>WhatsApp:</strong><br />${escapeHtml(dadosPessoais?.celular ?? client.profile.whatsapp ?? "—")}</div>
              <div class="print-meta-card"><strong>Gerado em:</strong><br />${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
            </div>
          </header>
          ${sections}
        </main>
      </body>
    </html>
  `;
}

function writePrintPreview(
  printWindow: Window,
  client: Client,
  dados: FichaAnamneseCapilarDados,
  branding: BrandingConfig
) {
  try {
    const htmlContent = buildPrintHtml(client, dados, branding);
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (printError) {
        console.error("Erro ao iniciar impressão:", printError);
      }
    }, 250);
  } catch (error) {
    console.error("Erro ao gerar prévia de impressão:", error);
    printWindow.close();
    throw error;
  }
}

function openPrintPreview(
  client: Client,
  dados: FichaAnamneseCapilarDados,
  branding: BrandingConfig,
  existingWindow?: Window | null
) {
  const printWindow = existingWindow ?? window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.");
  }

  writePrintPreview(printWindow, client, dados, branding);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-[var(--color-brand-line)] pt-6 first:border-t-0 first:pt-0">
      <div>
        <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">{title}</h4>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-[var(--color-brand-line)] bg-white/65 p-4 shadow-[0_12px_30px_rgba(94,58,28,0.05)]">
      <div className="space-y-3">
        <p className={sub}>{title}</p>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  wrapperClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wrapperClassName?: string;
}) {
  return (
    <label className={`${lab} ${wrapperClassName ?? ""}`}>
      {label}
      <input className={`${inp} mt-1`} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  minHeight = 92,
  wrapperClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  wrapperClassName?: string;
}) {
  return (
    <label className={`${lab} ${wrapperClassName ?? ""}`}>
      {label}
      <textarea
        className={`${inp} mt-1 resize-y`}
        style={{ minHeight }}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  wrapperClassName,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  wrapperClassName?: string;
}) {
  return (
    <label className={`${lab} ${wrapperClassName ?? ""}`}>
      {label}
      <select className={`${inp} mt-1`} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={`${label}-${option.value || "blank"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BoolRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#3a3a3c]">
      <input
        type="checkbox"
        className="rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]/30"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function CheckboxGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: CheckboxOption[];
  value?: Record<string, boolean | undefined>;
  onChange: (key: string, checked: boolean) => void;
  className?: string;
}) {
  return (
    <div className={className ?? "grid grid-cols-2 gap-2 md:grid-cols-3"}>
      {options.map((option) => (
        <BoolRow key={option.key} label={option.label} checked={value?.[option.key]} onChange={(checked) => onChange(option.key, checked)} />
      ))}
    </div>
  );
}

function mapLegacyProblemEvolucao(value?: "estavel" | "aumentando" | "diminuindo" | "") {
  if (value === "estavel") return "Estável";
  if (value === "aumentando") return "Aumentando";
  if (value === "diminuindo") return "Diminuindo";
  return "";
}

function isLegacyFicha(prev: FichaAnamneseCapilarDados | LegacyFichaAnamneseCapilarDados | null): prev is LegacyFichaAnamneseCapilarDados {
  return Boolean(prev && typeof prev === "object" && ("queixa" in prev || "historicoPessoal" in prev || "cuidadosCabelos" in prev || "conclusao" in prev));
}

function migrateLegacyData(prev: FichaAnamneseCapilarDados | LegacyFichaAnamneseCapilarDados | null): FichaAnamneseCapilarDados {
  if (!prev) return {};
  if (!isLegacyFicha(prev)) return prev;

  const newFormatKeys = { ...prev } as FichaAnamneseCapilarDados;
  delete (newFormatKeys as Record<string, unknown>).queixa;
  delete (newFormatKeys as Record<string, unknown>).historicoPessoal;
  delete (newFormatKeys as Record<string, unknown>).cuidadosCabelos;
  delete (newFormatKeys as Record<string, unknown>).conclusao;

  return {
    dadosPessoais: {
      nome: prev.identificacao?.nome,
      dataNascimento: prev.identificacao?.dataNascimento,
      endereco: prev.identificacao?.endereco,
      cidade: prev.identificacao?.cidadeEstado,
      profissao: prev.identificacao?.profissao,
      email: prev.identificacao?.email,
      celular: prev.identificacao?.celular,
      filhos: boolToText(prev.historicoPessoal?.filhos),
    },
    queixaPrincipal: prev.queixa?.queixaPrincipal,
    dadosClinicos: {
      quedaAcentuada: {
        haQuantoTempo: prev.queixa?.fazQuantoTempo,
        periodosCessouVoltou: joinTexts([boolToText(prev.queixa?.outrasCrises), prev.queixa?.quandoOutrasCrises]),
        fiosSendoSubstituidos: boolToText(prev.exameFisico?.reposicaoFios),
        eventoMarcante: prev.historicoPessoal?.mesesAnteriores?.detalhes,
        perdaVolumeIntensidade: joinTexts([
          mapLegacyProblemEvolucao(prev.queixa?.problemaEvolucao),
          prev.queixa?.cabeloFicou?.maisFino ? "Cabelo mais fino" : "",
          prev.queixa?.cabeloFicou?.maisQuebradico ? "Mais quebradiço" : "",
        ]),
        perdaPelosCorpo: joinTexts([boolToText(prev.queixa?.alteracaoOutrasAreas), prev.queixa?.alteracaoOutrasAreasQuais]),
      },
      afinamentoHaste: {
        presente: prev.queixa?.cabeloFicou?.maisFino,
        haQuantoTempo: prev.queixa?.fazQuantoTempo,
        casosCalvicieFamiliaParentesco: joinTexts([
          prev.historicoPessoal?.familiaCalvicieMulheres,
          prev.historicoPessoal?.familiaCalvicieHomens,
          prev.historicoPessoal?.familiaCalvicieOutros,
        ]),
      },
      inflamacao: {
        presente: prev.queixa?.couroCabeludo?.inflamacao,
        coceiraCouroCabeludo: boolToText(prev.queixa?.couroCabeludo?.coceira),
        dorCouroCabeludoFrequencia: boolToText(prev.queixa?.couroCabeludo?.dor),
        descamacaoCaspa: joinTexts([
          prev.queixa?.couroCabeludo?.descamacao ? "Descamação" : "",
          prev.queixa?.couroCabeludo?.caspa ? "Caspa" : "",
        ]),
      },
    },
    historicoSaudeGeral: {
      problemaSaudeAtual: joinTexts([boolToText(prev.historicoPessoal?.doencaAtual), prev.historicoPessoal?.doencaAtualQual]),
      desregulacaoHormonal: joinTexts([boolToText(prev.historicoPessoal?.problemaEndocrino), prev.historicoPessoal?.problemaEndocrinoQual]),
      medicamentoContinuo: joinTexts([boolToText(prev.historicoPessoal?.medicacao), prev.historicoPessoal?.medicacaoQual]),
      alergia: joinTexts([boolToText(prev.historicoPessoal?.alergia), prev.historicoPessoal?.alergiaQual]),
      menstruacao: prev.historicoPessoal?.alteracaoMenstrualQual,
    },
    habitos: {
      frequenciaLavagem: prev.historicoPessoal?.periodicidadeLavagem,
      usoSecadorChapinha: joinTexts([
        prev.cuidadosCabelos?.usa?.escovacao ? "Escovação" : "",
        prev.cuidadosCabelos?.usa?.pranchaTermica ? "Prancha térmica" : "",
      ]),
      alisamentoQualTipoFrequencia: joinTexts([
        boolToText(prev.cuidadosCabelos?.fazQuimica),
        prev.cuidadosCabelos?.fazQuimicaQual,
        prev.cuidadosCabelos?.fazQuimicaFrequencia,
      ]),
      produtosNoCabelo: prev.historicoPessoal?.cosmeticosCapilares,
      penteadosComTracao: prev.cuidadosCabelos?.usa?.penteadosPresos ? "Sim" : "",
    },
    historicoFamiliar: {
      casosCalvicieFamilia: joinTexts([
        prev.historicoPessoal?.familiaCalvicieMulheres,
        prev.historicoPessoal?.familiaCalvicieHomens,
      ]),
      alopeciaAreataOuAutoimunesFamilia: prev.historicoPessoal?.familiaCalvicieOutros,
    },
    tricoscopia: {
      alopeciaCaracteristica: {
        aag: prev.exameFisico?.presenca?.entradas,
        alopeciaCicatricial: Boolean(prev.exameFisico?.alopeciaAreataCicatricial?.localizacao),
      },
    },
    diagnosticoClinico: prev.conclusao?.alteracaoEncontrada,
    condutaPrescrita: prev.conclusao?.protocoloIndicado,
    assinatura: prev.assinatura,
    ...(newFormatKeys as FichaAnamneseCapilarDados),
  };
}

function syncDadosPessoaisFromProfile(client: Client, prev?: FichaAnamneseCapilarDados["dadosPessoais"]) {
  return {
    ...prev,
    nome: prev?.nome || client.profile.nome,
    dataNascimento: prev?.dataNascimento || client.profile.dataAniversario || "",
    endereco: prev?.endereco || client.profile.endereco || "",
    cidade: prev?.cidade || client.profile.cidadeEstado || "",
    profissao: prev?.profissao || client.profile.profissao || "",
    email: prev?.email || client.profile.email || "",
    celular: prev?.celular || client.profile.whatsapp || "",
  };
}

function mergeFromClient(client: Client, prev: FichaAnamneseCapilarDados | null): FichaAnamneseCapilarDados {
  const migrated = migrateLegacyData(prev);
  return {
    ...migrated,
    dadosPessoais: syncDadosPessoaisFromProfile(client, migrated.dadosPessoais),
  };
}

export default function AnamneseCapilarTab({
  client,
  onSave,
}: {
  client: Client;
  onSave: (dados: FichaAnamneseCapilarDados) => Promise<void>;
}) {
  const { config: branding } = useBrandingConfig();
  const [dados, setDados] = useState<FichaAnamneseCapilarDados>(() => mergeFromClient(client, client.fichaAnamnese));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<FeedbackState | null>(null);

  useEffect(() => {
    setDados(mergeFromClient(client, client.fichaAnamnese));
  }, [client]);

  const setDadosPessoais = (patch: NonNullable<FichaAnamneseCapilarDados["dadosPessoais"]>) =>
    setDados((current) => ({ ...current, dadosPessoais: { ...current.dadosPessoais, ...patch } }));
  const setDadosClinicos = (patch: NonNullable<FichaAnamneseCapilarDados["dadosClinicos"]>) =>
    setDados((current) => ({ ...current, dadosClinicos: { ...current.dadosClinicos, ...patch } }));
  const setTratamentosAnteriores = (patch: NonNullable<FichaAnamneseCapilarDados["tratamentosAnteriores"]>) =>
    setDados((current) => ({ ...current, tratamentosAnteriores: { ...current.tratamentosAnteriores, ...patch } }));
  const setHistoricoSaudeGeral = (patch: NonNullable<FichaAnamneseCapilarDados["historicoSaudeGeral"]>) =>
    setDados((current) => ({ ...current, historicoSaudeGeral: { ...current.historicoSaudeGeral, ...patch } }));
  const setHabitos = (patch: NonNullable<FichaAnamneseCapilarDados["habitos"]>) =>
    setDados((current) => ({ ...current, habitos: { ...current.habitos, ...patch } }));
  const setHistoricoFamiliar = (patch: NonNullable<FichaAnamneseCapilarDados["historicoFamiliar"]>) =>
    setDados((current) => ({ ...current, historicoFamiliar: { ...current.historicoFamiliar, ...patch } }));
  const setExameFisico = (patch: NonNullable<FichaAnamneseCapilarDados["exameFisico"]>) =>
    setDados((current) => ({ ...current, exameFisico: { ...current.exameFisico, ...patch } }));
  const setTricoscopia = (patch: NonNullable<FichaAnamneseCapilarDados["tricoscopia"]>) =>
    setDados((current) => ({ ...current, tricoscopia: { ...current.tricoscopia, ...patch } }));
  const setClassificacaoAag = (patch: NonNullable<FichaAnamneseCapilarDados["classificacaoAag"]>) =>
    setDados((current) => ({ ...current, classificacaoAag: { ...current.classificacaoAag, ...patch } }));

  const flashMessage = (tone: FeedbackState["tone"], text: string) => {
    setMsg({ tone, text });
    window.setTimeout(() => setMsg(null), 2500);
  };

  const getSaveErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  };

  const buildNextData = () => mergeFromClient(client, dados);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const nextData = buildNextData();
      setDados(nextData);
      await onSave(nextData);
      flashMessage("success", "Ficha salva.");
    } catch (error) {
      flashMessage("error", getSaveErrorMessage(error, "Não foi possível salvar a ficha."));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPrint = async () => {
    setSaving(true);
    setMsg(null);

    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      flashMessage("error", "Não foi possível abrir a janela de impressão. Libere pop-ups do navegador.");
      setSaving(false);
      return;
    }

    try {
      const nextData = buildNextData();
      setDados(nextData);
      await onSave(nextData);
      openPrintPreview(client, nextData, branding, printWindow);
      flashMessage("success", "Ficha salva. Abrindo impressão...");
    } catch (error) {
      printWindow.close();
      flashMessage("error", getSaveErrorMessage(error, "Não foi possível gerar a impressão."));
    } finally {
      setSaving(false);
    }
  };

  const dadosPessoais = dados.dadosPessoais;
  const dadosClinicos = dados.dadosClinicos;
  const quedaAcentuada = dadosClinicos?.quedaAcentuada;
  const afinamentoHaste = dadosClinicos?.afinamentoHaste;
  const inflamacao = dadosClinicos?.inflamacao;
  const tratamentosAnteriores = dados.tratamentosAnteriores;
  const historicoSaudeGeral = dados.historicoSaudeGeral;
  const habitos = dados.habitos;
  const historicoFamiliar = dados.historicoFamiliar;
  const exameFisico = dados.exameFisico;
  const tricoscopia = dados.tricoscopia;
  const classificacaoAag = dados.classificacaoAag;
  const epiderme = tricoscopia?.epidermePeriInterfolicular;
  const alopeciaCaracteristica = tricoscopia?.alopeciaCaracteristica;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4 pb-32 sm:p-6 sm:pb-28">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d1d1f]">Ficha de anamnese capilar</h3>
          <p className="text-xs text-[#86868b]">Estrutura reorganizada conforme o ebook, com todos os blocos na ordem original da ficha.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAndPrint}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7a4f21]/20 bg-[#f4e6d3] px-4 py-2 text-sm font-semibold text-[#7a4f21] hover:bg-[#efddc6] disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {saving ? "Processando..." : "Gerar PDF"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7a4921]/18 bg-[rgba(122,73,33,0.08)] px-4 py-2 text-sm font-semibold text-[#7a4921] hover:bg-[rgba(122,73,33,0.12)] disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Salvando..." : "Salvar ficha"}
          </button>
        </div>
      </div>
      {msg && <p className={`text-xs font-medium ${msg.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>{msg.text}</p>}

      <div className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-4 shadow-[0_18px_45px_rgba(94,58,28,0.08)] sm:p-6">
        <div className="space-y-8">
          <Section title="DADOS PESSOAIS">
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              Os campos seguem a mesma ordem do ebook e já recebem, quando disponível, os dados principais do cadastro da paciente.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Nome" value={dadosPessoais?.nome ?? ""} onChange={(value) => setDadosPessoais({ nome: value })} wrapperClassName="md:col-span-2" />
              <TextField label="Sexo" value={dadosPessoais?.sexo ?? ""} onChange={(value) => setDadosPessoais({ sexo: value })} />
              <TextField label="Data de Nascimento" value={dadosPessoais?.dataNascimento ?? ""} onChange={(value) => setDadosPessoais({ dataNascimento: value })} placeholder="dd/mm/aaaa" />
              <TextField label="Endereço" value={dadosPessoais?.endereco ?? ""} onChange={(value) => setDadosPessoais({ endereco: value })} wrapperClassName="md:col-span-2" />
              <TextField label="Cidade" value={dadosPessoais?.cidade ?? ""} onChange={(value) => setDadosPessoais({ cidade: value })} />
              <TextField label="Profissão" value={dadosPessoais?.profissao ?? ""} onChange={(value) => setDadosPessoais({ profissao: value })} />
              <TextField label="E-mail" value={dadosPessoais?.email ?? ""} onChange={(value) => setDadosPessoais({ email: value })} />
              <TextField label="Celular" value={dadosPessoais?.celular ?? ""} onChange={(value) => setDadosPessoais({ celular: value })} />
              <SelectField label="Filhos" value={dadosPessoais?.filhos ?? ""} options={SIM_NAO_OPTIONS} onChange={(value) => setDadosPessoais({ filhos: value })} />
            </div>
          </Section>

          <Section title="QUEIXA PRINCIPAL">
            <TextAreaField label="Queixa principal" value={dados.queixaPrincipal ?? ""} onChange={(value) => setDados((current) => ({ ...current, queixaPrincipal: value }))} minHeight={130} />
          </Section>

          <Section title="DADOS CLÍNICOS">
            <Subsection title="QUEDA ACENTUADA">
              <CheckboxGroup
                options={QUEDA_ACENTUADA_OPTIONS}
                value={quedaAcentuada as Record<string, boolean | undefined> | undefined}
                onChange={(key, checked) =>
                  setDadosClinicos({ quedaAcentuada: { ...quedaAcentuada, [key]: checked } })
                }
                className="grid grid-cols-2 gap-2 md:grid-cols-4"
              />
              <TextField label="Há quanto tempo?" value={quedaAcentuada?.haQuantoTempo ?? ""} onChange={(value) => setDadosClinicos({ quedaAcentuada: { ...quedaAcentuada, haQuantoTempo: value } })} />
              <TextAreaField label="Tiveram períodos que a queda cessou e depois voltou?" value={quedaAcentuada?.periodosCessouVoltou ?? ""} onChange={(value) => setDadosClinicos({ quedaAcentuada: { ...quedaAcentuada, periodosCessouVoltou: value } })} minHeight={76} />
              <TextAreaField label="Os fios que caem estão sendo substituídos?" value={quedaAcentuada?.fiosSendoSubstituidos ?? ""} onChange={(value) => setDadosClinicos({ quedaAcentuada: { ...quedaAcentuada, fiosSendoSubstituidos: value } })} minHeight={76} />
              <TextAreaField label="Como começou? Houve algum evento marcante?" value={quedaAcentuada?.eventoMarcante ?? ""} onChange={(value) => setDadosClinicos({ quedaAcentuada: { ...quedaAcentuada, eventoMarcante: value } })} minHeight={86} />
              <TextAreaField label="Houve perda de volume? Qual a intensidade?" value={quedaAcentuada?.perdaVolumeIntensidade ?? ""} onChange={(value) => setDadosClinicos({ quedaAcentuada: { ...quedaAcentuada, perdaVolumeIntensidade: value } })} minHeight={76} />
              <TextAreaField label="Há perda de pelos em outras partes do corpo?" value={quedaAcentuada?.perdaPelosCorpo ?? ""} onChange={(value) => setDadosClinicos({ quedaAcentuada: { ...quedaAcentuada, perdaPelosCorpo: value } })} minHeight={76} />
            </Subsection>

            <Subsection title="AFINAMENTO DA HASTE">
              <CheckboxGroup
                options={AFINAMENTO_DA_HASTE_OPTIONS}
                value={afinamentoHaste as Record<string, boolean | undefined> | undefined}
                onChange={(key, checked) =>
                  setDadosClinicos({ afinamentoHaste: { ...afinamentoHaste, [key]: checked } })
                }
                className="grid grid-cols-2 gap-2 md:grid-cols-4"
              />
              <TextField label="Há quanto tempo?" value={afinamentoHaste?.haQuantoTempo ?? ""} onChange={(value) => setDadosClinicos({ afinamentoHaste: { ...afinamentoHaste, haQuantoTempo: value } })} />
              <TextAreaField label="Casos de calvície na família? Qual o parentesco?" value={afinamentoHaste?.casosCalvicieFamiliaParentesco ?? ""} onChange={(value) => setDadosClinicos({ afinamentoHaste: { ...afinamentoHaste, casosCalvicieFamiliaParentesco: value } })} minHeight={86} />
            </Subsection>

            <Subsection title="INFLAMAÇÃO">
              <CheckboxGroup
                options={INFLAMACAO_OPTIONS}
                value={inflamacao as Record<string, boolean | undefined> | undefined}
                onChange={(key, checked) =>
                  setDadosClinicos({ inflamacao: { ...inflamacao, [key]: checked } })
                }
                className="grid grid-cols-2 gap-2 md:grid-cols-4"
              />
              <TextField label="Intensidade" value={inflamacao?.intensidade ?? ""} onChange={(value) => setDadosClinicos({ inflamacao: { ...inflamacao, intensidade: value } })} />
              <TextAreaField label="Sente coceira no couro cabeludo?" value={inflamacao?.coceiraCouroCabeludo ?? ""} onChange={(value) => setDadosClinicos({ inflamacao: { ...inflamacao, coceiraCouroCabeludo: value } })} minHeight={76} />
              <TextAreaField label="Sente dor no couro cabeludo? Com que frequência?" value={inflamacao?.dorCouroCabeludoFrequencia ?? ""} onChange={(value) => setDadosClinicos({ inflamacao: { ...inflamacao, dorCouroCabeludoFrequencia: value } })} minHeight={76} />
              <TextAreaField label="Descamação? Presença de caspa?" value={inflamacao?.descamacaoCaspa ?? ""} onChange={(value) => setDadosClinicos({ inflamacao: { ...inflamacao, descamacaoCaspa: value } })} minHeight={76} />
              <TextAreaField label="Dermatite seborreica?" value={inflamacao?.dermatiteSeborreica ?? ""} onChange={(value) => setDadosClinicos({ inflamacao: { ...inflamacao, dermatiteSeborreica: value } })} minHeight={76} />
            </Subsection>
          </Section>

          <Section title="TRATAMENTOS ANTERIORES">
            <TextAreaField label="Já foi previamente diagnosticado por um médico? Qual foi o diagnóstico?" value={tratamentosAnteriores?.diagnosticoMedicoPrevio ?? ""} onChange={(value) => setTratamentosAnteriores({ diagnosticoMedicoPrevio: value })} minHeight={86} />
            <TextAreaField label="Já realizou algum tratamento? Usou algum medicamento antes? Qual?" value={tratamentosAnteriores?.tratamentosEMedicamentosPrevios ?? ""} onChange={(value) => setTratamentosAnteriores({ tratamentosEMedicamentosPrevios: value })} minHeight={86} />
            <TextAreaField label="Os medicamentos/suplementos usados foram de indicação profissional? Obteve resultado?" value={tratamentosAnteriores?.indicacaoProfissionalEResultados ?? ""} onChange={(value) => setTratamentosAnteriores({ indicacaoProfissionalEResultados: value })} minHeight={86} />
          </Section>

          <Section title="HISTÓRICO DE SAÚDE GERAL">
            <TextAreaField label="Possui algum problema de saúde atual? Qual(is)?" value={historicoSaudeGeral?.problemaSaudeAtual ?? ""} onChange={(value) => setHistoricoSaudeGeral({ problemaSaudeAtual: value })} minHeight={76} />
            <TextAreaField label="Possui alguma doença crônica? Qual(is)?" value={historicoSaudeGeral?.doencaCronica ?? ""} onChange={(value) => setHistoricoSaudeGeral({ doencaCronica: value })} minHeight={76} />
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Hipertensão" value={historicoSaudeGeral?.hipertensao ?? ""} onChange={(value) => setHistoricoSaudeGeral({ hipertensao: value })} />
              <TextField label="Diabetes" value={historicoSaudeGeral?.diabetes ?? ""} onChange={(value) => setHistoricoSaudeGeral({ diabetes: value })} />
              <TextField label="Arritmia" value={historicoSaudeGeral?.arritmia ?? ""} onChange={(value) => setHistoricoSaudeGeral({ arritmia: value })} />
            </div>
            <TextAreaField label="Doença autoimune? Qual(is)?" value={historicoSaudeGeral?.doencaAutoimune ?? ""} onChange={(value) => setHistoricoSaudeGeral({ doencaAutoimune: value })} minHeight={76} />
            <TextAreaField label="Possui algum problema renal/hepático/gastrintestinal? Qual(is)?" value={historicoSaudeGeral?.problemaRenalHepaticoGastrintestinal ?? ""} onChange={(value) => setHistoricoSaudeGeral({ problemaRenalHepaticoGastrintestinal: value })} minHeight={76} />
            <TextAreaField label="Possui algum problema neurológico? Qual(is)?" value={historicoSaudeGeral?.problemaNeurologico ?? ""} onChange={(value) => setHistoricoSaudeGeral({ problemaNeurologico: value })} minHeight={76} />
            <TextAreaField label="Possui algum problema de circulação/histórico de trombose/embolia? Qual(is)?" value={historicoSaudeGeral?.problemaCirculacaoTromboseEmbolia ?? ""} onChange={(value) => setHistoricoSaudeGeral({ problemaCirculacaoTromboseEmbolia: value })} minHeight={86} />
            <TextAreaField label="Possui alguma desregulação hormonal? Qual?" value={historicoSaudeGeral?.desregulacaoHormonal ?? ""} onChange={(value) => setHistoricoSaudeGeral({ desregulacaoHormonal: value })} minHeight={76} />
            <TextAreaField label="Faz uso de anticoncepcional? Qual?" value={historicoSaudeGeral?.anticoncepcional ?? ""} onChange={(value) => setHistoricoSaudeGeral({ anticoncepcional: value })} minHeight={76} />
            <TextAreaField label="Toma algum medicamento contínuo? Qual(is)? Há quanto tempo toma?" value={historicoSaudeGeral?.medicamentoContinuo ?? ""} onChange={(value) => setHistoricoSaudeGeral({ medicamentoContinuo: value })} minHeight={86} />
            <TextAreaField label="Fez algum tratamento medicamentoso no último ano?" value={historicoSaudeGeral?.tratamentoMedicamentosoUltimoAno ?? ""} onChange={(value) => setHistoricoSaudeGeral({ tratamentoMedicamentosoUltimoAno: value })} minHeight={76} />
            <TextAreaField label="Está tomando algum medicamento diferente no momento? Qual(is)?" value={historicoSaudeGeral?.medicamentoAtualDiferente ?? ""} onChange={(value) => setHistoricoSaudeGeral({ medicamentoAtualDiferente: value })} minHeight={76} />
            <TextAreaField label="Possui alguma alergia? Qual(is)?" value={historicoSaudeGeral?.alergia ?? ""} onChange={(value) => setHistoricoSaudeGeral({ alergia: value })} minHeight={76} />
            <TextAreaField label="Histórico de cirurgias? Qual(is)? Quando?" value={historicoSaudeGeral?.historicoCirurgias ?? ""} onChange={(value) => setHistoricoSaudeGeral({ historicoCirurgias: value })} minHeight={76} />
            <div className="grid gap-3 md:grid-cols-3">
              <SelectField label="Gestante" value={historicoSaudeGeral?.gestante ?? ""} options={SIM_NAO_OPTIONS} onChange={(value) => setHistoricoSaudeGeral({ gestante: value })} />
              <SelectField label="Lactante" value={historicoSaudeGeral?.lactante ?? ""} options={SIM_NAO_OPTIONS} onChange={(value) => setHistoricoSaudeGeral({ lactante: value })} />
              <SelectField label="Menopausa" value={historicoSaudeGeral?.menopausa ?? ""} options={SIM_NAO_OPTIONS} onChange={(value) => setHistoricoSaudeGeral({ menopausa: value })} />
            </div>
            <TextAreaField label="Menstruação (ciclo, fluxo)?" value={historicoSaudeGeral?.menstruacao ?? ""} onChange={(value) => setHistoricoSaudeGeral({ menstruacao: value })} minHeight={76} />
            <TextAreaField label="Síndrome do ovário policístico?" value={historicoSaudeGeral?.sindromeOvarioPolicistico ?? ""} onChange={(value) => setHistoricoSaudeGeral({ sindromeOvarioPolicistico: value })} minHeight={76} />
            <TextField label="Peso" value={historicoSaudeGeral?.peso ?? ""} onChange={(value) => setHistoricoSaudeGeral({ peso: value })} />
            <TextAreaField label="Resultado de exames laboratoriais" value={historicoSaudeGeral?.examesLaboratoriais ?? ""} onChange={(value) => setHistoricoSaudeGeral({ examesLaboratoriais: value })} minHeight={76} />
          </Section>

          <Section title="HÁBITOS">
            <TextField label="Com que frequência lava os cabelos?" value={habitos?.frequenciaLavagem ?? ""} onChange={(value) => setHabitos({ frequenciaLavagem: value })} />
            <TextAreaField label="Costuma usar secador/chapinha? Com que frequência?" value={habitos?.usoSecadorChapinha ?? ""} onChange={(value) => setHabitos({ usoSecadorChapinha: value })} minHeight={76} />
            <TextAreaField label="Faz alisamento? Qual? Tipo? Frequência?" value={habitos?.alisamentoQualTipoFrequencia ?? ""} onChange={(value) => setHabitos({ alisamentoQualTipoFrequencia: value })} minHeight={86} />
            <TextAreaField label="Quais produtos usa no cabelo?" value={habitos?.produtosNoCabelo ?? ""} onChange={(value) => setHabitos({ produtosNoCabelo: value })} minHeight={76} />
            <TextAreaField label="Usa rabo de cavalo/trança/ou qualquer outro penteado que cause tração?" value={habitos?.penteadosComTracao ?? ""} onChange={(value) => setHabitos({ penteadosComTracao: value })} minHeight={86} />
            <TextAreaField label="Sente dor decorrente dessa tração?" value={habitos?.dorDecorrenteDaTracao ?? ""} onChange={(value) => setHabitos({ dorDecorrenteDaTracao: value })} minHeight={76} />
            <TextAreaField label="Já fez implante/transplante capilar? Quando?" value={habitos?.implanteOuTransplanteCapilar ?? ""} onChange={(value) => setHabitos({ implanteOuTransplanteCapilar: value })} minHeight={76} />
            <TextField label="Fumante?" value={habitos?.fumante ?? ""} onChange={(value) => setHabitos({ fumante: value })} />
            <TextField label="Faz consumo de bebida alcoólica?" value={habitos?.bebidaAlcoolica ?? ""} onChange={(value) => setHabitos({ bebidaAlcoolica: value })} />
            <TextAreaField label="Faz exercício físico? Qual? Qual frequência?" value={habitos?.exercicioFisico ?? ""} onChange={(value) => setHabitos({ exercicioFisico: value })} minHeight={76} />
            <TextAreaField label="Alimentação?" value={habitos?.alimentacao ?? ""} onChange={(value) => setHabitos({ alimentacao: value })} minHeight={76} />
            <TextField label="Costuma tomar quantos copos de água por dia?" value={habitos?.coposDeAguaPorDia ?? ""} onChange={(value) => setHabitos({ coposDeAguaPorDia: value })} />
            <TextField label="Quantas horas de sono dorme por noite?" value={habitos?.horasDeSono ?? ""} onChange={(value) => setHabitos({ horasDeSono: value })} />
            <TextField label="Se julga uma pessoa estressada?" value={habitos?.pessoaEstressada ?? ""} onChange={(value) => setHabitos({ pessoaEstressada: value })} />
            <TextField label="Se julga uma pessoa ansiosa?" value={habitos?.pessoaAnsiosa ?? ""} onChange={(value) => setHabitos({ pessoaAnsiosa: value })} />
          </Section>

          <Section title="HISTÓRICO FAMILIAR">
            <TextAreaField label="Casos de calvície na família?" value={historicoFamiliar?.casosCalvicieFamilia ?? ""} onChange={(value) => setHistoricoFamiliar({ casosCalvicieFamilia: value })} minHeight={76} />
            <TextAreaField label="Casos de alopecia areata ou outras doenças autoimunes na família?" value={historicoFamiliar?.alopeciaAreataOuAutoimunesFamilia ?? ""} onChange={(value) => setHistoricoFamiliar({ alopeciaAreataOuAutoimunesFamilia: value })} minHeight={86} />
            <TextAreaField label="Doenças congênitas da haste?" value={historicoFamiliar?.doencasCongenitasDaHaste ?? ""} onChange={(value) => setHistoricoFamiliar({ doencasCongenitasDaHaste: value })} minHeight={76} />
          </Section>

          <Section title="EXAME FÍSICO">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Pull Test" value={exameFisico?.pullTest ?? ""} onChange={(value) => setExameFisico({ pullTest: value })} />
              <TextField label="Card Test" value={exameFisico?.cardTest ?? ""} onChange={(value) => setExameFisico({ cardTest: value })} />
              <TextField label="Tug Test" value={exameFisico?.tugTest ?? ""} onChange={(value) => setExameFisico({ tugTest: value })} />
              <TextField label="Wash Test" value={exameFisico?.washTest ?? ""} onChange={(value) => setExameFisico({ washTest: value })} />
            </div>
          </Section>

          <Section title="TRICOSCOPIA">
            <Subsection title="ÓSTIOS FOLICULARES">
              <CheckboxGroup
                options={OSTIOS_FOLICULARES_OPTIONS}
                value={tricoscopia?.ostiosFoliculares as Record<string, boolean | undefined> | undefined}
                onChange={(key, checked) =>
                  setTricoscopia({ ostiosFoliculares: { ...tricoscopia?.ostiosFoliculares, [key]: checked } })
                }
              />
            </Subsection>

            <Subsection title="EPIDERME PERI/INTERFOLICULAR">
              <CheckboxGroup
                options={[{ key: "normal", label: "Normal" }]}
                value={epiderme as Record<string, boolean | undefined> | undefined}
                onChange={(key, checked) =>
                  setTricoscopia({ epidermePeriInterfolicular: { ...epiderme, [key]: checked } })
                }
                className="flex flex-wrap gap-3"
              />
              <div className="space-y-2">
                <p className={sub}>Descamação</p>
                <CheckboxGroup
                  options={EPIDERME_DESCAMACAO_OPTIONS}
                  value={epiderme as Record<string, boolean | undefined> | undefined}
                  onChange={(key, checked) =>
                    setTricoscopia({ epidermePeriInterfolicular: { ...epiderme, [key]: checked } })
                  }
                  className="grid grid-cols-1 gap-2 md:grid-cols-2"
                />
              </div>
              <div className="space-y-2">
                <p className={sub}>Coloração</p>
                <CheckboxGroup
                  options={EPIDERME_COLORACAO_OPTIONS}
                  value={epiderme as Record<string, boolean | undefined> | undefined}
                  onChange={(key, checked) =>
                    setTricoscopia({ epidermePeriInterfolicular: { ...epiderme, [key]: checked } })
                  }
                />
              </div>
            </Subsection>

            <Subsection title="ALOPECIA CARACTERÍSTICA">
              <CheckboxGroup
                options={ALOPECIA_CARACTERISTICA_OPTIONS}
                value={alopeciaCaracteristica as Record<string, boolean | undefined> | undefined}
                onChange={(key, checked) =>
                  setTricoscopia({ alopeciaCaracteristica: { ...alopeciaCaracteristica, [key]: checked } })
                }
                className="grid grid-cols-1 gap-2 md:grid-cols-2"
              />
              <TextField label="AA subtipo" value={alopeciaCaracteristica?.aaSubtipoDescricao ?? ""} onChange={(value) => setTricoscopia({ alopeciaCaracteristica: { ...alopeciaCaracteristica, aaSubtipoDescricao: value } })} />
              <TextAreaField label="OBS" value={tricoscopia?.observacoes ?? ""} onChange={(value) => setTricoscopia({ observacoes: value })} minHeight={110} />
            </Subsection>
          </Section>

          <Section title="CLASSIFICAÇÃO DA AAG">
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">Registro textual da escala marcada no ebook: Norwood-Hamilton, Ludwig e Savin.</p>
            <div className="grid gap-3 md:grid-cols-3">
              <SelectField label="Escala de Norwood-Hamilton" value={classificacaoAag?.norwoodHamilton ?? ""} options={NORWOOD_OPTIONS} onChange={(value) => setClassificacaoAag({ norwoodHamilton: value as NonNullable<FichaAnamneseCapilarDados["classificacaoAag"]>["norwoodHamilton"] })} />
              <SelectField label="Escala de Ludwig" value={classificacaoAag?.ludwig ?? ""} options={LUDWIG_OPTIONS} onChange={(value) => setClassificacaoAag({ ludwig: value as NonNullable<FichaAnamneseCapilarDados["classificacaoAag"]>["ludwig"] })} />
              <SelectField label="Escala de Savin" value={classificacaoAag?.savin ?? ""} options={SAVIN_OPTIONS} onChange={(value) => setClassificacaoAag({ savin: value as NonNullable<FichaAnamneseCapilarDados["classificacaoAag"]>["savin"] })} />
            </div>
          </Section>

          <Section title="DIAGNÓSTICO CLÍNICO">
            <TextAreaField label="Diagnóstico clínico" value={dados.diagnosticoClinico ?? ""} onChange={(value) => setDados((current) => ({ ...current, diagnosticoClinico: value }))} minHeight={150} />
          </Section>

          <Section title="CONDUTA PRESCRITA">
            <TextAreaField label="Conduta prescrita" value={dados.condutaPrescrita ?? ""} onChange={(value) => setDados((current) => ({ ...current, condutaPrescrita: value }))} minHeight={170} />
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-white/40 bg-white/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAndPrint}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7a4f21]/20 bg-[#f4e6d3] px-5 py-3 text-sm font-semibold text-[#7a4f21] hover:bg-[#efddc6] disabled:opacity-60 sm:w-auto sm:py-2.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {saving ? "Processando..." : "Gerar PDF"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7a4921]/18 bg-[rgba(122,73,33,0.08)] px-5 py-3 text-sm font-semibold text-[#7a4921] hover:bg-[rgba(122,73,33,0.12)] disabled:opacity-60 sm:w-auto sm:py-2.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Salvando..." : "Salvar ficha completa"}
          </button>
        </div>
      </div>
    </form>
  );
}
