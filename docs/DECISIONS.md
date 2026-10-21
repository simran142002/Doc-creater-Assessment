# Architecture Decision Records — Ajaia Docs

Constraints behind every choice:
- **4–6 h build**
- **free for the reviewer**
- **one person**
- **the reviewer judges judgment**

Each ADR covers context, options, decision, consequences and when to revisit. See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit.

## Summary

| # | Decision | Chosen | Main runner-up | Revisit when |
|---|---|---|---|---|
| 001 | App framework | Next.js App Router + TS; mutations via Route Handlers | Vite SPA + Express; Server Actions | Separate API consumers or long-lived connections are needed |
| 002 | Editor | TipTap v3 (ProseMirror) | Lexical, Slate, Quill | Need for a feature TipTap gates behind Pro |
| 003 | Content format | ProseMirror JSON in `jsonb` | HTML, Markdown | Real-time collaboration (add a Yjs binary alongside) |
| 004 | Database & host | Postgres on Neon free; PGlite for local and tests | SQLite/Turso, Supabase, Firebase | Need for realtime push or auth from the DB vendor |
| 005 | ORM | Drizzle | Prisma, raw SQL | Team prefers Prisma's DX; complex relations |
| 006 | Auth | Seeded users + signed JWT cookie (jose) | Auth.js magic link, Clerk | Any real user data |
| 007 | Concurrency | Optimistic version check (409) + last-write-wins on title; **no CRDT** | Yjs + Hocuspocus | Two people routinely edit the same doc at once |
| 008 | File import | Stateless preview endpoint → normal create; mammoth/marked → `generateJSON` | Single endpoint with `dryRun`; server-stashed upload | Large files or async conversion |
| 009 | Catch-up diff | Server-maintained per-block `{hash, by, at}` map + per-user `last_seen_at` | Per-user content snapshots; client-side diff | Need inline "what changed" diffs |
| 010 | UI kit & animation | Tailwind + shadcn/ui; Framer Motion for UI motion, Rive for illustrations, CSS for highlights | Lottie, pure CSS | Rive assets unavailable, or bundle budget tight |
| 011 | Testing | Vitest + PGlite; route-handler integration; no E2E | Jest, Playwright, Docker Postgres | More time, or regressions in UI flows |
| 012 | Deployment | Vercel Hobby + Neon; migrate + idempotent seed in build | Render/Fly + managed PG, Netlify | Commercial use, or cold starts hurt |

---

## ADR-001 — Next.js App Router, mutations via Route Handlers
**Context.** UI and API have to ship in one deployable on a free host, quickly.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **Next.js App Router** | One repo and one deploy; Server Components read the DB directly, so dashboard and editor need no loading spinners; first-class on Vercel | App Router caching rules are subtle; serverless means no long-lived sockets |
| Vite SPA + Express | Simple mental model | Two deploys, CORS, more glue |
| Remix / React Router 7 | Clean loaders and actions | Less familiar; free hosting is equally fine but smaller ecosystem for shadcn examples |

**Sub-decision: Server Actions or Route Handlers for mutations?** Route Handlers. The brief values a clear API, and they give explicit status codes (409, 413, 415) that the autosave hook branches on. They can also be tested by calling `POST(req)` directly, and they show up as a reviewable API table. Server Actions would save some boilerplate but hide the HTTP contract.

**Decision.** Next.js (current stable) App Router, TypeScript strict, Node runtime for every route because mammoth and the DB driver need Node APIs.

**Consequences.** Real-time push isn't possible on Vercel functions (see ADR-007). Pages use `dynamic = 'force-dynamic'`, which sidesteps cache surprises.

**Revisit when** there are non-web API consumers or WebSocket needs, at which point a separate service is warranted.

---

