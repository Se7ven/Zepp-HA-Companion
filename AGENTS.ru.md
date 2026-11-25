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
Шрифт иконок часов (`assets/*/fonts/ha-icons.ttf`) — подмножество Material Design Icons 7.4.47
(Pictogrammers), SIL OFL 1.1; атрибуция — в README, заметки о генерации — в шапке `utils/icons.js`
(сохранять их при регенерации шрифта).

## Архитектура Zepp OS (важно понимать)

- **Pages** (`page/`) — UI на часовом устройстве, исполняются в QuickJS на самих часах.
  Сеть напрямую из page **недоступна**.
- **App-Side Service** (`app-side/`) — сервис-компаньон с доступом к сети (`fetch`, `WebSocket`),
  запускается при обращении со страницы. Общение page ↔ side — через `@zeppos/zml`
  (`BasePage` → `this.request({ method, ... })` ↔ `BaseSideService.onRequest(req, res)`).
  Работает поверх Bluetooth-канала с телефоном: реальный сетевой запрос выполняет телефон через
  Zepp/Zepp Health приложение.
- **Setting** (`setting/`) — полноценное приложение настроек в телефоне (Zepp App → Настройки
  приложения): подключение (URL HA + токен), обнаружение сущностей, переключатели локаций и
  сущностей, редактор кнопок виджетных экранов. Это настоящее JS мини-приложение
  (`setting/index.js`) с ambient-компонентами (`View`, `Section`, `Toggle`, `Select`,
  `TextInput`, `Button`, ...); представление перестраивается при любом изменении
  `settingsStorage`. Состояние навигации хранится в ключе `ha_ui`.
- **`settingsStorage` доступен только на телефоне.** Side-сервис читает/пишет его через
  `settingsLib` из `@zeppos/zml/base-side`; часы видят его только через side-сервис.
  Телефон пушит изменения на часы: `onSettingsChange` → `this.call({ method })` → `onCall` страницы.
- **Home Assistant:** только REST-поллинг — в Zepp OS **нет WebSocket-клиента**, решение принято.
  Обнаружение (`app-side/index.js: discover()`) получает id и имена сущностей из
  `GET /api/states`, а принадлежность к локациям — из `GET /api/template` с шаблоном Jinja
  (`area_id()`/`area_name()`), поскольку реестр локаций HA иначе недоступен.
  Ответ `/api/template` — это `text/plain`, его **нельзя** парсить как JSON.
- **Кэширование и политика обновления:** side-сервис кэширует последние успешные ответы
  хаба/локаций в `settingsStorage.ha_cache` (на телефоне). `GET_HUB`/`GET_AREA` работают
  live-first: при недоступности HA отдаются кэшированные данные с `cached: true` и `age`,
  а часы показывают янтарный индикатор «Данные из кэша · N мин» вместо ошибки.
  Обновление — при каждом открытии страницы и, пока приложение открыто, автоматически
  не чаще раза в `REFRESH_INTERVAL_MS` (5 минут, `utils/config/constants.js`) — забота о батарее.
- **UI часов:** экраны листаются свайпом по горизонтали через
  `setScrollMode(SCROLL_MODE_SWIPER_HORIZONTAL)` с `VIEW_CONTAINER(page: i)` — максимум 7
  контейнеров на страницу (1 хаб + 6 виджетных экранов встают идеально). `LIST_VIEW` требует
  `API_LEVEL` 5.0 и **недоступен** (таргет — 4.0): прокручиваемые списки собираются из
  строк `BUTTON` внутри `VIEW_CONTAINER(scroll_enable: 1)`. Цвета состояний кнопок берутся
  из настроек (`colorOn`/`colorOff`).
