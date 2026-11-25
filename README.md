# Zepp HA Companion

[![Build](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml/badge.svg)](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml)

Приложение-компаньон для интеграции [Home Assistant](https://www.home-assistant.io/)
с умными часами **Amazfit** на базе **Zepp OS**.

- Целевое устройство: **Amazfit Balance 3** (480x480, Zepp OS 5/6, API_LEVEL до 4.4)
- Архитектура: мини-приложение Zepp OS (страницы на часах + app-side сервис с сетью через телефон)
- Подключение к Home Assistant: REST API + Long-Lived Access Token

> ⚠️ Проект на стадии каркаса (skeleton). См. [AGENTS.md](AGENTS.md) — описание архитектуры и дорожная карта.

## Сборка

```bash
npm ci
npm run build     # -> dist/*.zab (установочный пакет для часов)
npm run dev       # разработка в симуляторе
npm run preview   # установка на часы через QR-код (требует zeus login)
```

Готовые сборки: [GitHub Actions](https://github.com/Se7ven/Zepp-HA-Companion/actions) / [Releases](https://github.com/Se7ven/Zepp-HA-Companion/releases) (теги `v*.*.*`).

## Лицензия

MIT. Оффлайн-копия документации Zepp OS в `docs/` (не коммитится) распространяется под Apache-2.0.