## ADR-002 — TipTap v3 as the editor
**Context.** The brief needs bold, italic, underline, H1–H3 and lists with natural keyboard behaviour, and the same schema has to be usable server-side for validation and import.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **TipTap v3** | ProseMirror's robustness; StarterKit v3 bundles underline and list keymaps; JSON output; framework-agnostic extensions usable on the server; `generateJSON` for HTML import; a Yjs collaboration path exists | Some extensions are Pro-only; abstraction over ProseMirror occasionally leaks |
| Lexical | Fast, Meta-backed | Server-side HTML→state needs a DOM shim; smaller extension set; collab path less turnkey |
| Slate | Very flexible | You build lists and normalisation yourself, which takes hours |
| Quill | Quick to drop in | Delta model is awkward to validate; weaker structured lists; dated React story |
| `contenteditable` + `execCommand` | Zero deps | Deprecated API, inconsistent HTML, no schema |

**Decision.** TipTap v3. One `extensions.ts` module is the schema for the editor, for server validation (`Node.fromJSON(...).check()`), and for import (`@tiptap/html` `generateJSON`). Block ids come from `@tiptap/extension-unique-id`. It is open source and published on npm; build-time step: confirm we don't accidentally pull the `@tiptap-pro` variant.

**Consequences.**
- Pros: the schema acts as the sanitiser, and anything it can't represent is dropped everywhere.
- Cons: the client bundle grows by about 100 KB gzip (acceptable).
- Fallback: if the UniqueID package misbehaves, a roughly 30-line custom `appendTransaction` plugin can assign `attrs.id`.

**Revisit when** a needed feature (comments, AI suggestions) is Pro-only and paid.

---

## ADR-003 — Store content as ProseMirror JSON (`jsonb`)
**Context.** Formatting has to survive save and reopen exactly (FR-1.9, FR-4.2), and the catch-up feature needs addressable blocks.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **ProseMirror JSON** | Lossless round-trip; validatable against the schema; blocks carry stable `attrs.id`; queryable in `jsonb` | Not human-readable; tied to the TipTap schema, so schema changes need migrations |
| HTML | Portable, easy to render | Round-trip normalisation drift; must be sanitised on every read; no stable block ids without attributes |
| Markdown | Readable, diffable | Lossy (underline has no Markdown form); conversion on every save |

**Decision.** JSON in `documents.content jsonb`, capped at 1 MB. HTML and Markdown exist only at the edges: import, and export as a stretch goal.

**Consequences.** Search and preview snippets need text extraction, which is cheap to do from JSON. Schema evolution is handled by keeping extensions additive.

**Revisit when** adding real-time collaboration: the Yjs update binary becomes the source of truth and JSON becomes a derived snapshot.

---

## ADR-004 — Postgres on Neon (prod), PGlite (local and test)
**Context.** Data has to survive redeploys on a free serverless host, and the reviewer runs nothing.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **Neon Postgres (free)** | Real Postgres (`jsonb`, enums, FKs, conditional updates); HTTP driver suits serverless; scales to zero; Vercel integration | Cold start of about 0.5–1 s after 5 min idle; free limits of 0.5 GB and 100 CU-h/month (ample here) |
| SQLite file on Vercel | Simplest locally | **Serverless disk is ephemeral and per-instance, so data vanishes.** Disqualified |
| Turso/libSQL | SQLite semantics, free tier, edge-friendly | Weaker JSON and enum support; one more vendor to learn |
| Supabase | Postgres plus auth, storage and realtime | We'd use none of the extras and they'd tempt scope creep; free projects pause after 7 days of inactivity, which is a risk if the reviewer opens the link late |
| Firebase/Firestore | Realtime, generous free tier | Document DB fights a relational sharing model; security rules become a second access-control layer to test; no SQL |

**Decision.** Neon in production via `drizzle-orm/neon-http`. **PGlite** (in-process WASM Postgres) is used when `DATABASE_URL` is unset, in local dev and in tests. Both run the same migrations.

**Consequences.**
- neon-http has no interactive transactions, so writes are designed as single atomic statements; the conditional `UPDATE … WHERE version` is one.
- PGlite and Neon could differ at the margins; we stay on plain SQL features to avoid that.

**Revisit when** we need push-based realtime (Supabase Realtime, or our own WS) or exceed the free tier limits.

---

