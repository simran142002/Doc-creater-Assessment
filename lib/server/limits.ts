export const LIMITS = {
  titleMax: 200,
  noteMax: 280,
  contentBytes: 1024 * 1024,
  contentDepth: 200,
  uploadBytes: 2 * 1024 * 1024,
  importBlocks: 10_000,
} as const;

export const DEFAULT_TITLE = "Untitled document";
