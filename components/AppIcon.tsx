"use client";

import { memo } from "react";
import { useSafeIconInteraction } from "@/hooks/useSafeIconInteraction";

interface AppIconProps {
  label: string;
  caption?: string;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

function AppIcon({
  label,
  caption = "Visao macro",
  selected,
  onClick,
  onDoubleClick,
}: AppIconProps) {
  const { iconInteractionProps } = useSafeIconInteraction({
    onSelect: onClick,
    onOpen: onDoubleClick,
  });

  return (
    <div
      className={`folder-item group flex flex-col items-center gap-2 rounded-[1.7rem] p-2.5 cursor-pointer select-none transition-all duration-200
        ${
          selected
            ? "border-[rgba(122,73,33,0.18)] bg-[linear-gradient(180deg,rgba(255,251,247,0.92),rgba(248,238,227,0.72))] shadow-[0_18px_38px_rgba(122,73,33,0.12)]"
            : "hover:bg-white/30"
        }`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${label}`}
      {...iconInteractionProps}
    >
      <div className="premium-card relative flex h-[6.2rem] w-full max-w-[7.25rem] items-center justify-center rounded-[1.7rem] px-2 sm:h-[7rem] sm:max-w-[7.8rem]">
        <div className="relative h-16 w-16 transition-transform duration-150 group-hover:scale-105 group-active:scale-95 sm:h-20 sm:w-20">
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full drop-shadow-md"
          >
            <rect x="15" y="15" width="70" height="70" rx="16" fill="url(#appBgGradient)" />
            <rect x="30" y="55" width="8" height="20" rx="2" fill="#fff" opacity="0.9" />
            <rect x="46" y="40" width="8" height="35" rx="2" fill="#fff" opacity="0.95" />
            <rect x="62" y="25" width="8" height="50" rx="2" fill="#fff" opacity="1" />
            <path d="M 34 50 L 50 35 L 66 18" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round" />
            <path
              d="M 15 35 Q 50 20 85 35 L 85 15 Q 50 15 15 15 Z"
              fill="rgba(255,255,255,0.4)"
            />
            <defs>
              <linearGradient id="appBgGradient" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D2A679" />
                <stop offset="100%" stopColor="#7A4921" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <span
        className={`folder-item-label max-w-[90px] text-center text-xs leading-tight transition-all sm:max-w-[110px] sm:text-sm ${
          selected
            ? "rounded-full bg-[var(--color-brand-deep)] px-2 py-1 text-white"
            : "text-[var(--color-ink)]"
        }`}
        title={label}
      >
        {label}
      </span>

      <span className="folder-item-caption text-center text-[10px] uppercase tracking-[0.18em]">
        {caption}
      </span>
    </div>
  );
}

export default memo(AppIcon);
