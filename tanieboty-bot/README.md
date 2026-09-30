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
| 💰 Cennik | `/panel typ:cennik` | Cennik hostingu (1 miesiąc 5 zł, 3 miesiące 14 zł, 1 rok 50 zł) i przycisk „Kup hosting”, który od razu otwiera ticket z wyborem pakietu. |
| 🎉 Konkursy | `/konkurs start` | Przycisk „Dołącz [ 171 osób \| 0.58% ]”, lista uczestników, automatyczne losowanie, `/konkurs zakoncz` i `/konkurs reroll`. |
| 🚀 Boosty | `/setup boosty:#kanał` | Podziękowanie z avatarem, datą, łączną liczbą boostów i poziomem serwera. |
| 🗂️ Osobne kategorie i logi | `/generuj` albo `/ustaw-ticket` | Każdy rodzaj ticketu (bot, hosting, pytanie, współpraca) tworzy się w swojej kategorii, a log po zamknięciu trafia na swój kanał (`logi-boty`, `logi-hosting`, `logi-pytania`, `logi-współpraca`). Bez ustawień dla rodzaju używana jest kategoria i logi z `/setup`. |
| 🏗️ Generator serwera | `/generuj` | Po potwierdzeniu **usuwa wszystkie kanały** i tworzy gotowy serwer: role, kategorie `━━ 📢 INFORMACJE ━━`, kanały `🎉┃konkursy` z uprawnieniami. Sam konfiguruje bota i wysyła panele. Podsumowanie trafia w DM i na staff-czat. |
| 👋 Powitania | `/setup powitania:#kanał` (lub `/generuj`) | „Nowa osoba” z avatarem, numerem członka i tekstem powitalnym. |
| 📩 Zaproszenia | `/setup zaproszenia:#kanał` (lub `/generuj`) | Wiadomość „@osoba właśnie zawitała do nas z zaproszenia od @x / przez link .gg/…”. Komendy `/zaproszenia sprawdz`, `ranking`, `bonus`, `reset`. Liczy prawdziwe, fałszywe (konto < 7 dni) i te, które wyszły. |
| 🤖 Auto LC | `/autolc` | Za każdego klienta, który po „Zrealizowane” nie napisał repa, bot wysyła voucha przez webhook z nazwą konta klienta i dopiskiem `[AUTO LC]` (z jego avatarem), zamyka ticket i wysyła log. |
| 🗄️ Spójność bazy | automatycznie | Usunięta opinia znika z bazy i ze średnich. Usunięty konkurs zostaje anulowany. Usunięty panel „czy legit” zeruje głosy. Ręcznie usunięty kanał ticketu zamyka ticket w bazie (z informacją w logach). Liczba vouchy (`legit-check→N`) = liczba zrealizowanych zamówień. |
| 📈 Statystyki | `/statystyki` | Tickety, opinie i konkursy. |
| 🖥️ Hosting | `/panel typ:cennik` + `config.json → hosting` | Sprzedaż hostingu botów na Twoim panelu Pterodactyl: zakup automatyczny za krypto (serwer tworzy się sam), zakup ręczny w tickecie, przypomnienia, blokada po terminie i przedłużanie. Szczegóły niżej. |

## Zamykanie ticketu i legit check

1. Staff klika **Zamknij** i wybiera **✅ Zrealizowane** albo **❌ Niezrealizowane**.
2. **Zrealizowane** otwiera formularz: nazwa produktu (np. *Bot do exchange*), cena (np. *50 PLN*) i płatność (BLIK, LTC, BTC, PayPal…).
3. W tickecie pojawia się karta „Zamówienie zrealizowane” z gotowym wzorem repa, np. `+rep @sprzedawca Bot do exchange [ 50 PLN ] [ LTC ]`. Przycisk **📋 Skopiuj wzór** podaje go jako zwykły tekst do skopiowania.
4. Klient wysyła repa na kanale legit checków (`/setup legitcheck:#kanał`). Rep musi zaczynać się od `+rep`. Na inną wiadomość bot odpowie wzorem i ticket się nie zamknie. Gdy rep jest poprawny, bot:
   - dodaje reakcję ✅,
   - przenosi panel „Jak napisać voucha?” (wzór i przykłady) na dół kanału,
   - podbija licznik w nazwie kanału,
   - **sam zamyka ticket**: transcript i podsumowanie trafiają na kanał logów, a klient dostaje w DM transcript i przycisk do opinii.
5. Tickety **Pytanie** i **Współpraca** nie mają wyboru zrealizowane/niezrealizowane: „Zamknij” od razu otwiera formularz z powodem, a w logach wynik to „🔒 Zamknięte”.
6. **Niezrealizowane** zamyka ticket od razu (z opcjonalnym powodem). Staff może też użyć przycisku **Zamknij bez repa**.

„Zrealizowane” działa dopiero po ustawieniu kanału legit checków. Kliknięcie „Skopiuj wzór” nigdy nie zamyka ticketu.

## Instalacja

