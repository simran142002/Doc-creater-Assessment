# Ajaia Docs — Design notes (prototype = spec)

`index.html` is the visual and behavioural spec for the Next.js build. Match these values; when in doubt, measure the prototype's computed styles.

**Positioning line:** "See what changed for you — the moment you open it." It appears on sign-in (hero) and on the dashboard (small italic line above the greeting). The promise is that coming back is fast. Copy makes no "first/only" claims.

## How to run
- Double-click `index.html` (file:// works), or `python3 -m http.server` in this folder.
- Deep links into any state, using fresh seed data in memory without touching saved data: `index.html?shot=<name>[&as=u_leo][&theme=dark]`.
  Shots: `signin dash dash-new empty doc doc-next caught share share-error share-editor viewer note conflict offline notfound import import-dialog menu new-doc`.
- Prototype controls are in the account menu: Simulate offline, Simulate conflict on next save, Open a doc I can't access, Reset demo data.
- Screenshots: `screens/{phone,tablet,desktop}/*.png` at 360×740, 768×1024 and 1440×900. `screens/harness.html` renders any shot at an exact viewport size.

## Tokens
**Colour (light / dark)**
| Token | Light | Dark | Use |
|---|---|---|---|
| --bg | #F4F1EA | #12110F | app background (warm paper) |
| --bg-elev | #FAF8F4 | #181715 | toolbars, dialog footers |
| --surface | #FFFFFF | #1C1B18 | cards, dialogs |
| --surface-2 / -3 | #EFEBE3 / #E7E2D7 | #24221E / #2D2A25 | chips, hovers, skeletons |
| --page | #FFFFFF | #1E1D1A | document canvas |
| --ink / -2 / -3 / -4 | #1D1B17 / #48443C / #7A7468 / #A9A294 | #EEEAE1 / #C9C3B6 / #8F887B / #635D53 | text scale |
| --line / --line-strong | #E3DDD1 / #D2CABB | #2E2B26 / #3B3731 | borders |
| --accent (evergreen) | #2E5E4E (hover #244C3F) | #7CC4A4 | primary, focus, active toolbar |
| --accent-soft / -ink | #E2ECE6 / #1F4A3C | #1B2E26 / #A6DCC3 | editor chip, active button |
| --marigold / -soft / -ink | #E39B2D / #FCEFD6 / #7A4D07 | #F0B456 / #3A2C14 / #F6CF8C | catch-up, "new for you" |
| --note / -edge / -ink | #FFF0AE / #F1DC7E / #4E3F0B | #4A3F16 / #5E5020 / #F7E7A6 | handoff sticky notes |
| --viewer / -soft / -ink | #5A57A6 / #EAE9F6 / #3B3984 | #A9A6F0 / #25243F / #C7C5F7 | viewer role |
| --danger / -soft | #C2412D / #FBE6E0 | #EE7A63 / #3A1F19 | errors, delete, conflict |
| --success | #2F7D57 | (uses accent) | saved tick |
| Avatars | Aarav #D9734E · Priya #8E5BB5 · Leo #3E8A86 | | initials on colour |

Dark mode: `prefers-color-scheme` by default. The account menu can force Light, System or Dark (`html[data-theme]`).

**Type**
- UI: **Geist** 400/500/600/700. Doc body: **Newsreader** (opsz 6–72, 400–700, italics). Display: **Instrument Serif** (regular and italic): greetings, empty states, sticky notes, the wordmark. Mono: **Geist Mono** for counts, kbd and metadata.
- UI scale (px): 11 / 12 / 13 / 14 (base, line-height 1.5) / 15 / 16 / 20 / 24 / 32 / 44 (dashboard greeting) / 56.
- Document (`.prose`): 18.5px/1.7. H1 2.05em/1.12 600, H2 1.45em/1.2 600, H3 1.18em/1.3 600. Paragraph gap .85em. List markers in accent. Focus mode uses 20px, phone 17px.

**Spacing:** 4px grid with tokens 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 72. Page canvas max 780px, padding 80/96/120 (desktop), 64/72 (≤1100), 48/40 (≤900), 28/16 (phone, edge to edge).
**Radii:** 6 (xs), 8 (sm: buttons, inputs), 12 (md: banners, menus), 16 (lg: cards), 22 (xl: dialogs, bottom sheets), 999 (pills).
**Shadows:** `--sh-1` hairline (resting cards), `--sh-2` raised (primary button, sticky banner), `--sh-3` lifted (card hover, dialogs, toasts), `--sh-page` (doc canvas), `--sh-pop` (menus).
**Motion:** durations 120 / 200 / 320 / 520 / 900 ms. Easings: `--ease-out` cubic-bezier(.2,.8,.2,1), `--ease-in-out` cubic-bezier(.65,0,.35,1), `--ease-spring` (CSS `linear()` spring with about 10% overshoot). Under `prefers-reduced-motion`, every animation and transition collapses to 1ms, view transitions are off and the Rive animation does not autoplay.

## Breakpoints
| Width | Behaviour |
|---|---|
| > 1340 | Handoff sticky note sits in the right margin beside the page (sticky). |
| ≤ 1340 | The note moves above the page as a card. |
| ≤ 1100 | Page padding shrinks. The save label drops "— offline". |
| ≤ 900 (tablet) | Sign-in stacks. The dashboard hero stacks. Editor collaborator avatars and the owner line hide, but the freshness line stays. |
| ≤ 640 (phone) | Touch targets ≥ 44px and inputs at 16px (no iOS zoom). The header's New/Import collapse into a "+" menu. Cards become single-column list rows (84px thumbnail, note under the row). The filter segment scrolls horizontally. The editor header shows back, title, save icon, icon-only Share and more. The toolbar is a horizontally scrolling row with a fade edge, and word count is hidden. The page is full-width with 16px gutters. Catch-up avatars move inline onto the tinted block's top-left corner. The catch-up banner stays sticky (top 120px). The share and import dialogs become **bottom sheets**, and so does the import fidelity report. Verified with no horizontal scroll at 360, 768 and 1440 (see harness). |

## Components
App header (wordmark, offline pill, account menu with switch user, theme, prototype controls) · Buttons (primary, secondary, ghost, danger; sm 30, md 36, lg 44) · Icon button 36 · Inputs and select 40 · Segmented filter · Chips (Owner, Can edit, View only, N changes) · Avatar and avatar stack · Tooltip (`data-tip`, 350ms delay) · Popover menu · Modal / bottom sheet · Toast (success, error with action, info, bottom-centre) · Skeletons (dashboard cards, editor page) · Doc card (thumbnail, freshness line, new-for-you dot with tooltip, change-count chip, handoff sticky note, owner + role for shared docs, hover delete for the owner) · Empty states · Editor header (inline title, freshness line, save status, collaborators, role badge, Share/People) · Sticky toolbar · Banners (viewer, catch-up with Prev/Next, conflict, import fidelity) · "All caught up" card · Handoff sticky note · Share dialog (owner mode and read-only mode) · Import dialog · Confirm dialog · 403/404 page.

## Behaviour spec
- **Freshness line:** an avatar plus "Edited by Priya · 2 h ago", or "Edited by you · just now", directly under the title in the editor. Cards use the same muted 12px style.
- **Save status:** debounce 800ms, then "Saving…" with a spinner, then **"Saved"** with an animated tick (stroke draw, 520ms). On failure it shows **"Couldn't save — Retry"** with a toast that has Retry now; it auto-retries every 5s and recovers when back online. ⌘S saves immediately. Unsaved work is committed on blur, route change and unload.
- **Conflict (simulated):** the next save finds "Priya saved a newer version 10s ago". A non-blocking banner offers **Load hers** (replaces the doc with her version and attributes the new block to her) or **Keep mine** (overwrites). Saving pauses while the banner is open.
- **Catch-up (on by default, no click):** the doc is diffed by top-level block against the signatures this user last saw (stored per user per doc, updated on open and on your own saves; empty blocks are ignored). Changed blocks get a marigold tint with a 3px left rule, plus the editor's initials avatar in the margin (per-block authorship is tracked on save). A sticky banner reads "Priya changed 3 sections since you last looked · 2 h ago" with **Prev / "1 of 3" / Next**. Each step scrolls to the block and pulses it (glow 1.1s, avatar scale 1.25). Next on the last block reads "Done" and triggers **"You're all caught up"**, the single hero animation. "Mark as read" does the same. Highlights fade out after 480ms.
- **New for you:** dashboard filter chip with a count. Cards with unseen changes or an unread note get a pulsing marigold dot (tooltip such as "Priya edited 3 sections · 2 h ago") and an "N changes" chip. Under Shared with me, docs with unseen changes sort first.
- **Handoff note:** an optional note (≤280 chars) set when sharing. It shows as a sticky note on the recipient's dashboard card and as a sticky-note callout when they first open the doc. **Got it** dismisses it for good, and it can be reopened from the "Note" chip or the more menu.
- **Share:** add by email with role. Under the picker a plain-language line reads: Editor "Can edit. Can't share or delete.", Viewer "Can read only." Validation messages cover empty, malformed, unknown user, self, owner, duplicate (the existing row flashes) and offline. You can change a role, and Remove asks for inline confirmation and offers Undo. Only the owner manages access; editors and viewers get a read-only "People with access" dialog. Confetti fires on a user's first share (smaller on later ones).
- **Import:** .txt, .md and .docx up to 2 MB, parsed in the browser (marked; mammoth with `u => u`). The HTML goes through the TipTap schema via `generateJSON` as a sanitiser. Tables are flattened to "cell · cell" paragraphs, h4–h6 become H3, and images are dropped. The doc is **created immediately** and opens with a **fidelity report** such as "Imported from notes.docx — kept 2 headings, 1 bold run, 1 underline; flattened 1 table to plain text; dropped 1 image", with **Undo import** (deletes the doc and returns to the dashboard). Errors cover wrong type, oversize, empty, corrupt or unreadable files, and a parser that failed to load.
- **Editor:** TipTap StarterKit (no code block or horizontal rule; H1–H3) plus Underline and Placeholder. Markdown input rules work (`#`, `##`, `-`, `1.`, `**bold**`, `*italic*`). An empty doc shows "Tip: type # for a heading, - for a list, **bold** for bold…". Toolbar buttons show active state with an accent underline. Viewer mode has a read-only editor, a disabled and desaturated toolbar, a read-only title and a lilac banner.
- **Extra touch:** focus mode (⌘. or toolbar button; Esc exits). Chrome fades away, the type gets larger and the header returns when you hover the top edge. Word count and reading time are in the toolbar.

## Animation inventory
| Where | What | How |
|---|---|---|
| Empty states (My docs, Shared, New for you) and the "All caught up" moment | **Hero animation**: Rive teddy (state machine `Login Machine`, `trigSuccess` on caught-up) | @rive-app/canvas; the .riv is embedded as base64 in `assets/teddy-riv.js` |
| Route changes | Fade and lift | View Transitions API (fallback: none) |
| Cards | Staggered rise-in (45ms), hover lift −4px with `--sh-3`, thumbnail tilt | CSS |
| Sticky notes | Drop-in with spring, tape strip, hover sway | CSS |
| Dialogs and menus | Spring scale-in; bottom-sheet slide-up on phone | CSS keyframes and `--ease-spring` |
| Toolbar | Press scale .88, active underline grow | CSS |
| Save | Spinner, then tick stroke-draw; error shake | CSS |
| Catch-up | Tint glow-in, avatar pop, pulse on the current block, wiggle on the banner icon, fade-out on done | CSS on ProseMirror node decorations |
| New-for-you dot / change chip | Soft ring pulse 2.2s | CSS |
| Share | Confetti on first share | canvas-confetti (`disableForReducedMotion`) |
| Loading | Skeleton shimmer (dashboard first load, editor mount), indeterminate import bar | CSS |

## Libraries (exact CDN versions)
- TipTap **2.27.3**: `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-placeholder` via `cdn.jsdelivr.net/npm/...@2.27.3/+esm`. jsDelivr's ESM bundles pull several ProseMirror versions, so an **import map** collapses them to one copy each (prosemirror-model 1.25.11, -view 1.42.3, -state 1.4.4, -transform 1.12.0, `@tiptap/pm` 2.27.2). Without it, schema and decoration instances do not match. The real app (bundled) does not need this.
- marked **15.0.12** (`marked.min.js`), mammoth **1.9.1** (`mammoth.browser.min.js`), canvas-confetti **1.9.3**, @rive-app/canvas **2.37.5** (`rive.js`; WASM from its CDN).
- Rive asset: community file "animated login screen" (teddy), `public.rive.app/community/runtime-files/2244-4463-animated-login-screen.riv`, embedded locally.
- Fonts: Google Fonts (Geist, Geist Mono, Instrument Serif, Newsreader).
- No Tailwind or component library. The tokens above are hand-written CSS variables, shaped like shadcn tokens, so they map 1:1 onto a Tailwind theme in the real app.

## Differentiators
1. **Catch-up**: per-user, per-block diff with author avatars, Prev/Next and an "all caught up" moment.
2. **Handoff note**: why it was sent to you, shown on the card and pinned on first open.
3. **Import fidelity report** with one-click undo.
4. **Conflict-safe save** (non-blocking choice) and an honest save status.
5. One restrained hero animation (Rive) plus purposeful micro-interactions. Focus mode is the extra touch.

## Faked in the prototype
Auth (pick a user), the server and latency (320–600ms sleeps), the network (toggle), conflicts (toggle), the collaborator's "theirs" version, and persistence (localStorage). The catch-up diff, authorship, imports and the role rules are real logic that is worth porting.
