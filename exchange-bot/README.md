# CompV2 Exchange Bot

Bot na Discorda do obsługi exchange'u z zaawansowanymi ticketami. Cały interfejs korzysta z **Components V2** (kontenery, sekcje, miniatury, separatory, galerie), więc wiadomości wyglądają nowocześniej niż klasyczne embedy.

## Funkcje

- **Panel ticketów**: baner, ikona serwera, lista kategorii i menu wyboru. Dodatkowo przyciski „Kursy i prowizje” oraz „Moje tickety”.
- **4 kategorie**: Exchange, Pomoc, Współpraca, Zgłoszenie (edytowalne w `src/config.js`).
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
   cp .env.example .env   # uzupełnij DISCORD_TOKEN, CLIENT_ID, GUILD_ID
   npm run deploy         # rejestruje komendy slash
   npm start
   ```

4. Na serwerze:
   - `/setup kategoria:<kategoria> staff:<rola> logi:<#kanał> [baner:<link>] [limit:<liczba>]`
   - `/panel`, aby wysłać panel ticketów
   - opcjonalnie `/kurs ustaw od:BLIK do:Litecoin prowizja:8`

## Struktura

```
src/
  config.js           nazwa, kolory, kategorie, metody płatności, statusy
  ui.js               wszystkie widoki Components V2 i modale
  db.js               zapis danych w data/db.json
  handlers/tickets.js logika ticketów
  commands/           komendy slash
  index.js            start bota i routing interakcji
  deploy.js           rejestracja komend
  selftest.js         walidacja komponentów offline (npm run check)
```

## Uwagi

- Dane (ustawienia, tickety, oceny) są w `data/db.json`. Plik nie trafia do gita.
- Transcript zapisuje zwykłe wiadomości z kanału. Kontenery Components V2 (np. karta ticketu) nie są w nim renderowane, ale ich dane są w logu zamknięcia.
- Nazwę, stopkę i kolory zmienisz w `src/config.js`.