## ADR-005 — Drizzle ORM
**Context.** We need type-safe queries, migrations, and support for the Neon HTTP and PGlite drivers, with a small cold-start footprint.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **Drizzle** | SQL-shaped, typed; tiny runtime; first-class `neon-http` and `pglite` drivers; `drizzle-kit` generates readable SQL migrations | Less "magic" relation loading; younger ecosystem |
| Prisma | Excellent DX and studio | Heavier client and engine, so slower serverless cold starts; PGlite support is less direct |
| Raw `postgres`/`pg` | No abstraction | Hand-typed rows; DIY migrations |

**Decision.** Drizzle with committed SQL migrations.

**Consequences.** Queries read like SQL, so reviewers can audit `getAccess` at a glance.

**Revisit when** the team standardises on Prisma.

---

## ADR-006 — Simulated auth: seeded users + signed cookie
**Context.** The brief allows simulated users. Auth is not what's being graded; access control is.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **Pick-a-user + jose-signed httpOnly JWT cookie** | Zero friction for reviewers; still exercises real session plumbing (`requireUser`, no client-supplied ids) | Anyone can be anyone; clearly a demo |
| Auth.js (email magic link / GitHub) | Real auth | Needs an email provider or OAuth app setup; slows review; 1 h+ |
| Clerk/Auth0 | Polished | Vendor setup, keys, free-tier signup for the reviewer to understand |
| Header `x-user-id` | Fastest | Teaches the wrong pattern; trusts the client |

**Decision.** 3–4 seeded users and a login picker. `ajaia_session` is an HS256 JWT (7 d), httpOnly, `SameSite=Lax`, Secure in production. Identity always comes from the verified cookie.

**Consequences.** Swapping in Auth.js later replaces only `auth.ts` and the login page; `users` already has an email key.

**Revisit when** there is any real user data.

---

