"use client";

import Image from "next/image";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";

type BrandMarkProps = {
  className?: string;
};

/**
 * Renders the brand icon/mark using the dynamic logo from branding config.
 * Falls back to /logo-al.png when no custom logo is configured.
 */
export default function BrandMark({ className = "" }: BrandMarkProps) {
  const { config } = useBrandingConfig();
  const logoSrc = config.logoUrl || "/logo-al.png";

  return (
    <Image
      src={logoSrc}
      alt={config.clinicName || "Al'maré"}
      width={48}
      height={48}
      unoptimized
      className={`object-contain ${className}`.trim()}
    />
  );
}