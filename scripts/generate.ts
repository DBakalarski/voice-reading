import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildExercise } from "../src/lib/exercise";
import type { Alignment, LibraryIndex } from "../src/lib/types";

interface ContentItem {
  id: string;
  title: string;
  level: number;
  text: string;
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!apiKey || !voiceId) {
  console.error("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in .env");
  process.exit(1);
}

const client = new ElevenLabsClient({ apiKey });
const OUT_DIR = "public/library";

async function main() {
  const raw = await readFile("content/index.json", "utf8");
  const { exercises } = JSON.parse(raw) as { exercises: ContentItem[] };
  await mkdir(OUT_DIR, { recursive: true });

  const summaries: LibraryIndex["exercises"] = [];

  for (const item of exercises) {
    console.log(`Generating "${item.id}"...`);
    const res = await client.textToSpeech.convertWithTimestamps(voiceId!, {
      text: item.text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    const audioBuffer = Buffer.from(res.audioBase64 as string, "base64");
    await writeFile(`${OUT_DIR}/${item.id}.mp3`, audioBuffer);

    const alignment = res.alignment as unknown as Alignment;
    const exercise = buildExercise(item.id, item.title, alignment);
    await writeFile(`${OUT_DIR}/${item.id}.json`, JSON.stringify(exercise, null, 2));

    summaries.push({ id: item.id, title: item.title, level: item.level });
  }

  const index: LibraryIndex = { exercises: summaries };
  await writeFile(`${OUT_DIR}/index.json`, JSON.stringify(index, null, 2));
  console.log(`Done. ${summaries.length} exercises written to ${OUT_DIR}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
