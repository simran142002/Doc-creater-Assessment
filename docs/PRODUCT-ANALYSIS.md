# Ajaia Docs — Product Analysis

As of 2026-10-21 · Live doc: https://claude.ai/artifact/NzbFAXKpMCgw5HWw2YhnrF

## Problem and user

People on fast-moving teams waste time working out what changed in a shared doc, and why they got it. Every editor can write. Few of them help you pick up where a teammate left off.

- **Our user:** an internal team member doing quick shared work, such as a spec, a handover, or meeting notes. They open a doc someone shared, catch up, add their part and pass it on.
- **The return loop we want:** "Something changed for me, I can see it in 5 seconds, I add my bit, done." Duolingo makes coming back feel rewarding. We make coming back *fast*.

## Comparison

Other tools offer catching up only partly, and never by default. Google Docs highlights edits since your last visit, but only after you click "See new changes". Confluence emails batched change summaries, and on Premium it offers an AI "Changes since your last visit" summary. Loop recaps changes with Copilot. None of them shows who changed which block the moment you open the doc, with no click and no paid tier, in a tool that needs no setup. Ratings are a judgment call based on the sources at the end. Key: ✓ strong · ~ partial · ✗ weak.

| Product | Time to first doc | Sharing clarity | Knowing what changed | Import friction | Delight / feel | Speed / sync |
| --- | --- | --- | --- | --- | --- | --- |
| Google Docs | ✓ | ~ link vs. people roles confuse | ✓ "See new changes" highlights edits since your last visit (one click) | ~ docx layout drifts | ~ | ✓ |
| Confluence Cloud | ~ needs a space first | ✗ space permissions plus page restrictions that only remove access | ~ watch emails, version compare; AI "since your last visit" summary on Premium | ~ built-in .docx import, complex layouts need fixing | ~ | ✗ typing lag on long pages and large tables |
| Notion | ~ workspace setup | ~ | ~ Updates inbox; version-history diffs reported in 2026 | ~ | ✓ | ~ heavy pages lag, weak offline |
| Dropbox Paper | ✓ | ✓ | ~ | ~ | ✓ | ~ (being folded into Dropbox) |
| Word Online / Loop | ~ | ~ | ~ Copilot recap of changes (needs a Copilot licence) | ✓ native docx | ~ | ~ Loop sync and latency complaints |
| Coda | ✗ learning curve | ~ | ~ | ~ | ~ | ✓ |
| Craft | ✓ | ✓ | ✗ | ~ | ✓ design awards | ✓ |
| Quip | ~ | ~ | ~ | ~ | ~ | ~ (retiring 2027) |
| Slite | ✓ | ✓ | ~ "verified" docs | ~ | ✓ | ~ |
| HackMD | ✓ | ✓ anonymous links | ~ | ✓ md, ✗ docx | ~ | ✓ realtime |
| **Ajaia Docs (target)** | ✓ | ✓ one permission layer | **✓ inline by default, author on each block, no click** | ✓ with fidelity report | ✓ | ~ last-write-wins plus conflict guard |

| Product | Built for | Best at | Recurring complaint | Come-back hook |
| --- | --- | --- | --- | --- |
| Google Docs | Everyone | Speed, realtime, zero setup | Sharing settings confuse; imports break layout | It is where the doc already is |
| Confluence Cloud | Teams on the Atlassian stack (specs, wikis) | Jira links with live issue status, inline comments, @mention tasks, page trees | Editor lag on long pages; two permission layers confuse | Jira and the team's space live there |
| Notion | Teams building a wiki and workspace | Flexible blocks and databases | Slow on large pages; offline unreliable | Workspace lock-in |
| Dropbox Paper | Light team docs | Calm, minimal writing | Unclear migrations; product absorbed into Dropbox | None left |
| Word / Loop | Microsoft 365 orgs | Native Office fidelity | Thin editing tools; slow workspaces | Outlook and Teams embeds |
| Coda | Ops teams building doc-apps | Formulas and automation | Steep setup | The apps you built in it |
| Craft | Individuals, small teams | Beautiful, delightful UI | Light on team features | Joy of using it |
| Quip | Salesforce sales teams | Docs inside CRM records | Product being retired | None left |
| Slite | Startup knowledge bases | Clean editor, doc verification | Limited formatting and customization | Trusted, verified answers |
| HackMD | Developers | Markdown, realtime, GitHub sync | Markdown learning curve; split-pane UI | Git workflow |

