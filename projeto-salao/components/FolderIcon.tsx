"use client";

import Image from "next/image";
import { Client } from "@/types";
import { getClientAvatarUrl } from "@/lib/clientMedia";
import { useSafeIconInteraction } from "@/hooks/useSafeIconInteraction";

interface FolderIconProps {
  client: Client;
  onDoubleClick: (client: Client) => void;
  selected: boolean;
  onClick: (client: Client) => void;
}

export default function FolderIcon({
  client,
  onDoubleClick,
  selected,
  onClick,
}: FolderIconProps) {
  const avatarUrl = getClientAvatarUrl(client);
  const initials = client.profile.nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const hasAllergy = Boolean(client.fichaAnamnese?.historicoSaudeGeral?.alergia?.trim());
  const activate = () => onDoubleClick(client);
  const { iconInteractionProps } = useSafeIconInteraction({
    onSelect: () => onClick(client),
    onOpen: activate,
  });
  const journey = client.journey ?? {
    stageLabel: "Cadastro",
    nextActionLabel: "Abrir prontuario",
    tone: "neutral",
  };

  const journeyToneClass = {
    neutral: "bg-white/70 text-[#6e6e73]",
    warning: "bg-amber-100 text-amber-700",
    accent: "bg-[rgba(122,73,33,0.10)] text-[var(--color-brand-deep)]",
    success: "bg-emerald-100 text-emerald-700",
  }[journey.tone];

  return (
    <div
      className={`folder-item group flex flex-col items-center gap-1.5 rounded-2xl p-2 cursor-pointer select-none transition-all duration-150
        ${selected
          ? "bg-[rgba(122,73,33,0.12)] ring-1 ring-[rgba(122,73,33,0.22)]"
          : "hover:bg-[rgba(74,44,26,0.05)]"
        }`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir pasta da paciente ${client.profile.nome}`}
      {...iconInteractionProps}
    >
      {/* Folder SVG — macOS Sonoma style (light-adapted) */}
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
            fill="url(#folderBack)"
          />
          {/* Front face */}
          <path
            d="M5 28 C5 24 8 22 12 22 L88 22 C92 22 95 25 95 29 L95 69 C95 73 92 76 88 76 L12 76 C8 76 5 73 5 69 Z"
            fill="url(#folderFront)"
          />
          {/* Glass shine */}
          <path
            d="M10 24 Q52 20 90 26 L88 32 Q50 28 12 32 Z"
            fill="rgba(255,255,255,0.5)"
          />
          <defs>
            <linearGradient id="folderBack" x1="50" y1="15" x2="50" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C49A72" />
              <stop offset="100%" stopColor="#8C5B2F" />
            </linearGradient>
            <linearGradient id="folderFront" x1="50" y1="22" x2="50" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#D6B08B" />
              <stop offset="100%" stopColor="#A56D3A" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
          {avatarUrl ? (
            <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/80 bg-white/70 shadow-[0_6px_18px_rgba(0,0,0,0.18)] sm:h-10 sm:w-10">
              <Image
                src={avatarUrl}
                alt={client.profile.nome}
                fill
                sizes="(min-width: 640px) 40px, 32px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/28 text-[11px] font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)] sm:h-10 sm:w-10 sm:text-[13px]">
              {initials}
            </div>
          )}
        </div>

        {/* Apple Red allergy badge */}
        {hasAllergy && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md"
            style={{
              background: "#FF3B30",
              border: "1.5px solid rgba(255,255,255,0.9)",
              boxShadow: "0 2px 6px rgba(255,59,48,0.45)",
            }}
            title="Alergias registradas"
          >
            !
          </span>
        )}
      </div>

      {/* Client name — dark graphite on light bg */}
      <span
        className={`text-center text-xs sm:text-sm font-medium leading-tight max-w-[80px] sm:max-w-[100px] truncate transition-all ${
          selected
            ? "bg-[#7a4921] text-white rounded-md px-1.5 py-0.5"
            : "text-[#1d1d1f]"
        }`}
        title={client.profile.nome}
      >
        {client.profile.nome.split(" ")[0]}
      </span>

      <span
        className={`max-w-[96px] rounded-full px-2 py-1 text-center text-[9px] font-bold uppercase tracking-[0.16em] ${journeyToneClass}`}
        title={journey.stageLabel}
      >
        {journey.stageLabel}
      </span>

      <span
        className="max-w-[100px] text-center text-[10px] leading-4 text-[#6e6e73]"
        title={journey.nextActionLabel}
      >
        {journey.nextActionLabel}
      </span>
    </div>
  );
}
