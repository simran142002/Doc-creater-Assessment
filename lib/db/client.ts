import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS = path.join(process.cwd(), "lib/db/migrations");

const g = globalThis as unknown as { __db?: Promise<DB> };

export async function createPglite(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

async function createNeon(url: string): Promise<DB> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  return drizzle(neon(url), { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  g.__db ??= process.env.DATABASE_URL
    ? createNeon(process.env.DATABASE_URL)
    : createPglite(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".pglite"));
  return g.__db;
}

export function setDb(db: DB) {
  g.__db = Promise.resolve(db);
}