Two simple team-doc tools (Paper, Quip) are being absorbed or shut down. Lightweight team docs are under-served.

## What they lack

The gaps are about friction when picking up shared work, not about missing capabilities. Most of these needs are met somewhere, but behind a click, in email, in a paid tier, or after setup.

1. **"I have to go looking for what my teammate changed."** Google ("See new changes") and Confluence (version compare, AI summary on Premium) can show it, but only on request. No one puts the author on each changed block when the doc opens.
2. **"The reason this was shared is buried in my email."** Google and Confluence let you add a message when you share, but it stays in the email. Confluence tasks can assign work, but you need task syntax and a space.
3. **"My edit vanished. Someone saved over me."** Realtime editors such as Google and Confluence avoid this. Lightweight tools with plain saves quietly let the last write win.
4. **"My Word import came out wrong, and nothing told me."** Google and Confluence import .docx silently. Complex layouts need fixing, and neither tells you what was dropped.
5. **"Why can't Priya open this page? I shared it with her."** Confluence's two layers are the classic case: space permissions, plus page restrictions that only ever remove access. Google mixes people roles with link roles.
6. **"Typing lags, and it feels like a wiki, not a doc."** Confluence lags on long pages. Notion and Coda trade speed for power.
7. **"Which of my docs changed for me?"** Notion's inbox and Confluence's emails tell you per change. The doc list itself rarely does.

## Opportunities

Build four things now, about 75 minutes in total. The core brief still comes first. Everything else is Next. Effort: S under 15 min · M 30–45 min · L over 1 h.

### Frontend / UX

| Idea | User benefit | Effort | Fits timebox | Call |
| --- | --- | --- | --- | --- |
| Catch-up view: changed blocks tinted, plus "Priya changed 3 sections since you last looked" and a jump-to-next control | Catch up in 5 seconds, not by rereading | M | Yes | **BUILD NOW** |
| Dashboard "new for you" dot and count on each doc card | A reason to come back, visible before you open anything | S (same data as catch-up) | Yes | **BUILD NOW** (part of catch-up) |
| Handoff note card on first open ("Please review section 2 by Fri") | Tells you why you got the doc and what to do | S | Yes | **BUILD NOW** |
| Plain-language role line in the share dialog ("Can edit. Can't share or delete.") | No guessing about permissions | S | Yes | Fold into the share dialog |
| Post-import fidelity report ("Kept 4 headings, 12 bullets. Dropped 1 table.") with Undo | Trust the import without an extra step | S | Yes | **BUILD NOW** (replaces full preview) |
| Full side-by-side import preview before the doc is created | Same trust, one more click | M | Tight | Next |
| CSS micro-interactions: save tick, "You're all caught up" moment, card hover | Feels finished and calm | S | Yes, if 10 min are left | Polish |
| Rive animated companion | Character and charm | L (asset, states, reduced motion) | No | Next |
| Markdown shortcuts (`#`, `-`, `**`) | Fast, keyboard-first writing | Free with TipTap | Yes | Mention it, don't build it |
| Page-info line under the title: "Edited by Priya 2h ago · 3 changes since your visit" (borrowed from Confluence) | See at a glance how fresh the doc is | S (reuses catch-up data) | Yes | **BUILD NOW** (part of catch-up) |
| "Done" on the handoff note, shown to the sharer on their dashboard card | Closes the loop on the ask, which a share email can't | S | Yes, if 10 min are left | Polish |

### Backend / Tech

