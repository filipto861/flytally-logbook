// Production SQL lives in tagged template literals (sql`...`). Tests that pull it
// out of the source text get the *raw* template, where `\\d` is still two
// characters. JavaScript cooks the template at runtime, so the query that actually
// reaches PostgreSQL contains `\d`. Without cooking, regexes such as '^\\d{4}-'
// silently never match (e.g. every date_key becomes NULL and period filters
// select nothing). Always pass extracted SQL through cookSql().
export function cookSql(raw:string):string{
  return raw.replace(/\\([\\`$])/g,"$1");
}
