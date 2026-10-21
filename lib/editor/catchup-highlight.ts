import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type CatchUpAuthor = { name: string; initials: string; color: string };
export type CatchUpMarks = { ids: string[]; activeId: string | null; authors?: Record<string, CatchUpAuthor> };

export const catchUpKey = new PluginKey<CatchUpMarks>("catchUp");

const EMPTY: CatchUpMarks = { ids: [], activeId: null };

/** Decoration-only highlight of changed top-level blocks (tint + margin avatar). Never touches the document, so it is never saved. */
export const CatchUpHighlight = Extension.create({
  name: "catchUpHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<CatchUpMarks>({
        key: catchUpKey,
        state: {
          init: () => EMPTY,
          apply: (tr, prev) => tr.getMeta(catchUpKey) ?? prev,
        },
        props: {
          decorations(state) {
            const { ids, activeId, authors } = catchUpKey.getState(state) ?? EMPTY;
            if (!ids.length) return null;
            const wanted = new Set(ids);
            const decos: Decoration[] = [];
            state.doc.forEach((node, pos) => {
              const id = node.attrs.id;
              if (typeof id !== "string" || !wanted.has(id)) return;
              const a = authors?.[id];
              decos.push(Decoration.node(pos, pos + node.nodeSize, {
                class: id === activeId ? "cu-block is-current" : "cu-block",
                "data-changed": "true",
                ...(a && { "data-cu-by": a.initials, style: `--cu-color:${a.color}`, title: `Changed by ${a.name}` }),
              }));
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
