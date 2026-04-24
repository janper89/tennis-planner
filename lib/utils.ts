import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getWeekNumber(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export function getWeekRange(date: Date | string): { start: Date; end: Date } {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Věk k 1.1. referenčního roku (pro sezónu). */
export function getAgeFromBirthDate(
  birthDate: string,
  referenceDate?: Date
): number {
  const ref = referenceDate ?? new Date();
  const birth = new Date(birthDate);
  const refYear = ref.getFullYear();
  const birthYear = birth.getFullYear();
  return Math.max(0, refYear - birthYear);
}

/** Format category for display – supports both string[] (new) and string (legacy) */
export function formatCategory(cat: string[] | string | null | undefined): string {
  if (cat == null) return '-';
  if (Array.isArray(cat)) return cat.length ? cat.join(', ') : '-';
  return typeof cat === 'string' && cat.trim() ? cat.trim() : '-';
}

/** Normalize tournament name – removes duplication e.g. "J100 LOUGHBOROUGHJ100 LOUGHBOROUGH (GBR)" → "J100 LOUGHBOROUGH (GBR)" */
export function formatTournamentName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return name || '';
  return name.replace(/^([JW]\d+\s+[A-Za-z]+)\1/i, '$1').trim();
}

/** Max. počet turnajů dle věku: 13→10, 14→14, 15→18, 16→25; <13→10, >16→25. */
export function getMaxTournamentsForAge(age: number): number {
  if (age <= 13) return 10;
  if (age === 14) return 14;
  if (age === 15) return 18;
  return 25; // 16+
}

export function formatShortPlayerName(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const lastName = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((part) => part.charAt(0).toUpperCase())
    .join('.');

  return `${initials}.${lastName}`;
}

export function formatCompactTournamentLabel(
  category: string | null | undefined,
  city: string | null | undefined,
  fallbackName?: string | null
): string {
  const trimmedCategory = category?.trim() ?? '';
  const trimmedCity = city?.trim() ?? '';
  const countryMatch = fallbackName?.match(/\(([A-Z]{3})\)/);
  const country = countryMatch?.[0] ?? '';

  const pieces = [trimmedCategory, trimmedCity].filter(Boolean);
  if (pieces.length === 0) {
    return formatTournamentName(fallbackName ?? '');
  }
  return `${pieces.join(' ')}${country ? ` ${country}` : ''}`.trim();
}

/**
 * Active entry = přihláška, která se fakticky hraje nebo už odehrála.
 * Používá se napříč UI v "minimal tournament mode" pro ✓ a filtraci.
 */
export function isActiveEntry(
  status: string | null | undefined
): boolean {
  return status === 'planovano' || status === 'odehrano';
}

