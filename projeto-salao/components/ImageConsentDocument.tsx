"use client";

import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";

function buildImageConsentSections(clinicDisplayName: string) {
  return [
    {
      title: "Finalidade do registro",
      body:
        `As imagens clínicas servem para documentar o estado inicial, acompanhar a evolução terapêutica, comparar resultados com segurança e orientar decisões técnicas da equipe da ${clinicDisplayName}.`,
    },
    {
      title: "Forma de uso",
      body:
        "As fotos ficam vinculadas ao prontuário da paciente e são destinadas ao uso técnico interno da clínica. Elas não serão publicadas, compartilhadas externamente ou usadas em material comercial sem uma autorização específica e adicional.",
    },
    {
      title: "Armazenamento e acesso",
      body:
        "Os registros são armazenados em ambiente digital controlado, com acesso restrito à equipe responsável pelo atendimento, acompanhamento e auditoria clínica.",
    },
    {
      title: "Direitos da paciente",
      body:
        "A paciente pode esclarecer dúvidas antes de consentir, pedir correção de dados cadastrais e solicitar que novas capturas de imagem não sejam realizadas em atendimentos futuros, respeitados os registros técnicos já incorporados ao prontuário.",
    },
  ];
}

interface ImageConsentDocumentProps {
  className?: string;
  compact?: boolean;
}

export default function ImageConsentDocument({
  className = "",
  compact = false,
}: ImageConsentDocumentProps) {
  const { config } = useBrandingConfig();
  const sections = buildImageConsentSections(getBrandDisplayTitle(config));

  return (
    <article
      className={`rounded-[28px] border border-[var(--color-brand-line)] bg-white/75 p-5 text-sm text-[var(--color-text-secondary)] ${className}`.trim()}
    >
      <div className={`space-y-4 ${compact ? "max-h-72 overflow-y-auto pr-2" : ""}`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
            Termo de leitura prévia
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">
            Consentimento para registro de imagem clínica
          </h3>
          <p className="mt-2 leading-6">
            Leia este documento antes de autorizar o uso de imagem. O aceite confirma apenas o uso técnico interno descrito abaixo.
          </p>
        </div>

        {sections.map((section) => (
          <section key={section.title} className="space-y-2 border-t border-[var(--color-brand-line)] pt-4 first:border-t-0 first:pt-0">
            <h4 className="text-sm font-semibold text-[var(--color-text)]">{section.title}</h4>
            <p className="leading-6">{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}