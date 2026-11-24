import type { WfhChange } from "../watcher/types.js";

export interface MonthMarks {
  year: number;
  /** 1-12 */
  month: number;
  /** Días (1-31) que dejan de ser teletrabajo. */
  orange: Set<number>;
  /** Días (1-31) que pasan a ser teletrabajo. */
  green: Set<number>;
}

/** Agrupa los días de un cambio por mes, ordenados cronológicamente. */
export function groupByMonth(change: WfhChange): MonthMarks[] {
  const months = new Map<string, MonthMarks>();

  const mark = (dateKey: string, color: "orange" | "green"): void => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    let entry = months.get(key);
    if (!entry) {
      entry = { year, month, orange: new Set(), green: new Set() };
      months.set(key, entry);
    }
    entry[color].add(day);
  };

  for (const { from, to } of change.changes) {
    if (from) mark(from, "orange");
    if (to) mark(to, "green");
  }

  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}
