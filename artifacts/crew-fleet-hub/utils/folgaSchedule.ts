export const FOLGA_GROUPS = ["GF1","GF2","GF3","GF4","GF5","GF6","GF7","GF8"] as const;
export type FolgaGroup = typeof FOLGA_GROUPS[number];

// ─── Ciclo rotativo de 56 dias ──────────────────────────────────────────────
// Os 7 padrões de folga rodam em sequência, começando sempre ao sábado (dia 0):
//
//  Dias 0-2   → Sáb+Dom+Seg  (3 dias)
//  Dias 3-8   → Trabalho     (6 dias)
//  Dias 9-10  → Seg+Ter      (2 dias)
//  Dias 11-16 → Trabalho     (6 dias)
//  Dias 17-18 → Ter+Qua      (2 dias)
//  Dias 19-24 → Trabalho     (6 dias)
//  Dias 25-26 → Qua+Qui      (2 dias)
//  Dias 27-32 → Trabalho     (6 dias)
//  Dias 33-34 → Qui+Sex      (2 dias)
//  Dias 35-40 → Trabalho     (6 dias)
//  Dias 41-43 → Sex+Sáb+Dom  (3 dias)
//  Dias 44-48 → Trabalho     (5 dias)
//  Dias 49-50 → Sáb+Dom      (2 dias)
//  Dias 51-55 → Trabalho     (5 dias)
//  Dia  56    → volta ao 0 (Sáb+Dom+Seg)
//
// Verificação com a tabela AV/DO/027/2025:
//   GF1 Jan: 3,4,5 | 12,13 | 20,21 | 28,29  ← Sáb+Dom+Seg → Seg+Ter → Ter+Qua → Qua+Qui
//   GF2 Jan: 5,6 | 13,14 | 21,22 | 29,30    ← Seg+Ter → Ter+Qua → Qua+Qui → Qui+Sex
//   GF7 Jan: 2,3,4 | 10,11 | 17,18,19 | 26,27 ← Sex+Sáb+Dom → Sáb+Dom → Sáb+Dom+Seg → Seg+Ter
//   GF8 Jan: 3,4 | 10,11,12 | 19,20 | 27,28  ← Sáb+Dom → Sáb+Dom+Seg → Seg+Ter → Ter+Qua

const CYCLE_LENGTH = 56;

// Dias dentro do ciclo de 56 que são folga
const FOLGA_CYCLE_DAYS = new Set([
  0, 1, 2,        // Sáb+Dom+Seg
  9, 10,          // Seg+Ter
  17, 18,         // Ter+Qua
  25, 26,         // Qua+Qui
  33, 34,         // Qui+Sex
  41, 42, 43,     // Sex+Sáb+Dom
  49, 50,         // Sáb+Dom
]);

// Data-âncora de cada grupo = início do ciclo (dia 0 = Sáb+Dom+Seg).
// Cada grupo está desfasado 7 dias do anterior.
// Verificado contra a tabela: o dia 0 cai sempre num sábado.
const GROUP_ANCHORS: Record<FolgaGroup, string> = {
  GF1: "2026-01-03",  // Sáb — inicia diretamente a slot Sáb+Dom+Seg
  GF2: "2025-12-27",  // Sáb
  GF3: "2025-12-20",  // Sáb
  GF4: "2025-12-13",  // Sáb
  GF5: "2025-12-06",  // Sáb
  GF6: "2025-11-29",  // Sáb
  GF7: "2025-11-22",  // Sáb
  GF8: "2025-11-15",  // Sáb
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function isFolgaDay(group: FolgaGroup, dateIso: string): boolean {
  const anchor = new Date(GROUP_ANCHORS[group] + "T00:00:00");
  const date   = new Date(dateIso          + "T00:00:00");
  const diff   = daysBetween(anchor, date);
  const cycleDay = ((diff % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  return FOLGA_CYCLE_DAYS.has(cycleDay);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function getFolgaDays(group: FolgaGroup, year: number, month: number): string[] {
  const result: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    if (isFolgaDay(group, iso)) result.push(iso);
  }
  return result;
}

export function getFolgaDaysForYear(group: FolgaGroup, year: number): string[] {
  const result: string[] = [];
  for (let m = 0; m < 12; m++) {
    result.push(...getFolgaDays(group, year, m));
  }
  return result;
}
