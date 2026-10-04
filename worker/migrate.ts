// Applies migrations/*.sql on first use, tracked in the same d1_migrations
// table that `wrangler d1 migrations apply` uses, so either route works.
const files = import.meta.glob("../migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const MIGRATIONS = Object.entries(files)
  .map(([path, sql]) => ({ name: path.split("/").pop()!, sql }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Statements from a migration file, without full-line comments. */
export function sqlStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function migrate(db: D1Database, migrations = MIGRATIONS) {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
    )
    .run();
  const { results } = await db.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
  const applied = new Set(results.map((r) => r.name));
  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    // One batch per file: D1 runs a batch as a transaction, so a file is applied fully or not at all.
    await db.batch([
      ...sqlStatements(m.sql).map((s) => db.prepare(s)),
      db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(m.name),
    ]);
  }
}
