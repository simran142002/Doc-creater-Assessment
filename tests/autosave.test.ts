import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/client/api";
import { AutosaveController, type SaveFn } from "@/lib/client/autosave";
import type { Doc, DocJSON } from "@/lib/client/types";

const doc = (text: string): DocJSON => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const ok = (version: number) => ({ version, updatedAt: `t${version}`, title: "x" });

function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

const setup = (save: SaveFn, version = 1) => new AutosaveController({ save, version, debounceMs: 800, maxWaitMs: 5000, retryDelayMs: 1000 });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AutosaveController", () => {
  it("debounces keystrokes into one save with the base version", async () => {
    const save = vi.fn<SaveFn>().mockResolvedValue(ok(2));
    const c = setup(save);
    c.update(doc("a"));
    await vi.advanceTimersByTimeAsync(500);
    c.update(doc("ab"));
    expect(c.getState().status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({ content: doc("ab"), baseVersion: 1 });
    expect(c.getState()).toMatchObject({ status: "saved", version: 2, lastSavedAt: "t2" });
  });

  it("forces a save after maxWait while typing continuously", async () => {
    const save = vi.fn<SaveFn>().mockResolvedValue(ok(2));
    const c = setup(save);
    for (let i = 0; i < 12; i++) {
      c.update(doc(`v${i}`));
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps one request in flight and sends the latest edit after it with the new version", async () => {
    const first = deferred<ReturnType<typeof ok>>();
    const save = vi.fn<SaveFn>().mockReturnValueOnce(first.promise).mockResolvedValue(ok(3));
    const c = setup(save);
    c.update(doc("a"));
    await vi.advanceTimersByTimeAsync(800);
    expect(c.getState().status).toBe("saving");
    c.update(doc("ab"));
    c.update(doc("abc"));
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve(ok(2));
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual({ content: doc("abc"), baseVersion: 2 });
    expect(c.getState()).toMatchObject({ status: "saved", version: 3 });
  });

  it("flush sends immediately and passes keepalive", async () => {
    const save = vi.fn<SaveFn>().mockResolvedValue(ok(2));
    const c = setup(save);
    c.update(doc("a"));
    await c.flush({ keepalive: true });
    expect(save).toHaveBeenCalledWith({ content: doc("a"), baseVersion: 1 }, { keepalive: true });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure once, then succeeds", async () => {
    const save = vi.fn<SaveFn>().mockRejectedValueOnce(new ApiError("NETWORK", "offline", 0)).mockResolvedValue(ok(2));
    const c = setup(save);
    c.update(doc("a"));
    await vi.advanceTimersByTimeAsync(800);
    expect(c.getState().status).toBe("saving");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(c.getState().status).toBe("saved");
  });

  it("goes to error after the single retry fails, and retry() recovers", async () => {
    const boom = new ApiError("INTERNAL", "Something went wrong.", 500);
    const save = vi.fn<SaveFn>().mockRejectedValueOnce(boom).mockRejectedValueOnce(boom).mockResolvedValue(ok(2));
    const c = setup(save);
    c.update(doc("a"));
    await vi.advanceTimersByTimeAsync(800 + 1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(c.getState()).toMatchObject({ status: "error", error: "Something went wrong." });
    expect(c.hasUnsaved).toBe(true);
    await c.retry();
    expect(save).toHaveBeenLastCalledWith({ content: doc("a"), baseVersion: 1 }, {});
    expect(c.getState().status).toBe("saved");
  });

  it("does not retry client errors", async () => {
    const save = vi.fn<SaveFn>().mockRejectedValue(new ApiError("FORBIDDEN", "Your role (viewer) cannot write.", 403));
    const c = setup(save);
    c.update(doc("a"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(c.getState().status).toBe("error");
  });

  describe("409 conflict", () => {
    const theirs = { version: 7, updatedAt: "t7", updatedBy: { id: "p", name: "Priya" }, doc: { id: "d", content: doc("theirs") } as Doc };
    const stale = new ApiError("STALE_VERSION", "Priya saved a newer version.", 409, { current: theirs });

    it("pauses autosave until resolved", async () => {
      const save = vi.fn<SaveFn>().mockRejectedValue(stale);
      const c = setup(save);
      c.update(doc("mine"));
      await vi.advanceTimersByTimeAsync(800);
      expect(c.getState()).toMatchObject({ status: "conflict", conflict: theirs });
      c.update(doc("mine 2"));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(save).toHaveBeenCalledTimes(1);
      expect(c.getState().status).toBe("conflict");
    });

    it("loadTheirs adopts the server version and drops local edits", async () => {
      const save = vi.fn<SaveFn>().mockRejectedValueOnce(stale).mockResolvedValue(ok(8));
      const c = setup(save);
      c.update(doc("mine"));
      await vi.advanceTimersByTimeAsync(800);
      expect(c.loadTheirs()?.content).toEqual(doc("theirs"));
      expect(c.getState()).toMatchObject({ status: "saved", version: 7, conflict: null });
      expect(c.hasUnsaved).toBe(false);
      c.update(doc("next"));
      await vi.advanceTimersByTimeAsync(800);
      expect(save).toHaveBeenLastCalledWith({ content: doc("next"), baseVersion: 7 }, {});
    });

    it("keepMine force-saves the latest local edit on top of theirs", async () => {
      const save = vi.fn<SaveFn>().mockRejectedValueOnce(stale).mockResolvedValue(ok(8));
      const c = setup(save);
      c.update(doc("mine"));
      await vi.advanceTimersByTimeAsync(800);
      c.update(doc("mine 2"));
      await c.keepMine();
      expect(save).toHaveBeenLastCalledWith({ content: doc("mine 2"), baseVersion: 7, force: true }, {});
      expect(c.getState()).toMatchObject({ status: "saved", version: 8, conflict: null });
      c.update(doc("mine 3"));
      await vi.advanceTimersByTimeAsync(800);
      expect(save).toHaveBeenLastCalledWith({ content: doc("mine 3"), baseVersion: 8 }, {});
    });
  });

  it("notifies subscribers on every transition", async () => {
    const save = vi.fn<SaveFn>().mockResolvedValue(ok(2));
    const c = setup(save);
    const seen: string[] = [];
    c.subscribe(() => seen.push(c.getState().status));
    c.update(doc("a"));
    await vi.advanceTimersByTimeAsync(800);
    expect(seen).toEqual(["dirty", "saving", "saved"]);
  });
});
