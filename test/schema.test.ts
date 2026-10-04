import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { schemaStatements } from "../worker/index";

it("splits the schema into idempotent statements", () => {
  const stmts = schemaStatements(readFileSync("migrations/0001_init.sql", "utf8"));
  expect(stmts).toHaveLength(11);
  for (const s of stmts) expect(s).toMatch(/^(CREATE (TABLE|INDEX) IF NOT EXISTS|INSERT OR IGNORE)/);
});
