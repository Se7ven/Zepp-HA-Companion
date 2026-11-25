# Zepp HA Companion

[![Build](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml/badge.svg)](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml)

[English](README.md) | [Русский](README.ru.md) | [Polski](README.pl.md)

Companion app integrating [Home Assistant](https://www.home-assistant.io/)
with **Amazfit** smartwatches running **Zepp OS**.

- Target device: **Amazfit Balance 3** (480x480, Zepp OS 5/6, API_LEVEL up to 4.4)
- Architecture: Zepp OS mini-app (watch-side pages + app-side service with network via phone)
- Home Assistant connection: REST API + Long-Lived Access Token

> ⚠️ The project is at the skeleton stage. See [AGENTS.md](AGENTS.md) — architecture description and roadmap.

## Build

```bash
npm ci
npm run build     # -> dist/*.zab (installable package for the watch)
npm run dev       # development in the simulator
npm run preview   # install to the watch via QR code (requires zeus login)
```

Prebuilt packages: [GitHub Actions](https://github.com/Se7ven/Zepp-HA-Companion/actions) /
[Releases](https://github.com/Se7ven/Zepp-HA-Companion/releases) (tags `v*.*.*`).

## License

MIT. The offline copy of Zepp OS documentation in `docs/` (not committed) is distributed under Apache-2.0.