1. W Developer Portal utwórz bota i zaproś go linkiem, który bot wypisze w konsoli (uprawnienia Administratora).
2. Wgraj `index.js` i `package.json`. Skopiuj `config.example.json` jako `config.json` i wpisz `token` oraz `guildId` (ID serwera, nie bota).
3. Uruchom: `npm install`, a potem `node index.js`.
4. Na serwerze:
   - `/setup kategoria:<kategoria> staff:<rola> logi:#logi opinie:#opinie boosty:#boosty legitcheck:#legit-check [rola-regulamin] [liczniki]`
   - `/panel typ:tickety`, `regulamin`, `opinie`, `legit`, `cennik` (każdy z opcjonalnym `baner:<link do obrazka>`)

W Developer Portal → **Bot** włącz **Message Content Intent** i **Server Members Intent** (ten drugi jest potrzebny do powitań i zaproszeń). Do ustalania, kto kogo zaprosił, bot potrzebuje uprawnienia **Zarządzanie serwerem** (Administrator wystarcza). Dzięki temu bot sprawdza, czy rep zaczyna się od `+rep`. Bez niego bot też wystartuje, ale wtedy rep musi oznaczać sprzedawcę.

Liczniki w nazwach kanałów (czy legit, legit check, opinie) są zapisywane w bazie od razu, a nazwy kanałów aktualizują się co 10 minut. To limit Discorda: nazwę kanału można zmienić tylko 2 razy na 10 minut.

Boosty: bot reaguje na systemowe wiadomości Discorda o boostach, więc w **Ustawienia serwera → Ogólne → Kanał wiadomości systemowych** zostaw włączone „Wysyłaj wiadomość, gdy ktoś wzmocni serwer”.

## Banery (grafiki/)

Bot sam dołącza niebieskie banery TanieBoty z folderu `grafiki/` (obok `index.js`): pod panelami (tickety, regulamin, cennik, opinie, czy legit, vouche), pod konkursami, powitaniami, zaproszeniami i podziękowaniami za boosty. Nie trzeba wklejać linków.

- Własny obrazek zamiast wbudowanego: `/panel typ:… baner:<link>`.
- Bez baneru: `/panel typ:… baner:brak`.
- Powrót do banera TanieBoty: `/panel typ:… usun-baner:True`.

Brak folderu `grafiki/` na serwerze bota oznacza wiadomości bez banerów. Po wgraniu folderu wyślij panele ponownie (`/panel`).

## Personalizacja

Na początku `index.js`, w sekcji **KONFIGURACJA**:

- `brand`: nazwa, emoji i hasło w stopce.
- `ticketTypes`: kategorie ticketów i pola formularzy.
- `rules`: treść regulaminu.
- `hostingPlans`: pakiety, ceny i liczba dni hostingu.
- `hostingLimits`: RAM, dysk i CPU serwera klienta.
- `hostingLanguages`, `cryptoCoins`, `hostingPayments`, `hostingTimes`: języki, kryptowaluty, metody płatności, czas na wpłatę, liczba potwierdzeń i przypomnienia.
- `reviewCriteria` / `reviewProducts`: oceny w opiniach.
- `vouchExamples`: przykładowe vouche w panelu.
- `payments`: metody płatności w formularzu „Zrealizowane”.
- `legitTimeoutDays`: długość przerwy za ❌ w dniach (`0` wyłącza przerwę).
- `counterNames`: format nazw kanałów z licznikiem.
- `serverLayout`: role, kategorie i kanały tworzone przez `/generuj`.

Własne emoji wgrywasz w Developer Portal → Emojis. Kod w formacie `<:nazwa:id>` wklejasz zamiast zwykłego emoji.

`node index.js --check` sprawdza wszystkie widoki offline.

## 🖥️ Hosting (Pterodactyl)

### Jak to działa

Klient klika **Kup hosting** (cennik albo tickety) i w formularzu wybiera język (Node.js, Python, Java albo inny), okres, sposób zakupu (⚡ automatyczny / ⏳ ręczny), płatność i e-mail (login do panelu). Serwer dostaje nazwę „Język • nazwa klienta”, którą klient zmienia przyciskiem **✏️ Zmień nazwę** (w DM z danymi serwera i w `/moj-hosting`).

**⚡ Automatyczny (tylko krypto: LTC, ETH, USDC na Ethereum, SOL, USDC na Solanie):**
1. Bot przelicza cenę na krypto po aktualnym kursie i dodaje **unikalną końcówkę kwoty** (np. `0.01250417 LTC`). Po niej rozpoznaje wpłatę na Twój jeden adres. W DM wysyła adres, kwotę, kod QR i przyciski „Skopiuj adres” i „Skopiuj kwotę”.
2. Klient ma 30 minut na wpłatę. Bot co 30 sekund sprawdza blockchain przez darmowe publiczne API (Litecoin: litecoinspace.org, zapasowo BlockCypher; Ethereum: Blockscout; Solana RPC). Kursy PLN pobiera z Coinbase, a gdy nie odpowiada, z CoinGecko (opcjonalnie `coingeckoApiKey`, darmowy klucz „Demo”).
3. Po **2 potwierdzeniach** (LTC, ETH) albo statusie **finalized** (Solana) bot sam zakłada konto w panelu, tworzy serwer (256 MB RAM, 1 GB dysku, 25% CPU) i wysyła klientowi w DM link, login i hasło. Log trafia na `logi-hosting`.
4. Zła kwota nie jest zaliczana. Takie wpłaty i wygasłe zamówienia sprawdzasz ręcznie w tickecie, a serwer tworzysz komendą `/hosting utworz`.

