"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon, ChevronDownIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/client/api";
import { firstName } from "@/lib/client/format";
import { getTheme, setTheme, type Theme } from "@/lib/client/theme";
import { toast } from "@/lib/client/toast";
import type { User } from "@/lib/client/types";

type Me = Pick<User, "id" | "name" | "email">;

const THEMES: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

/** Account menu: who you are, switch user, theme, sign out. */
export function UserMenu({ user, trigger }: { user: Me; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [others, setOthers] = useState<User[] | null>(null);
  const [theme, setThemeState] = useState<Theme>("system");

  const onOpenChange = (open: boolean) => {
    if (!open) return;
    setThemeState(getTheme());
    if (!others) api.users().then((all) => setOthers(all.filter((u) => u.id !== user.id))).catch(() => setOthers([]));
  };

  const switchTo = async (u: User) => {
    try {
      await api.signIn(u.id);
      router.replace("/");
      router.refresh();
      toast({ title: `Signed in as ${u.name}`, body: `Switched from ${firstName(user.name)}` });
    } catch (e) {
      toast({ type: "error", title: "Couldn't switch user", body: e instanceof Error ? e.message : undefined });
    }
  };

  const signOut = async () => {
    try {
      await api.signOut();
      router.replace("/login");
      router.refresh();
    } catch (e) {
      toast({ type: "error", title: "Couldn't sign out", body: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <M.Root onOpenChange={onOpenChange}>
      <M.Trigger asChild>
        {trigger ?? (
          <button type="button" className="user-btn" aria-label="Account menu">
            <Avatar name={user.name} />
            <span className="name">{firstName(user.name)}</span>
            <ChevronDownIcon className="i i--sm" aria-hidden />
          </button>
        )}
      </M.Trigger>
      <M.Portal>
        <M.Content className="pop" align="end" sideOffset={8} collisionPadding={8}>
          <div className="pop-sec">
            <div className="pop-me"><Avatar name={user.name} size="lg" /><div><b>{user.name}</b><span>{user.email}</span></div></div>
          </div>
          <M.Group className="pop-sec">
            <M.Label className="pop-label">Switch user</M.Label>
            {others === null && <div className="pop-item"><span className="skel" style={{ height: 24, width: "100%" }} /></div>}
            {others?.map((o) => (
              <M.Item key={o.id} className="pop-item" onSelect={() => void switchTo(o)}>
                <Avatar name={o.name} size="sm" />
                <span className="grow">{o.name}<span className="sub">{o.email}</span></span>
                <ArrowRightIcon className="i i--sm" aria-hidden />
              </M.Item>
            ))}
          </M.Group>
          <div className="pop-sec">
            <div className="pop-row">
              <span>Theme</span>
              <div className="seg" role="group" aria-label="Theme">
                {THEMES.map(({ value, label, Icon }) => (
                  <button key={value} type="button" aria-label={label} aria-pressed={theme === value}
                    onClick={() => { setTheme(value); setThemeState(value); }}>
                    <Icon className="i i--sm" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <M.Group className="pop-sec">
            <M.Item className="pop-item" onSelect={() => void signOut()}>
              <LogOutIcon className="i i--sm" aria-hidden /><span className="grow">Sign out</span>
            </M.Item>
          </M.Group>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
