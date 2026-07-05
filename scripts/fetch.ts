import "dotenv/config";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
  buildArticleParts,
  chunkText,
  extractArticle,
  slugify,
  uniqueId,
  uniquePartBase,
} from "../src/lib/article";
import { generateLibrary, requireElevenLabsEnv } from "./generate";
import type { ContentItem } from "../src/lib/types";

const CONTENT_FILE = "content/index.json";

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function git(args: string[]) {
  console.log(`$ git ${args.join(" ")}`);
  execFileSync("git", args, { stdio: "inherit" });
}

async function main() {
  const args = process.argv.slice(2);
  const noCommit = args.includes("--no-commit");
  const noPush = args.includes("--no-push");
  const url = args.find((a) => !a.startsWith("--"));

  if (!url) {
    fail(
      'Usage: npm run fetch -- <url> [--no-push] [--no-commit]\n' +
        '  e.g. npm run fetch -- "https://blog.example/wpis"',
    );
  }
  try {
    new URL(url);
  } catch {
    fail(`Invalid URL: ${url}`);
  }
  // Fail fast before any network work if the audio credentials are missing.
  requireElevenLabsEnv();

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
  const chunks = chunkText(text);
  const slugBase = `art-${slugify(title)}`;
  const baseId =
    chunks.length === 1
      ? uniqueId(slugBase, existingIds)
      : uniquePartBase(slugBase, chunks.length, existingIds);
  const parts = buildArticleParts(baseId, title, chunks);

  for (const p of parts) {
    content.exercises.push({ ...p, category: "article", url });
  }
  await writeFile(CONTENT_FILE, JSON.stringify(content, null, 2) + "\n");
  if (parts.length === 1) {
    console.log(`Added "${title}" (id: ${baseId}, ${text.length} chars).`);
  } else {
    console.log(
      `Added "${title}" as ${parts.length} parts (${text.length} chars total).`,
    );
  }

  console.log(`\nGenerating audio…`);
  const partIds = parts.map((p) => p.id);
  const result = await generateLibrary({ onlyIds: partIds });
  if (result.failed > 0) {
    fail(
      `Audio generation failed for "${title}" (likely ElevenLabs quota).\n` +
        `  The entr${parts.length === 1 ? "y stays" : "ies stay"} in ${CONTENT_FILE}. ` +
        `Wait for quota, then run:\n` +
        `    npm run generate -- ${partIds.join(" ")}\n` +
        `  Nothing was committed.`,
    );
  }

  if (noCommit) {
    console.log("\nDone (skipped commit). Review, then commit when ready.");
    return;
  }

  console.log("");
  git(["add", CONTENT_FILE, "public/library"]);
  git(["commit", "-m", `content: import article "${title}"`]);
  if (!noPush) git(["push"]);

  console.log(`\n✓ Imported "${title}"${noPush ? " (committed, not pushed)" : " and pushed"}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
