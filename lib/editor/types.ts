export type JSONNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type DocJSON = JSONNode & { type: "doc"; content?: JSONNode[] };

export type BlockStamp = { h: string; by: string; at: string; del?: true };
export type BlockMeta = Record<string, BlockStamp>;
