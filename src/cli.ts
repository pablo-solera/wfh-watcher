import { mkdir, writeFile } from "node:fs/promises";
import { groupByMonth } from "./calendar/months.js";
import { renderMonthPng } from "./calendar/render.js";
import type { WfhChange } from "./watcher/types.js";

// Uso: npm run calendar -- 2026-11-23 2026-11-25   (día original, día nuevo)
async function main(): Promise<void> {
  const [from, to] = process.argv.slice(2);
  const change: WfhChange = {
    requestId: "demo",
    kind: "substitution",
    comment: null,
    changes: [{ from: from ?? "2026-11-23", to: to ?? "2026-11-25" }],
  };

  await mkdir("tmp", { recursive: true });
  const months = groupByMonth(change);
  for (const [index, month] of months.entries()) {
    const file = `tmp/calendario-${index + 1}.png`;
    await writeFile(file, renderMonthPng(month));
    console.log(`Generado ${file}`);
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
