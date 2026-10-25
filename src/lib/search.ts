// A substring pattern for ilike. LIKE wildcards are escaped so a search for "100%" means the
// text. PostgREST also reads `*` as a wildcard and has no escape for it; names never need one,
// so it's dropped.
export function likePattern(q: string) {
  return `%${q.replaceAll("*", "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
