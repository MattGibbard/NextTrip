import { DatabaseSync } from "node:sqlite";

/** Just enough of D1 on top of SQLite to run the Worker for real. */
export function sqliteD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const statement = (sql: string, params: unknown[] = []) => ({
    sql,
    params,
    bind: (...p: unknown[]) => statement(sql, p),
    async first<T>() {
      return (sqlite.prepare(sql).get(...(params as never[])) as T) ?? null;
    },
    async all<T>() {
      return { results: sqlite.prepare(sql).all(...(params as never[])) as T[], success: true, meta: {} };
    },
    async run() {
      return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...(params as never[])).changes) } };
    },
  });
  type Stmt = ReturnType<typeof statement>;
  return {
    prepare: (sql: string) => statement(sql),
    async batch(stmts: Stmt[]) {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) {
          const st = sqlite.prepare(s.sql);
          out.push(st.columns().length ? { results: st.all(...(s.params as never[])) } : { meta: { changes: Number(st.run(...(s.params as never[])).changes) } });
        }
        sqlite.exec("COMMIT");
        return out;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  } as unknown as D1Database;
}
