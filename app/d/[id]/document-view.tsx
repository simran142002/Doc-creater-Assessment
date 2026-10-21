"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeftIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, EllipsisIcon, EyeIcon, FileTextIcon, FileUpIcon, FocusIcon, LinkIcon,
  RefreshCwIcon, SparkleIcon, StickyNoteIcon, TrashIcon, UndoIcon, UserPlusIcon, UsersIcon, WifiOffIcon, XIcon,
} from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import { OfflinePill } from "@/components/app-shell";
import { Avatar, AvatarStack } from "@/components/avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RoleChip } from "@/components/role-chip";
import { Teddy } from "@/components/teddy";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { api } from "@/lib/client/api";
import type { SaveStatus } from "@/lib/client/autosave";
import { ago, clockTime, firstName, namesOf, plural } from "@/lib/client/format";
import { importReports } from "@/lib/client/import-reports";
import { toast } from "@/lib/client/toast";
import type { DocPayload, Member, User } from "@/lib/client/types";
import { useCatchUp } from "@/lib/client/use-catch-up";
import { useDocEditor } from "@/lib/client/use-doc-editor";
import { fidelityParts } from "@/lib/client/use-import";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ShareDialog } from "./share-dialog";
import { Toolbar } from "./toolbar";

const AUTO_RETRY_MS = 5000;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function DocumentView({ user, payload, members: initialMembers, isNew }: { user: User; payload: DocPayload; members: Member[]; isNew: boolean }) {
  const { doc, role, catchUp, handoff } = payload;
  const router = useRouter();
  const m = useMotionPreset();
  const canEdit = role !== "viewer";
  const ed = useDocEditor({ doc, role, placeholder: canEdit ? "Tip: type # for a heading, - for a list, **bold** for bold…" : "" });
  const cu = useCatchUp({ editor: ed.editor, docId: doc.id, content: doc.content, catchUp });
  const report = useSyncExternalStore(importReports.subscribe, () => importReports.get(doc.id), () => null);

  const [members, setMembers] = useState(initialMembers);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!handoff?.unread);
  const [caught, setCaught] = useState(false);
  const [focus, setFocus] = useState(false);
  const owner = initialMembers[0];
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew && canEdit) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [isNew, canEdit]);

  // Save failures: toast once, auto-retry every 5s, recover when back online.
  const failed = useRef(false);
  const { status, retry } = ed;
  useEffect(() => {
    if (status === "error") {
      if (!failed.current) {
        failed.current = true;
        toast({ type: "error", title: "Couldn't reach the server", body: "Your changes are safe on this device. We'll keep retrying.", action: { label: "Retry now", onClick: () => void retry() }, duration: 6000 });
      }
      const t = setTimeout(() => void retry(), AUTO_RETRY_MS);
      const onOnline = () => void retry();
      addEventListener("online", onOnline);
      return () => {
        clearTimeout(t);
        removeEventListener("online", onOnline);
      };
    }
    if (status === "saved" && failed.current) {
      failed.current = false;
      toast({ type: "success", title: "All changes saved", body: "You're back online." });
    }
  }, [status, retry]);

  useEffect(() => {
    document.body.classList.toggle("focus-mode", focus);
    return () => document.body.classList.remove("focus-mode");
  }, [focus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setFocus((f) => !f);
      } else if (e.key === "Escape" && !document.querySelector(".scrim, .pop")) setFocus(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const finishCatchUp = (step: () => void, finishing: boolean) => {
    step();
    if (!finishing) return;
    setTimeout(() => {
      setCaught(true);
      scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    }, 300);
  };

  useEffect(() => {
    if (!caught) return;
    const t = setTimeout(() => setCaught(false), 9000);
    return () => clearTimeout(t);
  }, [caught]);

  const dismissNote = () => {
    setNoteOpen(false);
    if (handoff?.unread) api.markNoteSeen(doc.id).catch(() => {});
  };

  const remove = async () => {
    try {
      await api.deleteDocument(doc.id);
      toast({ type: "success", title: "Document deleted", body: ed.title.value });
      router.replace("/");
      router.refresh();
    } catch (e) {
      toast({ type: "error", title: "Couldn't delete the document", body: e instanceof Error ? e.message : undefined });
    }
  };

  const undoImport = async () => {
    if (!report) return;
    try {
      await api.deleteDocument(doc.id);
      importReports.clear(doc.id);
      toast({ title: "Import undone", body: `${report.file} was not added.` });
      router.replace("/");
      router.refresh();
    } catch (e) {
      toast({ type: "error", title: "Couldn't undo the import", body: e instanceof Error ? e.message : undefined });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast({ type: "success", title: "Link copied", body: "Only people with access can open it." });
    } catch {
      toast({ title: "Copy the URL from the address bar", body: "Clipboard access was blocked." });
    }
  };

  const conflictBy = ed.conflict?.updatedBy?.name ?? "Someone";
  const editedBy = ed.lastSavedAt ? null : doc.lastEditedBy;
  const editedAt = ed.lastSavedAt ?? doc.updatedAt;
  const editedName = editedBy ? editedBy.name : user.name;
  const people = members.map((x) => x.name);
  const editorNames = cu.editors.map((e) => e.name);

  return (
    <div className={cn("ed", cu.fading && "ed-catchup-off")}>
      <div className="ed-hotzone" />
      <div className="ed-head">
        <div className="ed-top">
          <Tip label="All documents">
            <Link className="icon-btn" href="/" aria-label="Back to documents" onClick={() => void ed.flush()}><ArrowLeftIcon className="i" aria-hidden /></Link>
          </Tip>
          <span className="ed-docicon"><FileTextIcon className="i" aria-hidden /></span>
          <div className="ed-titlewrap">
            <input
              ref={titleRef}
              className="ed-title"
              value={ed.title.value}
              aria-label="Document title"
              maxLength={200}
              readOnly={!canEdit}
              spellCheck={false}
              onChange={(e) => ed.title.onChange(e.target.value)}
              onBlur={ed.title.onBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                  ed.editor?.commands.focus("end");
                }
                if (e.key === "Escape") {
                  ed.title.revert();
                  e.currentTarget.blur();
                }
              }}
            />
            <div className="ed-meta">
              <span className="fresh">
                <Avatar name={editedName} size="xs" />
                <span suppressHydrationWarning>Edited by {!editedBy || editedBy.id === user.id ? "you" : firstName(editedBy.name)} · {ago(editedAt)}</span>
              </span>
              <span className="sep hide-sm">·</span>
              <span className="hide-sm">{role === "owner" ? "Owned by you" : `Owned by ${doc.owner.name}`}</span>
              {handoff && (
                <>
                  <span className="sep hide-sm">·</span>
                  <Button variant="ghost" size="sm" className="hide-sm note-chip" onClick={() => setNoteOpen(true)}>
                    <StickyNoteIcon className="i i--sm" aria-hidden /> Note
                  </Button>
                </>
              )}
            </div>
            {ed.title.error && <span className="ed-title-err" role="alert">{ed.title.error}</span>}
          </div>
          <div className="ed-actions">
            <OfflinePill />
            {canEdit && <SaveBadge status={ed.status} lastSavedAt={ed.lastSavedAt ?? doc.updatedAt} onRetry={() => void ed.retry()} />}
            <Tip label={members.map((x) => firstName(x.name) + (x.role === "owner" ? " (owner)" : "")).join(", ")}>
              <span className="ed-collab" tabIndex={0}><AvatarStack names={people} max={4} size="sm" /></span>
            </Tip>
            <span className="role-badge-wrap"><RoleChip role={role} /></span>
            {role === "owner" ? (
              <Button variant="primary" aria-label="Share" onClick={() => setShareOpen(true)}>
                <UserPlusIcon className="i i--sm" aria-hidden /><span className="lbl">Share</span>
              </Button>
            ) : (
              <Tip label={`Only ${firstName(owner.name)} manages access`}>
                <Button aria-label="People with access" onClick={() => setShareOpen(true)}>
                  <UsersIcon className="i i--sm" aria-hidden /><span className="lbl">People</span>
                </Button>
              </Tip>
            )}
            <M.Root>
              <M.Trigger asChild>
                <button type="button" className="icon-btn" aria-label="More options"><EllipsisIcon className="i" aria-hidden /></button>
              </M.Trigger>
              <M.Portal>
                <M.Content className="pop" align="end" sideOffset={8} collisionPadding={8}>
                  <M.Group className="pop-sec">
                    <M.Item className="pop-item" onSelect={() => setFocus(true)}>
                      <FocusIcon className="i i--sm" aria-hidden /><span className="grow">Focus mode</span><span className="kbd">⌘.</span>
                    </M.Item>
                    {handoff && (
                      <M.Item className="pop-item" onSelect={() => setNoteOpen(true)}>
                        <StickyNoteIcon className="i i--sm" aria-hidden /><span className="grow">Show handoff note</span>
                      </M.Item>
                    )}
                    <M.Item className="pop-item" onSelect={() => void copyLink()}>
                      <LinkIcon className="i i--sm" aria-hidden /><span className="grow">Copy link</span>
                    </M.Item>
                  </M.Group>
                  <div className="pop-sec">
                    {role === "owner" ? (
                      <M.Item className="pop-item pop-item--danger" onSelect={() => setDeleteOpen(true)}>
                        <TrashIcon className="i i--sm" aria-hidden /><span className="grow">Delete document</span>
                      </M.Item>
                    ) : (
                      <div className="pop-label" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>Only {owner.name} can share or delete.</div>
                    )}
                  </div>
                </M.Content>
              </M.Portal>
            </M.Root>
            <UserMenu user={user} />
          </div>
        </div>
        <Toolbar editor={ed.editor} disabled={!canEdit} focus={focus} onFocus={() => setFocus((f) => !f)} />
      </div>

      <Button size="sm" className="focus-exit" onClick={() => setFocus(false)}>
        <XIcon className="i i--sm" aria-hidden /> Exit focus <span className="kbd">esc</span>
      </Button>

      <div className="ed-body">
        {/* A direct child of .ed-body so it stays sticky while you scroll the page. */}
        <AnimatePresence initial={false}>
          {cu.total > 0 && !cu.allCaughtUp && (
            <motion.div key="catchup" {...m("banner")} className="banner banner--catchup" role="status">
              <span className="ico"><SparkleIcon className="i" aria-hidden /></span>
              <div className="txt">
                <b>{namesOf(editorNames)} changed {plural(cu.total, "section")} since you last looked</b>
                {cu.removedCount > 0 && <span> · removed {cu.removedCount}</span>}{" "}
                <span suppressHydrationWarning>· {ago(doc.updatedAt)}</span>
              </div>
              <div className="acts">
                <Button variant="ghost" size="sm" aria-label="Previous change" disabled={!cu.hasPrev} onClick={cu.prev}>
                  <ChevronUpIcon className="i i--sm" aria-hidden />
                </Button>
                <span className="counter" aria-live="polite">{cu.label}</span>
                <Button variant="primary" size="sm" onClick={() => finishCatchUp(cu.next, cu.isLast)}>
                  {cu.isLast ? <><CheckIcon className="i i--sm" aria-hidden /> Done</> : <>Next <ChevronDownIcon className="i i--sm" aria-hidden /></>}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => finishCatchUp(cu.dismiss, true)}>Mark as read</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="ed-banners">
          <AnimatePresence initial={false}>
            {caught && (
              <motion.div key="caught" {...m("banner")} className="caught" role="status">
                <Teddy success />
                <div className="grow">
                  <h3>You&apos;re all caught up</h3>
                  <p>
                    {cu.skipped ? "Marked as read." : `You've seen all ${plural(cu.total, "change")} from ${namesOf(editorNames)}.`}{" "}
                    Highlights are cleared — we&apos;ll flag anything new next time.
                  </p>
                </div>
                <Button size="sm" onClick={() => { setCaught(false); ed.editor?.commands.focus(); }}>Back to writing</Button>
              </motion.div>
            )}
            {ed.status === "conflict" && ed.conflict && (
              <motion.div key="conflict" {...m("banner")} className="banner banner--conflict" role="alert">
                <span className="ico"><UsersIcon className="i" aria-hidden /></span>
                <div className="txt">
                  <b suppressHydrationWarning>{firstName(conflictBy)} saved a newer version {ago(ed.conflict.updatedAt)}.</b>{" "}
                  <span>Your edits are safe here — pick which version to keep.</span>
                </div>
                <div className="acts">
                  <Button size="sm" onClick={() => {
                    ed.loadTheirs();
                    toast({ title: `Loaded ${firstName(conflictBy)}'s version`, body: "Your unsaved edits were discarded." });
                  }}>Load theirs</Button>
                  <Button variant="primary" size="sm" onClick={async () => {
                    await ed.keepMine();
                    toast({ type: "success", title: "Kept your version", body: `${firstName(conflictBy)} will see your changes highlighted next time.` });
                  }}>Keep mine</Button>
                </div>
              </motion.div>
            )}
            {report && (
              <motion.div key="fid" {...m("banner")} className="banner banner--fid" role="status">
                <span className="ico"><FileUpIcon className="i" aria-hidden /></span>
                <FidelityText report={report} />
                <div className="acts">
                  <Button size="sm" onClick={() => void undoImport()}><UndoIcon className="i i--sm" aria-hidden /> Undo import</Button>
                  <button type="button" className="icon-btn" aria-label="Dismiss" style={{ width: 30, height: 30 }} onClick={() => importReports.clear(doc.id)}>
                    <XIcon className="i i--sm" aria-hidden />
                  </button>
                </div>
              </motion.div>
            )}
            {role === "viewer" && (
              <motion.div key="viewer" {...m("banner")} className="banner banner--viewer" role="note">
                <span className="ico"><EyeIcon className="i" aria-hidden /></span>
                <div className="txt">
                  <b>You&apos;re viewing this document.</b>{" "}
                  <span>{firstName(owner.name)} gave you view-only access — the toolbar is turned off. Ask {firstName(owner.name)} if you need to edit.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="ed-stage">
          {ed.editor ? (
            <div className={cn("page", !canEdit && "is-readonly")}>
              <div className="prose"><EditorContent editor={ed.editor} /></div>
            </div>
          ) : <EditorSkeleton />}
          <aside className="ed-side">
            <AnimatePresence>
              {handoff && noteOpen && (
                <motion.div key="note" {...m("note")} className="note-callout" role="note">
                  <div className="from"><Avatar name={handoff.from.name} size="xs" /> Note from {firstName(handoff.from.name)}</div>
                  <p className="body">{handoff.note}</p>
                  <div className="row">
                    <span className="when" suppressHydrationWarning>Shared {ago(handoff.sharedAt)}</span>
                    <Button size="sm" onClick={dismissNote}><CheckIcon className="i i--sm" aria-hidden /> Got it</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} doc={{ id: doc.id, title: ed.title.value }} me={user} members={members} onMembersChange={setMembers} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${ed.title.value}”?`}
        body={members.length > 1
          ? `This removes it for you and the ${members.length - 1} ${members.length > 2 ? "people" : "person"} it's shared with. This can't be undone.`
          : "This can't be undone."}
        confirm="Delete document"
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function FidelityText({ report }: { report: NonNullable<ReturnType<typeof importReports.get>> }) {
  const p = fidelityParts(report.report, report.words);
  return (
    <div className="txt">
      <b>Imported from {report.file}</b>{" "}
      <span>
        — <span className="kept">kept {p.kept}</span>
        {p.flattened && `; flattened ${p.flattened} to plain text`}
        {p.dropped ? <>; <span className="dropped">dropped {p.dropped}</span></> : "; nothing dropped"}.
      </span>
    </div>
  );
}

function SaveBadge({ status, lastSavedAt, onRetry }: { status: SaveStatus; lastSavedAt: string; onRetry: () => void }) {
  const state = status === "error" ? "error" : status === "conflict" ? "conflict" : status === "saving" || status === "dirty" ? "saving" : "saved";
  return (
    <span className="save" data-state={state} aria-live="polite" title={state === "saved" ? `All changes saved · ${clockTime(lastSavedAt)}` : undefined} suppressHydrationWarning>
      {state === "saving" && <><span className="spin" /> Saving…</>}
      {state === "saved" && (
        <><svg key={lastSavedAt} className="i i--sm tick" viewBox="0 0 24 24" aria-hidden><path d="M20 6 9 17l-5-5" /></svg> Saved</>
      )}
      {state === "conflict" && <><UsersIcon className="i i--sm" aria-hidden /> Waiting for you</>}
      {state === "error" && (
        <>
          <WifiOffIcon className="i i--sm" aria-hidden /> <span>Couldn&apos;t save</span>{" "}
          <button type="button" onClick={onRetry}><RefreshCwIcon className="i i--sm" aria-hidden /> Retry</button>
        </>
      )}
    </span>
  );
}

export function EditorSkeleton() {
  return (
    <div className="ed-skel" aria-busy="true" aria-label="Loading document">
      <div className="skel" style={{ height: 30, width: "60%", marginBottom: 28 }} />
      <div className="skel" />
      <div className="skel" style={{ width: "92%" }} />
      <div className="skel" style={{ width: "70%" }} />
      <div className="skel" style={{ height: 22, width: "40%", margin: "30px 0 18px" }} />
      <div className="skel" />
      <div className="skel" style={{ width: "85%" }} />
    </div>
  );
}
