import { GalleryPhoto } from "@/types";

export type NormalizedPhotoCategory = "antes" | "depois" | "referencia";

export const GRID_CATEGORIES = {
  COMPARATIVA: "grelha/comparativa",
  IDENTIFICACAO: "grelha/identificacao",
  MOSAICO: "grelha/mosaico",
} as const;

export type PhotoComparisonPair = {
  before: GalleryPhoto;
  after: GalleryPhoto;
  elapsedDays: number;
};

const PHOTO_CATEGORY_LABELS: Record<NormalizedPhotoCategory, string> = {
  antes: "Antes",
  depois: "Depois",
  referencia: "Referência",
};

const BEFORE_CATEGORY_PATTERN = /(^|[^a-z])(antes|before|inicial|inicio|baseline)([^a-z]|$)/;
const AFTER_CATEGORY_PATTERN = /(^|[^a-z])(depois|after|apos|resultado|evolucao)([^a-z]|$)/;
const REFERENCE_CATEGORY_PATTERN = /(^|[^a-z])(referencia|reference|inspiracao)([^a-z]|$)/;

function normalizePhotoToken(value: string | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function detectPhotoCategory(value: GalleryPhoto["type"] | string | undefined): NormalizedPhotoCategory | null {
  const normalized = normalizePhotoToken(value);
  if (!normalized) return null;
  if (BEFORE_CATEGORY_PATTERN.test(normalized)) return "antes";
  if (AFTER_CATEGORY_PATTERN.test(normalized)) return "depois";
  if (REFERENCE_CATEGORY_PATTERN.test(normalized)) return "referencia";
  return null;
}

export function resolvePhotoCategory(...values: Array<GalleryPhoto["type"] | string | undefined>): NormalizedPhotoCategory {
  for (const value of values) {
    const category = detectPhotoCategory(value);
    if (category) return category;
  }

  return "referencia";
}

export function normalizePhotoCategory(type: GalleryPhoto["type"] | string | undefined): NormalizedPhotoCategory {
  return resolvePhotoCategory(type);
}

export function getPhotoCategoryLabel(type: GalleryPhoto["type"] | string | undefined) {
  return PHOTO_CATEGORY_LABELS[normalizePhotoCategory(type)];
}

export function sanitizePhotoCaption(caption?: string) {
  const trimmed = caption?.trim();
  if (!trimmed) return undefined;
  if (/[\\/]/.test(trimmed)) return undefined;
  if (/^(captura|img|image|photo|pxl|dsc|whatsapp image|media)([-_ ]|$)/i.test(trimmed)) return undefined;
  if (/\.(jpe?g|png|webp|heic|heif)$/i.test(trimmed)) return undefined;
  return trimmed;
}

export function getPhotoDifferenceInDays(beforeDate: string, afterDate: string): number {
  const before = new Date(beforeDate);
  const after = new Date(afterDate);
  if (Number.isNaN(before.getTime()) || Number.isNaN(after.getTime())) return 0;

  const difference = after.getTime() - before.getTime();
  return Math.max(0, Math.round(difference / (1000 * 60 * 60 * 24)));
}

export function buildPhotoComparisonPairs(photos: readonly GalleryPhoto[]): PhotoComparisonPair[] {
  const sortedBefore = photos
    .filter((photo) => normalizePhotoCategory(photo.type) === "antes")
    .slice()
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  const sortedAfter = photos
    .filter((photo) => normalizePhotoCategory(photo.type) === "depois")
    .slice()
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  const pairs: PhotoComparisonPair[] = [];
  const usedAfter = new Set<string>();

  for (const before of sortedBefore) {
    const beforeTime = new Date(before.date).getTime();
    const candidate = sortedAfter.find((after) => {
      if (usedAfter.has(after.id)) return false;
      return new Date(after.date).getTime() >= beforeTime;
    });

    if (!candidate) continue;
    usedAfter.add(candidate.id);
    pairs.push({
      before,
      after: candidate,
      elapsedDays: getPhotoDifferenceInDays(before.date, candidate.date),
    });
  }

  return pairs;
}