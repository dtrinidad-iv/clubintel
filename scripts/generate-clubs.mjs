#!/usr/bin/env node
// Generates supabase/seeds/clubs.sql: fictional leagues, clubs and five seasons of history.
// Deterministic (fixed PRNG seed), so the same data comes out every time.
//   node scripts/generate-clubs.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../supabase/seeds/clubs.sql", import.meta.url));
const SEASONS = [2021, 2022, 2023, 2024, 2025];

// mulberry32
let state = 0x5eed2026;
function random() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const uuid = () => {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = "89ab"[Math.floor(random() * 4)];
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
};

const LEAGUES = [
  { id: "premier-division", name: "Demo Premier Division", tier: 1, capacity: [24000, 62000] },
  { id: "championship", name: "Demo Championship", tier: 2, capacity: [14000, 34000] },
  { id: "league-one", name: "Demo League One", tier: 3, capacity: [7000, 19000] },
  { id: "league-two-north", name: "Demo League Two North", tier: 4, capacity: [3000, 10000] },
  { id: "league-two-south", name: "Demo League Two South", tier: 4, capacity: [3000, 10000] },
];

// [league, region, town, suffix, stadium]. Every name is invented.
const CLUBS = [
  ["premier-division", "england-north", "Northbridge", "Athletic", "Ironside Park"],
  ["premier-division", "england-north", "Kestrelby", "United", "The Mill Ground"],
  ["premier-division", "england-midlands", "Hollowmere", "City", "Lantern Road"],
  ["premier-division", "england-south", "Saltcombe Vale", "Rovers", "Harbourview"],
  ["premier-division", "england-south", "Wrenfield", "Albion", "Copper Lane"],
  ["premier-division", "scotland", "Glenmarrow", "Thistle", "Heatherbank Park"],
  ["premier-division", "england-midlands", "Brackenford", "Town", "The Kilnworks"],
  ["premier-division", "ireland", "Ballymorrow", "Rovers", "Riverstone Park"],
  ["premier-division", "england-north", "Fellhaven", "Wanderers", "Moorside"],
  ["premier-division", "wales", "Caerwen", "City", "Stad y Bryn"],
  ["championship", "england-south", "Ashmarket", "Town", "Market Fields"],
  ["championship", "england-north", "Thornwick", "Rovers", "Quarry Lane"],
  ["championship", "england-midlands", "Ellsbury Cross", "United", "Canalside"],
  ["championship", "scotland", "Duncarrow", "Athletic", "Pinewood Park"],
  ["championship", "northern-ireland", "Lisnagarry", "Celtic", "Bridge Street"],
  ["championship", "england-south", "Penhallow", "Argyle", "The Cliff Ground"],
  ["championship", "england-north", "Stannerby", "City", "Coalyard Road"],
  ["championship", "wales", "Llanferrow", "Town", "Parc yr Afon"],
  ["championship", "england-midlands", "Oakhollow", "Forest", "Acorn Park"],
  ["championship", "ireland", "Kilbrannagh", "Harps", "Shannonside"],
  ["league-one", "england-north", "Cragmoor", "Town", "Fellgate"],
  ["league-one", "england-south", "Marlowick", "Albion", "Chalk Lane"],
  ["league-one", "scotland", "Inverbrack", "Caley", "Firth Park"],
  ["league-one", "england-midlands", "Wyncastle", "Rangers", "The Keep"],
  ["league-one", "northern-ireland", "Drumcorran", "Swifts", "Linen Park"],
  ["league-one", "england-south", "Fenhallow", "United", "Reedbed Ground"],
  ["league-one", "wales", "Pontyrhew", "Athletic", "Heol Las"],
  ["league-one", "england-north", "Harrowgill", "Rovers", "Beck Road"],
  ["league-one", "ireland", "Carrigdown", "Celtic", "The Strand"],
  ["league-one", "england-midlands", "Coldmarsh", "City", "Saltway"],
  ["league-two-north", "england-north", "Whinstone", "Town", "Shepherd's Field"],
  ["league-two-north", "scotland", "Auchterbray", "Thistle", "Glebe Park"],
  ["league-two-north", "northern-ireland", "Ballykeel", "Rangers", "Mourneview"],
  ["league-two-north", "england-north", "Scarbeck", "United", "Lighthouse Lane"],
  ["league-two-north", "england-midlands", "Hatherby", "Wanderers", "Old Forge"],
  ["league-two-north", "scotland", "Kilmuren", "Athletic", "Loch Road"],
  ["league-two-south", "england-south", "Dunsmere", "Town", "Watermeadow"],
  ["league-two-south", "wales", "Abercoed", "Town", "Maes y Dref"],
  ["league-two-south", "england-south", "Brightwell Sands", "FC", "The Dunes"],
  ["league-two-south", "ireland", "Rathcorrig", "United", "Abbey Park"],
  ["league-two-south", "england-midlands", "Stoneleigh Cross", "Rovers", "Pound Lane"],
  ["league-two-south", "england-south", "Tollhaven", "Athletic", "Gatehouse"],
];

