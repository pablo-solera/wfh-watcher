import type { Sql } from "../db/client.js";
import { findAcceptedChangesSince, getDbNow } from "../db/requests.js";
import type { State } from "./state.js";
import type { WfhChange } from "./types.js";

const CHANNEL = "wfh_request_changed";
const DEBOUNCE_MS = 500;
// Margen al avanzar `lastCheck`: cubre transacciones que confirman un poco
// después de fijar `updated_at`. Los duplicados se descartan con `State`.
const OVERLAP_SECONDS = 10;

interface WatcherOptions {
  sql: Sql;
  state: State;
  userId: string;
  pollIntervalMs: number;
  onChange: (change: WfhChange) => Promise<void>;
}

export interface Watcher {
  stop(): void;
  status(): { listening: boolean; lastCheck: string | null; lastNotificationAt: string | null };
}

interface NotifyPayload {
  requesterId?: string;
}

export async function startWatcher(options: WatcherOptions): Promise<Watcher> {
  const { sql, state, userId, pollIntervalMs, onChange } = options;
  let listening = false;
  let running = false;
  let pending = false;
  let debounce: NodeJS.Timeout | undefined;

  // Primer arranque: se parte de "ahora" para no enviar el historial.
  if (!state.lastCheck) {
    state.setLastCheck(await getDbNow(sql, 0));
    await state.save();
  }

  async function check(): Promise<void> {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      do {
        pending = false;
        const checkpoint = await getDbNow(sql, OVERLAP_SECONDS);
        const changes = await findAcceptedChangesSince(sql, userId, state.lastCheck!);
        let allSent = true;
        for (const change of changes) {
          if (state.isNotified(change.requestId)) continue;
          if (change.changes.length > 0) {
            try {
              await onChange(change);
            } catch (err) {
              console.error("Error enviando el aviso a Telegram:", err);
              allSent = false;
              break;
            }
          }
          state.markNotified(change.requestId);
        }
        if (allSent) state.setLastCheck(checkpoint);
        await state.save();
      } while (pending);
    } catch (err) {
      console.error("Error revisando cambios:", err);
    } finally {
      running = false;
    }
  }

  function schedule(): void {
    clearTimeout(debounce);
    debounce = setTimeout(() => void check(), DEBOUNCE_MS);
  }

  await sql.listen(
    CHANNEL,
    (payload) => {
      try {
        const event = JSON.parse(payload) as NotifyPayload;
        if (event.requesterId === userId) schedule();
      } catch {
        // Payload ilegible: se ignora, el repaso periódico lo cubrirá.
      }
    },
    () => {
      listening = true;
      console.log("Escuchando cambios en la base de datos...");
      schedule();
    },
  );
  listening = true;

  const interval = setInterval(() => void check(), pollIntervalMs);
  void check();

  return {
    stop() {
      clearInterval(interval);
      clearTimeout(debounce);
      listening = false;
    },
    status: () => ({
      listening,
      lastCheck: state.lastCheck,
      lastNotificationAt: state.lastNotificationAt,
    }),
  };
}
