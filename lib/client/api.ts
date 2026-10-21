import type {
  Doc, DocList, DocPayload, ErrorCode, ImportResult, PatchBody, SaveResult, Share, ShareBody, StaleDetails, User,
} from "./types";

export class ApiError extends Error {
  constructor(readonly code: ErrorCode | "NETWORK", message: string, readonly status: number, readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
  /** Network failures and 5xx are worth one retry; 4xx are not. */
  get retryable() {
    return this.code === "NETWORK" || this.status >= 500;
  }
  get stale(): StaleDetails["current"] | null {
    return this.code === "STALE_VERSION" ? ((this.details as StaleDetails | undefined)?.current ?? null) : null;
  }
}

export const isApiError = (e: unknown, code?: ErrorCode): e is ApiError =>
  e instanceof ApiError && (!code || e.code === code);

type Init = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

export async function request<T>(path: string, { json, headers, ...init }: Init = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: json === undefined ? headers : { "content-type": "application/json", ...headers },
      body: json === undefined ? init.body : JSON.stringify(json),
    });
  } catch {
    throw new ApiError("NETWORK", "You appear to be offline.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(err?.code ?? "INTERNAL", err?.message ?? `Request failed (${res.status}).`, res.status, err?.details);
  }
  return data as T;
}

const doc = (id: string) => `/api/documents/${encodeURIComponent(id)}`;

export const api = {
  users: () => request<User[]>("/api/users"),
  me: () => request<User>("/api/me"),
  signIn: (userId: string) => request<{ user: User }>("/api/session", { method: "POST", json: { userId } }),
  signOut: () => request<void>("/api/session", { method: "DELETE" }),

  listDocuments: () => request<DocList>("/api/documents"),
  createDocument: (body: { title?: string; content?: unknown } = {}) =>
    request<Doc>("/api/documents", { method: "POST", json: body }),
  getDocument: (id: string) => request<DocPayload>(doc(id)),
  openDocument: (id: string) => request<DocPayload>(`${doc(id)}/open`, { method: "POST" }),
  markNoteSeen: (id: string) => request<void>(`${doc(id)}/note/seen`, { method: "POST" }),
  patchDocument: (id: string, body: PatchBody, opts: { keepalive?: boolean } = {}) =>
    request<SaveResult>(doc(id), { method: "PATCH", json: body, keepalive: opts.keepalive }),
  deleteDocument: (id: string) => request<void>(doc(id), { method: "DELETE" }),

  listShares: (id: string) => request<Share[]>(`${doc(id)}/shares`),
  upsertShare: (id: string, body: ShareBody) => request<Share>(`${doc(id)}/shares`, { method: "PUT", json: body }),
  revokeShare: (id: string, userId: string) =>
    request<void>(`${doc(id)}/shares/${encodeURIComponent(userId)}`, { method: "DELETE" }),

  importFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ImportResult>("/api/import", { method: "POST", body: form });
  },
};
