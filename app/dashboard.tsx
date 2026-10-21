"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FolderIcon, LockIcon, PlusIcon, SearchIcon, SparkleIcon, TrashIcon, UploadIcon, UsersIcon } from "lucide-react";
import { AppHeader } from "@/components/app-shell";
import { Avatar, AvatarStack } from "@/components/avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DocThumb } from "@/components/doc-thumb";
import { ImportDialog } from "@/components/import-dialog";
import { RoleChip } from "@/components/role-chip";
import { Teddy } from "@/components/teddy";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { ago, firstName, plural } from "@/lib/client/format";
import { toast } from "@/lib/client/toast";
import type { DashCard, DashList, User } from "@/lib/client/types";

type Filter = "all" | "new" | "mine" | "shared";
type Sort = "edited" | "title" | "created";
type Fresh = { n: number; changed: boolean; note: boolean; tip: string };

function newForYou(d: DashCard): Fresh | null {
  const { changedBlocks, unreadNote, neverOpened } = d.newForYou;
  const note = unreadNote && !!d.handoffNote;
  const fresh = d.role !== "owner" && neverOpened;
  if (!changedBlocks && !note && !fresh) return null;
  const by = firstName((d.lastEditedBy ?? d.owner).name);
  const tip = changedBlocks
    ? `${by} edited ${plural(changedBlocks, "section")} · ${ago(d.updatedAt)}`
    : `${note ? "Note" : "Shared"} from ${firstName(d.owner.name)} · ${ago(d.updatedAt)}`;
  return { n: changedBlocks, changed: changedBlocks > 0, note, tip };
}

