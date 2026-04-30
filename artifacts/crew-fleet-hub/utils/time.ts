export type AffectationType = "normal" | "extra1" | "extra2";

export const AFFECTATION_LABELS: Record<AffectationType, string> = {
  normal: "Normal",
  extra1: "Extra Tipo 1",
  extra2: "Extra Tipo 2",
};

export const DEFAULT_AFFECTATION_LABELS: Record<AffectationType, string> = {
  normal: "Normal",
  extra1: "Extra Normal - Tipo1",
  extra2: "Extra Normal - Tipo2",
};

export function affectationDisplay(
  type: AffectationType,
  custom?: string,
): string {
  const trimmed = custom?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_AFFECTATION_LABELS[type];
}

export function isoToDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function displayDateToIso(input: string): string | null {
  const t = input.trim();
  const m = t.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

export function parseTimeToMinutes(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

export function formatHoursDecimal(totalMinutes: number): string {
  const decimal = totalMinutes / 60;
  return decimal.toFixed(2);
}

export const NORMAL_HOURS_BASE_MINUTES = 8 * 60;

export interface ShiftCalc {
  totalMinutes: number;
  normalMinutes: number;
  extraMinutes: number;
}

export function calcShiftMinutes(
  startMinutes: number,
  endMinutes: number,
): ShiftCalc {
  const total = Math.max(0, endMinutes - startMinutes);
  const normal = Math.min(total, NORMAL_HOURS_BASE_MINUTES);
  const extra = Math.max(0, total - NORMAL_HOURS_BASE_MINUTES);
  return {
    totalMinutes: total,
    normalMinutes: normal,
    extraMinutes: extra,
  };
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDayHeadline(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dd}/${mm}`;
}

export function dateYear(iso: string): number {
  return new Date(iso + "T00:00:00").getFullYear();
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `há ${diffD} d`;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isoMonthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}
