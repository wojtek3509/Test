# CompV2 Exchange Bot

Bot na Discorda do obsługi exchange'u z zaawansowanymi ticketami. Cały interfejs korzysta z **Components V2** (kontenery, sekcje, miniatury, separatory, galerie), więc wiadomości wyglądają nowocześniej niż klasyczne embedy.

## Funkcje

- **Panel ticketów**: baner, ikona serwera, lista kategorii i menu wyboru. Dodatkowo przyciski „Kursy i prowizje” oraz „Moje tickety”.
- **4 kategorie**: Exchange, Pomoc, Współpraca, Zgłoszenie (edytowalne na początku `index.js`).
- **Formularz wymiany**: listy wyboru metod bezpośrednio w modalu (BLIK, przelew, PayPal, Revolut, PSC, BTC, LTC, ETH, USDT). Bot liczy prowizję i kwotę do otrzymania.
- **Ticket**: prywatny kanał z numeracją `exchange-0001`, avatarem autora, szczegółami i pingiem staffu.
- **Przejmowanie** ticketu przez staff i **statusy wymiany** (oczekuje na płatność → otrzymana → w realizacji → zrealizowano). Kolor kontenera zmienia się razem ze statusem.
- **Zamykanie** z potwierdzeniem i opcjonalnym powodem. Transcript HTML trafia na kanał logów i do autora w DM.
- **Oceny 1–5 ⭐** w DM po zamknięciu, zapisywane w statystykach i logach.
- **Limit** otwartych ticketów na osobę.
- `/kurs` do ustawiania prowizji dla kierunków wymiany. `/kalkulator` dla użytkowników.
- `/statystyki`: otwarte i zamknięte tickety, średnia ocena, top staff.
- `/ogloszenie`: ładne ogłoszenia (tytuł, treść w Markdown, obrazek) przez formularz.
- `/ticket dodaj|usun|nazwa|zamknij`.

## Instalacja

Wymagany Node.js 18.17+.

1. Utwórz aplikację na <https://discord.com/developers/applications> i dodaj bota.
2. Zaproś bota z zakresami `bot` i `applications.commands` oraz uprawnieniami: *Manage Channels*, *Manage Roles*, *View Channels*, *Send Messages*, *Manage Messages*, *Attach Files*, *Read Message History*.
3. Zainstaluj zależności i uzupełnij konfigurację:

   ```bash
   cd exchange-bot
   npm install
   cp config.example.json config.json   # wpisz token i guildId
   npm start                           # albo: node index.js
   ```

4. Na serwerze:
   - `/setup kategoria:<kategoria> staff:<rola> logi:<#kanał> [baner:<link>] [limit:<liczba>]`
   - `/panel`, aby wysłać panel ticketów
   - opcjonalnie `/kurs ustaw od:BLIK do:Litecoin prowizja:8`

### Token: config.json albo .env

Najprościej jest skopiować `config.example.json` jako `config.json` i wpisać:

```json
{
  "token": "token bota",
  "guildId": "ID serwera (albo puste)"
}
```

Zamiast tego możesz ustawić zmienne `DISCORD_TOKEN` i `GUILD_ID` w pliku `.env` lub w panelu hostingu. Mają one pierwszeństwo przed `config.json`.

## Struktura

Cały bot jest w jednym pliku `index.js`, podzielonym na sekcje:

- **KONFIGURACJA**: nazwa, kolory, kategorie, metody płatności, statusy
- **BAZA DANYCH**: zapis w `data/db.json`
- **WIDOKI COMPONENTS V2**: panel, karta ticketu, modale, logi, statystyki
- **TICKETY**: otwieranie, przejmowanie, statusy, zamykanie, oceny
- **KOMENDY SLASH**: `/setup`, `/panel`, `/kurs`, `/kalkulator`, `/ticket`, `/statystyki`, `/ogloszenie`
- **START**: logowanie i rejestracja komend

Komendy rejestrują się same przy każdym starcie: na serwerze z `GUILD_ID` od razu, a bez niego globalnie (to może potrwać do godziny).

`node index.js --check` sprawdza wszystkie komponenty offline, bez tokena.

## Uwagi

- Dane (ustawienia, tickety, oceny) są w `data/db.json`. Plik nie trafia do gita.
- Transcript zapisuje zwykłe wiadomości z kanału. Kontenery Components V2 (np. karta ticketu) nie są w nim renderowane, ale ich dane są w logu zamknięcia.
- Nazwę, stopkę i kolory zmienisz w sekcji KONFIGURACJA w `index.js`.