const sql = (value) => (value === null ? "null" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`);
const row = (values) => `  (${values.map(sql).join(", ")})`;
const shortName = (town) =>
  town.includes(" ") ? town.split(" ").map((w) => w[0]).join("").toUpperCase() : town.slice(0, 3).toUpperCase();

const leagueById = Object.fromEntries(LEAGUES.map((l) => [l.id, l]));
const clubs = CLUBS.map(([leagueId, region, town, suffix, stadium]) => {
  const [min, max] = leagueById[leagueId].capacity;
  const capacity = Math.round(between(min, max) / 100) * 100;
  return {
    id: uuid(),
    name: `${town} ${suffix}`,
    shortName: shortName(town),
    leagueId,
    region,
    city: town,
    stadium,
    founded: between(1867, 1965),
    // Grew into the current ground over the five seasons, or stayed the same.
    startCapacity: random() < 0.3 ? Math.round((capacity * (0.8 + random() * 0.15)) / 100) * 100 : capacity,
    capacity,
    // How full the ground tends to be, and whether that's rising or falling.
    fill: 0.55 + random() * 0.35,
    trend: (random() - 0.45) * 0.04,
  };
});

const seasons = [];
for (const league of LEAGUES) {
  const members = clubs.filter((c) => c.leagueId === league.id);
  for (const [i, season] of SEASONS.entries()) {
    shuffle(members).forEach((club, index) => {
      const capacity = Math.round(club.startCapacity + ((club.capacity - club.startCapacity) * i) / (SEASONS.length - 1));
      const fill = Math.min(0.99, Math.max(0.35, club.fill + club.trend * i + (random() - 0.5) * 0.06));
      seasons.push({ clubId: club.id, season, leagueId: league.id, position: index + 1, attendance: Math.round(capacity * fill), capacity });
    });
  }
}

const out = `-- Generated by scripts/generate-clubs.mjs. Don't edit by hand: change the script and run it again.
-- Fictional leagues and clubs. Any resemblance to real clubs is a coincidence.

insert into public.leagues (id, name, tier) values
${LEAGUES.map((l) => row([l.id, l.name, l.tier])).join(",\n")};

insert into public.clubs (id, name, short_name, league_id, region, city, stadium, capacity, founded) values
${clubs.map((c) => row([c.id, c.name, c.shortName, c.leagueId, c.region, c.city, c.stadium, c.capacity, c.founded])).join(",\n")};

insert into public.club_seasons (club_id, season, league_id, league_position, avg_attendance, capacity) values
${seasons.map((s) => row([s.clubId, s.season, s.leagueId, s.position, s.attendance, s.capacity])).join(",\n")};
`;

writeFileSync(OUT, out);
console.log(`Wrote ${LEAGUES.length} leagues, ${clubs.length} clubs and ${seasons.length} seasons to ${OUT}`);
