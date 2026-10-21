# Ajaia Docs — Requirements, Plan & Tracker

> **Single source of truth for this assignment.** Re-read before each phase. Tick boxes as work lands; never tick something that hasn't been verified in a browser or by a test.
>
> Timebox: 4–6 h total (hard stop). Started: 2026-10-21. A focused partial solution beats an overextended one.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done & verified · `[-]` deliberately cut (reason noted)

---

## 0. Product requirement analysis

### 0.1 What the reviewer is really grading
| Lens | What "good" looks like |
|---|---|
| Product judgment | A coherent slice; deliberate, *written* scope cuts |
| Full-stack execution | FE + API + DB + access checks all real, not mocked in the UI |
| Editor quality | Formatting feels natural; saves reliably; no lost work |
| Upload & sharing | Product-relevant behaviour, server-enforced access |
| Shipping | Live URL works for a stranger with zero setup |
| Code & delivery | Small, readable, tested where it matters |
| Communication | README / architecture / AI note / video are crisp and honest |
| AI usage | Shows judgment: what was changed, rejected, verified |

### 0.2 Users & core flow
- **Personas:** Owner (creates & shares), Collaborator (receives shared docs).
- **Happy path:** Sign in as seeded user → dashboard (Owned / Shared with me) → New doc → rename → write with formatting → autosave → refresh, still there → share with a second user → sign in as that user → doc appears under *Shared with me* → edit (if editor) → upload a `.md`/`.docx` → becomes a new editable doc.

### 0.3 Scope decisions (proposed — confirm before build)
| Area | In | Out (state in README) |
|---|---|---|
| Auth | Seeded users, pick-a-user login, signed httpOnly cookie | Passwords, OAuth, signup |
| Editing | Bold, italic, underline, H1–H3, bullet & numbered lists, undo/redo | Tables, images, comments, fonts/colours |
| Save | Debounced autosave + "Saved / Saving… / Error" status | Real-time co-editing (CRDT) |
| Upload | `.txt`, `.md`, `.docx` → **new editable doc**, 2 MB max | PDF, images, attachments |
| Sharing | Owner shares by email with role **viewer / editor**; revoke | Link sharing, groups, transfer ownership |
| Persistence | Postgres, content stored as editor JSON (lossless formatting) | Version history |
| Stretch (pick ≤1) | Role-based permissions (already in sharing) **or** export to Markdown | Everything else |

### 0.4 Open questions for the user
- [x] Confirm stack (§3) and deployment target. (stack in use, deployed)
- [x] Confirm upload behaviour = "import as new document". (import as new doc, built)
- [x] Confirm stretch = viewer/editor roles (cheap, adds depth to sharing). (viewer/editor roles built)

---

## 1. Functional requirements checklist

### FR-1 Document creation & editing
- [x] FR-1.1 Create a new document (default title "Untitled document") (tests/edge-documents.test.ts; prod smoke create)
- [x] FR-1.2 Rename document inline (title field), persisted (tests/edge-documents.test.ts)
- [x] FR-1.3 Edit rich content in browser (Chrome walkthrough, log)
- [x] FR-1.4 Bold / Italic / Underline (toolbar + Ctrl/Cmd-B/I/U) (lib/editor config; Chrome walkthrough, log)
- [x] FR-1.5 Headings (H1–H3) / normal text (Chrome walkthrough, log)
- [x] FR-1.6 Bulleted and numbered lists (Chrome walkthrough, log)
- [x] FR-1.7 Toolbar shows active state for current selection (Chrome walkthrough, log)
- [x] FR-1.8 Autosave (debounced) with visible save status; stale write → 409 → "Reload / Keep mine" banner (tests/autosave.test.ts, tests/conflict.test.ts; prod 409)
- [x] FR-1.9 Reopen from dashboard; formatting preserved exactly (Chrome walkthrough + prod smoke save)
- [x] FR-1.10 Delete document (owner only) with confirmation (tests/edge-documents.test.ts)

