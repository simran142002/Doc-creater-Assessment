import { describe, expect, it } from "vitest";
import { initNav, navReducer, navView, orderChangedIds, type CatchUpAction } from "@/lib/client/catchup-nav";
import type { DocJSON } from "@/lib/client/types";

const block = (id: string) => ({ type: "paragraph", attrs: { id } });
const doc: DocJSON = { type: "doc", content: ["a", "b", "c", "d"].map(block) };
const run = (ids: string[], ...actions: CatchUpAction[]) => actions.reduce(navReducer, initNav(ids));

describe("orderChangedIds", () => {
  it("returns changed ids in document order and drops ids not in the doc", () => {
    expect(orderChangedIds(doc, ["d", "gone", "b"])).toEqual(["b", "d"]);
  });
  it("handles an empty doc", () => {
    expect(orderChangedIds({ type: "doc" }, ["a"])).toEqual([]);
  });
});

describe("catch-up navigation", () => {
  it("opens on the first change", () => {
    expect(navView(initNav(["a", "b", "c"]))).toMatchObject({ total: 3, activeId: "a", hasPrev: false, isLast: false, allCaughtUp: false, label: "1 of 3" });
  });

  it("steps with next/prev and clamps at the start", () => {
    const ids = ["a", "b", "c"];
    expect(navView(run(ids, { type: "next" }))).toMatchObject({ activeId: "b", label: "2 of 3", hasPrev: true });
    expect(navView(run(ids, { type: "next" }, { type: "prev" }, { type: "prev" }))).toMatchObject({ activeId: "a", hasPrev: false });
    expect(navView(run(ids, { type: "next" }, { type: "next" }))).toMatchObject({ activeId: "c", isLast: true, allCaughtUp: false });
  });

  it("Next on the last change finishes (Done → all caught up)", () => {
    const v = navView(run(["a", "b"], { type: "next" }, { type: "next" }));
    expect(v).toMatchObject({ allCaughtUp: true, skipped: false, activeId: null });
  });

  it("Mark as read finishes early and is remembered as skipped", () => {
    expect(navView(run(["a", "b"], { type: "dismiss" }))).toMatchObject({ allCaughtUp: true, skipped: true });
    expect(navView(run(["a"], { type: "dismiss" }, { type: "next" }))).toMatchObject({ allCaughtUp: true, skipped: true });
  });

  it("is caught up when there is nothing to see", () => {
    expect(navView(initNav([]))).toMatchObject({ allCaughtUp: true, activeId: null, total: 0 });
    expect(navView(run([], { type: "next" })).activeId).toBeNull();
  });

  it("reset starts over with new ids", () => {
    const s = run(["a"], { type: "dismiss" }, { type: "reset", ids: ["x", "y"] });
    expect(navView(s)).toMatchObject({ total: 2, activeId: "x", allCaughtUp: false });
  });
});
