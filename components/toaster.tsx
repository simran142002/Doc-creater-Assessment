"use client";

import { useSyncExternalStore } from "react";
import { CheckIcon, CircleAlertIcon, SparkleIcon, WifiOffIcon, XIcon } from "lucide-react";
import { dismissToast, toastStore, type ToastItem } from "@/lib/client/toast";

function ToastIcon({ t }: { t: ToastItem }) {
  if (t.type === "success") return <CheckIcon className="i" aria-hidden />;
  if (t.type === "error") return /offline|connect|reach/i.test(t.title) ? <WifiOffIcon className="i" aria-hidden /> : <CircleAlertIcon className="i" aria-hidden />;
  return <SparkleIcon className="i" aria-hidden />;
}

export function Toaster() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.get, () => toastStore.empty);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}${t.leaving ? " is-leaving" : ""}`} role={t.type === "error" ? "alert" : "status"}>
          <span className="ico"><ToastIcon t={t} /></span>
          <div className="msg"><b>{t.title}</b>{t.body && <span>{t.body}</span>}</div>
          {t.action && (
            <button type="button" onClick={() => { t.action!.onClick(); dismissToast(t.id); }}>{t.action.label}</button>
          )}
          <button type="button" className="x" aria-label="Dismiss" onClick={() => dismissToast(t.id)}><XIcon className="i i--sm" aria-hidden /></button>
        </div>
      ))}
    </div>
  );
}
