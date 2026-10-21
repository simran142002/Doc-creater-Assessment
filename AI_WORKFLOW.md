# AI workflow

## Tools

- **Claude Code (Opus 5.5)** as orchestrator, running parallel subagents: architecture/ADRs, clickable prototype, competitive analysis, backend, UI foundation, UI implementation, edge-case hardening, rate limiting, docs. Sonnet 5.5 handled documentation agents to save cost.
- **Claude in Chrome** for in-browser verification. **Claude artifacts** for the planning pages.
- **Project-scoped skills:** Anthropic frontend-design and shadcn (a vetted subset; see [docs/UI-SKILLS.md](docs/UI-SKILLS.md)).

## Where AI sped things up

- Architecture, prototype and market analysis in parallel in the first hour.
- The backend scaffold with 46 tests in one pass.
- 84 edge-case scenarios enumerated and tested (tests grew from 65 to 198).
- Computed-style diffing of the running app against the prototype.

## What I changed or rejected

- **A claim withdrawn.** The competitive analysis first said "no product shows what changed since you last looked". I pushed to add Confluence; research showed Google Docs, Confluence Premium and Loop have variants. The claim was dropped and the positioning became "on by default, inline, zero setup".
- **Import preview replaced** by a post-import report with Undo (less friction).
- **Rive mascot capped** to one hero animation after the analysis argued delight belongs in catching up.
- **Three UI skills rejected for security:** one fetched its rules at run time, one ran scripts on every use, one was the wrong target. For the shadcn skill I stripped the auto-run `npx @latest` and its pre-approved permission.
- **Bugs caught in AI-written code:**
  - the editor autosaved on open, bumping the version and setting a wrong "last edited by"
  - a title-only save did not update "edited by"
  - the handoff note was marked read on open instead of on "Got it"
  - editors could not see the collaborator list
  - tables collapsed into one line
  - a misleading "limit is 2 MB" message for a line-count rejection
  - an out-of-memory crash on a 2 MB many-line .txt
  - 500s on NUL characters, deep nesting and malformed tokens
- **Deploy workaround.** The MCP GitHub token could not create repos, so I deployed with the Vercel CLI from the folder.

## How correctness was verified

- After every agent, the orchestrator re-ran tests, typecheck, lint and build itself rather than trusting the agent's report.
- Chrome click-through of every flow at 360, 768 and 1440 px.
- Computed-style comparison against the prototype.
- A production smoke test across three users: sign-in, dashboard catch-up counts, create, save, stale-save 409, share with note, viewer 403, stranger 404, .md import.
- [PLAN.md](PLAN.md) as a single tracked checklist with human sign-off gates between phases.
