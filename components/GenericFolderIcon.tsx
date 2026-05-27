"use client";

import { memo } from "react";
import { useSafeIconInteraction } from "@/hooks/useSafeIconInteraction";

interface GenericFolderIconProps {
  label: string;
  caption?: string;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

function GenericFolderIcon({
  label,
  caption = "Biblioteca",
  selected,
  onClick,
  onDoubleClick,
}: GenericFolderIconProps) {
  const { iconInteractionProps } = useSafeIconInteraction({
    onSelect: onClick,
    onOpen: onDoubleClick,
  });

  return (
    <div
      className={`folder-item group flex flex-col items-center gap-2 rounded-[1.7rem] p-2.5 cursor-pointer select-none transition-all duration-200
        ${selected
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
            viewBox="0 0 100 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full drop-shadow-md"
          >
            <path
              d="M5 22 C5 18 8 15 12 15 L38 15 L44 22 L88 22 C92 22 95 25 95 29 L95 69 C95 73 92 76 88 76 L12 76 C8 76 5 73 5 69 Z"
              fill="url(#folderBackGen)"
            />
            <path
              d="M5 28 C5 24 8 22 12 22 L88 22 C92 22 95 25 95 29 L95 69 C95 73 92 76 88 76 L12 76 C8 76 5 73 5 69 Z"
              fill="url(#folderFrontGen)"
            />
            <path
              d="M10 24 Q52 20 90 26 L88 32 Q50 28 12 32 Z"
              fill="rgba(255,255,255,0.5)"
            />
            <defs>
              <linearGradient id="folderBackGen" x1="50" y1="15" x2="50" y2="76" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D7B289" />
                <stop offset="100%" stopColor="#8F5E34" />
              </linearGradient>
              <linearGradient id="folderFrontGen" x1="50" y1="22" x2="50" y2="76" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E6C8A4" />
                <stop offset="100%" stopColor="#B57A44" />
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

export default memo(GenericFolderIcon);
