import { readFile, writeFile } from "node:fs/promises";
import { extractArticle, slugify, uniqueId } from "../src/lib/article";
import type { ContentItem } from "../src/lib/types";

const CONTENT_FILE = "content/index.json";
/** ElevenLabs free plan: ~10k characters per month. Warn past this. */
const FREE_QUOTA_CHARS = 10_000;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    fail('Usage: npm run fetch -- <url>\n  e.g. npm run fetch -- "https://blog.example/wpis"');
  }
  try {
    new URL(url);
  } catch {
    fail(`Invalid URL: ${url}`);
  }

  console.log(`Fetching ${url} …`);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (voice-reading article importer)" },
  }).catch((err) => fail(`Could not fetch the page: ${err.message}`));
  if (!res.ok) fail(`Could not fetch the page: HTTP ${res.status}`);
  const html = await res.text();

  let title: string;
  let text: string;
  try {
    ({ title, text } = extractArticle(html, url));
  } catch (err) {
    fail((err as Error).message);
  }

  const raw = await readFile(CONTENT_FILE, "utf8");
  const content = JSON.parse(raw) as { exercises: ContentItem[] };
  const existingIds = content.exercises.map((e) => e.id);
  const id = uniqueId(`art-${slugify(title)}`, existingIds);

  const entry: ContentItem = { id, title, category: "article", url, text };
  content.exercises.push(entry);
  await writeFile(CONTENT_FILE, JSON.stringify(content, null, 2) + "\n");

  console.log(`\nAdded "${title}"`);
  console.log(`  id:    ${id}`);
  console.log(`  chars: ${text.length}`);
  if (text.length > FREE_QUOTA_CHARS) {
    console.warn(
      `  ⚠ ${text.length} chars exceeds the ~${FREE_QUOTA_CHARS}-char/month free ElevenLabs quota.\n` +
        `    Consider trimming the "text" of "${id}" in ${CONTENT_FILE} before generating.`,
    );
  }
  console.log(
    `\nReview/edit the text in ${CONTENT_FILE}, then run:\n  npm run generate`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
