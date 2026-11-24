import { createCanvas } from "@napi-rs/canvas";
import type { MonthMarks } from "./months.js";

const FONT = '"DejaVu Sans", "Segoe UI", Arial, sans-serif';
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const ORANGE = "#f97316";
const GREEN = "#22c55e";
const TEXT = "#1f2937";
const MUTED = "#9ca3af";
const BORDER = "#e5e7eb";

const WIDTH = 720;
const PADDING = 38;
const CELL_W = 92;
const CELL_H = 76;
const GAP = 6;
const GRID_TOP = 138;

/** Renderiza el mes como PNG, con los días naranjas y verdes marcados. */
export function renderMonthPng({ year, month, orange, green }: MonthMarks): Buffer {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Lunes = 0 ... Domingo = 6
  const firstOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const rows = Math.ceil((firstOffset + daysInMonth) / 7);
  const height = GRID_TOP + rows * (CELL_H + GAP) + 90;

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);

  ctx.fillStyle = TEXT;
  ctx.font = `bold 36px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${MONTHS[month - 1]} ${year}`, WIDTH / 2, 62);

  ctx.font = `bold 20px ${FONT}`;
  WEEKDAYS.forEach((label, column) => {
    ctx.fillStyle = column >= 5 ? MUTED : TEXT;
    ctx.fillText(label, PADDING + column * (CELL_W + GAP) + CELL_W / 2, 120);
  });

  ctx.textBaseline = "middle";
  for (let day = 1; day <= daysInMonth; day++) {
    const index = firstOffset + day - 1;
    const column = index % 7;
    const row = Math.floor(index / 7);
    const x = PADDING + column * (CELL_W + GAP);
    const y = GRID_TOP + row * (CELL_H + GAP);

    const fill = orange.has(day) ? ORANGE : green.has(day) ? GREEN : null;
    ctx.beginPath();
    ctx.roundRect(x, y, CELL_W, CELL_H, 12);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = fill ? "#ffffff" : column >= 5 ? MUTED : TEXT;
    ctx.font = `${fill ? "bold " : ""}28px ${FONT}`;
    ctx.fillText(String(day), x + CELL_W / 2, y + CELL_H / 2);
  }

  const legendY = height - 42;
  drawLegend(ctx, PADDING, legendY, ORANGE, "Día original");
  drawLegend(ctx, PADDING + 250, legendY, GREEN, "Día nuevo");

  return canvas.toBuffer("image/png");
}

function drawLegend(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number,
  color: string,
  label: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y - 14, 28, 28, 6);
  ctx.fill();
  ctx.fillStyle = TEXT;
  ctx.font = `20px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 40, y);
  ctx.textAlign = "center";
}
