# How I worked

A short, step-by-step account of how Ajaia Docs was planned and built with Claude Code.

## 1. Setup

- Read the problem statement and pasted it into Claude Code (Opus 5.5, auto mode).
- Asked Claude to save everything I did from then on to its memory, so context carried across sessions.
- Asked it to keep a decision document as we went: [docs/DECISIONS.md](docs/DECISIONS.md).
- Asked it to create a task checklist with breakdowns, which became the tracked plan: [PLAN.md](PLAN.md).

## 2. Product analysis

- Using the task overview and a reference image, I asked for a product analysis, published as an artifact.
- It compared Google Docs, Confluence and others.
- References I gave:
  - **Duolingo** for UI. Its logic isn't unique (many apps do the same thing), but its UI is what holds users.
  - **Confluence** for features. It's strong, but slow when a single page holds a lot of data.
- Links: [Product analysis artifact](https://claude.ai/artifact/NzbFAXKpMCgw5HWw2YhnrF) · [docs/PRODUCT-ANALYSIS.md](docs/PRODUCT-ANALYSIS.md)

## 3. Design prototype

- One agent built a clickable design prototype. I used it as my Figma reference and to see how the whole app would work.
- I did my reviews here. Every doubt about flows, features and sub-features was raised and fixed at this stage, before any app code.
- Links: [prototype/index.html](prototype/index.html) · [prototype/DESIGN-NOTES.md](prototype/DESIGN-NOTES.md) · [screenshots/](screenshots/)

## 4. Running work in parallel

While the prototype was being reviewed, other agents ran at the same time:

- **Tech architecture:** I reviewed this in parallel with the prototype.
- **Product analysis (finished fast):** we picked the findings that could be built in 1-2 hours and folded them into the prototype.
- **Claude in Chrome:** integrated so agents could click through and check the running app in the browser.
- **UI skill search:** an agent searched GitHub for open-source skills to build the UI from the prototype. Two were vetted and installed (Anthropic `frontend-design` and `shadcn`); three were rejected for security reasons. See [docs/UI-SKILLS.md](docs/UI-SKILLS.md) and [.claude/skills/](.claude/skills/).
- **Libraries and tools:** an agent looked for open-source libraries to cut repeated code (TipTap, shadcn/ui, Drizzle, Zod, mammoth, marked, and others).
- **Tech spec:** covered functional and non-functional requirements, rate limiting and load balancing, with an HLD and LLD. Links: [Tech spec artifact](https://claude.ai/artifact/2Wx5ykPdLfiBKLhh7hVZ4Y) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ARCHITECTURE-NOTE.md](docs/ARCHITECTURE-NOTE.md)
- **Stack ledger:** an agent listed every tool and library we used and what each would cost. I stuck to free options because time was short. Link: [Stack ledger artifact](https://claude.ai/artifact/8GeymUd4G41WwdwfTfV3pe)

## 5. Building the app

- **Responsiveness and animation:** already handled in the prototype, so the work was porting it into the real UI (checked at 360, 768 and 1440 px).
- **UI code:** two agents worked on the UI in parallel.
- **Screen by screen, end to end:** as each screen was ready, we wired its API endpoints to it, so every screen was finished end to end before moving on.
- **Backend and error handling:** built with clear error handling and wide scenario coverage. 84 edge cases were listed, 83 are covered by tests, and the suite has 198 passing tests. Link: [Edge cases & error handling artifact](https://claude.ai/artifact/Ez23KqMKHA6hkQkggtn5hd)

## 6. Deployment

- Deployed on **Vercel** (Hobby) with **Neon** (free Postgres), which kept it within my cost limit.
- Live app: https://ajaia-docs-blond-nu.vercel.app

## All links

**Artifacts**
- [Product analysis](https://claude.ai/artifact/NzbFAXKpMCgw5HWw2YhnrF)
- [Tech spec](https://claude.ai/artifact/2Wx5ykPdLfiBKLhh7hVZ4Y)
- [Stack ledger](https://claude.ai/artifact/8GeymUd4G41WwdwfTfV3pe)
- [Edge cases & error handling](https://claude.ai/artifact/Ez23KqMKHA6hkQkggtn5hd)

**Repo docs**
- [README.md](README.md): setup, features, scope, status
- [PLAN.md](PLAN.md): task checklist and tracker
- [docs/DECISIONS.md](docs/DECISIONS.md): decision log (ADRs)
- [docs/PRODUCT-ANALYSIS.md](docs/PRODUCT-ANALYSIS.md): competitive analysis
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): full architecture
- [docs/ARCHITECTURE-NOTE.md](docs/ARCHITECTURE-NOTE.md): short architecture note
- [docs/UI-SKILLS.md](docs/UI-SKILLS.md): skill search and vetting
- [AI_WORKFLOW.md](AI_WORKFLOW.md): what AI did, what I changed or rejected, how it was verified
- [SUBMISSION.md](SUBMISSION.md): submission summary
- [prototype/DESIGN-NOTES.md](prototype/DESIGN-NOTES.md): design tokens and notes

**App**
- Live: https://ajaia-docs-blond-nu.vercel.app
- Code: https://github.com/simran142002/Doc-creater-Assessment (private)
- Prototype: [prototype/index.html](prototype/index.html)
