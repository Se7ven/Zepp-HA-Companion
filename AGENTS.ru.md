# AGENTS.md

Инструкции для AI-агентов, работающих с этим репозиторием.

[English](AGENTS.md) | [Русский](AGENTS.ru.md) | [Polski](AGENTS.pl.md)

## Политика языков документации

Вся проектная документация (все `*.md` в корне репозитория) ведётся на **трёх языках:
английский, русский, польский**.

- `README.md` / `AGENTS.md` — канонические английские версии; `.ru.md` / `.pl.md` — переводы.
- Любое изменение документации применяется **ко всем трём языковым версиям в одном коммите**.
- Каждая языковая версия начинается со строки переключения языков с перекрёстными ссылками.
- Переводы точны; блоки кода, пути и идентификаторы не переводятся.

## О проекте

**Zepp HA Companion** — приложение-компаньон для интеграции [Home Assistant](https://www.home-assistant.io/)
с умными часами Amazfit на базе Zepp OS.

- **Целевое устройство:** Amazfit Balance 3 (круг, 480x480, `deviceSource` `11141376`/`11141377`/`11141379`)
- **Целевая ОС:** последняя Zepp OS (на момент написания — Zepp OS 5/6; максимальный `API_LEVEL` у Balance 3 — 4.4)
- **Конфигурация приложения:** `apiVersion` `compatible/target/minVersion = 4.0` в `app.json`
  (официальные сэмплы уровня 4.x используют именно эту комбинацию; при необходимости поднять —
  проверьте поддерживаемые значения в `docs/reference/app-json.mdx`)

## Ключевые ссылки

| Что | Где |
| --- | --- |
| Оффлайн-документация (источник docs.zepp.com, mdx) | `docs/` — **в gitignore, не коммитить**; обновлять `scripts/update-docs.sh` |
| Онлайн-документация | https://docs.zepp.com/ |
| Консоль разработчика (appid, публикация) | https://console.zepp.com/ |
| Официальные сэмплы | https://github.com/zepp-health/zeppos-samples (`application/4.0/fetch-api` — ближайший по архитектуре пример) |
| Документация (исходники) | https://github.com/zepp-health/zeppos-docs |
| Zeus CLI (сборка) | https://www.npmjs.com/package/@zeppos/zeus-cli |
| Скаффолдер модулей | https://github.com/zepp-health/create-zos |

Документация в `docs/` лицензирована Apache-2.0 (см. `docs/.LICENSE.txt`), используется только локально.

## Архитектура Zepp OS (важно понимать)

- **Pages** (`page/`) — UI на часовом устройстве, исполняются в QuickJS на самих часах.
  Сеть напрямую из page **недоступна**.
- **App-Side Service** (`app-side/`) — сервис-компаньон с доступом к сети (`fetch`, `WebSocket`),
  запускается при обращении со страницы. Общение page ↔ side — через `@zeppos/zml`
  (`BasePage` → `this.request({ method, ... })` ↔ `BaseSideService.onRequest(req, res)`).
  Работает поверх Bluetooth-канала с телефоном: реальный сетевой запрос выполняет телефон через Zepp/Zepp Health приложение.
- **Setting** (`setting/`) — настройки приложения в телефоне (Zepp App → App Settings UI),
  значения приходят в `settingsStorage` (`ha_config`: `{ url, token }`). **Пока не создан** —
  добавить: `npx create-zos module setting`.
- Home Assistant: REST (`GET /api/`, `GET /api/states`, `POST /api/services/...`) +
  Long-Lived Access Token. Долговременное WebSocket-соединение на часах нестабильно —
  для скелета выбран REST-поллинг; решение зафиксировать в ADR/docs после проверки.

## Команды

```bash
npm ci              # установка зависимостей
npm run dev         # разработка с превью в симуляторе (zeus dev)
npm run preview     # установка на реальные часы через QR (zeus preview, требует zeus login)
npm run build       # сборка установочного пакета -> dist/*.zab
scripts/update-docs.sh   # обновить оффлайн-документацию docs/
```

Добавление модулей (страница, side service, settings и т.п.) — официальным скаффолдером,
он правит `app.json` автоматически:

```bash
npx create-zos@latest module page        # новая страница
npx create-zos@latest module setting     # экран настроек в телефоне
npx create-zos@latest module app-side    # side service
```

CI: GitHub Actions (`.github/workflows/`). `build.yml` собирает `.zab` и загружает артефакт;
`release.yml` публикует Release по тегу `v*.*.*`. Локально артефакт лежит в `dist/`.

## Структура

```
app.js                  # точка входа устройства (App lifecycle)
app.json                # конфигурация мини-приложения (appId, apiVersion, targets, i18n)
page/
  home/                 # главная страница (index.page.js + index.layout/)
  i18n/                 # переводы UI (en-US.po, ru-RU.po, zh-CN.po)
app-side/
  index.js              # сетевой мост к Home Assistant (fetch через телефон)
  i18n/
setting/                # (TODO) настройки HA в телефоне
utils/config/constants.js  # ключи хранилища, дефолты
assets/common.r|common.s   # ресурсы под форматы экранов (r - круглый 480)
docs/                   # ОФФЛАЙН-КОПИЯ доков Zepp OS, в gitignore
scripts/                # служебные скрипты
```

## Конвенции

- Язык кода — JavaScript (ES modules, не TypeScript; типы через `@zeppos/device-types` + `jsconfig.json`).
- UI-виджеты: `import * as hmUI from '@zos/ui'`; layout-параметры — в `index.[pf].layout.js`
  (`[pf]` подставляется платформой: `r`/`s`).
- Переводы: формат `.po`, ключи через i18n; не хардкодить строки в UI.
- `app.json`: `appId` сейчас **плейсхолдер** `29331` (из шаблона). Реальный id выдаётся в
  console.zepp.com — присвоить перед публикацией. Не менять `configVersion`.
- Не коммитить: `node_modules/`, `dist/`, `docs/`, `.zab`, секреты. HA-токен не хранить в репозитории.
- Версионирование: семантическое, синхронно в `package.json` и `app.json` (`app.version.name`).
- Политика языков документации: см. раздел выше — вся документация на EN/RU/PL с перекрёстными ссылками.

## Дорожная карта (скелет)

- [ ] `setting/` — экран настроек Zepp App (URL HA + токен) с записью в `settingsStorage`
- [ ] Home page → вызов `TEST_CONNECTION` / `GET_STATES` из `app-side/`
- [ ] Список избранных сущностей + переключение сервисов (light switch и т.п.)
- [ ] Кэширование и деградация при недоступности HA
- [ ] Решить: REST-поллинг vs WebSocket; частота обновления vs батарея
- [ ] Иконка приложения, скриншоты, публикация в каталог

## Известные подводные камни

- Сеть есть только в app-side; из page — только `this.request(...)` (zml).
- `zeus preview` требует логина аккаунтом разработчика; `zeus build` — нет (проверено в CI-сценарии).
- `@zeppos/zml` — зависимость рантайма, держим в `dependencies` (не `devDependencies`).
- Документация в `docs/` — снапшот; перед принятием решений по API сверяйтесь с онлайном
  и `@zeppos/device-types` (версии в `node_modules/@zeppos/device-types/index.d.ts`).
