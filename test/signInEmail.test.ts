import { describe, expect, it } from "vitest";
import { signInEmail } from "../worker/signInEmail";

describe("sign-in email", () => {
  const link = "https://somewhere.party/api/auth/verify?token=abc&x=1";
  const mail = signInEmail({ link, email: "a<b>@example.com", minutes: 20 });

  it("puts the link in the button and the copy box, escaped", () => {
    expect(mail.html.match(/href="https:\/\/somewhere\.party\/api\/auth\/verify\?token=abc&amp;x=1"/g)).toHaveLength(2);
    expect(mail.text).toContain(link);
  });

  it("says how long the link lasts", () => {
    expect(mail.html).toContain("runs out in 20 minutes");
    expect(mail.text).toContain("runs out in 20 minutes");
  });

  it("escapes the address in the footer", () => {
    expect(mail.html).toContain("a&lt;b&gt;@example.com");
    expect(mail.html).not.toContain("a<b>@");
  });
});
