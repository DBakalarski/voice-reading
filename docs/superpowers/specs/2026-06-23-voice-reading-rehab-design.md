# Voice Reading — aplikacja do rehabilitacji słuchowej z implantem ślimakowym

**Data:** 2026-06-23
**Status:** Design zaakceptowany, gotowy do planu implementacji

## Cel

PWA wspierająca samodzielny trening słuchowy użytkownika implantu ślimakowego.
Aplikacja odtwarza wygenerowany głos (ElevenLabs) i synchronicznie podświetla
tekst — słowo po słowie, z dodatkowym wyróżnieniem aktualnej frazy. Łączenie
sygnału słuchowego ze wzrokowym jest klasycznym elementem rehabilitacji słuchu.

## Decyzje (z brainstormingu)

- **Odbiorca / scenariusz:** samodzielny trening użytkownika implantu (nie terapeuta, nie opiekun dziecka).
- **Źródło tekstu:** gotowa biblioteka **+** (w przyszłości) własny tekst użytkownika. W v1 tylko gotowa biblioteka.
- **Podświetlanie:** słowo po słowie **plus** wyróżnienie całej aktualnej frazy (dwa poziomy).
- **ElevenLabs / klucz API:** w v1 **tylko prewygenerowane audio**. Generowanie na żywo i własny tekst odłożone na później. Pełne działanie offline.
- **Sterowanie odtwarzaniem (v1):** tylko podstawy — **play/pauza**. Brak regulacji tempa, powtarzania fraz, nawigacji po słowach, trybu „najpierw posłuchaj".
- **Język:** polski (model `eleven_multilingual_v2`).
- **Zawartość startowa:** 2–3 przykładowe teksty (techniczne MVP — udowodnić, że audio + podświetlanie słów działa). Stopniowane poziomy trudności i większa biblioteka — później.
- **Stos:** Next.js (statyczny eksport) + warstwa PWA.

## Architektura ogólna

Dwie wyraźnie oddzielone części:

### 1. Generator biblioteki (build-time, Node, uruchamiany ręcznie)

`scripts/generate.ts`:
- czyta treści źródłowe z `content/index.json`,
- woła ElevenLabs `convertWithTimestamps` (model multilingual, głos polski),
- otrzymuje audio (base64) + `alignment` na poziomie znaków,
- agreguje znaki → słowa → frazy,
- zapisuje `public/library/<id>.mp3` oraz `public/library/<id>.json`,
- aktualizuje `public/library/index.json` (lista ćwiczeń).

Klucz API ElevenLabs żyje **wyłącznie** w `.env` na maszynie dewelopera — nigdy
nie trafia do kodu aplikacji ani do zbudowanych zasobów.

### 2. Aplikacja PWA (Next.js, statyczny eksport)

Ładuje `index.json` (lista ćwiczeń) oraz, dla wybranego ćwiczenia, `mp3` + `json`.
Odtwarza audio i w trakcie podświetla aktualne słowo i frazę. Service worker
cache'uje zasoby → działa offline po pierwszym otwarciu.

**Kluczowa zasada izolacji:** aplikacja nigdy nie komunikuje się z ElevenLabs —
jest wyłącznie odtwarzaczem gotowych statycznych zasobów.

## Model danych

Jeden plik `public/library/<id>.json` na ćwiczenie:

```json
{
  "id": "powitanie",
  "title": "Codzienne powitania",
  "audio": "/library/powitanie.mp3",
  "words": [
    { "text": "Dzień",  "start": 0.00, "end": 0.42, "phrase": 0 },
    { "text": "dobry",  "start": 0.42, "end": 0.88, "phrase": 0 },
    { "text": "jak",    "start": 1.10, "end": 1.30, "phrase": 1 },
    { "text": "się",    "start": 1.30, "end": 1.48, "phrase": 1 },
    { "text": "masz",   "start": 1.48, "end": 1.90, "phrase": 1 }
  ],
  "phrases": [
    { "index": 0, "text": "Dzień dobry.",  "start": 0.00, "end": 0.88 },
    { "index": 1, "text": "Jak się masz?", "start": 1.10, "end": 1.90 }
  ]
}
```

