import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildExercise } from "../src/lib/exercise";
import type { Alignment, ContentItem, LibraryIndex } from "../src/lib/types";

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!apiKey || !voiceId) {
  console.error("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in .env");
  process.exit(1);
}

const client = new ElevenLabsClient({ apiKey });
const OUT_DIR = "public/library";
const MANIFEST = `${OUT_DIR}/.manifest.json`;
const MODEL_ID = "eleven_multilingual_v2";

/** A short fingerprint of what determines the audio: voice, model and text. */
function fingerprint(text: string): string {
  return createHash("sha256")
    .update(`${voiceId}:${MODEL_ID}:${text}`)
    .digest("hex")
    .slice(0, 16);
}

async function readManifest(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlyIds = args.filter((a) => !a.startsWith("--"));

  const raw = await readFile("content/index.json", "utf8");
  const { exercises } = JSON.parse(raw) as { exercises: ContentItem[] };
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = await readManifest();

  const summaries: LibraryIndex["exercises"] = [];
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of exercises) {
    const mp3Path = `${OUT_DIR}/${item.id}.mp3`;
    const jsonPath = `${OUT_DIR}/${item.id}.json`;
    const filesExist = existsSync(mp3Path) && existsSync(jsonPath);

    if (!item.text) {
      console.warn(`Skipping "${item.id}": no text yet (run "npm run fetch" first?).`);
      continue;
    }

    const selected = onlyIds.length === 0 || onlyIds.includes(item.id);
    const hash = fingerprint(item.text);
    const known = manifest[item.id];

    // Decide whether to (re)generate. Goal: never spend quota on unchanged text.
    let needsGen: boolean;
    if (!selected) needsGen = false;
    else if (force) needsGen = true;
    else if (!filesExist) needsGen = true;
    else if (known === undefined) needsGen = false; // pre-existing audio: assume current
    else needsGen = known !== hash; // regenerate only when the text actually changed

    if (needsGen) {
      try {
        console.log(`Generating "${item.id}" (${item.text.length} chars)...`);
        const res = await client.textToSpeech.convertWithTimestamps(voiceId!, {
          text: item.text,
          modelId: MODEL_ID,
          outputFormat: "mp3_44100_128",
        });

        const audioBuffer = Buffer.from(res.audioBase64 as string, "base64");
        await writeFile(mp3Path, audioBuffer);

        const alignment = res.alignment as unknown as Alignment;
        const exercise = buildExercise(item.id, item.title, alignment);
        await writeFile(jsonPath, JSON.stringify(exercise, null, 2));

        manifest[item.id] = hash;
        generated++;
      } catch (err) {
        failed++;
        const detail =
          (err as { body?: { detail?: { message?: string } } }).body?.detail?.message ??
          (err as Error).message;
        console.error(`  ✗ Failed "${item.id}": ${detail}`);
        // Persist progress so a quota failure on one item never loses earlier work.
        await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
        continue; // skip from index; try the rest
      }
    } else {
      skipped++;
      if (!selected) {
        // not targeted this run; only keep in index if already built
      } else {
        console.log(`Up to date "${item.id}" — skipping.`);
        if (known === undefined && filesExist) manifest[item.id] = hash; // backfill
      }
    }

    if (existsSync(jsonPath) && existsSync(mp3Path)) {
      summaries.push({
        id: item.id,
        title: item.title,
        level: item.level,
        category: item.category ?? "exercise",
      });
    }
  }

  const index: LibraryIndex = { exercises: summaries };
  await writeFile(`${OUT_DIR}/index.json`, JSON.stringify(index, null, 2));
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(
    `\nDone. ${generated} generated, ${skipped} up-to-date, ${failed} failed. ` +
      `${summaries.length} exercises in ${OUT_DIR}/index.json.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
