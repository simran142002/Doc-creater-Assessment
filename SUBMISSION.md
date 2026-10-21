# Submission: Ajaia Docs

## Links

- **Live app:** https://ajaia-docs-blond-nu.vercel.app (Vercel Hobby + Neon free)
- **Source repo:** to be added (github.com/simran142002/ajaia-docs, public)
- **Walkthrough video:** see [VIDEO.txt](VIDEO.txt)
- **Planning pages** (private claude.ai pages until shared with you): [Product analysis](https://claude.ai/artifact/NzbFAXKpMCgw5HWw2YhnrF) · [Tech spec](https://claude.ai/artifact/2Wx5ykPdLfiBKLhh7hVZ4Y) · [Stack ledger](https://claude.ai/artifact/8GeymUd4G41WwdwfTfV3pe) · [Edge cases](https://claude.ai/artifact/Ez23KqMKHA6hkQkggtn5hd)

## Test accounts

Pick a user on the sign-in screen; there is no password.

| Name | Email |
|---|---|
| Aarav Mehta | aarav@ajaia.dev |
| Priya Sharma | priya@ajaia.dev |
| Leo Fernandes | leo@ajaia.dev |

## What is included

| Path | What |
|---|---|
| `app/`, `components/`, `lib/` | Next.js app: pages, API route handlers, UI, services, editor config, DB schema and seed |
| `tests/` | 198 Vitest tests (route-handler level, PGlite, no external DB needed) |
| `README.md` | Setup, run, scope, limits, status |
| `docs/ARCHITECTURE-NOTE.md` | Short architecture note |
| `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` | Full architecture and ADRs |
| `docs/PRODUCT-ANALYSIS.md`, `docs/UI-SKILLS.md` | Competitive analysis; skill vetting |
| `AI_WORKFLOW.md` | How AI was used, what was rejected, how it was verified |
| `PLAN.md` | Tracked build plan |
| `VIDEO.txt` | Video URL (to be added) and recording outline |
| `screenshots/` | 8 screenshots (from the approved prototype the app matches) |
| `prototype/` | Clickable design prototype |

## 60-second reviewer path

1. Open the live URL, sign in as **Aarav**. The dashboard shows catch-up counts.
2. Open "Design review: onboarding": changed blocks are marked with who changed them. Step with prev/next to "all caught up".
3. Create a doc, format it, rename it, reload: nothing is lost.
4. Share with **Priya** as viewer with a note. Switch user to Priya: the note appears and the doc is read-only.
5. Import a `.md` or `.docx`: see the report, then Undo.
6. Open the same doc in two tabs and edit both: the second save gets a conflict banner rather than overwriting.

## Working

Sign-in (simulated), document CRUD, rich-text formatting, autosave with 409 conflict handling, viewer/editor sharing with handoff notes, server-enforced access, `.md`/`.txt`/`.docx` import with report and Undo, catch-up on open, responsive UI (360/768/1440), rate limiting, deployed and smoke-tested in production. Typecheck, lint and build are clean.

## Incomplete

- No real-time co-editing or presence; conflicts are detected, not merged.
- Catch-up is per top-level block, not word-level.
- Rate limits are per instance, not shared.
- No browser E2E tests; no version history or comments.
- Auth is simulated. Details in the README's limits section.

## Next, with 2-4 more hours

- Presence via polling.
- Named version snapshots.
- Yjs co-editing.
- Shared rate-limit store (Upstash).
- Playwright E2E for catch-up and conflict flows.
- Word-level diff inside catch-up.
