"use client";

import { useEffect, useState } from "react";
import { Alignment, Fit, Layout, Rive, RuntimeLoader, useRive, useStateMachineInput } from "@rive-app/react-canvas";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

RuntimeLoader.setWasmUrl("/rive.wasm");
// The teddy .riv only exposes state-machine inputs (no data binding to migrate to).
Rive.suppressDeprecationWarnings = ["state-machine-inputs"];

const SM = "Login Machine";
const layout = new Layout({ fit: Fit.Cover, alignment: Alignment.Center });

/** The single hero animation (Rive teddy). Only used on empty states and the caught-up moment. */
export function Teddy({ success, className }: { success?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const { rive, RiveComponent } = useRive({
    src: "/teddy.riv",
    stateMachine: SM,
    autoplay: !reduce,
    layout,
    onLoad: () => setState("ready"),
    onLoadError: () => setState("failed"),
  });
  const trig = useStateMachineInput(rive, SM, "trigSuccess");

  useEffect(() => {
    if (!success || !trig) return;
    const t = setTimeout(() => trig.fire(), 450);
    return () => clearTimeout(t);
  }, [success, trig]);

  return (
    <div className={cn("teddy", state === "ready" && "is-ready", state === "failed" && "is-fallback", className)} aria-hidden="true">
      <RiveComponent />
    </div>
  );
}
