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

## Architektura Zepp OS (trzeba rozumieć)

- **Strony** (`page/`) — interfejs UI po stronie zegarka, działają w QuickJS na samym zegarku.
  Bezpośredni dostęp do sieci ze strony **nie jest dostępny**.
- **Usługa app-side** (`app-side/`) — serwis towarzyszący z dostępem do sieci (`fetch`, `WebSocket`),
  uruchamiany, gdy strona się do niego odwołuje. Komunikacja strona ↔ app-side odbywa się przez
  `@zeppos/zml` (`BasePage` → `this.request({ method, ... })` ↔ `BaseSideService.onRequest(req, res)`).
  Działa to przez kanał Bluetooth z telefonem: faktyczne żądanie sieciowe wykonuje telefon
  przez aplikację Zepp/Zepp Health.
- **Ustawienia** (`setting/`) — ekran ustawień aplikacji w telefonie (Zepp App → Ustawienia aplikacji),
  wartości trafiają do `settingsStorage` (`ha_config`: `{ url, token }`). **Jeszcze nie utworzony** —
  dodaj przez `npx create-zos module setting`.
- Home Assistant: REST (`GET /api/`, `GET /api/states`, `POST /api/services/...`) +
  Long-Lived Access Token. Długotrwałe połączenie WebSocket z zegarka jest zawodne —
  szkielet używa odpytywania REST; ostateczną decyzję udokumentuj w ADR po weryfikacji.

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
  home/                 # strona główna (index.page.js + index.layout/)
  i18n/                 # tłumaczenia UI (en-US.po, ru-RU.po, zh-CN.po)
app-side/
  index.js              # most sieciowy do Home Assistant (fetch przez telefon)
  i18n/
setting/                # (TODO) ustawienia HA w telefonie
utils/config/constants.js  # klucze pamięci, wartości domyślne
assets/common.r|common.s   # zasoby per kształt ekranu (r = okrągły 480)
docs/                   # LOKALNA KOPIA dokumentacji Zepp OS, w gitignore
scripts/                # skrypty pomocnicze
```

## Konwencje

- Język kodu to JavaScript (moduły ES, nie TypeScript; typy przez `@zeppos/device-types` + `jsconfig.json`).
- Widgety UI: `import * as hmUI from '@zos/ui'`; parametry layoutu znajdują się w `index.[pf].layout.js`
  (`[pf]` jest rozwiązywane per platforma: `r`/`s`).
- Tłumaczenia: format `.po`, klucze przez i18n; nie hardkoduj tekstów w UI.
- `app.json`: `appId` jest obecnie **placeholderek** `29331` (z szablonu). Prawdziwy id wydaje
  console.zepp.com — przypisz go przed publikacją. Nie zmieniaj `configVersion`.
- Nie commitować: `node_modules/`, `dist/`, `docs/`, `.zab`, sekretów. Tokena HA nie przechowujemy w repozytorium.
- Wersjonowanie semantyczne, synchronizowane w `package.json` i `app.json` (`app.version.name`).
- Polityka językowa dokumentacji: patrz sekcja wyżej — cała dokumentacja w EN/RU/PL z odnośnikami.

## Plan prac (szkielet)

- [ ] `setting/` — ekran ustawień Zepp App (URL HA + token) zapisujący do `settingsStorage`
- [ ] Strona główna → wywołanie `TEST_CONNECTION` / `GET_STATES` z `app-side/`
- [ ] Lista wybranych encji + przełączanie serwisów (np. światło)
- [ ] Buforowanie i łagodna degradacja, gdy HA jest niedostępny
- [ ] Decyzja: odpytywanie REST vs WebSocket; częstotliwość odświeżania vs bateria
- [ ] Ikona aplikacji, zrzuty ekranu, publikacja w katalogu

## Znane pułapki

- Sieć istnieje tylko w app-side; ze strony — wyłącznie `this.request(...)` (zml).
- `zeus preview` wymaga loginu kontem deweloperskim; `zeus build` nie (zweryfikowane w CI).
- `@zeppos/zml` to zależność runtime — trzymamy w `dependencies` (nie w `devDependencies`).
- `docs/` to migawka; przed decyzjami o API sprawdzaj dokumentację online oraz
  `@zeppos/device-types` (wersje w `node_modules/@zeppos/device-types/index.d.ts`).
