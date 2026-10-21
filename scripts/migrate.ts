import { getDb, MIGRATIONS } from "@/lib/db/client";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(drizzle(neon(url)), { migrationsFolder: MIGRATIONS });
  } else {
    await getDb(); // PGlite migrates on open
  }
  console.log(`migrated (${url ? "neon" : "pglite"})`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
