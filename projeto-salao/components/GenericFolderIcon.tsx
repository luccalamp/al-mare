"use client";

import { useSafeIconInteraction } from "@/hooks/useSafeIconInteraction";

interface GenericFolderIconProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export default function GenericFolderIcon({
  label,
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
      className={`folder-item group flex flex-col items-center gap-1.5 rounded-2xl p-2 cursor-pointer select-none transition-all duration-150
        ${selected
          ? "bg-[rgba(122,73,33,0.12)] ring-1 ring-[rgba(122,73,33,0.22)]"
          : "hover:bg-[rgba(74,44,26,0.05)]"
        }`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${label}`}
      {...iconInteractionProps}
    >
      {/* Folder SVG */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
        <svg
          viewBox="0 0 100 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Back */}
          <path
            d="M5 22 C5 18 8 15 12 15 L38 15 L44 22 L88 22 C92 22 95 25 95 29 L95 69 C95 73 92 76 88 76 L12 76 C8 76 5 73 5 69 Z"
            fill="url(#folderBackGen)"
          />
          {/* Front face */}
          <path
            d="M5 28 C5 24 8 22 12 22 L88 22 C92 22 95 25 95 29 L95 69 C95 73 92 76 88 76 L12 76 C8 76 5 73 5 69 Z"
            fill="url(#folderFrontGen)"
          />
          {/* Glass shine */}
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

      <span
        className={`text-center text-xs sm:text-sm font-medium leading-tight max-w-[80px] sm:max-w-[100px] truncate transition-all ${
          selected
            ? "bg-[#7a4921] text-white rounded-md px-1.5 py-0.5"
            : "text-[#1d1d1f]"
        }`}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}