- **Иконки:** `assets/*/fonts/ha-icons.ttf` — подмножество Material Design Icons (того самого
  набора, что использует Home Assistant), перемапленного в BMP PUA `U+E000+`, потому что
  рендерер часов/QuickJS работают с `String.fromCharCode` только в пределах BMP. Виджеты
  подключают его параметром `font: 'fonts/ha-icons.ttf'` (путь относительно каталога assets-цели;
  zeus пакует каталог `fonts/` автоматически). Соответствия и список пикера: `utils/icons.js`
  (`ICON_MAP`/`ICON_CHOICES`/`DOMAIN_ICON`). Текст нельзя «привить» к BUTTON, поэтому иконка
  и подпись — отдельные TEXT-виджеты поверх BUTTON; каждый слой прокидывает тапы, а защитный
  интервал 500 мс гасит дубли.

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
  home/                 # хаб + 6 листаемых свайпом виджетных экранов (index.page.js)
  area/                 # список сущностей локации, сгруппированный по доменам (index.page.js)
  i18n/                 # переводы UI (en-US.po, ru-RU.po, zh-CN.po)
app-side/
  index.js              # REST-мост к HA + обнаружение + синк настроек (fetch через телефон)
setting/
  index.js              # приложение настроек в телефоне (подключение, локации, редактор экранов)
  i18n/                 # переводы UI настроек (en-US.po, ru-RU.po)
utils/
  ha.js                 # хелперы HA: карта сервисов, состояние on/off, разбор id
  icons.js              # карты иконок шрифта (ICON_MAP/ICON_CHOICES/DOMAIN_ICON), шапка OFL
  config/constants.js   # ключи хранилища (STORAGE_KEYS), дефолты, палитра цветов
assets/common.r|common.s   # ресурсы под форматы экранов (r - круглый 480); fonts/ha-icons.ttf (подмножество MDI, OFL-1.1)
docs/                   # ОФФЛАЙН-КОПИЯ доков Zepp OS, в gitignore
scripts/                # служебные скрипты
```

Основной поток данных: приложение настроек пишет `ha_config`/`ha_sync` → side-сервис
реагирует через `onSettingsChange` → `discover()` кэширует `ha_data` → часы запрашивают
`GET_HUB`/`GET_AREA`/`CALL` через zml.

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

## Дорожная карта

- [x] `setting/` — экран настроек Zepp App (URL HA + токен) с записью в `settingsStorage`
- [x] Home page → вызов `GET_HUB` / `GET_AREA` / `CALL` из `app-side/`
- [x] Список сущностей (локации → сущности по типам) с переключением
- [x] 6 настраиваемых виджетных экранов (подпись, размер, позиция, форма, цвета для вкл/выкл, действие)
- [x] Решение: REST-поллинг (WebSocket в Zepp OS нет); локации через `/api/template`
- [x] Кэширование и деградация при недоступности HA
- [x] Частота обновления vs батарея — обновление при открытии + не чаще раза в 5 минут
  на переднем плане (сетевой доступ в фоне запрещён платформой, см. подводные камни)
- [ ] Иконка приложения, скриншоты, публикация в каталог

## Известные подводные камни

- Сеть есть только в app-side; из page — только `this.request(...)` (zml).
- `zeus preview` требует логина аккаунтом разработчика; `zeus build` — нет (проверено в CI-сценарии).
- `@zeppos/zml` — зависимость рантайма, держим в `dependencies` (не `devDependencies`).
- zml передаёт данные чанками ~3.5 КБ — держите полезные нагрузки `GET_HUB`/`GET_AREA`
  компактными (обрезайте атрибуты состояний на стороне сервиса).
- `settingsStorage` доступен только с телефона; в side-сервисе используйте `settingsLib`
  (`@zeppos/zml/base-side`), никогда не импортируйте там `@zos/settings`.
- **Сеть в фоне невозможна для сторонних приложений**: App Service (`app-service/`) не имеет
  ни `fetch`, ни таймеров, а app-side сервис живёт только во время сессии страницы.
  Максимум свежести = кэш + обновление на переднем плане (не чаще раза в 5 мин).
  Не пытайтесь снова добавить фоновый поллинг.
- Кэш лежит в `settingsStorage` (на телефоне): он переживает сбои HA, но если сам канал с
  телефоном недоступен — часы не могут его прочитать, и страница покажет ошибку соединения.
- Документация в `docs/` — снапшот; перед принятием решений по API сверяйтесь с онлайном
  и `@zeppos/device-types` (версии в `node_modules/@zeppos/device-types/index.d.ts`).
