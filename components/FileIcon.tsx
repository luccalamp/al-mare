"use client";

interface FileIconProps {
  label: string;
  extension: "ts" | "md" | "json" | "pdf" | "";
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export default function FileIcon({
  label,
  extension,
  selected,
  onClick,
  onDoubleClick,
}: FileIconProps) {
  // Config cores baseadas na extensão
  const fileColors: Record<string, { front: string; back: string; text: string }> = {
    ts: { back: "#2979ff", front: "#448aff", text: "TS" }, // Azul TypeScript
    md: { back: "#607d8b", front: "#78909c", text: "MD" }, // Cinza Markdown
    json: { back: "#fbc02d", front: "#fdd835", text: "{}" }, // Amarelo JSON
    pdf: { back: "#d32f2f", front: "#ef5350", text: "PDF" },
    default: { back: "#bdbdbd", front: "#e0e0e0", text: "FILE" },
  };

  const color = fileColors[extension] || fileColors.default;

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
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onTouchEnd={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDoubleClick();
        }
      }}
    >
      {/* File SVG — macOS Sonoma style (light-adapted) */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Base paper */}
          <path
            d="M20 10 C20 6 23 4 27 4 L55 4 L80 29 L80 90 C80 94 77 96 73 96 L27 96 C23 96 20 94 20 90 Z"
            fill="url(#fileBack)"
          />

          {/* Folded corner */}
          <path
            d="M55 4 L80 29 L55 29 Z"
            fill="url(#fileFold)"
          />

          {/* Glass shine */}
          <path
            d="M20 30 Q50 25 80 35 L80 40 Q50 30 20 40 Z"
            fill="rgba(255,255,255,0.4)"
          />

          {/* Extension Label Badge */}
          <rect x="28" y="55" width="44" height="24" rx="4" fill="rgba(255,255,255,0.95)" />
          <text
            x="50"
            y="72"
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fontFamily="system-ui, -apple-system"
            fill={color.back}
          >
            {color.text}
          </text>

          <defs>
            <linearGradient id="fileBack" x1="50" y1="4" x2="50" y2="96" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f0f0f5" />
            </linearGradient>
            <linearGradient id="fileFold" x1="55" y1="4" x2="80" y2="29" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f9f9fc" />
              <stop offset="100%" stopColor="#dce0e5" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* File name — dark graphite on light bg */}
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
