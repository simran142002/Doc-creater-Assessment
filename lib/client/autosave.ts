import { ApiError } from "./api";
import type { Doc, DocJSON, Person, SaveResult } from "./types";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

export type Conflict = { version: number; updatedAt: string; updatedBy: Person | null; doc: Doc };

export type AutosaveState = {
  status: SaveStatus;
  version: number;
  lastSavedAt: string | null;
  error: string | null;
  conflict: Conflict | null;
};

export type SaveFn = (
  body: { content: DocJSON; baseVersion: number; force?: boolean },
  opts: { keepalive?: boolean },
) => Promise<SaveResult>;

export type AutosaveOptions = {
  save: SaveFn;
  version: number;
  debounceMs?: number;
  maxWaitMs?: number;
  retryDelayMs?: number;
};

/** keepalive fetches are capped at 64 KB by browsers. */
export const KEEPALIVE_MAX_BYTES = 60 * 1024;

/**
 * Debounced, single-flight autosave with optimistic concurrency.
 * idle → dirty → saving → saved; failures retry once, then error; 409 → conflict (paused until resolved).
 */
export class AutosaveController {
  private state: AutosaveState;
  private listeners = new Set<() => void>();
  private pending: DocJSON | null = null;
  private inFlight: Promise<void> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private maxWait: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retried = false;
  private force = false;
  private disposed = false;
  private readonly opts: Required<AutosaveOptions>;

  constructor(opts: AutosaveOptions) {
    this.opts = { debounceMs: 800, maxWaitMs: 5000, retryDelayMs: 1000, ...opts };
    this.state = { status: "idle", version: opts.version, lastSavedAt: null, error: null, conflict: null };
  }

  getState = () => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  get hasUnsaved() {
    return this.pending !== null || this.inFlight !== null;
  }

  update(content: DocJSON) {
    this.pending = content;
    if (this.state.status === "conflict") return;
    if (this.state.status !== "saving") this.set({ status: "dirty", error: null });
    this.clearTimer("retryTimer");
    this.clearTimer("debounce");
    this.debounce = setTimeout(() => void this.send(), this.opts.debounceMs);
    this.maxWait ??= setTimeout(() => void this.send(), this.opts.maxWaitMs);
  }

  /** Sends pending edits now (blur, tab hidden, unload). Resolves once nothing is in flight. */
  async flush(opts: { keepalive?: boolean } = {}) {
    if (this.state.status === "conflict") return;
    if (this.inFlight) await this.inFlight;
    if (this.pending) await this.send(opts);
  }

  retry() {
    this.retried = false;
    return this.send();
  }

  /** Discards local edits and adopts the server copy. Returns the content to load into the editor. */
  loadTheirs(): Doc | null {
    const c = this.state.conflict;
    if (!c) return null;
    this.pending = null;
    this.force = false;
    this.set({ status: "saved", version: c.version, conflict: null, lastSavedAt: c.updatedAt, error: null });
    return c.doc;
  }

  /** Overwrites the newer server copy with local edits. */
  keepMine() {
    const c = this.state.conflict;
    if (!c) return Promise.resolve();
    this.force = true;
    this.set({ status: "dirty", version: c.version, conflict: null });
    return this.send();
  }

  dispose() {
    this.disposed = true;
    this.clearTimer("debounce");
    this.clearTimer("maxWait");
    this.clearTimer("retryTimer");
    this.listeners.clear();
  }

  private async send(opts: { keepalive?: boolean } = {}): Promise<void> {
    this.clearTimer("debounce");
    this.clearTimer("maxWait");
    this.clearTimer("retryTimer");
    if (this.inFlight || !this.pending || this.state.status === "conflict" || this.disposed) return;

    const content = this.pending;
    const force = this.force;
    this.pending = null;
    this.set({ status: "saving", error: null });

    this.inFlight = (async () => {
      try {
        const res = await this.opts.save({ content, baseVersion: this.state.version, ...(force && { force }) }, opts);
        this.retried = false;
        this.force = false;
        this.set({ version: res.version, lastSavedAt: res.updatedAt, status: this.pending ? "dirty" : "saved" });
      } catch (e) {
        this.pending ??= content;
        this.fail(e);
      } finally {
        this.inFlight = null;
      }
    })();
    await this.inFlight;
    if (this.pending && this.state.status === "dirty" && !this.debounce) await this.send();
  }

  private fail(e: unknown) {
    const err = e instanceof ApiError ? e : new ApiError("NETWORK", "Couldn't save.", 0);
    const stale = err.stale;
    if (stale) return this.set({ status: "conflict", conflict: stale, error: err.message });
    if (err.status === 429) {
      this.set({ status: "saving", error: null });
      this.retryTimer = setTimeout(() => void this.send(), Math.min(err.retryAfter ?? 5, 60) * 1000);
      return;
    }
    if (err.retryable && !this.retried) {
      this.retried = true;
      this.set({ status: "saving" });
      this.retryTimer = setTimeout(() => void this.send(), this.opts.retryDelayMs);
      return;
    }
    this.set({ status: "error", error: err.message });
  }

  private clearTimer(k: "debounce" | "maxWait" | "retryTimer") {
    if (this[k]) clearTimeout(this[k]!);
    this[k] = null;
  }

  private set(patch: Partial<AutosaveState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
}
