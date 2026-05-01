export const FOLGA_GROUPS = ["GF1","GF2","GF3","GF4","GF5","GF6","GF7","GF8"] as const;
export type FolgaGroup = typeof FOLGA_GROUPS[number];

// Day of week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// GF1: Seg+Ter | GF2: Ter+Qua | GF3: Qua+Qui | GF4: Qui+Sex
// GF5: Sex+Sáb+Dom | GF6: Sáb+Dom | GF7: Sáb+Dom+Seg | GF8: Dom+Seg
const GROUP_WEEKDAYS: Record<FolgaGroup, number[]> = {
  GF1: [1, 2],       // Mon, Tue
  GF2: [2, 3],       // Tue, Wed
  GF3: [3, 4],       // Wed, Thu
  GF4: [4, 5],       // Thu, Fri
  GF5: [5, 6, 0],    // Fri, Sat, Sun
  GF6: [6, 0],       // Sat, Sun
  GF7: [6, 0, 1],    // Sat, Sun, Mon
  GF8: [0, 1],       // Sun, Mon
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function getFolgaDays(group: FolgaGroup, year: number, month: number): string[] {
  const weekdays = GROUP_WEEKDAYS[group];
  const result: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (weekdays.includes(dow)) {
      result.push(`${year}-${pad(month + 1)}-${pad(d)}`);
    }
  }
  return result;
}

export function isFolgaDay(group: FolgaGroup, dateIso: string): boolean {
  const weekdays = GROUP_WEEKDAYS[group];
  const date = new Date(dateIso + "T00:00:00");
  return weekdays.includes(date.getDay());
}

export function getFolgaDaysForYear(group: FolgaGroup, year: number): string[] {
  const result: string[] = [];
  for (let m = 0; m < 12; m++) {
    result.push(...getFolgaDays(group, year, m));
  }
  return result;
}
