# Czysta ekstrakcja artykułów (bez spisu treści, przypisów i reklam)

Data: 2026-06-29
Status: zatwierdzony do planowania

## Problem

Aplikacja służy do rehabilitacji słuchowej (implant ślimakowy) — teksty są
czytane na głos przez ElevenLabs i śledzone słowo po słowie. Obecny ekstraktor
(`extractArticle` → Mozilla Readability) wyciąga główną treść, ale zostawia
boilerplate, który przy słuchaniu jest czystym szumem:

- prefiks „Przewidywany czas: 5 min",
- „Spis treści" + lista pozycji (w tekście to run-on bez spacji:
  „Co to jest sen?Jakie mamy fazy snu?…"),
- callout „Przeczytaj też: …" (link do innego artykułu),
- „Literatura" + bibliografia z DOI,
- „Tagi:" oraz bio autora na końcu.

Widać to w dwóch zaimportowanych artykułach w `content/index.json`
(`art-po-co-nam-sen`, `art-akademia-cyfrowego-rodzica`).

## Cel

1. Przyszłe importy (`npm run fetch -- <url>`) dają czysty tekst.
2. Wyczyścić i ponownie wygenerować audio dla 2 istniejących artykułów.

Non-goals: uniwersalny czyszczący dla dowolnej strony świata. Celujemy w
naukatolubie.pl + generyczne wzorce WordPressa, z łatwo rozszerzalną listą.

## Podejście: hybryda (DOM + trim tekstu)

Sam DOM nie domknie bibliografii/tagów bez pewnych kontenerów; sam tekst nie
domknie spisu treści (run-on bez spacji). Dlatego dwa etapy.

### Etap 1 — `stripBoilerplate(document)` przed Readability

Nowa funkcja w `src/lib/article.ts`, wołana na `dom.window.document` zanim
powstanie `new Readability(...)`. Usuwa elementy pasujące do listy selektorów
trzymanej w nazwanej stałej `BOILERPLATE_SELECTORS`:

- `#ez-toc-container`, `.ez-toc-container-direction` — spis treści (plugin
  ez-toc, generyczny dla WordPressa),
- `.ntl-reading-time` — „Przewidywany czas",
- `.ntl-authorbox` — bio autora.

Każdy pasujący element jest usuwany (`el.remove()`). Brak dopasowań = no-op,
więc bezpieczne dla stron bez tych klas.

### Etap 2 — trim tekstu po ekstrakcji

Po `normalizeText` zastosować `trimBoilerplateText(text)`:

- **Obcięcie ogona:** znajdź pierwsze wystąpienie markera ogona
  (`Literatura`, `Bibliografia`, `Tagi:`) w **końcowej części** tekstu
  (ostatnie ~40% długości, żeby nie ciąć, gdy słowo padnie wcześnie w treści) i
  utnij wszystko od tego miejsca do końca.
- **Linia „Przeczytaj też":** usuń zdanie zaczynające się od `Przeczytaj też:`
  aż do końca zdania (kropka/koniec).
- **Prefiks czasu czytania:** usuń wiodące `Przewidywany czas: N min`
  (gdyby przeszło mimo etapu 1).

Markery dopasowywane bez rozróżniania wielkości liter, jako granice słów.

## Pliki

- `src/lib/article.ts` — `BOILERPLATE_SELECTORS`, `stripBoilerplate(document)`,
  `trimBoilerplateText(text)`; wpięcie obu w `extractArticle`. Eksport
  `trimBoilerplateText` na potrzeby testów jednostkowych.
- `src/lib/article.test.ts` — nowe przypadki (patrz Testy).
- `content/index.json` — zaktualizowany `text` dla 2 artykułów (retrofit).
- `public/library/<id>.*` — zregenerowane audio dla 2 artykułów.

## Testy (vitest, środowisko node)

1. `stripBoilerplate` usuwa `#ez-toc-container`, `.ntl-reading-time`,
   `.ntl-authorbox`; treść artykułu zostaje. Fixture HTML z tymi blokami.
2. `trimBoilerplateText`:
   - obcina od `Literatura` do końca,
   - obcina od `Tagi:` do końca,
   - usuwa linię `Przeczytaj też: …`,
   - usuwa prefiks `Przewidywany czas: 5 min`,
   - NIE obcina, gdy „literatura" pada wcześnie w treści (guard 40%).
3. `extractArticle` end-to-end na fixture z pełnym boilerplate → tekst bez
   śmieci, z zachowaną treścią. Istniejące testy `extractArticle` pozostają
   zielone.

## Retrofit istniejących artykułów

Dla `art-po-co-nam-sen` i `art-akademia-cyfrowego-rodzica`:

1. Pobrać stronę po `url`, przepuścić przez ulepszony `extractArticle`,
   podmienić `text` w `index.json` (zachować `id`/`title`/`url`).
2. Zregenerować audio: `npm run generate -- <id>` (ręczny krok ElevenLabs,
   wymaga `.env`).
3. Commit treści + audio.

Krok regeneracji jest ręczny (kwota ElevenLabs) — plan musi to wyróżnić jako
checkpoint dla użytkownika, nie zakładać automatu.

## Ryzyka

- Selektory `ntl-*` są specyficzne dla naukatolubie.pl — akceptowalne, bo to
  główne źródło; lista jest jawna i łatwa do rozszerzenia.
- Obcięcie ogona od markera jest agresywne; guard „ostatnie 40%" ogranicza
  fałszywe cięcia. Świadomy wybór użytkownika (prostota > ostrożność).
