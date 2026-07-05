// @vitest-environment node
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import {
  chunkText,
  extractArticle,
  normalizeText,
  slugify,
  stripBoilerplate,
  trimBoilerplateText,
  uniqueId,
} from "./article";

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

describe("trimBoilerplateText", () => {
  // długi korpus, żeby marker w ostatnich 40% wyzwolił obcięcie
  const body =
    "Sen jest jedną z najważniejszych potrzeb organizmu. " +
    "W trakcie snu mózg porządkuje wspomnienia i utrwala wiedzę. " +
    "Dorosły człowiek powinien spać od siedmiu do dziewięciu godzin. " +
    "Regularny rytm snu pomaga zachować zdrowie przez długie lata.";

  it("cuts the tail from 'Literatura' onward", () => {
    const input = `${body} Literatura Walker M. Dlaczego śpimy. Marginesy 2017.`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("cuts the tail from 'Tagi:' onward", () => {
    const input = `${body} Tagi: sen, mózg, zdrowie`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("cuts the tail from 'Bibliografia' onward", () => {
    const input = `${body} Bibliografia Kalat J.W. Biologiczne podstawy psychologii.`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("removes a 'Przeczytaj też:' sentence", () => {
    const input = `${body} Przeczytaj też: Mózg a emocje. ${body}`;
    expect(trimBoilerplateText(input)).toBe(`${body} ${body}`);
  });

  it("removes a leading 'Przewidywany czas' prefix", () => {
    const input = `Przewidywany czas: 5 min ${body}`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("does NOT cut when the marker word appears early in the text", () => {
    const input = `Literatura piękna bywa tematem snu. ${body}`;
    expect(trimBoilerplateText(input)).toBe(input);
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

  const dirtyHtml = `<!DOCTYPE html><html><head><title>Po co nam sen — Nauka To Lubię</title></head>
  <body>
    <article>
      <div class="ntl-reading-time">Przewidywany czas: 5 min</div>
      <h1>Po co nam sen</h1>
      <div id="ez-toc-container" class="ez-toc-container-direction"><p>Spis treści</p><ul><li>Co to jest sen?</li><li>Po co nam sen?</li></ul></div>
      <p>Sen jest jedną z najważniejszych potrzeb naszego organizmu i pełni wiele kluczowych funkcji. W trakcie snu mózg porządkuje wspomnienia z całego dnia oraz utrwala nowo zdobytą wiedzę i umiejętności.</p>
      <p>Brak odpowiedniej ilości snu prowadzi do problemów z koncentracją oraz osłabienia odporności. Dorosły człowiek powinien spać od siedmiu do dziewięciu godzin na dobę, aby zachować zdrowie fizyczne i psychiczne.</p>
      <p><strong>Literatura</strong> Walker M. Dlaczego śpimy. Marginesy 2017. Kalat J.W. Biologiczne podstawy psychologii. PWN 2020.</p>
      <div class="ntl-authorbox">Autor Joanna Śliwowska — z wykształcenia biolog.</div>
    </article>
  </body></html>`;

  it("strips reading-time, TOC, bibliography and author box", () => {
    const { text } = extractArticle(dirtyHtml, "https://naukatolubie.pl/po-co-nam-sen/");
    expect(text).toContain("Sen jest jedną z najważniejszych potrzeb");
    expect(text).toContain("siedmiu do dziewięciu godzin");
    expect(text).not.toContain("Przewidywany czas");
    expect(text).not.toContain("Spis treści");
    expect(text).not.toContain("Walker M.");
    expect(text).not.toContain("Joanna Śliwowska");
  });
});

describe("stripBoilerplate", () => {
  it("removes TOC, reading-time and author-box elements, keeps the article", () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div class="ntl-reading-time">Przewidywany czas: 5 min</div>
      <div id="ez-toc-container" class="ez-toc-container-direction">
        <p>Spis treści</p><ul><li>Co to jest sen?</li></ul>
      </div>
      <article><p>Treść artykułu o śnie.</p></article>
      <div class="ntl-authorbox">Autor Joanna Śliwowska — biolog.</div>
    </body></html>`);
    stripBoilerplate(dom.window.document);
    const html = dom.window.document.body.innerHTML;
    expect(html).toContain("Treść artykułu o śnie.");
    expect(html).not.toContain("Spis treści");
    expect(html).not.toContain("Przewidywany czas");
    expect(html).not.toContain("Joanna Śliwowska");
  });

  it("removes a multi-sentence 'Przeczytaj też' callout paragraph at DOM level", () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <p>Treść artykułu o śnie i jego fazach.</p>
      <p>Przeczytaj też: <a href="#">Mózg a emocje. Na tropach neurobiologii agresji i empatii</a></p>
    </body></html>`);
    stripBoilerplate(dom.window.document);
    const textContent = dom.window.document.body.textContent ?? "";
    expect(textContent).toContain("Treść artykułu o śnie");
    expect(textContent).not.toContain("Przeczytaj też");
    expect(textContent).not.toContain("Mózg a emocje");
    expect(textContent).not.toContain("Na tropach neurobiologii");
  });
});

describe("chunkText", () => {
  it("returns the text unchanged when it fits", () => {
    expect(chunkText("Krótkie zdanie.", 9000)).toEqual(["Krótkie zdanie."]);
  });

  it("splits at sentence boundaries and never exceeds the cap", () => {
    const text = Array.from({ length: 20 }, (_, i) => `To jest zdanie numer ${i + 1}.`).join(" ");
    const chunks = chunkText(text, 60);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(60);
    // No content lost: rejoining reproduces the original (single-spaced) text.
    expect(chunks.join(" ")).toBe(text);
    // No sentence broken: every chunk ends on a sentence terminator.
    for (const c of chunks) expect(c).toMatch(/[.?!]$/);
  });

  it("word-splits a single sentence longer than the cap", () => {
    const longSentence = Array.from({ length: 40 }, () => "slowo").join(" ") + ".";
    const chunks = chunkText(longSentence, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
    expect(chunks.join(" ")).toBe(longSentence);
  });
});
