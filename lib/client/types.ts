import type { DocJSON, JSONNode } from "@/lib/editor/types";
import type { FidelityReport } from "@/lib/server/import";
import type { ErrorCode } from "@/lib/server/errors";

export type { DocJSON, JSONNode, FidelityReport, ErrorCode };

export type Role = "owner" | "editor" | "viewer";
export type ShareRole = Exclude<Role, "owner">;
export type Person = { id: string; name: string };

export type User = { id: string; name: string; email: string; avatarHue: number };

export type Doc = {
  id: string;
  title: string;
  content: DocJSON;
  version: number;
  source: "blank" | "import";
  createdAt: string;
  updatedAt: string;
  owner: Person;
  lastEditedBy: Person | null;
};

export type DocCard = {
  id: string;
  title: string;
  updatedAt: string;
  source: "blank" | "import";
  role: Role;
  owner: Person;
  lastEditedBy: Person | null;
  newForYou: { changedBlocks: number; unreadNote: boolean; neverOpened: boolean };
  handoffNote: string | null;
};

export type DocList = { owned: DocCard[]; shared: DocCard[] };

export type DashCard = DocCard & { createdAt: string; preview: JSONNode[]; text: string; collaborators: string[] };
export type DashList = { owned: DashCard[]; shared: DashCard[] };

export type Member = { userId: string; name: string; email: string; role: Role; note: string | null };

export type CatchUp = {
  since: string;
  changedIds: string[];
  removedCount: number;
  editors: (Person & { count: number })[];
  authors: Record<string, string>;
};

export type Handoff = { note: string; from: Person; unread: boolean; sharedAt: string };

export type DocPayload = { doc: Doc; role: Role; catchUp: CatchUp | null; handoff: Handoff | null };

export type SaveResult = { version: number; updatedAt: string; title: string };

export type PatchBody = { title?: string; content?: DocJSON; baseVersion?: number; force?: boolean };

export type StaleDetails = { current: { version: number; updatedAt: string; updatedBy: Person | null; doc: Doc } };

export type Share = {
  userId: string;
  name: string;
  email: string;
  role: ShareRole;
  note: string | null;
  noteSeenAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ShareBody = { email: string; role: ShareRole; note?: string | null };

export type ImportResult = { doc: Doc; report: FidelityReport };
