import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { deleteFamilyStatements } from "../worker/auth";

function fakeDb() {
  const sql: string[] = [];
  const db = {
    prepare: (s: string) => {
      sql.push(s);
      return { bind: () => ({}) };
    },
  };
  return { db: db as unknown as D1Database, sql };
}

it("deletes from every table that belongs to a family, with the family row last", () => {
  const { db, sql } = fakeDb();
  deleteFamilyStatements(db, 5);
  const schema = readdirSync("migrations").map((f) => readFileSync(`migrations/${f}`, "utf8")).join("\n");
  const altered = [...schema.matchAll(/ALTER TABLE (\w+) ADD COLUMN family_id/g)].map((m) => m[1]);
  const created = schema
    .split("CREATE TABLE IF NOT EXISTS ")
    .slice(1)
    .filter((block) => /^\s*family_id /m.test(block.slice(0, block.indexOf(");"))))
    .map((block) => block.split(" ")[0]);
  const owned = [...altered, ...created];
  expect(owned).toEqual(expect.arrayContaining(["people", "trips", "ideas", "rounds", "family_settings", "sessions"]));
  for (const table of owned) expect(sql.some((s) => s.startsWith(`DELETE FROM ${table} `))).toBe(true);
  expect(sql.at(-1)).toBe("DELETE FROM families WHERE id = ?1");
  expect(sql).not.toContain("DELETE FROM settings");
});

it("also clears the old shared settings for family 1", () => {
  const { db, sql } = fakeDb();
  deleteFamilyStatements(db, 1);
  expect(sql).toContain("DELETE FROM settings");
});
