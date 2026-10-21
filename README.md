# Ajaia Docs

**See what changed for you, the moment you open it.**

Ajaia Docs is a lightweight collaborative document editor built as a take-home. You can create and edit rich-text documents, import files, and share with viewer or editor roles. When you open a doc someone else changed, the changed blocks are marked inline with who changed them and why it was sent to you.

## Links

- **Live app:** https://ajaia-docs-blond-nu.vercel.app (pick any seeded user, no password)
- **Walkthrough video:** _TBD_
- **Design and planning pages** (private claude.ai pages, shared with reviewers on request):
  [Product analysis](https://claude.ai/artifact/NzbFAXKpMCgw5HWw2YhnrF) · [Tech spec](https://claude.ai/artifact/2Wx5ykPdLfiBKLhh7hVZ4Y) · [Stack ledger](https://claude.ai/artifact/8GeymUd4G41WwdwfTfV3pe) · [Edge cases & error handling](https://claude.ai/artifact/Ez23KqMKHA6hkQkggtn5hd)
- **Repo docs:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/PRODUCT-ANALYSIS.md](docs/PRODUCT-ANALYSIS.md) · [docs/UI-SKILLS.md](docs/UI-SKILLS.md) · [PLAN.md](PLAN.md)
- **Design prototype:** `prototype/` (clickable; open `prototype/index.html`)

## Test accounts

Auth is simulated: the login page lists the seeded users and you pick one. There are no passwords.

| Name | Email | Seeded state |
|---|---|---|
| Aarav Mehta | aarav@ajaia.dev | Owns "Welcome to Ajaia Docs" and "Launch checklist"; editor on Priya's review; viewer on Leo's budget |
| Priya Sharma | priya@ajaia.dev | Owns "Design review: onboarding" (3 blocks edited an hour ago); editor on "Launch checklist" with a handoff note |
| Leo Fernandes | leo@ajaia.dev | Owns "Q4 budget notes" (shared with Aarav as viewer) |

### 60-second reviewer script

