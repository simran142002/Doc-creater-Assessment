# UI skills for the post-approval build

As of 2026-10-21. Two vetted Agent Skills are installed in project scope under `.claude/skills/`. Nothing global was changed.

## What was compared

Stars and push dates were taken from the GitHub API on 2026-10-21.

| Skill | Source | Stars / last push | Fit with our stack | Scripts / risk | Verdict |
|---|---|---|---|---|---|
| **frontend-design** | `anthropics/skills` (official, Anthropic) | 182.6k / 2026-10-09 | Stack-agnostic design direction: typography, restraint, motion, copy, responsive and a11y quality floor | One SKILL.md plus an Apache-2.0 licence. No scripts, no network | **Installed as is** |
| **shadcn** | `shadcn-ui/ui` `skills/shadcn` (official, shadcn) | 126.1k / 2026-10-20 | Exact match: reads `components.json`, Tailwind v4 `@theme inline`, radix vs base APIs, token mapping from a DESIGN.md, control-height rules | Upstream SKILL.md auto-runs `!npx shadcn@latest info --json` on load (unpinned npm download and execution) and pre-approves `npx shadcn@latest *` through `allowed-tools`. It also has a node script and an evals file | **Installed as a vetted subset** (see below) |
| web-artifacts-builder | `anthropics/skills` (official) | same repo | For single-file claude.ai artifacts (Vite + Parcel bundling), not a Next app | Shell scripts and a tarball | Rejected: wrong target |
| web-design-guidelines | `vercel-labs/agent-skills` (official, Vercel) | 32.8k / 2026-10-14 | Good UI review checklist | SKILL.md tells the agent to **fetch its rules from a remote URL at run time**, so its instructions can change after vetting | Rejected (remote instructions). The Vercel react-best-practices skill was noted for a later perf pass, not installed |
| ui-ux-pro-max | `nextlevelbuilder/ui-ux-pro-max-skill` (community) | 138.3k / 2026-10-15 | Generic style and palette search engine; the project already has an approved visual direction | Runs `python …/scripts/search.py` on every use. The repo has 131 py/cjs/js/sh files and large CSV corpora. Several forks under other authors share the name | Rejected: script-driven, community-maintained, and duplicates the prototype's role |

No maintained TipTap-specific or Tailwind-only skill turned up from a trusted source. TipTap guidance comes from its own docs in `node_modules`.

## What was installed

| Path | Source | Commit |
|---|---|---|
| `.claude/skills/frontend-design/` (SKILL.md, LICENSE.txt) | https://github.com/anthropics/skills/tree/main/skills/frontend-design | `dbd4588f9e1033efb41dad4bef2f7947c8993d44` |
| `.claude/skills/shadcn/` (SKILL.md, customization.md, design-system.md, rules/{styling,composition,forms,icons,base-vs-radix}.md, LICENSE.md) | https://github.com/shadcn-ui/ui/tree/main/skills/shadcn | `ba1503c64472b82256d9de95e2e62c5901a38e8b` |

Vetting:
- Each repo was cloned shallow and sparse into the scratchpad. Every installed file was read in full. No bundled script was run.
- The shadcn SKILL.md was edited in four ways:
  - The `!` command injection was removed and replaced with a static project-context note: radix base, lucide icons, Tailwind v4, and the yarnpkg registry mirror.
  - The `allowed-tools` pre-approval was removed.
  - Links to files that were not installed were removed.
- These upstream shadcn files were **not installed**: `scripts/showcase-coverage.mjs`, `evals/`, `agents/openai.yml`, `assets/`, `cli.md`, `registry.md`, `mcp.md`, `chat.md` and `design-system-page.md`. They cover CLI and registry authoring, MCP setup and chat UIs, none of which this project needs.
- Nothing installed makes network calls or touches credentials or settings.

## How they'll be used after the prototype is approved

1. **Map tokens with shadcn's `design-system.md`, steps 4–5 and 7.** Treat `prototype/DESIGN-NOTES.md` as the DESIGN.md:
   - Map `--bg/--surface/--ink/--accent/--line/--danger` onto the shadcn variables in `app/globals.css`.
   - Pin the radius scale (6/8/12/16/22/999) and the `--sh-*` shadows in `@theme`.
   - Add `type-*` utilities for the Geist / Newsreader / Instrument Serif scale.
   - Restyle by editing `cva` variants, moving all control heights together.
   - Verify there is no horizontal overflow at 360 / 768 / 1440.
2. **Follow the shadcn rules while building screens.** Use semantic tokens only, `gap-*` rather than `space-*`, and Groups around items. Every Dialog and Sheet gets a Title. Toasts go through `sonner`, and Avatar always has a fallback.
3. **Run a frontend-design self-critique pass on each screen.** Spend boldness in one place: the catch-up moment. Keep reduced motion and focus rings, write copy as plain verbs, and use screenshots for critique.
   - The skill flags a warm cream background near `#F4F1EA` as a common "generated design" tell. The prototype's `--bg` is exactly `#F4F1EA`.
   - The skill also says the brief's own words win. The user should knowingly keep or tweak this colour during approval.

## Foundation already in place (prototype-independent)

| Area | Files |
|---|---|
| shadcn primitives | `components/ui/*` (button, dialog, sheet, dropdown-menu, input, select, tooltip, avatar, badge, sonner, skeleton, tabs, toggle, toggle-group, alert-dialog, separator, label, textarea). Controls are 44px below `md` |
| Motion | `lib/motion.ts` (`useMotionPreset`, aware of `useReducedMotion`), `MotionConfig reducedMotion="user"` in `components/providers.tsx` |
| API client | `lib/client/api.ts` (typed `ApiError` with `code`, `status`, `retryable`, `stale`), `lib/client/types.ts` |
| Editor logic | `lib/client/autosave.ts` (state machine), `use-doc-editor.ts`, `use-catch-up.ts` + `catchup-nav.ts`, `use-import.ts`, `lib/editor/catchup-highlight.ts` |
| Shell and routes | `components/app-shell.tsx`, `components/responsive-dialog.tsx`, `app/login`, `app/page.tsx` + `dashboard.tsx`, `app/d/[id]/*`, `not-found`, `error`, `loading` |
| Tests | `tests/autosave.test.ts`, `tests/catchup-nav.test.ts` |

Known gaps for the visual pass:
- **Breakpoint for sheets and touch targets.** The prototype's phone breakpoint is ≤640 px, while the foundation switches at `md` (768 px). Align this when tokens land.
- **Dashboard search and filter chips.** The prototype filters titles on the client. Not built yet.
- **Not built yet:** focus mode, word count, the theme switcher, the per-block avatars from catch-up, and the fidelity report as a sheet. The report currently shows as a toast with Undo.
