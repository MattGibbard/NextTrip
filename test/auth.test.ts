import { expect, it } from "vitest";
import { normaliseEmail, randomToken, sha256 } from "../shared/auth";

it("tidies and checks email addresses", () => {
  expect(normaliseEmail("  Sam@Example.COM ")).toBe("sam@example.com");
  expect(normaliseEmail("not an email")).toBeNull();
  expect(normaliseEmail("a@b")).toBeNull();
  expect(normaliseEmail(42)).toBeNull();
});

it("makes URL-safe tokens that don't repeat", () => {
  const a = randomToken(32);
  expect(a).toMatch(/^[\w-]{43}$/);
  expect(randomToken(32)).not.toBe(a);
});

it("hashes to hex", async () => {
  expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
