import Link from "next/link";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import { AppHeader } from "@/components/app-shell";
import { UserMenu } from "@/components/user-menu";
import { sessionUser } from "@/lib/server/page";

/** 404 for missing docs and for docs you can't access (the API never reveals which). */
export default async function NotFound() {
  const user = await sessionUser();
  const me = user && { id: user.id, name: user.name, email: user.email };
  return (
    <div>
      {me && <AppHeader user={me} />}
      <main className="nf">
        <div className="nf-box">
          <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true" style={{ display: "block", margin: "0 auto 18px" }}>
            <ellipse cx="80" cy="110" rx="50" ry="6" fill="var(--surface-3)" />
            <rect x="44" y="12" width="72" height="90" rx="7" fill="var(--page)" stroke="var(--line-strong)" />
            <path d="M56 30h40M56 40h48M56 50h30" stroke="var(--surface-3)" strokeWidth="4" strokeLinecap="round" />
            <g transform="translate(80 72)">
              <rect x="-17" y="-6" width="34" height="26" rx="6" fill="var(--accent)" />
              <path d="M-10 -6v-6a10 10 0 0 1 20 0v6" fill="none" stroke="var(--accent)" strokeWidth="4" />
              <circle cy="6" r="3.5" fill="var(--bg-elev)" />
            </g>
          </svg>
          <div className="code">404 · Not found or no access</div>
          <h1>We couldn&apos;t find that document</h1>
          <p>
            It may have been deleted, the link may be wrong, or it hasn&apos;t been shared with you.
            {me && <> You&apos;re signed in as <b>{me.name}</b> — ask the owner to share it with {me.email}, or switch to an account that has access.</>}
          </p>
          <div className="row">
            <Link className="btn btn--primary" href={me ? "/" : "/login"}><ArrowLeftIcon className="i i--sm" aria-hidden /> Back to documents</Link>
            {me && <UserMenu user={me} trigger={<button type="button" className="btn"><UsersIcon className="i i--sm" aria-hidden /> Switch account</button>} />}
          </div>
        </div>
      </main>
    </div>
  );
}
