"use client";

import { useMemo, type ReactNode } from "react";
import type {
  GalleryPhoto,
} from "@/types";
import type {
  FichaAnamneseCapilarDados,
  FichaCapilar360Dados,
  FichaCapilar360EvolucaoSessao,
  FichaCapilar360MapaCouroCabeludo,
  FichaCapilar360RegistroTricoscopia,
} from "@/types/anamneseCapilar";
import { analyzeCapillaryTriage } from "@/lib/capillaryTriage";
import { getPhotoCategoryLabel } from "@/lib/photos";

type Props = {
  dados: FichaAnamneseCapilarDados;
  onChange: (nextData: FichaAnamneseCapilarDados) => void;
  photos?: readonly GalleryPhoto[];
};

type Option = {
  key: string;
  label: string;
};

type ScalpRegionKey = keyof NonNullable<FichaCapilar360Dados["mapaCouroCabeludo"]>;

const inputClass =
  "mt-1 w-full rounded-2xl border border-white/50 bg-white/50 px-3 py-2 text-sm text-[#1d1d1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#7a4921]/20";
const labelClass = "block text-[10px] font-bold uppercase tracking-wide text-[#6e6e73]";
const eyebrowClass = "text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]";

const TRIAGE_COMPLAINT_OPTIONS: Option[] = [
  { key: "queda", label: "Queda" },
  { key: "quebra", label: "Quebra" },
  { key: "oleosidade", label: "Oleosidade" },
  { key: "descamacaoCaspa", label: "Descamacao/caspa" },
  { key: "coceira", label: "Coceira" },
  { key: "ardencia", label: "Ardencia" },
  { key: "dor", label: "Dor" },
  { key: "falhas", label: "Falhas" },
  { key: "afinamento", label: "Afinamento" },
  { key: "crescimentoLento", label: "Crescimento lento" },
  { key: "danoQuimico", label: "Dano quimico" },
  { key: "manutencaoPreventiva", label: "Manutencao preventiva" },
];

const RECENT_FACTOR_OPTIONS: Option[] = [
  { key: "posParto", label: "Pos-parto" },
  { key: "estresse", label: "Estresse intenso" },
  { key: "febreInfeccao", label: "Febre/infeccao" },
  { key: "cirurgia", label: "Cirurgia" },
  { key: "dietaRestritiva", label: "Dieta restritiva" },
  { key: "perdaPeso", label: "Perda de peso" },
  { key: "medicamentos", label: "Medicamentos" },
  { key: "alteracoesHormonais", label: "Alteracoes hormonais" },
  { key: "anemiaTireoideSop", label: "Anemia/tireoide/SOP" },
];

const SCALP_FINDING_OPTIONS: Option[] = [
  { key: "oleosidade", label: "Oleosidade" },
  { key: "descamacao", label: "Descamacao" },
  { key: "vermelhidao", label: "Vermelhidao" },
  { key: "coceira", label: "Coceira" },
  { key: "ardencia", label: "Ardencia" },
  { key: "dor", label: "Dor" },
  { key: "falhas", label: "Falhas" },
  { key: "afinamento", label: "Afinamento" },
  { key: "baixaDensidade", label: "Baixa densidade" },
  { key: "residuos", label: "Residuos" },
  { key: "feridas", label: "Feridas" },
  { key: "crostas", label: "Crostas" },
];

const SCALP_REGIONS: Array<{ key: ScalpRegionKey; label: string }> = [
  { key: "frontal", label: "Frontal" },
  { key: "topo", label: "Topo" },
  { key: "coroa", label: "Coroa" },
  { key: "lateralDireita", label: "Lateral direita" },
  { key: "lateralEsquerda", label: "Lateral esquerda" },
  { key: "nuca", label: "Nuca" },
];

const CHEMICAL_OPTIONS: Option[] = [
  { key: "coloracao", label: "Coloracao" },
  { key: "mechas", label: "Mechas" },
  { key: "descoloracao", label: "Descoloracao" },
  { key: "progressiva", label: "Progressiva" },
  { key: "botox", label: "Botox" },
  { key: "relaxamento", label: "Relaxamento" },
  { key: "hene", label: "Hene" },
  { key: "selagem", label: "Selagem" },
];

