"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Hover/focus tip with the prototype's 350ms delay. Hidden on phones (CSS). */
export function Tip({ label, children, side = "bottom" }: { label?: React.ReactNode; children: React.ReactElement; side?: "top" | "bottom" }) {
  if (!label) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
