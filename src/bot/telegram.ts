import { Bot, InputFile, InputMediaBuilder } from "grammy";
import { groupByMonth } from "../calendar/months.js";
import { renderMonthPng } from "../calendar/render.js";
import { loadConfig } from "../config.js";
import { createSql } from "../db/client.js";
import { resolveTargetUserId } from "../db/requests.js";
import { formatChangeMessage } from "../formatters/message.js";
import { State } from "../watcher/state.js";
import type { WfhChange } from "../watcher/types.js";
import { startWatcher, type Watcher } from "../watcher/watcher.js";

const CAPTION_LIMIT = 1000;

const config = loadConfig();
const bot = new Bot(config.botToken);
let watcher: Watcher | undefined;

bot.command("start", (ctx) =>
  ctx.reply(`Hola. El ID de este chat es: ${ctx.chat.id}\nPonlo en TELEGRAM_CHAT_ID para recibir aquí los avisos.`),
);

bot.command("estado", async (ctx) => {
  if (String(ctx.chat.id) !== config.chatId) return;
  if (!watcher) {
    await ctx.reply("El vigilante no está activo (falta configuración).");
    return;
  }
  const { listening, lastCheck, lastNotificationAt } = watcher.status();
  await ctx.reply(
    [
      `Vigilando a ${config.targetName}`,
      `Conexión con la base de datos: ${listening ? "activa" : "caída"}`,
      `Última revisión: ${lastCheck ?? "—"}`,
      `Último aviso: ${lastNotificationAt ?? "ninguno"}`,
    ].join("\n"),
  );
});

bot.catch((err) => console.error("Error en el bot:", err));

async function sendChange(chatId: string, change: WfhChange): Promise<void> {
  const images = groupByMonth(change).map(renderMonthPng);
  const text = formatChangeMessage(config.targetName, change);
  const useCaption = text.length <= CAPTION_LIMIT;
  const captionOptions = { caption: text, parse_mode: "HTML" as const };

  if (images.length === 1) {
    await bot.api.sendPhoto(chatId, new InputFile(images[0], "calendario.png"), useCaption ? captionOptions : {});
  } else {
    await bot.api.sendMediaGroup(
      chatId,
      images.map((image, index) =>
        InputMediaBuilder.photo(
          new InputFile(image, `calendario-${index + 1}.png`),
          index === 0 && useCaption ? captionOptions : {},
        ),
      ),
    );
  }
  if (!useCaption) await bot.api.sendMessage(chatId, text, { parse_mode: "HTML" });
}

async function startWatching(): Promise<void> {
  const { chatId, databaseUrl } = config;
  if (!chatId || !databaseUrl || (!config.targetUserId && config.targetOracleEmpId === undefined)) {
    console.warn(
      "Vigilante desactivado: faltan TELEGRAM_CHAT_ID, DATABASE_URL o TARGET_USER_ID / TARGET_ORACLE_EMP_ID. " +
        "Escribe /start al bot para conocer tu chat ID.",
    );
    return;
  }

  const sql = createSql(databaseUrl);
  const userId = await resolveTargetUserId(sql, {
    userId: config.targetUserId,
    oracleEmpId: config.targetOracleEmpId,
  });
  const state = await State.load(config.stateFile);

  watcher = await startWatcher({
    sql,
    state,
    userId,
    pollIntervalMs: config.pollIntervalMs,
    onChange: (change) => sendChange(chatId, change),
  });
  console.log(`Vigilando los cambios de ${config.targetName}...`);

  const shutdown = (): void => {
    watcher?.stop();
    void bot.stop();
    void sql.end({ timeout: 5 }).finally(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startWatching().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

bot.start();
console.log("Bot de Telegram iniciado...");
