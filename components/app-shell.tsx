"use client";

import { useEffect, useState } from "react";
import { PlusIcon, UploadIcon, WifiOffIcon } from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import { Brand } from "@/components/brand";
import { Tip } from "@/components/tip";
import { UserMenu } from "@/components/user-menu";
import { useOnline } from "@/lib/client/use-online";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/client/types";

export function OfflinePill() {
  const online = useOnline();
  if (online) return null;
  return (
    <Tip label="Changes stay on this device until you're back">
      <span className="offline-pill" tabIndex={0}><WifiOffIcon className="i i--sm" aria-hidden /> Offline</span>
    </Tip>
  );
}

/** Dashboard / not-found header. On phones New and Import collapse into the "+" menu. */
export function AppHeader({ user, onNew, onImport }: { user: Pick<User, "id" | "name" | "email">; onNew?: () => void; onImport?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(scrollY > 4);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("app-head", scrolled && "is-scrolled")}>
      <Brand />
      <div className="head-spacer" />
      <OfflinePill />
      {onNew && onImport && (
        <M.Root>
          <M.Trigger asChild>
            <button type="button" className="btn btn--primary head-new" aria-label="Create or import"><PlusIcon className="i" aria-hidden /></button>
          </M.Trigger>
          <M.Portal>
            <M.Content className="pop" align="end" sideOffset={8} collisionPadding={8}>
              <M.Group className="pop-sec">
                <M.Item className="pop-item" onSelect={onNew}><PlusIcon className="i i--sm" aria-hidden /><span className="grow">New document</span></M.Item>
                <M.Item className="pop-item" onSelect={onImport}>
                  <UploadIcon className="i i--sm" aria-hidden />
                  <span className="grow">Import file<span className="sub">.txt · .md · .docx — max 2 MB</span></span>
                </M.Item>
              </M.Group>
            </M.Content>
          </M.Portal>
        </M.Root>
      )}
      <UserMenu user={user} />
    </header>
  );
}
