"use client";

import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="nf">
      <div className="nf-box">
        <div className="code">Something went wrong</div>
        <h1>This page didn&apos;t load</h1>
        <p>{error.message || "The page failed to load."}</p>
        <div className="row"><Button variant="primary" onClick={reset}><RefreshCwIcon className="i i--sm" aria-hidden /> Try again</Button></div>
      </div>
    </main>
  );
}
