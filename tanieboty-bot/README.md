# TanieBoty — bot Discord

Bot dla serwera sprzedającego boty Discord i hosting. Cały interfejs jest zbudowany na **Components V2**: tytuły w ramce `# \`🤖 TanieBoty × TYTUŁ\``, sekcje z miniaturką, separatory, banery i menu. Cały bot to jeden plik `index.js`.

## Funkcje

| Panel / funkcja | Jak włączyć | Co robi |
| --- | --- | --- |
| 🎫 Tickety | `/panel typ:tickety` | Menu kategorii: Bot discord, Hosting, Pytanie, Współpraca. Formularz, prywatny kanał, przejmowanie i etapy zamówienia z paskiem postępu. Transcript powstaje dopiero po zamknięciu i trafia do logów oraz do klienta w DM. |
| 📜 Regulamin | `/panel typ:regulamin` | Lista §1–§4 i menu, które pokazuje wybraną sekcję. Opcjonalny przycisk „Akceptuję regulamin” nadający rolę. |
| ⭐ Opinie | `/panel typ:opinie` | Przycisk „Wystaw opinię” i formularz: produkt, **jakość bota**, **czas realizacji**, **obsługa klienta** (1–5 ⭐) i treść. Panel pokazuje średnie ocen na żywo. Po zamknięciu ticketu klient dostaje w DM przycisk do opinii. |
| 🤔 Czy legit? | `/panel typ:legit` | Reakcje ✅ ❌, licznik w nazwie kanału (`czy-legit→404`) i automatyczne wyciszenie za ❌. |
| 💰 Cennik | `/panel typ:cennik` | Ceny botów i hostingu oraz przyciski „Zamów bota” / „Kup hosting”, które od razu otwierają ticket. |
| 🎉 Konkursy | `/konkurs start` | Przycisk „Dołącz [ 171 osób \| 0.58% ]”, lista uczestników, automatyczne losowanie, `/konkurs zakoncz` i `/konkurs reroll`. |
| 🚀 Boosty | `/setup boosty:#kanał` | Podziękowanie z avatarem, datą, łączną liczbą boostów i poziomem serwera. |
| 📈 Statystyki | `/statystyki` | Tickety, opinie i konkursy. |

## Zamykanie ticketu i legit check

1. Staff klika **Zamknij** i wybiera **✅ Zrealizowane** albo **❌ Niezrealizowane**.
2. **Zrealizowane** otwiera formularz: nazwa produktu (np. *Bot do exchange*), cena (np. *50 PLN*) i płatność (BLIK, LTC, BTC, PayPal…).
3. W tickecie pojawia się karta „Zamówienie zrealizowane” z gotowym wzorem repa, np. `+rep @sprzedawca Bot do exchange | 50 PLN | LTC`. Przycisk **📋 Skopiuj wzór** podaje go jako zwykły tekst do skopiowania.
4. Klient wysyła repa na kanale legit checków (`/setup legitcheck:#kanał`). Bot:
   - dodaje reakcję ✅,
   - odpowiada kartą „Legit check #0012” z danymi zamówienia,
   - podbija licznik w nazwie kanału,
   - **sam zamyka ticket**: transcript i podsumowanie trafiają na kanał logów, a klient dostaje w DM transcript i przycisk do opinii.
5. **Niezrealizowane** zamyka ticket od razu (z opcjonalnym powodem). Staff może też użyć przycisku **Zamknij bez repa**.

Bez ustawionego kanału legit checków ticket zamyka się od razu po wypełnieniu formularza.

## Instalacja

1. W Developer Portal utwórz bota i zaproś go linkiem, który bot wypisze w konsoli (uprawnienia Administratora).
2. Wgraj `index.js` i `package.json`. Skopiuj `config.example.json` jako `config.json` i wpisz `token` oraz `guildId` (ID serwera, nie bota).
3. Uruchom: `npm install`, a potem `node index.js`.
4. Na serwerze:
   - `/setup kategoria:<kategoria> staff:<rola> logi:#logi opinie:#opinie boosty:#boosty legitcheck:#legit-check [rola-regulamin] [liczniki]`
   - `/panel typ:tickety`, `regulamin`, `opinie`, `legit`, `cennik` (każdy z opcjonalnym `baner:<link do obrazka>`)

Bot nie wymaga żadnych uprzywilejowanych intentów.

Boosty: bot reaguje na systemowe wiadomości Discorda o boostach, więc w **Ustawienia serwera → Ogólne → Kanał wiadomości systemowych** zostaw włączone „Wysyłaj wiadomość, gdy ktoś wzmocni serwer”.

## Personalizacja

Na początku `index.js`, w sekcji **KONFIGURACJA**:

- `brand`: nazwa, emoji i hasło w stopce.
- `ticketTypes`: kategorie ticketów i pola formularzy.
- `statuses`: etapy zamówienia.
- `rules`: treść regulaminu.
- `pricing`: cennik.
- `reviewCriteria` / `reviewProducts`: oceny w opiniach.
- `payments`: metody płatności w formularzu „Zrealizowane”.
- `legitTimeoutMinutes`: długość wyciszenia za ❌ (`0` wyłącza wyciszenie).
- `counterNames`: format nazw kanałów z licznikiem.

Własne emoji wgrywasz w Developer Portal → Emojis. Kod w formacie `<:nazwa:id>` wklejasz zamiast zwykłego emoji.

`node index.js --check` sprawdza wszystkie widoki offline.
