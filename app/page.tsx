import { requirePageUser, toJson } from "@/lib/server/page";
import type { DashList, User } from "@/lib/client/types";
import { Dashboard } from "./dashboard";
import { dashboardCards } from "./dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requirePageUser();
  const docs = toJson<DashList>(await dashboardCards(user.id));
  return <Dashboard user={toJson<User>(user)} docs={docs} />;
}
