import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MAX_NOTIFIED = 500;

interface StateData {
  lastCheck: string | null;
  lastNotificationAt: string | null;
  notified: string[];
}

export class State {
  private constructor(
    private readonly file: string,
    private data: StateData,
  ) {}

  static async load(file: string): Promise<State> {
    try {
      const raw = JSON.parse(await readFile(file, "utf8")) as Partial<StateData>;
      return new State(file, {
        lastCheck: raw.lastCheck ?? null,
        lastNotificationAt: raw.lastNotificationAt ?? null,
        notified: Array.isArray(raw.notified) ? raw.notified : [],
      });
    } catch {
      return new State(file, { lastCheck: null, lastNotificationAt: null, notified: [] });
    }
  }

  get lastCheck(): string | null {
    return this.data.lastCheck;
  }

  get lastNotificationAt(): string | null {
    return this.data.lastNotificationAt;
  }

  setLastCheck(value: string): void {
    this.data.lastCheck = value;
  }

  isNotified(requestId: string): boolean {
    return this.data.notified.includes(requestId);
  }

  markNotified(requestId: string): void {
    this.data.notified = [...this.data.notified, requestId].slice(-MAX_NOTIFIED);
    this.data.lastNotificationAt = new Date().toISOString();
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data, null, 2), "utf8");
    await rename(tmp, this.file);
  }
}
