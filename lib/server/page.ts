import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userFromToken } from "./auth";

export async function sessionUser() {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requirePageUser() {
  const user = await sessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Server → client props: Dates become ISO strings, matching the API JSON. */
export const toJson = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;