const CONSENT_OPTIONS: Array<{ key: keyof NonNullable<FichaCapilar360Dados["consentimentos"]>; label: string }> = [
  { key: "fotosUsoInterno", label: "Autoriza fotos para uso interno" },
  { key: "usoImagemRedes", label: "Autoriza uso de imagem em redes" },
  { key: "antesDepoisSemRosto", label: "Autoriza antes/depois sem rosto" },
  { key: "recebeuHomeCare", label: "Recebeu orientacao home care" },
  { key: "cienteResultadosVariam", label: "Ciente de que resultados variam" },
  { key: "profissionalRevisou", label: "Profissional revisou a ficha" },
];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function CheckboxList({
  options,
  value,
  onChange,
  columns = "md:grid-cols-3",
}: {
  options: Option[];
  value?: Record<string, boolean | undefined>;
  onChange: (key: string, checked: boolean) => void;
  columns?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${columns}`}>
      {options.map((option) => (
        <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/60 bg-white/55 px-3 py-2 text-sm text-[#3a3a3c]">
          <input
            type="checkbox"
            checked={Boolean(value?.[option.key])}
            onChange={(event) => onChange(option.key, event.target.checked)}
            className="rounded border-gray-300 text-[#7a4921] focus:ring-[#7a4921]/30"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date";
}) {
  return (
    <label className={labelClass}>
      {label}
      <input type={type} className={inputClass} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  minHeight = 86,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  return (
    <label className={labelClass}>
      {label}
      <textarea
        className={`${inputClass} resize-y`}
        style={{ minHeight }}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function formatPhotoOption(photo: GalleryPhoto) {
  const date = photo.date ? new Date(photo.date) : null;
  const formattedDate = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("pt-BR") : "sem data";
  return `${getPhotoCategoryLabel(photo.type)} - ${formattedDate}${photo.caption ? ` - ${photo.caption}` : ""}`;
}

function PhotoSelect({
  label,
  value,
  photos,
  onChange,
}: {
  label: string;
  value?: string;
  photos: readonly GalleryPhoto[];
  onChange: (value: string) => void;
}) {
  if (photos.length === 0) {
    return <Field label={label} value={value} onChange={onChange} placeholder="Adicione fotos na galeria para vincular aqui" />;
  }

  return (
    <label className={labelClass}>
      {label}
      <select className={inputClass} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecionar foto da galeria</option>
        {photos.map((photo) => (
          <option key={photo.id} value={photo.id}>
            {formatPhotoOption(photo)}
          </option>
        ))}
      </select>
    </label>
  );
}

function appendPhotoId(currentValue: string | undefined, photoId: string) {
  if (!photoId) return currentValue ?? "";
  const currentIds = (currentValue || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (currentIds.includes(photoId)) {
    return currentIds.join(", ");
  }

  return [...currentIds, photoId].join(", ");
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-[var(--color-brand-line)] bg-white/65 p-4 shadow-[0_12px_30px_rgba(94,58,28,0.05)]">
      <p className={eyebrowClass}>{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function updateListItem<T extends { id?: string }>(items: T[] | undefined, index: number, patch: Partial<T>) {
  return (items ?? []).map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item));
}

export default function FichaCapilar360Section({ dados, onChange, photos = [] }: Props) {
  const capilar360 = dados.capilar360 ?? {};
  const triagemQueixa = capilar360.triagemQueixa ?? {};
  const fatoresRecentes = capilar360.fatoresRecentes ?? {};
  const mapaCouroCabeludo = capilar360.mapaCouroCabeludo ?? {};
  const historicoQuimico = capilar360.historicoQuimico ?? {};
  const rotinaCapilar = capilar360.rotinaCapilar ?? {};
  const registrosTricoscopia = capilar360.registrosTricoscopia ?? [];
  const planoCuidado = capilar360.planoCuidado ?? {};
  const evolucaoSessoes = capilar360.evolucaoSessoes ?? [];
  const consentimentos = capilar360.consentimentos ?? {};
  const triage = useMemo(() => analyzeCapillaryTriage(dados), [dados]);

  const patch360 = (patch: Partial<FichaCapilar360Dados>) => {
    onChange({
      ...dados,
      schemaVersion: Math.max(dados.schemaVersion ?? 1, 2),
      capilar360: {
        ...capilar360,
        ...patch,
      },
    });
  };

  const patchTriagem = (patch: NonNullable<FichaCapilar360Dados["triagemQueixa"]>) =>
    patch360({ triagemQueixa: { ...triagemQueixa, ...patch } });

  const patchFatores = (patch: NonNullable<FichaCapilar360Dados["fatoresRecentes"]>) =>
    patch360({ fatoresRecentes: { ...fatoresRecentes, ...patch } });

  const patchHistoricoQuimico = (patch: NonNullable<FichaCapilar360Dados["historicoQuimico"]>) =>
    patch360({ historicoQuimico: { ...historicoQuimico, ...patch } });

  const patchRotina = (patch: NonNullable<FichaCapilar360Dados["rotinaCapilar"]>) =>
    patch360({ rotinaCapilar: { ...rotinaCapilar, ...patch } });

  const patchPlano = (patch: NonNullable<FichaCapilar360Dados["planoCuidado"]>) =>
    patch360({ planoCuidado: { ...planoCuidado, ...patch } });

  const patchConsentimentos = (patch: NonNullable<FichaCapilar360Dados["consentimentos"]>) =>
    patch360({ consentimentos: { ...consentimentos, ...patch } });

  const updateScalpFinding = (region: ScalpRegionKey, key: string, checked: boolean) => {
    const currentRegion = mapaCouroCabeludo[region] ?? {};
    patch360({
      mapaCouroCabeludo: {
        ...mapaCouroCabeludo,
        [region]: {
          ...currentRegion,
          achados: { ...currentRegion.achados, [key]: checked },
        },
      } as FichaCapilar360MapaCouroCabeludo,
    });
  };

  const updateScalpObservation = (region: ScalpRegionKey, observacoes: string) => {
    const currentRegion = mapaCouroCabeludo[region] ?? {};
    patch360({
      mapaCouroCabeludo: {
        ...mapaCouroCabeludo,
        [region]: {
          ...currentRegion,
          observacoes,
        },
      } as FichaCapilar360MapaCouroCabeludo,
    });
  };

  const addTricoscopyRecord = () => {
    const next: FichaCapilar360RegistroTricoscopia = {
      id: makeId("tricoscopia"),
      data: new Date().toISOString().slice(0, 10),
    };
    patch360({ registrosTricoscopia: [...registrosTricoscopia, next] });
  };

  const updateTricoscopyRecord = (index: number, patch: Partial<FichaCapilar360RegistroTricoscopia>) => {
    patch360({ registrosTricoscopia: updateListItem(registrosTricoscopia, index, patch) });
  };

  const removeTricoscopyRecord = (index: number) => {
    patch360({ registrosTricoscopia: registrosTricoscopia.filter((_, currentIndex) => currentIndex !== index) });
  };

  const addEvolutionRecord = () => {
    const next: FichaCapilar360EvolucaoSessao = {
      id: makeId("evolucao"),
      data: new Date().toISOString().slice(0, 10),
      sessao: String(evolucaoSessoes.length + 1),
    };
    patch360({ evolucaoSessoes: [...evolucaoSessoes, next] });
  };

  const updateEvolutionRecord = (index: number, patch: Partial<FichaCapilar360EvolucaoSessao>) => {
    patch360({ evolucaoSessoes: updateListItem(evolucaoSessoes, index, patch) });
  };

  const removeEvolutionRecord = (index: number) => {
    patch360({ evolucaoSessoes: evolucaoSessoes.filter((_, currentIndex) => currentIndex !== index) });
  };

  const attentionClasses = {
    baixo: "border-emerald-200 bg-emerald-50 text-emerald-800",
    moderado: "border-amber-200 bg-amber-50 text-amber-800",
    alto: "border-rose-200 bg-rose-50 text-rose-800",
  }[triage.attentionLevel];

  return (
    <section className="space-y-5 border-t border-[var(--color-brand-line)] pt-6">
      <div className="rounded-[32px] border border-[var(--color-brand-line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(244,230,211,0.72))] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={eyebrowClass}>Ficha Capilar 360</p>
            <h4 className="mt-2 text-lg font-semibold text-[#1d1d1f]">Triagem, plano de cuidado e evolucao profissional</h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Um complemento seguro para organizar queixa, couro cabeludo, historico quimico, rotina e evolucao sem apagar a ficha antiga.
            </p>
          </div>
          <span className="w-fit rounded-full border border-[#7a4921]/15 bg-white/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a4921]">
            Schema v2
          </span>
        </div>
      </div>

      <Card title="Assistente de Triagem Capilar">
        <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`rounded-3xl border px-4 py-3 ${attentionClasses}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]">Nivel de atencao</p>
            <p className="mt-1 text-2xl font-semibold capitalize">{triage.attentionLevel}</p>
            <p className="mt-2 text-xs leading-5">{triage.disclaimer}</p>
          </div>
          <div className="rounded-3xl border border-[var(--color-brand-line)] bg-white/60 px-4 py-3">
            <p className={eyebrowClass}>Resumo automatico</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">{triage.complaintSummary}</p>
          </div>
        </div>

        {triage.redFlags.length > 0 && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-700">Pontos de atencao antes de avancar</p>
            <div className="mt-3 space-y-2">
              {triage.redFlags.map((flag) => (
                <div key={flag.id} className="rounded-2xl bg-white/70 p-3 text-sm text-rose-900">
                  <strong>{flag.title}</strong>
                  <p className="mt-1 text-xs leading-5">{flag.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--color-brand-line)] bg-white/55 p-4">
            <p className={eyebrowClass}>Padroes para revisao</p>
            <div className="mt-3 space-y-2">
              {triage.patterns.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Preencha a triagem para gerar leitura de apoio.</p>
              ) : (
                triage.patterns.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-[var(--color-brand-soft)] p-3 text-sm text-[var(--color-brand-deep)]">
                    <strong>{item.title}</strong>
                    <p className="mt-1 text-xs leading-5">{item.explanation}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--color-brand-line)] bg-white/55 p-4">
            <p className={eyebrowClass}>Proximos passos sugeridos</p>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-[var(--color-text-secondary)]">
              {triage.nextSteps.map((step) => (
                <li key={step} className="rounded-2xl bg-white/65 px-3 py-2">{step}</li>
              ))}
            </ul>
          </div>
        </div>

        {triage.pendingQuestions.length > 0 && (
          <div className="rounded-3xl border border-dashed border-[var(--color-brand-line)] bg-white/50 p-4">
            <p className={eyebrowClass}>Perguntas pendentes</p>
            <ul className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
              {triage.pendingQuestions.map((question) => (
                <li key={question} className="rounded-2xl bg-white/70 px-3 py-2">{question}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Triagem da queixa">
        <CheckboxList
          options={TRIAGE_COMPLAINT_OPTIONS}
          value={triagemQueixa.queixas}
          onChange={(key, checked) => patchTriagem({ queixas: { ...triagemQueixa.queixas, [key]: checked } })}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Quando comecou?" value={triagemQueixa.inicio} onChange={(inicio) => patchTriagem({ inicio })} />
          <Field label="Como evoluiu?" value={triagemQueixa.evolucao} onChange={(evolucao) => patchTriagem({ evolucao })} placeholder="Subito, gradual, piorou, melhorou ou estavel" />
          <Field label="Quando percebe mais?" value={triagemQueixa.momentoPercebido} onChange={(momentoPercebido) => patchTriagem({ momentoPercebido })} placeholder="Ao lavar, pentear ou ao longo do dia" />
          <Field label="Queda pela raiz ou quebra?" value={triagemQueixa.quedaRaizOuQuebra} onChange={(quedaRaizOuQuebra) => patchTriagem({ quedaRaizOuQuebra })} />
        </div>
        <TextArea label="Observacoes da queixa" value={triagemQueixa.observacoes} onChange={(observacoes) => patchTriagem({ observacoes })} />
      </Card>

      <Card title="Fatores recentes">
        <CheckboxList
          options={RECENT_FACTOR_OPTIONS}
          value={fatoresRecentes.fatores}
          onChange={(key, checked) => patchFatores({ fatores: { ...fatoresRecentes.fatores, [key]: checked } })}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextArea label="Detalhes dos fatores recentes" value={fatoresRecentes.detalhes} onChange={(detalhes) => patchFatores({ detalhes })} />
          <TextArea label="Medicamentos/suplementos citados" value={fatoresRecentes.medicamentos} onChange={(medicamentos) => patchFatores({ medicamentos })} />
          <TextArea label="Historico hormonal relevante" value={fatoresRecentes.historicoHormonal} onChange={(historicoHormonal) => patchFatores({ historicoHormonal })} />
        </div>
      </Card>

      <Card title="Mapa do couro cabeludo">
        <div className="grid gap-3 xl:grid-cols-2">
          {SCALP_REGIONS.map((region) => {
            const regionValue = mapaCouroCabeludo[region.key] ?? {};
            return (
              <div key={region.key} className="rounded-3xl border border-[var(--color-brand-line)] bg-white/55 p-4">
                <p className={eyebrowClass}>{region.label}</p>
                <div className="mt-3">
                  <CheckboxList
                    options={SCALP_FINDING_OPTIONS}
                    value={regionValue.achados}
                    onChange={(key, checked) => updateScalpFinding(region.key, key, checked)}
                    columns="md:grid-cols-2"
                  />
                </div>
                <div className="mt-3">
                  <TextArea label="Observacoes da regiao" value={regionValue.observacoes} onChange={(value) => updateScalpObservation(region.key, value)} minHeight={70} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Historico quimico e rotina">
        <CheckboxList
          options={CHEMICAL_OPTIONS}
          value={historicoQuimico.procedimentos}
          onChange={(key, checked) => patchHistoricoQuimico({ procedimentos: { ...historicoQuimico.procedimentos, [key]: checked } })}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Data do ultimo procedimento" type="date" value={historicoQuimico.dataUltimoProcedimento} onChange={(dataUltimoProcedimento) => patchHistoricoQuimico({ dataUltimoProcedimento })} />
          <Field label="Chapinha/secador frequente?" value={historicoQuimico.usoCalorFrequente} onChange={(usoCalorFrequente) => patchHistoricoQuimico({ usoCalorFrequente })} />
          <Field label="Corte quimico?" value={historicoQuimico.corteQuimico} onChange={(corteQuimico) => patchHistoricoQuimico({ corteQuimico })} />
          <Field label="Elasticidade" value={historicoQuimico.elasticidade} onChange={(elasticidade) => patchHistoricoQuimico({ elasticidade })} />
          <Field label="Porosidade" value={historicoQuimico.porosidade} onChange={(porosidade) => patchHistoricoQuimico({ porosidade })} />
          <Field label="Quebra apos quimica?" value={historicoQuimico.quebraAposQuimica} onChange={(quebraAposQuimica) => patchHistoricoQuimico({ quebraAposQuimica })} />
        </div>
        <TextArea label="Observacoes tecnicas do historico quimico" value={historicoQuimico.observacoes} onChange={(observacoes) => patchHistoricoQuimico({ observacoes })} />

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Frequencia de lavagem" value={rotinaCapilar.frequenciaLavagem} onChange={(frequenciaLavagem) => patchRotina({ frequenciaLavagem })} />
          <Field label="Produtos usados" value={rotinaCapilar.produtosUsados} onChange={(produtosUsados) => patchRotina({ produtosUsados })} />
          <Field label="Condicionador/mascara na raiz?" value={rotinaCapilar.condicionadorMascaraNaRaiz} onChange={(condicionadorMascaraNaRaiz) => patchRotina({ condicionadorMascaraNaRaiz })} />
          <Field label="Tonico" value={rotinaCapilar.tonico} onChange={(tonico) => patchRotina({ tonico })} />
          <Field label="Oleo" value={rotinaCapilar.oleo} onChange={(oleo) => patchRotina({ oleo })} />
          <Field label="Finalizador" value={rotinaCapilar.finalizador} onChange={(finalizador) => patchRotina({ finalizador })} />
          <Field label="Uso de chapinha/secador" value={rotinaCapilar.usoChapinhaSecador} onChange={(usoChapinhaSecador) => patchRotina({ usoChapinhaSecador })} />
          <Field label="Dorme/prende molhado?" value={rotinaCapilar.dormeOuPrendeMolhado} onChange={(dormeOuPrendeMolhado) => patchRotina({ dormeOuPrendeMolhado })} />
          <Field label="Bone/capacete" value={rotinaCapilar.boneCapacete} onChange={(boneCapacete) => patchRotina({ boneCapacete })} />
          <Field label="Penteados apertados" value={rotinaCapilar.penteadosApertados} onChange={(penteadosApertados) => patchRotina({ penteadosApertados })} />
        </div>
        <TextArea label="Cronograma e observacoes da rotina" value={rotinaCapilar.cronograma || rotinaCapilar.observacoes} onChange={(cronograma) => patchRotina({ cronograma })} />
      </Card>

      <Card title="Registro de tricoscopia">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">Use este bloco para vincular regiao, imagem e comparacao tecnica sem fechar conclusao medica.</p>
          <button type="button" onClick={addTricoscopyRecord} className="rounded-xl bg-[#7a4921] px-4 py-2 text-sm font-semibold text-white hover:bg-[#623915]">
            + Adicionar registro
          </button>
        </div>
        {registrosTricoscopia.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-[var(--color-brand-line)] bg-white/55 p-4 text-sm text-[var(--color-text-secondary)]">
            Nenhum registro de tricoscopia ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {registrosTricoscopia.map((registro, index) => (
              <div key={registro.id ?? index} className="rounded-3xl border border-[var(--color-brand-line)] bg-white/55 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className={eyebrowClass}>Tricoscopia {index + 1}</p>
                  <button type="button" onClick={() => removeTricoscopyRecord(index)} className="text-xs font-semibold text-rose-700">
                    Remover
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Data" type="date" value={registro.data} onChange={(data) => updateTricoscopyRecord(index, { data })} />
                  <Field label="Regiao" value={registro.regiao} onChange={(regiao) => updateTricoscopyRecord(index, { regiao })} />
                  <PhotoSelect label="Imagem vinculada" value={registro.imagemVinculada} photos={photos} onChange={(imagemVinculada) => updateTricoscopyRecord(index, { imagemVinculada })} />
                  <Field label="Densidade visual" value={registro.densidadeVisual} onChange={(densidadeVisual) => updateTricoscopyRecord(index, { densidadeVisual })} />
                  <TextArea label="Observacoes do couro" value={registro.observacoesCouro} onChange={(observacoesCouro) => updateTricoscopyRecord(index, { observacoesCouro })} />
                  <TextArea label="Observacoes dos fios" value={registro.observacoesFios} onChange={(observacoesFios) => updateTricoscopyRecord(index, { observacoesFios })} />
                  <TextArea label="Residuos/descamacao" value={registro.residuosDescamacao} onChange={(residuosDescamacao) => updateTricoscopyRecord(index, { residuosDescamacao })} />
                  <TextArea label="Comparacao anterior" value={registro.comparacaoAnterior} onChange={(comparacaoAnterior) => updateTricoscopyRecord(index, { comparacaoAnterior })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Plano de Cuidado Capilar">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Objetivo principal" value={planoCuidado.objetivoPrincipal} onChange={(objetivoPrincipal) => patchPlano({ objetivoPrincipal })} />
          <Field label="Numero de sessoes" value={planoCuidado.numeroSessoes} onChange={(numeroSessoes) => patchPlano({ numeroSessoes })} />
          <Field label="Frequencia" value={planoCuidado.frequencia} onChange={(frequencia) => patchPlano({ frequencia })} />
          <Field label="Retorno sugerido" type="date" value={planoCuidado.retornoSugerido} onChange={(retornoSugerido) => patchPlano({ retornoSugerido })} />
          <TextArea label="Protocolo sugerido" value={planoCuidado.protocoloSugerido} onChange={(protocoloSugerido) => patchPlano({ protocoloSugerido })} />
          <TextArea label="Cuidados em casa" value={planoCuidado.cuidadosEmCasa} onChange={(cuidadosEmCasa) => patchPlano({ cuidadosEmCasa })} />
          <TextArea label="Home care" value={planoCuidado.homeCare} onChange={(homeCare) => patchPlano({ homeCare })} />
          <TextArea label="Cuidados a evitar" value={planoCuidado.cuidadosEvitar} onChange={(cuidadosEvitar) => patchPlano({ cuidadosEvitar })} />
        </div>
        <TextArea label="Observacoes da profissional" value={planoCuidado.observacoesProfissional} onChange={(observacoesProfissional) => patchPlano({ observacoesProfissional })} />
      </Card>

      <Card title="Evolucao por sessao">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">Registre resposta, produtos, fotos vinculadas e o proximo passo de cada encontro.</p>
          <button type="button" onClick={addEvolutionRecord} className="rounded-xl bg-[#7a4921] px-4 py-2 text-sm font-semibold text-white hover:bg-[#623915]">
            + Adicionar registro de evolucao
          </button>
        </div>
        {evolucaoSessoes.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-[var(--color-brand-line)] bg-white/55 p-4 text-sm text-[var(--color-text-secondary)]">
            Nenhuma sessao registrada neste plano ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {evolucaoSessoes.map((sessao, index) => (
              <div key={sessao.id ?? index} className="rounded-3xl border border-[var(--color-brand-line)] bg-white/55 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className={eyebrowClass}>Sessao {sessao.sessao || index + 1}</p>
                  <button type="button" onClick={() => removeEvolutionRecord(index)} className="text-xs font-semibold text-rose-700">
                    Remover
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Data" type="date" value={sessao.data} onChange={(data) => updateEvolutionRecord(index, { data })} />
                  <Field label="Sessao" value={sessao.sessao} onChange={(value) => updateEvolutionRecord(index, { sessao: value })} />
                  <TextArea label="Procedimento" value={sessao.procedimento} onChange={(procedimento) => updateEvolutionRecord(index, { procedimento })} />
                  <TextArea label="Resposta da cliente" value={sessao.respostaCliente} onChange={(respostaCliente) => updateEvolutionRecord(index, { respostaCliente })} />
                  <TextArea label="Produtos usados" value={sessao.produtosUsados} onChange={(produtosUsados) => updateEvolutionRecord(index, { produtosUsados })} />
                  <div className="space-y-3">
                    <PhotoSelect
                      label="Adicionar foto da galeria"
                      value=""
                      photos={photos}
                      onChange={(photoId) => updateEvolutionRecord(index, { fotosVinculadas: appendPhotoId(sessao.fotosVinculadas, photoId) })}
                    />
                    <TextArea label="Fotos vinculadas" value={sessao.fotosVinculadas} onChange={(fotosVinculadas) => updateEvolutionRecord(index, { fotosVinculadas })} />
                  </div>
                  <TextArea label="Orientacao em casa" value={sessao.orientacaoCasa} onChange={(orientacaoCasa) => updateEvolutionRecord(index, { orientacaoCasa })} />
                  <TextArea label="Proximo passo" value={sessao.proximoPasso} onChange={(proximoPasso) => updateEvolutionRecord(index, { proximoPasso })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Consentimentos e revisao">
        <CheckboxList
          options={CONSENT_OPTIONS}
          value={consentimentos as Record<string, boolean | undefined>}
          onChange={(key, checked) => patchConsentimentos({ [key]: checked } as NonNullable<FichaCapilar360Dados["consentimentos"]>)}
          columns="md:grid-cols-2"
        />
      </Card>
    </section>
  );
}
