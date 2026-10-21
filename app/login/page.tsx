import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FlaskConicalIcon } from "lucide-react";
import { Brand } from "@/components/brand";
import { getDb } from "@/lib/db/client";
import { documents, shares, users } from "@/lib/db/schema";
import { sessionUser } from "@/lib/server/page";
import { UserPicker, type PickerUser } from "./user-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Ajaia Docs" };

export default async function LoginPage() {
  if (await sessionUser()) redirect("/");
  const db = await getDb();
  const [people, owned, shared] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(users.name),
    db.select({ id: documents.ownerId, n: count() }).from(documents).groupBy(documents.ownerId),
    db.select({ id: shares.userId, n: count() }).from(shares).groupBy(shares.userId),
  ]);
  const n = (rows: { id: string; n: number }[], id: string) => rows.find((r) => r.id === id)?.n ?? 0;
  const list: PickerUser[] = people.map((u) => ({ ...u, stat: `${n(owned, u.id)} docs · ${n(shared, u.id)} shared` }));

  return (
    <main className="signin">
      <section className="signin-art">
        <div className="paper" /><div className="paper p2" />
        <Brand href="/login" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1>See what changed <em>for you</em> — the moment you open it.</h1>
          <p>Team docs that open on what&apos;s new since your last visit, who changed it, and why it was sent to you. Coming back takes seconds.</p>
        </div>
        <div className="si-demo" aria-hidden="true">
          <span className="chipline chip chip--change"><span className="dot" />2 changes</span>
          <div className="prose">
            <h3>Milestones</h3>
            <p className="cu-block" data-cu-by="PS" style={{ "--cu-color": "#8E5BB5" } as React.CSSProperties}>Import from Word slipped to <strong>mid-November</strong>.</p>
            <p>Sharing v2 follows two weeks later.</p>
            <p className="cu-block" data-cu-by="LF" style={{ "--cu-color": "#3E8A86" } as React.CSSProperties}><u>Decision:</u> no version history before GA.</p>
          </div>
        </div>
      </section>
      <section className="signin-panel">
        <div className="signin-box">
          <h2>Choose who you are</h2>
          <p>Pick a teammate to sign in as. You can switch any time from the header.</p>
          <UserPicker users={list} />
          <div className="signin-foot">
            <FlaskConicalIcon className="i i--sm" aria-hidden />
            <span>Demo sign-in — no passwords. Picking a teammate sets a signed, httpOnly session cookie for that seeded user.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
