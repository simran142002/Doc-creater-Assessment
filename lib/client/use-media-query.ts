"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverDefault = false) {
  return useSyncExternalStore(
    (cb) => {
      const mql = matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => serverDefault,
  );
}

export const useIsDesktop = () => useMediaQuery("(min-width: 641px)", true);
