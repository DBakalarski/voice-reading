# Własne teksty w aplikacji (Krok 6) — design

**Date:** 2026-07-23
**Status:** Draft — blocked on the decisions in "Open decisions" below

## Problem

Dodanie własnego tekstu wymaga dziś dostępu do komputera dewelopera: wpis w
`content/index.json`, `npm run fetch`, `npm run generate`, commit, deploy. Dla
rehabilitacji największą wartość mają teksty osobiste (wiadomości od rodziny,
ulubione tematy), a te powstają wtedy, kiedy nie ma pod ręką terminala.

`upgrade.md` (Krok 6) zakłada, że wymaga to backendu-proxy, „żeby klucz
ElevenLabs nigdy nie trafił do przeglądarki". To założenie okazało się niepełne —
patrz niżej.

## Ustalenie techniczne: ElevenLabs pozwala na wywołania z przeglądarki

Sprawdzone 2026-07-23 z uruchomionej aplikacji: `fetch("https://api.elevenlabs.io/v1/voices")`
z nagłówkiem `xi-api-key` przechodzi preflight i JavaScript odczytuje odpowiedź
(401 z celowo błędnym kluczem). Odpowiedzi API niosą więc nagłówki CORS, co
oznacza, że `convertWithTimestamps` można wywołać bezpośrednio z aplikacji.

Konsekwencja: backend NIE jest technicznie konieczny. Pozostaje pytanie, gdzie ma
mieszkać klucz i wygenerowane pliki — i to jest decyzja produktowa, nie techniczna.

## Opcje

### A. Klucz użytkownika w przeglądarce (bez backendu) — rekomendowana

Ekran „Ustawienia": użytkownik wkleja własny klucz ElevenLabs, klucz ląduje w
`localStorage` tego urządzenia. Formularz „Dodaj tekst" woła API bezpośrednio,
wynik (mp3 + alignment) trafia do IndexedDB i pojawia się w bibliotece obok
ćwiczeń wbudowanych.

- **Za:** zero infrastruktury, `output: "export"` zostaje bez zmian, brak kosztów
  hostingu, brak otwartego proxy, które ktoś obcy mógłby wydoić z limitu; każda
  rodzina używa własnego konta i własnego limitu.
- **Przeciw:** klucz jest widoczny dla każdego, kto ma dostęp do urządzenia i
  konsoli przeglądarki; własne nagrania żyją tylko na tym urządzeniu (brak synchronizacji
  między telefonem a laptopem); wymaga od użytkownika założenia konta ElevenLabs.

### B. Backend-proxy (pierwotne założenie z upgrade.md)

Funkcja serwerowa (np. Vercel) trzyma klucz, aplikacja woła własny endpoint.

- **Za:** klucz nie opuszcza serwera; nagrania mogą trafiać do wspólnego storage i
  być widoczne na wszystkich urządzeniach.
- **Przeciw:** kończy się statyczny hosting (dziś projekt buduje `out/` bez żadnej
  konfiguracji hostingu w repo); publiczny endpoint bez logowania to otwarty
  portfel — każdy, kto znajdzie adres, generuje na Twój koszt, więc potrzebne jest
  uwierzytelnianie i limity; dochodzi miejsce na pliki (Vercel Blob lub podobne).

### C. Mowa syntetyczna przeglądarki (Web Speech API)

Bez API, bez klucza: `speechSynthesis` czyta wklejony tekst.

- **Za:** darmowe, natychmiastowe, całkowicie offline.
- **Przeciw:** dla treningu słuchu po implancie jakość głosu jest istotą ćwiczenia,
  a głosy systemowe brzmią wyraźnie gorzej niż ElevenLabs; podświetlanie słów
  opiera się na zdarzeniach `onboundary`, które na iOS Safari bywają niedostępne;
  nie powstaje plik, więc nie ma odtwarzania offline ani powtarzalnego nagrania.

## Rekomendacja

**Opcja A.** Aplikacja jest osobistym narzędziem rehabilitacyjnym, instalowanym na
urządzeniu pacjenta — model „własny klucz na własnym urządzeniu" pasuje do tej
skali, nie rusza statycznego eksportu i nie tworzy kosztu ani powierzchni ataku,
którą trzeba by pilnować. Backend (opcja B) ma sens dopiero, gdy z aplikacji
korzysta więcej niezależnych rodzin i potrzebna jest wspólna biblioteka.

## Zarys implementacji dla opcji A

Duża część potrzebnego kodu już istnieje i jest czysta oraz niezależna od Node:

- `parseAlignment` i `buildExercise` (`src/lib/alignment.ts`, `src/lib/exercise.ts`)
  budują `Exercise` z odpowiedzi ElevenLabs — działają w przeglądarce bez zmian.
- `chunkText` i `splitIntoParts` (`src/lib/article.ts`) dzielą długi tekst na
  części poniżej limitu 10 000 znaków — to samo ograniczenie obowiązuje w kliencie.
- `articleGroups` (`src/lib/levels.ts`) zwinie wieloczęściowy tekst w jeden folder.

Do napisania:

1. `src/lib/keyStore.ts` — zapis i odczyt klucza (`voice-reading:elevenlabs-key`).
2. `src/lib/customLibrary.ts` — IndexedDB: zapis `Exercise` + bloba mp3, listowanie,
   usuwanie; `loadExercise`/`loadLibraryIndex` scalają wpisy własne z wbudowanymi.
3. `src/lib/tts.ts` — wywołanie `convertWithTimestamps` przez `fetch` (SDK
   `@elevenlabs/elevenlabs-js` zostaje narzędziem skryptów, nie wchodzi do bundla).
4. Ekrany: „Ustawienia" (klucz + test połączenia), „Dodaj tekst" (wklej tekst lub
   adres, podgląd podziału na części, pasek postępu generowania), usuwanie własnych
   nagrań.
5. Import z adresu URL wymaga osobnego rozstrzygnięcia: `@mozilla/readability`
   działa w przeglądarce, ale pobranie cudzej strony blokuje CORS. Bez proxy
   realny jest wariant „wklej tekst"; „wklej adres" zostaje poza zakresem opcji A.

## Open decisions

1. **Model klucza:** opcja A (klucz rodziny w przeglądarce) czy B (backend-proxy)?
   Wybór A oznacza akceptację, że klucz jest odczytywalny na urządzeniu pacjenta.
2. **Zasięg własnych nagrań:** tylko urządzenie, na którym powstały (opcja A), czy
   ma być wspólna biblioteka na wszystkich urządzeniach (wymusza B)?
3. **Import z adresu URL:** czy „wklej tekst" wystarczy? Pełny import artykułu z
   linku wymaga proxy nawet w wariancie A.
4. **Limit znaków na jedno nagranie:** proponowane 10 000 znaków na wywołanie
   (twardy limit API) z automatycznym podziałem na części, oraz miękki limit
   dzienny, żeby jedno wklejenie nie zjadło całego pakietu.
