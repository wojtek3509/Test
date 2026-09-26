# TanieBoty — bot Discord

Bot dla serwera sprzedającego boty Discord i hosting. Cały interfejs jest zbudowany na **Components V2**: tytuły w ramce `## ```🤖 TanieBoty × TYTUŁ```` , sekcje z miniaturką, separatory, banery i menu. Cały bot to jeden plik `index.js`.

## Funkcje

| Panel / funkcja | Jak włączyć | Co robi |
| --- | --- | --- |
| 🎫 Tickety | `/panel typ:tickety` | Menu kategorii: Bot discord, Hosting, Pytanie, Współpraca. Formularz i prywatny kanał. Transcript powstaje dopiero po zamknięciu i trafia do logów oraz do klienta w DM. |
| 📜 Regulamin | `/panel typ:regulamin` | Lista §1–§4 i menu, które pokazuje wybraną sekcję. Opcjonalny przycisk „Akceptuję regulamin” nadający rolę. |
| ⭐ Opinie | `/panel typ:opinie` | Panel jest zawsze na dole kanału (po każdej opinii wysyła się od nowa). Przycisk „Wystaw opinię” i formularz: produkt, **jakość bota**, **czas realizacji**, **obsługa klienta** (1–5 ⭐) i treść. Panel pokazuje średnie ocen na żywo. Po zamknięciu ticketu klient dostaje w DM przycisk do opinii. |
| 🤔 Czy legit? | `/panel typ:legit` | ✅ jest liczone (bez reakcji bota) i zapisywane w bazie, a nazwa kanału (`czy-legit→404`) aktualizuje się sama co 10 minut. ❌ jest zawsze usuwane, a autor dostaje przerwę na 7 dni. Staff i admini nie dostają przerwy. |
| ✅ Vouche | `/panel typ:vouch` | Panel „Jak napisać voucha?” na kanale legit checków: wzór `+rep @sprzedawca Co zakupiłeś [ Kwota PLN ] [ Forma płatności ]` i przykłady. Po każdym vouchu przenosi się na dół kanału. Każdy vouch zaczynający się od `+rep` dostaje ✅ i liczy się do licznika. |
| 💰 Cennik | `/panel typ:cennik` | Ceny botów i hostingu oraz przyciski „Zamów bota” / „Kup hosting”, które od razu otwierają ticket. |
| 🎉 Konkursy | `/konkurs start` | Przycisk „Dołącz [ 171 osób \| 0.58% ]”, lista uczestników, automatyczne losowanie, `/konkurs zakoncz` i `/konkurs reroll`. |
| 🚀 Boosty | `/setup boosty:#kanał` | Podziękowanie z avatarem, datą, łączną liczbą boostów i poziomem serwera. |
| 🏗️ Generator serwera | `/generuj` | Po potwierdzeniu **usuwa wszystkie kanały** i tworzy gotowy serwer: role, kategorie `━━ 📢 INFORMACJE ━━`, kanały `🎉┃konkursy` z uprawnieniami. Sam konfiguruje bota i wysyła panele. Podsumowanie trafia w DM i na staff-czat. |
| 📈 Statystyki | `/statystyki` | Tickety, opinie i konkursy. |

## Zamykanie ticketu i legit check

1. Staff klika **Zamknij** i wybiera **✅ Zrealizowane** albo **❌ Niezrealizowane**.
2. **Zrealizowane** otwiera formularz: nazwa produktu (np. *Bot do exchange*), cena (np. *50 PLN*) i płatność (BLIK, LTC, BTC, PayPal…).
3. W tickecie pojawia się karta „Zamówienie zrealizowane” z gotowym wzorem repa, np. `+rep @sprzedawca Bot do exchange [ 50 PLN ] [ LTC ]`. Przycisk **📋 Skopiuj wzór** podaje go jako zwykły tekst do skopiowania.
4. Klient wysyła repa na kanale legit checków (`/setup legitcheck:#kanał`). Rep musi zaczynać się od `+rep`. Na inną wiadomość bot odpowie wzorem i ticket się nie zamknie. Gdy rep jest poprawny, bot:
   - dodaje reakcję ✅,
   - przenosi panel „Jak napisać voucha?” (wzór i przykłady) na dół kanału,
   - podbija licznik w nazwie kanału,
   - **sam zamyka ticket**: transcript i podsumowanie trafiają na kanał logów, a klient dostaje w DM transcript i przycisk do opinii.
5. **Niezrealizowane** zamyka ticket od razu (z opcjonalnym powodem). Staff może też użyć przycisku **Zamknij bez repa**.

„Zrealizowane” działa dopiero po ustawieniu kanału legit checków. Kliknięcie „Skopiuj wzór” nigdy nie zamyka ticketu.

## Instalacja

1. W Developer Portal utwórz bota i zaproś go linkiem, który bot wypisze w konsoli (uprawnienia Administratora).
2. Wgraj `index.js` i `package.json`. Skopiuj `config.example.json` jako `config.json` i wpisz `token` oraz `guildId` (ID serwera, nie bota).
3. Uruchom: `npm install`, a potem `node index.js`.
4. Na serwerze:
   - `/setup kategoria:<kategoria> staff:<rola> logi:#logi opinie:#opinie boosty:#boosty legitcheck:#legit-check [rola-regulamin] [liczniki]`
   - `/panel typ:tickety`, `regulamin`, `opinie`, `legit`, `cennik` (każdy z opcjonalnym `baner:<link do obrazka>`)

W Developer Portal → **Bot** włącz **Message Content Intent**. Dzięki temu bot sprawdza, czy rep zaczyna się od `+rep`. Bez niego bot też wystartuje, ale wtedy rep musi oznaczać sprzedawcę.

Liczniki w nazwach kanałów (czy legit, legit check, opinie) są zapisywane w bazie od razu, a nazwy kanałów aktualizują się co 10 minut. To limit Discorda: nazwę kanału można zmienić tylko 2 razy na 10 minut.

Boosty: bot reaguje na systemowe wiadomości Discorda o boostach, więc w **Ustawienia serwera → Ogólne → Kanał wiadomości systemowych** zostaw włączone „Wysyłaj wiadomość, gdy ktoś wzmocni serwer”.

## Personalizacja

Na początku `index.js`, w sekcji **KONFIGURACJA**:

- `brand`: nazwa, emoji i hasło w stopce.
- `ticketTypes`: kategorie ticketów i pola formularzy.
- `rules`: treść regulaminu.
- `pricing`: cennik.
- `reviewCriteria` / `reviewProducts`: oceny w opiniach.
- `vouchExamples`: przykładowe vouche w panelu.
- `payments`: metody płatności w formularzu „Zrealizowane”.
- `legitTimeoutDays`: długość przerwy za ❌ w dniach (`0` wyłącza przerwę).
- `counterNames`: format nazw kanałów z licznikiem.
- `serverLayout`: role, kategorie i kanały tworzone przez `/generuj`.

Własne emoji wgrywasz w Developer Portal → Emojis. Kod w formacie `<:nazwa:id>` wklejasz zamiast zwykłego emoji.

`node index.js --check` sprawdza wszystkie widoki offline.