### FR-2 File upload
- [x] FR-2.1 Upload `.txt` → paragraphs (tests/import.test.ts, tests/edge-import.test.ts)
- [x] FR-2.2 Upload `.md` → headings, lists, bold/italic preserved (tests/import.test.ts, tests/edge-import.test.ts)
- [x] FR-2.3 Upload `.docx` → headings, lists, bold/italic/underline preserved (tests/import.test.ts, tests/edge-import.test.ts)
- [x] FR-2.4 Imported doc title = filename (sans extension); opens in editor (tests/import.test.ts, tests/edge-import.test.ts)
- [x] FR-2.5 Supported types & size limit stated in UI next to the button (README file-types table; import dialog)
- [x] FR-2.6 Clear error for unsupported type / oversize / empty / corrupt file (tests/import.test.ts, tests/edge-import.test.ts)

### FR-3 Sharing & access
- [x] FR-3.1 Every doc has exactly one owner (tests/access.test.ts, tests/shares.test.ts; prod viewer 403/stranger 404)
- [x] FR-3.2 Owner shares with another user by email, choosing viewer/editor (tests/access.test.ts, tests/shares.test.ts; prod viewer 403/stranger 404)
- [x] FR-3.3 Owner can change role or revoke access (tests/access.test.ts, tests/shares.test.ts; prod viewer 403/stranger 404)
- [x] FR-3.4 Dashboard separates **My documents** vs **Shared with me** (with owner name) (app/dashboard.tsx; Chrome walkthrough, log)
- [x] FR-3.5 Shared doc shows a badge/role indicator in editor (app/d/[id]/document-view.tsx; role-chip)
- [x] FR-3.6 Viewer: read-only editor, toolbar disabled (tests/access.test.ts, tests/shares.test.ts; prod viewer 403/stranger 404)
- [x] FR-3.7 Non-member gets 404/403 from API and a friendly page in UI (tests/access.test.ts, tests/shares.test.ts; prod viewer 403/stranger 404)
- [x] FR-3.8 Only owner can rename-delete-share (editors can edit content + title? → decide: **content + title yes, share/delete no**) (tests/access.test.ts, tests/shares.test.ts; prod viewer 403/stranger 404)
- [x] FR-3.9 Cannot share with self / unknown email → validation message; re-sharing an existing collaborator updates their role (tests/access.test.ts, tests/shares.test.ts; prod viewer 403/stranger 404)

### FR-4 Persistence
- [x] FR-4.1 Docs survive refresh and server restart (Chrome walkthrough, log; Neon Postgres JSONB)
- [x] FR-4.2 Formatting stored as structured JSON (not lossy text) (Chrome walkthrough, log; Neon Postgres JSONB)
- [x] FR-4.3 Shares persisted; reflect immediately for recipient (Chrome walkthrough, log; Neon Postgres JSONB)
- [x] FR-4.4 `updated_at` shown on dashboard, list sorted by it (Chrome walkthrough, log; Neon Postgres JSONB)

### FR-5 Auth (simulated)
- [x] FR-5.1 Seeded users (≥3) listed on login screen (tests/edge-api.test.ts; prod sign-in x3)
- [x] FR-5.2 Session cookie; sign out; switch user (tests/edge-api.test.ts; prod sign-in x3)
- [x] FR-5.3 All API routes require a session (tests/edge-api.test.ts; prod sign-in x3)

---

## 2. Non-functional requirements checklist

### NFR-1 Reliability & data safety
- [x] No lost edits: save on debounce + on blur/unload; retry once on failure (code + tests)
- [x] Last-write-wins documented as known limitation (no concurrent merge) (docs/ARCHITECTURE-NOTE.md)
- [x] Server validates payload size (content ≤ 1 MB, title ≤ 200 chars) (lib/validation, tests/edge-documents.test.ts)

### NFR-2 Security (proportionate)
- [x] Access checks enforced **server-side** on every doc route (code + tests)
- [x] Signed httpOnly cookie; no user id trusted from the client body (code + tests)
- [x] Upload: MIME + extension check, size cap, parsed in memory, never executed (code + tests)
- [x] Imported HTML sanitized via the editor schema (unknown nodes dropped) (code + tests)
- [x] No secrets in repo; `.env.example` provided (code + tests)

