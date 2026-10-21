"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BoldIcon, FocusIcon, ItalicIcon, ListIcon, ListOrderedIcon, RedoIcon, UnderlineIcon, UndoIcon } from "lucide-react";
import { Fragment } from "react";
import { Tip } from "@/components/tip";
import { wordCount } from "@/lib/client/format";
import { cn } from "@/lib/utils";

type Item = {
  key: string;
  label: string;
  tip: string;
  content: React.ReactNode;
  txt?: boolean;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
  can?: (e: Editor) => boolean;
};

const chain = (e: Editor) => e.chain().focus();

const GROUPS: Item[][] = [
  [
    { key: "undo", label: "Undo", tip: "Undo  ⌘Z", content: <UndoIcon className="i" aria-hidden />, run: (e) => chain(e).undo().run(), can: (e) => e.can().undo() },
    { key: "redo", label: "Redo", tip: "Redo  ⇧⌘Z", content: <RedoIcon className="i" aria-hidden />, run: (e) => chain(e).redo().run(), can: (e) => e.can().redo() },
  ],
  [
    { key: "p", label: "Normal text", tip: "Normal text  ⌥⌘0", txt: true, content: <span className="serif">Aa</span>, run: (e) => chain(e).setParagraph().run(),
      active: (e) => e.isActive("paragraph") && !e.isActive("bulletList") && !e.isActive("orderedList") },
    { key: "h1", label: "Heading 1", tip: "Heading 1  ⌥⌘1 · or type #", txt: true, content: "H1", run: (e) => chain(e).toggleHeading({ level: 1 }).run(), active: (e) => e.isActive("heading", { level: 1 }) },
    { key: "h2", label: "Heading 2", tip: "Heading 2  ⌥⌘2 · or type ##", txt: true, content: "H2", run: (e) => chain(e).toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
    { key: "h3", label: "Heading 3", tip: "Heading 3  ⌥⌘3 · or type ###", txt: true, content: "H3", run: (e) => chain(e).toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
  ],
  [
    { key: "bold", label: "Bold", tip: "Bold  ⌘B · or **text**", content: <BoldIcon className="i" aria-hidden />, run: (e) => chain(e).toggleBold().run(), active: (e) => e.isActive("bold") },
    { key: "italic", label: "Italic", tip: "Italic  ⌘I · or *text*", content: <ItalicIcon className="i" aria-hidden />, run: (e) => chain(e).toggleItalic().run(), active: (e) => e.isActive("italic") },
    { key: "underline", label: "Underline", tip: "Underline  ⌘U", content: <UnderlineIcon className="i" aria-hidden />, run: (e) => chain(e).toggleUnderline().run(), active: (e) => e.isActive("underline") },
  ],
  [
    { key: "bullet", label: "Bulleted list", tip: "Bulleted list  ⇧⌘8 · or type -", content: <ListIcon className="i" aria-hidden />, run: (e) => chain(e).toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
    { key: "ordered", label: "Numbered list", tip: "Numbered list  ⇧⌘7 · or type 1.", content: <ListOrderedIcon className="i" aria-hidden />, run: (e) => chain(e).toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  ],
];

const ITEMS = GROUPS.flat();

function stats(e: Editor) {
  const words = wordCount(e.getText());
  return words ? `${words.toLocaleString()} word${words === 1 ? "" : "s"} · ${Math.max(1, Math.round(words / 230))} min read` : "Empty page";
}

/** Sticky formatting bar. Scrolls horizontally on phones; disabled and desaturated for viewers. */
export function Toolbar({ editor, disabled, focus, onFocus }: { editor: Editor | null; disabled: boolean; focus: boolean; onFocus: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? {
      items: ITEMS.map((i) => ({ active: i.active?.(e) ?? false, can: i.can?.(e) ?? true })),
      stat: stats(e),
    } : null),
  });

  return (
    <div className="ed-toolbar-wrap">
      <div className={cn("ed-toolbar", disabled && "is-disabled")} role="toolbar" aria-label="Formatting" aria-disabled={disabled}>
        {GROUPS.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <span className="tb-sep" />}
            <div className="tb-group">
              {group.map((item) => {
                const s = state?.items[ITEMS.indexOf(item)];
                const active = !disabled && !!s?.active;
                return (
                  <Tip key={item.key} label={item.tip}>
                    <button
                      type="button"
                      className={cn("tb-btn", item.txt && "txt", active && "is-active")}
                      aria-label={item.label}
                      aria-pressed={item.active ? !!s?.active : undefined}
                      disabled={disabled || !editor || s?.can === false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor && !disabled && item.run(editor)}
                    >
                      {item.content}
                    </button>
                  </Tip>
                );
              })}
            </div>
          </Fragment>
        ))}
        <span className="tb-spacer" />
        <span className="tb-stat">{state?.stat}</span>
        <Tip label="Focus mode  ⌘.">
          <button type="button" className={cn("tb-btn", focus && "is-active")} aria-label="Focus mode" aria-pressed={focus} onClick={onFocus}>
            <FocusIcon className="i" aria-hidden />
          </button>
        </Tip>
      </div>
    </div>
  );
}