| Idea | User benefit | Effort | Fits timebox | Call |
| --- | --- | --- | --- | --- |
| Per-user `last_viewed_at`, plus per-block `{hash, editedBy, editedAt}` stamped on save | Powers catch-up and the dashboard dot from one source | M | Yes | **BUILD NOW** (catch-up backbone) |
| Version check on save: PATCH sends `version`, server returns 409, UI offers "Priya just saved: load hers / keep mine" | No silently lost work. Better than plain last-write-wins | S | Yes | **BUILD NOW** |
| Reliable save: flush on blur and unload with `sendBeacon`, one retry | Edits survive closing the tab | S | Yes | Already in the plan (NFR-1) |
| Import fidelity counts: compare the source nodes with the nodes TipTap kept | Feeds the fidelity report honestly | S | Yes | **BUILD NOW** (with the report) |
| "Who's here" presence by polling every 15 s | Avoid editing on top of someone | M | No | Next |
| Named version snapshots and restore | Undo a bad edit by someone else | M | No | Next |
| Daily digest in email or Slack ("2 docs changed for you") | Brings people back outside the app | M | No | Next |
| Realtime co-editing with a CRDT (Yjs) | Google-level simultaneous editing | L | No | Cut (already in the plan) |

## Verdict

**Positioning:** Ajaia Docs makes catching up the default. Open a shared doc and you see who changed which block, and why it was sent to you, with no click, no AI tier and no space to set up.

**Be honest about the edge.** Catch-up is not a new capability. Google, Confluence and Loop each offer a version of it. Ours is different because it is on by default, inline, named per block and free, in a tool with one permission layer. That is a UX edge, so it only counts if it feels instant and obvious. Don't claim "nobody shows what changed" in the README or the video.

The come-back hook is "new for you" on the dashboard, not a mascot. Duolingo's own team says engagement mechanics only amplify a product people already value.

**Final differentiator set, in build order:**

1. **Catch-up, on by default** (keep, reframed): block tints with the author's name, "1 of 3" jump-to-next, and the page-info line. Unlike Google, there's no click. Unlike Confluence, it's not an email or a Premium AI summary.
2. **"New for you" on dashboard cards** (keep, modest): the doc list itself shows which docs changed for you. Inboxes elsewhere do this per change, not per doc.
3. **Handoff note pinned in the doc** (keep, reframed): the ask lives on the doc, not in an email. An optional "Done" that the sharer sees closes the loop, if time allows.
4. **Conflict-safe save** (keep): a version check and a "load hers / keep mine" prompt. Realtime editors don't need this. Lightweight ones usually skip it.
5. **Import fidelity report plus Undo** (keep): Google and Confluence import silently. We say what was dropped.
6. **One permission layer, in plain words** (promoted): owner, editor or viewer, with a line saying what each can do. This answers Confluence's two-layer confusion directly.

**What no longer holds:** the claim that no product offers "what changed since I last looked". Google's "See new changes" and Confluence's AI catch-up both do. We keep the feature, but sell it on default, inline and free, not on being first.

**What we borrow from Confluence:** the page-info freshness line under the title (S effort, reuses catch-up data). Next: batch change notifications into one digest. Avoid: a second permission layer.

## Sources