### NFR-3 Validation & error handling
- [x] Zod (or equivalent) schemas on every API input (code + tests)
- [x] Consistent JSON error shape `{ error: { code, message } }` (code + tests)
- [x] UI surfaces errors as toasts/inline, never silent failure (code + tests)
- [x] Empty states: no docs, nothing shared, doc not found (not-found.tsx, dashboard empty states)

### NFR-4 Usability
- [x] Editor feels like a document (page width, readable typography) (Chrome walkthrough, log)
- [x] Keyboard shortcuts work; focus lands in editor on new doc (Chrome walkthrough, log)
- [~] Works on latest Chrome/Safari/Firefox (Chrome walkthrough only; Safari/Firefox untested)
- [~] **Fully responsive (user requirement): prototype AND app must not break at 360px mobile, 768px tablet, 1024px+ desktop** — editor toolbar collapses/scrolls, dialogs become sheets, dashboard grid → list, touch targets ≥44px, no horizontal page scroll (responsive breakpoints implemented, 44px targets and 360px pass not formally measured)
- [x] Loading states for dashboard, editor, upload (app/loading.tsx)

### NFR-5 Performance (sane, not tuned)
- [~] Dashboard < 1 s on deploy for seeded data (not measured on prod)
- [x] Autosave debounce ~800 ms; no save storm while typing (lib/client/autosave.ts, tests/autosave.test.ts)

### NFR-6 Maintainability & testing
- [x] TypeScript strict; lint passes (typecheck+lint clean, log)
- [x] Clear folders: `app/` (UI+routes), `lib/` (db, auth, access, import) (code + tests)
- [x] **Tests (meaningful, not volume):** (code + tests)
  - [x] Access-control unit tests (owner / editor / viewer / stranger matrix) (tests/access.test.ts)
  - [x] Import tests (md & docx → expected node structure) (tests/import.test.ts)
  - [x] API integration test: create → share → recipient can read, stranger can't (tests/shares.test.ts, tests/edge-api.test.ts)
- [x] One-command local run; seed script idempotent (npm test / vercel-build seed; README)

### NFR-7 Deployability
- [x] Free tier only — reviewer pays nothing (Vercel Hobby + Neon free)
- [x] Live URL reachable, seeded, survives redeploy (managed DB, not ephemeral disk) (prod smoke, log)
- [x] Env vars documented (README, .env.example)

---

## 3. Proposed tech stack (recommendation)

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | One deployable for UI + API; fastest to ship |
| Editor | **TipTap (ProseMirror)** | Rich-text marks/lists out of the box; JSON doc model = lossless persistence |
| DB | **Postgres on Neon (free)** via **Drizzle ORM** | Persistent across redeploys (SQLite on serverless disk is not) |
| Auth | Seeded users + signed cookie (`jose`) | Meets "simulated users" with zero friction |
| Import | `mammoth` (.docx → HTML), `marked` (.md → HTML) → TipTap `generateJSON` | Reuses editor schema as sanitizer |
| UI | Tailwind + shadcn/ui (Radix) | Accessible primitives, fast to style |
| Motion | Framer Motion + Rive (`@rive-app/react-canvas`) | Micro-interactions + one hero animation; Rive cut first if no `.riv` |
| Tests | Vitest on **PGlite** (in-process Postgres) | `npm test` needs no DB; route handlers called directly |
| Deploy | **Vercel** (app) + **Neon** (DB); migrate + seed in build | Free, git-push deploys |

Local-env note: registry.npmjs.org is TLS-blocked on this machine → install via the yarnpkg mirror. PGlite for local dev too.
Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · rationale: [docs/DECISIONS.md](docs/DECISIONS.md) (12 ADRs). Mutations use Route Handlers (not Server Actions) for explicit 409/413/415.

