# Zepp HA Companion

[![Build](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml/badge.svg)](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml)

[English](README.md) | [Русский](README.ru.md) | [Polski](README.pl.md)

Companion app integrating [Home Assistant](https://www.home-assistant.io/)
with **Amazfit** smartwatches running **Zepp OS**.

- Target device: **Amazfit Balance 3** (480x480, Zepp OS 5/6, API_LEVEL up to 4.4)
- Architecture: Zepp OS mini-app (watch-side pages + app-side service with network via phone)
- Home Assistant connection: REST API + Long-Lived Access Token

## Features

- **Hub screen** — the Home Assistant areas you enable in settings; each opens a list of
  entities grouped by type (lights, switches, scenes, scripts, automations, …) with
  tap-to-toggle.
- **6 customizable widget screens** — swipe left/right from the hub. Every button is
  configured from the phone: label, shape, size, grid position, color (separately for the
  ON and OFF state), and action (auto-toggle / trigger / turn on / turn off).
- **Phone-side configuration** — inside the official Zepp App (App Settings): connection
  (HA URL + token), entity discovery, area & entity toggles, and the widget-screen editor.

- **Material Design Icons** — the very same icon set Home Assistant uses: every entity row
  in the area lists shows its domain icon, and each widget button can be given one of 70
  icons from the settings editor.
- **Works offline / degrades gracefully** — the last known states are cached; when Home
  Assistant is unreachable the watch shows cached data (with its age) instead of an error.

## Refresh & battery

States refresh every time you open the app, and while the app stays open automatically at
most once every 5 minutes. Zepp OS does not allow third-party apps to access the network in
the background, so this is the platform limit — cached data covers the gaps.

## Setup

1. Home Assistant → your user profile → **Long-Lived Access Tokens** → create a token.
2. In the Zepp App open the app's **Settings**: enter the HA base URL
   (e.g. `http://192.168.1.10:8123`) and the token, then press **Sync**.
3. Enable the areas and entities you want on the watch; customize widget screens if desired.
4. Open the app on the watch — states are refreshed on every launch.

## Build

```bash
npm ci
npm run build     # -> dist/*.zab (installable package for the watch)
npm run dev       # development in the simulator
npm run preview   # install to the watch via QR code (requires zeus login)
```

Prebuilt packages: [GitHub Actions](https://github.com/Se7ven/Zepp-HA-Companion/actions) /
[Releases](https://github.com/Se7ven/Zepp-HA-Companion/releases) (tags `v*.*.*`).

## Documentation

Developer notes, architecture and conventions: [AGENTS.md](AGENTS.md)
([Русский](AGENTS.ru.md) | [Polski](AGENTS.pl.md)).

## License

MIT. The offline copy of Zepp OS documentation in `docs/` (not committed) is distributed under Apache-2.0.

The embedded watch UI font (`assets/*/fonts/ha-icons.ttf`) is a subset of
[Material Design Icons](https://pictogrammers.com/library/mdi/) v7.4.47 by Pictogrammers,
used under the [SIL Open Font License 1.1](https://scripts.sil.org/OFL).
