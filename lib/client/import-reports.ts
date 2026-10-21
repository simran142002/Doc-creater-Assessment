import type { FidelityReport } from "./types";

export type ImportReport = { file: string; report: FidelityReport; words: number };

/** Hands a fresh import's fidelity report from the import dialog to the editor (same tab, client-side navigation). */
const reports = new Map<string, ImportReport>();
const listeners = new Set<() => void>();

export const importReports = {
  set(docId: string, r: ImportReport) {
    reports.set(docId, r);
    listeners.forEach((fn) => fn());
  },
  get: (docId: string) => reports.get(docId) ?? null,
  clear(docId: string) {
    reports.delete(docId);
    listeners.forEach((fn) => fn());
  },
  subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
};