- [Google Docs: Find what's changed in a file](https://support.google.com/docs/answer/190843)
- [Google Docs sharing defaults and pitfalls](https://www.askdavetaylor.com/how-to-properly-share-google-docs-with-friends-colleagues/)
- [Google Drive "Anyone with the link" access errors](https://workalizer.com/blog/apps-tools/google-drives-hidden-limited-access-why-your-public-pdf-links-might-suddenly-break-and-how-to-fix-it)
- [Google Docs .docx import formatting thread](https://support.google.com/docs/thread/4313531?hl=en)
- [Notion reviews on Capterra (performance, offline)](https://www.capterra.com/p/186596/Notion/reviews/?rating=1)
- [Power-user complaints across productivity apps, 2026](https://unstar.app/blog/productivity-app-reviews-what-power-users-complain-about-2026)
- [Notion: keeping team pages up to date](https://www.notion.com/help/guides/tips-to-keep-your-teams-notion-pages-up-to-date)
- [Dropbox Paper migration checklist](https://csuf.screenstepslive.com/m/56871/l/2019457-dropbox-paper-migration-checklist)
- [Dropbox Paper 2020 migration forum thread](https://www.dropboxforum.com/t5/Discuss-Dropbox-Developer-API/Timeline-for-Paper-2020-migration/m-p/535383)
- [Microsoft Loop reviews on G2](https://g2.com/products/microsoft-loop/reviews)
- [Microsoft Loop review aggregate](https://marlvel.ai/apps/microsoft-loop/reviews)
- [Coda vs. Notion, TechRepublic](https://www.techrepublic.com/article/coda-vs-notion/)
- [Coda vs. Notion, TrustRadius](https://tr-web.dev.trustradius.com/compare-products/coda-vs-notion)
- [Craft reviews on G2](https://g2.com/products/craft-docs/reviews)
- [Craft review (design score)](https://www.saner.ai/blogs/craft-review)
- [Salesforce announces end of life for Quip](https://www.salesforceben.com/salesforce-announces-end-of-life-for-quip/)
- [Slite review: pros and cons](https://thecxlead.com/tools/slite-review/)
- [Slite reviews on G2](https://www.g2.com/products/slite/reviews)
- [HackMD on Capterra](https://www.capterra.com/p/246874/HackMD/)
- [Behind the product: Duolingo streaks (Lenny's Newsletter)](https://lennysnewsletter.com/p/behind-the-product-duolingo-streaks)
- [Duolingo retention experiments](https://experiments.lazyweb.com/research/duolingo-retention-experiments.md)

Added for Confluence and the catch-up re-check:

- [Google Workspace blog: version control and "See new changes"](https://blog.google/products/g-suite/version-control-to-major-tom-keeping-track-of-work-in-g-suite)
- [GCFGlobal: Google Docs version history and See New Changes](https://edu.gcfglobal.org/en/googledocuments/version-history/1)
- [Atlassian: Confluence AI, "Changes since your last visit"](https://www.atlassian.com/software/confluence/resources/guides/best-practices/atlassian-ai)
- [Atlassian Community: Confluence AI summarize changes beta (Premium/Enterprise)](https://community.atlassian.com/forums/Confluence-Cloud-Admins-articles/Confluence-AI-summarize-changes-to-a-page-join-the-Beta/ba-p/2691368)
- [Confluence Cloud: View a page (page info, freshness)](https://support.atlassian.com/confluence-cloud/docs/view-a-page/)
- [Confluence Cloud watch notifications are batched](https://columbiauniversity.atlassian.net/wiki/x/CYiJBg)
- [Marketplace: Confluence recent edits overview (since-last-visit add-on)](https://marketplace.atlassian.com/apps/1224758/confluence-recent-edits-overview)
- [Space permissions and page restrictions are not the same thing](https://community.atlassian.com/forums/Confluence-Cloud-Admins-articles/Space-permissions-and-page-restrictions-are-not-the-same-thing/ba-p/3267148)
- [Confluence: Permissions and restrictions](https://confluence.atlassian.com/conf90/permissions-and-restrictions-1425052920.html)
- [Why is Confluence Cloud still so slow in 2024?](https://community.atlassian.com/forums/Confluence-questions/Why-is-confluence-cloud-still-so-slow-in-2024/qaq-p/2795411)
- [CONFCLOUD-81975: slow editing with large tables](https://jira.atlassian.com/browse/CONFCLOUD-81975)
- [Confluence Cloud: Import external documents](https://confluence.atlassian.com/confcloud/import-content-into-confluence-724765058.html)
- [Microsoft: Recap changes in Loop with Copilot](https://support.microsoft.com/topic/e0044a51-6919-46bf-8dac-2e4f300988d5)
- [Notion adds snapshot diffs to version history (report)](https://www.createwith.com/tool/notion/updates/notion-adds-snapshot-diffs-to-version-history-for-easier-change-tracking)

These sources are search results and review aggregators, so treat complaint frequency as directional. The ratings in the comparison tables are our own judgment.