### Data model
```
users          (id, email UNIQUE, name)
documents      (id, owner_id → users, title, content JSONB, version INT, block_meta JSONB,
                last_edited_by → users, source ENUM('blank','import'), created_at, updated_at)
shares         (document_id, user_id, role ENUM('viewer','editor'), note ≤280, note_seen_at,
                created_at, updated_at, PK (document_id, user_id))
document_views (user_id, document_id, last_seen_at, PK (user_id, document_id))
```
`block_meta` = `{blockId: {hash, by, at}}` (ids via `@tiptap/extension-unique-id`), updated on each save. Catch-up = blocks where `by ≠ me AND at > last_seen_at` — a filter, not a diff; top-level blocks only.

### API surface
```
GET    /api/users | /api/me                         → seeded users / current user
POST   /api/session            {userId}             → set cookie
DELETE /api/session                                  → sign out
GET    /api/documents                                → {owned[], shared[]}
POST   /api/documents          {title?, content?}    → doc (also used to confirm an import)
GET    /api/documents/:id                            → doc + myRole + catch-up blocks
POST   /api/documents/:id/open                       → bump last_seen_at / note_seen_at
PATCH  /api/documents/:id      {title?, content?, baseVersion, force?} → owner|editor; 409 on stale
DELETE /api/documents/:id                            → owner
POST   /api/import/preview     multipart file        → parsed TipTap JSON, writes nothing
GET    /api/documents/:id/shares                     → owner
PUT    /api/documents/:id/shares {email, role, note?} → owner (upsert: re-share updates role)
DELETE /api/documents/:id/shares/:userId             → owner
```
Single `getAccess(userId, docId) → 'owner'|'editor'|'viewer'|null` — every route goes through it. Stranger → **404**, viewer writing → **403**.

---

## 4. Phased plan & task breakdown

Budget ≈ 4 h remaining. Times are ceilings; if a phase overruns, cut from the bottom of its list.

### Phase 0 — Requirements & plan (≈15 min)
- [x] P0.1 Requirement analysis + FR/NFR checklist (this file)
- [x] P0.3 Architecture + decision records written
- [x] P0.2 User confirms scope, stack, open questions (§0.4) (scope approved via prototype sign-off, log)

### Phase 1 — Design prototype (≈30 min)
Clickable static prototype is the visual spec for the build; build must match it.
- [x] P1.1 Login / user picker screen
- [x] P1.2 Dashboard: My documents / Shared with me, New + Upload buttons, empty states
- [x] P1.3 Editor: title, toolbar (B/I/U, H1–H3, lists, undo/redo), save status, Share button, role badge
- [x] P1.4 Share dialog: email + role, list of collaborators, revoke
- [x] P1.5 Error/empty/read-only states
- [x] P1.6 User sign-off on prototype (2026-10-21)

### Phase 2 — Product development

**Product tasks** (user-visible behaviour)
- [x] PR-1 Login with seeded users; switch user (Chrome walkthrough on fresh seed, log)
- [x] PR-2 Dashboard lists with owned/shared distinction, sorted by last edit (Chrome walkthrough on fresh seed, log)
- [x] PR-3 Create → lands in editor with title focused (Chrome walkthrough on fresh seed, log)
- [x] PR-4 Rich-text editing + autosave + status indicator (Chrome walkthrough on fresh seed, log)
- [x] PR-5 Rename inline (Chrome walkthrough on fresh seed, log)
- [x] PR-6 Share dialog (add, change role, revoke) with validation messages (Chrome walkthrough on fresh seed, log)
- [x] PR-7 Read-only view for viewers (Chrome walkthrough on fresh seed, log)
- [x] PR-8 Upload `.txt/.md/.docx` → new doc, limits shown in UI (Chrome walkthrough on fresh seed, log)
- [x] PR-9 Delete doc (owner) (Chrome walkthrough on fresh seed, log)
- [x] PR-10 Not-found / no-access page (Chrome walkthrough on fresh seed, log)