1. Sign in as **Aarav**. On the dashboard, "Design review: onboarding" carries a "new for you" dot.
2. Open it. The changed blocks are highlighted with Priya's name, and the banner steps through them (Prev/Next). Reach the end for the "all caught up" moment.
3. Open "Launch checklist" (Aarav's own doc), edit a heading, then **Share** it with `leo@ajaia.dev` as editor and add a handoff note.
4. Switch user (top right) to **Leo**. The doc shows the new-for-you dot; opening it shows the handoff note card. Dismiss it with "Got it".
5. Back as Aarav, open "Q4 budget notes". You are a viewer, so the editor is read-only.
6. Import `tests/fixtures/sample.docx` from the dashboard. Read the import report (kept vs dropped), then press Undo.
7. Conflict check: open the same doc in two tabs as two users, save in one, then type in the other. You get "Load theirs / Keep mine".

## Features

Core brief, working end to end:
- Create, rename, edit and delete documents. Bold, italic, underline, H1-H3, bullet and numbered lists, undo/redo.
- Debounced autosave with a Saved / Saving / Error status, flush on blur and unload, one retry.
- Persistence in Postgres (content stored as ProseMirror JSON, so formatting is lossless).
- Upload `.txt`, `.md`, `.docx` into a new editable document.
- Sharing by email with viewer or editor roles, revoke, and role-based enforcement on every route (404 for strangers, 403 for insufficient role).
- Dashboard split into owned and shared-with-me.
- Responsive layout (phone to desktop).

Differentiators:
- **Catch-up by default.** Opening a doc shows which top-level blocks changed since you last saw it, who changed them, and steps through them. A "new for you" dot and filter sit on the dashboard.
- **Handoff note** attached to a share (max 280 chars), shown once as a card on first open.
- **Conflict-safe save.** Saves carry a version; a stale save gets a 409 and a "Load theirs / Keep mine" banner instead of silently overwriting.
- **Import report + Undo.** After import you see what was kept and what was dropped, and can undo.

Honest positioning: catch-up is not a new capability. Google Docs, Confluence and Loop each have a variant. The edge here is UX: it is on by default, inline, per block, and needs no click, setup or AI tier. See [docs/PRODUCT-ANALYSIS.md](docs/PRODUCT-ANALYSIS.md).

## Supported uploads

| Type | Handling |
|---|---|
| `.txt` | One paragraph per line |
| `.md` | GitHub-flavored Markdown via `marked` |
| `.docx` | Converted with `mammoth` (also checked by magic bytes) |

- **Max size: 2 MB** (`lib/server/limits.ts`); the resulting document must also be at most 1 MB of JSON.
- **Kept:** paragraphs, headings H1-H3, bullet and numbered lists, bold, italic, underline.
- **Dropped:** images, tables (each row becomes a paragraph, cells joined by " · "), links (text kept), headings below H3 (become normal text), and anything else outside the editor schema. Each drop is listed in the import report.
- Empty or corrupt files are rejected with a clear error. Other types (PDF, images) are rejected.
- One file per upload; at most 10,000 lines/paragraphs; UTF-8 and UTF-16 text (Latin-1 is rejected, not guessed); file paths are stripped from the title.

## Run locally

Requires Node 20.9+ (Next 16 minimum; developed on Node 24).

```bash
npm install            # use `npm install --registry https://registry.yarnpkg.com`
                       # only where registry.npmjs.org is blocked
cp .env.example .env.local
# set SESSION_SECRET to >= 32 random bytes: openssl rand -base64 32
npm run db:migrate
npm run db:seed        # must run before `dev`
npm run dev            # http://localhost:3000
```

- With `DATABASE_URL` unset, the app uses embedded **PGlite** stored in `./.pglite`. No database to install.
- PGlite is single-process, so run migrate and seed first and then start `dev`; don't run them while the dev server holds the data directory.
- To use Postgres or Neon, set `DATABASE_URL` (pooled) and optionally `DATABASE_URL_UNPOOLED` (used for migrations).
- To reset local data, stop the server and delete `.pglite`, then migrate and seed again.
- `npm run fixtures` regenerates the sample upload files in `tests/fixtures`. Also available: `npm run build`, `lint`, `typecheck`.

## Tests

```bash
npm test
```

Vitest against an in-process Postgres (PGlite). Latest run: **12 files, 185 tests, all passing**. 84 edge-case scenarios are catalogued in the [edge-cases page](https://claude.ai/artifact/Ez23KqMKHA6hkQkggtn5hd) (83 covered by tests). Coverage:
- Access control: the `can()` matrix and route-level 404/403 behaviour.
- Autosave and optimistic concurrency, including the 409 conflict path.
- Catch-up: block hashing and diff, API behaviour, and navigation ordering.
- Import: parser unit tests (`.txt`, `.md`, `.docx`, empty, oversize) and `POST /api/import`.
- Sharing validation (roles, self-share, unknown email, note length, owner revoke, members list per role).
- Hardening: malformed/oversized/deeply nested input, bad or tampered sessions, concurrent saves, NUL characters, unsafe markdown (scripts and `javascript:` links stripped), filename sanitizing, DB error mapping, no stack traces in 500s.

There are no browser E2E tests; UI flows were checked manually.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Editor | TipTap 3 (ProseMirror), JSON content |
| UI | Tailwind 4, shadcn/ui (Radix), Motion |
| Data | Postgres via Drizzle ORM; Neon in production, PGlite locally and in tests |
| Auth | Seeded users, signed JWT cookie (`jose`) |
| Validation | Zod, shared by client and server |
| Import | `mammoth` (.docx), `marked` (.md) |
| Tests | Vitest |

Why each: [docs/DECISIONS.md](docs/DECISIONS.md) (12 ADRs with alternatives and "revisit when").

## Project structure

```
app/            Next.js routes: dashboard, /login, /d/[id], /api/*
components/     App shell, dialogs, shadcn primitives (ui/)
lib/server/     Service layer: access, documents, shares, catch-up, import
lib/client/     Autosave, catch-up, import and editor hooks
lib/editor/     TipTap extensions shared by client and server
lib/db/         Drizzle schema, migrations, seed, client (PGlite/Neon)
lib/validation/ Zod schemas
scripts/        migrate, seed, make-fixtures
tests/          Vitest suites and fixtures
docs/           Architecture, ADRs, product analysis, UI skills
prototype/      Clickable design prototype and notes
```

## Scope decisions and known limitations

Deliberate cuts, chosen to fit a 4-6 hour build:
- **No real-time co-editing.** Concurrent edits are handled by a version check on save (409 plus a choose-a-version banner), not merged. Last write wins at the title level. A CRDT (Yjs) is the path forward.
- **Simulated auth.** Pick-a-user login with a signed cookie. No passwords, OAuth or signup. Not for real data.
- **Catch-up works on top-level blocks.** It tells you which paragraph, heading or list changed and who changed it, not a word-level diff. Nested list-item edits mark the whole list.
- **No** version history, comments, suggestions, link sharing, ownership transfer, tables or images.
- **Sharing is by email of an existing user** only; no invites for unknown addresses.
- Search on the dashboard is client-side.
- Import is lossy by design (see above); `.docx` fidelity is limited to headings, lists and marks.
- **Known gaps:** a save that passed its access check just before a revoke still lands; no zip-bomb limit on `.docx`; no rate limiting.

## Status

**Working:** auth, document CRUD, autosave and conflict handling, sharing and roles, import with report and Undo, catch-up and handoff notes, UI matching the approved prototype (responsive at 360/768/1440, Rive + motion), 185 passing tests, clean typecheck, lint and build.

**Deployed:** Vercel (Hobby) + Neon Postgres (free), migrations and seed run on each deploy.

**Incomplete:** walkthrough video, live URL, AI_WORKFLOW.md.

**Next 2-4 hours:** finish UI polish and run a manual pass at phone width; deploy and smoke-test the live app; record the video; add a few browser E2E tests for catch-up and conflict flows; sharer sees "Done" when a recipient acknowledges a handoff note.

## AI workflow

This project was built with Claude Code driving several scoped agents (product analysis, architecture, prototype, backend, UI), with a written plan and tracker in [PLAN.md](PLAN.md) and human sign-off gates between phases. Third-party agent skills were vetted before install ([docs/UI-SKILLS.md](docs/UI-SKILLS.md)). Details, including what was delegated, what was verified by hand, and where the AI was wrong, will be in [AI_WORKFLOW.md](AI_WORKFLOW.md) (to be written).
