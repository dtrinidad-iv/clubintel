import "server-only";
import { cache } from "react";
import { likePattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { CLUB_PAGE_SIZE, type ClubSearch } from "@/lib/validation";

// Queries for the shared national club database. Callers check the user first (DAL);
// these run as that user, and RLS lets any signed-in user read clubs.

const DIRECTORY_COLUMNS =
  "id, name, short_name, region, city, stadium, capacity, founded, league_id, league_name, tier, latest_season, league_position, avg_attendance";


type Client = Awaited<ReturnType<typeof createClient>>;

// Not async: the builder is thenable, so returning it from an async function would run it.
function directoryQuery(supabase: Client, search: ClubSearch, options: { head?: boolean } = {}) {
  let query = supabase.from("club_directory").select(DIRECTORY_COLUMNS, { count: "exact", head: options.head });
  if (search.q) query = query.ilike("name", likePattern(search.q));
  if (search.league) query = query.eq("league_id", search.league);
  if (search.region) query = query.eq("region", search.region);
  if (search.tier) query = query.eq("tier", search.tier);
  return query;
}

export async function searchClubs(search: ClubSearch) {
  const supabase = await createClient();
  const from = (search.page - 1) * CLUB_PAGE_SIZE;
  const { data, count, error } = await directoryQuery(supabase, search)
    .order("tier")
    .order("league_id")
    .order("league_position", { nullsFirst: false })
    .order("name")
    .range(from, from + CLUB_PAGE_SIZE - 1);

  let total = count ?? 0;
  if (error) {
    // PostgREST answers a page past the end with 416 (PGRST103) and no count; it's an empty page,
    // but the total still has to be right for API clients paging through.
    if (error.code !== "PGRST103") throw error;
    const { count: fullCount, error: countError } = await directoryQuery(supabase, search, { head: true });
    if (countError) throw countError;
    total = fullCount ?? 0;
  }

  return {
    clubs: data ?? [],
    meta: {
      page: search.page,
      pageSize: CLUB_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / CLUB_PAGE_SIZE)),
    },
  };
}

export type ClubListItem = Awaited<ReturnType<typeof searchClubs>>["clubs"][number];

export const getClub = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "id, name, short_name, region, city, stadium, capacity, founded, league:leagues(id, name, tier), seasons:club_seasons(season, league_id, league_position, avg_attendance, capacity)",
    )
    .eq("id", id)
    .order("season", { referencedTable: "club_seasons" })
    .maybeSingle();
  if (error) throw error;
  return data;
});

export type ClubDetail = NonNullable<Awaited<ReturnType<typeof getClub>>>;

export const listLeagues = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leagues").select("id, name, tier").order("tier").order("name");
  if (error) throw error;
  return data;
});

// Clubs in a league in one season, so a position reads as "3rd of 10".
export async function leagueSize(leagueId: string, season: number) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("club_seasons")
    .select("club_id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("season", season);
  if (error) throw error;
  return count ?? 0;
}

// Every club as a choice for a form's club picker.
export const clubOptions = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clubs").select("id, name").order("name");
  if (error) throw error;
  return data;
});
