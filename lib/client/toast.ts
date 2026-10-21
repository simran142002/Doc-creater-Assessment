export type ToastType = "success" | "error" | "info";
export type ToastInput = { type?: ToastType; title: string; body?: string; action?: { label: string; onClick: () => void }; duration?: number };
export type ToastItem = ToastInput & { id: number; type: ToastType; leaving: boolean };

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const toastStore = {
  subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
  get: () => items,
  empty: [] as ToastItem[],
};

export function dismissToast(id: number) {
  const t = items.find((x) => x.id === id);
  if (!t || t.leaving) return;
  items = items.map((x) => (x.id === id ? { ...x, leaving: true } : x));
  emit();
  setTimeout(() => {
    items = items.filter((x) => x.id !== id);
    emit();
  }, 220);
}

/** Bottom-centre toast (prototype style). Returns a dismiss function. */
export function toast({ type = "info", duration = 4200, ...rest }: ToastInput) {
  const id = ++seq;
  items = [...items, { ...rest, type, duration, id, leaving: false }];
  emit();
  if (duration) setTimeout(() => dismissToast(id), duration);
  return () => dismissToast(id);
}
