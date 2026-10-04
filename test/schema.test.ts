import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { MIGRATIONS, sqlStatements } from "../worker/migrate";

it("finds every migration file in order", () => {
  expect(MIGRATIONS.map((m) => m.name)).toEqual(["0001_init.sql", "0002_idea_details_and_vetoes.sql"]);
});

it("splits the first schema into idempotent statements", () => {
  const stmts = sqlStatements(readFileSync("migrations/0001_init.sql", "utf8"));
  expect(stmts).toHaveLength(11);
  for (const s of stmts) expect(s).toMatch(/^(CREATE (TABLE|INDEX) IF NOT EXISTS|INSERT OR IGNORE)/);
});
