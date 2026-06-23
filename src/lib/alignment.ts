import type { Alignment, Phrase, Word } from "./types";

interface RawWord {
  text: string;
  start: number;
  end: number;
}

/** Group ElevenLabs per-character timings into whitespace-delimited words. */
export function groupCharsIntoWords(a: Alignment): RawWord[] {
  const words: RawWord[] = [];
  let current: { chars: string[]; start: number; end: number } | null = null;

  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    const isSpace = /\s/.test(ch);
    if (isSpace) {
      if (current) {
        words.push({ text: current.chars.join(""), start: current.start, end: current.end });
        current = null;
      }
      continue;
    }
    if (!current) {
      current = { chars: [ch], start: a.characterStartTimesSeconds[i], end: a.characterEndTimesSeconds[i] };
    } else {
      current.chars.push(ch);
      current.end = a.characterEndTimesSeconds[i];
    }
  }
  if (current) {
    words.push({ text: current.chars.join(""), start: current.start, end: current.end });
  }
  return words;
}

const PHRASE_END = /[.?!]$/;

/** Assign each word a phrase index (break after sentence-ending punctuation)
 *  and build the matching phrase ranges. */
export function assignPhrases(words: RawWord[]): { words: Word[]; phrases: Phrase[] } {
  const out: Word[] = [];
  const phrases: Phrase[] = [];
  let phraseIndex = 0;
  let phraseWords: string[] = [];
  let phraseStart: number | null = null;
  let phraseEnd = 0;

  const flush = () => {
    if (phraseWords.length === 0 || phraseStart === null) return;
    phrases.push({
      index: phraseIndex,
      text: phraseWords.join(" "),
      start: phraseStart,
      end: phraseEnd,
    });
    phraseIndex++;
    phraseWords = [];
    phraseStart = null;
  };

  for (const w of words) {
    if (phraseStart === null) phraseStart = w.start;
    phraseEnd = w.end;
    phraseWords.push(w.text);
    out.push({ text: w.text, start: w.start, end: w.end, phrase: phraseIndex });
    if (PHRASE_END.test(w.text)) flush();
  }
  flush();

  return { words: out, phrases };
}

/** Full pipeline: ElevenLabs alignment -> words + phrases. */
export function parseAlignment(a: Alignment): { words: Word[]; phrases: Phrase[] } {
  return assignPhrases(groupCharsIntoWords(a));
}
