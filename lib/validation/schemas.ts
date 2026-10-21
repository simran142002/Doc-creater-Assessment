import { z } from "zod";
import { LIMITS } from "@/lib/server/limits";

export const docContent = z.looseObject({ type: z.literal("doc"), content: z.array(z.unknown()).optional() });
const title = z.string().max(LIMITS.titleMax, `Title must be ${LIMITS.titleMax} characters or fewer.`);

export const sessionBody = z.object({ userId: z.uuid() });

export const createDocBody = z.object({ title: title.optional(), content: docContent.optional() });

export const patchDocBody = z
  .object({
    title: title.optional(),
    content: docContent.optional(),
    baseVersion: z.number().int().min(1).optional(),
    force: z.boolean().optional(),
  })
  .refine((b) => b.title !== undefined || b.content !== undefined, "Provide title and/or content.")
  .refine((b) => b.content === undefined || b.baseVersion !== undefined, {
    message: "baseVersion is required when saving content.",
    path: ["baseVersion"],
  });

export const shareBody = z.object({
  email: z.email("Enter a valid email address.").transform((e) => e.trim().toLowerCase()),
  role: z.enum(["viewer", "editor"]),
  note: z.string().trim().max(LIMITS.noteMax, `Note must be ${LIMITS.noteMax} characters or fewer.`).nullish(),
});

export const userIdParam = z.uuid();
