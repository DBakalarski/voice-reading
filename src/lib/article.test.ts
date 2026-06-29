// @vitest-environment node
import { describe, it, expect } from "vitest";
import { extractArticle, normalizeText, slugify, uniqueId } from "./article";

describe("normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Zdanie   pierwsze.\n\nDrugie  zdanie. ")).toBe(
      "Zdanie pierwsze. Drugie zdanie.",
    );
  });

  it("removes spaces before punctuation", () => {
    expect(normalizeText("Tak , naprawdę .")).toBe("Tak, naprawdę.");
  });

  it("decodes HTML entities and non-breaking spaces", () => {
    expect(normalizeText("Po&nbsp;co&nbsp;nam sen?")).toBe("Po co nam sen?");
    expect(normalizeText("Kawa &amp; herbata &#8211; wyb&#243;r")).toBe(
      "Kawa & herbata – wybór",
    );
  });
});

describe("slugify", () => {
  it("transliterates Polish characters and dashes words", () => {
    expect(slugify("Po co nam sen?")).toBe("po-co-nam-sen");
    expect(slugify("Zażółć gęślą jaźń")).toBe("zazolc-gesla-jazn");
  });

  it("falls back to 'artykul' when empty", () => {
    expect(slugify("!!! ???")).toBe("artykul");
  });
});

describe("uniqueId", () => {
  it("returns the base when free", () => {
    expect(uniqueId("art-sen", ["l1-poranek"])).toBe("art-sen");
  });

  it("suffixes a counter on collision", () => {
    expect(uniqueId("art-sen", ["art-sen", "art-sen-2"])).toBe("art-sen-3");
  });
});

describe("extractArticle", () => {
  const html = `<!DOCTYPE html><html><head><title>Po co nam sen — Nauka To Lubię</title></head>
  <body>
    <nav>Menu Strona główna Kontakt Reklama</nav>
    <article>
      <h1>Po co nam sen</h1>
      <p>Sen jest jedną z najważniejszych potrzeb naszego organizmu i pełni wiele kluczowych funkcji. W trakcie snu mózg porządkuje wspomnienia z całego dnia oraz utrwala nowo zdobytą wiedzę i umiejętności.</p>
      <p>Brak odpowiedniej ilości snu prowadzi do problemów z koncentracją, pogorszenia nastroju oraz osłabienia odporności organizmu. Naukowcy podkreślają, że dorosły człowiek powinien spać od siedmiu do dziewięciu godzin na dobę.</p>
      <p>Regularny rytm snu pomaga zachować zdrowie fizyczne i psychiczne przez długie lata życia każdego z nas.</p>
    </article>
    <footer>Copyright 2026 Wszelkie prawa zastrzeżone</footer>
  </body></html>`;

  it("pulls the main text and a clean title, dropping nav and footer", () => {
    const { title, text } = extractArticle(html, "https://example.com/po-co-nam-sen/");
    expect(title.toLowerCase()).toContain("po co nam sen");
    expect(text).toContain("Sen jest jedną z najważniejszych potrzeb");
    expect(text).toContain("siedmiu do dziewięciu godzin");
    expect(text).not.toContain("Strona główna");
    expect(text).not.toContain("Wszelkie prawa zastrzeżone");
    // normalized: no double spaces or stray newlines
    expect(text).not.toMatch(/\s{2,}/);
  });

  it("throws a friendly error when there is no extractable content", () => {
    expect(() => extractArticle("<html><body></body></html>", "https://x.test")).toThrow(
      /tre/i,
    );
  });
});
