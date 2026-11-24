import "dotenv/config";

export interface Config {
  botToken: string;
  chatId: string | undefined;
  databaseUrl: string | undefined;
  targetUserId: string | undefined;
  targetOracleEmpId: number | undefined;
  targetName: string;
  stateFile: string;
  pollIntervalMs: number;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function loadConfig(): Config {
  const botToken = optional("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    console.error("Falta la variable de entorno TELEGRAM_BOT_TOKEN. Crea un fichero .env (ver .env.example).");
    process.exit(1);
  }

  const empIdRaw = optional("TARGET_ORACLE_EMP_ID");
  const targetOracleEmpId = empIdRaw ? Number(empIdRaw) : undefined;
  if (targetOracleEmpId !== undefined && !Number.isInteger(targetOracleEmpId)) {
    console.error("TARGET_ORACLE_EMP_ID debe ser un número entero.");
    process.exit(1);
  }

  const pollMinutes = Number(optional("POLL_INTERVAL_MINUTES") ?? "5");
  if (!Number.isFinite(pollMinutes) || pollMinutes <= 0) {
    console.error("POLL_INTERVAL_MINUTES debe ser un número mayor que 0.");
    process.exit(1);
  }

  return {
    botToken,
    chatId: optional("TELEGRAM_CHAT_ID"),
    databaseUrl: optional("DATABASE_URL"),
    targetUserId: optional("TARGET_USER_ID"),
    targetOracleEmpId,
    targetName: optional("TARGET_NAME") ?? "Ignacio Vera",
    stateFile: optional("STATE_FILE") ?? "data/state.json",
    pollIntervalMs: pollMinutes * 60_000,
  };
}