- `words` — słowa z czasem `start`/`end` (sekundy) i przynależnością do frazy (`phrase`).
- `phrases` — granice fraz (do podświetlania całej aktualnej frazy).
- Podział na frazy: po znakach `.`, `?`, `!`. (Dodatkowy podział po przecinku — możliwe rozszerzenie, poza v1.)
- Interpunkcja doklejana do poprzedniego słowa (nie „miga" jako osobny element).

`public/library/index.json`:

```json
{
  "exercises": [
    { "id": "powitanie", "title": "Codzienne powitania" }
  ]
}
```

## Generator biblioteki — szczegóły

`scripts/generate.ts` (`npm run generate`):

1. Wczytuje `content/index.json` — lista `{ id, title, text }`.
2. Dla każdej pozycji woła:
   ```ts
   const res = await client.textToSpeech.convertWithTimestamps(VOICE_ID, {
     text,
     modelId: "eleven_multilingual_v2",
     outputFormat: "mp3_44100_128",
   });
   ```
   - `res.audio` (base64) → dekodowanie → `public/library/<id>.mp3`,
   - `res.alignment` → `{ characters, characterStartTimesSeconds, characterEndTimesSeconds }`.
3. **Agregacja znaki → słowa:** iteracja po znakach; spacja / koniec tekstu = granica słowa. `start` = czas pierwszego znaku słowa, `end` = czas ostatniego. Interpunkcja doklejana do słowa.
4. **Agregacja słowa → frazy:** nowa fraza po słowie kończącym się na `.`, `?`, `!`. Każde słowo dostaje `phrase` = indeks frazy.
5. Zapis `public/library/<id>.json` + dopisanie wpisu do `public/library/index.json`.
6. Konfiguracja: `ELEVENLABS_API_KEY`, `VOICE_ID` z `.env` (w `.gitignore`); dostarczony `.env.example`.

Skrypt idempotentny — ponowne uruchomienie nadpisuje pliki.

## Komponenty i interfejs aplikacji

### Ekrany / komponenty

1. **Lista ćwiczeń (`/`)** — czyta `index.json`, pokazuje listę ćwiczeń (tytuł); klik → odtwarzacz.
2. **Odtwarzacz (`/exercise/[id]`):**
   - duży, czytelny tekst ćwiczenia (duża czcionka, duży odstęp między wierszami),
   - pojedynczy przycisk **play/pauza**,
   - pasek postępu audio (nieinteraktywny w v1 — bez przewijania),
   - ukryty element `<audio>` sterowany przyciskiem.
3. **`HighlightedText`** — renderuje tekst jako sekwencję `<span>`-ów (jeden na słowo) pogrupowanych we frazy:
   - klasa `current-word` na aktywnym słowie (mocne wyróżnienie),
   - klasa `current-phrase` na słowach aktualnej frazy (delikatniejsze tło).

### Logika synchronizacji

`useAudioSync` — hook podpięty pod `<audio>`; używa `requestAnimationFrame`
(płynniej niż rzadkie `timeupdate` ~4×/s) do odczytu `currentTime` i zwraca
indeks aktualnego słowa oraz frazy. Jedyne miejsce z logiką synchronizacji —
odizolowane i testowalne.

### Wygląd

Prosty, wysoki kontrast, duża typografia, dwa poziomy podświetlenia wyraźnie
różne kolorystycznie. Bez zbędnych ozdobników.

## PWA / offline

- Next.js w trybie statycznego eksportu (`output: 'export'`) — bez serwera.
- Service worker przez **Serwist** (`@serwist/next`): precache plików aplikacji
  + cache `/library/*` (mp3 + json) strategią cache-first. Ćwiczenia działają
  offline po pierwszym otwarciu.
- `manifest.json` (nazwa, ikony, `display: standalone`) — instalowalność na telefonie/tablecie.

## Testy

- **Jednostkowe (Vitest)** — główne ryzyko błędów:
  - agregacja znaki → słowa → frazy w generatorze (na sztucznym `alignment`, bez wołania API),
  - `useAudioSync`: dla danego `currentTime` poprawny indeks słowa i frazy (granice przedziałów, przerwy między słowami, początek/koniec).
- **Komponent `HighlightedText`** (React Testing Library): właściwe słowo ma klasę `current-word`, słowa frazy mają `current-phrase`.
- **Bez E2E i bez testów wołających ElevenLabs** w v1 — generator testowany na zamockowanym `alignment`.

## Poza zakresem v1 (świadomie odłożone)

- Generowanie głosu na żywo i wklejanie własnego tekstu (wymaga backendu/proxy lub klucza po stronie użytkownika).
- Regulacja tempa, powtarzanie fraz, nawigacja klikiem w słowo, tryb „najpierw posłuchaj, potem pokaż tekst".
- Stopniowane poziomy trudności, większa biblioteka treści.
- Śledzenie postępów, konta użytkowników.
- Dodatkowy podział fraz po przecinku.

## Struktura projektu (orientacyjnie)

```
content/index.json            # teksty źródłowe { id, title, text }
scripts/generate.ts           # generator (ElevenLabs → statyczne zasoby)
public/library/index.json     # lista ćwiczeń
public/library/<id>.mp3        # audio
public/library/<id>.json       # tekst + czasy słów/fraz
public/manifest.json
src/app/                      # Next.js App Router: / oraz /exercise/[id]
src/components/HighlightedText.tsx
src/hooks/useAudioSync.ts
src/lib/alignment.ts          # agregacja znaki → słowa → frazy (testowalna)
.env.example
```
