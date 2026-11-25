# Zepp HA Companion

[![Build](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml/badge.svg)](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml)

[English](README.md) | [Русский](README.ru.md) | [Polski](README.pl.md)

Aplikacja towarzysząca integrująca [Home Assistant](https://www.home-assistant.io/)
ze smartwatchami **Amazfit** działającymi pod systemem **Zepp OS**.

- Urządzenie docelowe: **Amazfit Balance 3** (480x480, Zepp OS 5/6, API_LEVEL do 4.4)
- Architektura: mini-aplikacja Zepp OS (strony na zegarku + usługa app-side z dostępem do sieci przez telefon)
- Połączenie z Home Assistant: REST API + Long-Lived Access Token

> ⚠️ Projekt znajduje się na etapie szkieletu. Zobacz [AGENTS.pl.md](AGENTS.pl.md) — opis architektury i plan prac.

## Budowanie

```bash
npm ci
npm run build     # -> dist/*.zab (pakiet instalacyjny dla zegarka)
npm run dev       # development w symulatorze
npm run preview   # instalacja na zegarku przez kod QR (wymaga zeus login)
```

Gotowe paczki: [GitHub Actions](https://github.com/Se7ven/Zepp-HA-Companion/actions) /
[Releases](https://github.com/Se7ven/Zepp-HA-Companion/releases) (tagi `v*.*.*`).

## Licencja

MIT. Lokalna kopia dokumentacji Zepp OS w `docs/` (nie commitowana) rozpowszechniana na licencji Apache-2.0.
