import { authed, noContent } from "@/lib/server/http";
import { revokeShare } from "@/lib/server/shares";

export const DELETE = authed<{ id: string; userId: string }>(async (_req, user, { id, userId }) => {
  await revokeShare(user.id, id, userId);
  return noContent();
});
