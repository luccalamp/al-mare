"use client";

import { useBrandingConfig } from "@/components/BrandingConfigProvider";

type BrandLogoProps = {
  compact?: boolean;
  subtitle?: boolean;
  align?: "left" | "center";
  className?: string;
  name?: string;
  subtitleText?: string;
};

export default function BrandLogo({
  compact = false,
  subtitle = true,
  align = "left",
  className = "",
  name,
  subtitleText,
}: BrandLogoProps) {
  const { config } = useBrandingConfig();
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";
  const brandName = name ?? config.clinicName;
  const brandSubtitle = subtitleText ?? config.clinicSubtitle;

  if (config.logoUrl) {
    return (
      <div className={`flex flex-col ${alignment} ${className}`.trim()}>
        <img 
          src={config.logoUrl} 
          alt={brandName} 
          className={compact ? "h-6 sm:h-8 w-auto object-contain" : "h-12 sm:h-16 w-auto object-contain"} 
        />
        {subtitle && brandSubtitle && (
          <span className={`${compact ? "text-[10px]" : "text-xs"} mt-1 uppercase tracking-[0.35em] text-[var(--color-brand-accent)]`}>
            {brandSubtitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${alignment} ${className}`.trim()}>
      <span
        className={`${compact ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"} leading-none text-[var(--color-brand-deep)]`}
        style={{
          fontFamily: "var(--font-brand), serif",
          letterSpacing: "0.08em",
          fontWeight: 600,
        }}
      >
        {brandName}
      </span>
      {subtitle && brandSubtitle && (
        <span className={`${compact ? "text-[10px]" : "text-xs"} mt-0.5 uppercase tracking-[0.35em] text-[var(--color-brand-accent)]`}>
          {brandSubtitle}
        </span>
      )}
    </div>
  );
}