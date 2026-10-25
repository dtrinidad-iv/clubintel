import type { NextRequest } from "next/server";
import { searchClubs } from "@/lib/clubs";
import { getUser } from "@/lib/dal";
import { parseClubSearch } from "@/lib/validation";

// GET /api/v1/clubs?q=&league=&region=&tier=&page=
// The national club database for external tools. Needs a signed-in session; invalid filters are ignored.
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { clubs, meta } = await searchClubs(parseClubSearch(request.nextUrl.searchParams));
    return Response.json({ data: clubs, meta });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
