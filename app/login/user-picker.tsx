"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import type { User } from "@/lib/client/types";
import { cn } from "@/lib/utils";

export type PickerUser = Pick<User, "id" | "name" | "email"> & { stat: string };

export function UserPicker({ users }: { users: PickerUser[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const pick = async (u: PickerUser) => {
    setBusy(u.id);
    try {
      await api.signIn(u.id);
      router.replace("/");
      router.refresh();
    } catch (e) {
      toast({ type: "error", title: "Couldn't sign in", body: e instanceof Error ? e.message : undefined });
      setBusy(null);
    }
  };

  if (!users.length) return <p className="card-meta">No users yet. Run <code>npm run db:seed</code>.</p>;

  return (
    <div className="user-cards">
      {users.map((u, i) => (
        <button key={u.id} type="button" className={cn("user-card", busy === u.id && "is-picked")}
          style={{ "--i": i } as React.CSSProperties} onClick={() => pick(u)} disabled={!!busy && busy !== u.id} aria-busy={busy === u.id}>
          <Avatar name={u.name} size="xl" />
          <span className="who"><b>{u.name}</b><span className="em">{u.email}</span></span>
          <span className="stat">{u.stat}</span>
          <span className="go"><ArrowRightIcon className="i" aria-hidden /></span>
        </button>
      ))}
    </div>
  );
}
