"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={350}>
        {children}
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}
