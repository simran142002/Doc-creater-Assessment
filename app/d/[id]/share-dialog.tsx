"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlertIcon, EyeIcon, LockIcon, PencilIcon, StickyNoteIcon, XIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Modal, ModalClose } from "@/components/modal";
import { RoleChip } from "@/components/role-chip";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/client/api";
import { celebrate } from "@/lib/client/confetti";
import { firstName } from "@/lib/client/format";
import { toast } from "@/lib/client/toast";
import type { Member, ShareRole, User } from "@/lib/client/types";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const ROLE_LINE: Record<ShareRole, string> = { editor: "Can edit. Can't share or delete.", viewer: "Can read only." };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: { id: string; title: string };
  me: User;
  members: Member[];
  onMembersChange: (m: Member[]) => void;
};

function Legend() {
  return (
    <div className="share-legend grow">
      <span><RoleChip role="owner" /></span><span>Manages access · can delete</span>
      <span><RoleChip role="editor" /></span><span>{ROLE_LINE.editor}</span>
      <span><RoleChip role="viewer" /></span><span>{ROLE_LINE.viewer}</span>
    </div>
  );
}

/** Owner: add by email + role (+ handoff note), change role, remove with Undo. Everyone else: read-only list. */
export function ShareDialog({ open, onOpenChange, doc, me, members, onMembersChange }: Props) {
  const m = useMotionPreset();
  const owner = members.find((x) => x.role === "owner")!;
  const readOnly = owner.userId !== me.id;
  const myRole = members.find((x) => x.userId === me.id)?.role;

  const [people, setPeople] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [hl, setHl] = useState(-1);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open && !readOnly) api.users().then(setPeople).catch(() => {});
  }, [open, readOnly]);

  const taken = new Set(members.map((x) => x.userId));
  const qv = email.trim().toLowerCase();
  const suggestions = people.filter((p) => !taken.has(p.id) && (!qv || p.email.includes(qv) || p.name.toLowerCase().includes(qv)));
  const showSug = sugOpen && suggestions.length > 0;

  const fail = (msg: React.ReactNode) => {
    setError(msg);
    const f = formRef.current;
    if (!f) return;
    f.classList.remove("shake");
    void f.offsetWidth;
    f.classList.add("shake");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSugOpen(false);
    const val = email.trim().toLowerCase();
    if (!val) return fail("Enter an email address to share with.");
    if (!EMAIL.test(val)) return fail("That doesn't look like an email address.");
    const target = people.find((p) => p.email === val);
    if (people.length && !target) {
      const others = people.filter((p) => p.id !== me.id).map((p) => p.email);
      return fail(<>No one with <b>{val}</b> is on Ajaia Docs.{others.length > 0 && <> Teammates here: <b>{others.join(", ")}</b>.</>}</>);
    }
    if (target?.id === me.id) return fail("That's you — you already own this document.");
    const existing = members.find((x) => x.email === val);
    if (existing) {
      setFlash({ id: existing.userId, n: Date.now() });
      return fail(existing.role === "owner"
        ? `${existing.name} owns this document.`
        : `${firstName(existing.name)} already has ${existing.role === "editor" ? "edit" : "view"} access — change their role below.`);
    }
    if (!navigator.onLine) return fail("You're offline. Sharing needs a connection — try again when you're back.");
    setBusy(true);
    try {
      const n = noteOpen ? note.trim() : "";
      const s = await api.upsertShare(doc.id, { email: val, role, note: n || undefined });
      onMembersChange([...members, { userId: s.userId, name: s.name, email: s.email, role: s.role, note: s.note }]);
      setFresh(s.userId);
      setEmail("");
      setNote("");
      setNoteOpen(false);
      setError(null);
      void celebrate(me.id);
      toast({ type: "success", title: `Shared with ${s.name}`, body: `${s.role === "editor" ? "Can edit" : "View only"}${n ? " · note attached" : ""}` });
    } catch (err) {
      fail(isApiError(err) ? err.message : "Couldn't share.");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (x: Member, next: ShareRole) => {
    if (!navigator.onLine) return toast({ type: "error", title: "You're offline", body: "Role changes need a connection." });
    try {
      await api.upsertShare(doc.id, { email: x.email, role: next });
      onMembersChange(members.map((y) => (y.userId === x.userId ? { ...y, role: next } : y)));
      toast({ type: "success", title: `${firstName(x.name)} can now ${next === "editor" ? "edit" : "only view"}` });
    } catch (err) {
      toast({ type: "error", title: "Couldn't change the role", body: isApiError(err) ? err.message : undefined });
    }
  };

  const remove = async (x: Member) => {
    if (!navigator.onLine) return toast({ type: "error", title: "You're offline", body: "Removing access needs a connection." });
    try {
      await api.revokeShare(doc.id, x.userId);
      setConfirming(null);
      const without = members.filter((y) => y.userId !== x.userId);
      onMembersChange(without);
      toast({
        title: `Removed ${firstName(x.name)}'s access`,
        action: {
          label: "Undo",
          onClick: () => {
            api.upsertShare(doc.id, { email: x.email, role: x.role as ShareRole, note: x.note ?? undefined })
              .then(() => {
                onMembersChange([...without, x]);
                setFlash({ id: x.userId, n: Date.now() });
              })
              .catch((err) => toast({ type: "error", title: "Couldn't restore access", body: isApiError(err) ? err.message : undefined }));
          },
        },
      });
    } catch (err) {
      toast({ type: "error", title: "Couldn't remove access", body: isApiError(err) ? err.message : undefined });
    }
  };

  const pick = (p: User) => {
    setEmail(p.email);
    setSugOpen(false);
    setError(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) { setError(null); setConfirming(null); setSugOpen(false); }
        onOpenChange(o);
      }}
      closeButton
      title={<>{readOnly ? "People with access to" : "Share"} <q>{doc.title}</q></>}
      description={readOnly
        ? `Only ${owner.name}, the owner, can add people, change roles or remove access.`
        : <>People you add will find it under <b>Shared with me</b>. Only you, as the owner, manage access.</>}
      onOpenAutoFocus={(e) => {
        if (readOnly) return;
        e.preventDefault();
        document.getElementById("sh-email")?.focus();
      }}
      footer={<><Legend /><ModalClose asChild><Button autoFocus={readOnly}>Done</Button></ModalClose></>}
    >
      {readOnly ? (
        <div className="owner-only">
          <LockIcon className="i i--sm" aria-hidden />
          <span>You have {myRole === "editor" ? "edit" : "view"} access. Ask {firstName(owner.name)} if someone else needs it.</span>
        </div>
      ) : (
        <>
          <form ref={formRef} className="share-add" noValidate onSubmit={submit}>
            <div className="combo">
              <label className="sr-only" htmlFor="sh-email">Email</label>
              <input
                id="sh-email" className="input" type="email" inputMode="email" placeholder="Add people by email" autoComplete="off"
                aria-describedby="sh-err" aria-invalid={!!error} aria-expanded={showSug} aria-controls="sh-suggest" role="combobox"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); setSugOpen(true); setHl(-1); }}
                onFocus={() => setSugOpen(true)}
                onBlur={() => setTimeout(() => setSugOpen(false), 100)}
                onKeyDown={(e) => {
                  if (!showSug) return;
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setHl((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
                  } else if (e.key === "Enter" && hl >= 0) {
                    e.preventDefault();
                    pick(suggestions[hl]);
                  } else if (e.key === "Escape") {
                    e.stopPropagation();
                    setSugOpen(false);
                  }
                }}
              />
              {showSug && (
                <div className="suggest" role="listbox" id="sh-suggest">
                  {suggestions.map((p, i) => (
                    <button key={p.id} type="button" role="option" aria-selected={i === hl} className={cn(i === hl && "is-hl")}
                      onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
                      <Avatar name={p.name} size="sm" />
                      <span><span>{p.name}</span><br /><span className="sub">{p.email}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="sr-only" htmlFor="sh-role">Role</label>
            <select id="sh-role" className="select" value={role} onChange={(e) => setRole(e.target.value as ShareRole)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Inviting…" : "Invite"}</Button>
          </form>
          <div className="role-help">
            {role === "editor" ? <PencilIcon className="i i--sm" aria-hidden /> : <EyeIcon className="i i--sm" aria-hidden />}
            <span><b>{role === "editor" ? "Editor" : "Viewer"}</b> — {ROLE_LINE[role]}</span>
          </div>
          <div id="sh-err" aria-live="assertive">
            {error && <div className="field-error"><CircleAlertIcon className="i i--sm" aria-hidden /><span>{error}</span></div>}
          </div>
          <button type="button" className="note-toggle" onClick={() => {
            setNoteOpen((o) => !o);
            setTimeout(() => noteRef.current?.focus(), 0);
          }}>
            {noteOpen ? <><XIcon className="i i--sm" aria-hidden /> Remove note</> : <><StickyNoteIcon className="i i--sm" aria-hidden /> Add a handoff note</>}
          </button>
          {noteOpen && (
            <div className="note-field">
              <label className="sr-only" htmlFor="sh-note">Handoff note</label>
              <textarea id="sh-note" ref={noteRef} className="textarea" maxLength={280} rows={2} placeholder="What should they look at first?"
                value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="meta"><span>Shown on their dashboard and pinned to the doc the first time they open it.</span><span>{note.length}/280</span></div>
            </div>
          )}
        </>
      )}

      <div className="members">
        <h3>People with access</h3>
        <AnimatePresence initial={false}>
          {members.map((x) => {
            const you = x.userId === me.id;
            const fixed = x.role === "owner" || readOnly;
            return (
              <motion.div key={x.userId} {...m("row", { skipInitial: fresh !== x.userId })}
                className={cn("member", flash?.id === x.userId && "is-flash")}
                onAnimationEnd={() => flash?.id === x.userId && setFlash(null)}>
                <Avatar name={x.name} />
                <div className="who">
                  <b>{x.name} {you && <span className="you">(you)</span>}</b>
                  <span>{x.email}</span>
                  {x.note && <span className="note-mini" title={x.note}>“{x.note}”</span>}
                </div>
                {confirming === x.userId ? (
                  <div className="confirm">
                    Remove access?
                    <Button variant="danger" size="sm" onClick={() => void remove(x)}>Remove</Button>
                    <Button variant="ghost" size="sm" autoFocus onClick={() => setConfirming(null)}>Keep</Button>
                  </div>
                ) : (
                  <>
                    <div className="ctl">
                      {fixed ? <RoleChip role={x.role} /> : (
                        <select className="select select--sm" aria-label={`Role for ${x.name}`} value={x.role}
                          onChange={(e) => void changeRole(x, e.target.value as ShareRole)}>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </div>
                    {fixed ? <span style={{ width: 36 }} /> : (
                      <Tip label="Remove access">
                        <button type="button" className="icon-btn" aria-label={`Remove ${x.name}`} onClick={() => setConfirming(x.userId)}>
                          <XIcon className="i i--sm" aria-hidden />
                        </button>
                      </Tip>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