**⏳ Ręczny (BLIK, przelew, Revolut albo krypto):** otwiera się ticket z danymi do płatności (`manualPayments` w config.json). Po sprawdzeniu wpłaty staff klika **✅ Potwierdź płatność i utwórz serwer**. Bot tworzy serwer, wysyła klientowi dane w DM i prosi o voucha, jak przy „Zrealizowane”. Inny język: tworzysz serwer sam w panelu i przypisujesz go komendą `/hosting dodaj`.

**Terminy:** 3 dni i 1 dzień przed końcem klient dostaje DM z przyciskiem **Przedłuż**. Po terminie serwer jest **blokowany** (Suspend, pliki zostają). Przedłużenie (automatyczne albo ręczne) **odblokowuje i uruchamia** serwer. Po 7 dniach blokady bot pisze na logach, że serwer można usunąć, ale sam niczego nie usuwa.

### Komendy

| Komenda | Co robi |
| --- | --- |
| `/moj-hosting` | Klient: jego serwery, terminy i przyciski „Przedłuż”. |
| `/hosting lista [uzytkownik]` | Wszystkie serwery klientów i terminy. |
| `/hosting zamowienia` | Zamówienia krypto w toku i z błędami. |
| `/hosting utworz` | Tworzy serwer klientowi (np. po płatności poza botem). |
| `/hosting dodaj` | Przypisuje istniejący serwer z panelu do klienta (terminy, blokada). |
| `/hosting przedluz` | Dolicza dni i odblokowuje serwer. |
| `/hosting limity` | Zmienia RAM, dysk i CPU (np. większa pamięć ustalona w tickecie). |
| `/hosting zablokuj` / `odblokuj` | Ręczna blokada i odblokowanie. |
| `/hosting usun` | Usuwa serwer z panelu (wymaga `potwierdz:True`). |
| `/hosting logi kanal:#…` | Kanał logów zakupów automatycznych. Każde zamówienie to jedna wiadomość aktualizowana na żywo: kwota i kurs, wykryta wpłata (tx), potwierdzenia, utworzony serwer albo wygaśnięcie, anulowanie lub błąd. `/generuj` tworzy kanał `🧾┃logi-zakupy` sam. Bez ustawienia logi idą na `logi-hosting`. |
| `/hosting test` | Sprawdza panel, węzeł i porty, jajka, klucze, kursy, portfele i API blockchainów. |

### Konfiguracja (config.json → `hosting`)

1. **Jajka**: w panelu przejdź do Admin → Nests → Import Egg i zaimportuj `pterodactyl/egg-tanieboty-nodejs.json`, `egg-tanieboty-python.json` i `egg-tanieboty-java.json`. Numer gniazda (`nest`) i jajka (`egg`) widać w adresie strony jajka, np. `/admin/nests/egg/16`. Wpisz je w `hosting.eggs`.
2. **Klucz Application API**: Admin → Application API → Create New. Uprawnienia: *Users*, *Servers* ustaw na **Read & Write**, a *Nodes*, *Allocations*, *Locations*, *Nests* i *Eggs* na **Read**. Klucz (`ptla_…`) wpisz w `apiKey`.
3. **Klucz Client API** (opcjonalny, do automatycznego startu po odblokowaniu): na koncie administratora Account → API Credentials. Klucz (`ptlc_…`) wpisz w `clientApiKey`.
4. **Węzeł**: musi być publiczny (Node Visibility: Public) i mieć wolne porty (Allocation). Każdy klient zajmuje jeden port.
5. **Portfele**: adresy w `wallets.ltc`, `wallets.eth` (ETH i USDC na Ethereum) i `wallets.sol` (SOL i USDC na Solanie). Pusty adres wyłącza daną sieć w zakupie automatycznym.
6. **Płatności ręczne**: teksty w `manualPayments` (BLIK, przelew, Revolut).
7. Zrestartuj bota i uruchom `/hosting test`. Wszystko powinno być na zielono.

`panelUrl` to adres panelu. Jeśli bot działa na tym samym serwerze co panel i `/hosting test` nie łączy się z publicznym IP, wpisz `http://172.18.0.1` (adres hosta widziany z kontenera). Opcjonalnie: `etherscanApiKey` (darmowy klucz Etherscan zamiast Blockscout) i `api` (własne adresy API: `ltc`, `ltcBlockcypher`, `eth`, `ethRpc`, `sol`, `coinbase`, `prices`, `qr`).

Klucze API i config.json trzymaj tylko na swoim serwerze bota. Nie dawaj klientom dostępu do tego serwera.
