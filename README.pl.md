# Zepp HA Companion

[![Build](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml/badge.svg)](https://github.com/Se7ven/Zepp-HA-Companion/actions/workflows/build.yml)

[English](README.md) | [Русский](README.ru.md) | [Polski](README.pl.md)

Aplikacja towarzysząca integrująca [Home Assistant](https://www.home-assistant.io/)
ze smartwatchami **Amazfit** działającymi pod systemem **Zepp OS**.

- Urządzenie docelowe: **Amazfit Balance 3** (480x480, Zepp OS 5/6, API_LEVEL do 4.4)
- Architektura: mini-aplikacja Zepp OS (strony na zegarku + usługa app-side z dostępem do sieci przez telefon)
- Połączenie z Home Assistant: REST API + Long-Lived Access Token

## Funkcje

- **Ekran główny (hub)** — obszary Home Assistant włączone w ustawieniach; każdy otwiera
  listę encji pogrupowaną po typach (światła, przełączniki, sceny, skrypty, automatyzacje …)
  z przełączaniem po dotknięciu.
- **6 konfigurowalnych ekranów widżetów** — przewijane swipe'em w lewo/prawo od huba. Każdy
  przycisk konfiguruje się z telefonu: etykieta, kształt, rozmiar, pozycja w siatce, kolor
  (oddzielnie dla stanu WŁ. i WYŁ.) oraz akcja (auto-przełącz / uruchom / włącz / wyłącz).
- **Konfiguracja z telefonu** — w oficjalnej aplikacji Zepp (Ustawienia aplikacji): połączenie
  (URL HA + token), wykrywanie encji, przełączniki obszarów i encji oraz edytor ekranów widżetów.

- **Material Design Icons** — dokładnie ten sam zestaw ikon, którego używa Home Assistant:
  każdy wiersz na listach obszarów pokazuje ikonę domeny, a każdemu przyciskowi widżetu można
  przypisać jedną z 70 ikon w edytorze ustawień.
- **Działa offline / łagodna degradacja** — ostatnie znane stany są buforowane; gdy
  Home Assistant jest niedostępny, zegarek pokazuje dane z cache (z ich wiekiem) zamiast błędu.

## Odświeżanie i bateria

Stany są odświeżane przy każdym uruchomieniu aplikacji, a dopóki aplikacja jest otwarta —
automatycznie nie częściej niż raz na 5 minut. Zepp OS nie pozwala aplikacjom zewnętrznym na
dostęp do sieci w tle — to limit platformy, a pamięć podręczna pokrywa przerwy.

## Konfiguracja

1. Home Assistant → twój profil użytkownika → **Długoterminowe tokeny dostępu** — utwórz token.
2. W aplikacji Zepp otwórz **Ustawienia** aplikacji: podaj bazowy URL HA
   (np. `http://192.168.1.10:8123`) i token, a następnie naciśnij **Synchronizuj**.
3. Włącz obszary i encje, które chcesz mieć na zegarku; jeśli chcesz, skonfiguruj ekrany widżetów.
4. Otwórz aplikację na zegarku — stany są odświeżane przy każdym uruchomieniu.

## Budowanie

```bash
npm ci
npm run build     # -> dist/*.zab (pakiet instalacyjny dla zegarka)
npm run dev       # development w symulatorze
npm run preview   # instalacja na zegarku przez kod QR (wymaga zeus login)
```

Gotowe paczki: [GitHub Actions](https://github.com/Se7ven/Zepp-HA-Companion/actions) /
[Releases](https://github.com/Se7ven/Zepp-HA-Companion/releases) (tagi `v*.*.*`).

## Dokumentacja

Uwagi dla programistów, architektura i konwencje: [AGENTS.pl.md](AGENTS.pl.md)
([English](AGENTS.md) | [Русский](AGENTS.ru.md)).

## Licencja

MIT. Lokalna kopia dokumentacji Zepp OS w `docs/` (nie commitowana) rozpowszechniana na licencji Apache-2.0.

Osadzona czcionka UI zegarka (`assets/*/fonts/ha-icons.ttf`) to podzbiór
[Material Design Icons](https://pictogrammers.com/library/mdi/) v7.4.47 autorstwa Pictogrammers,
używany na licencji [SIL Open Font License 1.1](https://scripts.sil.org/OFL).
