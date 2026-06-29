# voice-reading

PWA do rehabilitacji słuchowej dla osób z implantem ślimakowym: odtwarza wcześniej
wygenerowaną mowę (ElevenLabs) i podświetla czytane słowo oraz frazę. Aplikacja w
przeglądarce nigdy nie woła API — odtwarza tylko gotowe pliki z `public/library`.

## Rozwój

```bash
npm install
npm run dev      # serwer deweloperski
npm test         # testy (Vitest)
npm run build    # statyczny eksport do out/
```

## Dodawanie treści

Treści żyją w `content/index.json`. Każdy wpis ma `id`, `title`, `text` oraz
`level` (1–3) dla ćwiczeń, albo `category: "article"` dla artykułów z internetu.

### Ręczne ćwiczenie

Dodaj wpis z `level` i `text`, a następnie wygeneruj audio (poniżej).

### Import artykułu z linku (wszystko jednym poleceniem)

```bash
# .env: ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID
npm run fetch -- "https://adres-artykulu"
```

Jedno polecenie robi całość: pobiera stronę, wyciąga główną treść (Readability),
nadaje `id`, ustawia `category: "article"`, dopisuje wpis do `content/index.json`,
**generuje audio + alignment**, a następnie **commituje i pushuje**.

Flagi:

```bash
npm run fetch -- "<url>" --no-push     # zatrzymaj się na commicie
npm run fetch -- "<url>" --no-commit   # tylko pobierz + wygeneruj (do podglądu)
```

Jeśli generacja padnie (np. limit ElevenLabs), wpis zostaje w `content/index.json`,
a skrypt NIC nie commituje — przytnij `text` lub poczekaj na limit i dokończ przez
`npm run generate -- <id>`.

Artykuły pojawiają się w osobnej karcie „Artykuły" na ekranie głównym (widocznej
tylko gdy istnieje co najmniej jeden artykuł).

### Generowanie audio

```bash
# .env: ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID
npm run generate                 # tylko nowe/zmienione pozycje (oszczędza limit)
npm run generate -- art-po-co-nam-sen   # tylko wskazane id
npm run generate -- --force      # wymuś regenerację wszystkiego
git add content public/library && git commit && git push
```

`npm run generate` jest **przyrostowy**: pomija pozycje, których audio już istnieje
i których tekst się nie zmienił (odcisk tekstu trzymany w
`public/library/.manifest.json`). Generuje tylko nowe wpisy albo te, w których
zmieniłeś `text`. Błąd jednej pozycji (np. przekroczony limit ElevenLabs) nie
przerywa reszty — reszta się zapisze, a wadliwa pozycja po prostu nie trafi do
biblioteki.

Zapisuje `public/library/<id>.mp3`, `<id>.json` oraz `index.json`. Vercel buduje
statyczny eksport po pushu — audio jest w repo, więc nie trzeba zmiennych
środowiskowych w hostingu.