**Tech tasks** (in build order)
- [x] T-1 Scaffold Next.js + TS + Tailwind + lint; repo init (≈10 min)
- [x] T-2 Neon DB + Drizzle schema + migration + idempotent seed (≈20 min)
- [x] T-3 Session cookie + `requireUser()` helper (≈15 min)
- [x] T-4 `getAccess()` + documents CRUD routes with Zod validation (≈30 min)
- [x] T-5 Share routes (≈15 min)
- [x] T-6 Import route: type/size checks, mammoth/marked → TipTap JSON (≈25 min)
- [x] T-7 (matches approved prototype, measured style diff, 65 tests, build OK) UI: login, dashboard, editor (TipTap), share dialog, upload (≈60 min)
- [x] T-8 Tests: access matrix, import, share integration (≈25 min)
- [x] T-9 Deploy to Vercel + Neon, seed prod, smoke-test as 2 users (≈15 min)

### Phase 3 — Verification (≈15 min)
- [~] V-1 Walk every FR box above in the **deployed** app, two browsers/users (prod smoke covered sign-in, create, save, 409, share, 403/404, import; not every FR in two browsers)
- [x] V-2 Refresh & reopen: formatting intact (Chrome walkthrough + tests, log)
- [x] V-3 Stranger URL access → blocked (prod smoke stranger 404, tests/access.test.ts)
- [~] V-4 Upload each supported type + one bad file (.md on prod, .txt/.docx/bad files in tests/edge-import.test.ts; not all via live UI)
- [x] V-5 `npm test` green; lint clean (185 tests, build OK, lint clean per log)

### Phase 4 — Deliverables (≈25 min)
- [x] D-1 `README.md` — setup, env, run, test, seeded users, supported file types (README.md exists)
- [x] D-2 `ARCHITECTURE.md` — what was prioritized & why, data model, access model, trade-offs (docs/ARCHITECTURE-NOTE.md exists)
- [x] D-3 `AI_WORKFLOW.md` — tools used, where it sped up, what was changed/rejected, how verified (AI_WORKFLOW.md exists)
- [x] D-4 `SUBMISSION.md` — exact list of included items + live URL + credentials (SUBMISSION.md exists)
- [x] D-5 Status section: working / incomplete / next 2–4 h (README Status + SUBMISSION Working/Incomplete/Next)
- [x] D-6 Screenshots or demo GIF (screenshots/ 8 PNGs)
- [~] D-7 `VIDEO.txt` with Loom/YouTube unlisted link (user records 3–5 min) in progress: VIDEO.txt exists but link is a placeholder; user recording
- [ ] D-8 Google Drive folder with source + all docs; share link not done: Drive folder not created

### Phase 5 — Optional stretch (only if all above are ✔)
- [-] S-1 Export to Markdown (or PDF via print stylesheet) cut: stretch taken is viewer/editor roles instead; no export built

---

## 4.1 Differentiators
- [x] DF-1 Catch-up: changed blocks highlighted + summary banner on reopen (tests/catchup*.test.ts)
- [x] DF-2 Handoff note attached to a share (tests/shares.test.ts, share-dialog)
- [x] DF-3 Import fidelity report + Undo ("Kept 4 headings, 12 bullets, dropped 1 table") — replaces preview step (import-dialog, tests/import.test.ts)
- [x] DF-4 Framer Motion micro-interactions everywhere + ONE Rive/Lottie hero (empty & all-caught-up states), ~30 min cap, first to cut (reduced-motion aware) (teddy.tsx Rive, lib/motion.ts)
- [x] DF-5 "New for you" dot on dashboard cards (from product analysis) (app/dashboard.tsx "New for you")

Decided by user: import = report + Undo; animation = capped (above).

