"use client";

import Image from "next/image";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";

type BrandLogoProps = {
  compact?: boolean;
  subtitle?: boolean;
  align?: "left" | "center";
  className?: string;
  name?: string;
  subtitleText?: string;
  priority?: boolean;
};

/**
 * Renders the full brand logo (image + optional subtitle text).
 * The `compact` prop controls the image size.
 * NOTE: Uses `fill` layout — the parent container defines the visible area.
 */
export default function BrandLogo({
  compact = false,
  subtitle = true,
  align = "left",
  className = "",
  name,
  subtitleText,
  priority = false,
}: BrandLogoProps) {
  const { config } = useBrandingConfig();
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";
  const brandName = name ?? config.clinicName;
  const brandSubtitle = subtitleText ?? config.clinicSubtitle;
  const logoSrc = config.logoUrl || "/logo-al.png";
  const logoBoxClass = compact ? "h-7 w-28 sm:h-10 sm:w-40" : "h-12 w-40 sm:h-20 sm:w-64";
  const logoPositionClass = align === "center" ? "object-center" : "object-left";

  return (
    <div className={`flex flex-col ${alignment} ${className}`.trim()}>
      <div className={`relative ${logoBoxClass}`}>
        <Image
          src={logoSrc}
          alt={brandName}
          fill
          priority={priority}
          sizes={compact ? "(min-width: 640px) 10rem, 8rem" : "(min-width: 640px) 16rem, 12rem"}
          className={`object-contain ${logoPositionClass}`}
        />
      </div>
      {subtitle && brandSubtitle && (
        <span className={`${compact ? "text-[10px]" : "text-xs"} mt-1 uppercase tracking-[0.35em] text-[var(--color-brand-accent)]`}>
          {brandSubtitle}
        </span>
      )}
    </div>
  );
}