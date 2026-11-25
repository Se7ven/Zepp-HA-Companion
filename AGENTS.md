# AGENTS.md

Instructions for AI agents working in this repository.

[English](AGENTS.md) | [Русский](AGENTS.ru.md) | [Polski](AGENTS.pl.md)

## Documentation Language Policy

All project documentation (every `*.md` in the repository root) must be maintained in **three
languages: English, Russian, and Polish**.

- `README.md` / `AGENTS.md` — canonical English versions; `.ru.md` / `.pl.md` are translations.
- Any documentation change must be applied to **all three language versions in the same commit**.
- Every language version starts with a language switch line that cross-links the other versions.
- Translations stay faithful; keep code blocks, paths and identifiers untranslated.

## About the Project

**Zepp HA Companion** — a companion app integrating [Home Assistant](https://www.home-assistant.io/)
with Amazfit smartwatches running Zepp OS.

- **Target device:** Amazfit Balance 3 (round, 480x480, `deviceSource` `11141376`/`11141377`/`11141379`)
- **Target OS:** latest Zepp OS (as of writing — Zepp OS 5/6; Balance 3 supports `API_LEVEL` up to 4.4)
- **App configuration:** `app.json` uses `apiVersion` `compatible/target/minVersion = 4.0`
  (official 4.x-level samples use exactly this combination; to raise it, verify the supported
  values in `docs/reference/app-json.mdx`)

## Key Links

| What | Where |
| --- | --- |
| Offline documentation (source of docs.zepp.com, mdx) | `docs/` — **gitignored, never commit**; refresh with `scripts/update-docs.sh` |
| Online documentation | https://docs.zepp.com/ |
| Developer console (appid, publishing) | https://console.zepp.com/ |
| Official samples | https://github.com/zepp-health/zeppos-samples (`application/4.0/fetch-api` — closest architectural example) |
| Documentation (source repo) | https://github.com/zepp-health/zeppos-docs |
| Zeus CLI (build) | https://www.npmjs.com/package/@zeppos/zeus-cli |
| Module scaffolder | https://github.com/zepp-health/create-zos |

Docs in `docs/` are Apache-2.0 licensed (see `docs/.LICENSE.txt`), used locally only.
The watch icon font (`assets/*/fonts/ha-icons.ttf`) is a subset of Material Design Icons 7.4.47
(Pictogrammers), SIL OFL 1.1 — attribution lives in the README; keep the generation notes in
the `utils/icons.js` header when regenerating the font.

## Zepp OS Architecture (must understand)

- **Pages** (`page/`) — watch-side UI, runs in QuickJS on the watch itself.
  Direct network access from a page is **not available**.
- **App-Side Service** (`app-side/`) — companion service with network access (`fetch`, `WebSocket`),
  started when a page calls into it. Page ↔ side communication goes through `@zeppos/zml`
  (`BasePage` → `this.request({ method, ... })` ↔ `BaseSideService.onRequest(req, res)`).
  It runs over the Bluetooth channel to the phone: the actual network request is performed by the
  phone via the Zepp/Zepp Health app.
- **Setting** (`setting/`) — full settings app inside the phone (Zepp App → App Settings):
  connection (HA URL + token), entity discovery, area/entity enable toggles, and the widget-screen
  button editor. It is a real JS mini-app (`setting/index.js`) with ambient components (`View`,
  `Section`, `Toggle`, `Select`, `TextInput`, `Button`, ...); the view rebuilds on every
  `settingsStorage` change. Navigation state lives in the `ha_ui` storage key.
- **`settingsStorage` is phone-side only.** The side service reads/writes it via `settingsLib`
  from `@zeppos/zml/base-side`; the watch sees it only through the side service. The phone pushes
  changes to the watch with `onSettingsChange` → `this.call({ method })` → page `onCall`.
- **Home Assistant:** REST polling only — Zepp OS exposes **no WebSocket client**, so the decision
  is settled. Discovery (`app-side/index.js: discover()`) fetches entity ids+names from
  `GET /api/states` and area membership from `GET /api/template` with a Jinja template
  (`area_id()`/`area_name()`), because the HA area registry is not otherwise reachable.
  The `/api/template` body is `text/plain` — do **not** JSON.parse it.
- **Caching & refresh policy:** the side service caches the last successful hub/area responses in
  `settingsStorage.ha_cache` (phone-side). `GET_HUB`/`GET_AREA` are live-first: on HA failure the
  cached data is served with `cached: true` + `age`, and the watch shows an amber
  "Cached data · N min" indicator instead of an error. Refresh happens on every page open and,
  while the app is open, automatically at most once per `REFRESH_INTERVAL_MS` (5 min,
  `utils/config/constants.js`) — battery policy.
- **Watch UI:** screens swipe horizontally via `setScrollMode(SCROLL_MODE_SWIPER_HORIZONTAL)`
  with `VIEW_CONTAINER(page: i)` — max 7 containers per page (1 hub + 6 widget screens fits
  exactly). `LIST_VIEW` requires `API_LEVEL` 5.0 and is **unavailable** (we target 4.0):
  scrollable lists are built from `BUTTON` rows inside a `VIEW_CONTAINER(scroll_enable: 1)`.
  Button state colors come from the settings (`colorOn`/`colorOff`).
- **Icons:** `assets/*/fonts/ha-icons.ttf` — subset of Material Design Icons (the icon set
  Home Assistant itself uses), remapped to BMP PUA `U+E000+` because the watch renderer/QuickJS
  only handle `String.fromCharCode` BMP characters. Widgets select it via `font: 'fonts/ha-icons.ttf'`
  (path relative to the assets target dir; zeus packages the `fonts/` folder automatically).
  Mappings and the picker list: `utils/icons.js` (`ICON_MAP`/`ICON_CHOICES`/`DOMAIN_ICON`).
  A TEXT overlay cannot be styled into a BUTTON, so icon+label are separate TEXT widgets on
  top of the BUTTON; every layer forwards taps and a 500 ms guard debounces duplicates.

## Commands

```bash
npm ci              # install dependencies
npm run dev         # development with simulator preview (zeus dev)
npm run preview     # install to real watch via QR (zeus preview, requires zeus login)
npm run build       # build installable package -> dist/*.zab
scripts/update-docs.sh   # refresh the offline docs/ mirror
```

Adding modules (page, side service, settings, etc.) — use the official scaffolder,
it patches `app.json` automatically:

```bash
npx create-zos@latest module page        # new page
npx create-zos@latest module setting     # phone-side settings screen
npx create-zos@latest module app-side    # side service
```

CI: GitHub Actions (`.github/workflows/`). `build.yml` builds the `.zab` and uploads an artifact;
`release.yml` publishes a GitHub Release on `v*.*.*` tags. Locally the artifact lands in `dist/`.

## Structure

```
app.js                  # device entry point (App lifecycle)
app.json                # mini-app config (appId, apiVersion, targets, i18n)
page/
  home/                 # hub + 6 swipeable widget screens (index.page.js)
  area/                 # entity list for one area, grouped by domain (index.page.js)
  i18n/                 # UI translations (en-US.po, ru-RU.po, zh-CN.po)
app-side/
  index.js              # HA REST bridge + discovery + settings sync (fetch via phone)
setting/
  index.js              # phone-side settings app (connection, areas, screens editor)
  i18n/                 # settings UI translations (en-US.po, ru-RU.po)
utils/
  ha.js                 # HA helpers: service map, on/off state, id parsing
  icons.js              # icon font maps (ICON_MAP/ICON_CHOICES/DOMAIN_ICON), OFL header
  config/constants.js   # storage keys (STORAGE_KEYS), defaults, color palette
assets/common.r|common.s   # resources per screen shape (r = round 480); fonts/ha-icons.ttf (MDI subset, OFL-1.1)
docs/                   # OFFLINE COPY of Zepp OS docs, gitignored
scripts/                # utility scripts
```

Main data flow: settings app writes `ha_config`/`ha_sync` → side service `onSettingsChange` →
`discover()` caches `ha_data` → watch requests `GET_HUB`/`GET_AREA`/`CALL` via zml.

## Conventions

- Code language is JavaScript (ES modules, not TypeScript; types via `@zeppos/device-types` + `jsconfig.json`).
- UI widgets: `import * as hmUI from '@zos/ui'`; layout parameters live in `index.[pf].layout.js`
  (`[pf]` is resolved per platform: `r`/`s`).
- Translations: `.po` format, keys via i18n; do not hardcode UI strings.
- `app.json`: `appId` is currently a **placeholder** `29331` (from the template). The real id is
  issued at console.zepp.com — assign it before publishing. Never change `configVersion`.
- Never commit: `node_modules/`, `dist/`, `docs/`, `.zab`, secrets. Never store an HA token in the repo.
- Semantic versioning, kept in sync in `package.json` and `app.json` (`app.version.name`).
- Documentation language policy: see section above — all docs in EN/RU/PL with cross-links.

## Roadmap

- [x] `setting/` — Zepp App settings screen (HA URL + token) writing to `settingsStorage`
- [x] Home page → call `GET_HUB` / `GET_AREA` / `CALL` from `app-side/`
- [x] Entity list (areas → entities grouped by domain) with toggling
- [x] 6 customizable widget screens (label, size, position, shape, per-state colors, action)
- [x] Decide: REST polling (no WebSocket in Zepp OS); areas via `/api/template`
- [x] Caching and graceful degradation when HA is unreachable
- [x] Update frequency vs battery — refresh on open + ≤1 per 5 min while open (background
  network is forbidden by the platform, see Gotchas)
- [ ] App icon, screenshots, catalog publishing

## Known Gotchas

- Network exists only in app-side; from a page — only `this.request(...)` (zml).
- `zeus preview` requires a developer-account login; `zeus build` does not (verified in CI).
- `@zeppos/zml` is a runtime dependency, keep it in `dependencies` (not `devDependencies`).
- zml transfers data in ~3.5 KB chunks — keep `GET_HUB`/`GET_AREA` payloads compact (filter
  entity state attributes server-side).
- `settingsStorage` is phone-only; in the side service use `settingsLib` (`@zeppos/zml/base-side`),
  never import `@zos/settings` there.
- **Background network is impossible for third-party apps**: the App Service (`app-service/`)
  has no `fetch` and no timers, and the app-side service only lives during a page session.
  Max achievable freshness = cache + foreground refresh (≤1 per 5 min). Do not attempt to
  re-add background polling.
- The cache lives in `settingsStorage` (on the phone): it survives HA outages, but if the phone
  link itself is down the watch cannot read it — the page then shows a connection error.
- `docs/` is a snapshot; before making API decisions, cross-check online docs and
  `@zeppos/device-types` (versions in `node_modules/@zeppos/device-types/index.d.ts`).
