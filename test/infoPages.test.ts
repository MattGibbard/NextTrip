import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { INFO_PAGES, headTags, publicPage } from "../shared/seo";
import { INFO, infoJsonLd, plainText, readInfo } from "../src/infoPages";
import { RichText, anchor } from "../src/views/InfoPage";

describe("content pages", () => {
  it("have their own addresses", () => {
    expect(publicPage("/about")).toBe("about");
    expect(publicPage("/faq/")).toBe("faq");
    expect(publicPage("/contact")).toBe("contact");
    expect(publicPage("/how-we-make-money")).toBe("money");
    expect(publicPage("/how-to-decide-where-to-go-on-holiday")).toBe("decide");
    expect(publicPage("/about/us")).toBeNull();
  });

  it("all have words in the editor's files", () => {
    for (const page of Object.keys(INFO_PAGES) as (keyof typeof INFO_PAGES)[]) {
      expect(INFO[page].hero.heading, page).not.toBe("");
      expect(INFO[page].seo_title, page).not.toBe("");
    }
  });

  it("drop empty parts and unsafe links rather than breaking", () => {
    const c = readInfo({ hero: { heading: "Hi", button_label: "Go", button_url: "javascript:alert(1)" }, sections: [{}], faqs: { items: [{ question: "Q?" }] } });
    expect(c.hero.button_label).toBe("");
    expect(c.sections).toEqual([]);
    expect(c.faqs.items).toEqual([]);
  });

  it("turn editor text into paragraphs, lists, bold and safe links", () => {
    const html = renderToString(createElement(RichText, { text: "Hello **there**, see [the FAQ](/faq).\n\nThings:\n- one\n- [bad](javascript:alert(1)) two" }));
    expect(html).toContain("<strong>there</strong>");
    expect(html).toContain('<a href="/faq">the FAQ</a>');
    expect(html).toContain("<ul><li>one</li>");
    expect(html).not.toContain("javascript");
  });

  it("give search engines the questions and the guide", () => {
    const types = infoJsonLd("decide", "2026-10-11").map((d) => (d as { "@type": string })["@type"]);
    expect(types).toEqual(["Article", "FAQPage"]);
    expect(infoJsonLd("about")).toEqual([]);
    expect(plainText("See **this** and [that](/faq).\n- item")).toBe("See this and that. item");
    expect(headTags("faq", { jsonLd: infoJsonLd("faq") })).toContain('"@type":"FAQPage"');
  });

  it("make jump links from headings", () => {
    expect(anchor("1. Collect everyone's ideas in one place")).toBe("collect-everyone-s-ideas-in-one-place");
  });
});