### 4.2 Learnings applied from product analysis
- **Positioning (revised after Confluence/Google check):** catch-up is the *default*. Who changed which block shows on open, with no click, no AI tier and no space setup. It's a UX edge, not a new capability, so it must feel instant. **README and video must NOT claim catch-up is novel** (Google "See new changes", Confluence Premium AI summary and Loop recap exist).
- [x] L-1 Freshness line under the title ("Edited by Priya · 2h ago", borrowed from Confluence) + catch-up banner with Prev/Next ("1 of 3"), editor avatar in margin, "You're all caught up" moment (hero animation lives here) (document-view.tsx; tests/catchup-nav.test.ts)
- [x] L-2 Dashboard "New for you" filter chip; cards show dot + change count + note snippet; unseen-first ordering (app/dashboard.tsx)
- [x] L-3 (promoted: one permission layer vs Confluence's space+page) Share dialog plain-language role line (Editor: "Can edit. Can't share or delete." / Viewer: "Can read only."); editors see collaborators read-only (share-dialog.tsx)
- [x] L-4 Conflict banner "Priya saved a newer version — Load hers · Keep mine" (409 path) (document-view.tsx; tests/conflict.test.ts)
- [x] L-5 Save reliability: flush on blur/unload (sendBeacon) + one retry; "Couldn't save — Retry" (lib/client/autosave.ts; tests/autosave.test.ts)
- [x] L-6 Handoff note sticky card on first open, "Got it" dismisses (note_seen_at) (document-view.tsx; note seen)
- [x] L-7 Markdown input rules hint in empty doc ("type # for a heading") (document-view.tsx hint)
- Next (not now): sharer sees "Done" when the recipient acknowledges the handoff note, presence polling, named snapshots, daily digest, Yjs realtime

## 5. Deliberate cuts (to state in README & video)
- Real-time multi-cursor collaboration — needs CRDT/websocket infra; last-write-wins instead.
- Real authentication — simulated users keep focus on doc/sharing logic.
- Comments, suggestions, version history — valuable but not core to the brief.
- PDF/image import, attachments — `.docx/.md/.txt` cover the realistic "bring my doc in" case.

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| npm registry blocked locally | Use yarnpkg mirror |
| Serverless + DB connection limits | Neon serverless driver |
| docx import fidelity | Accept headings/lists/marks only; document it |
| Overrunning the timebox | Cut stretch first, then delete-doc, then role change (keep add/revoke) |

## 8. Brief compliance

| # | Brief requirement | Status | Evidence |
|---|---|---|---|
| 1 | Document creation and editing: create, rename, edit, save and reopen; bold, italic, underline, headings, lists | ✓ | FR-1.x; tests/edge-documents.test.ts, tests/autosave.test.ts; prod smoke create and save |
| 2 | File upload, supported types stated in UI and README | ✓ | `.txt/.md/.docx`, 2 MB; import-dialog.tsx, README file-types table; tests/import.test.ts, tests/edge-import.test.ts |
| 3 | Sharing: owner, grant access, owned vs shared distinction | ✓ | tests/access.test.ts, tests/shares.test.ts; dashboard My documents / Shared with me; seeded users |
| 4 | Persistence: refresh, formatting, shared access | ✓ | Neon Postgres, TipTap JSON; prod smoke; Chrome walkthrough (log) |
| 5a | Setup/run instructions | ✓ | README.md |
| 5b | Working deployment | ✓ | https://ajaia-docs-blond-nu.vercel.app; prod smoke (log) |
| 5c | Validation and error handling | ✓ | lib/validation, `{error:{code,message}}`, tests/edge-api.test.ts |
| 5d | At least one automated test | ✓ | 185+ Vitest tests in tests/ |
| 5e | Short architecture note | ✓ | docs/ARCHITECTURE-NOTE.md |
| 6 | AI workflow note | ✓ | AI_WORKFLOW.md |
| 7 | Video 3-5 min | ✗ | VIDEO.txt placeholder; user recording |
| 8 | Deliverables: Drive folder, SUBMISSION.md, video URL file, screenshots, credentials, local run, working/incomplete/next | ~ | SUBMISSION.md, VIDEO.txt, screenshots/ (8) present; Drive folder not created; GitHub push pending |
| 9 | Stretch (one is enough): role-based sharing beyond basic access | ✓ | Viewer/editor roles built (tests/access.test.ts) |
| 9 | Stretch not built: realtime collaboration indicators, comments/suggestions, version history, export to PDF/Markdown | n/a | Cut, see section 5 |

Note: README Status "Next" still lists deploying and smoke-testing; stale, deploy is live.

---

## 7. Progress log
| Time | Update |
|---|---|
| 2026-10-21 | Checklist audited against the brief |
| 2026-10-21 | Plan & requirements drafted; awaiting scope confirmation |
| 2026-10-21 | DEPLOYED https://ajaia-docs-blond-nu.vercel.app (Vercel CLI from folder + Neon via marketplace; vercel-build runs migrate+seed). Prod smoke test passed: sign-in ×3, dashboard catch-up counts, create, save, stale 409, share+note, viewer 403, stranger 404, .md import. GitHub push pending gh auth (MCP token can't create repos) |
| 2026-10-21 | Hardening done: 84 scenarios (83 tested) → edge-cases artifact; tests 65→185; build OK. Fixed OOM on many-line txt, NUL chars, deep nesting, Origin:null, bad token subject, multi-file import, owner revoke, UTF-16, filename sanitizing, DB error mapping. Members list open to all members. Known gaps: revoke-race save, Latin-1, zip-bomb, rate limiting |
| 2026-10-21 | UI done: matches prototype (tokens/fonts/motion/Rive/confetti, 640px), full flow verified on fresh seed, no console errors. Gaps: no job titles on sign-in, demo toggles omitted. Relayed to hardening agent: members list for editors/viewers via service, table rows as 'cell · cell' |
| 2026-10-21 | README written (artifact links, 64 tests). Backend edge-case hardening agent started (auth/input/docs/concurrency/shares/import/catch-up/500s) → docs/site/edge-cases.html artifact |
| 2026-10-21 | Prototype APPROVED. UI implementation agent (match prototype, skills, 640px breakpoint, Rive teddy + confetti, measured style diff) and README agent (with artifact links) running |
| 2026-10-21 | UI foundation done: skills frontend-design + shadcn (vetted) in .claude/skills, 18 shadcn primitives, autosave/conflict/catch-up/import hooks, plain /login / /d/[id] working end to end, 64/64 tests, build OK. Open for approval pass: cream bg #F4F1EA flagged as generic, breakpoint 640 vs 768, dashboard search. Reset .pglite before demo (local data drifted) |
| 2026-10-21 | Prototype done (prototype/index.html, DESIGN-NOTES.md, 45 screens at 3 widths) — awaiting user sign-off P1.6. Tech spec + stack ledger artifacts published. Backend gaps fixed: POST /documents/:id/note/seen (note dismissed separately from open), title save sets lastEditedBy; search = client-side. 64/64 tests |
| 2026-10-21 | Backend done & verified by me: 46/46 Vitest, tsc, lint clean (Next 16, PGlite, POST /api/import + report). Responsive-everywhere added as hard NFR. UI-skill + UI-foundation agent started |
| 2026-10-21 | Confluence added to analysis: "nobody does catch-up" claim withdrawn; positioning = catch-up by default, inline, zero setup. Added freshness line; handoff "Done" ack → Next |
| 2026-10-21 | Learnings L-1..7 sent to prototype agent. Backend implementation agent started (scaffold, Drizzle+PGlite/Neon, auth, services, routes, Vitest) — UI waits for prototype sign-off |
| 2026-10-21 | User decisions: import → report+Undo; animation capped to Framer Motion + one Rive/Lottie hero |
| 2026-10-21 | Product analysis done (docs/PRODUCT-ANALYSIS.md). Positioning: "the team doc that tells you what changed for you, and why it was sent to you". Adds DF-5 new-for-you dot; proposes import report+Undo and deferring Rive — awaiting user |
| 2026-10-21 | Architecture done (docs/ARCHITECTURE.md, docs/DECISIONS.md). Folded in: version + optimistic concurrency, block_meta catch-up, stateless import preview, PGlite tests, 404/403 rules. Open: Vercel Hobby clause, .riv source, editors see collaborator list? |
| 2026-10-21 | Differentiators locked: Catch-up (changed-since-last-visit highlights), handoff note on share, import preview, Rive/animated companion. Two parallel agents: architecture (docs/ARCHITECTURE.md + docs/DECISIONS.md) and prototype (prototype/index.html + DESIGN-NOTES.md) |
