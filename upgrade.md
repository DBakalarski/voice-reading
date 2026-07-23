# Plan rozwoju aplikacji — 6 kroków

Aplikacja służy do treningu słuchowego z implantem ślimakowym: odtwarza nagrania
i podświetla czytane słowo. Poniższe kroki rozwijają ją funkcjonalnie w kolejności
od największej wartości rehabilitacyjnej przy najmniejszym ryzyku technicznym.

## Krok 1 — Zmiana tempa czytania

**Cel rehabilitacyjny:** na początku rehabilitacji naturalne tempo mowy bywa za
szybkie — możliwość zwolnienia nagrania pozwala dopasować trudność do aktualnych
możliwości pacjenta i stopniowo wracać do normalnego tempa.

**Zakres:**
- Wybór tempa na stronie ćwiczenia: 0.75× / 0.9× / 1× (przyciski obok kontrolek
  rozmiaru tekstu).
- Podświetlanie słów i fraz działa dalej bez zmian, bo synchronizacja opiera się
  na `audio.currentTime`, które płynie wolniej razem z nagraniem.
- Zapamiętanie wybranego tempa w `localStorage` (jak rozmiar czcionki).

**Technicznie:** `audio.playbackRate` z `preservesPitch` (domyślnie włączone we
współczesnych przeglądarkach — głos brzmi wolniej, ale nie niżej); wyłącznie
frontend, bez zmian w danych i pipeline audio.

## Krok 2 — Tryb „Najpierw słuchaj"

**Cel rehabilitacyjny:** prawdziwy trening słuchu odbywa się wtedy, gdy pacjent
najpierw próbuje zrozumieć nagranie bez podpowiedzi wzrokowej, a dopiero potem
weryfikuje się z tekstem. Obecnie tekst jest widoczny od razu, więc ćwiczenie
sprawdza czytanie, nie słuchanie.

**Zakres:**
- Przełącznik trybu na stronie ćwiczenia: „Słuchaj i czytaj" (obecny) / „Najpierw słuchaj".
- W trybie „Najpierw słuchaj" tekst jest zakryty (rozmyty lub schowany), nagranie
  można odtworzyć dowolną liczbę razy, a przycisk „Pokaż tekst" odsłania go do weryfikacji.
- Zapamiętanie wybranego trybu w `localStorage` (jak rozmiar czcionki).

**Technicznie:** wyłącznie frontend — stan w `Player`, bez zmian w pipeline audio.

## Krok 3 — Powtórka zdania i nawigacja frazami

**Cel rehabilitacyjny:** możliwość wielokrotnego powtórzenia trudnego zdania to
podstawowe narzędzie treningu; przewijanie całości suwakiem jest za mało precyzyjne.

**Zakres:**
- Przycisk „Powtórz zdanie" — cofa do początku bieżącej frazy (czasy fraz już są w danych).
- Klik/tap na dowolną frazę w tekście przenosi odtwarzanie do jej początku.
- Suwak postępu jako element interaktywny (seek), nie tylko pasek.

**Technicznie:** dane (`phrases` z czasami) już istnieją — to rozszerzenie
`Player`/`useAudioSync` bez zmian w bibliotece nagrań.

## Krok 4 — Śledzenie postępów i „Kontynuuj"

**Cel rehabilitacyjny:** rehabilitacja wymaga regularności; aplikacja powinna
pokazywać, co już przerobiono, i ułatwiać codzienny powrót do ćwiczeń.

**Zakres:**
- Oznaczanie ćwiczenia jako ukończone (odsłuchane do końca) — znacznik na listach tematów.
- Karta „Kontynuuj" na stronie głównej: ostatnie ćwiczenie + pozycja odtwarzania
  (istotne przy wieloczęściowych artykułach).
- Prosty licznik regularności: liczba dni ćwiczeń z rzędu.

**Technicznie:** całość w `localStorage` (aplikacja jest statyczna, offline-first —
bez backendu); osobny moduł np. `src/lib/progress.ts` z testami.

## Krok 5 — Sprawdzenie zrozumienia po ćwiczeniu

**Cel rehabilitacyjny:** samo odsłuchanie nie mierzy zrozumienia mowy. Krótki quiz
(2–3 pytania do treści) daje pacjentowi i rodzinie obiektywny sygnał postępu
i podnosi zaangażowanie.

**Zakres:**
- Opcjonalne pole `questions` w danych ćwiczenia (pytanie + 3 odpowiedzi, jedna poprawna).
- Po zakończeniu odtwarzania ekran „Sprawdź zrozumienie"; wynik zapisywany do postępów (krok 4).
- Pytania dopisywane ręcznie w `content/index.json` dla ćwiczeń poziomów 1–3
  (dla artykułów opcjonalnie, docelowo generowane automatycznie).

**Technicznie:** rozszerzenie typu `ContentItem`/`Exercise` i pipeline `generate.ts`
o przepisanie pytań do plików biblioteki; quiz to czysty frontend.

## Krok 6 — Własne teksty w aplikacji

**Cel rehabilitacyjny:** największa wartość treningu pojawia się na tekstach
istotnych dla pacjenta (wiadomości od rodziny, ulubione tematy). Dziś import
wymaga uruchomienia skryptów na komputerze dewelopera.

**Zakres:**
- Formularz w aplikacji: wklej tekst lub adres artykułu → nagranie generuje się
  automatycznie i pojawia w bibliotece.
- Kolejka/status generowania („Twoje nagranie się przygotowuje").

**Technicznie:** wymaga małego backendu-proxy (np. funkcja serwerowa na Vercel),
żeby klucz ElevenLabs nigdy nie trafił do przeglądarki; to jedyny krok wykraczający
poza statyczny hosting, dlatego jest ostatni. Do rozstrzygnięcia: limit znaków
(kwota ElevenLabs) i miejsce zapisu wygenerowanych plików (repo vs storage).
