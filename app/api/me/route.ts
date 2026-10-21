import { NextResponse } from "next/server";
import { authed } from "@/lib/server/http";

export const GET = authed(async (_req, user) => NextResponse.json(user));
