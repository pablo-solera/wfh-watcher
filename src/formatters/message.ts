import type { WfhChange } from "../watcher/types.js";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** YYYY-MM-DD -> "lun 23-11-2026" (sin depender de la zona horaria). */
export function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  const weekday = WEEKDAYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()];
  return `${weekday} ${day}-${month}-${year}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Mensaje en HTML de Telegram. */
export function formatChangeMessage(name: string, change: WfhChange): string {
  const who = `<b>${escapeHtml(name)}</b>`;
  const lines = change.changes.map(({ from, to }) => {
    if (from && to) return `• ${formatDate(from)} → ${formatDate(to)}`;
    return `• ${formatDate((from ?? to)!)}`;
  });

  const title =
    change.kind === "substitution"
      ? `🔄 ${who} ha cambiado su teletrabajo:`
      : change.kind === "removal"
        ? `➖ ${who} ha anulado teletrabajo:`
        : `➕ ${who} ha añadido teletrabajo:`;

  const parts = [title, ...lines];
  if (change.comment) parts.push("", `💬 <i>${escapeHtml(change.comment)}</i>`);
  return parts.join("\n");
}
