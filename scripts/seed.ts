import { getDb } from "@/lib/db/client";
import { seed } from "@/lib/db/seed";

getDb()
  .then(seed)
  .then((r) => { console.log(`seeded: ${r.users} users, ${r.documents} new documents`); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
