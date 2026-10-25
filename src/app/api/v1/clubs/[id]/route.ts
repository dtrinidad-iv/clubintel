import type { NextRequest } from "next/server";
import { getClub } from "@/lib/clubs";
import { getUser } from "@/lib/dal";
import { uuidSchema } from "@/lib/validation";

// GET /api/v1/clubs/{id}: one club with its league and season history.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/clubs/[id]">) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = uuidSchema.safeParse(id);
  try {
    const club = parsed.success ? await getClub(parsed.data) : null;
    if (!club) return Response.json({ error: "Club not found" }, { status: 404 });
    return Response.json({ data: club });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
