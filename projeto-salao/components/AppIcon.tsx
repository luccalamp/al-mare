"use client";

import { useSafeIconInteraction } from "@/hooks/useSafeIconInteraction";

interface AppIconProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export default function AppIcon({
  label,
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
      className={`folder-item group flex flex-col items-center gap-1.5 rounded-2xl p-2 cursor-pointer select-none transition-all duration-150
        ${
          selected
            ? "bg-[rgba(122,73,33,0.12)] ring-1 ring-[rgba(122,73,33,0.22)]"
            : "hover:bg-[rgba(74,44,26,0.05)]"
        }`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${label}`}
      {...iconInteractionProps}
    >
      {/* App SVG — macOS style specific for Analytics */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Base squircle */}
          <rect x="15" y="15" width="70" height="70" rx="16" fill="url(#appBgGradient)" />

          {/* Graph bars */}
          <rect x="30" y="55" width="8" height="20" rx="2" fill="#fff" opacity="0.9" />
          <rect x="46" y="40" width="8" height="35" rx="2" fill="#fff" opacity="0.95" />
          <rect x="62" y="25" width="8" height="50" rx="2" fill="#fff" opacity="1" />

          {/* Line overlay */}
          <path d="M 34 50 L 50 35 L 66 18" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round" />

          {/* Glass Overlay for 3D feel */}
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

      {/* Label */}
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
