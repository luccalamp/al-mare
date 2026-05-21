"use client";

import { memo } from "react";
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

function FolderIcon({
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
      className={`folder-item group flex flex-col items-center gap-2 rounded-[1.7rem] p-2.5 cursor-pointer select-none transition-all duration-200
        ${selected
          ? "border-[rgba(122,73,33,0.18)] bg-[linear-gradient(180deg,rgba(255,251,247,0.92),rgba(248,238,227,0.72))] shadow-[0_18px_38px_rgba(122,73,33,0.12)]"
          : "hover:bg-white/30"
        }`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir pasta da paciente ${client.profile.nome}`}
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
              fill="url(#folderBack)"
            />
            <path
              d="M5 28 C5 24 8 22 12 22 L88 22 C92 22 95 25 95 29 L95 69 C95 73 92 76 88 76 L12 76 C8 76 5 73 5 69 Z"
              fill="url(#folderFront)"
            />
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

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            {avatarUrl ? (
              <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/80 bg-white/70 shadow-[0_6px_18px_rgba(0,0,0,0.18)] sm:h-10 sm:w-10">
                <Image
                  src={avatarUrl}
                  alt={client.profile.nome}
                  fill
                  unoptimized
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

          {hasAllergy && (
            <span
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md"
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
      </div>

      <span
        className={`folder-item-label max-w-[90px] text-center text-xs leading-tight transition-all sm:max-w-[110px] sm:text-sm ${
          selected
            ? "rounded-full bg-[var(--color-brand-deep)] px-2 py-1 text-white"
            : "text-[var(--color-ink)]"
        }`}
        title={client.profile.nome}
      >
        {client.profile.nome.split(" ")[0]}
      </span>

      <span
        className={`max-w-[108px] rounded-full border px-2.5 py-1 text-center text-[9px] font-bold uppercase tracking-[0.16em] ${journeyToneClass}`}
        title={journey.stageLabel}
      >
        {journey.stageLabel}
      </span>

      <span
        className="folder-item-caption max-w-[110px] text-center text-[10px] leading-4"
        title={journey.nextActionLabel}
      >
        {journey.nextActionLabel}
      </span>
    </div>
  );
}

export default memo(FolderIcon);
