"use client";

import Image from "next/image";
import { useMemo } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { GalleryPhoto } from "@/types";
import { buildPhotoComparisonPairs } from "@/lib/photos";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleDateString("pt-BR");
}

export default function PhotoEvolutionComparison({ photos }: { photos: readonly GalleryPhoto[] }) {
  const pairs = useMemo(() => buildPhotoComparisonPairs(photos), [photos]);

  return (
    <section className="space-y-4 rounded-[28px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.78)] p-4 shadow-[0_20px_50px_rgba(94,58,28,0.08)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Evolução</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Comparador Antes e Depois</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[rgba(122,73,33,0.08)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-deep)]">
          <Sparkles size={14} />
          {pairs.length} par{pairs.length !== 1 ? "es" : ""}
        </div>
      </div>

      {pairs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--color-brand-line)] bg-white/60 p-6 text-sm text-[var(--color-text-secondary)]">
          Cadastre ao menos uma foto marcada como antes e outra como depois para liberar a linha de evolução do paciente.
        </div>
      ) : (
        <div className="space-y-5">
          {pairs.map((pair) => (
            <article key={`${pair.before.id}-${pair.after.id}`} className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 p-4 shadow-[0_12px_30px_rgba(94,58,28,0.06)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-deep)]">
                  <CalendarDays size={16} />
                  {pair.elapsedDays} dia{pair.elapsedDays !== 1 ? "s" : ""} de intervalo
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {formatDate(pair.before.date)} até {formatDate(pair.after.date)}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="overflow-hidden rounded-[22px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)]">
                  <div className="flex items-center justify-between border-b border-[var(--color-brand-line)] px-4 py-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--color-brand-accent)]">Antes</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(pair.before.date)}</span>
                  </div>
                  <div className="relative aspect-[4/5] w-full">
                    <Image src={pair.before.url} alt="Foto antes" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                  </div>
                </div>

                <div className="overflow-hidden rounded-[22px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)]">
                  <div className="flex items-center justify-between border-b border-[var(--color-brand-line)] px-4 py-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--color-brand-accent)]">Depois</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(pair.after.date)}</span>
                  </div>
                  <div className="relative aspect-[4/5] w-full">
                    <Image src={pair.after.url} alt="Foto depois" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}