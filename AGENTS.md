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

## Zepp OS Architecture (must understand)

- **Pages** (`page/`) — watch-side UI, runs in QuickJS on the watch itself.
  Direct network access from a page is **not available**.
- **App-Side Service** (`app-side/`) — companion service with network access (`fetch`, `WebSocket`),
  started when a page calls into it. Page ↔ side communication goes through `@zeppos/zml`
  (`BasePage` → `this.request({ method, ... })` ↔ `BaseSideService.onRequest(req, res)`).
  It runs over the Bluetooth channel to the phone: the actual network request is performed by the
  phone via the Zepp/Zepp Health app.
- **Setting** (`setting/`) — app settings UI in the phone (Zepp App → App Settings),
  values arrive in `settingsStorage` (`ha_config`: `{ url, token }`). **Not created yet** —
  add with `npx create-zos module setting`.
- Home Assistant: REST (`GET /api/`, `GET /api/states`, `POST /api/services/...`) +
  Long-Lived Access Token. A long-lived WebSocket from the watch is unreliable —
  the skeleton uses REST polling; record the final decision in an ADR/docs after verification.

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
  home/                 # home page (index.page.js + index.layout/)
  i18n/                 # UI translations (en-US.po, ru-RU.po, zh-CN.po)
app-side/
  index.js              # network bridge to Home Assistant (fetch via phone)
  i18n/
setting/                # (TODO) HA settings in the phone app
utils/config/constants.js  # storage keys, defaults
assets/common.r|common.s   # resources per screen shape (r = round 480)
docs/                   # OFFLINE COPY of Zepp OS docs, gitignored
scripts/                # utility scripts
```

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

## Roadmap (skeleton)

- [ ] `setting/` — Zepp App settings screen (HA URL + token) writing to `settingsStorage`
- [ ] Home page → call `TEST_CONNECTION` / `GET_STATES` from `app-side/`
- [ ] Favorite entities list + service toggling (light switch, etc.)
- [ ] Caching and graceful degradation when HA is unreachable
- [ ] Decide: REST polling vs WebSocket; update frequency vs battery
- [ ] App icon, screenshots, catalog publishing

## Known Gotchas

- Network exists only in app-side; from a page — only `this.request(...)` (zml).
- `zeus preview` requires a developer-account login; `zeus build` does not (verified in CI).
- `@zeppos/zml` is a runtime dependency, keep it in `dependencies` (not `devDependencies`).
- `docs/` is a snapshot; before making API decisions, cross-check online docs and
  `@zeppos/device-types` (versions in `node_modules/@zeppos/device-types/index.d.ts`).
