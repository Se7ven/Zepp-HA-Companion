# AGENTS.md

Instrukcje dla agentów AI pracujących w tym repozytorium.

[English](AGENTS.md) | [Русский](AGENTS.ru.md) | [Polski](AGENTS.pl.md)

## Polityka językowa dokumentacji

Cała dokumentacja projektowa (wszystkie pliki `*.md` w katalogu głównym repozytorium) jest
prowadzona w **trzech językach: angielskim, rosyjskim i polskim**.

- `README.md` / `AGENTS.md` — kanoniczne wersje angielskie; `.ru.md` / `.pl.md` to tłumaczenia.
- Każda zmiana w dokumentacji musi być wprowadzona **we wszystkich trzech wersjach językowych
  w tym samym commicie**.
- Każda wersja językowa zaczyna się od linii przełącznika języków z wzajemnymi odnośnikami.
- Tłumaczenia muszą być wierne; bloków kodu, ścieżek i identyfikatorów nie tłumaczymy.

## O projekcie

**Zepp HA Companion** — aplikacja towarzysząca integrująca [Home Assistant](https://www.home-assistant.io/)
ze smartwatchami Amazfit działającymi pod systemem Zepp OS.

- **Urządzenie docelowe:** Amazfit Balance 3 (okrągły, 480x480, `deviceSource` `11141376`/`11141377`/`11141379`)
- **System docelowy:** najnowszy Zepp OS (w momencie pisania — Zepp OS 5/6; Balance 3 obsługuje `API_LEVEL` do 4.4)
- **Konfiguracja aplikacji:** `app.json` używa `apiVersion` `compatible/target/minVersion = 4.0`
  (oficjalne przykłady poziomu 4.x używają dokładnie tej kombinacji; aby ją podnieść,
  sprawdź wspierane wartości w `docs/reference/app-json.mdx`)

## Ważne linki

| Co | Gdzie |
| --- | --- |
| Dokumentacja offline (źródło docs.zepp.com, mdx) | `docs/` — **w gitignore, nie commitować**; odświeżaj przez `scripts/update-docs.sh` |
| Dokumentacja online | https://docs.zepp.com/ |
| Konsola deweloperska (appid, publikacja) | https://console.zepp.com/ |
| Oficjalne przykłady | https://github.com/zepp-health/zeppos-samples (`application/4.0/fetch-api` — najbliższy architektonicznie przykład) |
| Dokumentacja (repozytorium źródłowe) | https://github.com/zepp-health/zeppos-docs |
| Zeus CLI (budowanie) | https://www.npmjs.com/package/@zeppos/zeus-cli |
| Generator modułów | https://github.com/zepp-health/create-zos |

Dokumentacja w `docs/` jest na licencji Apache-2.0 (patrz `docs/.LICENSE.txt`), używana tylko lokalnie.
Czcionka ikon na zegarek (`assets/*/fonts/ha-icons.ttf`) to podzbiór Material Design Icons 7.4.47
(Pictogrammers), SIL OFL 1.1 — atrybucja znajduje się w README; zachowuj uwagi dotyczące
generowania w nagłówku `utils/icons.js` przy regeneracji czcionki.

## Architektura Zepp OS (trzeba rozumieć)

- **Strony** (`page/`) — interfejs UI po stronie zegarka, działają w QuickJS na samym zegarku.
  Bezpośredni dostęp do sieci ze strony **nie jest dostępny**.
- **Usługa app-side** (`app-side/`) — serwis towarzyszący z dostępem do sieci (`fetch`, `WebSocket`),
  uruchamiany, gdy strona się do niego odwołuje. Komunikacja strona ↔ app-side odbywa się przez
  `@zeppos/zml` (`BasePage` → `this.request({ method, ... })` ↔ `BaseSideService.onRequest(req, res)`).
  Działa to przez kanał Bluetooth z telefonem: faktyczne żądanie sieciowe wykonuje telefon
  przez aplikację Zepp/Zepp Health.
- **Ustawienia** (`setting/`) — pełna aplikacja ustawień w telefonie (Zepp App → Ustawienia
  aplikacji): połączenie (URL HA + token), wykrywanie encji, przełączniki obszarów i encji oraz
  edytor przycisków ekranów widżetów. To prawdziwa mini-aplikacja JS (`setting/index.js`)
  z komponentami ambient (`View`, `Section`, `Toggle`, `Select`, `TextInput`, `Button`, ...);
  widok przebudowuje się przy każdej zmianie `settingsStorage`. Stan nawigacji jest przechowywany
  w kluczu `ha_ui`.
- **`settingsStorage` jest dostępny tylko po stronie telefonu.** Serwis app-side czyta i zapisuje
  go przez `settingsLib` z `@zeppos/zml/base-side`; zegarka widzi go tylko przez serwis app-side.
  Telefon wysyła zmiany na zegarek: `onSettingsChange` → `this.call({ method })` → `onCall` strony.
- **Home Assistant:** wyłącznie odpytywanie REST — Zepp OS **nie udostępnia klienta WebSocket**,
  decyzja jest ostateczna. Wykrywanie (`app-side/index.js: discover()`) pobiera identyfikatory
  i nazwy encji z `GET /api/states`, a przynależność do obszarów z `GET /api/template`
  z szablonem Jinja (`area_id()`/`area_name()`), ponieważ rejestr obszarów HA jest inaczej
  niedostępny. Odpowiedź `/api/template` to `text/plain` — **nie parsuj jej jako JSON**.
- **Buforowanie i polityka odświeżania:** serwis app-side buforuje ostatnie poprawne odpowiedzi
  huba/obszarów w `settingsStorage.ha_cache` (po stronie telefonu). `GET_HUB`/`GET_AREA` działają
  live-first: przy niedostępności HA zwracane są dane z cache z `cached: true` i `age`,
  a zegarek pokazuje bursztynowy wskaźnik „Dane z pamięci · N min” zamiast błędu.
  Odświeżanie następuje przy każdym otwarciu strony i, dopóki aplikacja jest otwarta,
  automatycznie nie częściej niż raz na `REFRESH_INTERVAL_MS` (5 minut,
  `utils/config/constants.js`) — oszczędność baterii.
- **UI zegarka:** ekrany przewijają się poziomym swipe'em przez
  `setScrollMode(SCROLL_MODE_SWIPER_HORIZONTAL)` z `VIEW_CONTAINER(page: i)` — maksymalnie
  7 kontenerów na stronę (1 hub + 6 ekranów widżetów mieści się co do sztuki). `LIST_VIEW`
  wymaga `API_LEVEL` 5.0 i jest **niedostępny** (target to 4.0): przewijane listy budujemy
  z wierszy `BUTTON` wewnątrz `VIEW_CONTAINER(scroll_enable: 1)`. Kolory stanów przycisków
  pochodzą z ustawień (`colorOn`/`colorOff`).
- **Ikony:** `assets/*/fonts/ha-icons.ttf` — podzbiór Material Design Icons (tego samego
  zestawu, którego używa Home Assistant), zemapowanego do BMP PUA `U+E000+`, ponieważ renderer
  zegarka/QuickJS obsługują `String.fromCharCode` tylko w zakresie BMP. Widgety wybierają ją
  parametrem `font: 'fonts/ha-icons.ttf'` (ścieżka względem katalogu assets celu; zeus pakuje
  katalog `fonts/` automatycznie). Mapowania i lista wyboru: `utils/icons.js`
  (`ICON_MAP`/`ICON_CHOICES`/`DOMAIN_ICON`). Tekstu nie da się „wmontować” w BUTTON, więc
  ikona i etykieta to osobne widgety TEXT nad BUTTON; każda warstwa przekazuje dotknięcia,
  a strażnik 500 ms odrzuca duplikaty.

## Polecenia

```bash
npm ci              # instalacja zależności
npm run dev         # development z podglądem w symulatorze (zeus dev)
npm run preview     # instalacja na prawdziwym zegarku przez QR (zeus preview, wymaga zeus login)
npm run build       # budowanie pakietu instalacyjnego -> dist/*.zab
scripts/update-docs.sh   # odśwież lokalną kopię dokumentacji docs/
```

Dodawanie modułów (strona, app-side, ustawienia itd.) — oficjalnym generatorem,
sam poprawia `app.json`:

```bash
npx create-zos@latest module page        # nowa strona
npx create-zos@latest module setting     # ekran ustawień w telefonie
npx create-zos@latest module app-side    # usługa app-side
```

CI: GitHub Actions (`.github/workflows/`). `build.yml` buduje pakiet `.zab` i wgrywa artefakt;
`release.yml` publikuje GitHub Release po otagowaniu `v*.*.*`. Lokalnie artefakt trafia do `dist/`.

## Struktura

```
app.js                  # punkt wejścia urządzenia (cykl życia App)
app.json                # konfiguracja mini-aplikacji (appId, apiVersion, targets, i18n)
page/
  home/                 # hub + 6 przewijanych swipe'em ekranów widżetów (index.page.js)
  area/                 # lista encji obszaru, pogrupowana po domenach (index.page.js)
  i18n/                 # tłumaczenia UI (en-US.po, ru-RU.po, zh-CN.po)
app-side/
  index.js              # most REST do HA + wykrywanie + synchronizacja ustawień (fetch przez telefon)
setting/
  index.js              # aplikacja ustawień w telefonie (połączenie, obszary, edytor ekranów)
  i18n/                 # tłumaczenia UI ustawień (en-US.po, ru-RU.po)
utils/
  ha.js                 # pomocniki HA: mapa serwisów, stan on/off, parsowanie id
  icons.js              # mapy czcionki ikon (ICON_MAP/ICON_CHOICES/DOMAIN_ICON), nagłówek OFL
  config/constants.js   # klucze pamięci (STORAGE_KEYS), wartości domyślne, paleta kolorów
assets/common.r|common.s   # zasoby per kształt ekranu (r = okrągły 480); fonts/ha-icons.ttf (podzbiór MDI, OFL-1.1)
docs/                   # LOKALNA KOPIA dokumentacji Zepp OS, w gitignore
scripts/                # skrypty pomocnicze
```

Główny przepływ danych: aplikacja ustawień zapisuje `ha_config`/`ha_sync` → serwis app-side
reaguje przez `onSettingsChange` → `discover()` buforuje `ha_data` → zegarka odpytuje
`GET_HUB`/`GET_AREA`/`CALL` przez zml.

## Konwencje

- Język kodu to JavaScript (moduły ES, nie TypeScript; typy przez `@zeppos/device-types` + `jsconfig.json`).
- Widgety UI: `import * as hmUI from '@zos/ui'`; parametry layoutu znajdują się w `index.[pf].layout.js`
  (`[pf]` jest rozwiązywane per platforma: `r`/`s`).
- Tłumaczenia: format `.po`, klucze przez i18n; nie hardkoduj tekstów w UI.
- `app.json`: `appId` jest obecnie **placeholder** `29331` (z szablonu). Prawdziwy id wydaje
  console.zepp.com — przypisz go przed publikacją. Nie zmieniaj `configVersion`.
- Nie commitować: `node_modules/`, `dist/`, `docs/`, `.zab`, sekretów. Tokena HA nie przechowujemy w repozytorium.
- Wersjonowanie semantyczne, synchronizowane w `package.json` i `app.json` (`app.version.name`).
- Polityka językowa dokumentacji: patrz sekcja wyżej — cała dokumentacja w EN/RU/PL z odnośnikami.

## Plan prac

- [x] `setting/` — ekran ustawień Zepp App (URL HA + token) zapisujący do `settingsStorage`
- [x] Strona główna → wywołanie `GET_HUB` / `GET_AREA` / `CALL` z `app-side/`
- [x] Lista encji (obszary → encje pogrupowane po domenach) z przełączaniem
- [x] 6 konfigurowalnych ekranów widżetów (etykieta, rozmiar, pozycja, kształt, kolory dla on/off, akcja)
- [x] Decyzja: odpytywanie REST (WebSocket w Zepp OS brak); obszary przez `/api/template`
- [x] Buforowanie i łagodna degradacja, gdy HA jest niedostępny
- [x] Częstotliwość odświeżania vs bateria — odświeżanie przy otwarciu + ≤1 na 5 min,
  gdy aplikacja otwarta (sieć w tle jest zabroniona przez platformę, patrz Pułapki)
- [ ] Ikona aplikacji, zrzuty ekranu, publikacja w katalogu

## Znane pułapki

- Sieć istnieje tylko w app-side; ze strony — wyłącznie `this.request(...)` (zml).
- `zeus preview` wymaga loginu kontem deweloperskim; `zeus build` nie (zweryfikowane w CI).
- `@zeppos/zml` to zależność runtime — trzymamy w `dependencies` (nie w `devDependencies`).
- zml przesyła dane w kawałkach ~3,5 KB — utrzymuj małe pakiety `GET_HUB`/`GET_AREA`
  (filtruj atrybuty stanów encji po stronie serwisu).
- `settingsStorage` jest tylko po stronie telefonu; w serwisie app-side używaj `settingsLib`
  (`@zeppos/zml/base-side`), nigdy nie importuj tam `@zos/settings`.
- **Sieć w tle jest niemożliwa dla aplikacji zewnętrznych**: App Service (`app-service/`)
  nie ma `fetch` ani timerów, a usługa app-side żyje tylko podczas sesji strony.
  Maksymalna świeżość danych = cache + odświeżanie na pierwszym planie (≤1 na 5 min).
  Nie próbuj ponownie dodać odpytywania w tle.
- Cache znajduje się w `settingsStorage` (na telefonie): przetrwa awarię HA, ale jeśli sam
  kanał z telefonem padnie, zegarek nie może go odczytać — strona pokaże błąd połączenia.
- `docs/` to migawka; przed decyzjami o API sprawdzaj dokumentację online oraz
  `@zeppos/device-types` (wersje w `node_modules/@zeppos/device-types/index.d.ts`).