const SORTERS: Record<Sort, (a: DashCard, b: DashCard) => number> = {
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  title: (a, b) => a.title.localeCompare(b.title),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
};
const SORT_HINT: Record<Sort, string> = { edited: "last edited", title: "title", created: "date created" };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export function Dashboard({ user, docs }: { user: User; docs: DashList }) {
  const router = useRouter();
  const search = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("edited");
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<DashCard | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [veil, setVeil] = useState(false);

  const mine = useMemo(() => docs.owned.filter((d) => !removed.has(d.id)), [docs.owned, removed]);
  const shared = docs.shared;
  const fresh = useMemo(() => new Map([...mine, ...shared].map((d) => [d.id, newForYou(d)])), [mine, shared]);
  const nfy = (d: DashCard) => fresh.get(d.id) ?? null;

  const query = q.trim().toLowerCase();
  const match = (d: DashCard) => !query || d.title.toLowerCase().includes(query) || d.text.toLowerCase().includes(query);
  const isNew = (d: DashCard) => filter !== "new" || !!nfy(d);
  const m = mine.filter(match).filter(isNew).sort(SORTERS[sort]);
  const s = shared.filter(match).filter(isNew)
    .sort((a, b) => Number(!!nfy(b)?.changed) - Number(!!nfy(a)?.changed) || SORTERS[sort](a, b));
  const newCount = [...mine, ...shared].filter((d) => nfy(d)).length;

  const changedDocs = [...mine, ...shared].filter((d) => d.newForYou.changedBlocks > 0).length;
  const notes = shared.filter((d) => nfy(d)?.note).length;

  const openImport = (file?: File) => {
    setImportFile(file ?? null);
    setImportOpen(true);
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const doc = await api.createDocument();
      router.push(`/d/${doc.id}?new=1`);
    } catch (e) {
      toast({ type: "error", title: "Couldn't create a document", body: e instanceof Error ? e.message : undefined });
      setCreating(false);
    }
  };

  const remove = async (d: DashCard) => {
    setRemoved((r) => new Set(r).add(d.id));
    try {
      await api.deleteDocument(d.id);
      toast({ type: "success", title: "Document deleted", body: d.title });
      router.refresh();
    } catch (e) {
      setRemoved((r) => { const n = new Set(r); n.delete(d.id); return n; });
      toast({ type: "error", title: "Couldn't delete the document", body: e instanceof Error ? e.message : undefined });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag) && !document.querySelector(".scrim")) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");
    const busy = () => !!document.querySelector(".scrim");
    const onEnter = (e: DragEvent) => { if (hasFiles(e) && !busy()) { depth++; setVeil(true); } };
    const onLeave = () => { depth = Math.max(0, depth - 1); if (!depth) setVeil(false); };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e) || busy()) return;
      e.preventDefault();
      depth = 0;
      setVeil(false);
      const f = e.dataTransfer?.files[0];
      if (f) openImport(f);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  const showMine = filter !== "shared";
  const showShared = filter !== "mine";

  let lists: React.ReactNode;
  if (query && !((showMine && m.length) || (showShared && s.length))) {
    lists = (
      <div className="empty">
        <EmptyArt />
        <div>
          <h3>Nothing matches “{q.trim()}”</h3>
          <p>Try a different word — we search titles and the text inside every document you can open.</p>
          <div className="row"><Button onClick={() => { setQ(""); search.current?.focus(); }}>Clear search</Button></div>
        </div>
      </div>
    );
  } else if (filter === "new" && !m.length && !s.length) {
    lists = (
      <div className="empty">
        <Teddy success />
        <div>
          <h3>You&apos;re all caught up</h3>
          <p>Nothing has changed since you last looked, and there are no unread handoff notes. We&apos;ll flag the next change here.</p>
          <div className="row"><Button onClick={() => setFilter("all")}>Show all documents</Button></div>
        </div>
      </div>
    );
  } else if (filter === "new") {
    lists = (
      <Section icon={<SparkleIcon className="i" aria-hidden />} title="New for you" count={m.length + s.length} hint="Changed since your last visit, or sent with a note">
        <Grid docs={[...s, ...m]} me={user} fresh={nfy} onDelete={setToDelete} />
      </Section>
    );
  } else {
    lists = (
      <>
        {showMine && (
          <Section icon={<FolderIcon className="i" aria-hidden />} title="My documents" count={m.length} hint={`Sorted by ${SORT_HINT[sort]}`}>
            {m.length ? <Grid docs={m} me={user} fresh={nfy} onDelete={setToDelete} />
              : query ? <p className="card-meta">No matches in this section.</p>
                : (
                  <div className="empty">
                    <Teddy />
                    <div>
                      <h3>Your desk is clear</h3>
                      <p>Start something new, or bring in an existing file — we&apos;ll tell you exactly what made it across.</p>
                      <div className="row">
                        <Button variant="primary" onClick={create}><PlusIcon className="i" aria-hidden /> New document</Button>
                        <Button onClick={() => openImport()}><UploadIcon className="i" aria-hidden /> Import .md, .txt or .docx</Button>
                      </div>
                    </div>
                  </div>
                )}
          </Section>
        )}
        {showShared && (
          <Section icon={<UsersIcon className="i" aria-hidden />} title="Shared with me" count={s.length} hint="Unseen changes first · owner and your access on each card">
            {s.length ? <Grid docs={s} me={user} fresh={nfy} shared />
              : query ? <p className="card-meta">No matches in this section.</p>
                : (
                  <div className="empty">
                    <Teddy />
                    <div>
                      <h3>Nothing shared with you yet</h3>
                      <p>When a teammate shares a document, it lands here — along with their handoff note, if they left one.</p>
                    </div>
                  </div>
                )}
          </Section>
        )}
      </>
    );
  }

  return (
    <div>
      <AppHeader user={user} onNew={create} onImport={() => openImport()} />
      <main className="dash">
        <section className="dash-hero">
          <div className="greet">
            <div>
              <p className="tagline">See what changed for you — the moment you open it.</p>
              <h1><span suppressHydrationWarning>{greeting()}</span>, <em>{firstName(user.name)}</em></h1>
              <p>
                {changedDocs || notes ? (
                  <>
                    {changedDocs > 0 && <><b>{plural(changedDocs, "doc")} changed</b> since you last looked</>}
                    {changedDocs > 0 && notes > 0 && " · "}
                    {notes > 0 && <><b>{plural(notes, "handoff note")}</b> waiting</>}
                  </>
                ) : `You're all caught up. ${mine.length} of your docs, ${shared.length} shared with you.`}
              </p>
            </div>
          </div>
          <div className="dash-actions">
            <Button variant="primary" size="lg" onClick={create} disabled={creating}><PlusIcon className="i" aria-hidden /> New document</Button>
            <div className="upload-group">
              <Button size="lg" onClick={() => openImport()}><UploadIcon className="i" aria-hidden /> Import file</Button>
              <span className="upload-hint">.txt · .md · .docx — max 2 MB</span>
            </div>
          </div>
        </section>

        <div className="dash-controls">
          <label className="search">
            <span className="sr-only">Search documents</span>
            <SearchIcon className="i" aria-hidden />
            <input ref={search} className="input" type="search" placeholder="Search titles and text" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="kbd">/</span>
          </label>
          <div className="seg" role="group" aria-label="Filter">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span className="count">{mine.length + shared.length}</span></button>
            <button type="button" aria-pressed={filter === "new"} onClick={() => setFilter("new")}><span className="dot-sm" />New for you <span className="count">{newCount}</span></button>
            <button type="button" aria-pressed={filter === "mine"} onClick={() => setFilter("mine")}><FolderIcon className="i i--sm" aria-hidden />My documents <span className="count">{mine.length}</span></button>
            <button type="button" aria-pressed={filter === "shared"} onClick={() => setFilter("shared")}><UsersIcon className="i i--sm" aria-hidden />Shared with me <span className="count">{shared.length}</span></button>
          </div>
          <label className="sort">Sort
            <select className="select select--sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="edited">Last edited</option>
              <option value="title">Title A–Z</option>
              <option value="created">Date created</option>
            </select>
          </label>
        </div>
        <div>{lists}</div>
      </main>

      {veil && <div className="drop-veil"><div>Drop to import as a new doc</div></div>}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} file={importFile} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title ?? ""}”?`}
        body={toDelete?.collaborators.length
          ? `This removes it for you and the ${toDelete.collaborators.length} ${toDelete.collaborators.length > 1 ? "people" : "person"} it's shared with. This can't be undone.`
          : "This can't be undone."}
        confirm="Delete document"
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </div>
  );
}

function Section({ icon, title, count, hint, children }: { icon: React.ReactNode; title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <section className="sec" aria-label={title}>
      <div className="sec-head"><h2>{icon}{title}</h2><span className="count">{count}</span>{hint && <span className="hint">{hint}</span>}</div>
      {children}
    </section>
  );
}

function Grid({ docs, me, fresh, shared, onDelete }: { docs: DashCard[]; me: User; fresh: (d: DashCard) => Fresh | null; shared?: boolean; onDelete?: (d: DashCard) => void }) {
  return (
    <div className="doc-grid">
      {docs.map((d, i) => <Card key={d.id} d={d} i={i} me={me} nf={fresh(d)} isShared={shared ?? d.role !== "owner"} onDelete={onDelete} />)}
    </div>
  );
}

function Card({ d, i, me, nf, isShared, onDelete }: { d: DashCard; i: number; me: User; nf: Fresh | null; isShared: boolean; onDelete?: (d: DashCard) => void }) {
  const editor = d.lastEditedBy ?? d.owner;
  const hasText = d.text.trim().length > 0;
  return (
    <Link className="card" href={`/d/${d.id}`} style={{ "--i": i } as React.CSSProperties} aria-label={d.title}>
      <div className="card-thumb">
        <div className="thumb-page">{hasText ? <DocThumb blocks={d.preview} /> : <div className="thumb-empty">Blank page</div>}</div>
        {nf?.changed && <span className="card-flag chip chip--change">{plural(nf.n, "change")}</span>}
      </div>
      <div className="card-body">
        <div className="title-row">
          {nf && (
            <Tip label={nf.tip}>
              <span className="new-dot" tabIndex={0} aria-label={`New for you: ${nf.tip}`} suppressHydrationWarning />
            </Tip>
          )}
          <div className="card-title">{d.title || "Untitled document"}</div>
          {nf?.changed && <span className="chip chip--change chip-inline">{plural(nf.n, "change")}</span>}
        </div>
        <span className="fresh">
          <Avatar name={editor.name} size="xs" />
          <span suppressHydrationWarning>Edited by {editor.id === me.id ? "you" : firstName(editor.name)} · {ago(d.updatedAt)}</span>
        </span>
        <div className="card-foot">
          {isShared ? (
            <><span className="owner"><Avatar name={d.owner.name} size="xs" /><span>{d.owner.name}</span></span><span className="grow" /><RoleChip role={d.role} /></>
          ) : d.collaborators.length ? (
            <><AvatarStack names={d.collaborators} /><span className="card-meta">Shared with {d.collaborators.length}</span></>
          ) : (
            <span className="private"><LockIcon className="i i--sm" aria-hidden /> Only you</span>
          )}
        </div>
      </div>
      {nf?.note && d.handoffNote && (
        <div className="card-note" style={{ "--i": i } as React.CSSProperties}>
          <small>Note from {firstName(d.owner.name)}</small><span className="txt">{d.handoffNote}</span>
        </div>
      )}
      {!isShared && onDelete && (
        <Tip label="Delete">
          <button type="button" className="icon-btn card-del" aria-label={`Delete ${d.title}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(d); }}>
            <TrashIcon className="i i--sm" aria-hidden />
          </button>
        </Tip>
      )}
    </Link>
  );
}

function EmptyArt() {
  return (
    <svg className="art" viewBox="0 0 150 120" aria-hidden="true">
      <ellipse cx="75" cy="110" rx="52" ry="6" fill="var(--surface-3)" />
      <g className="float2"><rect x="30" y="22" width="62" height="78" rx="6" fill="var(--surface)" stroke="var(--line-strong)" transform="rotate(-8 61 61)" /></g>
      <g className="float">
        <rect x="52" y="14" width="64" height="82" rx="6" fill="var(--page)" stroke="var(--line-strong)" />
        <path d="M62 30h34M62 40h44M62 48h38M62 56h42" stroke="var(--surface-3)" strokeWidth="4" strokeLinecap="round" />
        <path d="M62 70h24" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path className="spark" d="M124 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="var(--marigold)" />
      <path className="spark" style={{ animationDelay: "-1.2s" }} d="M24 70l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--accent)" />
    </svg>
  );
}