## ADR-007 — No real-time collaboration; optimistic version check instead
**Context.** "Collaborative" invites CRDTs. Real-time sync needs a stateful WebSocket server (Vercel functions can't hold one), a persistence adapter, and presence. That is 1–2 days to do well. Silent last-write-wins, though, loses work, which breaks goal G1.

**Options**
| Option | Pros | Cons |
|---|---|---|
| Plain last-write-wins | Zero work | Silent data loss when two people edit |
| **Optimistic concurrency: `version` column, `baseVersion` on save, 409 on mismatch** | About 20 min of work; no lost work; honest UX ("Priya edited this — Reload / Keep mine") | No merge; the second editor must choose |
| Yjs + Hocuspocus (+ `@tiptap/extension-collaboration`) | True merge, cursors, offline | Separate always-on server (Fly/Render free tiers are flaky); Y.Doc persistence; auth on the socket; blows the timebox |
| Liveblocks / Tiptap Cloud | Managed CRDT | Vendor keys; free-tier limits; the reviewer's experience depends on a third party |

**Decision.** Optimistic versioning for content.
- The client sends `baseVersion`.
- The server runs `UPDATE … SET version = version + 1 WHERE id = $1 AND version = $2`.
- Zero rows updated → `409 STALE_VERSION` with who and when.
- "Keep mine" resends with the current version (`force` semantics).
- Title is excluded from versioning (last-write-wins) so a rename never blocks a content save.

This fits the timebox (about 20 min server, 20 min banner) and it's the cheapest thing that makes "no lost work" true.

**How Yjs slots in later.**
1. Add `documents.ydoc bytea`.
2. Run Hocuspocus on a small Node host, with `onAuthenticate` calling the same `getAccess`.
3. Add the `Collaboration` + `CollaborationCaret` extensions.
4. Hocuspocus `onStoreDocument` writes the Y binary and a derived JSON snapshot. Catch-up `block_meta` is computed from that snapshot, so ADR-009 survives.
5. Remove the version check.

**Consequences.** Two simultaneous editors see a conflict banner, not merged text. This is stated in the README and the video.

**Revisit when** concurrent editing of the same doc is a primary use case.

---

## ADR-008 — Import: stateless preview, then normal create
**Context.** `.txt`/`.md`/`.docx` must become an editable doc. We want a preview before committing, without storing blobs.

**Options**
| Option | Pros | Cons |
|---|---|---|
| Single `POST /import` that creates immediately | Simplest | No preview; junk docs pile up from wrong files |
| `POST /import?dryRun=1` then the same endpoint without the flag | One endpoint | File is uploaded and parsed twice; branchy handler |
| Upload → server stash (Blob/DB) → `confirm/:token` | Parse once | Needs storage, expiry and cleanup; overkill |
| **`POST /api/import/preview` returns JSON → client `POST /api/documents {title, content}`** | Stateless; parse once; create path reused; the preview is the real editor rendering the real JSON | Client resends the content (≤ 1 MB, fine). The server re-validates it like any save, so there's no trust issue |

**Conversion pipeline:**
- `.docx` → **mammoth** (semantic HTML: headings, lists, strong/em/u; ignores styling noise)
- `.md` → **marked** (GFM)
- `.txt` → escaped `<p>` per line
- then **`@tiptap/html` `generateJSON(html, extensions)`**, which drops anything off-schema, and `generateUniqueIds` for block ids

**Alternatives rejected:**
- `docx` → `docx4js` or a hand-rolled OOXML parser: too much time.
- Pandoc: a binary that isn't available on Vercel.
- `remark` → ProseMirror directly: a nicer AST, but two schemas to maintain.

**Decision.** Stateless preview plus the existing create endpoint. Limits:
- 2 MB in, 1 MB JSON out
- extension allow-list plus `PK` magic bytes for docx
- 415 / 413 / 422 errors

**Consequences.** Images, tables and comments in docx are dropped and reported as a `warnings[]` entry. There is no zip-bomb inflation guard beyond the size caps.

**Revisit when** supporting big files or PDF, which would need async conversion and blob storage.

---

## ADR-009 — Catch-up: server-maintained per-block metadata
**Context.** On open, show "N blocks changed by X since you last opened" and highlight them. It must be cheap, robust to concurrent saves, and attribute changes to the right people.

**Options**
| Option | Pros | Cons |
|---|---|---|
| A. Per-user snapshot `document_views.last_seen_content jsonb`; diff on open | Can show *what* changed (inline diff) | Storage O(users × doc size); write amplification on every open; attribution unknown when several people edited in between |
| B. Per-user block-hash array in `document_views` | Smaller than A | Still per-user; still no attribution |
| C. Client-side diff vs a `localStorage` snapshot | No server work | Breaks across devices and browsers; can't attribute; not testable server-side |
| D. Revision log table, diff revisions | Enables history too | Most work; not needed for the feature |
| **E. `documents.block_meta {blockId: {h, by, at}}` updated on each save + per-user `document_views.last_seen_at`** | O(blocks) storage, not per user; attribution per block for free; catch-up becomes a filter, not a diff; pure functions are easy to test; computed in the same versioned UPDATE, so it's consistent | Only shows *that* a block changed, not the old text; deletions need tombstones; granularity is top-level blocks |

**Decision.** Option E. Stable ids come from TipTap UniqueID on block nodes. On save the server hashes each top-level block (excluding its id) and updates the entry when the hash changes; missing ids become tombstones (pruned after 30 d or 200 entries). On open, the visible blocks are those where `at > last_seen_at && by ≠ me`, and the visit is then recorded. The highlight is a decoration only and is never saved. The dashboard "changed" dot uses `updated_at > last_seen_at AND last_edited_by ≠ me`, with no JSON scan.

**Consequences.**
- The client must keep block ids stable, which UniqueID handles across split, merge and paste.
- If the client omits ids, the server fills them as a fallback. That block is then "new" once, a harmless false positive.
- Editing one item in a list highlights the whole list (stated limitation).

**Revisit when** users want inline diffs. Add the previous text to `block_meta`, or move to option D.

---

## ADR-010 — UI kit and animation: shadcn/ui + Framer Motion + Rive (+ CSS)
**Context.** The product should feel polished, but motion must never slow the typing path, and the kit must be fast to assemble with good accessibility.

**UI kit**
| Option | Pros | Cons |
|---|---|---|
| **Tailwind + shadcn/ui (Radix)** | Accessible primitives (Dialog, Select, Dropdown); code lives in the repo; no runtime theme lib | Copy-in components to maintain |
| MUI / Chakra | Batteries included | Heavier, opinionated look; fights a Docs-like aesthetic |
| Hand-rolled | Full control | Focus traps and ARIA are easy to get wrong in a timebox |

**Animation**
| Option | Pros | Cons |
|---|---|---|
| **Framer Motion** | Declarative enter/exit (`AnimatePresence`), `layout` reorder, `reducedMotion="user"` | ~30–40 KB; overkill for hovers |
| **Rive** (`@rive-app/react-canvas`) | Small `.riv` files; interactive **state machines** (e.g. an import loop → success → error from one asset); runtime renders to canvas | WASM runtime (~150 KB+) so it must be lazy-loaded; needs authored `.riv` assets |
| Lottie | Huge free asset library | JSON files are larger; no state machines, so states are separate files; heavier player |
| CSS only | Free, fastest | No orchestration for exit animations or layout |

**Decision.**
- Framer Motion for structural UI motion: dialogs, banners, card reorder.
- Rive only for illustrative moments (login hero, empty states, import parsing), loaded via `next/dynamic`, with a static SVG fallback.
- CSS for hovers, skeletons and the catch-up highlight fade.
- All motion respects `prefers-reduced-motion`.

**Consequences.** If good `.riv` assets can't be sourced or made in about 20 min, Rive gets cut and the SVG fallback stays, with no functional loss. Rive is the first thing cut under time pressure.

**Revisit when** the bundle budget tightens, or a design team supplies Lottie assets.

---

## ADR-011 — Vitest + PGlite; integration at the route-handler level; no E2E
**Context.** The brief asks for at least one meaningful automated test. The riskiest logic is access control, concurrency, import and catch-up.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **Vitest** | Fast, native TS/ESM, Jest-compatible API | — |
| Jest | Familiar | ESM/TS config friction |
| **PGlite** for DB tests | Real Postgres semantics in-process; no Docker or Neon branch; fresh DB per file in ms | WASM startup ~1 s; tiny parity risk |
| Docker Postgres / Neon test branch | Exact prod parity | The reviewer needs Docker or credentials just to run tests |
| Playwright E2E | Proves real UI flows | 45+ min to set up and stabilise; flaky on CI with a cold DB |

**Decision.**
- Vitest with six suites (ARCHITECTURE §8).
- Route handlers are imported and called with constructed `Request`s carrying a minted cookie. This exercises real Zod, authZ and SQL without a server.
- No Playwright. A two-browser manual smoke checklist replaces it, and the video records it.

**Consequences.** UI regressions such as the toolbar state aren't caught automatically.

**Revisit when** there's more time: add one Playwright test covering share → recipient sees doc → viewer can't type.

---

## ADR-012 — Deploy on Vercel Hobby + Neon free
**Context.** Live URL, $0 for everyone, push-to-deploy.

**Options**
| Option | Pros | Cons |
|---|---|---|
| **Vercel + Neon** | Native Next.js; preview URLs; Neon integration injects env vars | Hobby plan is non-commercial (fine for a take-home); 4.5 MB function body cap (we cap at 2 MB); serverless cold starts |
| Render / Railway / Fly + managed PG | Long-lived server (would allow WebSockets) | Free tiers sleep or expire, slow first load, or need a card |
| Netlify | Similar to Vercel | Next.js support lags slightly |
| Cloudflare Pages/Workers | Fast edge | mammoth and Node APIs need compat shims; D1 is SQLite |

**Decision.**
- Vercel Hobby plus Neon free.
- The build runs `db:migrate` (journaled, idempotent) and `db:seed` (upserts users by email, creates the welcome doc only if absent), then `next build`.
- Env: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`.
- Locally, packages install from `registry.yarnpkg.com` because `registry.npmjs.org` is TLS-blocked on the dev machine. The lockfile URLs resolve fine on Vercel.

**Consequences.**
- Preview and prod deploys share one DB unless a Neon branch per preview is configured. That's acceptable here; noted.
- The first request after idle pays Neon's cold start.

**Revisit when** the project goes commercial (Vercel Pro) or needs WebSockets (ADR-007 → a separate Hocuspocus host).
