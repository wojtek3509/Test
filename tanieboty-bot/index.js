// TanieBoty — bot Discord dla sklepu z botami, cały w jednym pliku (Components V2).
// Uruchomienie: npm install && node index.js   (sprawdzenie offline: node index.js --check)
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActivityType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  ContainerBuilder,
  Events,
  GatewayIntentBits,
  LabelBuilder,
  MessageFlags,
  MessageType,
  ModalBuilder,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createTranscript } from 'discord-html-transcripts';

// ═══ KONFIGURACJA ══════════════════════════════════════════════════════
// Wszystko, co widać w wiadomościach bota, zmienisz tutaj.
// Emoji może być zwykłe (🤖) albo własne: '<:nazwa:123456789012345678>' (Developer Portal → Emojis).

const brand = {
  name: 'TanieBoty',
  emoji: '🤖',
  tagline: 'Tanie i solidne boty Discord na zamówienie',
  footerEmoji: '💙',
  // Link do serwera (np. 'https://discord.gg/tanieboty'). Gdy ustawiony, nazwa serwera w regulaminie jest klikalna.
  invite: null,
};

// Zdjęcia (miniaturki) pokazujemy tylko przy osobach: w tickecie, opiniach, boostach i powitaniach.
// true = panele i statystyki też dostaną logo serwera / bota.
const panelThumbnails = false;

const style = {
  chevron: '»',
  cross: '×',
  arrow: '➜',
};

const colors = {
  brand: 0x00b0f4,
  success: 0x23a55a,
  warning: 0xf0b232,
  danger: 0xf23f43,
  neutral: 0x2b2d31,
  gold: 0xf5c542,
  boost: 0xf47fff,
};

// Cennik hostingu (/panel typ:cennik) — te same pakiety są do wyboru przy zakupie hostingu.
// [nazwa, cena, id, liczba dni]
const hostingPlans = [
  ['1 miesiąc', '5 zł', '1m', 31],
  ['3 miesiące', '14 zł', '3m', 93],
  ['1 rok', '50 zł', '12m', 365],
];

// Zasoby serwera każdego klienta (MB i % jednego rdzenia). Większe limity: /hosting limity.
const hostingLimits = { memory: 256, disk: 1024, cpu: 25, io: 500, swap: 0, backups: 1, databases: 0 };

// Języki do wyboru przy zakupie. Jajka (nest/egg) ustawiasz w config.json → hosting.eggs.
// manualOnly = tylko zakup ręczny (serwer tworzy właściciel).
const hostingLanguages = {
  nodejs: { label: 'Node.js (discord.js)', emoji: '🟩', files: '`index.js` + `package.json`' },
  python: { label: 'Python (discord.py)', emoji: '🐍', files: '`main.py` + `requirements.txt`' },
  java: { label: 'Java (JDA)', emoji: '☕', files: 'plik `bot.jar` (z zależnościami)' },
  other: { label: 'Inny język (tylko zakup ręczny)', emoji: '🧩', manualOnly: true },
};

// Kryptowaluty do automatycznego zakupu. Bot sam sprawdza blockchain i czeka na potwierdzenia.
// decimals = miejsca po przecinku w sieci, shown = w kwocie dla klienta, step = zaokrąglenie ceny w górę.
const cryptoCoins = {
  ltc: { label: 'LTC', network: 'Litecoin', emoji: '💠', chain: 'ltc', decimals: 8, shown: 8, step: 0.00001, gecko: 'litecoin', rep: 'ltc' },
  eth: { label: 'ETH', network: 'Ethereum', emoji: '💎', chain: 'eth', decimals: 18, shown: 8, step: 0.00001, gecko: 'ethereum', rep: 'eth' },
  usdc_eth: {
    label: 'USDC',
    network: 'Ethereum (ERC-20)',
    emoji: '💵',
    chain: 'eth',
    token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    shown: 6,
    step: 0.01,
    gecko: 'usd-coin',
    rep: 'usdc',
  },
  sol: { label: 'SOL', network: 'Solana', emoji: '🟣', chain: 'sol', decimals: 9, shown: 8, step: 0.00001, gecko: 'solana', rep: 'sol' },
  usdc_sol: {
    label: 'USDC',
    network: 'Solana',
    emoji: '💵',
    chain: 'sol',
    token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    shown: 6,
    step: 0.01,
    gecko: 'usd-coin',
    rep: 'usdc',
  },
};

// Metody płatności przy zakupie hostingu. Krypto działa automatycznie i ręcznie, reszta tylko ręcznie.
// Dane do płatności ręcznej (numer BLIK, konto, Revolut) wpisujesz w config.json → hosting.manualPayments.
const hostingPayments = {
  ltc: { label: 'LTC (Litecoin)', emoji: '💠' },
  eth: { label: 'ETH (Ethereum)', emoji: '💎' },
  usdc_eth: { label: 'USDC (sieć Ethereum)', emoji: '💵' },
  sol: { label: 'SOL (Solana)', emoji: '🟣' },
  usdc_sol: { label: 'USDC (sieć Solana)', emoji: '💵' },
  blik: { label: 'BLIK', emoji: '📱', rep: 'blik' },
  przelew: { label: 'Przelew', emoji: '🏦', rep: 'przelew' },
  revolut: { label: 'Revolut', emoji: '💳', rep: 'revolut' },
};

const hostingTimes = {
  payMinutes: 30, // czas na wpłatę krypto
  confirmations: 2, // potwierdzenia LTC i ETH (Solana: status „finalized”)
  remindDays: [3, 1], // przypomnienia w DM przed końcem
  deleteNoticeDays: 7, // po tylu dniach blokady bot powiadamia admina, że serwer można usunąć
};

// Kategorie ticketów (maks. 25). "fields" to pola formularza (maks. 5).
const ticketTypes = {
  bot: {
    label: 'Bot discord',
    emoji: '💻',
    description: 'Kliknij, aby zamówić bota discord.',
    order: true,
    fields: [
      { id: 'desc', label: 'Opisz bota', style: 'long', placeholder: 'Tickety, weryfikacja, konkursy, ekonomia…' },
      { id: 'budget', label: 'Budżet (PLN)', placeholder: 'np. 50' },
      { id: 'deadline', label: 'Na kiedy?', placeholder: 'np. do piątku / bez pośpiechu', required: false },
    ],
  },
  hosting: {
    label: 'Hosting bota discord',
    emoji: '🖥️',
    description: 'Kliknij, aby zakupić hosting bota.',
    order: true,
    // Formularz zakupu hostingu: automatyczny (krypto) albo ręczny (ticket, czekasz na właściciela).
    fields: [
      { id: 'lang', label: 'Język bota', select: Object.entries(hostingLanguages).map(([id, l]) => [`${l.emoji} ${l.label}`, id]) },
      { id: 'period', label: 'Okres hostingu', select: hostingPlans.map(([name, price, id]) => [`${name} — ${price}`, id]) },
      {
        id: 'mode',
        label: 'Sposób zakupu',
        select: [
          ['⚡ Automatyczny — krypto, serwer od razu', 'auto'],
          ['⏳ Ręczny — czekasz na właściciela', 'manual'],
        ],
      },
      { id: 'payment', label: 'Płatność', select: Object.entries(hostingPayments).map(([id, p]) => [`${p.emoji} ${p.label}`, id]) },
      // Nazwę serwera klient ustawia po zakupie: „✏️ Zmień nazwę” w DM i w /moj-hosting.
      { id: 'email', label: 'E-mail (login do panelu hostingu)', placeholder: 'np. jan.kowalski@gmail.com' },
    ],
  },
  question: {
    label: 'Pytanie',
    emoji: '❓',
    description: 'Kliknij, aby zadać nam pytanie.',
    fields: [{ id: 'question', label: 'Twoje pytanie', style: 'long' }],
  },
  partner: {
    label: 'Współpraca',
    emoji: '🤝',
    description: 'Kliknij, aby zaproponować współpracę.',
    fields: [
      { id: 'server', label: 'Link do serwera / strony', required: false },
      { id: 'offer', label: 'Twoja propozycja', style: 'long' },
    ],
  },
};

// Regulamin: sekcje wybierane z menu. Zamiast „§” sekcje nazywają się „Rozdział 1”, a punkty „1.1”.
const rulesSectionWord = 'Rozdział';
const rules = [
  {
    title: 'Postanowienia ogólne',
    emoji: '📘',
    points: [
      `Dołączenie do ${brand.invite ? `[serwera ${brand.name}](${brand.invite})` : `serwera **${brand.name}**`} i korzystanie z niego oznacza pełną akceptację niniejszego regulaminu.`,
      'Każdy użytkownik ma obowiązek zachowywać kulturę osobistą i szacunek wobec innych — w szczególności wobec klientów i właścicieli serwera.',
      'Handel między użytkownikami w jakiejkolwiek formie jest **zakazany**. Złamanie zakazu grozi wyciszeniem lub stałą blokadą konta.',
      'Reklamowanie i promowanie czegokolwiek bez wcześniejszej zgody administracji jest surowo zabronione.',
      'Zabronione jest używanie botów spamujących, exploitów i innych sposobów automatyzacji lub obchodzenia zabezpieczeń serwera.',
      'Zakazane jest udostępnianie treści naruszających prawa autorskie, patenty lub inną własność intelektualną.',
      'Administracja może moderować treści na serwerze, w szczególności:\n- usuwać wiadomości nieodpowiednie, niezgodne z regulaminem lub naruszające prawa innych,\n- blokować osoby, które zakłócają działanie serwera lub działają wbrew jego celowi.',
      'Korzystając z serwera, zgadzasz się na stosowanie narzędzi moderacji oraz przetwarzanie niezbędnych danych w celu zapewnienia bezpieczeństwa — zgodnie z zasadami Discorda i obowiązującym prawem (w tym RODO).',
      `Błędy techniczne i inne problemy zgłaszaj administracji — dzięki temu ${brand.invite ? `[serwer](${brand.invite})` : 'serwer'} działa sprawnie dla wszystkich.`,
      'W sporach między użytkownikami administracja może pełnić rolę mediatora, ale nie odpowiada za nieporozumienia poza serwerem.',
      'Właściciele serwera wykonują swoje obowiązki neutralnie i profesjonalnie.',
      'Serwer nie odpowiada za straty finansowe wynikające z działań użytkowników, ich błędnych decyzji lub niewłaściwego korzystania z usług.',
      'Po __zrealizowanym zamówieniu__ klient może wystawić rzetelną opinię o realizacji, jej czasie i przebiegu. Opinie niezgodne z prawdą są usuwane.',
      'Zniesławianie, publiczne oczernianie, szerzenie dezinformacji lub inne działania szkodzące dobremu imieniu serwera, jego usług lub twórców (publicznie lub prywatnie) to **rażące naruszenie regulaminu**. Skutkuje natychmiastowym zakończeniem wszystkich usług (w tym usunięciem i zablokowaniem bota) oraz stałą blokadą konta — bez zwrotu wpłaconych środków.',
      'Administracja może zmienić regulamin w każdej chwili. Zmiany obowiązują od momentu publikacji, dlatego warto regularnie do niego zaglądać.',
    ],
  },
  {
    title: 'Polityka zwrotów',
    emoji: '💸',
    sections: [
      {
        title: 'Boty Discord na zamówienie',
        points: [
          'Zwrot przysługuje **tylko wtedy**, gdy nie wykonamy zamówionego bota w ustalonym lub maksymalnym terminie, zgodnie z zaakceptowanymi wymaganiami.',
          'Składając zamówienie, akceptujesz specyfikację projektu oraz niniejszą politykę zwrotów.',
          'W pozostałych sytuacjach zwrot nie przysługuje, m.in. gdy:\n- bot działa zgodnie z zaakceptowaną specyfikacją, ale jego funkcje Ci nie odpowiadają,\n- nie wiesz, jak obsługiwać bota,\n- zmienisz zdanie lub zrezygnujesz po rozpoczęciu prac.',
        ],
      },
      {
        title: 'Hosting',
        points: [
          'Za hosting zwrot przysługuje **wyłącznie**, gdy:\n- opłacona usługa nie ruszyła w ciągu **48 godzin** z naszej winy,\n- usługa była niedostępna dłużej niż **72 godziny** z przyczyn leżących po naszej stronie.',
          'Problemy z winy użytkownika (np. zła konfiguracja, niewłaściwe użytkowanie, blokady IP) nie są podstawą do zwrotu.',
          'Hosting służy **wyłącznie** do utrzymania bota Discord:\n- zakazane jest m.in. kopanie kryptowalut, przechowywanie dużych plików, ataki sieciowe i procesy nadmiernie obciążające serwer,\n- w razie nadużyć założyciele mogą **natychmiast zablokować usługę i zakończyć współpracę bez zwrotu opłat.**',
          'Zwrot nie przysługuje, gdy współpraca zostanie przerwana z winy użytkownika, w tym za złamanie regulaminu (zwłaszcza punktu `1.14`).',
        ],
      },
      {
        title: 'Postanowienia końcowe',
        points: [
          'Płatności za nasze usługi są **bezzwrotne**, poza wyjątkami opisanymi wyżej.',
          'Masz problem z usługą? Zanim poprosisz o zwrot, napisz do nas w tickecie — postaramy się rozwiązać go jak najszybciej.',
          'Prośbę o zwrot zgłaszasz na piśmie (w tickecie) z dokładnym uzasadnieniem, najpóźniej **7 dni** od sytuacji, która ją uzasadnia.',
          'Ostateczną decyzję o zwrocie podejmują założyciele i **nie podlega ona negocjacjom**.',
        ],
      },
    ],
  },
  {
    title: 'Polityka zamówień',
    emoji: '🛒',
    sections: [
      {
        title: 'Składanie zamówień',
        points: [
          'Zamówienie składasz przez ticket, podając opis wymagań (funkcje, integracje) oraz informacje o hostingu (okres, nazwa, forma płatności).',
          'Każde zamówienie wyceniamy indywidualnie — dostajesz plan z listą funkcji, ceną i szacowanym terminem.',
          'Zamówienie trafia do realizacji dopiero po **pełnej płatności z góry**.',
          'Bot działa na jednym, wybranym serwerze. Przeniesienie go na inny serwer kosztuje **5 zł**.',
        ],
      },
      {
        title: 'Realizacja zamówienia',
        points: [
          'Prace zaczynamy od razu po otrzymaniu płatności i potwierdzeniu specyfikacji przez klienta.',
          'Maksymalny czas realizacji to **14 dni kalendarzowych**.',
          'Termin może się wydłużyć:\n- w szczególnych sytuacjach (np. zmiany w API Discorda, problemy techniczne) — poinformujemy Cię o nowej dacie i ewentualnej rekompensacie,\n- w okresie świąt i ogłoszonych przerw,\n- gdy klient opóźnia przekazanie potrzebnych informacji.',
          'Po zakończeniu dostajesz gotowego bota oraz wsparcie techniczne.',
          '**Cena obejmuje przygotowanie i utrzymanie bota.** __Kod źródłowy (src) nie wchodzi w skład zamówienia.__',
          'Kod źródłowy można dokupić za **40% wartości zamówienia**:\n- założyciele mogą odmówić jego sprzedaży, jeśli istnieje ryzyko odsprzedaży, upublicznienia lub przekazania kodu innym,\n- zakup kodu to licencja niewyłączna — prawa autorskie majątkowe zostają przy autorze,\n- bez pisemnej zgody założyciela **nie wolno** kodu odsprzedawać, udostępniać ani sublicencjonować,\n- kod możesz dowolnie modyfikować na własne potrzeby.',
        ],
      },
      {
        title: 'Poprawki i wsparcie techniczne',
        points: [
          'Przez **14 dni** od oddania bota masz prawo do drobnych poprawek zgodnych z pierwotną specyfikacją.',
          'Zmiany wykraczające poza specyfikację traktujemy jako nowe zamówienie.',
          'Zapewniamy pełne wsparcie techniczne, aby bot działał sprawnie.',
        ],
      },
      {
        title: 'Anulowanie zamówienia',
        points: [
          'Opłacone zamówienie jest wiążące i **nie można go anulować**.',
          'Gdy klient nie współpracuje (np. nie dostarcza materiałów na czas, nie nada bota uprawnień na serwerze), możemy wstrzymać realizację do czasu uzupełnienia braków — bez zwrotu płatności.',
          'Brak kontaktu ze strony klienta przez **30 dni** oznacza anulowanie zamówienia.',
          'Możemy odmówić realizacji, jeśli klient łamie regulamin Discorda. Kwestie finansowe rozstrzygamy wtedy indywidualnie.',
        ],
      },
    ],
  },
  {
    title: 'Polityka płatności',
    emoji: '💳',
    sections: [
      {
        title: 'Metody płatności',
        points: [
          'Płatności przyjmujemy **wyłącznie na naszym Discordzie** (w tickecie). Dostępne metody:\n- BLIK,\n- PayPal,\n- kryptowaluty: Litecoin (LTC), Bitcoin (BTC), Ethereum (ETH), USDT,\n- PaySafeCard (kod) — *bez prowizji od kwoty*.',
        ],
      },
      {
        title: 'BLIK',
        points: ['Płatność BLIK wykonujesz opcją **„BLIK — przelew na telefon”**, czyli szybkim przelewem na numer telefonu.'],
      },
      {
        title: 'PayPal',
        points: [
          'Płacisz wyłącznie opcją **Friends & Family (F&F)** i **bez żadnej notatki** w tytule.',
          'Płatność z notatką lub z innym błędem nie zostanie uznana, a zwrot za nią nie przysługuje.',
          'Klient odpowiada za wykonanie płatności zgodnie z instrukcją — błędy mogą opóźnić realizację zamówienia.',
        ],
      },
      {
        title: 'Kryptowaluty',
        points: [
          'Przyjmujemy **Litecoin (LTC), Bitcoin (BTC), Ethereum (ETH) i USDT**. Adres portfela i sieć podajemy w tickecie.',
          'Płatności w kryptowalutach realizujemy zgodnie z zasadami bezpieczeństwa transakcji kryptowalutowych.',
          'Transakcje krypto są **nieodwracalne** — klient w pełni odpowiada za poprawność płatności (adres, kwota, sieć).',
        ],
      },
      {
        title: 'Bezpieczeństwo płatności',
        points: ['Płatności przechodzą przez bezpieczne systemy, które chronią dane osobowe i finansowe użytkowników.'],
      },
    ],
  },
];

// Metody płatności w formularzu „Zrealizowane” (maks. 25). Emoji może być własne: '<:ltc:123…>'.
const payments = {
  blik: { label: 'BLIK', emoji: '📱' },
  kodblik: { label: 'KOD BLIK', emoji: '🔢' },
  ltc: { label: 'LTC', emoji: '💠' },
  btc: { label: 'BTC', emoji: '🪙' },
  eth: { label: 'ETH', emoji: '💎' },
  usdt: { label: 'USDT', emoji: '💵' },
  paypal: { label: 'PayPal', emoji: '🅿️' },
  psc: { label: 'PSC', emoji: '🎫' },
  przelew: { label: 'Przelew', emoji: '🏦' },
  revolut: { label: 'Revolut', emoji: '💳' },
  sol: { label: 'SOL', emoji: '🟣' },
  usdc: { label: 'USDC', emoji: '💵' },
};
const paymentName = (key) => (payments[key] ? `${payments[key].emoji} ${payments[key].label}` : key);

// Przykładowe vouche pokazywane na kanale legit checków (panel „Jak napisać voucha?”).
const vouchExamples = ['+rep @sprzedawca Bot discord [ 30 PLN ] [ BLIK ]', '+rep @sprzedawca Hosting 3 miesiące [ 14 PLN ] [ PAYPAL ]'];

// Oceny w opiniach.
const reviewCriteria = [
  { id: 'quality', label: 'Jakość bota', emoji: '🤖' },
  { id: 'time', label: 'Czas realizacji', emoji: '⏱️' },
  { id: 'service', label: 'Obsługa klienta', emoji: '💬' },
];
const reviewProducts = {
  bot: { label: 'Bot discord', emoji: '💻' },
  hosting: { label: 'Hosting bota', emoji: '🖥️' },
  other: { label: 'Inna usługa', emoji: '📦' },
};
// Jak często jedna osoba może dodać opinię (minuty).
const reviewCooldownMinutes = 60;

// „Czy legit?”: emoji reakcji. Własne emoji z serwera, na którym jest bot (animowane: '<a:nazwa:id>').
// Gdy bot nie może ich użyć, dodaje zwykłe ✅ / ❌ — obie wersje są liczone tak samo.
const legitEmojis = {
  yes: '<a:TAK:1554504948211785778>', // zielone TAK
  no: '<a:NIE:1554505001492021248>', // czerwone NIE
};

// „Czy legit?”: reakcja NIE jest zawsze usuwana, a autor dostaje przerwę (dni, 0 = bez przerwy, maks. 28).
// Staff i admini nie dostają przerwy (Discord i tak nie pozwala wyciszyć właściciela ani administratorów).
const legitTimeoutDays = 7;
// Konto młodsze niż tyle dni liczy się jako fałszywe zaproszenie.
const fakeAccountDays = 7;
// Nazwy kanałów z licznikiem ({n} = liczba). Aktualizowane co 10 minut (limit Discorda).
const counterNames = {
  legit: '🤔┃czy-legit→{n}',
  legitCheck: '✅┃legit-check→{n}',
  reviews: '⭐┃opinie→{n}',
};

// Układ serwera tworzony przez /generuj.
// mode: 'readonly' = tylko czytanie (piszą Administracja i Admin), 'reactions' = bez pisania, z reakcjami,
//       'open' = wszyscy piszą, 'voice' = kanał głosowy.
// counter: nazwa z licznikiem z counterNames. panel: panel wysyłany na kanał. setting: pole w /setup.
const serverLayout = {
  categoryName: (emoji, name) => `━━ ${emoji} ${name} ━━`,
  channelName: (emoji, name) => `${emoji}┃${name}`,
  roles: {
    admin: { name: '👑 Administracja', color: 0xe74c3c, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
    staff: { name: '🛡️ Admin', color: 0x3498db, hoist: true, permissions: [] },
    client: { name: '💎 Klient', color: 0x9b59b6, hoist: true, permissions: [] },
    verified: { name: '✅ Zweryfikowany', color: 0x2ecc71, hoist: false, permissions: [] },
  },
  categories: [
    {
      emoji: '👋',
      name: 'WITAMY',
      channels: [
        { emoji: '👋', name: 'witamy', mode: 'readonly', setting: 'welcomeChannelId' },
        { emoji: '📩', name: 'zaproszenia', mode: 'readonly', setting: 'invitesChannelId' },
      ],
    },
    {
      emoji: '📌',
      name: 'WAŻNE',
      channels: [
        { emoji: '📜', name: 'regulamin', mode: 'readonly', panel: 'regulamin' },
        { emoji: '📢', name: 'ogłoszenia', mode: 'readonly' },
        { emoji: '💰', name: 'cennik', mode: 'readonly', panel: 'cennik' },
        { emoji: '🎉', name: 'konkursy', mode: 'readonly' },
        { emoji: '🚀', name: 'boosty', mode: 'readonly', setting: 'boostChannelId' },
      ],
    },
    {
      emoji: '🤝',
      name: 'ZAUFANIE',
      channels: [
        { counter: 'legitCheck', mode: 'open', setting: 'lcChannelId', panel: 'vouch' },
        { counter: 'reviews', mode: 'readonly', panel: 'opinie', setting: 'reviewChannelId' },
        { counter: 'legit', mode: 'reactions', panel: 'legit' },
      ],
    },
    { emoji: '🎫', name: 'TICKETY', channels: [{ emoji: '🎫', name: 'tickety', mode: 'readonly', panel: 'tickety' }] },
    {
      emoji: '💬',
      name: 'SPOŁECZNOŚĆ',
      channels: [
        { emoji: '💬', name: 'czat', mode: 'open' },
        { emoji: '📸', name: 'media', mode: 'open' },
        { emoji: '🤖', name: 'komendy', mode: 'open' },
      ],
    },
    {
      emoji: '🔊',
      name: 'GŁOSOWE',
      channels: [
        { emoji: '🔊', name: 'rozmowy', mode: 'voice' },
        { emoji: '🎵', name: 'muzyka', mode: 'voice' },
      ],
    },
    // Tu bot tworzy kanały ticketów — każdy rodzaj w swojej kategorii, widoczne tylko dla Administracji i Adminów (+ autora ticketu).
    { emoji: '💻', name: 'ZAMÓWIENIA BOTÓW', private: true, ticketType: 'bot', channels: [] },
    { emoji: '🖥️', name: 'ZAMÓWIENIA HOSTINGU', private: true, ticketType: 'hosting', channels: [] },
    { emoji: '❓', name: 'PYTANIA', private: true, ticketType: 'question', channels: [] },
    { emoji: '🤝', name: 'WSPÓŁPRACA', private: true, ticketType: 'partner', channels: [] },
    {
      emoji: '🛡️',
      name: 'ADMINISTRACJA',
      private: true,
      channels: [
        { emoji: '💻', name: 'logi-boty', mode: 'open', ticketLog: 'bot' },
        { emoji: '🖥️', name: 'logi-hosting', mode: 'open', ticketLog: 'hosting' },
        { emoji: '🧾', name: 'logi-zakupy', mode: 'open', setting: 'purchaseLogChannelId' },
        { emoji: '❓', name: 'logi-pytania', mode: 'open', ticketLog: 'question' },
        { emoji: '🤝', name: 'logi-współpraca', mode: 'open', ticketLog: 'partner' },
        { emoji: '💬', name: 'admin-czat', mode: 'open', report: true },
      ],
    },
  ],
};

// ═══ BAZA DANYCH (folder data/) ════════════════════════════════════════
// Każdy serwer Discord ma swój folder data/<ID serwera>/, a w nim osobne pliki według tematu:
//   ustawienia.json, tickety.json, opinie.json, konkursy.json, zaproszenia.json,
//   statystyki.json, panele.json, hosting.json.
// Nie edytuj ich, gdy bot działa — przy następnym zapisie bot nadpisze zmiany (najpierw Stop, potem edycja, potem Start).

let dataDir = process.env.TANIEBOTY_DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), 'data');
const dataFiles = {
  'ustawienia.json': ['settings'],
  'tickety.json': ['tickets', 'counter'],
  'opinie.json': ['reviews'],
  'konkursy.json': ['giveaways'],
  'zaproszenia.json': ['invites', 'joins'],
  'statystyki.json': ['stats', 'legitVotes'],
  'panele.json': ['panels'],
  'hosting.json': ['hosting'],
};
const OTHER_FILE = 'inne.json';
const fileOfKey = (key) => Object.keys(dataFiles).find((f) => dataFiles[f].includes(key)) ?? OTHER_FILE;
// ID serwera Discord to same cyfry — inne foldery (np. kopie zapasowe) pomijamy.
const isGuildFolder = (name) => /^\d{5,}$/.test(name);

function writeJson(file, data) {
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${file}.tmp`, file);
}

/** Wczytuje bazę. Stary plik data/db.json (sprzed podziału) jest przenoszony do nowych plików i zostaje jako db.json.stary. */
function loadStore() {
  const loaded = { guilds: {} };
  if (existsSync(dataDir)) {
    for (const entry of readdirSync(dataDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isGuildFolder(entry.name)) continue;
      const g = {};
      for (const file of readdirSync(join(dataDir, entry.name))) {
        if (file.endsWith('.json')) Object.assign(g, JSON.parse(readFileSync(join(dataDir, entry.name, file), 'utf8')));
      }
      loaded.guilds[entry.name] = g;
    }
  }
  const legacy = join(dataDir, 'db.json');
  if (!Object.keys(loaded.guilds).length && existsSync(legacy)) {
    const old = JSON.parse(readFileSync(legacy, 'utf8'));
    store = { guilds: old.guilds ?? {} };
    flush();
    renameSync(legacy, `${legacy}.stary`);
    console.log('🗄️ Baza przeniesiona z data/db.json do osobnych plików w data/<ID serwera>/ (stary plik: data/db.json.stary)');
    return store;
  }
  return loaded;
}

// saveTimer musi istnieć przed loadStore() — przeniesienie starego db.json od razu zapisuje pliki (flush).
let saveTimer = null;
let store = { guilds: {} };
store = loadStore();
// Tylko do testu startu (node index.js --tylko-baza): wczytaj/przenieś bazę i zakończ.
if (process.argv.includes('--tylko-baza')) {
  console.log(`BAZA OK: ${Object.keys(store.guilds).length} serwer(ów)`);
  process.exit(0);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}
function flush() {
  clearTimeout(saveTimer);
  for (const [guildId, g] of Object.entries(store.guilds)) {
    if (!isGuildFolder(guildId)) continue;
    const dir = join(dataDir, guildId);
    mkdirSync(dir, { recursive: true });
    const files = {};
    for (const [key, value] of Object.entries(g)) (files[fileOfKey(key)] ??= {})[key] = value;
    for (const [file, content] of Object.entries(files)) writeJson(join(dir, file), content);
  }
}

function guild(id) {
  const g = (store.guilds[id] ??= {});
  g.settings ??= {};
  g.settings.banners ??= {};
  g.settings.maxOpen ??= 1;
  g.counter ??= 0;
  g.tickets ??= {};
  g.reviews ??= [];
  g.giveaways ??= {};
  g.panels ??= {};
  g.stats ??= { opened: 0, closed: 0 };
  g.stats.done ??= 0;
  g.stats.lc ??= 0;
  g.invites ??= {};
  g.settings.ticketCategories ??= {};
  g.settings.ticketLogs ??= {};
  g.joins ??= {};
  g.hosting ??= {};
  g.hosting.orders ??= {};
  g.hosting.servers ??= {};
  g.hosting.usedTx ??= [];
  return g;
}

function updateGuild(id, fn) {
  const g = guild(id);
  fn(g);
  save();
  return g;
}

/** Kategoria i kanał logów dla rodzaju ticketu (ustawienie dla rodzaju, a gdy go brak — ogólne z /setup). */
const ticketCategoryFor = (settings, type) => settings.ticketCategories?.[type] ?? settings.categoryId ?? null;
const ticketLogFor = (settings, type) => settings.ticketLogs?.[type] ?? settings.logChannelId ?? null;

const getTicket = (guildId, channelId) => guild(guildId).tickets[channelId] ?? null;
const openTicketsOf = (guildId, userId) => Object.values(guild(guildId).tickets).filter((t) => t.userId === userId && !t.closedAt);

// ═══ STAN BOTA ═════════════════════════════════════════════════════════

// „Message Content Intent” (Developer Portal → Bot) pozwala sprawdzić, czy rep zaczyna się od „+rep”.
// Jeśli nie jest włączony, bot i tak wystartuje — wtedy rep musi tylko oznaczać sprzedawcę.
let messageContentOn = true;
// „Server Members Intent” jest potrzebny do powitań i zaproszeń.
let membersIntentOn = true;
let botClient;
let loopsStarted = false;

// ═══ STYL I POMOCNIKI ══════════════════════════════════════════════════

const V2 = MessageFlags.IsComponentsV2;
const V2_EPHEMERAL = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const ts = (ms, fmt = 'R') => `<t:${Math.floor(ms / 1000)}:${fmt}>`;
const pad = (n) => `#${String(n).padStart(4, '0')}`;
const upper = (s) => s.toLocaleUpperCase('pl-PL');
const isUrl = (v) => /^https?:\/\/\S+$/.test(v);
const c = style.chevron;
const x = style.cross;

/** Tytuł w ramce: ## ```🤖 TanieBoty × TEKST```. Własne emoji stoi przed ramką (w kodzie się nie wyświetla). */
function title(text, emoji = brand.emoji) {
  const body = `${brand.name} ${x} ${upper(text)}`;
  return emoji.startsWith('<') ? `## ${emoji} \`\`\`${body}\`\`\`` : `## \`\`\`${emoji} ${body}\`\`\``;
}
/** Linia „» × Etykieta: wartość”. */
const row = (label, value) => `${c} ${x} **${label}:** ${value}`;
/** Punkt „» × tekst”. */
const point = (text) => `${c} ${x} ${text}`;
const stars = (n) => `${'⭐'.repeat(n)}${'✩'.repeat(5 - n)}`;
/** Bezpieczny blok kodu (usuwa ``` z tekstu użytkownika). */
const codeBlock = (text) => `\`\`\`\n${String(text).replace(/```/g, 'ˋˋˋ').slice(0, 1500)}\n\`\`\``;

const sep = (container, large = false) =>
  container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small));
const text = (container, content) => container.addTextDisplayComponents((t) => t.setContent(content));
const footer = (container) => text(container, `-# ${brand.emoji} ${brand.name} ${brand.footerEmoji} • ${brand.tagline}`);

/** Nagłówek z miniaturką po prawej (jeśli jest obrazek). */
function header(container, content, thumbUrl) {
  if (thumbUrl) {
    container.addSectionComponents((s) => s.addTextDisplayComponents((t) => t.setContent(content)).setThumbnailAccessory((th) => th.setURL(thumbUrl)));
  } else {
    text(container, content);
  }
  return container;
}

function banner(container, url) {
  if (url) container.addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(url)));
  return container;
}

// ─── Banery wbudowane ───────────────────────────────────────────────────
// Pliki z folderu grafiki/ (obok index.js) bot dołącza do wiadomości sam — bez linków, które mogą wygasnąć.
// Własny link z /panel baner:<link> ma pierwszeństwo, a baner:brak wyłącza baner danego panelu.
const bannerDir = join(dirname(fileURLToPath(import.meta.url)), 'grafiki');
const bannerFiles = {
  tickety: 'baner-tickety.png',
  regulamin: 'baner-regulamin.png',
  opinie: 'baner-opinie.png',
  legit: 'baner-czy-legit.png',
  cennik: 'baner-cennik.png',
  vouch: 'baner-legit-check.png',
  konkurs: 'baner-konkursy.png',
  witamy: 'baner-witamy.png',
  zaproszenia: 'baner-zaproszenia.png',
  boost: 'baner-boosty.png',
};
const builtinBanner = (key) => (bannerFiles[key] && existsSync(join(bannerDir, bannerFiles[key])) ? bannerFiles[key] : null);
const customBanner = (g, key) => g?.settings?.banners?.[key];

/** Adres baneru do komponentu: własny link, wbudowany plik (attachment://) albo brak. */
function bannerUrl(g, key) {
  const custom = customBanner(g, key);
  if (custom === false) return null;
  if (custom) return custom;
  return builtinBanner(key) ? `attachment://${builtinBanner(key)}` : null;
}

/** Plik do dołączenia do wiadomości, jeśli panel używa wbudowanego baneru. */
function bannerAttachments(g, key) {
  if (customBanner(g, key) !== undefined || !builtinBanner(key)) return [];
  return [new AttachmentBuilder(join(bannerDir, builtinBanner(key)), { name: builtinBanner(key) })];
}

const box = (color = colors.brand) => new ContainerBuilder().setAccentColor(color);
const notice = (content, color = colors.brand) => text(box(color), content);
const ok = (content) => notice(`### ✅ ${content}`, colors.success);
const fail = (content) => notice(`### ❌ ${x} ${content}`, colors.danger);

/** Obrazek do nagłówków: ikona serwera, a gdy jej brak — avatar bota. */
const logoOf = (g, client) => (panelThumbnails ? (g?.iconURL?.({ size: 256 }) ?? client?.user?.displayAvatarURL?.({ size: 256 }) ?? null) : null);

const placeholderNone = `❌ ${x} Nie wybrałeś/aś żadnej kategorii.`;

// ═══ PANELE ════════════════════════════════════════════════════════════

function ticketsPanel(g, logo) {
  const b = box();
  header(
    b,
    [title('Tickety', '🎫'), `>>> 📩 ${x} **Wybierz odpowiednią kategorię, aby utworzyć ticketa.**`, '', ...Object.values(ticketTypes).map((t) => `${t.emoji} ${x} **${t.label}**`)].join('\n'),
    logo,
  );
  text(b, '> -# Prosimy o zachowanie cierpliwości na ticketach — odpowiadamy najszybciej, jak to możliwe.');
  banner(b, bannerUrl(g, 'tickety'));
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(
      new StringSelectMenuBuilder()
        .setCustomId('tk:open')
        .setPlaceholder(placeholderNone)
        .addOptions(Object.entries(ticketTypes).map(([value, t]) => ({ label: t.label, value, description: t.description, emoji: t.emoji }))),
    ),
  );
  sep(b);
  footer(b);
  return b;
}

function rulesPanel(g, logo) {
  const b = box();
  header(b, [title('Regulamin', '📜'), '>>> ' + rules.map((r, i) => `${r.emoji} **${rulesSectionWord} ${i + 1}.** ${r.title}`).join('\n')].join('\n'), logo);
  text(b, `> -# Korzystając z serwera, akceptujesz regulamin. Ostatnia aktualizacja: ${ts(Date.now(), 'D')}`);
  banner(b, bannerUrl(g, 'regulamin'));
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(
      new StringSelectMenuBuilder()
        .setCustomId('rules:show')
        .setPlaceholder(placeholderNone)
        .addOptions(
          rules.map((rule, idx) => ({ label: `${rulesSectionWord} ${idx + 1}. ${rule.title}`, value: String(idx), description: 'Kliknij, aby wyświetlić ten rozdział regulaminu.', emoji: rule.emoji })),
        ),
    ),
  );
  if (g.settings.rulesRoleId) {
    b.addActionRowComponents((r) =>
      r.setComponents(new ButtonBuilder().setCustomId('rules:accept').setLabel('Akceptuję regulamin').setEmoji('✅').setStyle(ButtonStyle.Success)),
    );
  }
  sep(b);
  footer(b);
  return b;
}

/** Bloki tekstu rozdziału: zwykła lista punktów (1.1, 1.2…) albo podrozdziały (2.1 → 2.1.1, 2.1.2…). */
function rulesBlocks(index) {
  const r = rules[index];
  const n = index + 1;
  const list = (prefix, points) => '>>> ' + points.map((p, i) => `\`${prefix}.${i + 1}\` ${p}`).join('\n');
  if (!r.sections) return [list(n, r.points)];
  return r.sections.map((sec, si) => `### ${x} \`${n}.${si + 1}\` ${sec.title}\n${list(`${n}.${si + 1}`, sec.points)}`);
}

// Discord pozwala na maks. 4000 znaków tekstu w jednej wiadomości — długie rozdziały dzielimy na kilka.
const RULES_MESSAGE_LIMIT = 3600;

/** Wiadomości z rozdziałem regulaminu (zwykle jedna, przy długich rozdziałach kilka). */
function rulesMessages(index) {
  const r = rules[index];
  const messages = [];
  let current = null;
  let size = 0;
  const open = (first) => {
    current = box();
    size = 0;
    if (first) {
      const head = title(`${rulesSectionWord} ${index + 1}. ${r.title}`, r.emoji);
      text(current, head);
      size += head.length;
    }
    messages.push(current);
  };
  open(true);
  for (const block of rulesBlocks(index)) {
    if (size + block.length > RULES_MESSAGE_LIMIT && size > 0 && messages.length) open(false);
    sep(current);
    text(current, block);
    size += block.length;
  }
  sep(current);
  footer(current);
  return messages;
}

function reviewSummary(reviews) {
  if (!reviews.length) return { count: 0, avg: 0, per: {} };
  const per = {};
  for (const cr of reviewCriteria) per[cr.id] = reviews.reduce((a, r) => a + r.ratings[cr.id], 0) / reviews.length;
  const avg = Object.values(per).reduce((a, v) => a + v, 0) / reviewCriteria.length;
  return { count: reviews.length, avg, per };
}

function reviewsPanel(g, logo) {
  const s = reviewSummary(g.reviews);
  const b = box();
  header(
    b,
    [
      title('Wystaw nam opinię', '⭐'),
      '>>> ' +
        [
          point('Twoje **zdanie ma znaczenie!** Podziel się wrażeniami z zakupu bota lub hostingu.'),
          point('Każda opinia pomaga nam w budowaniu **rzetelnej reputacji.**'),
          point('Kliknij **przycisk niżej**, aby dodać swoją ocenę.'),
        ].join('\n'),
    ].join('\n'),
    logo,
  );
  sep(b);
  text(
    b,
    [
      `### 📊 ${x} Nasze oceny`,
      row('Opinii', `\`${s.count}\``),
      row('Średnia', s.count ? `\`${s.avg.toFixed(2)}/5\` ${stars(Math.round(s.avg))}` : '`—`'),
      ...reviewCriteria.map((cr) => row(`${cr.emoji} ${cr.label}`, s.count ? `\`${s.per[cr.id].toFixed(1)}/5\`` : '`—`')),
    ].join('\n'),
  );
  banner(b, bannerUrl(g, 'opinie'));
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(new ButtonBuilder().setCustomId('rev:open').setLabel('Wystaw opinię').setEmoji('⭐').setStyle(ButtonStyle.Primary)),
  );
  sep(b);
  footer(b);
  return b;
}

function reviewCard(review, user) {
  const avg = reviewCriteria.reduce((a, cr) => a + review.ratings[cr.id], 0) / reviewCriteria.length;
  const product = reviewProducts[review.product] ?? reviewProducts.other;
  const b = box(avg >= 4 ? colors.brand : avg >= 3 ? colors.warning : colors.danger);
  header(
    b,
    [
      title('Opinia', '⭐'),
      '>>> ' +
        [
          row('Twórca opinii', `<@${review.userId}>`),
          row('Produkt', `${product.emoji} ${product.label}`),
          row('Średnia ocena', `\`${avg.toFixed(1)}/5\``),
          row('Dodano', ts(review.at)),
        ].join('\n'),
    ].join('\n'),
    user?.displayAvatarURL({ size: 256 }),
  );
  sep(b);
  text(b, `${point('**Treść opinii:**')}\n${codeBlock(review.content)}`);
  sep(b);
  text(b, '>>> ' + reviewCriteria.map((cr) => row(`${cr.emoji} ${cr.label}`, `\`${stars(review.ratings[cr.id])}\``)).join('\n'));
  sep(b);
  footer(b);
  return b;
}

function legitPanel(g, logo) {
  const b = box();
  header(
    b,
    [
      title('Czy legit?', '🤔'),
      `## ❓ Czy nasz serwer __${brand.name}__ jest LEGIT?`,
      `- ${legitEmojis.yes} Jeżeli uważasz, że __**TAK**__ — zaznacz zieloną reakcję ${legitEmojis.yes} poniżej!`,
      `- ${legitEmojis.no} Jeżeli uważasz, że __**NIE**__ — zaznacz czerwoną reakcję ${legitEmojis.no} poniżej!`,
    ].join('\n'),
    logo,
  );
  if (legitTimeoutDays > 0) {
    text(b, `> -# Zaznaczenie reakcji ${legitEmojis.no} bez dowodu skutkuje **automatyczną przerwą na ${legitTimeoutDays} dni!** Dowody zgłaszaj w tickecie.`);
  }
  banner(b, bannerUrl(g, 'legit'));
  sep(b);
  footer(b);
  return b;
}

function pricingPanel(g, logo) {
  const b = box();
  header(
    b,
    [
      title('Cennik hostingu', '💰'),
      '>>> ' +
        [
          point('Twój bot działa **24/7** na naszym hostingu.'),
          point('Kliknij **Kup hosting**, wybierz język, okres i płatność.'),
          point('**⚡ Krypto** (LTC, ETH, USDC, SOL) — serwer tworzy się **automatycznie** zaraz po wpłacie.'),
          point('**⏳ Ręcznie** (BLIK, przelew, Revolut, krypto) — otwiera się ticket i czekasz na właściciela.'),
        ].join('\n'),
    ].join('\n'),
    logo,
  );
  sep(b);
  text(
    b,
    [
      `### 🖥️ ${x} Pakiety`,
      ...hostingPlans.map(([name, price, , days]) => row(name, `\`${price}\` • ${days} dni`)),
      `-# ${hostingLimits.memory} MB RAM • ${hostingLimits.disk >= 1024 ? `${hostingLimits.disk / 1024} GB` : `${hostingLimits.disk} MB`} dysku • ${hostingLimits.cpu}% CPU • ${Object.values(hostingLanguages).filter((l) => !l.manualOnly).map((l) => l.label.split(' (')[0]).join(', ')}`,
    ].join('\n'),
  );
  banner(b, bannerUrl(g, 'cennik'));
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(new ButtonBuilder().setCustomId('tk:quick:hosting').setLabel('Kup hosting').setEmoji('🖥️').setStyle(ButtonStyle.Primary)),
  );
  sep(b);
  footer(b);
  return b;
}

// ─── Konkursy ──────────────────────────────────────────────────────────

function giveawayView(gw, memberCount) {
  const n = gw.entrants.length;
  const pct = memberCount ? ((n / memberCount) * 100).toFixed(2) : '0.00';
  const b = box(gw.ended ? colors.neutral : colors.gold);
  const lines = [
    `🎁 ${x} **Nagroda:** \`${gw.prize}\``,
    gw.ended
      ? `👑 ${x} **${gw.winners > 1 ? 'Zwycięzcy' : 'Zwycięzca'}:** ${gw.winnerIds?.length ? gw.winnerIds.map((id) => `<@${id}>`).join(', ') : '*brak uczestników*'}`
      : `👑 ${x} **Liczba zwycięzców:** \`${gw.winners}\``,
    gw.ended ? `⏰ ${x} **Zakończono:** ${ts(gw.endsAt, 'f')}` : `⏰ ${x} **Koniec:** ${ts(gw.endsAt)} (${ts(gw.endsAt, 'f')})`,
    `👤 ${x} **Organizator:** <@${gw.hostId}>`,
    `📋 ${x} **Wymagania:** ${gw.requirements || 'Bez wymagań!'}`,
  ];
  text(b, [title(gw.ended ? 'Konkurs zakończony' : 'Konkurs', '🎉'), '', '>>> ' + lines.join('\n')].join('\n'));
  banner(b, gw.image || (gw.builtinBanner ? `attachment://${bannerFiles.konkurs}` : null));
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(
      new ButtonBuilder()
        .setCustomId('gw:join')
        .setLabel(`Dołącz [ ${n} ${n === 1 ? 'osoba' : 'osób'} | ${pct}% ]`)
        .setEmoji('🎉')
        .setStyle(gw.ended ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(Boolean(gw.ended)),
      new ButtonBuilder().setCustomId('gw:list').setLabel('Lista uczestników').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    ),
  );
  sep(b);
  footer(b);
  return b;
}

function entrantsView(gw) {
  const shown = gw.entrants.slice(0, 60).map((id, i) => `\`${i + 1}.\` <@${id}>`);
  const more = gw.entrants.length - shown.length;
  return notice(
    [`### 👥 ${x} Uczestnicy (${gw.entrants.length})`, shown.length ? shown.join('\n') : '*Nikt jeszcze nie dołączył.*', more > 0 ? `-# …i ${more} więcej` : null]
      .filter(Boolean)
      .join('\n'),
    colors.gold,
  );
}

// ─── Boosty ────────────────────────────────────────────────────────────

function boostView(member, count, tier, g) {
  const now = Date.now();
  const b = box(colors.boost);
  header(
    b,
    [
      title('Nowy boost', '🚀'),
      `## 🎉 Nowe wzmocnienie serwera!`,
      `${member} właśnie **wzmocnił/a** serwer! Dziękujemy! 💜`,
    ].join('\n'),
    member.displayAvatarURL({ size: 256 }),
  );
  sep(b);
  text(
    b,
    '>>> ' +
      [
        row('👤 Użytkownik', `${member} (\`${member.id}\`)`),
        row('📅 Data wzmocnienia', `${ts(now, 'F')} (${ts(now)})`),
        row('🚀 Łączna liczba wzmocnień', `\`${count}\``),
        row('💎 Poziom serwera', `\`${tier}\``),
      ].join('\n'),
  );
  banner(b, bannerUrl(g, 'boost'));
  sep(b);
  footer(b);
  return b;
}

// ═══ TICKETY ═══════════════════════════════════════════════════════════

const replyV2 = (i, container) => i.reply({ components: [container], flags: V2_EPHEMERAL, allowedMentions: { parse: [] } });

function isStaff(member, settings) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator) || (settings.staffRoleId && member?.roles?.cache?.has(settings.staffRoleId));
}

function ticketModal(type) {
  const t = ticketTypes[type];
  return new ModalBuilder()
    .setCustomId(`tk:form:${type}`)
    .setTitle(`${t.emoji} ${t.label}`.slice(0, 45))
    .addLabelComponents(
      t.fields.map((f) => {
        const label = new LabelBuilder().setLabel(f.label);
        if (f.select) {
          return label.setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId(f.id)
              .setPlaceholder('Wybierz…')
              .addOptions(f.select.map(([name, value]) => ({ label: name, value }))),
          );
        }
        const input = new TextInputBuilder()
          .setCustomId(f.id)
          .setStyle(f.style === 'long' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(f.required !== false)
          .setMaxLength(f.max ?? (f.style === 'long' ? 1000 : 100));
        if (f.placeholder) input.setPlaceholder(f.placeholder);
        return label.setTextInputComponent(input);
      }),
    );
}

function ticketMessage(ticket, user) {
  const t = ticketTypes[ticket.type];
  const b = box(ticket.deal ? colors.success : colors.brand);
  header(
    b,
    [
      title(`Ticket ${pad(ticket.number)}`, t.emoji),
      `👋 Witaj <@${ticket.userId}>! Dziękujemy za kontakt z **${brand.name}**.`,
      `-# Zespół odpowie najszybciej, jak to możliwe • otwarto ${ts(ticket.openedAt)}`,
    ].join('\n'),
    user.displayAvatarURL({ size: 256 }),
  );
  sep(b);
  const answers = t.fields
    .filter((f) => ticket.form[f.id])
    .map((f) => {
      const value = f.select ? (f.select.find(([, v]) => v === ticket.form[f.id])?.[0] ?? ticket.form[f.id]) : ticket.form[f.id];
      return f.style === 'long' ? `${point(`**${f.label}:**`)}\n${codeBlock(value)}` : row(f.label, `\`${value}\``);
    });
  const renew = ticket.form.renew && ticket.guildId ? guild(ticket.guildId).hosting.servers[ticket.form.renew] : null;
  if (ticket.form.renew) answers.unshift(row('🔁 Przedłużenie serwera', `\`${renew?.name ?? '?'}\` (ID \`${ticket.form.renew}\`)`));
  if (ticket.hostingServerId) answers.push(row('✅ Hosting', `serwer ID \`${ticket.hostingServerId}\` ${ticket.form.renew ? 'przedłużony' : 'utworzony'}`));
  text(b, [`### ${t.emoji} ${x} ${t.label}`, ...answers].join('\n'));
  sep(b);
  const buttons = [new ButtonBuilder().setCustomId('tk:close').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger)];
  // Zakup ręczny hostingu: staff potwierdza płatność, a bot sam tworzy (albo przedłuża) serwer.
  if (ticket.type === 'hosting' && ticket.form.lang && !ticket.hostingServerId && !hostingLanguages[ticket.form.lang]?.manualOnly) {
    buttons.unshift(
      new ButtonBuilder()
        .setCustomId('hs:confirm')
        .setLabel(ticket.form.renew ? 'Potwierdź płatność i przedłuż' : 'Potwierdź płatność i utwórz serwer')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    );
  }
  b.addActionRowComponents((r) => r.setComponents(...buttons));
  sep(b);
  footer(b);
  return b;
}

const transcriptName = (ticket) => `transcript-${String(ticket.number).padStart(4, '0')}.html`;
// Podmieniane w teście offline.
let makeTranscript = (channel, ticket) => createTranscript(channel, { filename: transcriptName(ticket), poweredBy: false, saveImages: true });

/** Kto zdecydował o wyniku: osoba, która kliknęła „Zrealizowane” / „Niezrealizowane” (albo klient, jeśli sam zamknął). */
/** Wynik zamknięcia: zakupy → zrealizowane/niezrealizowane, pytania i współpraca → po prostu zamknięte. */
const resultLabel = (result) => ({ done: '✅ **Zrealizowane**', notdone: '❌ **Niezrealizowane**', closed: '🔒 **Zamknięte**' })[result] ?? '🔒 **Zamknięte**';

function closerRow(ticket) {
  if (ticket.result === 'closed') {
    const who = ticket.closedBy === ticket.userId ? 'Zamknął (klient)' : 'Zamknął';
    return row(who, ticket.closedBy ? `<@${ticket.closedBy}>` : '—');
  }
  if (ticket.result === 'done') return row('✅ Oznaczył jako zrealizowane', `<@${ticket.decidedBy ?? ticket.deal?.sellerId ?? ticket.closedBy}>`);
  if (!ticket.closedBy) return row('Zamknął', '—');
  if (ticket.closedBy === ticket.userId) return row('Zamknął (klient)', `<@${ticket.closedBy}>`);
  return row('❌ Oznaczył jako niezrealizowane', `<@${ticket.closedBy}>`);
}

function closedView(ticket, subtitle, withReviewButton, guildId) {
  const t = ticketTypes[ticket.type];
  const b = box(ticket.result === 'done' ? colors.success : colors.neutral);
  text(
    b,
    [
      title(`Ticket ${pad(ticket.number)} zamknięty`, ticket.result === 'done' ? '✅' : '🔒'),
      subtitle ? `-# ${subtitle}` : null,
      '>>> ' +
        [
          row('Wynik', resultLabel(ticket.result)),
          row('Autor', `<@${ticket.userId}>`),
          row('Kategoria', `${t.emoji} ${t.label}`),
          closerRow(ticket),
          ticket.deal ? row('Sprzedawca', `<@${ticket.deal.sellerId}>`) : null,
          ticket.deal ? row('Produkt', `\`${ticket.deal.product}\``) : null,
          ticket.deal ? row('Cena', `\`${ticket.deal.price}\``) : null,
          ticket.deal ? row('Płatność', paymentName(ticket.deal.payment)) : null,
          ticket.lcUrl ? row('Legit check', `${ticket.lcUrl}${ticket.autoLc ? ' **[AUTO LC]**' : ''}`) : null,
          ticket.result !== 'done' ? row('Powód', ticket.closeReason ?? '*brak*') : null,
          row('Otwarty', ts(ticket.openedAt, 'f')),
          row('Zamknięty', ts(ticket.closedAt, 'f')),
        ]
          .filter(Boolean)
          .join('\n'),
    ]
      .filter(Boolean)
      .join('\n'),
  );
  sep(b);
  text(b, `### 📜 ${x} Transcript rozmowy`);
  b.addFileComponents((f) => f.setURL(`attachment://${transcriptName(ticket)}`));
  if (withReviewButton) {
    sep(b, true);
    text(b, `### ⭐ ${x} Jak nam poszło?\n-# Wystaw opinię — oceń jakość bota, czas realizacji i obsługę klienta`);
    b.addActionRowComponents((r) =>
      r.setComponents(new ButtonBuilder().setCustomId(`rev:open:${guildId}`).setLabel('Wystaw opinię').setEmoji('⭐').setStyle(ButtonStyle.Primary)),
    );
  }
  sep(b);
  footer(b);
  return b;
}

/** Nazwa kanału ticketu = nazwa konta Discord osoby (np. wojtek3509). */
function ticketChannelName(user) {
  const clean = (v) =>
    String(v ?? '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}_-]/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90);
  return clean(user.username) || `ticket-${user.id}`;
}

async function onTicketSelect(i, type) {
  const { settings } = guild(i.guildId);
  if (!ticketCategoryFor(settings, type)) return replyV2(i, fail('Bot nie jest skonfigurowany. Administrator musi użyć `/setup` albo `/generuj`.'));
  const open = openTicketsOf(i.guildId, i.user.id);
  // Hosting: zakup automatyczny nie otwiera ticketu, więc limit sprawdzamy dopiero przy zakupie ręcznym.
  if (type !== 'hosting' && open.length >= settings.maxOpen) {
    return replyV2(i, fail(`Masz już otwarty ticket: ${open.map((t) => `<#${t.channelId}>`).join(', ')}`));
  }
  await i.showModal(ticketModal(type));
}

async function onTicketForm(i, type) {
  const form = {};
  for (const f of ticketTypes[type].fields) {
    form[f.id] = f.select ? (i.fields.getStringSelectValues(f.id)[0] ?? null) : i.fields.getTextInputValue(f.id) || null;
  }
  // Hosting: zakup automatyczny (krypto) nie otwiera ticketu.
  if (type === 'hosting') {
    normalizeHostingForm(form);
    const error = hostingFormError(form);
    if (error) return replyV2(i, fail(error));
    if (form.mode === 'auto') return onAutoPurchase(i, i.guildId, form);
  }
  if (openTicketsOf(i.guildId, i.user.id).length >= guild(i.guildId).settings.maxOpen) return replyV2(i, fail('Osiągnięto limit otwartych ticketów.'));

  await i.deferReply({ flags: V2_EPHEMERAL });
  const { channel, error } = await createTicket(i.client, i.guild, i.user, type, form);
  if (error) return i.editReply({ components: [fail(error)], flags: V2 });
  await i.editReply({ components: [ok(`Ticket utworzony: ${channel}`)], flags: V2 });
}

/** Tworzy kanał ticketu z kartą (używane przez formularz i przez przedłużenie hostingu z DM). */
async function createTicket(client, discordGuild, user, type, form) {
  const { settings } = guild(discordGuild.id);
  const number = updateGuild(discordGuild.id, (gg) => gg.counter++).counter;
  const t = ticketTypes[type];
  const allowUser = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  const overwrites = [
    { id: discordGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: allowUser },
    { id: client.user.id, allow: [...allowUser, PermissionFlagsBits.ManageChannels] },
  ];
  if (settings.staffRoleId) overwrites.push({ id: settings.staffRoleId, allow: [...allowUser, PermissionFlagsBits.ManageMessages] });

  let channel;
  try {
    channel = await discordGuild.channels.create({
      name: ticketChannelName(user),
      type: ChannelType.GuildText,
      parent: ticketCategoryFor(settings, type),
      topic: `${t.emoji} ${t.label} • ${user.tag} (${user.id})`,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    console.error(err);
    return { error: 'Nie udało się utworzyć kanału. Sprawdź uprawnienia bota i kategorię w `/setup`.' };
  }

  const ticket = { channelId: channel.id, guildId: discordGuild.id, number, type, userId: user.id, openedAt: Date.now(), form };
  const message = await channel.send({ components: [ticketMessage(ticket, user)], flags: V2, allowedMentions: { parse: [] } });
  ticket.messageId = message.id;
  await message.pin().catch(() => {});
  updateGuild(discordGuild.id, (gg) => {
    gg.tickets[channel.id] = ticket;
    gg.stats.opened++;
  });
  if (type === 'hosting') {
    await channel.send({ components: [manualPaymentView(form)], flags: V2, allowedMentions: { parse: [] } }).catch(console.error);
  }

  const ping = await channel.send({
    content: [`<@${user.id}>`, settings.staffRoleId && `<@&${settings.staffRoleId}>`].filter(Boolean).join(' '),
    allowedMentions: { users: [user.id], roles: [settings.staffRoleId].filter(Boolean) },
  });
  setTimeout(() => ping.delete().catch(() => {}), 3000);
  return { channel, ticket };
}

function staffTicket(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return { error: 'To nie jest aktywny kanał ticketu.' };
  if (!isStaff(i.member, guild(i.guildId).settings)) return { error: 'Tylko admin może to zrobić.' };
  return { ticket };
}

async function onCloseRequest(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return replyV2(i, fail('To nie jest aktywny kanał ticketu.'));
  const staff = isStaff(i.member, guild(i.guildId).settings);
  if (ticket.userId !== i.user.id && !staff) return replyV2(i, fail('Nie możesz zamknąć tego ticketu.'));
  // Pytania i współpraca: bez „Zrealizowane / Niezrealizowane” — od razu formularz z powodem.
  if (!ticketTypes[ticket.type].order) return i.showModal(closeReasonModal());
  const b = box(colors.danger);
  if (staff) {
    text(
      b,
      [
        `## 🔒 ${x} Jak zakończyć ticket?`,
        point('**✅ Zrealizowane** — podajesz produkt, cenę i płatność, klient wystawia legit checka, a ticket zamknie się sam.'),
        point('**❌ Niezrealizowane** — ticket zamyka się od razu, transcript trafia do logów.'),
      ].join('\n'),
    );
    b.addActionRowComponents((r) =>
      r.setComponents(
        new ButtonBuilder().setCustomId('tk:done').setLabel('Zrealizowane').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tk:notdone').setLabel('Niezrealizowane').setEmoji('❌').setStyle(ButtonStyle.Danger),
      ),
    );
  } else {
    text(b, [`## 🔒 ${x} Zamknąć ticket?`, point('Kanał zostanie **usunięty**, a transcript trafi do Ciebie w DM.')].join('\n'));
    b.addActionRowComponents((r) =>
      r.setComponents(new ButtonBuilder().setCustomId('tk:userclose').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger)),
    );
  }
  await replyV2(i, b);
}

function closeReasonModal() {
  return new ModalBuilder()
    .setCustomId('tk:closesubmit')
    .setTitle('🔒 Zamknij ticket')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Powód zamknięcia')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setPlaceholder('np. Pytanie wyjaśnione').setMaxLength(300),
        ),
    );
}

function doneModal() {
  return new ModalBuilder()
    .setCustomId('tk:donesubmit')
    .setTitle('✅ Zamówienie zrealizowane')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Nazwa produktu')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('product').setStyle(TextInputStyle.Short).setPlaceholder('np. Bot do exchange').setMaxLength(80),
        ),
      new LabelBuilder()
        .setLabel('Cena')
        .setTextInputComponent(new TextInputBuilder().setCustomId('price').setStyle(TextInputStyle.Short).setPlaceholder('np. 50 PLN').setMaxLength(30)),
      new LabelBuilder()
        .setLabel('Płatność')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('payment')
            .setPlaceholder('Wybierz metodę płatności…')
            .addOptions(Object.entries(payments).map(([value, m]) => ({ label: m.label, value, emoji: m.emoji }))),
        ),
    );
}

function notDoneModal() {
  return new ModalBuilder()
    .setCustomId('tk:notdonesubmit')
    .setTitle('❌ Zamówienie niezrealizowane')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Powód (opcjonalnie)')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300),
        ),
    );
}

/** Wzór wiadomości, którą klient wysyła na kanał legit checków. */
const repTemplate = (ticket) =>
  `+rep <@${ticket.deal.sellerId}> ${ticket.deal.product} [ ${ticket.deal.price} ] [ ${upper(payments[ticket.deal.payment]?.label ?? ticket.deal.payment)} ]`;

function repRequestView(ticket, lcChannelId) {
  const b = box(colors.success);
  text(
    b,
    [
      title('Zamówienie zrealizowane', '✅'),
      '>>> ' +
        [
          row('Produkt', `\`${ticket.deal.product}\``),
          row('Cena', `\`${ticket.deal.price}\``),
          row('Płatność', paymentName(ticket.deal.payment)),
          row('Sprzedawca', `<@${ticket.deal.sellerId}>`),
          row('Klient', `<@${ticket.userId}>`),
        ].join('\n'),
    ].join('\n'),
  );
  sep(b);
  text(
    b,
    [
      `## ⭐ ${x} Wystaw legit checka`,
      `<@${ticket.userId}>, dziękujemy za zakup! Wejdź na ${lcChannelId ? `<#${lcChannelId}>` : 'kanał legit checków'} i wyślij:`,
      codeBlock(repTemplate(ticket)),
      `-# 🔒 Ticket zamknie się automatycznie, gdy wyślesz repa. Transcript dostaniesz w DM.`,
    ].join('\n'),
  );
  b.addActionRowComponents((r) =>
    r.setComponents(
      new ButtonBuilder().setCustomId('tk:copyrep').setLabel('Skopiuj wzór').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('tk:closenorep').setLabel('Zamknij bez repa (admin)').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    ),
  );
  sep(b);
  footer(b);
  return b;
}

/** Panel na kanale legit checków — zawsze na dole, pod ostatnim vouchem. */
function vouchPanel(g, logo) {
  const b = box(colors.success);
  header(
    b,
    [
      title('Jak napisać voucha?', '✅'),
      '>>> ' +
        [
          point('Po każdym zakupie napisz na tym kanale **voucha** według wzoru:'),
          codeBlock('+rep @sprzedawca Co zakupiłeś [ Kwota PLN ] [ Forma płatności ]'),
        ].join('\n'),
    ].join('\n'),
    logo,
  );
  sep(b);
  text(b, [`### 📝 ${x} Przykładowe vouche`, ...vouchExamples.map(codeBlock)].join('\n'));
  sep(b);
  text(
    b,
    [
      point('Gdy napiszesz voucha, bot doda ✅, a Twój **ticket zamknie się automatycznie**.'),
      g.settings.reviewChannelId ? point(`Zostaw też opinię na <#${g.settings.reviewChannelId}> ⭐`) : null,
      point(`Zrealizowaliśmy już **${g.stats.done}** zamówień — dziękujemy za zaufanie! 💙`),
    ]
      .filter(Boolean)
      .join('\n'),
  );
  banner(b, bannerUrl(g, 'vouch'));
  sep(b);
  footer(b);
  return b;
}

async function onDoneSubmit(i) {
  const { error } = staffTicket(i);
  if (error) return replyV2(i, fail(error));
  const g = guild(i.guildId);
  const deal = {
    product: i.fields.getTextInputValue('product'),
    price: i.fields.getTextInputValue('price'),
    payment: i.fields.getStringSelectValues('payment')[0],
    sellerId: i.user.id,
  };
  if (!g.settings.lcChannelId) return replyV2(i, fail('Najpierw ustaw kanał legit checków: `/setup legitcheck:#kanał`.'));
  updateGuild(i.guildId, (gg) => Object.assign(gg.tickets[i.channelId], { deal, awaitingRep: true, decidedBy: i.user.id }));
  const updated = getTicket(i.guildId, i.channelId);

  // Karta ticketu zmienia kolor na zielony (zamówienie zrealizowane).
  const user = await i.client.users.fetch(updated.userId);
  const card = await i.channel.messages.fetch(updated.messageId).catch(() => null);
  await card?.edit({ components: [ticketMessage(updated, user)], flags: V2 }).catch(() => {});

  // Ticket NIE zamyka się tutaj — czeka, aż klient wyśle repa na kanale legit checków.
  await i.reply({ components: [repRequestView(updated, g.settings.lcChannelId)], flags: V2, allowedMentions: { users: [updated.userId] } });
}

/**
 * Czy wiadomość jest vouchem: musi zaczynać się od „+rep”.
 * Bez „Message Content Intent” bot nie widzi treści — wtedy vouch musi kogoś oznaczać.
 */
function isRep(message) {
  if (!messageContentOn) return message.mentions.users.size > 0;
  return /^\s*\+\s*rep\b/i.test(message.content);
}

/** Wiadomość na kanale legit checków: vouch → ✅, licznik, zamknięcie ticketu klienta, panel na dół. */
async function onLegitCheckMessage(message) {
  const g = guild(message.guild.id);
  // Wiadomości botów i webhooków (np. /autolc) pomijamy.
  if (message.channelId !== g.settings.lcChannelId || message.author.bot || message.webhookId) return false;
  const ticket = Object.values(g.tickets).find((t) => t.awaitingRep && !t.closedAt && t.userId === message.author.id);

  if (!isRep(message)) {
    // Podpowiedź tylko dla klienta, który ma czekający ticket — reszta wiadomości zostaje bez odpowiedzi.
    if (!ticket) return true;
    const hint = await message
      .reply({
        components: [notice(`### ⚠️ ${x} To nie jest poprawny vouch\nVouch musi zaczynać się od **+rep**. Twój wzór:\n${codeBlock(repTemplate(ticket))}`, colors.warning)],
        flags: V2,
        allowedMentions: { parse: [] },
      })
      .catch(() => null);
    setTimeout(() => hint?.delete().catch(() => {}), 20_000);
    return true;
  }

  await message.react('✅').catch(() => {});

  if (ticket) {
    updateGuild(message.guild.id, (gg) => {
      Object.assign(gg.tickets[ticket.channelId], { awaitingRep: false, lcUrl: message.url, lcMessageId: message.id });
      gg.stats.lc++;
    });
    const channel = await message.guild.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      await channel
        .send({ components: [notice(`### ✅ ${x} Vouch otrzymany!\nDziękujemy <@${ticket.userId}>! ${message.url}\n-# Ticket zamyka się…`, colors.success)], flags: V2 })
        .catch(() => {});
      await finalizeTicket(message.client, message.guild, channel, { closedBy: null, result: 'done' });
    }
  }
  await movePanelToBottom(message.client, message.guild.id, 'vouch', message.channel);
  return true;
}

/** Sprawdza uprawnienia i zamyka ticket z poziomu interakcji. */
async function closeTicket(i, { reason = null, result = 'notdone' } = {}) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return replyV2(i, fail('Ten ticket jest już zamykany.'));
  if (ticket.userId !== i.user.id && !isStaff(i.member, guild(i.guildId).settings)) return replyV2(i, fail('Nie możesz zamknąć tego ticketu.'));
  await i.reply({
    components: [
      notice(
        [
          `## 🔒 ${x} Ticket zamykany`,
          row('Wynik', resultLabel(result)),
          closerRow({ ...ticket, result, closedBy: i.user.id }),
          reason ? row('Powód', reason) : null,
          '-# Kanał zniknie za kilka sekund…',
        ]
          .filter(Boolean)
          .join('\n'),
        colors.danger,
      ),
    ],
    flags: V2,
    allowedMentions: { parse: [] },
  });
  await finalizeTicket(i.client, i.guild, i.channel, { closedBy: i.user.id, reason, result });
}

/** Zamyka ticket: zapis, transcript do logów i do klienta w DM, usunięcie kanału. */
async function finalizeTicket(client, g, channel, { closedBy, reason = null, result }) {
  const current = getTicket(g.id, channel.id);
  if (!current || current.closedAt) return;
  updateGuild(g.id, (gg) => {
    Object.assign(gg.tickets[channel.id], { closedAt: Date.now(), closedBy, closeReason: reason, result, awaitingRep: false });
    gg.stats.closed++;
    if (result === 'done') gg.stats.done++;
  });
  const closed = getTicket(g.id, channel.id);
  const { settings } = guild(g.id);
  const transcript = await makeTranscript(channel, closed);
  const logChannelId = ticketLogFor(settings, closed.type);
  if (logChannelId) {
    const log = await g.channels.fetch(logChannelId).catch(() => null);
    await log?.send({ components: [closedView(closed, g.name, false)], files: [transcript], flags: V2, allowedMentions: { parse: [] } }).catch(console.error);
  }
  const user = await client.users.fetch(closed.userId).catch(() => null);
  await user
    ?.send({ components: [closedView(closed, `Dziękujemy za skorzystanie z ${brand.name}!`, result === 'done', g.id)], files: [transcript], flags: V2 })
    .catch(() => {});
  setTimeout(() => channel.delete('Ticket zamknięty').catch(console.error), 5000);
}

// ═══ HOSTING (panel Pterodactyl + płatności krypto) ═══════════════════
// Dane dostępowe są w config.json → "hosting" (adres panelu, klucze API, jajka, portfele). Opis w README.
//
// Zakup automatyczny: klient wybiera krypto → bot podaje adres i unikalną kwotę → co 30 s sprawdza blockchain →
// po potwierdzeniach sam zakłada konto w panelu i serwer, a dane logowania wysyła w DM.
// Zakup ręczny: ticket → staff klika „Potwierdź płatność” → bot tworzy (albo przedłuża) serwer.
// Po terminie serwer jest blokowany (Suspend), a przedłużenie go odblokowuje.

const DAY = 86_400_000;
let hostingConfig = {};
// Podmieniane w teście offline.
let httpFetch = (...args) => fetch(...args);
let hostingDelay = (ms) => new Promise((r) => setTimeout(r, ms));

const hostingApi = () => ({
  ltc: 'https://litecoinspace.org/api',
  ltcBlockcypher: 'https://api.blockcypher.com/v1/ltc/main',
  eth: 'https://eth.blockscout.com/api',
  ethRpc: 'https://ethereum-rpc.publicnode.com',
  sol: 'https://api.mainnet-beta.solana.com',
  coinbase: 'https://api.coinbase.com/v2/exchange-rates',
  prices: 'https://api.coingecko.com/api/v3/simple/price',
  qr: 'https://api.qrserver.com/v1/create-qr-code/',
  ...hostingConfig.api,
});
const hostingReady = () => Boolean(hostingConfig.panelUrl && hostingConfig.apiKey);
const panelUrl = () => String(hostingConfig.panelUrl ?? '').replace(/\/+$/, '');
const walletFor = (coinKey) => hostingConfig.wallets?.[cryptoCoins[coinKey]?.chain] || null;
const planOf = (id) => hostingPlans.find((p) => p[2] === id) ?? hostingPlans[0];
const planPln = (id) => parseFloat(String(planOf(id)[1]).replace(',', '.').replace(/[^\d.]/g, ''));
const langLabel = (id) => (hostingLanguages[id] ? `${hostingLanguages[id].emoji} ${hostingLanguages[id].label}` : `\`${id}\``);
const payLabel = (id) => (hostingPayments[id] ? `${hostingPayments[id].emoji} ${hostingPayments[id].label}` : `\`${id}\``);
const repPaymentOf = (id) => cryptoCoins[id]?.rep ?? hostingPayments[id]?.rep ?? id;
const hostingServers = (guildId) => guild(guildId).hosting.servers;
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? ''));
const randomPassword = () => randomBytes(12).toString('base64url');
const activeOrder = (o) => o.status === 'waiting' || o.status === 'seen';

/** Błąd pokazywany klientowi wprost (np. zajęty e-mail). */
const userError = (message) => Object.assign(new Error(message), { userFacing: true });

/** Liczba całkowita (w najmniejszych jednostkach) → tekst z przecinkiem dziesiętnym, np. 1823417 → "0.01823417". */
function unitsToString(units, decimals) {
  const s = String(units).padStart(decimals + 1, '0');
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

async function getJson(url, init = {}) {
  // Część serwisów (np. CloudFront) odrzuca zapytania bez nagłówka User-Agent.
  const headers = { 'User-Agent': `${brand.name}-bot/1.0`, Accept: 'application/json', ...init.headers };
  const { timeout = 20_000, ...rest } = init;
  const res = await httpFetch(url, { ...rest, headers, signal: AbortSignal.timeout(timeout) });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data?.errors?.map((e) => e.detail).join(' ') || raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    throw Object.assign(new Error(`HTTP ${res.status}: ${detail}`), { status: res.status, data });
  }
  return data;
}

// Ostrzeżenia z pętli (np. API blockchaina nie odpowiada) — najwyżej raz na 10 minut dla danego źródła.
const warnedAt = new Map();
function warnOnce(key, message) {
  if (Date.now() - (warnedAt.get(key) ?? 0) < 10 * 60_000) return;
  warnedAt.set(key, Date.now());
  console.warn(message);
}

// ─── Panel Pterodactyl (Application API) ───────────────────────────────

function ptero(method, path, body, clientApi = false) {
  const key = clientApi ? hostingConfig.clientApiKey : hostingConfig.apiKey;
  return getJson(`${panelUrl()}/api/${clientApi ? 'client' : 'application'}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const notFound = (err) => err?.status === 404;

/** Nazwa użytkownika w panelu: małe litery, cyfry, _ . - (zaczyna i kończy się literą/cyfrą). */
function panelUsername(user) {
  const base = String(user.username ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, 30);
  return base.length >= 3 ? base : `klient${String(user.id).slice(-6)}`;
}

/** Konto w panelu powiązane z kontem Discord (external_id = discord-<id>). */
async function findPanelUser(discordId) {
  try {
    return (await ptero('GET', `/users/external/discord-${discordId}`)).attributes;
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }
}

async function emailFree(email) {
  const res = await ptero('GET', `/users?filter[email]=${encodeURIComponent(email)}`);
  return !res?.data?.length;
}

/** Zwraca konto klienta w panelu — istniejące albo nowe (z hasłem do wysłania w DM). */
async function ensurePanelUser(user, email) {
  const existing = await findPanelUser(user.id);
  if (existing) return { user: existing, password: null };
  if (!validEmail(email)) throw userError('Brak poprawnego adresu e-mail do założenia konta w panelu.');
  if (!(await emailFree(email))) throw userError(`E-mail \`${email}\` ma już konto w panelu (innej osoby). Potrzebny jest inny adres.`);
  const password = randomPassword();
  const base = panelUsername(user);
  for (let attempt = 0; attempt < 4; attempt++) {
    const username = attempt ? `${base.slice(0, 26)}${randomInt(1000, 9999)}` : base;
    try {
      const created = await ptero('POST', '/users', {
        external_id: `discord-${user.id}`,
        email,
        username,
        first_name: String(user.globalName || user.username || 'Klient').slice(0, 100),
        last_name: 'Discord',
        password,
      });
      return { user: created.attributes, password };
    } catch (err) {
      if (err.status === 422 && /username/i.test(err.message)) continue;
      if (err.status === 422 && /email/i.test(err.message)) throw userError(`Panel odrzucił e-mail \`${email}\` (nieprawidłowy albo zajęty).`);
      throw err;
    }
  }
  throw userError('Nie udało się dobrać wolnej nazwy użytkownika w panelu.');
}

const eggCache = new Map();
/** Jajko dla języka: obraz Dockera, komenda startowa i domyślne zmienne. */
async function eggInfo(lang) {
  const cfg = hostingConfig.eggs?.[lang];
  if (!cfg?.nest || !cfg?.egg) throw userError(`Brak jajka dla języka \`${lang}\` (config.json → hosting.eggs.${lang}: nest i egg).`);
  const key = `${cfg.nest}/${cfg.egg}`;
  if (!eggCache.has(key)) {
    const a = (await ptero('GET', `/nests/${cfg.nest}/eggs/${cfg.egg}?include=variables`)).attributes;
    const environment = {};
    for (const v of a.relationships?.variables?.data ?? []) environment[v.attributes.env_variable] = v.attributes.default_value ?? '';
    eggCache.set(key, { id: a.id, image: cfg.image || a.docker_image, startup: a.startup, environment });
  }
  return eggCache.get(key);
}

async function deployLocations() {
  if (hostingConfig.locationId) return [Number(hostingConfig.locationId)];
  const res = await ptero('GET', '/locations');
  const ids = (res?.data ?? []).map((l) => l.attributes.id);
  if (!ids.length) throw new Error('W panelu nie ma żadnej lokalizacji (Admin → Locations).');
  return ids;
}

/** Tworzy serwer w panelu. external_id sprawia, że ponowna próba nie utworzy drugiego serwera. */
async function createPanelServer({ owner, lang, externalId, name, discordId }) {
  try {
    return (await ptero('GET', `/servers/external/${externalId}`)).attributes;
  } catch (err) {
    if (!notFound(err)) throw err;
  }
  const egg = await eggInfo(lang);
  const res = await ptero('POST', '/servers', {
    external_id: externalId,
    name,
    description: `${brand.name} • Discord ${discordId}`,
    user: owner,
    egg: egg.id,
    docker_image: egg.image,
    startup: egg.startup,
    environment: egg.environment,
    limits: { memory: hostingLimits.memory, swap: hostingLimits.swap, disk: hostingLimits.disk, io: hostingLimits.io, cpu: hostingLimits.cpu, threads: null },
    feature_limits: { databases: hostingLimits.databases, allocations: 0, backups: hostingLimits.backups },
    deploy: { locations: await deployLocations(), dedicated_ip: false, port_range: [] },
    start_on_completion: false,
  });
  return res.attributes;
}

/** Start serwera po odblokowaniu (wymaga klucza Client API administratora). */
async function startPanelServer(rec) {
  if (!hostingConfig.clientApiKey) return false;
  await hostingDelay(5000); // Wings potrzebuje chwili po odblokowaniu
  return ptero('POST', `/servers/${rec.identifier}/power`, { signal: 'start' }, true)
    .then(() => true)
    .catch((err) => (console.warn(`Hosting: nie udało się uruchomić serwera ${rec.id}:`, err.message), false));
}

async function giveClientRole(client, guildId, userId) {
  const discordGuild = client.guilds?.cache?.get(guildId);
  const role = discordGuild?.roles?.cache?.find((r) => r.name === serverLayout.roles.client.name);
  if (!role) return;
  const member = await discordGuild.members.fetch(userId).catch(() => null);
  await member?.roles.add(role, 'Zakup hostingu').catch(() => {});
}

async function sendHostingDm(client, userId, container) {
  const user = await client.users.fetch(userId).catch(() => null);
  return (await user?.send({ components: [container], flags: V2, allowedMentions: { parse: [] } }).catch(() => null)) ?? null;
}

async function hostingLog(client, guildId, content, color = colors.brand) {
  const channelId = ticketLogFor(guild(guildId).settings, 'hosting');
  const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
  if (!channel) return console.log(`[hosting] ${content.replace(/[#*`>]/g, '').replace(/\n+/g, ' | ')}`);
  await channel.send({ components: [notice(content, color)], flags: V2, allowedMentions: { parse: [] } }).catch(console.error);
}

const recLine = (rec) => row(`\`#${rec.id}\` ${rec.name}`, `<@${rec.userId}> • ${langLabel(rec.lang)} • do ${ts(rec.expiresAt, 'f')}`);

/**
 * Nowy serwer albo przedłużenie — wspólne dla zakupu automatycznego, ręcznego i /hosting utworz.
 * key = unikalny identyfikator zakupu (zabezpiecza przed podwójnym serwerem przy ponownej próbie).
 */
async function activateHosting(client, guildId, { key, userId, lang, plan, email, renew, payment, source, name }) {
  const days = planOf(plan)[3];
  if (renew) {
    const rec = await extendHosting(guildId, renew, days);
    const dm = await sendHostingDm(client, rec.userId, hostingRenewedView(rec, guildId));
    await hostingLog(
      client,
      guildId,
      [`### 🔁 ${x} Hosting przedłużony (+${days} dni)`, recLine(rec), row('Płatność', `${payLabel(payment)} • ${source}`)].join('\n'),
      colors.success,
    );
    return { rec, dmOk: Boolean(dm) };
  }
  const user = await client.users.fetch(userId);
  const account = await ensurePanelUser(user, email);
  const server = await createPanelServer({
    owner: account.user.id,
    lang,
    externalId: `tb-${key}`,
    name: cleanServerName(name) ?? `${hostingLanguages[lang]?.label.split(' (')[0] ?? lang} • ${user.username}`.slice(0, 60),
    discordId: user.id,
  });
  // Ponowna próba po już udanym utworzeniu: serwer jest zapisany, nic nie zmieniamy.
  const known = hostingServers(guildId)[server.id];
  if (known && !known.deleted) return { rec: known, account, dmOk: true };
  const rec = {
    id: server.id,
    identifier: server.identifier,
    name: server.name,
    userId: user.id,
    pteroUserId: account.user.id,
    lang,
    plan,
    payment,
    createdAt: Date.now(),
    expiresAt: Date.now() + days * DAY,
    suspended: false,
    reminded: [],
  };
  updateGuild(guildId, (g) => (g.hosting.servers[rec.id] = rec));
  await giveClientRole(client, guildId, user.id);
  const dm = await sendHostingDm(client, user.id, hostingReadyView(rec, account, guildId));
  await hostingLog(
    client,
    guildId,
    [
      `### 🆕 ${x} Nowy hosting`,
      recLine(rec),
      row('Pakiet', `${planOf(plan)[0]} — ${planOf(plan)[1]}`),
      row('Płatność', `${payLabel(payment)} • ${source}`),
      account.password ? row('Konto w panelu', `nowe: \`${account.user.username}\``) : row('Konto w panelu', `istniejące: \`${account.user.username}\``),
      dm ? null : row('⚠️ DM', 'klient ma zablokowane wiadomości prywatne — dane logowania trzeba przekazać ręcznie'),
    ]
      .filter(Boolean)
      .join('\n'),
    colors.success,
  );
  return { rec, account, dmOk: Boolean(dm) };
}

/** Dolicza dni (od dziś albo od końca okresu, jeśli jeszcze trwa) i odblokowuje serwer. */
async function extendHosting(guildId, serverId, days) {
  const rec = hostingServers(guildId)[serverId];
  if (!rec || rec.deleted) throw userError(`Nie znam serwera o ID \`${serverId}\`. Dodaj go: \`/hosting dodaj\`.`);
  const wasSuspended = rec.suspended;
  if (wasSuspended) await ptero('POST', `/servers/${rec.id}/unsuspend`);
  updateGuild(guildId, () =>
    Object.assign(rec, { expiresAt: Math.max(Date.now(), rec.expiresAt) + days * DAY, suspended: false, suspendedAt: null, reminded: [], deleteNotified: false }),
  );
  rec.started = wasSuspended ? await startPanelServer(rec) : null;
  return rec;
}

async function suspendHosting(guildId, rec) {
  await ptero('POST', `/servers/${rec.id}/suspend`);
  updateGuild(guildId, () => Object.assign(rec, { suspended: true, suspendedAt: Date.now() }));
}

// ─── Widoki hostingu ───────────────────────────────────────────────────

const renameButton = (guildId, rec) =>
  new ButtonBuilder().setCustomId(`hs:rename:${guildId}:${rec.id}`).setLabel('Zmień nazwę').setEmoji('✏️').setStyle(ButtonStyle.Secondary);
const renewButton = (guildId, rec) =>
  new ButtonBuilder().setCustomId(`hs:renew:${guildId}:${rec.id}`).setLabel(`Przedłuż: ${rec.name}`.slice(0, 80)).setEmoji('🔁').setStyle(ButtonStyle.Success);

function hostingReadyView(rec, account, guildId) {
  const b = box(colors.success);
  text(b, [title('Hosting gotowy', '🖥️'), `Twój serwer **${rec.name}** jest gotowy! 🎉`].join('\n'));
  sep(b);
  text(
    b,
    '>>> ' +
      [
        row('🌐 Panel', panelUrl()),
        row('📧 Login (e-mail)', `\`${account.user.email}\``),
        row('🔑 Hasło', account.password ? `||\`${account.password}\`||` : 'to samo, co do Twojego konta w panelu'),
        row('💻 Język', langLabel(rec.lang)),
        row('📅 Ważny do', `${ts(rec.expiresAt, 'f')} (${ts(rec.expiresAt)})`),
        row('🆔 ID serwera', `\`${rec.id}\``),
      ].join('\n'),
  );
  sep(b);
  text(
    b,
    [
      `### 🚀 ${x} Jak uruchomić bota`,
      point(`Zaloguj się w panelu i otwórz serwer **${rec.name}**.`),
      point(`**Files** → **Upload**: wgraj ${hostingLanguages[rec.lang]?.files ?? 'pliki bota'}.`),
      point('**Console** → **Start**. Biblioteki zainstalują się same przy pierwszym starcie.'),
      account.password ? point('Po zalogowaniu zmień hasło: ikona konta (prawy górny róg) → **Update Password**.') : null,
      point('Termin i przedłużenie sprawdzisz komendą `/moj-hosting` na naszym serwerze Discord.'),
    ]
      .filter(Boolean)
      .join('\n'),
  );
  const lc = guild(guildId).settings.lcChannelId;
  if (lc) text(b, `-# ⭐ Będzie nam miło, jeśli zostawisz voucha na <#${lc}>!`);
  b.addActionRowComponents((r) => r.setComponents(renameButton(guildId, rec)));
  sep(b);
  footer(b);
  return b;
}

function hostingRenewedView(rec, guildId) {
  const b = box(colors.success);
  text(
    b,
    [
      title('Hosting przedłużony', '🔁'),
      '>>> ' +
        [
          row('🖥️ Serwer', `**${rec.name}** (ID \`${rec.id}\`)`),
          row('📅 Ważny do', `${ts(rec.expiresAt, 'f')} (${ts(rec.expiresAt)})`),
          rec.started === true ? row('▶️ Status', 'serwer odblokowany i uruchomiony') : null,
          rec.started === false ? row('▶️ Status', 'serwer odblokowany — kliknij **Start** w panelu') : null,
        ]
          .filter(Boolean)
          .join('\n'),
      `-# Dziękujemy, że jesteś z ${brand.name}! 💙 Panel: ${panelUrl()}`,
    ].join('\n'),
  );
  return b.addActionRowComponents((r) => r.setComponents(renewButton(guildId, rec).setLabel('Przedłuż ponownie').setStyle(ButtonStyle.Secondary)));
}

function hostingReminderView(rec, guildId) {
  const b = box(colors.warning);
  text(
    b,
    [
      title('Hosting wkrótce wygaśnie', '⏰'),
      `Twój serwer **${rec.name}** wygasa ${ts(rec.expiresAt)} (${ts(rec.expiresAt, 'f')}).`,
      point('Po terminie serwer zostanie **zablokowany** (pliki zostają). Przedłuż go, żeby bot działał bez przerwy.'),
    ].join('\n'),
  );
  return b.addActionRowComponents((r) => r.setComponents(renewButton(guildId, rec)));
}

function hostingExpiredView(rec, guildId) {
  const b = box(colors.danger);
  text(
    b,
    [
      title('Hosting zablokowany', '⛔'),
      `Okres hostingu serwera **${rec.name}** minął — serwer został **zablokowany**.`,
      point('Twoje pliki są bezpieczne. Po przedłużeniu serwer **odblokuje się automatycznie**.'),
      point(`Bez przedłużenia serwer może zostać usunięty po ${hostingTimes.deleteNoticeDays} dniach.`),
    ].join('\n'),
  );
  return b.addActionRowComponents((r) => r.setComponents(renewButton(guildId, rec)));
}

const qrUrl = (data) => `${hostingApi().qr}?size=240x240&margin=8&data=${encodeURIComponent(data)}`;

function orderStatusLine(o) {
  const need = hostingTimes.confirmations;
  const sol = cryptoCoins[o.coin]?.chain === 'sol';
  return {
    waiting: `⏳ Czekam na płatność — masz czas do ${ts(o.expiresAt, 't')} (${ts(o.expiresAt)})`,
    seen: sol ? '🔄 Płatność wykryta! Czekam na finalizację w sieci Solana (ok. 15 s)…' : `🔄 Płatność wykryta! Potwierdzenia: **${o.confirmations}/${need}**`,
    paid: '✅ Płatność potwierdzona — tworzę serwer…',
    creating: '✅ Płatność potwierdzona — tworzę serwer…',
    error: '⚠️ Płatność potwierdzona, ale panel chwilowo nie odpowiada — ponawiam automatycznie.',
    failed: '⚠️ Płatność potwierdzona — administracja dokończy zamówienie ręcznie (dostała powiadomienie).',
    done: o.renew ? '✅ Gotowe! Hosting przedłużony.' : '✅ Gotowe! Dane do panelu są w osobnej wiadomości.',
    expired: '⌛ Czas na płatność minął. Jeśli wysłałeś/aś środki, otwórz ticket — sprawdzimy to ręcznie.',
    cancelled: '❌ Zamówienie anulowane.',
  }[o.status];
}

function orderView(o, guildId) {
  const c = cryptoCoins[o.coin];
  const waiting = o.status === 'waiting';
  const color = o.status === 'done' ? colors.success : ['expired', 'cancelled'].includes(o.status) ? colors.neutral : colors.gold;
  const b = box(color);
  header(b, [title(o.renew ? 'Przedłużenie hostingu' : 'Płatność za hosting', c.emoji), `### ${orderStatusLine(o)}`].join('\n'), activeOrder(o) ? qrUrl(o.wallet) : null);
  sep(b);
  text(
    b,
    '>>> ' +
      [
        row('💰 Kwota', `\`${o.amount} ${c.label}\` (≈ ${o.pln} zł)`),
        row('🌐 Sieć', `**${c.network}**`),
        row('📬 Adres', `\`${o.wallet}\``),
        row('📦 Pakiet', `${planOf(o.plan)[0]} — ${planOf(o.plan)[1]}`),
        o.renew ? row('🔁 Serwer', `ID \`${o.renew}\``) : row('💻 Język', langLabel(o.lang)),
        o.txid ? row('🔗 Transakcja', `\`${o.txid.split(':')[0]}\``) : null,
        row('🧾 Zamówienie', `\`${o.id}\``),
      ]
        .filter(Boolean)
        .join('\n'),
  );
  if (activeOrder(o)) {
    sep(b);
    text(
      b,
      [
        `### ⚠️ ${x} Ważne`,
        point(`Wyślij **dokładnie \`${o.amount}\` ${c.label}** — co do ostatniej cyfry. Po tej kwocie rozpoznajemy Twoją płatność.`),
        point(`Tylko sieć **${c.network}**${c.token ? ` (token USDC: \`${c.token}\`)` : ''}. Wysłanie inną siecią = utrata środków.`),
        point('Opłatę sieci płacisz osobno. Wysyłasz z giełdy? Upewnij się, że **dojdzie** dokładnie ta kwota.'),
        point(`Serwer utworzy się sam po ${c.chain === 'sol' ? 'finalizacji transakcji (ok. 15 s)' : `**${hostingTimes.confirmations} potwierdzeniach** w sieci`}.`),
      ].join('\n'),
    );
    const buttons = [
      new ButtonBuilder().setCustomId(`hs:copy:${guildId}:${o.id}:addr`).setLabel('Skopiuj adres').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`hs:copy:${guildId}:${o.id}:amt`).setLabel('Skopiuj kwotę').setEmoji('💰').setStyle(ButtonStyle.Secondary),
    ];
    if (waiting) buttons.push(new ButtonBuilder().setCustomId(`hs:cancel:${guildId}:${o.id}`).setLabel('Anuluj').setEmoji('❌').setStyle(ButtonStyle.Danger));
    b.addActionRowComponents((r) => r.setComponents(...buttons));
  }
  sep(b);
  footer(b);
  return b;
}

/** Dane do płatności w tickecie zakupu ręcznego. */
function manualPaymentView(form) {
  const plan = planOf(form.period);
  const coin = cryptoCoins[form.payment];
  const wallet = coin ? walletFor(form.payment) : null;
  const info = coin
    ? wallet && `Wyślij równowartość **${plan[1]}** w **${coin.label}** (sieć **${coin.network}**) na adres:\n\`${wallet}\``
    : hostingConfig.manualPayments?.[form.payment];
  const b = box(colors.gold);
  text(
    b,
    [
      title('Płatność', '💳'),
      '>>> ' + [row('📦 Pakiet', `${plan[0]} — **${plan[1]}**`), row('💳 Metoda', payLabel(form.payment))].join('\n'),
      '',
      `### 📬 ${x} Dane do płatności`,
      info || 'Właściciel poda je w tym tickecie.',
      '',
      hostingLanguages[form.lang]?.manualOnly ? '-# 🧩 Inny język: właściciel ustali z Tobą szczegóły w tym tickecie.' : null,
      '-# Po wpłacie wyślij tutaj potwierdzenie (zrzut ekranu albo ID transakcji). Właściciel sprawdzi płatność, kliknie „Potwierdź”, a serwer utworzy się automatycznie.',
    ]
      .filter((l) => l !== null)
      .join('\n'),
  );
  return b;
}

function myHostingView(recs, orders, guildId) {
  const b = box();
  const lines = recs.map((rec) =>
    [
      `### ${rec.suspended ? '⛔' : '🟢'} ${x} ${rec.name}`,
      row('🆔 ID', `\`${rec.id}\``),
      row('💻 Język', langLabel(rec.lang)),
      row(rec.suspended ? '⛔ Zablokowany od' : '📅 Ważny do', rec.suspended ? ts(rec.suspendedAt ?? rec.expiresAt, 'f') : `${ts(rec.expiresAt, 'f')} (${ts(rec.expiresAt)})`),
    ].join('\n'),
  );
  const pending = orders.map((o) => row('⏳ Oczekująca płatność', `\`${o.amount} ${cryptoCoins[o.coin].label}\` — szczegóły w DM`));
  text(
    b,
    [title('Mój hosting', '🖥️'), lines.length ? lines.join('\n') : '*Nie masz jeszcze hostingu. Kup go na kanale z cennikiem albo w ticketach.*', ...pending, '', `-# 🌐 Panel: ${panelUrl() || '—'}`].join('\n'),
  );
  // Każdy serwer ma swój rząd: „Przedłuż” i „Zmień nazwę” (limit wiadomości Discorda: 10 serwerów).
  for (const rec of recs.slice(0, 10)) b.addActionRowComponents((r) => r.setComponents(renewButton(guildId, rec), renameButton(guildId, rec)));
  if (recs.length > 10) text(b, `-# …i ${recs.length - 10} więcej — napisz do administracji.`);
  return b;
}

function hostingListView(recs, heading) {
  const now = Date.now();
  const status = (rec) => (rec.suspended ? '⛔' : rec.expiresAt - now < 3 * DAY ? '🟡' : '🟢');
  const lines = recs
    .sort((a, b) => a.expiresAt - b.expiresAt)
    .slice(0, 40)
    .map((rec) => `${status(rec)} \`#${rec.id}\` **${rec.name}** • <@${rec.userId}> • do ${ts(rec.expiresAt, 'd')} (${ts(rec.expiresAt)})`);
  const more = recs.length > 40 ? `\n-# …i ${recs.length - 40} więcej` : '';
  return notice([`## 🖥️ ${x} ${heading} (${recs.length})`, lines.join('\n') || '*Brak serwerów.*'].join('\n') + more);
}

// ─── Formularze i przyciski hostingu ───────────────────────────────────

/** Nazwa serwera od klienta: bez znaków sterujących i podwójnych spacji, maks. 40 znaków. */
function cleanServerName(value) {
  const name = String(value ?? '')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return name || null;
}

/** Nazwa serwera oczyszczona (pole „pay” = „auto:ltc” zostaje obsługiwane dla starszych formularzy). */
function normalizeHostingForm(form) {
  if (form.pay) [form.mode, form.payment] = form.pay.split(':');
  form.name = cleanServerName(form.name);
  return form;
}

function hostingFormError(form) {
  if (!form.lang || !form.period || !form.mode || !form.payment) return 'Uzupełnij wszystkie pola formularza.';
  if (!hostingPayments[form.payment] || !['auto', 'manual'].includes(form.mode)) return 'Wybierz sposób płatności z listy.';
  if (!form.renew && !validEmail(form.email)) return 'Podaj poprawny adres e-mail — to będzie login do panelu hostingu.';
  if (form.mode === 'auto') {
    if (!form.renew && hostingLanguages[form.lang]?.manualOnly) return 'Ten język obsługujemy tylko przy **zakupie ręcznym** — wybierz „⏳ Ręczny”.';
    if (!cryptoCoins[form.payment]) return 'Zakup automatyczny działa tylko z kryptowalutami (LTC, ETH, USDC, SOL). Wybierz krypto albo „⏳ Ręczny”.';
  }
  return null;
}

/** Kwota z unikalną końcówką (po niej bot rozpoznaje wpłatę na wspólny adres). */
function cryptoAmount(coinKey, pln, rate, taken) {
  const c = cryptoCoins[coinKey];
  const stepUnits = Math.round(c.step * 10 ** c.shown);
  const base = Math.ceil(pln / rate / c.step - 1e-9) * stepUnits;
  const free = [];
  for (let k = 1; k < 1000; k++) if (!taken.has(base + k)) free.push(k);
  if (!free.length) throw userError('Za dużo zamówień naraz — spróbuj za kilka minut.');
  const shownUnits = base + free[randomInt(free.length)];
  return { shownUnits, amount: unitsToString(shownUnits, c.shown), units: (BigInt(shownUnits) * 10n ** BigInt(c.decimals - c.shown)).toString() };
}

let priceCache = { at: 0, data: {} };
/** Kursy w PLN w formacie { litecoin: { pln: 400 }, … }. Najpierw Coinbase, a gdy nie odpowiada — CoinGecko. */
async function cryptoPricesPln() {
  if (Date.now() - priceCache.at < 120_000) return priceCache.data;
  const coins = Object.values(cryptoCoins);
  const errors = [];
  const sources = [
    async () => {
      // Coinbase podaje, ile danej waluty dostaniesz za 1 PLN — kurs to odwrotność.
      const rates = (await getJson(`${hostingApi().coinbase}?currency=PLN`))?.data?.rates ?? {};
      return Object.fromEntries(coins.filter((c) => Number(rates[c.label]) > 0).map((c) => [c.gecko, { pln: 1 / Number(rates[c.label]) }]));
    },
    async () => {
      const ids = [...new Set(coins.map((c) => c.gecko))].join(',');
      const key = hostingConfig.coingeckoApiKey;
      return getJson(`${hostingApi().prices}?ids=${ids}&vs_currencies=pln`, key ? { headers: { 'x-cg-demo-api-key': key } } : {});
    },
  ];
  for (const source of sources) {
    try {
      const data = await source();
      if (coins.every((c) => data?.[c.gecko]?.pln > 0)) {
        priceCache = { at: Date.now(), data };
        return data;
      }
      errors.push('niepełne kursy');
    } catch (err) {
      errors.push(err.message);
    }
  }
  throw new Error(`Brak kursów krypto: ${errors.join(' | ')}`);
}

async function createCryptoOrder(guildId, userId, form) {
  const coin = cryptoCoins[form.payment];
  const rate = (await cryptoPricesPln())?.[coin.gecko]?.pln;
  if (!rate) throw new Error(`Brak kursu ${coin.gecko}/PLN`);
  const g = guild(guildId);
  const taken = new Set(Object.values(g.hosting.orders).filter((o) => o.coin === form.payment && activeOrder(o)).map((o) => o.shownUnits));
  const pln = planPln(form.period);
  const amount = cryptoAmount(form.payment, pln, rate, taken);
  const id = `${Date.now().toString(36)}${randomInt(36 ** 3).toString(36)}`;
  const order = {
    id,
    userId,
    coin: form.payment,
    wallet: walletFor(form.payment),
    ...amount,
    pln,
    rate,
    plan: form.period,
    lang: form.lang,
    name: form.name ?? null,
    email: form.email ?? null,
    renew: form.renew ?? null,
    createdAt: Date.now(),
    expiresAt: Date.now() + hostingTimes.payMinutes * 60_000,
    status: 'waiting',
    confirmations: 0,
    attempts: 0,
  };
  updateGuild(guildId, (gg) => (gg.hosting.orders[id] = order));
  return order;
}

async function onAutoPurchase(i, guildId, form) {
  if (!hostingReady()) return replyV2(i, fail('Automatyczny zakup jest chwilowo wyłączony. Wybierz **⏳ zakup ręczny**.'));
  if (!walletFor(form.payment)) return replyV2(i, fail(`Płatność ${payLabel(form.payment)} jest chwilowo niedostępna. Wybierz inną kryptowalutę albo zakup ręczny.`));
  if (Object.values(guild(guildId).hosting.orders).some((o) => o.userId === i.user.id && activeOrder(o))) {
    return replyV2(i, fail('Masz już zamówienie czekające na płatność — szczegóły są w DM (tam możesz je anulować).'));
  }
  await i.deferReply({ flags: V2_EPHEMERAL });
  try {
    if (!form.renew) {
      // Sprawdzamy wszystko przed płatnością, żeby klient nie zapłacił za coś, czego bot nie utworzy.
      await eggInfo(form.lang).catch((err) => {
        console.error(`Hosting: jajko ${form.lang}:`, err.message);
        throw userError('Ten język jest chwilowo niedostępny w zakupie automatycznym. Wybierz zakup ręczny.');
      });
      if (!(await findPanelUser(i.user.id)) && !(await emailFree(form.email))) {
        throw userError(`E-mail \`${form.email}\` ma już konto w panelu. Podaj inny adres.`);
      }
    }
    const order = await createCryptoOrder(guildId, i.user.id, form);
    const dm = await sendHostingDm(i.client, i.user.id, orderView(order, guildId));
    if (!dm) {
      updateGuild(guildId, () => (order.status = 'cancelled'));
      return i.editReply({ components: [fail('Nie mogę wysłać Ci wiadomości prywatnej. Włącz DM od członków serwera (Ustawienia prywatności serwera) i spróbuj ponownie.')], flags: V2 });
    }
    updateGuild(guildId, () => (order.dm = { channelId: dm.channelId, messageId: dm.id }));
    await syncOrder(i.client, guildId, order);
    await i.editReply({
      components: [ok(`Dane do płatności są w DM: **${order.amount} ${cryptoCoins[order.coin].label}**. Masz ${hostingTimes.payMinutes} minut na wpłatę.`)],
      flags: V2,
    });
  } catch (err) {
    if (!err.userFacing) console.error('Hosting (zakup):', err);
    const message = err.userFacing ? err.message : 'Nie udało się przygotować płatności (kurs lub panel nie odpowiada). Spróbuj za chwilę albo wybierz zakup ręczny.';
    await i.editReply({ components: [fail(message)], flags: V2 });
  }
}

async function updateOrderMessage(client, guildId, o) {
  if (!o.dm) return;
  const channel = await client.channels.fetch(o.dm.channelId).catch(() => null);
  const message = await channel?.messages.fetch(o.dm.messageId).catch(() => null);
  await message?.edit({ components: [orderView(o, guildId)], flags: V2 }).catch(() => {});
}

// ─── Logi zakupów automatycznych: jedna wiadomość na zamówienie, aktualizowana na żywo ───

const purchaseLogChannel = (guildId) => {
  const { settings } = guild(guildId);
  return settings.purchaseLogChannelId ?? ticketLogFor(settings, 'hosting');
};

function orderLogStatus(o) {
  const c = cryptoCoins[o.coin];
  return {
    waiting: `⏳ Czeka na wpłatę (do ${ts(o.expiresAt, 't')})`,
    seen: c.chain === 'sol' ? '🔄 Wpłata wykryta — czeka na finalizację' : `🔄 Wpłata wykryta — potwierdzenia ${o.confirmations}/${hostingTimes.confirmations}`,
    paid: '✅ Opłacone — tworzenie serwera',
    creating: '✅ Opłacone — tworzenie serwera',
    error: '⚠️ Opłacone, błąd panelu — bot ponawia',
    failed: '❌ Opłacone, ale serwer NIE powstał — dokończ ręcznie',
    done: o.renew ? '🖥️ Zrealizowane — hosting przedłużony' : '🖥️ Zrealizowane — serwer utworzony',
    expired: '⌛ Wygasło — brak wpłaty',
    cancelled: '❌ Anulowane przez klienta',
  }[o.status];
}

function orderLogView(o) {
  const c = cryptoCoins[o.coin];
  const plan = planOf(o.plan);
  const color =
    o.status === 'done' ? colors.success : ['failed', 'error'].includes(o.status) ? colors.danger : ['expired', 'cancelled'].includes(o.status) ? colors.neutral : colors.gold;
  const tx = o.txid ? `\`${String(o.txid).split(':')[0]}\`` : null;
  return notice(
    [
      `### 🧾 ${x} Zamówienie \`${o.id}\`${o.renew ? ' • przedłużenie' : ''}`,
      row('Status', `**${orderLogStatus(o)}**`),
      row('Klient', `<@${o.userId}> (\`${o.userId}\`)`),
      row('Pakiet', `${plan[0]} — ${plan[1]}`),
      o.renew ? row('Serwer', `ID \`${o.renew}\``) : row('Język', langLabel(o.lang)),
      o.renew ? null : row('Nazwa serwera', o.name ? `\`${o.name}\`` : '*domyślna*'),
      row('Kwota', `\`${o.amount} ${c.label}\` (${c.network}) ≈ ${o.pln} zł • kurs ${Number(o.rate).toFixed(2)} zł`),
      row('Adres', `\`${o.wallet}\``),
      '',
      point(`🧾 Utworzone ${ts(o.createdAt, 'T')}`),
      o.seenAt ? point(`🔄 Wpłata wykryta ${ts(o.seenAt, 'T')} • tx ${tx}`) : null,
      o.paidAt ? point(`✅ Potwierdzona ${ts(o.paidAt, 'T')}`) : null,
      o.doneAt ? point(`🖥️ Serwer \`#${o.serverId}\` ${o.renew ? 'przedłużony' : 'utworzony'} ${ts(o.doneAt, 'T')}`) : null,
      o.endedAt ? point(`${o.status === 'expired' ? '⌛ Wygasło' : '❌ Anulowane'} ${ts(o.endedAt, 'T')}`) : null,
      o.lastError && o.status !== 'done' ? point(`⚠️ Błąd (próba ${o.attempts}): \`${String(o.lastError).slice(0, 150)}\``) : null,
      o.status === 'failed' ? point(o.renew ? `Przedłuż ręcznie: \`/hosting przedluz serwer:${o.renew}\`` : 'Utwórz ręcznie: `/hosting utworz` (klient zapłacił).') : null,
    ]
      .filter((l) => l !== null)
      .join('\n'),
    color,
  );
}

async function updateOrderLog(client, guildId, o) {
  if (o.log) {
    const channel = await client.channels.fetch(o.log.channelId).catch(() => null);
    const message = await channel?.messages.fetch(o.log.messageId).catch(() => null);
    if (message) return message.edit({ components: [orderLogView(o)], flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
  }
  const channelId = purchaseLogChannel(guildId);
  const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
  const message = await channel?.send({ components: [orderLogView(o)], flags: V2, allowedMentions: { parse: [] } }).catch(() => null);
  if (message) updateGuild(guildId, () => (o.log = { channelId: message.channelId ?? channelId, messageId: message.id }));
}

/** Aktualizuje wiadomość klienta (DM) i log zamówienia. */
async function syncOrder(client, guildId, o) {
  await updateOrderMessage(client, guildId, o);
  await updateOrderLog(client, guildId, o);
}

function renewModal(guildId, serverId) {
  return new ModalBuilder()
    .setCustomId(`hs:renewsubmit:${guildId}:${serverId}`)
    .setTitle('🔁 Przedłuż hosting')
    .addLabelComponents(
      ['period', 'mode', 'payment'].map((id) => {
        const f = ticketTypes.hosting.fields.find((field) => field.id === id);
        return new LabelBuilder()
          .setLabel(f.label)
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId(id)
              .setPlaceholder('Wybierz…')
              .addOptions(f.select.map(([label, value]) => ({ label, value }))),
          );
      }),
    );
}

async function onRenewSubmit(i, guildId, serverId) {
  const rec = hostingServers(guildId)[serverId];
  if (!rec || rec.deleted) return replyV2(i, fail('Ten serwer już nie istnieje.'));
  if (rec.userId !== i.user.id) return replyV2(i, fail('To nie jest Twój serwer.'));
  const form = normalizeHostingForm({
    lang: rec.lang,
    period: i.fields.getStringSelectValues('period')[0],
    mode: i.fields.getStringSelectValues('mode')[0],
    payment: i.fields.getStringSelectValues('payment')[0],
    renew: String(serverId),
  });
  const error = hostingFormError(form);
  if (error) return replyV2(i, fail(error));
  if (form.mode === 'auto') return onAutoPurchase(i, guildId, form);
  const discordGuild = i.client.guilds.cache.get(guildId);
  if (!discordGuild) return replyV2(i, fail('Nie widzę serwera Discord sklepu.'));
  const open = openTicketsOf(guildId, i.user.id);
  if (open.length >= guild(guildId).settings.maxOpen) return replyV2(i, fail(`Masz już otwarty ticket: ${open.map((t) => `<#${t.channelId}>`).join(', ')}`));
  await i.deferReply({ flags: V2_EPHEMERAL });
  const { channel, error: ticketError } = await createTicket(i.client, discordGuild, i.user, 'hosting', form);
  await i.editReply({ components: [ticketError ? fail(ticketError) : ok(`Ticket przedłużenia utworzony: ${channel}`)], flags: V2 });
}

const confirmingTickets = new Set();

/** Staff potwierdza płatność w tickecie → bot tworzy albo przedłuża serwer i prosi klienta o voucha. */
async function onHostingConfirm(i) {
  const { ticket, error } = staffTicket(i);
  if (error) return replyV2(i, fail(error));
  if (ticket.type !== 'hosting' || !ticket.form?.lang) return replyV2(i, fail('To nie jest ticket zakupu hostingu.'));
  if (ticket.hostingServerId) return replyV2(i, fail('Hosting z tego ticketu jest już aktywny.'));
  if (hostingLanguages[ticket.form.lang]?.manualOnly) return replyV2(i, fail('Inny język: utwórz serwer ręcznie w panelu, a potem przypisz go komendą `/hosting dodaj`.'));
  if (!hostingReady()) return replyV2(i, fail('Brak konfiguracji panelu (config.json → hosting). Uzupełnij ją i zrestartuj bota.'));
  if (confirmingTickets.has(ticket.channelId)) return replyV2(i, fail('Serwer już się tworzy…'));
  confirmingTickets.add(ticket.channelId);
  await i.deferReply();
  try {
    const res = await activateHosting(i.client, i.guildId, {
      key: `t-${ticket.channelId}`,
      userId: ticket.userId,
      lang: ticket.form.lang,
      name: ticket.form.name,
      plan: ticket.form.period,
      email: ticket.form.email,
      renew: ticket.form.renew,
      payment: ticket.form.payment,
      source: `ręcznie, potwierdził <@${i.user.id}>`,
    });
    const plan = planOf(ticket.form.period);
    const lc = guild(i.guildId).settings.lcChannelId;
    const deal = { product: `${ticket.form.renew ? 'Przedłużenie hostingu' : 'Hosting'} ${plan[0]}`, price: plan[1], payment: repPaymentOf(ticket.form.payment), sellerId: i.user.id };
    updateGuild(i.guildId, (gg) => Object.assign(gg.tickets[ticket.channelId], { hostingServerId: res.rec.id, deal, decidedBy: i.user.id, awaitingRep: Boolean(lc) }));
    const updated = getTicket(i.guildId, ticket.channelId);
    const user = await i.client.users.fetch(updated.userId);
    const card = await i.channel.messages.fetch(updated.messageId).catch(() => null);
    await card?.edit({ components: [ticketMessage(updated, user)], flags: V2 }).catch(() => {});
    await i.editReply({
      components: [
        notice(
          [
            `### ✅ ${x} ${ticket.form.renew ? 'Hosting przedłużony' : 'Serwer utworzony'}`,
            row('🖥️ Serwer', `\`${res.rec.name}\` (ID \`${res.rec.id}\`)`),
            row('📅 Ważny do', ts(res.rec.expiresAt, 'f')),
            row('📩 Klient', res.dmOk ? 'dostał szczegóły w DM' : 'ma zablokowane DM — szczegóły poniżej'),
          ].join('\n'),
          colors.success,
        ),
      ],
      flags: V2,
    });
    if (!res.dmOk && res.account) await i.channel.send({ components: [hostingReadyView(res.rec, res.account, i.guildId)], flags: V2 });
    if (lc) await i.channel.send({ components: [repRequestView(updated, lc)], flags: V2, allowedMentions: { users: [updated.userId] } });
  } catch (err) {
    if (!err.userFacing) console.error('Hosting (potwierdzenie):', err);
    await i.editReply({ components: [fail(err.userFacing ? err.message : describeError(err))], flags: V2 });
  } finally {
    confirmingTickets.delete(ticket.channelId);
  }
}

function renameModal(guildId, rec) {
  return new ModalBuilder()
    .setCustomId(`hs:renamesubmit:${guildId}:${rec.id}`)
    .setTitle('✏️ Nazwa serwera')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Nowa nazwa serwera')
        .setTextInputComponent(new TextInputBuilder().setCustomId('name').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(40).setValue(rec.name.slice(0, 40))),
    );
}

/** Właściciel serwera (albo staff na serwerze Discord) może zmienić jego nazwę w panelu. */
function canManageHosting(i, rec) {
  return rec.userId === i.user.id || (i.inGuild?.() && isStaff(i.member, guild(i.guildId).settings));
}

async function onRenameSubmit(i, guildId, rec) {
  const name = cleanServerName(i.fields.getTextInputValue('name'));
  if (!name) return replyV2(i, fail('Nazwa nie może być pusta.'));
  if (!hostingReady()) return replyV2(i, fail('Panel jest chwilowo niedostępny. Spróbuj później.'));
  await i.deferReply({ flags: V2_EPHEMERAL });
  try {
    // PATCH /details wymaga też właściciela i external_id — przepisujemy obecne wartości.
    const a = (await ptero('GET', `/servers/${rec.id}`)).attributes;
    await ptero('PATCH', `/servers/${rec.id}/details`, { name, user: a.user, external_id: a.external_id ?? null, description: a.description ?? null });
    const old = rec.name;
    updateGuild(guildId, () => (rec.name = name));
    await hostingLog(i.client, guildId, `### ✏️ ${x} Zmiana nazwy serwera\n${row('Serwer', `\`#${rec.id}\` ${old} → **${name}**`)}\n${row('Przez', `<@${i.user.id}>`)}`);
    await i.editReply({ components: [ok(`Nowa nazwa serwera: **${name}**`)], flags: V2 });
  } catch (err) {
    if (!err.userFacing) console.error('Hosting (nazwa):', err);
    await i.editReply({ components: [fail(notFound(err) ? 'Ten serwer już nie istnieje w panelu.' : 'Nie udało się zmienić nazwy — spróbuj za chwilę.')], flags: V2 });
  }
}

/** Przyciski i formularze hostingu (działają też w DM, więc guildId jest w customId). */
async function routeHosting(i) {
  const [, action, guildId, id, extra] = i.customId.split(':');
  if (action === 'confirm' && i.isButton()) return onHostingConfirm(i);
  if (action === 'renew' && i.isButton()) {
    const rec = hostingServers(guildId)[id];
    if (!rec || rec.deleted) return replyV2(i, fail('Ten serwer już nie istnieje.'));
    if (rec.userId !== i.user.id) return replyV2(i, fail('To nie jest Twój serwer.'));
    return i.showModal(renewModal(guildId, id));
  }
  if (action === 'renewsubmit' && i.isModalSubmit()) return onRenewSubmit(i, guildId, id);
  if (action === 'rename' || action === 'renamesubmit') {
    const rec = hostingServers(guildId)[id];
    if (!rec || rec.deleted) return replyV2(i, fail('Ten serwer już nie istnieje.'));
    if (!canManageHosting(i, rec)) return replyV2(i, fail('To nie jest Twój serwer.'));
    if (action === 'rename' && i.isButton()) return i.showModal(renameModal(guildId, rec));
    if (action === 'renamesubmit' && i.isModalSubmit()) return onRenameSubmit(i, guildId, rec);
  }
  const order = guild(guildId).hosting.orders[id];
  if (!order || order.userId !== i.user.id) return replyV2(i, fail('Nie znaleziono zamówienia.'));
  if (action === 'copy' && i.isButton()) {
    // Zwykły tekst (bez Components V2) — na telefonie łatwo go skopiować przytrzymaniem.
    return i.reply({ content: extra === 'addr' ? order.wallet : order.amount, flags: MessageFlags.Ephemeral });
  }
  if (action === 'cancel' && i.isButton()) {
    if (order.status !== 'waiting') return replyV2(i, fail('Tego zamówienia nie można już anulować (płatność została wykryta albo zamówienie się zakończyło).'));
    updateGuild(guildId, () => Object.assign(order, { status: 'cancelled', endedAt: Date.now() }));
    await i.update({ components: [orderView(order, guildId)] });
    return updateOrderLog(i.client, guildId, order);
  }
}

// ─── Sprawdzanie blockchainu ───────────────────────────────────────────
// Każdy skaner zwraca wpłaty na adres: { txid, coin, units (BigInt), confirmations, time }.

// Litecoin: dwa niezależne źródła. Bot zaczyna od tego, które ostatnio działało.
const ltcSources = [
  { name: 'litecoinspace.org', scan: scanLtcEsplora },
  { name: 'BlockCypher', scan: scanLtcBlockcypher },
];
let ltcSource = 0;

async function scanLtc(wallet, since) {
  const errors = [];
  for (let n = 0; n < ltcSources.length; n++) {
    const idx = (ltcSource + n) % ltcSources.length;
    try {
      const txs = await ltcSources[idx].scan(wallet, since);
      ltcSource = idx;
      return txs;
    } catch (err) {
      errors.push(`${ltcSources[idx].name}: ${err.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

async function scanLtcBlockcypher(wallet, since) {
  const data = await getJson(`${hostingApi().ltcBlockcypher}/addrs/${wallet}?limit=50`, { timeout: 12_000 });
  // Wyjścia na nasz adres mają tx_input_n = -1. Jedna transakcja może mieć kilka wyjść — sumujemy.
  const byTx = new Map();
  for (const ref of [...(data?.unconfirmed_txrefs ?? []), ...(data?.txrefs ?? [])]) {
    if (ref.tx_input_n !== -1) continue;
    const time = Date.parse(ref.confirmed ?? ref.received ?? '') || Date.now();
    const prev = byTx.get(ref.tx_hash);
    byTx.set(ref.tx_hash, {
      txid: ref.tx_hash,
      coin: 'ltc',
      units: (prev?.units ?? 0n) + BigInt(ref.value),
      confirmations: Math.max(prev?.confirmations ?? 0, ref.confirmations ?? 0),
      time,
    });
  }
  return [...byTx.values()].filter((t) => t.units > 0n && t.time >= since);
}

async function scanLtcEsplora(wallet, since) {
  const api = hostingApi().ltc;
  const [tip, txs] = await Promise.all([getJson(`${api}/blocks/tip/height`, { timeout: 12_000 }), getJson(`${api}/address/${wallet}/txs`, { timeout: 12_000 })]);
  const out = [];
  for (const tx of txs ?? []) {
    const units = (tx.vout ?? []).filter((v) => v.scriptpubkey_address === wallet).reduce((sum, v) => sum + BigInt(v.value), 0n);
    const time = tx.status?.block_time ? tx.status.block_time * 1000 : Date.now();
    if (units <= 0n || time < since) continue;
    const confirmations = tx.status?.confirmed ? Number(tip) - tx.status.block_height + 1 : 0;
    out.push({ txid: tx.txid, coin: 'ltc', units, confirmations, time });
  }
  return out;
}

async function ethApi(params) {
  const key = hostingConfig.etherscanApiKey;
  const base = key ? `https://api.etherscan.io/v2/api?chainid=1&apikey=${encodeURIComponent(key)}&` : `${hostingApi().eth}?`;
  const data = await getJson(base + new URLSearchParams(params));
  if (Array.isArray(data?.result)) return data.result;
  if (/no .*(transactions|records|transfers)/i.test(`${data?.message} ${data?.result}`)) return [];
  throw new Error(`ETH API: ${data?.message ?? '?'} ${typeof data?.result === 'string' ? data.result : ''}`.trim());
}

let ethTip = { at: 0, n: 0 };
async function ethBlockNumber() {
  if (Date.now() - ethTip.at < 10_000) return ethTip.n;
  const d = await getJson(hostingApi().ethRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  });
  ethTip = { at: Date.now(), n: parseInt(d.result, 16) };
  return ethTip.n;
}

async function scanEth(wallet, coins, since) {
  const base = { module: 'account', address: wallet, sort: 'desc', page: 1, offset: 50 };
  const found = [];
  if (coins.has('eth')) {
    for (const tx of await ethApi({ ...base, action: 'txlist' })) {
      if (tx.isError !== '1' && tx.txreceipt_status !== '0') found.push({ tx, coin: 'eth', txid: tx.hash });
    }
    // Wypłaty z giełd i portfeli-kontraktów przychodzą jako transakcje wewnętrzne.
    for (const tx of await ethApi({ ...base, action: 'txlistinternal' })) {
      if (tx.isError !== '1') found.push({ tx, coin: 'eth', txid: `${tx.hash}:internal` });
    }
  }
  if (coins.has('usdc_eth')) {
    const token = cryptoCoins.usdc_eth.token;
    for (const tx of await ethApi({ ...base, action: 'tokentx', contractaddress: token })) {
      if (String(tx.contractAddress).toLowerCase() === token) found.push({ tx, coin: 'usdc_eth', txid: `${tx.hash}:${tx.logIndex ?? 0}` });
    }
  }
  const out = [];
  let tip = null;
  for (const { tx, coin, txid } of found) {
    const time = Number(tx.timeStamp) * 1000;
    if (String(tx.to).toLowerCase() !== wallet.toLowerCase() || time < since) continue;
    let confirmations = tx.confirmations === undefined || tx.confirmations === '' ? NaN : Number(tx.confirmations);
    if (Number.isNaN(confirmations)) {
      tip ??= await ethBlockNumber();
      confirmations = tip - Number(tx.blockNumber) + 1;
    }
    out.push({ txid, coin, units: BigInt(tx.value), confirmations, time });
  }
  return out;
}

async function solRpc(method, params) {
  const d = await getJson(hostingApi().sol, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (d?.error) throw new Error(`Solana RPC: ${d.error.message}`);
  return d?.result;
}

/** Ile SOL i USDC (w najmniejszych jednostkach) dostał portfel w transakcji. */
function parseSolTx(tx, wallet, mint) {
  if (!tx?.meta || tx.meta.err) return { sol: 0n, usdc: 0n };
  const keys = (tx.transaction?.message?.accountKeys ?? []).map((k) => (typeof k === 'string' ? k : k.pubkey));
  const idx = keys.indexOf(wallet);
  const sol = idx >= 0 ? BigInt(tx.meta.postBalances[idx]) - BigInt(tx.meta.preBalances[idx]) : 0n;
  const tokens = (list) => (list ?? []).filter((t) => t.mint === mint && t.owner === wallet).reduce((sum, t) => sum + BigInt(t.uiTokenAmount.amount), 0n);
  return { sol, usdc: tokens(tx.meta.postTokenBalances) - tokens(tx.meta.preTokenBalances) };
}

const solTxCache = new Map();
let solTokenAccounts = { at: 0, wallet: '', list: [] };

async function scanSol(wallet, coins, since) {
  const mint = cryptoCoins.usdc_sol.token;
  // Portfel łapie SOL i pierwszą wpłatę USDC (gdy tworzy się konto tokenu); kolejne USDC trafiają na konto tokenu.
  const addresses = [wallet];
  if (coins.has('usdc_sol')) {
    const stale = solTokenAccounts.wallet !== wallet || !solTokenAccounts.list.length || Date.now() - solTokenAccounts.at > 10 * 60_000;
    if (stale) {
      const res = await solRpc('getTokenAccountsByOwner', [wallet, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      solTokenAccounts = { at: Date.now(), wallet, list: (res?.value ?? []).map((v) => v.pubkey) };
    }
    addresses.push(...solTokenAccounts.list);
  }
  const sigs = new Map();
  for (const address of addresses) {
    for (const s of (await solRpc('getSignaturesForAddress', [address, { limit: 25, commitment: 'confirmed' }])) ?? []) {
      if (s.err || (s.blockTime && s.blockTime * 1000 < since)) continue;
      if (sigs.get(s.signature)?.confirmationStatus !== 'finalized') sigs.set(s.signature, s);
    }
  }
  const out = [];
  for (const s of sigs.values()) {
    let parsed = solTxCache.get(s.signature);
    if (!parsed) {
      const tx = await solRpc('getTransaction', [s.signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]);
      if (!tx) continue;
      parsed = parseSolTx(tx, wallet, mint);
      solTxCache.set(s.signature, parsed);
      if (solTxCache.size > 1000) solTxCache.delete(solTxCache.keys().next().value);
    }
    const confirmations = s.confirmationStatus === 'finalized' ? hostingTimes.confirmations : s.confirmationStatus === 'confirmed' ? 1 : 0;
    const time = (s.blockTime ?? Math.floor(Date.now() / 1000)) * 1000;
    if (parsed.sol > 0n && coins.has('sol')) out.push({ txid: s.signature, coin: 'sol', units: parsed.sol, confirmations, time });
    if (parsed.usdc > 0n && coins.has('usdc_sol')) out.push({ txid: `${s.signature}:usdc`, coin: 'usdc_sol', units: parsed.usdc, confirmations, time });
  }
  return out;
}

function scanChain(chain, wallet, coins, since) {
  if (chain === 'ltc') return scanLtc(wallet, since);
  if (chain === 'eth') return scanEth(wallet, coins, since);
  if (chain === 'sol') return scanSol(wallet, coins, since);
  return Promise.resolve([]);
}

// ─── Pętla hostingu: płatności co 30 s, terminy co 5 minut ─────────────

async function fulfilOrder(client, guildId, o) {
  updateGuild(guildId, () => Object.assign(o, { status: 'creating', attempts: (o.attempts ?? 0) + 1 }));
  await syncOrder(client, guildId, o);
  try {
    const res = await activateHosting(client, guildId, {
      key: o.id,
      userId: o.userId,
      lang: o.lang,
      name: o.name,
      plan: o.plan,
      email: o.email,
      renew: o.renew,
      payment: o.coin,
      source: `automatycznie, ${o.amount} ${cryptoCoins[o.coin].label}, tx \`${String(o.txid).split(':')[0]}\``,
    });
    updateGuild(guildId, () => Object.assign(o, { status: 'done', serverId: res.rec.id, doneAt: Date.now() }));
  } catch (err) {
    const final = err.userFacing || o.attempts >= 10;
    updateGuild(guildId, () => Object.assign(o, { status: final ? 'failed' : 'error', lastError: String(err.message).slice(0, 300) }));
    if (!o.errorNotified || final) {
      updateGuild(guildId, () => (o.errorNotified = true));
      await hostingLog(
        client,
        guildId,
        [
          `### ⚠️ ${x} Opłacone zamówienie nie zostało zrealizowane${final ? '' : ' (ponawiam)'}`,
          row('Klient', `<@${o.userId}>`),
          row('Zamówienie', `\`${o.id}\` • ${o.amount} ${cryptoCoins[o.coin].label} • tx \`${String(o.txid).split(':')[0]}\``),
          row('Błąd', `\`${String(err.message).slice(0, 200)}\``),
          final ? point(o.renew ? `Przedłuż ręcznie: \`/hosting przedluz serwer:${o.renew}\`` : 'Utwórz ręcznie: `/hosting utworz` (klient już zapłacił).') : null,
        ]
          .filter(Boolean)
          .join('\n'),
        colors.danger,
      );
    }
  }
  await syncOrder(client, guildId, o);
}

async function processOrders(client, guildId) {
  const g = guild(guildId);
  const now = Date.now();
  const grace = 5 * 60_000;
  const orders = Object.values(g.hosting.orders);
  const need = hostingTimes.confirmations;

  for (const o of orders.filter((o) => o.status === 'waiting' && now > o.expiresAt + grace)) {
    updateGuild(guildId, () => Object.assign(o, { status: 'expired', endedAt: now }));
    await syncOrder(client, guildId, o);
  }

  // Jedno zapytanie na sieć i portfel, niezależnie od liczby zamówień.
  const groups = new Map();
  for (const o of orders.filter(activeOrder)) {
    const key = `${cryptoCoins[o.coin].chain}|${o.wallet}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const used = new Set(g.hosting.usedTx);
  for (const [key, list] of groups) {
    const [chain, wallet] = key.split('|');
    let txs;
    try {
      txs = await scanChain(chain, wallet, new Set(list.map((o) => o.coin)), Math.min(...list.map((o) => o.createdAt)) - 10 * 60_000);
    } catch (err) {
      warnOnce(`scan:${chain}`, `⚠️ Hosting: nie mogę sprawdzić sieci ${chain.toUpperCase()} (${err.message}). Ponowię za 30 s.`);
      continue;
    }
    for (const o of list) {
      const before = `${o.status}|${o.confirmations}`;
      if (o.status === 'waiting') {
        const tx = txs.find(
          (t) => t.coin === o.coin && t.units === BigInt(o.units) && t.time >= o.createdAt - 2 * 60_000 && t.time <= o.expiresAt + grace && !used.has(t.txid),
        );
        if (tx) {
          used.add(tx.txid);
          updateGuild(guildId, (gg) => {
            Object.assign(o, { status: 'seen', txid: tx.txid, seenAt: now });
            gg.hosting.usedTx = [...gg.hosting.usedTx, tx.txid].slice(-2000);
          });
        }
      }
      if (o.status === 'seen') {
        const tx = txs.find((t) => t.txid === o.txid);
        if (tx) o.confirmations = Math.max(0, Math.min(tx.confirmations, need));
        if (o.confirmations >= need) Object.assign(o, { status: 'paid', paidAt: now });
        else if (now - o.seenAt > 6 * 3600_000 && !o.stuckNotified) {
          o.stuckNotified = true;
          await hostingLog(client, guildId, `### ⚠️ ${x} Płatność bez potwierdzeń od 6 h\n${row('Klient', `<@${o.userId}>`)}\n${row('Transakcja', `\`${o.txid}\``)}`, colors.warning);
        }
      }
      if (`${o.status}|${o.confirmations}` !== before) {
        save();
        await syncOrder(client, guildId, o);
      }
    }
  }

  // 'creating' zostaje tylko po restarcie bota w trakcie tworzenia — external_id chroni przed duplikatem.
  for (const o of orders.filter((o) => o.status === 'paid' || o.status === 'creating' || (o.status === 'error' && o.attempts < 10))) {
    await fulfilOrder(client, guildId, o);
  }
}

async function checkExpirations(client, guildId) {
  const now = Date.now();
  for (const rec of Object.values(hostingServers(guildId))) {
    if (rec.deleted) continue;
    if (!rec.suspended && now >= rec.expiresAt) {
      try {
        await suspendHosting(guildId, rec);
      } catch (err) {
        if (notFound(err)) updateGuild(guildId, () => (rec.deleted = true));
        else warnOnce(`suspend:${rec.id}`, `⚠️ Hosting: nie mogę zablokować serwera ${rec.id}: ${err.message}`);
        continue;
      }
      await sendHostingDm(client, rec.userId, hostingExpiredView(rec, guildId));
      await hostingLog(client, guildId, `### ⛔ ${x} Hosting zablokowany (koniec okresu)\n${recLine(rec)}`, colors.warning);
      continue;
    }
    if (!rec.suspended) {
      const left = rec.expiresAt - now;
      const due = hostingTimes.remindDays.filter((d) => left <= d * DAY && !(rec.reminded ?? []).includes(d));
      if (due.length) {
        const smallest = Math.min(...due);
        updateGuild(guildId, () => (rec.reminded = [...new Set([...(rec.reminded ?? []), ...hostingTimes.remindDays.filter((d) => d >= smallest)])]));
        await sendHostingDm(client, rec.userId, hostingReminderView(rec, guildId));
      }
    }
    if (rec.suspended && !rec.deleteNotified && now >= (rec.suspendedAt ?? rec.expiresAt) + hostingTimes.deleteNoticeDays * DAY) {
      updateGuild(guildId, () => (rec.deleteNotified = true));
      await hostingLog(
        client,
        guildId,
        [
          `### 🗑️ ${x} Serwer można usunąć`,
          recLine(rec),
          point(`Zablokowany od ${ts(rec.suspendedAt ?? rec.expiresAt, 'f')} i nieprzedłużony.`),
          point(`Usuń: \`/hosting usun serwer:${rec.id} potwierdz:True\` (albo zostaw — pliki czekają).`),
        ].join('\n'),
        colors.danger,
      );
    }
  }
}

let hostingBusy = false;
let lastExpiryCheck = 0;

async function hostingTick(client) {
  if (hostingBusy) return;
  hostingBusy = true;
  try {
    const checkTerms = Date.now() - lastExpiryCheck >= 5 * 60_000;
    if (checkTerms) lastExpiryCheck = Date.now();
    for (const [guildId, g] of Object.entries(store.guilds)) {
      if (!g.hosting) continue;
      if (Object.values(g.hosting.orders ?? {}).length) await processOrders(client, guildId).catch((err) => console.error('Hosting (płatności):', err));
      if (checkTerms && hostingReady()) await checkExpirations(client, guildId).catch((err) => console.error('Hosting (terminy):', err));
    }
  } finally {
    hostingBusy = false;
  }
}

function hostingLoop(client) {
  hostingTick(client).catch(console.error);
  setInterval(() => hostingTick(client).catch(console.error), 30_000);
}

/** /hosting test — sprawdza po kolei wszystko, czego potrzebuje hosting. */
async function hostingDiagnostics() {
  const out = [];
  const check = async (label, fn) => {
    try {
      out.push(`✅ **${label}:** ${(await fn()) ?? 'OK'}`);
    } catch (err) {
      out.push(`❌ **${label}:** ${String(err.message).slice(0, 180)}`);
    }
  };
  await check('Panel (klucz Application API)', async () => {
    if (!hostingReady()) throw new Error('brak `panelUrl` albo `apiKey` w config.json → hosting');
    return `${panelUrl()} • lokalizacje: ${(await deployLocations()).join(', ')}`;
  });
  await check('Węzeł i wolne porty', async () => {
    const nodes = (await ptero('GET', '/nodes?per_page=100')).data.map((n) => n.attributes);
    const pub = nodes.filter((n) => n.public);
    if (!pub.length) throw new Error('żaden węzeł nie jest publiczny (Admin → Nodes → węzeł → Settings → Node Visibility: Public)');
    let free = 0;
    for (const node of pub) {
      const allocs = (await ptero('GET', `/nodes/${node.id}/allocations?per_page=500`)).data ?? [];
      free += allocs.filter((a) => !a.attributes.assigned).length;
    }
    if (!free) throw new Error('brak wolnych portów — dodaj porty: Admin → Nodes → węzeł → Allocation');
    return `publiczne węzły: ${pub.map((n) => n.name).join(', ')} • wolne porty: ${free}`;
  });
  eggCache.clear();
  for (const lang of Object.keys(hostingLanguages).filter((l) => !hostingLanguages[l].manualOnly)) {
    await check(`Jajko ${hostingLanguages[lang].label}`, async () => {
      const egg = await eggInfo(lang);
      return `egg ${egg.id} • ${egg.image}`;
    });
  }
  await check('Klucz Client API (auto-start)', async () => {
    if (!hostingConfig.clientApiKey) return 'nie ustawiony — po odblokowaniu klient sam kliknie Start';
    await ptero('GET', '', null, true);
    return 'działa';
  });
  priceCache.at = 0;
  await check('Kursy PLN', async () =>
    Object.entries(await cryptoPricesPln())
      .map(([id, v]) => `${id} ${Number(v.pln).toFixed(2)} zł`)
      .join(' • '),
  );
  const formats = { ltc: /^(ltc1[a-z0-9]{20,90}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,34})$/, eth: /^0x[0-9a-fA-F]{40}$/, sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ };
  for (const chain of ['ltc', 'eth', 'sol']) {
    await check(`Portfel i API ${chain.toUpperCase()}`, async () => {
      const wallet = hostingConfig.wallets?.[chain];
      if (!wallet) throw new Error(`brak adresu w config.json → hosting.wallets.${chain} (ta sieć jest wyłączona)`);
      if (!formats[chain].test(wallet)) throw new Error(`adres \`${wallet}\` nie wygląda na adres ${chain.toUpperCase()}`);
      const coins = new Set(Object.keys(cryptoCoins).filter((k) => cryptoCoins[k].chain === chain));
      const txs = await scanChain(chain, wallet, coins, Date.now() - 30 * DAY);
      return `\`${wallet}\` • wpłat z 30 dni: ${txs.length}${chain === 'ltc' ? ` • źródło: ${ltcSources[ltcSource].name}` : ''}`;
    });
  }
  return out;
}

// ═══ OPINIE ════════════════════════════════════════════════════════════

function reviewModal(guildId) {
  const starOptions = [5, 4, 3, 2, 1].map((n) => ({
    label: `${'⭐'.repeat(n)} ${['', 'Słabo', 'Może być', 'Dobrze', 'Bardzo dobrze', 'Rewelacja'][n]}`,
    value: String(n),
  }));
  return new ModalBuilder()
    .setCustomId(`rev:submit:${guildId}`)
    .setTitle(`⭐ Opinia o ${brand.name}`.slice(0, 45))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Co kupiłeś/aś?')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('product')
            .setPlaceholder('Wybierz produkt…')
            .addOptions(Object.entries(reviewProducts).map(([value, p]) => ({ label: p.label, value, emoji: p.emoji }))),
        ),
      ...reviewCriteria.map((cr) =>
        new LabelBuilder()
          .setLabel(`${cr.emoji} ${cr.label}`)
          .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId(cr.id).setPlaceholder('Twoja ocena…').addOptions(starOptions)),
      ),
      new LabelBuilder()
        .setLabel('Treść opinii')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('content')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Jak przebiegła współpraca? Czy bot działa tak, jak chciałeś/aś?')
            .setMaxLength(800),
        ),
    );
}

async function onReviewOpen(i, guildId) {
  const g = guild(guildId);
  if (!g.settings.reviewChannelId) return replyV2(i, fail('Kanał opinii nie jest ustawiony. Administrator musi użyć `/setup`.'));
  const last = [...g.reviews].reverse().find((r) => r.userId === i.user.id);
  if (last && Date.now() - last.at < reviewCooldownMinutes * 60_000) {
    return replyV2(i, fail(`Możesz dodać kolejną opinię ${ts(last.at + reviewCooldownMinutes * 60_000)}.`));
  }
  await i.showModal(reviewModal(guildId));
}

async function onReviewSubmit(i, guildId) {
  const g = guild(guildId);
  const ratings = Object.fromEntries(reviewCriteria.map((cr) => [cr.id, Number(i.fields.getStringSelectValues(cr.id)[0])]));
  const review = {
    number: g.reviews.length + 1,
    userId: i.user.id,
    product: i.fields.getStringSelectValues('product')[0],
    content: i.fields.getTextInputValue('content'),
    ratings,
    at: Date.now(),
  };
  const channel = await i.client.channels.fetch(g.settings.reviewChannelId).catch(() => null);
  if (!channel) return replyV2(i, fail('Nie znaleziono kanału opinii.'));
  await i.deferReply({ flags: V2_EPHEMERAL });
  const msg = await channel.send({ components: [reviewCard(review, i.user)], flags: V2, allowedMentions: { parse: [] } });
  review.messageId = msg.id;
  updateGuild(guildId, (gg) => gg.reviews.push(review));
  await i.editReply({ components: [ok(`Dziękujemy za opinię! ${msg.url}`)], flags: V2 });
  await movePanelToBottom(i.client, guildId, 'opinie', channel);
}

// Kolejka na serwer, żeby dwie opinie naraz nie zostawiły dwóch paneli.
const panelQueues = new Map();

/**
 * Panel ma być zawsze pod ostatnią wiadomością: usuwamy stary i wysyłamy nowy na dole kanału.
 * Jeśli panel stoi na innym kanale niż opinie, tylko go odświeżamy.
 */
function movePanelToBottom(client, guildId, type, channel, createIfMissing = type === 'vouch') {
  const previous = panelQueues.get(guildId) ?? Promise.resolve();
  const next = previous.then(async () => {
    const ref = guild(guildId).panels[type];
    if (ref && ref.channelId !== channel.id) return refreshPanel(client, guildId, type);
    if (ref) {
      const old = await channel.messages.fetch(ref.messageId).catch(() => null);
      await old?.delete().catch(() => {});
    }
    if (ref || createIfMissing) await postPanel(client, channel.guild, channel, type);
  });
  const settled = next.catch((err) => console.error(`Panel ${type}:`, err.message));
  panelQueues.set(guildId, settled);
  return settled;
}

// ═══ PANELE: WYSYŁANIE I ODŚWIEŻANIE ══════════════════════════════════

const panelBuilders = {
  tickety: (g, logo) => ticketsPanel(g, logo),
  regulamin: (g, logo) => rulesPanel(g, logo),
  opinie: (g, logo) => reviewsPanel(g, logo),
  legit: (g, logo) => legitPanel(g, logo),
  cennik: (g, logo) => pricingPanel(g, logo),
  vouch: (g, logo) => vouchPanel(g, logo),
};

/** Wysyła panel na kanał i zapamiętuje go. Zły link do baneru → wysyła bez baneru. */
async function postPanel(client, discordGuild, channel, type) {
  const logo = logoOf(discordGuild, client);
  let message;
  let warning = '';
  try {
    message = await channel.send({ components: [panelBuilders[type](guild(discordGuild.id), logo)], files: bannerAttachments(guild(discordGuild.id), type), flags: V2 });
  } catch (err) {
    // 50035 = Discord odrzucił treść — zwykle zły link do baneru. Próbujemy bez niego.
    if (err.code !== 50035 || !guild(discordGuild.id).settings.banners[type]) throw err;
    updateGuild(discordGuild.id, (gg) => delete gg.settings.banners[type]);
    message = await channel.send({ components: [panelBuilders[type](guild(discordGuild.id), logo)], files: bannerAttachments(guild(discordGuild.id), type), flags: V2 });
    warning = '\n⚠️ Link do baneru był nieprawidłowy — panel wysłano bez niego.';
  }
  updateGuild(discordGuild.id, (gg) => (gg.panels[type] = { channelId: channel.id, messageId: message.id }));
  if (type === 'legit') {
    updateGuild(discordGuild.id, (gg) => (gg.legitVotes = { yes: 0, no: 0 }));
    for (const [custom, fallback] of [
      [legitEmojis.yes, '✅'],
      [legitEmojis.no, '❌'],
    ]) {
      await message.react(custom).catch(async (err) => {
        console.warn(`Czy legit: nie mogę użyć emoji ${custom} (${err.message}) — dodaję ${fallback}. Bot musi być na serwerze, z którego jest to emoji.`);
        await message.react(fallback).catch(() => {});
      });
    }
  }
  return { message, warning };
}

/** Przebudowuje zapisany panel (np. po nowej opinii albo zmianie baneru). */
async function refreshPanel(client, guildId, type) {
  const g = guild(guildId);
  const ref = g.panels[type];
  if (!ref) return;
  const channel = await client.channels.fetch(ref.channelId).catch(() => null);
  const message = await channel?.messages.fetch(ref.messageId).catch(() => null);
  if (!message) return;
  const logo = logoOf(channel.guild, client);
  // Załączniki podajemy od nowa: stary panel mógł nie mieć pliku baneru, a zmiana baneru go podmienia.
  await message
    .edit({ components: [panelBuilders[type](g, logo)], files: bannerAttachments(g, type), attachments: [], flags: V2 })
    .catch((err) => console.error(`Panel ${type}:`, err.message));
}

// ─── Liczniki w nazwach kanałów (np. ⭐┃opinie→9) ───────────────────────
// Liczby są od razu zapisywane w bazie. Discord pozwala zmienić nazwę kanału tylko 2 razy na 10 minut,
// więc nazwy kanałów aktualizujemy co 10 minut (i raz przy starcie bota) — tylko gdy liczba się zmieniła.

/** [id kanału, wzór nazwy, liczba] dla wszystkich liczników serwera. */
function counterTargets(g) {
  return [
    [g.panels.legit?.channelId, counterNames.legit, g.legitVotes?.yes ?? 0],
    [g.settings.lcChannelId, counterNames.legitCheck, g.stats.done],
    [g.settings.reviewChannelId, counterNames.reviews, g.reviews.length],
  ].filter(([id, pattern]) => id && pattern);
}

async function updateCounters(client) {
  for (const [guildId] of Object.entries(store.guilds)) {
    const g = guild(guildId);
    if (g.settings.counters === false || !client.guilds.cache.has(guildId)) continue;
    for (const [channelId, pattern, n] of counterTargets(g)) {
      const name = pattern.replace('{n}', n);
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.name === name) continue;
      // Nie czekamy w nieskończoność na limit Discorda — spróbujemy ponownie za 10 minut.
      await Promise.race([channel.setName(name, 'Licznik'), new Promise((r) => setTimeout(r, 15_000))]).catch((err) =>
        console.warn(`Licznik ${name}:`, err.message),
      );
    }
  }
}

function counterLoop(client) {
  syncLegitVotes(client)
    .catch(console.error)
    .then(() => updateCounters(client))
    .catch(console.error);
  setInterval(() => updateCounters(client).catch(console.error), 10 * 60_000);
}

// ═══ CZY LEGIT ═════════════════════════════════════════════════════════

const emojiId = (e) => /:(\d+)>$/.exec(e)?.[1] ?? null;
/** Czy reakcja to TAK / NIE (własne emoji z legitEmojis albo zapasowe ✅ / ❌). */
const isLegitEmoji = (emoji, kind) => {
  const custom = legitEmojis[kind];
  const fallback = kind === 'yes' ? '✅' : '❌';
  return (emoji.id && emoji.id === emojiId(custom)) || emoji.name === fallback;
};

/** Liczba głosów danego rodzaju bez reakcji samego bota. */
function votesOf(message, kind) {
  let total = 0;
  for (const r of message.reactions.cache.values()) {
    if (isLegitEmoji(r.emoji, kind)) total += Math.max(0, r.count - (r.me ? 1 : 0));
  }
  return total;
}

async function onLegitReaction(reaction, user, added) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);
  const message = reaction.message;
  if (!message.guildId) return;
  const g = guild(message.guildId);
  if (g.panels.legit?.messageId !== message.id) return;
  if (isLegitEmoji(reaction.emoji, 'no') && added) {
    // NIE zawsze znika, a autor (poza staffem) dostaje przerwę.
    await reaction.users.remove(user.id).catch((err) => console.warn('Usuwanie reakcji NIE:', err.message));
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (legitTimeoutDays > 0 && member && !isStaff(member, g.settings) && member.moderatable) {
      const timedOut = await member
        .timeout(legitTimeoutDays * 86_400_000, 'Czy legit: reakcja NIE bez dowodu')
        .then(() => true)
        .catch((err) => (console.warn('Przerwa:', err.message), false));
      if (timedOut) {
        await user
          .send({
            components: [
              notice(
                `### 🔇 ${x} Otrzymałeś/aś przerwę na ${legitTimeoutDays} dni\nReakcja ${legitEmojis.no} na **czy legit** wymaga dowodu. Jeśli go masz — napisz do administracji.`,
                colors.warning,
              ),
            ],
            flags: V2,
          })
          .catch(() => {});
      }
    }
    return;
  }

  // ✅ — zapisujemy liczbę od razu; nazwa kanału aktualizuje się automatycznie co 10 minut.
  if (isLegitEmoji(reaction.emoji, 'yes')) updateGuild(message.guildId, (gg) => (gg.legitVotes = { yes: votesOf(message, 'yes'), no: 0 }));
}

/** Przy starcie: przelicza ✅ na panelu (reakcje dodane, gdy bot był wyłączony). */
async function syncLegitVotes(client) {
  for (const [guildId, g] of Object.entries(store.guilds)) {
    const ref = g.panels?.legit;
    if (!ref || !client.guilds.cache.has(guildId)) continue;
    const channel = await client.channels.fetch(ref.channelId).catch(() => null);
    const message = await channel?.messages.fetch(ref.messageId).catch(() => null);
    if (message) updateGuild(guildId, (gg) => (gg.legitVotes = { yes: votesOf(message, 'yes'), no: 0 }));
  }
}

// ═══ KONKURSY ══════════════════════════════════════════════════════════

/** "1d 2h 30m", "2h", "90m", "45s" → milisekundy. */
function parseDuration(input) {
  const units = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000 };
  let total = 0;
  const re = /(\d+)\s*([dhms])/gi;
  let match;
  while ((match = re.exec(input))) total += Number(match[1]) * units[match[2].toLowerCase()];
  return total;
}

const giveawayEditTimers = new Map();
/** Odświeża wiadomość konkursu z opóźnieniem, żeby wiele kliknięć = jedna edycja. */
function scheduleGiveawayEdit(client, guildId, messageId) {
  if (giveawayEditTimers.has(messageId)) return;
  giveawayEditTimers.set(
    messageId,
    setTimeout(async () => {
      giveawayEditTimers.delete(messageId);
      const gw = guild(guildId).giveaways[messageId];
      const channel = await client.channels.fetch(gw.channelId).catch(() => null);
      const message = await channel?.messages.fetch(messageId).catch(() => null);
      await message?.edit({ components: [giveawayView(gw, channel.guild.memberCount)], flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
    }, 2000),
  );
}

function pickWinners(entrants, count, exclude = []) {
  const pool = entrants.filter((id) => !exclude.includes(id));
  const winners = [];
  while (pool.length && winners.length < count) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return winners;
}

async function endGiveaway(client, guildId, messageId, reroll = false) {
  const g = guild(guildId);
  const gw = g.giveaways[messageId];
  if (!gw) return null;
  const winnerIds = pickWinners(gw.entrants, gw.winners, reroll ? (gw.winnerIds ?? []) : []);
  updateGuild(guildId, () => Object.assign(gw, { ended: true, winnerIds, endsAt: reroll ? gw.endsAt : Date.now() }));
  const channel = await client.channels.fetch(gw.channelId).catch(() => null);
  const message = await channel?.messages.fetch(messageId).catch(() => null);
  await message?.edit({ components: [giveawayView(gw, channel.guild.memberCount)], flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
  if (channel) {
    await channel
      .send({
        content: winnerIds.length
          ? `🎉 ${x} Gratulacje ${winnerIds.map((id) => `<@${id}>`).join(', ')}! Wygrałeś/aś: **${gw.prize}**${reroll ? ' *(ponowne losowanie)*' : ''}`
          : `😢 ${x} Konkurs o **${gw.prize}** zakończył się bez uczestników.`,
        reply: message ? { messageReference: message.id, failIfNotExists: false } : undefined,
        allowedMentions: { users: winnerIds },
      })
      .catch(() => {});
  }
  return winnerIds;
}

function giveawayTicker(client) {
  setInterval(() => {
    for (const [guildId, g] of Object.entries(store.guilds)) {
      for (const [messageId, gw] of Object.entries(g.giveaways ?? {})) {
        if (!gw.ended && gw.endsAt <= Date.now()) endGiveaway(client, guildId, messageId).catch(console.error);
      }
    }
  }, 10_000);
}

async function onGiveawayJoin(i) {
  const g = guild(i.guildId);
  const gw = g.giveaways[i.message.id];
  if (!gw || gw.ended) return replyV2(i, fail('Ten konkurs już się zakończył.'));
  const joined = gw.entrants.includes(i.user.id);
  updateGuild(i.guildId, () => {
    if (joined) gw.entrants = gw.entrants.filter((id) => id !== i.user.id);
    else gw.entrants.push(i.user.id);
  });
  scheduleGiveawayEdit(i.client, i.guildId, i.message.id);
  await replyV2(
    i,
    joined
      ? notice(`### 👋 ${x} Opuściłeś/aś konkurs\nKliknij **Dołącz** ponownie, jeśli zmienisz zdanie.`, colors.neutral)
      : notice(`### 🎉 ${x} Dołączyłeś/aś do konkursu!\nNagroda: **${gw.prize}** • losowanie ${ts(gw.endsAt)}\n-# Kliknij ponownie, aby się wypisać.`, colors.gold),
  );
}

// ═══ BOOSTY ════════════════════════════════════════════════════════════

const boostTypes = [MessageType.GuildBoost, MessageType.GuildBoostTier1, MessageType.GuildBoostTier2, MessageType.GuildBoostTier3];

// Boost wykrywamy na dwa sposoby: systemowa wiadomość Discorda („X wzmocnił serwer”) oraz zmiana statusu
// członka (premiumSince). Drugi sposób działa też bez kanału wiadomości systemowych. Ten sam boost ogłaszamy raz.
const recentBoosts = new Map(); // `${guildId}:${userId}` → czas ogłoszenia
const BOOST_DEDUPE_MS = 2 * 60_000;

async function announceBoost(discordGuild, user) {
  const { settings } = guild(discordGuild.id);
  if (!settings.boostChannelId) {
    console.warn(`Boost od ${user.tag ?? user.id}: brak kanału boostów — ustaw go: /setup boosty:#kanał`);
    return false;
  }
  const key = `${discordGuild.id}:${user.id}`;
  if (Date.now() - (recentBoosts.get(key) ?? 0) < BOOST_DEDUPE_MS) return false;
  recentBoosts.set(key, Date.now());
  const channel = await discordGuild.channels.fetch(settings.boostChannelId).catch(() => null);
  if (!channel) {
    console.warn('Boost: kanał boostów nie istnieje albo bot go nie widzi — ustaw go ponownie: /setup boosty:#kanał');
    return false;
  }
  const fresh = await discordGuild.fetch().catch(() => discordGuild);
  const sent = await channel
    .send({
      components: [boostView(user, fresh.premiumSubscriptionCount ?? 0, fresh.premiumTier ?? 0, guild(discordGuild.id))],
      files: bannerAttachments(guild(discordGuild.id), 'boost'),
      flags: V2,
      allowedMentions: { users: [user.id] },
    })
    .catch((err) => console.error('Boost:', err.message));
  return Boolean(sent);
}

async function onMessage(message) {
  if (!message.guild) return;
  if (await onLegitCheckMessage(message)) return;
  if (!boostTypes.includes(message.type)) return;
  await announceBoost(message.guild, message.author);
}

/** Członek właśnie zaczął boostować (premiumSince: brak → data). Wymaga „Server Members Intent”. */
async function onMemberUpdate(oldMember, newMember) {
  if (oldMember.partial || newMember.user?.bot) return;
  if (oldMember.premiumSinceTimestamp || !newMember.premiumSinceTimestamp) return;
  await announceBoost(newMember.guild, newMember.user);
}

// ═══ GENERATOR SERWERA (/generuj) ══════════════════════════════════════

const F = PermissionFlagsBits;
const botAllow = [F.ViewChannel, F.SendMessages, F.ReadMessageHistory, F.EmbedLinks, F.AttachFiles, F.AddReactions, F.ManageChannels, F.ManageMessages];
const writeFlags = [F.SendMessages, F.SendMessagesInThreads, F.CreatePublicThreads, F.CreatePrivateThreads];

/** Uprawnienia kanału: prywatna kategoria + tryb kanału. */
function layoutOverwrites(discordGuild, roles, botId, { isPrivate, mode }) {
  const everyone = { id: discordGuild.roles.everyone.id, allow: [], deny: [] };
  const team = [roles.admin.id, roles.staff.id].map((id) => ({ id, allow: [F.ViewChannel, F.SendMessages, F.ReadMessageHistory, F.AddReactions] }));
  if (isPrivate) everyone.deny.push(F.ViewChannel);
  if (mode === 'readonly') everyone.deny.push(...writeFlags);
  if (mode === 'reactions') {
    everyone.deny.push(...writeFlags);
    everyone.allow.push(F.AddReactions);
  }
  return [everyone, ...team, { id: botId, allow: botAllow }];
}

function layoutChannelName(ch, g) {
  if (!ch.counter) return serverLayout.channelName(ch.emoji, ch.name);
  const values = { reviews: g.reviews.length, legitCheck: g.stats.done, legit: 0 };
  return counterNames[ch.counter].replace('{n}', values[ch.counter]);
}

function generateConfirmView(userId) {
  const b = box(colors.danger);
  text(
    b,
    [
      title('Generuj serwer', '🏗️'),
      `## ⚠️ ${x} Uwaga — tego nie da się cofnąć!`,
      '>>> ' +
        [
          point('**Usunę wszystkie** obecne kanały i kategorie (razem z wiadomościami).'),
          point(`Utworzę role: ${Object.values(serverLayout.roles).map((r) => `**${r.name}**`).join(', ')}.`),
          point(`Utworzę **${serverLayout.categories.length}** kategorii i **${serverLayout.categories.reduce((a, cat) => a + cat.channels.length, 0)}** kanałów z uprawnieniami.`),
          point('Skonfiguruję bota i wyślę panele: tickety, regulamin, opinie, czy legit, cennik i „jak napisać voucha”.'),
          point('Podsumowanie wyślę Ci w **DM** i na kanał admin-czat.'),
        ].join('\n'),
    ].join('\n'),
  );
  b.addActionRowComponents((r) =>
    r.setComponents(
      new ButtonBuilder().setCustomId(`gen:confirm:${userId}`).setLabel('Tak, usuń wszystko i wygeneruj').setEmoji('🏗️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`gen:cancel:${userId}`).setLabel('Anuluj').setStyle(ButtonStyle.Secondary),
    ),
  );
  return b;
}

function generateReportView(report) {
  const b = box(report.errors.length ? colors.warning : colors.success);
  text(
    b,
    [
      title('Serwer wygenerowany', '🏗️'),
      '>>> ' +
        [
          row('🗑️ Usunięte kanały', `\`${report.deleted}\``),
          row('🎭 Role', report.roles.map((id) => `<@&${id}>`).join(', ')),
          row('📁 Kategorie', `\`${report.categories}\``),
          row('💬 Kanały', `\`${report.channels}\``),
          row('🧩 Panele', report.panels.length ? report.panels.map((id) => `<#${id}>`).join(', ') : '`—`'),
          row('⚙️ Bot', 'skonfigurowany (jak `/setup`)'),
        ].join('\n'),
    ].join('\n'),
  );
  if (report.errors.length) {
    sep(b);
    text(b, `### ⚠️ ${x} Nie wszystko się udało\n${report.errors.slice(0, 15).map((e) => `- ${e}`).join('\n')}`);
  }
  sep(b);
  footer(b);
  return b;
}

/** Usuwa kanały, tworzy role, kategorie i kanały, konfiguruje bota i wysyła panele. */
async function generateServer(client, discordGuild, invokerId) {
  const report = { deleted: 0, roles: [], categories: 0, channels: 0, panels: [], errors: [] };
  const botId = client.user.id;

  // 1. Usuwanie: najpierw kanały, potem kategorie.
  const existing = [...(await discordGuild.channels.fetch()).values()].filter(Boolean);
  const ordered = [...existing.filter((ch) => ch.type !== ChannelType.GuildCategory), ...existing.filter((ch) => ch.type === ChannelType.GuildCategory)];
  for (const ch of ordered) {
    try {
      await ch.delete('/generuj');
      report.deleted++;
    } catch (err) {
      // Np. kanał zasad/aktualizacji na serwerze społeczności (50074) — Discord nie pozwala go usunąć.
      report.errors.push(`Nie usunięto #${ch.name}: ${err.message}`);
    }
  }

  // Stare tickety i konkursy z usuniętych kanałów nie mogą blokować nowych.
  updateGuild(discordGuild.id, (g) => {
    for (const t of Object.values(g.tickets)) {
      if (!t.closedAt) Object.assign(t, { closedAt: Date.now(), result: 'notdone', closeReason: 'Kanał usunięty przez /generuj', awaitingRep: false });
    }
    for (const gw of Object.values(g.giveaways)) gw.ended = true;
    g.panels = {};
  });

  // 2. Role (istniejące o tej samej nazwie są używane ponownie).
  const allRoles = [...(await discordGuild.roles.fetch()).values()];
  const roles = {};
  for (const [key, def] of Object.entries(serverLayout.roles)) {
    roles[key] =
      allRoles.find((r) => r.name === def.name) ??
      (await discordGuild.roles.create({ name: def.name, color: def.color, hoist: def.hoist, permissions: def.permissions, reason: '/generuj' }));
    report.roles.push(roles[key].id);
  }
  await discordGuild.members
    .fetch(invokerId)
    .then((m) => m.roles.add(roles.admin.id, '/generuj'))
    .catch((err) => report.errors.push(`Nie nadano roli Administracja: ${err.message}`));

  // 3. Kategorie i kanały.
  const settings = { staffRoleId: roles.staff.id, rulesRoleId: roles.verified.id, counters: true, ticketCategories: {}, ticketLogs: {} };
  const panels = [];
  let reportChannel = null;
  for (const cat of serverLayout.categories) {
    const category = await discordGuild.channels.create({
      name: serverLayout.categoryName(cat.emoji, cat.name),
      type: ChannelType.GuildCategory,
      permissionOverwrites: layoutOverwrites(discordGuild, roles, botId, { isPrivate: cat.private, mode: 'open' }),
      reason: '/generuj',
    });
    report.categories++;
    if (cat.setting) settings[cat.setting] = category.id;
    if (cat.ticketType) settings.ticketCategories[cat.ticketType] = category.id;
    for (const ch of cat.channels) {
      const channel = await discordGuild.channels.create({
        name: layoutChannelName(ch, guild(discordGuild.id)),
        type: ch.mode === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: layoutOverwrites(discordGuild, roles, botId, { isPrivate: cat.private, mode: ch.mode }),
        reason: '/generuj',
      });
      report.channels++;
      if (ch.setting) settings[ch.setting] = channel.id;
      if (ch.ticketLog) settings.ticketLogs[ch.ticketLog] = channel.id;
      if (ch.panel) panels.push([ch.panel, channel]);
      if (ch.report) reportChannel = channel;
    }
  }

  // 4. Konfiguracja bota (to samo, co /setup). Ogólna kategoria i logi = te od zamówień botów.
  settings.categoryId = settings.ticketCategories.bot;
  settings.logChannelId = settings.ticketLogs.bot;
  updateGuild(discordGuild.id, (g) => Object.assign(g.settings, settings));

  // 5. Panele.
  for (const [type, channel] of panels) {
    try {
      await postPanel(client, discordGuild, channel, type);
      report.panels.push(channel.id);
    } catch (err) {
      report.errors.push(`Panel ${type}: ${err.message}`);
    }
  }

  // 6. Podsumowanie: kanał staffu + DM.
  const view = generateReportView(report);
  await reportChannel?.send({ components: [view], flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
  const invoker = await client.users.fetch(invokerId).catch(() => null);
  await invoker?.send({ components: [generateReportView(report)], flags: V2 }).catch(() => {});
  return report;
}

async function onGenerateButton(i, action, ownerId) {
  if (i.user.id !== ownerId) return replyFail(i, 'Tylko osoba, która wpisała `/generuj`, może to potwierdzić.');
  if (action === 'cancel') return i.update({ components: [notice(`### ❎ ${x} Anulowano — nic nie zostało zmienione.`, colors.neutral)], flags: V2 });
  if (!i.memberPermissions?.has(F.Administrator)) return replyFail(i, 'Potrzebujesz uprawnień administratora.');
  await i.update({
    components: [notice(`### 🏗️ ${x} Generuję serwer…\nTen kanał za chwilę zniknie. Podsumowanie dostaniesz w **DM** i na kanale admin-czat.`, colors.brand)],
    flags: V2,
  });
  try {
    await generateServer(i.client, i.guild, i.user.id);
  } catch (err) {
    // Kanał z komendą już nie istnieje, więc błąd wysyłamy w DM.
    console.error('Generowanie serwera:', err);
    await i.user.send({ components: [fail(`Generowanie przerwane.\n${describeError(err)}`)], flags: V2 }).catch(() => {});
  }
}

// ═══ POWITANIA I ZAPROSZENIA ═══════════════════════════════════════════

const inviteTotal = (st) => (st ? st.regular - st.left + st.bonus : 0);
const emptyInvites = () => ({ regular: 0, left: 0, fake: 0, bonus: 0 });

function welcomeView(member, g) {
  const b = box();
  text(b, title('Nowa osoba', '👋'));
  sep(b);
  header(
    b,
    '>>> ' +
      [
        point(`Hej ${member}! Super, że wpadłeś/aś na **${brand.name}.**`),
        point(`Właśnie stałeś/aś się naszym **${member.guild.memberCount}. członkiem.**`),
        point('Mamy nadzieję, że **zostaniesz u nas** na stałe!'),
      ].join('\n'),
    member.user.displayAvatarURL({ size: 256 }),
  );
  banner(b, bannerUrl(g, 'witamy'));
  sep(b);
  footer(b);
  return b;
}

/** Skąd przyszła nowa osoba: link własny serwera, zaproszenie od kogoś albo nie wiadomo. */
function joinSource(member, g, found) {
  if (found.vanity) return `przez link **.gg/${member.guild.vanityURLCode}**`;
  if (found.inviterId) return `z zaproszenia od <@${found.inviterId}> — ma teraz **${inviteTotal(g.invites[found.inviterId])}** zaproszeń`;
  if (found.code) return `przez link **.gg/${found.code}**`;
  return '*(nie udało się ustalić, przez który link)*';
}

function inviteLogView(member, g, found) {
  const b = box();
  text(b, title('Zaproszenia', '📩'));
  sep(b);
  const lines = [point(`${member} właśnie **zawitał/a** do nas ${joinSource(member, g, found)}`)];
  if (g.joins[member.id]?.fake) lines.push(point(`⚠️ Nowe konto (młodsze niż ${fakeAccountDays} dni) — nie liczy się do zaproszeń.`));
  text(b, '>>> ' + lines.join('\n'));
  banner(b, bannerUrl(g, 'zaproszenia'));
  sep(b);
  footer(b);
  return b;
}

function invitesView(user, st) {
  const stats = st ?? emptyInvites();
  const b = box();
  text(b, title('Zaproszenia', '📩'));
  sep(b);
  header(
    b,
    '>>> ' +
      [
        point(`${user} ma **${inviteTotal(stats)}** zaproszeń`),
        row('✅ Prawdziwe', `\`${stats.regular}\``),
        row('🚪 Wyszło', `\`${stats.left}\``),
        row('⚠️ Fałszywe', `\`${stats.fake}\``),
        row('🎁 Bonus', `\`${stats.bonus}\``),
      ].join('\n'),
    user.displayAvatarURL({ size: 256 }),
  );
  sep(b);
  footer(b);
  return b;
}

function invitesRanking(g) {
  const top = Object.entries(g.invites)
    .map(([id, st]) => [id, inviteTotal(st)])
    .filter(([, n]) => n > 0)
    .sort((a, b2) => b2[1] - a[1])
    .slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  const b = box(colors.gold);
  text(b, title('Ranking zaproszeń', '🏆'));
  sep(b);
  text(
    b,
    top.length
      ? '>>> ' + top.map(([id, n], idx) => `${medals[idx] ?? `\`${idx + 1}.\``} ${x} <@${id}> ${style.arrow} **${n}** zaproszeń`).join('\n')
      : '*Nikt jeszcze nikogo nie zaprosił.*',
  );
  sep(b);
  footer(b);
  return b;
}

// Pamięć użyć linków — po wejściu nowej osoby porównujemy, który link zyskał użycie.
const inviteCache = new Map(); // guildId → Map(code → uses)
const vanityCache = new Map(); // guildId → uses

async function cacheInvites(discordGuild) {
  const invites = await discordGuild.invites.fetch().catch(() => null);
  if (!invites) return null;
  inviteCache.set(discordGuild.id, new Map([...invites.values()].map((inv) => [inv.code, inv.uses ?? 0])));
  if (discordGuild.vanityURLCode) {
    const vanity = await discordGuild.fetchVanityData().catch(() => null);
    if (vanity) vanityCache.set(discordGuild.id, vanity.uses);
  }
  return invites;
}

async function findUsedInvite(discordGuild) {
  const before = inviteCache.get(discordGuild.id) ?? new Map();
  const vanityBefore = vanityCache.get(discordGuild.id);
  const invites = await cacheInvites(discordGuild);
  if (!invites) return { unknown: true };
  const used = [...invites.values()].find((inv) => (inv.uses ?? 0) > (before.get(inv.code) ?? 0));
  if (used) return { inviterId: used.inviter?.id ?? null, code: used.code };
  // Jednorazowy link znika po użyciu — jeśli zniknął dokładnie jeden, to on.
  const gone = [...before.keys()].filter((code) => !invites.has(code));
  if (gone.length === 1) return { code: gone[0] };
  if (vanityBefore != null && (vanityCache.get(discordGuild.id) ?? 0) > vanityBefore) return { vanity: true };
  return { unknown: true };
}

async function sendTo(discordGuild, channelId, payload) {
  if (!channelId) return;
  const channel = await discordGuild.channels.fetch(channelId).catch(() => null);
  await channel?.send(payload).catch((err) => console.error('Powitania/zaproszenia:', err.message));
}

async function onMemberAdd(member) {
  const found = await findUsedInvite(member.guild);
  const fake = Date.now() - member.user.createdTimestamp < fakeAccountDays * 86_400_000;
  const g = updateGuild(member.guild.id, (gg) => {
    gg.joins[member.id] = { inviterId: found.inviterId ?? null, fake, at: Date.now() };
    // Boty i własne linki się nie liczą.
    if (!member.user.bot && found.inviterId && found.inviterId !== member.id) {
      const st = (gg.invites[found.inviterId] ??= emptyInvites());
      if (fake) st.fake++;
      else st.regular++;
    }
  });
  await sendTo(member.guild, g.settings.welcomeChannelId, {
    components: [welcomeView(member, g)],
    files: bannerAttachments(g, 'witamy'),
    flags: V2,
    allowedMentions: { users: [member.id] },
  });
  await sendTo(member.guild, g.settings.invitesChannelId, {
    components: [inviteLogView(member, g, found)],
    files: bannerAttachments(g, 'zaproszenia'),
    flags: V2,
    allowedMentions: { parse: [] },
  });
}

function onMemberRemove(member) {
  updateGuild(member.guild.id, (gg) => {
    const entry = gg.joins[member.id];
    if (entry?.inviterId && !entry.left && !entry.fake && gg.invites[entry.inviterId]) gg.invites[entry.inviterId].left++;
    if (entry) entry.left = true;
  });
}

// ═══ AUTO LC ═══════════════════════════════════════════════════════════

/** Webhook bota na kanale legit checków (tworzony raz i używany ponownie). */
async function lcWebhook(channel, client) {
  const hooks = await channel.fetchWebhooks();
  const own = [...hooks.values()].find((h) => h.owner?.id === client.user.id && h.name === `${brand.name} Auto LC`);
  return own ?? channel.createWebhook({ name: `${brand.name} Auto LC`, reason: '/autolc' });
}

/**
 * Wystawia vouche za klientów, którzy nie napisali repa po „Zrealizowane”:
 * webhook z nazwą konta klienta + [AUTO LC] i jego avatarem, potem zamyka ticket i wysyła log.
 */
async function autoLegitCheck(client, discordGuild, invokerId) {
  const g = guild(discordGuild.id);
  const pending = Object.values(g.tickets).filter((t) => t.awaitingRep && !t.closedAt && t.deal);
  const result = { done: [], failed: [] };
  if (!pending.length) return result;
  const lcChannel = await discordGuild.channels.fetch(g.settings.lcChannelId).catch(() => null);
  if (!lcChannel) throw new Error('Nie znaleziono kanału legit checków. Ustaw go w /setup legitcheck.');
  const hook = await lcWebhook(lcChannel, client);

  for (const t of pending) {
    try {
      const user = await client.users.fetch(t.userId).catch(() => null);
      const username = `${user?.username ?? 'klient'} [AUTO LC]`.slice(0, 80);
      const msg = await hook.send({ content: repTemplate(t), username, avatarURL: user?.displayAvatarURL({ size: 256 }), allowedMentions: { parse: [] } });
      await msg.react?.('✅').catch(() => {});
      updateGuild(discordGuild.id, (gg) => {
        Object.assign(gg.tickets[t.channelId], { awaitingRep: false, autoLc: true, lcUrl: msg.url, lcMessageId: msg.id });
        gg.stats.lc++;
      });
      const channel = await discordGuild.channels.fetch(t.channelId).catch(() => null);
      if (channel) {
        await channel
          .send({ components: [notice(`### ✅ ${x} Auto LC wystawiony\nKlient nie wystawił voucha, więc zrobił to bot: ${msg.url}\n-# Ticket zamyka się…`, colors.success)], flags: V2 })
          .catch(() => {});
        await finalizeTicket(client, discordGuild, channel, { closedBy: invokerId, result: 'done' });
      } else {
        // Kanał ticketu już nie istnieje — zamykamy tylko w bazie.
        updateGuild(discordGuild.id, (gg) => {
          Object.assign(gg.tickets[t.channelId], { closedAt: Date.now(), closedBy: invokerId, result: 'done' });
          gg.stats.closed++;
          gg.stats.done++;
        });
      }
      result.done.push({ ticket: getTicket(discordGuild.id, t.channelId), url: msg.url, username });
    } catch (err) {
      result.failed.push({ ticket: t, error: err.message });
    }
  }
  await movePanelToBottom(client, discordGuild.id, 'vouch', lcChannel);
  return result;
}

// ═══ SPÓJNOŚĆ BAZY (usunięte wiadomości i kanały) ══════════════════════

/** Usunięta wiadomość: panel, opinia albo konkurs znika też z bazy. */
async function onMessageDeleted(message) {
  const guildId = message.guildId;
  if (!guildId || !store.guilds[guildId]) return;
  const g = guild(guildId);
  let changed = false;

  for (const [type, ref] of Object.entries(g.panels)) {
    if (ref?.messageId !== message.id) continue;
    updateGuild(guildId, (gg) => {
      delete gg.panels[type];
      // Usunięty panel „czy legit” = głosy od zera (nowy panel liczy od początku).
      if (type === 'legit') gg.legitVotes = { yes: 0, no: 0 };
    });
    changed = true;
  }

  const review = g.reviews.find((r) => r.messageId === message.id);
  if (review) {
    updateGuild(guildId, (gg) => (gg.reviews = gg.reviews.filter((r) => r !== review)));
    await refreshPanel(message.client, guildId, 'opinie');
    changed = true;
  }

  const gw = g.giveaways[message.id];
  if (gw && !gw.ended) {
    updateGuild(guildId, () => Object.assign(gw, { ended: true, cancelled: true, winnerIds: [] }));
    changed = true;
  }
  return changed;
}

/** Usunięty kanał: otwarty ticket zamykamy w bazie (nie blokuje klienta), zapominamy panele z tego kanału. */
async function onChannelDeleted(channel) {
  const guildId = channel.guildId ?? channel.guild?.id;
  if (!guildId || !store.guilds[guildId]) return;
  const g = guild(guildId);
  const ticket = g.tickets[channel.id];
  if (ticket && !ticket.closedAt) {
    updateGuild(guildId, (gg) => {
      Object.assign(gg.tickets[channel.id], { closedAt: Date.now(), closedBy: null, result: 'notdone', closeReason: 'Kanał ticketu usunięty ręcznie', awaitingRep: false });
      gg.stats.closed++;
    });
    const logId = ticketLogFor(g.settings, ticket.type);
    const log = logId ? await channel.client.channels.fetch(logId).catch(() => null) : null;
    await log
      ?.send({
        components: [notice(`### 🗑️ ${x} Ticket ${pad(ticket.number)} usunięty ręcznie\n${row('Autor', `<@${ticket.userId}>`)}\n-# Kanał usunięto bez zamknięcia — brak transcriptu.`, colors.warning)],
        flags: V2,
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  }
  for (const [type, ref] of Object.entries(g.panels)) {
    if (ref?.channelId === channel.id) updateGuild(guildId, (gg) => delete gg.panels[type]);
  }
  for (const gw of Object.values(g.giveaways)) {
    if (gw.channelId === channel.id && !gw.ended) updateGuild(guildId, () => Object.assign(gw, { ended: true, cancelled: true }));
  }
}

/** Ktoś usunął wszystkie reakcje (lub jedno emoji) z panelu „czy legit” — przeliczamy. */
async function onLegitReactionsCleared(message) {
  if (!message.guildId || !store.guilds[message.guildId]) return;
  const g = guild(message.guildId);
  if (g.panels.legit?.messageId !== message.id) return;
  const fresh = await message.fetch().catch(() => message);
  updateGuild(message.guildId, (gg) => (gg.legitVotes = { yes: votesOf(fresh, 'yes'), no: 0 }));
}

// ═══ KOMENDY SLASH ═════════════════════════════════════════════════════

const replyOk = (i, content, flags = V2_EPHEMERAL) => i.reply({ components: [ok(content)], flags, allowedMentions: { parse: [] } });
const replyFail = (i, content) => replyV2(i, fail(content));
const commands = new Map();
const command = (data, execute) => commands.set(data.name, { data, execute });

command(
  new SlashCommandBuilder()
    .setName('generuj')
    .setDescription('Usuwa wszystkie kanały i tworzy gotowy serwer TanieBoty')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  (i) => {
    if (!i.guild.members.me?.permissions.has(PermissionFlagsBits.Administrator)) {
      return replyFail(i, 'Bot potrzebuje uprawnień **Administratora**, żeby usuwać kanały i tworzyć role. Zaproś go linkiem z konsoli.');
    }
    return i.reply({ components: [generateConfirmView(i.user.id)], flags: V2_EPHEMERAL });
  },
);

command(
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Konfiguracja bota TanieBoty')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption((o) => o.setName('kategoria').setDescription('Kategoria ticketów').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addRoleOption((o) => o.setName('admin').setDescription('Rola adminów obsługujących tickety').setRequired(true))
    .addChannelOption((o) => o.setName('logi').setDescription('Kanał logów i transcriptów').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((o) => o.setName('opinie').setDescription('Kanał, na który trafiają opinie').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('boosty').setDescription('Kanał podziękowań za boosty').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('powitania').setDescription('Kanał powitań nowych osób').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('zaproszenia').setDescription('Kanał z informacją, kto kogo zaprosił').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('legitcheck').setDescription('Kanał legit checków (rep po zrealizowanym zamówieniu)').addChannelTypes(ChannelType.GuildText))
    .addRoleOption((o) => o.setName('rola-regulamin').setDescription('Rola nadawana po akceptacji regulaminu'))
    .addBooleanOption((o) => o.setName('liczniki').setDescription('Liczniki w nazwach kanałów (opinie→9, czy-legit→404)'))
    .addIntegerOption((o) => o.setName('limit').setDescription('Maks. otwartych ticketów na osobę').setMinValue(1).setMaxValue(10)),
  async (i) => {
    const s = updateGuild(i.guildId, (g) => {
      const st = g.settings;
      st.categoryId = i.options.getChannel('kategoria').id;
      st.staffRoleId = i.options.getRole('admin').id;
      st.logChannelId = i.options.getChannel('logi').id;
      st.reviewChannelId = i.options.getChannel('opinie')?.id ?? st.reviewChannelId ?? null;
      st.boostChannelId = i.options.getChannel('boosty')?.id ?? st.boostChannelId ?? null;
      st.lcChannelId = i.options.getChannel('legitcheck')?.id ?? st.lcChannelId ?? null;
      st.welcomeChannelId = i.options.getChannel('powitania')?.id ?? st.welcomeChannelId ?? null;
      st.invitesChannelId = i.options.getChannel('zaproszenia')?.id ?? st.invitesChannelId ?? null;
      st.rulesRoleId = i.options.getRole('rola-regulamin')?.id ?? st.rulesRoleId ?? null;
      st.counters = i.options.getBoolean('liczniki') ?? st.counters ?? true;
      st.maxOpen = i.options.getInteger('limit') ?? st.maxOpen;
    }).settings;
    const ch = (id) => (id ? `<#${id}>` : '`—`');
    await i.reply({
      components: [
        notice(
          [
            title('Konfiguracja', '⚙️'),
            '>>> ' +
              [
                row('📁 Kategoria ticketów', ch(s.categoryId)),
                row('🛡️ Admin', `<@&${s.staffRoleId}>`),
                row('📜 Logi', ch(s.logChannelId)),
                row('⭐ Opinie', ch(s.reviewChannelId)),
                row('🚀 Boosty', ch(s.boostChannelId)),
                row('✅ Legit check', ch(s.lcChannelId)),
                row('👋 Powitania', ch(s.welcomeChannelId)),
                row('📩 Zaproszenia', ch(s.invitesChannelId)),
                row('✅ Rola za regulamin', s.rulesRoleId ? `<@&${s.rulesRoleId}>` : '`—`'),
                row('🔢 Liczniki kanałów', s.counters ? '`włączone`' : '`wyłączone`'),
                row('🎫 Limit ticketów', `\`${s.maxOpen}\``),
              ].join('\n'),
            '',
            '-# 💡 Teraz wyślij panele: `/panel typ:tickety`, `regulamin`, `opinie`, `legit`, `cennik`',
          ].join('\n'),
          colors.success,
        ),
      ],
      flags: V2_EPHEMERAL,
      allowedMentions: { parse: [] },
    });
  },
);

command(
  new SlashCommandBuilder()
    .setName('ustaw-ticket')
    .setDescription('Osobna kategoria i kanał logów dla jednego rodzaju ticketu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('rodzaj')
        .setDescription('Rodzaj ticketu')
        .setRequired(true)
        .addChoices(...Object.entries(ticketTypes).map(([value, t]) => ({ name: `${t.emoji} ${t.label}`, value }))),
    )
    .addChannelOption((o) => o.setName('kategoria').setDescription('Kategoria, w której tworzą się te tickety').addChannelTypes(ChannelType.GuildCategory))
    .addChannelOption((o) => o.setName('logi').setDescription('Kanał logów dla tych ticketów').addChannelTypes(ChannelType.GuildText)),
  async (i) => {
    const type = i.options.getString('rodzaj');
    const category = i.options.getChannel('kategoria');
    const logs = i.options.getChannel('logi');
    if (!category && !logs) return replyFail(i, 'Podaj kategorię, kanał logów albo oba.');
    const { settings } = updateGuild(i.guildId, (g) => {
      if (category) g.settings.ticketCategories[type] = category.id;
      if (logs) g.settings.ticketLogs[type] = logs.id;
    });
    const t = ticketTypes[type];
    const ch = (id) => (id ? `<#${id}>` : '`—`');
    return i.reply({
      components: [
        notice(
          [
            `### ${t.emoji} ${x} ${t.label}`,
            row('Kategoria', ch(ticketCategoryFor(settings, type))),
            row('Logi', ch(ticketLogFor(settings, type))),
          ].join('\n'),
          colors.success,
        ),
      ],
      flags: V2_EPHEMERAL,
      allowedMentions: { parse: [] },
    });
  },
);

command(
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Wyślij panel na kanał')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('typ')
        .setDescription('Który panel')
        .setRequired(true)
        .addChoices(
          { name: '🎫 Tickety', value: 'tickety' },
          { name: '📜 Regulamin', value: 'regulamin' },
          { name: '⭐ Opinie', value: 'opinie' },
          { name: '🤔 Czy legit?', value: 'legit' },
          { name: '💰 Cennik', value: 'cennik' },
          { name: '✅ Jak napisać voucha (kanał legit checków)', value: 'vouch' },
        ),
    )
    .addChannelOption((o) => o.setName('kanal').setDescription('Kanał docelowy (domyślnie bieżący)').addChannelTypes(ChannelType.GuildText))
    .addStringOption((o) => o.setName('baner').setDescription('Własny link do obrazka pod panelem albo „brak” (domyślnie baner TanieBoty)'))
    .addBooleanOption((o) => o.setName('usun-baner').setDescription('Wróć do wbudowanego baneru TanieBoty')),
  async (i) => {
    const type = i.options.getString('typ');
    const customUrl = i.options.getString('baner')?.trim();
    const noBanner = customUrl?.toLowerCase() === 'brak';
    if (i.options.getBoolean('usun-baner')) updateGuild(i.guildId, (g) => delete g.settings.banners[type]);
    if (customUrl && !noBanner && !isUrl(customUrl)) return replyFail(i, 'Baner musi być bezpośrednim linkiem do obrazka (http/https) albo słowem `brak`.');
    const st = guild(i.guildId).settings;
    if (type === 'tickety' && !Object.keys(ticketTypes).some((t) => ticketCategoryFor(st, t))) return replyFail(i, 'Najpierw użyj `/setup` albo `/generuj`.');
    if (customUrl) updateGuild(i.guildId, (g) => (g.settings.banners[type] = noBanner ? false : customUrl));

    const channelId = i.options.getChannel('kanal')?.id ?? i.channelId;
    const channel = await i.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return replyFail(i, 'Bot nie widzi tego kanału.');
    const perms = channel.permissionsFor(i.client.user);
    const needed = { ViewChannel: 'Wyświetlanie kanału', SendMessages: 'Wysyłanie wiadomości', AddReactions: 'Dodawanie reakcji', AttachFiles: 'Załączanie plików (baner)' };
    const missing = Object.entries(needed).filter(([flag]) => !perms?.has(PermissionFlagsBits[flag]));
    if (missing.length) return replyFail(i, `Bot nie ma uprawnień na ${channel}:\n${missing.map(([, n]) => `> • ${n}`).join('\n')}`);

    await i.deferReply({ flags: V2_EPHEMERAL });
    const { warning } = await postPanel(i.client, i.guild, channel, type);
    await i.editReply({ components: [ok(`Panel wysłany na ${channel}${warning}`)], flags: V2 });
  },
);

command(
  new SlashCommandBuilder()
    .setName('konkurs')
    .setDescription('Konkursy (giveaway)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('Rozpocznij konkurs')
        .addStringOption((o) => o.setName('nagroda').setDescription('np. 20% zniżki na zamówienie za min. 50 PLN').setMaxLength(150).setRequired(true))
        .addStringOption((o) => o.setName('czas').setDescription('np. 1d, 12h, 2d 6h, 30m').setRequired(true))
        .addIntegerOption((o) => o.setName('zwyciezcy').setDescription('Liczba zwycięzców (domyślnie 1)').setMinValue(1).setMaxValue(20))
        .addStringOption((o) => o.setName('wymagania').setDescription('np. Bez wymagań! / Zaproś 2 osoby').setMaxLength(200))
        .addStringOption((o) => o.setName('obrazek').setDescription('Link do obrazka konkursu'))
        .addChannelOption((o) => o.setName('kanal').setDescription('Kanał konkursu (domyślnie bieżący)').addChannelTypes(ChannelType.GuildText))
        .addBooleanOption((o) => o.setName('ping').setDescription('Oznaczyć @everyone?')),
    )
    .addSubcommand((s) =>
      s
        .setName('zakoncz')
        .setDescription('Zakończ konkurs teraz')
        .addStringOption((o) => o.setName('id').setDescription('ID wiadomości konkursu').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('reroll')
        .setDescription('Wylosuj ponownie zwycięzców')
        .addStringOption((o) => o.setName('id').setDescription('ID wiadomości konkursu').setRequired(true)),
    ),
  async (i) => {
    const sub = i.options.getSubcommand();
    if (sub !== 'start') {
      const id = i.options.getString('id').trim();
      const gw = guild(i.guildId).giveaways[id];
      if (!gw) return replyFail(i, 'Nie znaleziono konkursu o takim ID (kliknij PPM na wiadomość konkursu → Kopiuj ID).');
      if (gw.cancelled) return replyFail(i, 'Ten konkurs został anulowany (jego wiadomość usunięto).');
      if (sub === 'zakoncz' && gw.ended) return replyFail(i, 'Ten konkurs już się zakończył.');
      if (sub === 'reroll' && !gw.ended) return replyFail(i, 'Najpierw zakończ konkurs.');
      await i.deferReply({ flags: V2_EPHEMERAL });
      const winners = await endGiveaway(i.client, i.guildId, id, sub === 'reroll');
      return i.editReply({ components: [ok(winners.length ? `Zwycięzcy: ${winners.map((w) => `<@${w}>`).join(', ')}` : 'Brak uczestników.')], flags: V2 });
    }

    const duration = parseDuration(i.options.getString('czas'));
    if (duration < 10_000) return replyFail(i, 'Podaj czas, np. `1d`, `12h`, `2d 6h` albo `30m`.');
    const image = i.options.getString('obrazek');
    if (image && !isUrl(image)) return replyFail(i, 'Obrazek musi być linkiem http(s).');
    const channel = i.options.getChannel('kanal') ? await i.guild.channels.fetch(i.options.getChannel('kanal').id) : i.channel;
    const gw = {
      channelId: channel.id,
      prize: i.options.getString('nagroda'),
      winners: i.options.getInteger('zwyciezcy') ?? 1,
      requirements: i.options.getString('wymagania'),
      image,
      builtinBanner: !image && Boolean(builtinBanner('konkurs')),
      hostId: i.user.id,
      endsAt: Date.now() + duration,
      entrants: [],
      ended: false,
    };
    const message = await channel.send({
      components: [giveawayView(gw, i.guild.memberCount)],
      files: gw.builtinBanner ? bannerAttachments(null, 'konkurs') : [],
      flags: V2,
      allowedMentions: { parse: [] },
    });
    updateGuild(i.guildId, (g) => (g.giveaways[message.id] = gw));
    if (i.options.getBoolean('ping')) await channel.send({ content: '@everyone', allowedMentions: { parse: ['everyone'] } }).catch(() => {});
    await replyOk(i, `Konkurs wystartował: ${message.url}\n-# ID: \`${message.id}\``);
  },
);

command(
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Zarządzanie bieżącym ticketem')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj osobę do ticketu')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Kogo dodać').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Usuń osobę z ticketu')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Kogo usunąć').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('nazwa')
        .setDescription('Zmień nazwę kanału ticketu')
        .addStringOption((o) => o.setName('nazwa').setDescription('Nowa nazwa').setMaxLength(90).setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('zamknij')
        .setDescription('Zamknij ticket')
        .addStringOption((o) => o.setName('powod').setDescription('Powód zamknięcia').setMaxLength(300)),
    ),
  async (i) => {
    const ticket = getTicket(i.guildId, i.channelId);
    if (!ticket || ticket.closedAt) return replyFail(i, 'Tej komendy używa się w kanale ticketu.');
    const sub = i.options.getSubcommand();
    if (sub === 'zamknij') return closeTicket(i, { reason: i.options.getString('powod') });
    if (!isStaff(i.member, guild(i.guildId).settings)) return replyFail(i, 'Tylko admin może to zrobić.');
    if (sub === 'nazwa') {
      await i.channel.setName(i.options.getString('nazwa'));
      return replyOk(i, `Zmieniono nazwę na **${i.channel.name}**`, V2);
    }
    const user = i.options.getUser('uzytkownik');
    if (sub === 'dodaj') {
      await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, AttachFiles: true, ReadMessageHistory: true });
      return replyOk(i, `Dodano ${user} do ticketu`, V2);
    }
    if (user.id === ticket.userId) return replyFail(i, 'Nie można usunąć autora ticketu.');
    await i.channel.permissionOverwrites.delete(user.id);
    return replyOk(i, `Usunięto ${user} z ticketu`, V2);
  },
);

command(
  new SlashCommandBuilder()
    .setName('opinie')
    .setDescription('Zarządzanie opiniami')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Usuń opinię (np. spam)')
        .addStringOption((o) => o.setName('id').setDescription('ID wiadomości z opinią (PPM na opinię → Kopiuj ID)').setRequired(true)),
    ),
  async (i) => {
    const id = i.options.getString('id').trim();
    const g = guild(i.guildId);
    const review = g.reviews.find((r) => r.messageId === id);
    if (!review) return replyFail(i, 'Nie znaleziono opinii o takim ID wiadomości.');
    updateGuild(i.guildId, (gg) => (gg.reviews = gg.reviews.filter((r) => r !== review)));
    const channel = await i.client.channels.fetch(g.settings.reviewChannelId).catch(() => null);
    await (await channel?.messages.fetch(review.messageId).catch(() => null))?.delete().catch(() => {});
    await refreshPanel(i.client, i.guildId, 'opinie');
    return replyOk(i, `Usunięto opinię od <@${review.userId}>.`);
  },
);

command(
  new SlashCommandBuilder()
    .setName('zaproszenia')
    .setDescription('Licznik zaproszeń')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('sprawdz')
        .setDescription('Ile osób zaprosił użytkownik')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Kogo sprawdzić (domyślnie Ty)')),
    )
    .addSubcommand((sub) => sub.setName('ranking').setDescription('Top 10 zapraszających'))
    .addSubcommand((sub) =>
      sub
        .setName('bonus')
        .setDescription('Dodaj lub odejmij zaproszenia (admin)')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addIntegerOption((o) => o.setName('ilosc').setDescription('Ile (ujemna liczba odejmuje)').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Wyzeruj zaproszenia użytkownika (admin)')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Komu').setRequired(true)),
    ),
  async (i) => {
    const sub = i.options.getSubcommand();
    if (sub === 'ranking') return i.reply({ components: [invitesRanking(guild(i.guildId))], flags: V2, allowedMentions: { parse: [] } });
    const user = i.options.getUser('uzytkownik') ?? i.user;
    if (sub === 'sprawdz') return i.reply({ components: [invitesView(user, guild(i.guildId).invites[user.id])], flags: V2, allowedMentions: { parse: [] } });
    if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return replyFail(i, 'Potrzebujesz uprawnienia **Zarządzanie serwerem**.');
    updateGuild(i.guildId, (g) => {
      if (sub === 'reset') g.invites[user.id] = emptyInvites();
      else (g.invites[user.id] ??= emptyInvites()).bonus += i.options.getInteger('ilosc');
    });
    return i.reply({ components: [invitesView(user, guild(i.guildId).invites[user.id])], flags: V2_EPHEMERAL, allowedMentions: { parse: [] } });
  },
);

command(
  new SlashCommandBuilder()
    .setName('autolc')
    .setDescription('Wystaw auto LC za klientów, którzy nie napisali repa, i zamknij ich tickety')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async (i) => {
    const g = guild(i.guildId);
    if (!g.settings.lcChannelId) return replyFail(i, 'Najpierw ustaw kanał legit checków: `/setup legitcheck:#kanał`.');
    await i.deferReply({ flags: V2_EPHEMERAL });
    const { done, failed } = await autoLegitCheck(i.client, i.guild, i.user.id);
    if (!done.length && !failed.length) return i.editReply({ components: [notice(`### ✅ ${x} Brak ticketów czekających na repa.`, colors.success)], flags: V2 });
    const lines = [
      `## ✅ ${x} Auto LC: ${done.length}`,
      ...done.map((d) => row(`Ticket ${pad(d.ticket.number)}`, `\`${d.username}\` → ${d.url}`)),
      ...failed.map((f) => row(`❌ Ticket ${pad(f.ticket.number)}`, f.error)),
    ];
    return i.editReply({ components: [notice(lines.join('\n'), failed.length ? colors.warning : colors.success)], flags: V2, allowedMentions: { parse: [] } });
  },
);

command(
  new SlashCommandBuilder()
    .setName('statystyki')
    .setDescription('Statystyki serwera TanieBoty')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  (i) => {
    const g = guild(i.guildId);
    const s = reviewSummary(g.reviews);
    const open = Object.values(g.tickets).filter((t) => !t.closedAt).length;
    const gws = Object.values(g.giveaways);
    const b = box(colors.gold);
    header(
      b,
      [
        title('Statystyki', '📈'),
        '>>> ' +
          [
            row('🎫 Otwarte tickety', `\`${open}\``),
            row('📂 Wszystkie tickety', `\`${g.stats.opened}\``),
            row('🔒 Zamknięte', `\`${g.stats.closed}\``),
            row('✅ Zrealizowane', `\`${g.stats.done}\``),
            row('📝 Legit checki', `\`${g.stats.lc}\``),
            row('⭐ Opinie', `\`${s.count}\`${s.count ? ` · średnia \`${s.avg.toFixed(2)}/5\`` : ''}`),
            row('🎉 Konkursy', `\`${gws.length}\` · aktywne \`${gws.filter((gw) => !gw.ended).length}\``),
          ].join('\n'),
      ].join('\n'),
      logoOf(i.guild, i.client),
    );
    return i.reply({ components: [b], flags: V2_EPHEMERAL, allowedMentions: { parse: [] } });
  },
);

command(
  new SlashCommandBuilder()
    .setName('test-boost')
    .setDescription('Wyślij próbne podziękowanie za boosta (na Ciebie) na kanał boostów')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async (i) => {
    const { settings } = guild(i.guildId);
    if (!settings.boostChannelId) return replyFail(i, 'Najpierw ustaw kanał boostów: `/setup … boosty:#kanał` (albo użyj `/generuj`).');
    await i.deferReply({ flags: V2_EPHEMERAL });
    recentBoosts.delete(`${i.guildId}:${i.user.id}`);
    const sent = await announceBoost(i.guild, i.user);
    return i.editReply({
      components: [sent ? ok(`Wysłano próbne podziękowanie na <#${settings.boostChannelId}>.`) : fail('Nie udało się wysłać — sprawdź, czy bot widzi kanał boostów i może na nim pisać oraz wysyłać pliki.')],
      flags: V2,
    });
  },
);

const serverOption = (o) => o.setName('serwer').setDescription('ID serwera w panelu (z /hosting lista)').setMinValue(1).setRequired(true);
const langChoices = (withOther) =>
  Object.entries(hostingLanguages)
    .filter(([, l]) => withOther || !l.manualOnly)
    .map(([value, l]) => ({ name: `${l.emoji} ${l.label}`, value }));

command(
  new SlashCommandBuilder()
    .setName('hosting')
    .setDescription('Hosting klientów (panel Pterodactyl)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('lista')
        .setDescription('Serwery klientów i ich terminy')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Tylko serwery tej osoby')),
    )
    .addSubcommand((s) => s.setName('zamowienia').setDescription('Zamówienia krypto czekające na płatność lub z błędem'))
    .addSubcommand((s) =>
      s
        .setName('utworz')
        .setDescription('Utwórz serwer klientowi (bez płatności przez bota)')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Klient').setRequired(true))
        .addStringOption((o) => o.setName('jezyk').setDescription('Język bota').setRequired(true).addChoices(...langChoices(false)))
        .addStringOption((o) =>
          o
            .setName('okres')
            .setDescription('Okres hostingu')
            .setRequired(true)
            .addChoices(...hostingPlans.map(([name, price, value, days]) => ({ name: `${name} — ${price} (${days} dni)`, value }))),
        )
        .addStringOption((o) => o.setName('email').setDescription('E-mail klienta (login do panelu; pomijany, jeśli klient ma już konto)').setRequired(true))
        .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa serwera (domyślnie: język • nazwa klienta)').setMaxLength(40)),
    )
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Przypisz istniejący serwer z panelu do klienta (terminy, przypomnienia, blokada)')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Klient').setRequired(true))
        .addIntegerOption(serverOption)
        .addIntegerOption((o) => o.setName('dni').setDescription('Ile dni hostingu zostało').setMinValue(0).setMaxValue(3650).setRequired(true))
        .addStringOption((o) => o.setName('jezyk').setDescription('Język bota (domyślnie Node.js)').addChoices(...langChoices(true))),
    )
    .addSubcommand((s) =>
      s
        .setName('przedluz')
        .setDescription('Przedłuż hosting (odblokowuje serwer)')
        .addIntegerOption(serverOption)
        .addIntegerOption((o) => o.setName('dni').setDescription('Ile dni dodać').setMinValue(1).setMaxValue(3650).setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('limity')
        .setDescription('Zmień zasoby serwera (np. większy RAM ustalony w tickecie)')
        .addIntegerOption(serverOption)
        .addIntegerOption((o) => o.setName('ram').setDescription('RAM w MB, np. 512').setMinValue(64).setMaxValue(32768))
        .addIntegerOption((o) => o.setName('dysk').setDescription('Dysk w MB, np. 2048').setMinValue(256).setMaxValue(512000))
        .addIntegerOption((o) => o.setName('cpu').setDescription('CPU w % (100 = 1 rdzeń)').setMinValue(5).setMaxValue(800)),
    )
    .addSubcommand((s) => s.setName('zablokuj').setDescription('Zablokuj serwer (Suspend)').addIntegerOption(serverOption))
    .addSubcommand((s) => s.setName('odblokuj').setDescription('Odblokuj serwer (bez zmiany terminu)').addIntegerOption(serverOption))
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('USUŃ serwer z panelu razem z plikami (nieodwracalne)')
        .addIntegerOption(serverOption)
        .addBooleanOption((o) => o.setName('potwierdz').setDescription('True = tak, usuń serwer i wszystkie pliki').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('logi')
        .setDescription('Kanał logów zakupów automatycznych (jedna wiadomość na zamówienie)')
        .addChannelOption((o) => o.setName('kanal').setDescription('Kanał logów zakupów').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    )
    .addSubcommand((s) => s.setName('test').setDescription('Sprawdź połączenie z panelem, jajka, portfele i API blockchainów')),
  async (i) => {
    const sub = i.options.getSubcommand();
    const g = guild(i.guildId);
    const servers = g.hosting.servers;

    if (sub === 'lista') {
      const user = i.options.getUser('uzytkownik');
      const recs = Object.values(servers).filter((r) => !r.deleted && (!user || r.userId === user.id));
      return i.reply({ components: [hostingListView(recs, user ? `Hosting: ${user.username}` : 'Serwery klientów')], flags: V2_EPHEMERAL, allowedMentions: { parse: [] } });
    }
    if (sub === 'zamowienia') {
      const list = Object.values(g.hosting.orders).filter((o) => ['waiting', 'seen', 'paid', 'creating', 'error', 'failed'].includes(o.status));
      const lines = list
        .slice(-25)
        .map((o) => row(`\`${o.id}\` <@${o.userId}>`, `${o.amount} ${cryptoCoins[o.coin].label} • **${o.status}**${o.lastError ? ` • \`${o.lastError.slice(0, 80)}\`` : ''}`));
      return i.reply({
        components: [notice([`## 🧾 ${x} Zamówienia krypto (${list.length})`, lines.join('\n') || '*Brak aktywnych zamówień.*'].join('\n'))],
        flags: V2_EPHEMERAL,
        allowedMentions: { parse: [] },
      });
    }
    if (sub === 'logi') {
      const channel = i.options.getChannel('kanal');
      updateGuild(i.guildId, (gg) => (gg.settings.purchaseLogChannelId = channel.id));
      return replyOk(i, `Logi zakupów automatycznych będą na ${channel}.\n-# Każde zamówienie to jedna wiadomość aktualizowana na żywo: wpłata, potwierdzenia, serwer, wygaśnięcie.`);
    }
    if (sub === 'test') {
      await i.deferReply({ flags: V2_EPHEMERAL });
      const results = await hostingDiagnostics();
      return i.editReply({ components: [notice([`## 🩺 ${x} Test hostingu`, ...results].join('\n'), results.some((r) => r.startsWith('❌')) ? colors.warning : colors.success)], flags: V2 });
    }

    if (!hostingReady()) return replyFail(i, 'Brak konfiguracji panelu: uzupełnij `hosting.panelUrl` i `hosting.apiKey` w config.json i zrestartuj bota.');
    await i.deferReply({ flags: V2_EPHEMERAL });
    const done = (content) => i.editReply({ components: [ok(content)], flags: V2, allowedMentions: { parse: [] } });
    const failed = (content) => i.editReply({ components: [fail(content)], flags: V2, allowedMentions: { parse: [] } });
    const serverId = i.options.getInteger('serwer');
    const rec = serverId ? servers[serverId] : null;

    try {
      if (sub === 'utworz') {
        const user = i.options.getUser('uzytkownik');
        const res = await activateHosting(i.client, i.guildId, {
          key: `m-${Date.now().toString(36)}`,
          userId: user.id,
          lang: i.options.getString('jezyk'),
          plan: i.options.getString('okres'),
          email: i.options.getString('email').trim(),
          name: i.options.getString('nazwa'),
          payment: 'reczne',
          source: `/hosting utworz przez <@${i.user.id}>`,
        });
        return done(`Utworzono serwer **${res.rec.name}** (ID \`${res.rec.id}\`) dla ${user}, ważny do ${ts(res.rec.expiresAt, 'f')}.${res.dmOk ? '' : '\n⚠️ Klient ma zablokowane DM — przekaż mu dane logowania ręcznie.'}`);
      }
      if (sub === 'dodaj') {
        const user = i.options.getUser('uzytkownik');
        const a = (await ptero('GET', `/servers/${serverId}`)).attributes;
        const days = i.options.getInteger('dni');
        const added = {
          id: a.id,
          identifier: a.identifier,
          name: a.name,
          userId: user.id,
          pteroUserId: a.user,
          lang: i.options.getString('jezyk') ?? 'nodejs',
          plan: null,
          payment: null,
          createdAt: Date.now(),
          expiresAt: Date.now() + days * DAY,
          suspended: Boolean(a.suspended),
          suspendedAt: a.suspended ? Date.now() : null,
          reminded: [],
        };
        updateGuild(i.guildId, (gg) => (gg.hosting.servers[a.id] = added));
        return done(`Serwer **${a.name}** (ID \`${a.id}\`) przypisany do ${user}, ważny do ${ts(added.expiresAt, 'f')}.${added.suspended ? '\n⚠️ Serwer jest zablokowany — odblokuj go `/hosting odblokuj` albo przedłuż.' : ''}`);
      }
      if (!rec || rec.deleted) return failed(`Nie znam serwera o ID \`${serverId}\`. Sprawdź \`/hosting lista\` albo dodaj go: \`/hosting dodaj\`.`);
      if (sub === 'przedluz') {
        const extended = await extendHosting(i.guildId, serverId, i.options.getInteger('dni'));
        await sendHostingDm(i.client, extended.userId, hostingRenewedView(extended, i.guildId));
        await hostingLog(i.client, i.guildId, [`### 🔁 ${x} Hosting przedłużony (+${i.options.getInteger('dni')} dni)`, recLine(extended), row('Przez', `<@${i.user.id}>`)].join('\n'), colors.success);
        return done(`Serwer **${extended.name}** ważny do ${ts(extended.expiresAt, 'f')}.${extended.started === false ? '\n-# Serwer odblokowany — klient musi kliknąć Start (brak `clientApiKey`).' : ''}`);
      }
      if (sub === 'limity') {
        const ram = i.options.getInteger('ram');
        const disk = i.options.getInteger('dysk');
        const cpu = i.options.getInteger('cpu');
        if (!ram && !disk && !cpu) return failed('Podaj co najmniej jedną wartość: ram, dysk albo cpu.');
        const a = (await ptero('GET', `/servers/${serverId}`)).attributes;
        const limits = { ...a.limits, memory: ram ?? a.limits.memory, disk: disk ?? a.limits.disk, cpu: cpu ?? a.limits.cpu };
        await ptero('PATCH', `/servers/${serverId}/build`, {
          allocation: a.allocation,
          memory: limits.memory,
          swap: limits.swap,
          disk: limits.disk,
          io: limits.io,
          cpu: limits.cpu,
          threads: limits.threads,
          feature_limits: a.feature_limits,
        });
        return done(`Nowe limity **${rec.name}**: RAM \`${limits.memory} MB\`, dysk \`${limits.disk} MB\`, CPU \`${limits.cpu}%\`.\n-# Zmiany działają po restarcie serwera.`);
      }
      if (sub === 'zablokuj') {
        if (rec.suspended) return failed('Ten serwer jest już zablokowany.');
        await suspendHosting(i.guildId, rec);
        return done(`Zablokowano **${rec.name}**.`);
      }
      if (sub === 'odblokuj') {
        if (!rec.suspended) return failed('Ten serwer nie jest zablokowany.');
        await ptero('POST', `/servers/${rec.id}/unsuspend`);
        updateGuild(i.guildId, () => Object.assign(rec, { suspended: false, suspendedAt: null, deleteNotified: false }));
        return done(`Odblokowano **${rec.name}**. Termin bez zmian: ${ts(rec.expiresAt, 'f')}${rec.expiresAt < Date.now() ? ' — **już minął**, bot zablokuje go ponownie w ciągu 5 minut. Użyj `/hosting przedluz`.' : '.'}`);
      }
      if (sub === 'usun') {
        if (!i.options.getBoolean('potwierdz')) return failed('Usunięcie wymaga `potwierdz:True`.');
        await ptero('DELETE', `/servers/${rec.id}`).catch((err) => {
          if (!notFound(err)) throw err;
        });
        updateGuild(i.guildId, () => Object.assign(rec, { deleted: true, deletedAt: Date.now() }));
        await hostingLog(i.client, i.guildId, `### 🗑️ ${x} Serwer usunięty\n${recLine(rec)}\n${row('Przez', `<@${i.user.id}>`)}`, colors.danger);
        return done(`Usunięto serwer **${rec.name}** (ID \`${rec.id}\`) z panelu.`);
      }
    } catch (err) {
      if (!err.userFacing) console.error(`/hosting ${sub}:`, err);
      return failed(err.userFacing ? err.message : describeError(err));
    }
  },
);

command(
  new SlashCommandBuilder().setName('moj-hosting').setDescription('Twój hosting: termin ważności i przedłużenie').setDMPermission(false),
  (i) => {
    const g = guild(i.guildId);
    const recs = Object.values(g.hosting.servers).filter((r) => r.userId === i.user.id && !r.deleted);
    const orders = Object.values(g.hosting.orders).filter((o) => o.userId === i.user.id && activeOrder(o));
    return i.reply({ components: [myHostingView(recs, orders, i.guildId)], flags: V2_EPHEMERAL, allowedMentions: { parse: [] } });
  },
);

// ═══ ROUTING INTERAKCJI ════════════════════════════════════════════════

const inviteUrl = (clientId) => `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

async function route(i) {
  if (i.inGuild() && !i.inCachedGuild() && i.isRepliable()) {
    return replyV2(
      i,
      notice(`### ⚠️ Bot nie jest członkiem tego serwera\nZaproś go ponownie (zakresy \`bot\` + \`applications.commands\`):\n${inviteUrl(i.client.user.id)}`, colors.warning),
    );
  }
  if (i.isChatInputCommand()) return commands.get(i.commandName)?.execute(i);

  const [scope, action, arg] = i.customId?.split(':') ?? [];

  // Opinie działają też w DM (przycisk po zamknięciu ticketu), więc guildId bierzemy z customId.
  if (scope === 'rev') {
    const guildId = arg ?? i.guildId;
    if (action === 'open' && i.isButton()) return onReviewOpen(i, guildId);
    if (action === 'submit' && i.isModalSubmit()) return onReviewSubmit(i, guildId);
  }
  if (scope === 'hs') return routeHosting(i);
  if (!i.inGuild()) return;

  if (scope === 'tk') {
    if (i.isStringSelectMenu() && action === 'open') {
      await onTicketSelect(i, i.values[0]);
      // Odświeżamy panel, żeby menu wróciło do „Nie wybrałeś/aś żadnej kategorii”.
      return i.message.edit({ components: [ticketsPanel(guild(i.guildId), logoOf(i.guild, i.client))], flags: V2 }).catch(() => {});
    }
    if (i.isModalSubmit() && action === 'form') return onTicketForm(i, arg);
    if (i.isModalSubmit() && action === 'donesubmit') return onDoneSubmit(i);
    if (i.isModalSubmit() && action === 'closesubmit') return closeTicket(i, { reason: i.fields.getTextInputValue('reason'), result: 'closed' });
    if (i.isModalSubmit() && action === 'notdonesubmit') return closeTicket(i, { reason: i.fields.getTextInputValue('reason') || null });
    if (i.isButton()) {
      if (action === 'quick') return onTicketSelect(i, arg);
      if (action === 'close') return onCloseRequest(i);
      if (action === 'userclose') return closeTicket(i, { reason: 'Zamknięte przez klienta' });
      if (action === 'done' || action === 'notdone') {
        const { error } = staffTicket(i);
        if (error) return replyV2(i, fail(error));
        return i.showModal(action === 'done' ? doneModal() : notDoneModal());
      }
      if (action === 'copyrep') {
        const ticket = getTicket(i.guildId, i.channelId);
        if (!ticket?.deal) return replyV2(i, fail('Brak danych zamówienia.'));
        // Zwykła wiadomość (bez Components V2), żeby na telefonie łatwo ją skopiować przytrzymaniem.
        return i.reply({ content: repTemplate(ticket), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      }
      if (action === 'closenorep') {
        const { error } = staffTicket(i);
        if (error) return replyV2(i, fail(error));
        return closeTicket(i, { reason: 'Zrealizowane — zamknięte bez legit checka', result: 'done' });
      }
    }
  }

  if (scope === 'rules') {
    if (i.isStringSelectMenu() && action === 'show') {
      const [first, ...rest] = rulesMessages(Number(i.values[0]));
      await replyV2(i, first);
      for (const more of rest) await i.followUp({ components: [more], flags: V2_EPHEMERAL, allowedMentions: { parse: [] } });
      return i.message.edit({ components: [rulesPanel(guild(i.guildId), logoOf(i.guild, i.client))], flags: V2 }).catch(() => {});
    }
    if (i.isButton() && action === 'accept') {
      const roleId = guild(i.guildId).settings.rulesRoleId;
      if (!roleId) return replyFail(i, 'Rola za regulamin nie jest ustawiona.');
      if (i.member.roles.cache.has(roleId)) return replyV2(i, notice(`### ✅ ${x} Regulamin już zaakceptowany`, colors.success));
      await i.member.roles.add(roleId, 'Akceptacja regulaminu');
      return replyV2(i, notice(`### ✅ ${x} Dziękujemy!\nZaakceptowałeś/aś regulamin i otrzymałeś/aś rolę <@&${roleId}>.`, colors.success));
    }
  }

  if (scope === 'gen' && i.isButton()) return onGenerateButton(i, action, arg);

  if (scope === 'gw' && i.isButton()) {
    if (action === 'join') return onGiveawayJoin(i);
    if (action === 'list') {
      const gw = guild(i.guildId).giveaways[i.message.id];
      return gw ? replyV2(i, entrantsView(gw)) : replyFail(i, 'Nie znaleziono konkursu.');
    }
  }
}

const knownErrors = {
  50001: 'Bot nie ma dostępu do tego kanału lub serwera.',
  50013: 'Bot nie ma wymaganych uprawnień. Najprościej nadaj mu rolę z Administratorem i przesuń ją wyżej.',
  50035: 'Discord odrzucił wiadomość (np. zły link do obrazka).',
  10003: 'Kanał nie istnieje. Sprawdź `/setup`.',
};
function describeError(err) {
  const hint = knownErrors[err?.code] ?? 'Coś poszło nie tak. Spróbuj ponownie.';
  return `${hint}\n-# Szczegóły: \`${err?.code ?? 'brak kodu'}\` ${String(err?.message ?? err).slice(0, 300).replace(/`/g, "'")}`;
}

async function onInteraction(i) {
  try {
    await route(i);
  } catch (err) {
    console.error(err);
    if (!i.isRepliable()) return;
    const payload = { components: [fail(describeError(err))], flags: V2_EPHEMERAL };
    if (i.deferred || i.replied) await i.followUp(payload).catch(() => {});
    else await i.reply(payload).catch(() => {});
  }
}

// ═══ SPRAWDZENIE OFFLINE (node index.js --check) ═══════════════════════

function selfTest() {
  const img = 'https://cdn.discordapp.com/embed/avatars/0.png';
  const user = { id: '2', displayAvatarURL: () => img, toString: () => '<@2>' };
  const g = guild('selftest');
  Object.assign(g.settings, { rulesRoleId: '1', banners: { tickety: img, regulamin: img, opinie: img, cennik: img } });
  const review = { number: 3, userId: '2', product: 'bot', content: 'Świetny bot ```test```', ratings: { quality: 5, time: 4, service: 5 }, at: Date.now() };
  g.reviews.push(review);
  const base = { channelId: '1', number: 7, userId: '2', openedAt: Date.now(), };
  const tickets = [
    { ...base, type: 'bot', form: { desc: 'Bot z ticketami', budget: '50', deadline: null } },
    { ...base, type: 'hosting', form: { lang: 'python', period: '3m', mode: 'manual', payment: 'blik', email: 'a@b.pl' } },
    { ...base, type: 'hosting', guildId: 'selftest', form: { lang: 'nodejs', period: '1m', mode: 'manual', payment: 'ltc', renew: '5' } },
    { ...base, type: 'hosting', form: { bot: 'discord.js', period: '3m', notes: 'stary ticket' } },
    { ...base, type: 'question', form: { question: 'Ile kosztuje?' } },
    { ...base, type: 'partner', form: { server: null, offer: 'Reklama' } },
  ];
  const closed = { ...tickets[0], closedAt: Date.now(), closedBy: '3', closeReason: 'Gotowe' };
  const dealTicket = { ...tickets[0], deal: { product: 'Bot do exchange', price: '50 PLN', payment: 'ltc', sellerId: '3' } };
  const gw = { channelId: '1', prize: '20% zniżki', winners: 1, requirements: null, image: img, hostId: '2', endsAt: Date.now() + 1e6, entrants: ['1', '2'], ended: false };

  const built = [
    ...[...commands.values()].map((cmd) => cmd.data),
    ...Object.values(panelBuilders).flatMap((fn) => [fn(g, img), fn(guild('empty'), null)]),
    ...rules.flatMap((_, idx) => rulesMessages(idx)),
    reviewCard(review, user),
    reviewModal('9'),
    ...Object.keys(ticketTypes).map(ticketModal),
    ...tickets.map((t) => ticketMessage(t, user)),
    closedView(closed, 'Serwer', false),
    closedView(closed, 'Dzięki', true, '9'),
    giveawayView(gw, 300),
    giveawayView({ ...gw, ended: true, winnerIds: ['2'] }, 300),
    giveawayView({ ...gw, ended: true, winnerIds: [], entrants: [] }, 0),
    entrantsView(gw),
    doneModal(),
    notDoneModal(),
    repRequestView(dealTicket, '5'),
    repRequestView(dealTicket, null),
    vouchPanel(g, img),
    closedView({ ...dealTicket, closedAt: Date.now(), closedBy: null, result: 'done', lcUrl: 'https://discord.com/channels/1/2/3' }, 'Serwer', true, '9'),
    boostView(user, 23, 2),
    ...hostingViewsForTest(),
  ];
  for (const item of built) item.toJSON();
  if (parseDuration('1d 2h 30m') !== 95_400_000) throw new Error('parseDuration');
  // Banery wbudowane: plik z grafiki/, własny link ma pierwszeństwo, „brak” wyłącza.
  const bg = guild('banner-test');
  for (const key of Object.keys(bannerFiles)) {
    if (!builtinBanner(key)) throw new Error(`Brak pliku grafiki/${bannerFiles[key]}`);
    if (bannerUrl(bg, key) !== `attachment://${bannerFiles[key]}` || bannerAttachments(bg, key).length !== 1) throw new Error(`Baner wbudowany: ${key}`);
  }
  bg.settings.banners.tickety = img;
  bg.settings.banners.cennik = false;
  if (bannerUrl(bg, 'tickety') !== img || bannerAttachments(bg, 'tickety').length) throw new Error('Własny link banera');
  if (bannerUrl(bg, 'cennik') !== null || bannerAttachments(bg, 'cennik').length) throw new Error('Baner: brak');
  const panelJson = JSON.stringify(ticketsPanel(guild('banner-empty'), null).toJSON());
  if (!panelJson.includes('attachment://baner-tickety.png')) throw new Error('Panel ticketów z wbudowanym banerem');
  const welcomeMember = { id: '5', guild: { memberCount: 10 }, user: { displayAvatarURL: () => img }, toString: () => '<@5>' };
  if (!JSON.stringify(welcomeView(welcomeMember, bg).toJSON()).includes('attachment://baner-witamy.png')) throw new Error('Powitanie z banerem');
  if (!JSON.stringify(inviteLogView(welcomeMember, bg, {}).toJSON()).includes('attachment://baner-zaproszenia.png')) throw new Error('Zaproszenia z banerem');
  if (!JSON.stringify(boostView({ id: '5', displayAvatarURL: () => img, toString: () => '<@5>' }, 3, 1, bg).toJSON()).includes('attachment://baner-boosty.png')) throw new Error('Boost z banerem');
  if (!JSON.stringify(giveawayView({ ...gw, image: null, builtinBanner: true }, 10).toJSON()).includes('attachment://baner-konkursy.png')) throw new Error('Konkurs z banerem');
  delete store.guilds['banner-test'];
  delete store.guilds['banner-empty'];
  console.log(`✅ ${built.length} komponentów/komend przeszło walidację`);
}


// ─── Test przepływu (symulacja Discorda, bez sieci) ────────────────────

async function flowTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test nie przeszedł: ${msg}`);
  };
  const log = [];
  const img = 'https://cdn.discordapp.com/embed/avatars/0.png';
  const GID = 'flow-guild';
  const STAFF = 'staff1';
  const CLIENT = 'client1';
  const TICKET_CH = 'ticket-ch';
  const LC_CH = 'lc-ch';
  const LOG_CH = 'log-ch';
  const LEGIT_CH = 'legit-ch';

  const mkUser = (id) => ({ id, bot: false, tag: id, displayAvatarURL: () => img, toString: () => `<@${id}>`, send: async (p) => log.push(['dm', id, p]) });
  const users = { [STAFF]: mkUser(STAFF), [CLIENT]: mkUser(CLIENT) };
  const mkChannel = (id, name) => ({
    id,
    name,
    messages: { fetch: async () => ({ edit: async (p) => log.push(['edit', id, p]) }) },
    send: async (p) => (log.push(['send', id, p]), { id: `m-${log.length}`, url: `https://discord.com/channels/${GID}/${id}/m`, delete: async () => {} }),
    setName: async (n) => (log.push(['rename', id, n]), (channels[id].name = n)),
    delete: async () => log.push(['delete', id]),
  });
  const channels = {
    [TICKET_CH]: mkChannel(TICKET_CH, 'bot-0001'),
    [LC_CH]: mkChannel(LC_CH, 'legit-check'),
    [LOG_CH]: mkChannel(LOG_CH, 'logi'),
    [LEGIT_CH]: mkChannel(LEGIT_CH, 'czy-legit'),
  };
  const member = (id, staff) => ({
    id,
    permissions: { has: () => false },
    roles: { cache: { has: (r) => staff && r === 'staff-role' } },
    moderatable: true,
    timeout: async (ms) => log.push(['timeout', id, ms]),
  });
  const fakeGuild = {
    id: GID,
    name: 'TanieBoty',
    channels: { fetch: async (id) => channels[id] ?? null },
    members: { fetch: async (id) => member(id, id === STAFF) },
  };
  const fakeClient = {
    users: { fetch: async (id) => users[id] },
    channels: { fetch: async (id) => channels[id] ?? null },
    guilds: { cache: { has: (id) => id === GID } },
  };
  const interaction = (userId, extra = {}) => ({
    guildId: GID,
    channelId: TICKET_CH,
    channel: channels[TICKET_CH],
    guild: fakeGuild,
    client: fakeClient,
    user: users[userId],
    member: member(userId, userId === STAFF),
    replies: [],
    reply(p) {
      this.replies.push(p);
      log.push(['reply', userId, p]);
      return Promise.resolve();
    },
    showModal(m) {
      this.modal = m;
      return Promise.resolve();
    },
    ...extra,
  });
  makeTranscript = async () => ({ name: 'transcript.html' });

  // Przygotowanie: serwer, ticket przejęty przez staff.
  const g = guild(GID);
  Object.assign(g.settings, { staffRoleId: 'staff-role', logChannelId: LOG_CH, lcChannelId: null });
  g.tickets[TICKET_CH] = { channelId: TICKET_CH, number: 1, type: 'bot', userId: CLIENT, openedAt: Date.now(), form: { desc: 'x', budget: '50' }, messageId: 'card' };
  const doneFields = {
    getTextInputValue: (id) => ({ product: 'Bot do exchange', price: '50 PLN' })[id],
    getStringSelectValues: () => ['ltc'],
  };

  // 1. Karta ticketu nie ma menu statusu.
  assert(ticketChannelName({ username: 'wojtek3509', globalName: 'Wojtek Kowalski', id: '1' }) === 'wojtek3509', 'nazwa kanału = nazwa konta, nie nick');
  assert(ticketChannelName({ username: 'jan.nowak_99', id: '1' }) === 'jannowak_99', 'kropka usunięta, reszta zostaje');
  const cardJson = JSON.stringify(ticketMessage(g.tickets[TICKET_CH], users[CLIENT]).toJSON());
  assert(!cardJson.includes('tk:status'), 'ticket nie może mieć menu statusu');
  assert(!cardJson.includes('tk:claim'), 'ticket nie może mieć przycisku Przejmij');
  assert(cardJson.includes('"type":11'), 'ticket pokazuje avatar klienta');
  const texts = (j) => (j.components ?? []).flatMap((cmp) => (cmp.content ? [cmp.content] : texts(cmp)));
  const rulesMsgs = rules.map((_, idx) => rulesMessages(idx).map((m) => m.toJSON()));
  assert(!JSON.stringify(rulesMsgs).includes('§') && !JSON.stringify(rulesPanel(g, null).toJSON()).includes('§'), 'regulamin bez §');
  for (const msgs of rulesMsgs) for (const m of msgs) assert(texts(m).join('').length <= 4000, 'każda wiadomość regulaminu w limicie 4000 znaków');
  const ch1 = texts(rulesMsgs[0][0]).join('\n');
  assert(ch1.includes('`1.1`') && ch1.includes('`1.15`') && ch1.includes('ROZDZIAŁ 1. POSTANOWIENIA OGÓLNE'), 'rozdział 1: punkty 1.1–1.15');
  const ch3 = rulesMsgs[2].map((m) => texts(m).join('\n')).join('\n');
  assert(ch3.includes('`3.1` Składanie zamówień') && ch3.includes('`3.2.6`') && ch3.includes('`3.4.4`'), 'rozdział 3: podrozdziały 3.1–3.4');
  assert(texts(rulesMsgs[3][0]).join('').includes('`4.5.1`'), 'rozdział 4: punkt 4.5.1');
  assert(['Kryptowaluty', 'BTC', 'ETH', 'USDT', 'LTC'].every((w) => texts(rulesMsgs[3][0]).join('').includes(w)), 'rozdział 4: kryptowaluty');
  assert(texts(rulesMsgs[1][0]).join('').includes('punktu `1.14`'), 'odwołanie do punktu 1.14 w zwrotach');
  const priceJson = JSON.stringify(pricingPanel(g, null).toJSON());
  assert(['1 miesiąc', '5 zł', '3 miesiące', '14 zł', '1 rok', '50 zł'].every((t) => priceJson.includes(t)), 'cennik: 3 pakiety hostingu');
  assert(!priceJson.includes('tk:quick:bot') && !priceJson.includes('Boty Discord'), 'cennik bez botów');
  const hostingJson = JSON.stringify(ticketModal('hosting').toJSON());
  assert(hostingJson.includes('1 rok — 50 zł') && !hostingJson.includes('6 miesięcy'), 'formularz hostingu z pakietami z cennika');
  const logo = logoOf({ iconURL: () => img }, { user: { displayAvatarURL: () => img } });
  for (const [type, build] of Object.entries(panelBuilders)) {
    assert(!JSON.stringify(build(g, logo).toJSON()).includes('"type":11'), `panel ${type} bez zdjęcia bota/serwera`);
  }
  const modals = [...Object.keys(ticketTypes).map(ticketModal), reviewModal('x'), doneModal(), notDoneModal(), closeReasonModal()];
  const minLengths = JSON.stringify(modals.map((m) => m.toJSON())).match(/"min_length":\d+/g) ?? [];
  assert(minLengths.every((m) => Number(m.split(':')[1]) <= 1), `w formularzach wystarczy 1 znak (${minLengths})`);

  // 2. Klient nie może kliknąć „Zrealizowane”.
  const iClientDone = interaction(CLIENT);
  const { error } = staffTicket(iClientDone);
  assert(error, 'klient nie może oznaczyć zrealizowania');

  // 3. „Zrealizowane” bez kanału LC → błąd, ticket dalej otwarty.
  let i = interaction(STAFF, { fields: doneFields });
  await onDoneSubmit(i);
  assert(!getTicket(GID, TICKET_CH).awaitingRep && !getTicket(GID, TICKET_CH).closedAt, 'bez kanału LC ticket nie może się zamknąć');

  // 4. „Zrealizowane” z kanałem LC → karta repa, ticket czeka.
  g.settings.lcChannelId = LC_CH;
  i = interaction(STAFF, { fields: doneFields });
  await onDoneSubmit(i);
  let t = getTicket(GID, TICKET_CH);
  assert(t.awaitingRep && !t.closedAt, 'po „Zrealizowane” ticket czeka na repa');
  assert(t.deal.product === 'Bot do exchange' && t.deal.payment === 'ltc' && t.deal.sellerId === STAFF, 'dane zamówienia zapisane');

  // 5. „Skopiuj wzór” nie zamyka ticketu.
  i = interaction(CLIENT, { customId: 'tk:copyrep', isChatInputCommand: () => false, inGuild: () => true, inCachedGuild: () => true, isRepliable: () => true, isButton: () => true, isStringSelectMenu: () => false, isModalSubmit: () => false });
  await route(i);
  assert(i.replies[0]?.content === `+rep <@${STAFF}> Bot do exchange [ 50 PLN ] [ LTC ]`, `wzór repa do skopiowania (${i.replies[0]?.content})`);
  assert(!getTicket(GID, TICKET_CH).closedAt, 'kopiowanie nie zamyka ticketu');

  const lcMessage = (authorId, content, mentions) => ({
    guild: fakeGuild,
    channelId: LC_CH,
    author: users[authorId] ?? mkUser(authorId),
    content,
    url: `https://discord.com/channels/${GID}/${LC_CH}/rep`,
    mentions: { users: { has: (id) => mentions.includes(id), size: mentions.length } },
    channel: channels[LC_CH],
    client: fakeClient,
    react: async (e) => log.push(['react', e]),
    reply: async (p) => (log.push(['lcreply', p]), { delete: async () => {} }),
  });

  // 6. Wiadomość innej osoby na LC → nic.
  channels[LC_CH].guild = fakeGuild;
  channels[LC_CH].messages.fetch = async () => ({ delete: async () => log.push(['delete-panel']) });
  await onLegitCheckMessage(Object.assign(lcMessage('ktos', `+rep <@${STAFF}> Bot [ 10 PLN ] [ BLIK ]`, [STAFF]), { channel: channels[LC_CH] }));
  await panelQueues.get(GID);
  assert(!getTicket(GID, TICKET_CH).closedAt, 'vouch innej osoby nie zamyka ticketu');
  assert(g.stats.lc === 0 && g.stats.done === 0, 'vouch osoby bez ticketu nie zmienia licznika (liczą się zrealizowane zamówienia)');

  // 7. Klient pisze coś innego niż rep → podpowiedź, ticket otwarty.
  messageContentOn = true;
  await onLegitCheckMessage(lcMessage(CLIENT, 'hej, dzięki!', []));
  assert(!getTicket(GID, TICKET_CH).closedAt, 'zwykła wiadomość nie zamyka ticketu');
  await onLegitCheckMessage(lcMessage(CLIENT, 'polecam', [STAFF]));
  assert(!getTicket(GID, TICKET_CH).closedAt, 'bez „+rep” ticket się nie zamyka');
  assert(log.some(([type]) => type === 'lcreply'), 'bot podpowiada poprawny wzór');

  // 8. Poprawny rep → reakcja, karta LC, zamknięcie, logi, DM.
  const before = log.length;
  await onLegitCheckMessage(lcMessage(CLIENT, `+rep <@${STAFF}> Bot do exchange [ 50 PLN ] [ LTC ]`, [STAFF]));
  await panelQueues.get(GID);
  t = getTicket(GID, TICKET_CH);
  assert(t.closedAt && t.result === 'done' && !t.awaitingRep && t.lcUrl, 'poprawny rep zamyka ticket jako zrealizowany');
  const after = log.slice(before);
  assert(after.some(([type, e]) => type === 'react' && e === '✅'), 'reakcja ✅ pod repem');
  assert(after.some(([type, id]) => type === 'send' && id === LOG_CH), 'log zamknięcia na kanale logów');
  assert(after.some(([type, id]) => type === 'dm' && id === CLIENT), 'transcript do klienta w DM');
  assert(g.stats.done === 1, 'statystyki zrealizowanych');
  const lcSends = after.filter(([type, id]) => type === 'send' && id === LC_CH).map(([, , p]) => JSON.stringify(p.components[0].toJSON()));
  assert(lcSends.some((j) => j.includes('JAK NAPISAĆ VOUCHA')), 'panel „Jak napisać voucha?” pod vouchem');
  assert(!JSON.stringify(after).includes('LEGIT CHECK #'), 'bez karty LEGIT CHECK #');
  assert(g.panels.vouch?.channelId === LC_CH, 'panel voucha zapisany');
  const doneLog = JSON.stringify(closedView(t, 'x', false).toJSON());
  assert(doneLog.includes('Oznaczył jako zrealizowane') && doneLog.includes(`<@${STAFF}>`), 'log pokazuje, kto kliknął Zrealizowane');

  // 8a. Log idzie na kanał przypisany do rodzaju ticketu.
  assert(after.some(([type, id]) => type === 'send' && id === LOG_CH), 'bez ustawień rodzaju — ogólny kanał logów');
  channels['log-questions'] = mkChannel('log-questions', 'logi-pytania');
  g.settings.ticketLogs = { question: 'log-questions' };

  // 8b. Zakup niezrealizowany: log pokazuje osobę, która kliknęła.
  channels['ticket-2'] = mkChannel('ticket-2', 'klient');
  g.tickets['ticket-2'] = { channelId: 'ticket-2', number: 2, type: 'bot', userId: CLIENT, openedAt: Date.now(), form: { desc: 'y' }, messageId: 'card2' };
  const iNot = interaction(STAFF, { channelId: 'ticket-2', channel: channels['ticket-2'] });
  await onCloseRequest(iNot);
  assert(!iNot.modal && JSON.stringify(iNot.replies[0].components[0].toJSON()).includes('tk:notdone'), 'zakup: Zamknij pokazuje Zrealizowane / Niezrealizowane');
  await closeTicket(iNot, { reason: 'Klient zrezygnował' });
  const notLog = JSON.stringify(closedView(getTicket(GID, 'ticket-2'), 'x', false).toJSON());
  assert(notLog.includes('Oznaczył jako niezrealizowane') && notLog.includes(`<@${STAFF}>`), 'log pokazuje, kto kliknął Niezrealizowane');
  assert(JSON.stringify(iNot.replies[1].components[0].toJSON()).includes('Oznaczył jako niezrealizowane'), 'wiadomość w tickecie pokazuje, kto kliknął');

  // 8c. Pytanie: Zamknij → od razu formularz z powodem → zamknięte (bez zrealizowane/niezrealizowane).
  channels['ticket-3'] = mkChannel('ticket-3', 'klient');
  g.tickets['ticket-3'] = { channelId: 'ticket-3', number: 3, type: 'question', userId: CLIENT, openedAt: Date.now(), form: { question: '?' }, messageId: 'card3' };
  const iQ = interaction(STAFF, { channelId: 'ticket-3', channel: channels['ticket-3'] });
  await onCloseRequest(iQ);
  assert(iQ.modal?.toJSON().custom_id === 'tk:closesubmit' && !iQ.replies.length, 'pytanie: Zamknij od razu pokazuje formularz z powodem');
  const iQSubmit = interaction(STAFF, {
    channelId: 'ticket-3',
    channel: channels['ticket-3'],
    customId: 'tk:closesubmit',
    fields: { getTextInputValue: () => 'Pytanie wyjaśnione' },
    isChatInputCommand: () => false,
    inGuild: () => true,
    inCachedGuild: () => true,
    isRepliable: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => true,
  });
  await route(iQSubmit);
  const q = getTicket(GID, 'ticket-3');
  assert(q.closedAt && q.result === 'closed' && q.closeReason === 'Pytanie wyjaśnione', 'pytanie zamknięte z powodem');
  const qLog = JSON.stringify(closedView(q, 'x', false).toJSON());
  assert(qLog.includes('Zamknięte') && !qLog.includes('Niezrealizowane') && qLog.includes('Pytanie wyjaśnione'), 'log pytania: „Zamknięte” i powód');
  assert(log.some(([type, id]) => type === 'send' && id === 'log-questions'), 'log pytania trafia na kanał logów pytań');
  // Klient też dostaje od razu formularz.
  channels['ticket-4'] = mkChannel('ticket-4', 'klient');
  g.tickets['ticket-4'] = { channelId: 'ticket-4', number: 4, type: 'partner', userId: CLIENT, openedAt: Date.now(), form: { offer: 'x' }, messageId: 'card4' };
  const iP = interaction(CLIENT, { channelId: 'ticket-4', channel: channels['ticket-4'] });
  await onCloseRequest(iP);
  assert(iP.modal?.toJSON().custom_id === 'tk:closesubmit', 'współpraca: klient też dostaje formularz z powodem');

  // 9. Bez Message Content: wystarczy oznaczenie sprzedawcy.
  messageContentOn = false;
  assert(isRep({ content: '', mentions: { users: { size: 1 } } }), 'bez intentu: oznaczenie kogoś wystarcza');
  messageContentOn = true;

  // 10. „Czy legit?” — ✅ zapisuje się od razu (bez bota), ❌ znika i daje przerwę 7 dni (staff bez przerwy).
  g.panels.legit = { channelId: LEGIT_CH, messageId: 'legit-msg' };
  const YES = { id: '1554504948211785778', name: 'TAK', animated: true };
  const NO = { id: '1554505001492021248', name: 'NIE', animated: true };
  const reactions = new Map([
    [YES.id, { emoji: YES, count: 405, me: true }],
    [NO.id, { emoji: NO, count: 2, me: true }],
    ['✅', { emoji: { id: null, name: '✅' }, count: 3, me: false }],
  ]);
  const removed = [];
  const reaction = (emoji) => ({
    partial: false,
    emoji,
    users: { remove: async (id) => removed.push([emoji.name, id]) },
    message: { id: 'legit-msg', partial: false, guildId: GID, guild: fakeGuild, channelId: LEGIT_CH, client: fakeClient, reactions: { cache: reactions } },
  });
  await onLegitReaction(reaction(YES), mkUser('fan'), true);
  assert(g.legitVotes.yes === 407, `TAK (własne emoji) + zapasowe ✅ liczone razem, bez bota (${g.legitVotes.yes})`);
  await onLegitReaction(reaction(NO), mkUser('hater'), true);
  assert(removed.some(([e, id]) => e === 'NIE' && id === 'hater'), 'reakcja NIE usunięta');
  const hater = log.find(([type, id]) => type === 'timeout' && id === 'hater');
  assert(hater && hater[2] === 7 * 86_400_000, 'przerwa 7 dni za NIE');
  assert(log.some(([type, id]) => type === 'dm' && id === 'hater'), 'DM o przerwie');
  const timeoutsBefore = log.filter(([type]) => type === 'timeout').length;
  await onLegitReaction(reaction(NO), mkUser(STAFF), true);
  assert(removed.some(([e, id]) => e === 'NIE' && id === STAFF), 'NIE od staffu też usunięte');
  assert(log.filter(([type]) => type === 'timeout').length === timeoutsBefore, 'staff bez przerwy');
  assert(g.legitVotes.yes === 407, 'NIE nie zmienia licznika');
  await onLegitReaction(reaction({ id: '999', name: 'inne' }), mkUser('x'), true);
  assert(g.legitVotes.yes === 407 && !removed.some(([e]) => e === 'inne'), 'inne emoji ignorowane');
  reactions.delete('✅');
  reactions.get(YES.id).count = 404;
  await onLegitReaction(reaction(YES), mkUser('fan'), false);
  assert(g.legitVotes.yes === 403, 'cofnięcie TAK zmniejsza licznik');
  reactions.get(YES.id).count = 405;
  await onLegitReaction(reaction(YES), mkUser('fan'), true);
  const legitJson = JSON.stringify(legitPanel(g, null).toJSON());
  assert(legitJson.includes('<a:TAK:1554504948211785778>') && legitJson.includes('<a:NIE:1554505001492021248>'), 'panel z emoji TAK / NIE');
  assert(legitJson.includes('zieloną') && legitJson.includes('czerwoną'), 'panel: TAK zielone, NIE czerwone');

  // 11. Liczniki kanałów: nazwy z bazy.
  g.settings.reviewChannelId = null;
  await updateCounters(fakeClient);
  assert(channels[LEGIT_CH].name === '🤔┃czy-legit→404', `licznik czy legit (${channels[LEGIT_CH].name})`);
  assert(channels[LC_CH].name === '✅┃legit-check→1', `licznik legit check = zrealizowane zamówienia (${channels[LC_CH].name})`);
  const renames = log.filter(([type]) => type === 'rename').length;
  await updateCounters(fakeClient);
  assert(log.filter(([type]) => type === 'rename').length === renames, 'bez zmian liczby nie zmieniamy nazwy');

  // 12. Opinie: bez numeru w tytule, panel zawsze na dole (także przy dwóch opiniach naraz).
  const REV_CH = 'rev-ch';
  const revMessages = new Map();
  let revSeq = 0;
  const revOrder = [];
  const revChannel = {
    id: REV_CH,
    guild: fakeGuild,
    send: async (p) => {
      const id = `rev-m${++revSeq}`;
      const json = JSON.stringify(p.components[0].toJSON());
      const kind = json.includes('rev:open') ? 'panel' : 'review';
      const msg = { id, url: `https://discord.com/channels/${GID}/${REV_CH}/${id}`, kind, json, react: async () => {}, delete: async () => revMessages.delete(id) };
      revMessages.set(id, msg);
      revOrder.push(id);
      return msg;
    },
    messages: { fetch: async (id) => revMessages.get(id) ?? null },
  };
  channels[REV_CH] = revChannel;
  fakeGuild.iconURL = () => null;
  fakeClient.user = { id: 'bot', displayAvatarURL: () => null };
  g.settings.reviewChannelId = REV_CH;
  assert(title('Jak napisać voucha?', '✅') === '## ```✅ TanieBoty × JAK NAPISAĆ VOUCHA?```', `format tytułu (${title('Jak napisać voucha?', '✅')})`);
  const firstPanel = await postPanel(fakeClient, fakeGuild, revChannel, 'opinie');
  const reviewInteraction = (userId) =>
    interaction(userId, {
      fields: {
        getStringSelectValues: (id) => [id === 'product' ? 'bot' : '5'],
        getTextInputValue: () => 'Super bot, polecam!',
      },
      deferReply: async () => {},
      editReply: async () => {},
    });
  g.reviews = [];
  users.client2 = mkUser('client2');
  await Promise.all([onReviewSubmit(reviewInteraction(CLIENT), GID), onReviewSubmit(reviewInteraction('client2'), GID)]);
  await panelQueues.get(GID);
  const remaining = [...revMessages.values()];
  const panelsLeft = remaining.filter((m) => m.kind === 'panel');
  const reviewsLeft = remaining.filter((m) => m.kind === 'review');
  assert(!revMessages.has(firstPanel.message.id), 'stary panel usunięty');
  assert(panelsLeft.length === 1, `dokładnie jeden panel (${panelsLeft.length})`);
  assert(reviewsLeft.length === 2, 'obie opinie wysłane');
  const lastId = revOrder.filter((id) => revMessages.has(id)).at(-1);
  assert(revMessages.get(lastId).kind === 'panel', 'panel jest ostatnią wiadomością');
  assert(g.panels.opinie.messageId === lastId, 'baza wskazuje nowy panel');
  assert(!reviewsLeft[0].json.includes('#0001') && reviewsLeft[0].json.includes('OPINIA'), 'tytuł opinii bez numeru');
  assert(panelsLeft[0].json.includes('`2`'), 'panel pokazuje aktualną liczbę opinii');

  delete store.guilds[GID];
  console.log('✅ Test przepływu: 12 scenariuszy (w tym czy legit i opinie z panelem na dole) OK');
}


// ─── Test generatora serwera (symulacja) ───────────────────────────────

async function generatorTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test generatora nie przeszedł: ${msg}`);
  };
  const GID = 'gen-guild';
  const created = [];
  const deleted = [];
  const dms = [];
  let seq = 0;
  const oldChannels = new Map([
    ['old1', { id: 'old1', name: 'general', type: ChannelType.GuildText, delete: async () => deleted.push('old1') }],
    ['oldcat', { id: 'oldcat', name: 'Kategoria', type: ChannelType.GuildCategory, delete: async () => deleted.push('oldcat') }],
    ['rules', { id: 'rules', name: 'rules', type: ChannelType.GuildText, delete: async () => Promise.reject(new Error('Cannot delete a channel required for community servers')) }],
  ]);
  const roles = new Map([['everyone', { id: 'everyone', name: '@everyone' }]]);
  const fakeGuild = {
    id: GID,
    name: 'TanieBoty',
    iconURL: () => null,
    roles: {
      everyone: { id: 'everyone' },
      fetch: async () => roles,
      create: async (opts) => {
        const role = { id: `role${++seq}`, ...opts };
        roles.set(role.id, role);
        return role;
      },
    },
    members: { fetch: async (id) => ({ id, roles: { add: async (r) => dms.push(['role', id, r]) } }) },
    channels: {
      fetch: async () => oldChannels,
      create: async (opts) => {
        const ch = {
          id: `ch${++seq}`,
          ...opts,
          send: async (p) => (created.find((item) => item.id === ch.id).sent.push(p), { id: `msg${++seq}`, react: async () => {} }),
          sent: [],
        };
        created.push(ch);
        return ch;
      },
    },
  };
  const fakeClient = { user: { id: 'bot', displayAvatarURL: () => null }, users: { fetch: async (id) => ({ id, send: async (p) => dms.push(['dm', id, p]) }) } };

  // Stary otwarty ticket nie może blokować nowych po generowaniu.
  const g = guild(GID);
  g.tickets.old = { channelId: 'old', userId: 'u', openedAt: 1, type: 'bot', form: {} };

  const report = await generateServer(fakeClient, fakeGuild, 'admin-user');
  const byName = (name) => created.find((item) => item.name === name);
  const cats = created.filter((item) => item.type === ChannelType.GuildCategory);
  const chans = created.filter((item) => item.type !== ChannelType.GuildCategory);

  assert(deleted.includes('old1') && deleted.includes('oldcat'), 'stare kanały usunięte');
  assert(deleted.indexOf('old1') < deleted.indexOf('oldcat'), 'najpierw kanały, potem kategorie');
  assert(report.errors.some((e) => e.includes('#rules')), 'błąd usuwania kanału społeczności zgłoszony, generowanie trwa dalej');
  assert(cats.length === 11 && chans.length === 22, `11 kategorii i 22 kanały (${cats.length}/${chans.length})`);
  assert(['👋┃witamy', '📩┃zaproszenia'].every((n) => created.find((item) => item.id === byName(n).parent)?.name === '━━ 👋 WITAMY ━━'), 'WITAMY: witamy i zaproszenia');
  assert(['━━ 📌 WAŻNE ━━', '━━ 🤝 ZAUFANIE ━━', '━━ 🎫 TICKETY ━━', '━━ 💻 ZAMÓWIENIA BOTÓW ━━', '━━ 🖥️ ZAMÓWIENIA HOSTINGU ━━', '━━ ❓ PYTANIA ━━', '━━ 🤝 WSPÓŁPRACA ━━', '━━ 🛡️ ADMINISTRACJA ━━'].every(byName), 'nazwy kategorii w stylu ━━');
  const parentOf = (name) => created.find((item) => item.id === byName(name).parent)?.name;
  assert(['📜┃regulamin', '📢┃ogłoszenia', '💰┃cennik', '🎉┃konkursy', '🚀┃boosty'].every((n) => parentOf(n) === '━━ 📌 WAŻNE ━━'), 'WAŻNE: regulamin, ogłoszenia, cennik, konkursy, boosty');
  assert(['✅┃legit-check→0', '⭐┃opinie→0', '🤔┃czy-legit→0'].every((n) => parentOf(n) === '━━ 🤝 ZAUFANIE ━━'), 'ZAUFANIE: legit-check, opinie, czy-legit');
  assert(parentOf('🎫┃tickety') === '━━ 🎫 TICKETY ━━', 'panel ticketów w osobnej kategorii');
  assert(byName('🎉┃konkursy') && byName('📜┃regulamin') && byName('⭐┃opinie→0') && byName('🤔┃czy-legit→0') && byName('✅┃legit-check→0'), 'nazwy kanałów w stylu ┃');
  assert(byName('🔊┃rozmowy').type === ChannelType.GuildVoice, 'kanały głosowe');
  assert([...roles.values()].filter((r) => r.name !== '@everyone').length === 4, '4 role');
  assert(dms.some(([t, id]) => t === 'role' && id === 'admin-user'), 'rola Administracja dla osoby, która generuje');

  const everyoneDeny = (ch) => ch.permissionOverwrites.find((o) => o.id === 'everyone').deny;
  assert(['💻┃logi-boty', '🖥️┃logi-hosting', '🧾┃logi-zakupy', '❓┃logi-pytania', '🤝┃logi-współpraca'].every((n) => everyoneDeny(byName(n)).includes(F.ViewChannel)), '5 kanałów logów ukrytych przed wszystkimi');
  assert(['━━ 💻 ZAMÓWIENIA BOTÓW ━━', '━━ 🖥️ ZAMÓWIENIA HOSTINGU ━━', '━━ ❓ PYTANIA ━━', '━━ 🤝 WSPÓŁPRACA ━━'].every((n) => everyoneDeny(byName(n)).includes(F.ViewChannel)), '4 kategorie ticketów prywatne');
  assert(!everyoneDeny(byName('━━ 🎫 TICKETY ━━')).includes(F.ViewChannel), 'kategoria z panelem ticketów publiczna');
  assert(everyoneDeny(byName('📜┃regulamin')).includes(F.SendMessages), 'regulamin tylko do czytania');
  assert(!everyoneDeny(byName('✅┃legit-check→0')).includes(F.SendMessages), 'na legit-check można pisać');
  assert(!everyoneDeny(byName('💬┃czat')).includes(F.SendMessages), 'na czacie można pisać');
  assert(byName('📜┃regulamin').permissionOverwrites.some((o) => o.id === 'bot' && o.allow.includes(F.SendMessages)), 'bot może pisać wszędzie');

  const s = guild(GID).settings;
  const typeMap = { bot: ['━━ 💻 ZAMÓWIENIA BOTÓW ━━', '💻┃logi-boty'], hosting: ['━━ 🖥️ ZAMÓWIENIA HOSTINGU ━━', '🖥️┃logi-hosting'], question: ['━━ ❓ PYTANIA ━━', '❓┃logi-pytania'], partner: ['━━ 🤝 WSPÓŁPRACA ━━', '🤝┃logi-współpraca'] };
  for (const [type, [catName, logName]] of Object.entries(typeMap)) {
    assert(ticketCategoryFor(s, type) === byName(catName).id, `ticket ${type} tworzy się w ${catName}`);
    assert(ticketLogFor(s, type) === byName(logName).id, `log ticketu ${type} idzie na ${logName}`);
  }
  assert(s.lcChannelId === byName('✅┃legit-check→0').id, 'legit check ustawiony');
  assert(s.reviewChannelId === byName('⭐┃opinie→0').id && s.boostChannelId === byName('🚀┃boosty').id, 'opinie i boosty ustawione');
  assert(s.staffRoleId && s.rulesRoleId, 'role staff i regulaminu ustawione');
  assert(s.welcomeChannelId === byName('👋┃witamy').id && s.invitesChannelId === byName('📩┃zaproszenia').id, 'powitania i zaproszenia ustawione');
  assert(report.panels.length === 6 && ['📜┃regulamin', '💰┃cennik', '🎫┃tickety', '⭐┃opinie→0', '🤔┃czy-legit→0', '✅┃legit-check→0'].every((n) => byName(n).sent.length === 1), '6 paneli wysłanych');
  assert(JSON.stringify(byName('📜┃regulamin').sent[0].components[0].toJSON()).includes('rules:accept'), 'regulamin z przyciskiem akceptacji');
  assert(byName('💬┃admin-czat').sent.length === 1 && dms.some(([t]) => t === 'dm'), 'podsumowanie na admin-czat i w DM');
  assert(guild(GID).tickets.old.closedAt, 'stare tickety zamknięte w bazie');
  assert(openTicketsOf(GID, 'u').length === 0, 'klient może otworzyć nowy ticket');

  delete store.guilds[GID];
  console.log('✅ Test generatora: 35 sprawdzeń OK');
}

// ═══ REJESTRACJA KOMEND ════════════════════════════════════════════════

/**
 * Komendy mogą być zarejestrowane globalnie albo na konkretnym serwerze. Jeśli istnieją w obu miejscach,
 * Discord pokazuje je podwójnie — dlatego zawsze czyścimy ten zestaw, którego nie używamy.
 */
async function registerCommands(rest, appId, guildId, guildIds, body) {
  const registerGlobal = async () => {
    await rest.put(Routes.applicationCommands(appId), { body });
    // Usuwamy stare komendy serwerowe, żeby nie dublowały globalnych.
    for (const id of guildIds) await rest.put(Routes.applicationGuildCommands(appId, id), { body: [] }).catch(() => {});
    console.log(`✅ Zarejestrowano ${body.length} komend globalnie (mogą pojawić się z opóźnieniem do ~1h)`);
    return 'global';
  };
  if (!guildId) return registerGlobal();
  try {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
  } catch (err) {
    if (err.code !== 50001) throw err;
    console.warn(`⚠️ Brak dostępu do serwera ${guildId} — rejestruję komendy globalnie.`);
    return registerGlobal();
  }
  // Usuwamy stare komendy globalne, żeby nie dublowały serwerowych.
  await rest.put(Routes.applicationCommands(appId), { body: [] });
  console.log(`✅ Zarejestrowano ${body.length} komend na serwerze ${guildId} (stare komendy globalne usunięte)`);
  return 'guild';
}

async function registerTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test rejestracji nie przeszedł: ${msg}`);
  };
  const mkRest = (failGuild) => {
    const calls = [];
    return {
      calls,
      put: async (path, { body }) => {
        if (failGuild && path.includes('/guilds/') && body.length) throw Object.assign(new Error('Missing Access'), { code: 50001 });
        calls.push([path, body.length]);
      },
    };
  };
  const body = [{ name: 'a' }, { name: 'b' }];
  const log = console.log;
  const warn = console.warn;
  console.log = console.warn = () => {};
  try {
    let rest = mkRest(false);
    assert((await registerCommands(rest, 'app', 'g1', ['g1'], body)) === 'guild', 'rejestracja na serwerze');
    assert(rest.calls.some(([r, n]) => r === Routes.applicationGuildCommands('app', 'g1') && n === 2), 'komendy na serwerze');
    assert(rest.calls.some(([r, n]) => r === Routes.applicationCommands('app') && n === 0), 'globalne wyczyszczone');

    rest = mkRest(false);
    assert((await registerCommands(rest, 'app', null, ['g1', 'g2'], body)) === 'global', 'rejestracja globalna');
    assert(rest.calls.some(([r, n]) => r === Routes.applicationCommands('app') && n === 2), 'komendy globalne');
    assert(['g1', 'g2'].every((g) => rest.calls.some(([r, n]) => r === Routes.applicationGuildCommands('app', g) && n === 0)), 'serwerowe wyczyszczone');

    rest = mkRest(true);
    assert((await registerCommands(rest, 'app', 'g1', ['g1'], body)) === 'global', 'brak dostępu → globalnie');
  } finally {
    console.log = log;
    console.warn = warn;
  }
  console.log('✅ Test rejestracji komend: bez duplikatów OK');
}

// ─── Test powitań i zaproszeń (symulacja) ──────────────────────────────

async function welcomeTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test powitań nie przeszedł: ${msg}`);
  };
  const GID = 'welcome-guild';
  const sent = { welcome: [], invites: [] };
  const invites = new Map([['abc', { code: 'abc', uses: 1, inviter: { id: 'inviter1' } }]]);
  let vanityUses = 10;
  const fakeGuild = {
    id: GID,
    memberCount: 26,
    vanityURLCode: 'tanieboty',
    invites: { fetch: async () => new Map([...invites].map(([k, v]) => [k, { ...v }])) },
    fetchVanityData: async () => ({ uses: vanityUses }),
    channels: { fetch: async (id) => ({ send: async (p) => sent[id].push(JSON.stringify(p.components[0].toJSON())) }) },
  };
  const mkMember = (id, ageDays) => ({
    id,
    guild: fakeGuild,
    user: { bot: false, createdTimestamp: Date.now() - ageDays * 86_400_000, displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png' },
    toString: () => `<@${id}>`,
  });
  const g = guild(GID);
  Object.assign(g.settings, { welcomeChannelId: 'welcome', invitesChannelId: 'invites' });
  await cacheInvites(fakeGuild);

  // 1. Wejście z zaproszenia.
  invites.get('abc').uses = 2;
  await onMemberAdd(mkMember('new1', 365));
  assert(g.invites.inviter1.regular === 1, 'zaproszenie policzone');
  assert(sent.welcome[0].includes('NOWA OSOBA') && sent.welcome[0].includes('26. członkiem') && sent.welcome[0].includes('"type":11'), 'powitanie z avatarem i numerem członka');
  assert(sent.invites[0].includes('ZAPROSZENIA') && sent.invites[0].includes('<@inviter1>') && sent.invites[0].includes('**1** zaproszeń'), 'log zaproszenia z zapraszającym');
  assert(!sent.invites[0].includes('"type":11'), 'log zaproszeń bez zdjęcia');

  // 2. Nowe konto → fałszywe zaproszenie.
  invites.get('abc').uses = 3;
  await onMemberAdd(mkMember('new2', 1));
  assert(g.invites.inviter1.fake === 1 && g.invites.inviter1.regular === 1, 'nowe konto liczy się jako fałszywe');
  assert(sent.invites[1].includes('Nowe konto'), 'ostrzeżenie o nowym koncie');

  // 3. Wyjście → „wyszło”.
  onMemberRemove(mkMember('new1', 365));
  assert(g.invites.inviter1.left === 1 && inviteTotal(g.invites.inviter1) === 0, 'wyjście odejmuje zaproszenie');

  // 4. Link własny serwera.
  vanityUses = 11;
  await onMemberAdd(mkMember('new3', 365));
  assert(sent.invites[2].includes('.gg/tanieboty'), 'wejście przez link własny serwera');

  // 5. Widoki komendy /zaproszenia.
  invitesView({ displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png', toString: () => '<@inviter1>' }, g.invites.inviter1).toJSON();
  invitesRanking(g).toJSON();

  delete store.guilds[GID];
  console.log('✅ Test powitań i zaproszeń: 5 scenariuszy OK');
}

// ─── Test auto LC i spójności bazy (symulacja) ─────────────────────────

async function autoLcTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test auto LC nie przeszedł: ${msg}`);
  };
  const GID = 'autolc-guild';
  const sent = [];
  const hookSends = [];
  let seq = 0;
  const mkChannel = (id) => ({
    id,
    guildId: GID,
    name: id,
    send: async (p) => (sent.push([id, p]), { id: `m${++seq}`, url: `https://discord.com/channels/${GID}/${id}/m${seq}`, delete: async () => {}, react: async () => {} }),
    messages: { fetch: async () => null },
    delete: async () => sent.push([id, 'deleted']),
  });
  const channels = { lc: mkChannel('lc'), log: mkChannel('log'), t1: mkChannel('t1'), t2: mkChannel('t2') };
  let createdHooks = 0;
  channels.lc.fetchWebhooks = async () => new Map();
  channels.lc.createWebhook = async () => {
    createdHooks++;
    return {
      send: async (p) => (hookSends.push(p), { id: `hook${++seq}`, url: `https://discord.com/channels/${GID}/lc/hook${seq}`, react: async () => {} }),
    };
  };
  const users = {
    c1: { id: 'c1', username: 'wojtek3509', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png', send: async () => {} },
    c2: { id: 'c2', username: 'klient2', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/2.png', send: async () => {} },
  };
  const fakeGuild = { id: GID, name: 'TanieBoty', iconURL: () => null, channels: { fetch: async (id) => channels[id] ?? null } };
  for (const ch of Object.values(channels)) ch.guild = fakeGuild;
  const fakeClient = { user: { id: 'bot' }, users: { fetch: async (id) => users[id] }, channels: { fetch: async (id) => channels[id] ?? null } };
  makeTranscript = async () => ({ name: 'transcript.html' });

  const g = guild(GID);
  Object.assign(g.settings, { lcChannelId: 'lc', logChannelId: 'log' });
  const deal = { product: 'Bot do exchange', price: '50 zł', payment: 'ltc', sellerId: 'staff' };
  g.tickets.t1 = { channelId: 't1', number: 1, type: 'bot', userId: 'c1', openedAt: 1, form: {}, deal, awaitingRep: true, decidedBy: 'staff' };
  g.tickets.t2 = { channelId: 't2', number: 2, type: 'hosting', userId: 'c2', openedAt: 1, form: {}, deal, awaitingRep: true, decidedBy: 'staff' };
  g.tickets.t3 = { channelId: 't3', number: 3, type: 'bot', userId: 'c1', openedAt: 1, form: {} }; // otwarty, bez „Zrealizowane”

  // 1. /autolc: webhook z nazwą konta + [AUTO LC], zamknięcie, logi.
  const res = await autoLegitCheck(fakeClient, fakeGuild, 'admin');
  assert(res.done.length === 2 && !res.failed.length, 'auto LC dla 2 czekających ticketów');
  assert(createdHooks === 1, 'jeden webhook dla wszystkich');
  assert(hookSends[0].username === 'wojtek3509 [AUTO LC]', `nazwa webhooka (${hookSends[0].username})`);
  assert(hookSends[0].content === '+rep <@staff> Bot do exchange [ 50 zł ] [ LTC ]' && hookSends[0].avatarURL, 'treść repa i avatar klienta');
  assert(g.tickets.t1.closedAt && g.tickets.t1.result === 'done' && g.tickets.t1.autoLc, 'ticket zamknięty jako zrealizowany (auto LC)');
  assert(!g.tickets.t3.closedAt, 'ticket bez „Zrealizowane” nietknięty');
  assert(g.stats.done === 2, 'licznik zrealizowanych = 2');
  assert(sent.some(([id, p]) => id === 'lc' && JSON.stringify(p.components?.[0]?.toJSON?.() ?? '').includes('JAK NAPISAĆ VOUCHA')), 'panel voucha na dole po auto LC');
  const logSend = sent.find(([id, p]) => id === 'log' && p.components);
  assert(logSend && JSON.stringify(logSend[1].components[0].toJSON()).includes('[AUTO LC]'), 'log z oznaczeniem AUTO LC');
  assert(counterTargets(g).some(([id, , n]) => id === 'lc' && n === 2), 'nazwa kanału LC = liczba zrealizowanych');
  assert((await autoLegitCheck(fakeClient, fakeGuild, 'admin')).done.length === 0, 'drugie /autolc nic nie robi');
  // Webhook (auto LC) nie jest traktowany jak rep klienta.
  assert((await onLegitCheckMessage({ guild: fakeGuild, channelId: 'lc', author: { id: 'x', bot: true }, webhookId: 'h' })) === false, 'wiadomość webhooka pomijana');

  // 2. Usunięta opinia → znika z bazy.
  g.reviews = [{ number: 1, userId: 'c1', messageId: 'rev1', ratings: { quality: 5, time: 5, service: 5 }, at: 1 }];
  await onMessageDeleted({ id: 'rev1', guildId: GID, client: fakeClient });
  assert(g.reviews.length === 0, 'usunięta opinia usunięta z bazy');

  // 3. Usunięty panel „czy legit” → zapomniany, głosy od zera.
  g.panels.legit = { channelId: 'x', messageId: 'legitmsg' };
  g.legitVotes = { yes: 40, no: 0 };
  await onMessageDeleted({ id: 'legitmsg', guildId: GID, client: fakeClient });
  assert(!g.panels.legit && g.legitVotes.yes === 0, 'usunięty panel czy legit: reset do 0');

  // 4. Usunięty konkurs → anulowany, bez losowania.
  g.giveaways.gw1 = { channelId: 'x', prize: 'P', winners: 1, endsAt: Date.now() + 1e6, entrants: ['a'], ended: false };
  await onMessageDeleted({ id: 'gw1', guildId: GID, client: fakeClient });
  assert(g.giveaways.gw1.ended && g.giveaways.gw1.cancelled, 'usunięty konkurs anulowany');

  // 5. Ręcznie usunięty kanał ticketu → zamknięty w bazie, klient może otworzyć nowy.
  await onChannelDeleted({ id: 't3', guildId: GID, client: fakeClient });
  assert(g.tickets.t3.closedAt && openTicketsOf(GID, 'c1').length === 0, 'usunięty kanał zamyka ticket w bazie');
  assert(sent.some(([id, p]) => id === 'log' && JSON.stringify(p.components?.[0]?.toJSON?.() ?? '').includes('usunięty ręcznie')), 'informacja w logach');

  delete store.guilds[GID];
  console.log('✅ Test auto LC i spójności bazy: 5 scenariuszy OK');
}

// ─── Test bazy danych: podział na pliki i przeniesienie starego db.json ─

function databaseTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test bazy nie przeszedł: ${msg}`);
  };
  const savedDir = dataDir;
  const savedStore = store;
  const tmp = mkdtempSync(join(tmpdir(), 'tanieboty-db-'));
  const log = console.log;
  console.log = () => {};
  try {
    dataDir = tmp;
    const GID = '155312766976629564';
    const old = {
      guilds: {
        [GID]: {
          settings: { lcChannelId: '1', banners: {} },
          counter: 7,
          tickets: { t1: { number: 7 } },
          reviews: [{ number: 1, content: 'Super' }],
          giveaways: {},
          invites: { u: { regular: 2 } },
          joins: {},
          stats: { done: 3 },
          legitVotes: { yes: 5, no: 0 },
          panels: { cennik: { channelId: '2', messageId: '3' } },
          hosting: { orders: {}, servers: { 101: { name: 'Bot' } }, usedTx: [] },
          nowaSekcja: { x: 1 },
        },
      },
    };
    writeFileSync(join(tmp, 'db.json'), JSON.stringify(old));

    // 1. Pierwsze uruchomienie po aktualizacji: db.json → osobne pliki.
    store = loadStore();
    assert(existsSync(join(tmp, 'db.json.stary')) && !existsSync(join(tmp, 'db.json')), 'stary db.json zachowany jako db.json.stary');
    const files = readdirSync(join(tmp, GID)).sort();
    assert(
      JSON.stringify(files) === JSON.stringify(['hosting.json', 'inne.json', 'konkursy.json', 'opinie.json', 'panele.json', 'statystyki.json', 'tickety.json', 'ustawienia.json', 'zaproszenia.json']),
      `pliki: ${files.join(', ')}`,
    );
    const read = (f) => JSON.parse(readFileSync(join(tmp, GID, f), 'utf8'));
    assert(read('opinie.json').reviews[0].content === 'Super' && !read('opinie.json').tickets, 'opinie tylko w opinie.json');
    assert(read('tickety.json').counter === 7 && read('tickety.json').tickets.t1, 'tickety i licznik w tickety.json');
    assert(read('hosting.json').hosting.servers[101].name === 'Bot', 'hosting w hosting.json');
    assert(read('zaproszenia.json').invites.u.regular === 2 && read('statystyki.json').legitVotes.yes === 5, 'zaproszenia i statystyki');
    assert(read('inne.json').nowaSekcja.x === 1, 'nieznane sekcje w inne.json');

    // 2. Zapis zmian i ponowne wczytanie (restart bota) — nic nie ginie.
    store.guilds[GID].reviews.push({ number: 2, content: 'Polecam' });
    store.guilds['test-guild'] = { settings: {} }; // testowe ID bez cyfr nie trafia na dysk
    flush();
    assert(!existsSync(join(tmp, 'test-guild')), 'testowe serwery nie są zapisywane');
    const reloaded = loadStore();
    const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
    assert(sorted(reloaded.guilds[GID]) === sorted(store.guilds[GID]), 'po restarcie dane identyczne');
    assert(reloaded.guilds[GID].reviews.length === 2, 'nowa opinia zapisana');
    mkdirSync(join(tmp, 'kopie'), { recursive: true });
    assert(Object.keys(loadStore().guilds).length === 1, 'inne foldery w data/ są pomijane');

    // 3. Prawdziwy start bota (osobny proces) ze starym db.json — przeniesienie przy starcie nie może się wysypać.
    const startDir = join(tmp, 'start');
    mkdirSync(startDir);
    writeFileSync(join(startDir, 'db.json'), JSON.stringify(old));
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--tylko-baza'], {
      env: { ...process.env, TANIEBOTY_DATA_DIR: startDir },
      encoding: 'utf8',
    });
    assert(run.status === 0 && run.stdout.includes('BAZA OK: 1'), `start z przeniesieniem bazy: ${run.stderr || run.stdout}`);
    assert(existsSync(join(startDir, GID, 'opinie.json')) && existsSync(join(startDir, 'db.json.stary')), 'start: pliki utworzone, db.json.stary zachowany');
    const again = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--tylko-baza'], {
      env: { ...process.env, TANIEBOTY_DATA_DIR: startDir },
      encoding: 'utf8',
    });
    assert(again.status === 0 && again.stdout.includes('BAZA OK: 1'), 'drugi start: odczyt z nowych plików');
  } finally {
    console.log = log;
    dataDir = savedDir;
    store = savedStore;
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log('✅ Test bazy: osobne pliki, przeniesienie db.json, zapis i odczyt OK');
}

// ─── Test boostów (symulacja) ──────────────────────────────────────────

async function boostTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test boostów nie przeszedł: ${msg}`);
  };
  const GID = 'boost-guild';
  const sent = [];
  const fakeGuild = {
    id: GID,
    premiumSubscriptionCount: 3,
    premiumTier: 1,
    fetch: async () => fakeGuild,
    channels: { fetch: async (id) => (id === 'boost-ch' ? { send: async (p) => (sent.push(p), { id: 'm' }) } : null) },
  };
  const user = { id: 'u1', tag: 'u1', bot: false, displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png', toString: () => '<@u1>' };
  const member = (since, partial = false) => ({ partial, premiumSinceTimestamp: since, user, guild: fakeGuild });
  const warn = console.warn;
  console.warn = () => {};
  try {
    // Bez kanału boostów nic nie jest wysyłane.
    await onMemberUpdate(member(null), member(Date.now()));
    assert(sent.length === 0, 'bez kanału boostów brak wiadomości');
    guild(GID).settings.boostChannelId = 'boost-ch';
    recentBoosts.clear();

    // 1. Zmiana statusu członka (działa bez wiadomości systemowych Discorda).
    await onMemberUpdate(member(null), member(Date.now()));
    assert(sent.length === 1, 'boost wykryty ze zmiany statusu członka');
    const json = JSON.stringify(sent[0].components[0].toJSON());
    assert(json.includes('NOWY BOOST') && json.includes('<@u1>') && json.includes('`3`'), 'treść podziękowania');
    assert(json.includes('attachment://baner-boosty.png') && sent[0].files.length === 1, 'baner BOOSTY w załączniku');

    // 2. Ta sama osoba — systemowa wiadomość chwilę później nie dubluje podziękowania.
    await onMessage({ guild: fakeGuild, type: MessageType.GuildBoost, author: user, channelId: 'x' });
    assert(sent.length === 1, 'bez duplikatu (status + wiadomość systemowa)');

    // 3. Kolejny boost po czasie (np. drugi boost tej osoby) — z wiadomości systemowej.
    recentBoosts.set(`${GID}:u1`, Date.now() - BOOST_DEDUPE_MS - 1);
    await onMessage({ guild: fakeGuild, type: MessageType.GuildBoostTier1, author: user, channelId: 'x' });
    assert(sent.length === 2, 'kolejny boost z wiadomości systemowej');

    // 4. Brak zmian: już boostował, nieznany stary stan, zwykła wiadomość.
    recentBoosts.clear();
    await onMemberUpdate(member(123), member(123));
    await onMemberUpdate(member(null, true), member(Date.now()));
    await onMessage({ guild: fakeGuild, type: MessageType.Default, author: user, channelId: 'x' });
    assert(sent.length === 2, 'brak fałszywych podziękowań');
  } finally {
    console.warn = warn;
    delete store.guilds[GID];
    recentBoosts.clear();
  }
  console.log('✅ Test boostów: wykrywanie, baner, bez duplikatów OK');
}

// ─── Test hostingu (symulacja panelu, blockchainów i Discorda) ─────────

function hostingViewsForTest() {
  const rec = { id: 7, identifier: 'abcd1234', name: 'Node.js • wojtek', userId: '2', lang: 'nodejs', plan: '1m', expiresAt: Date.now() + 5 * DAY, suspended: false };
  const order = (status, coin = 'ltc') => ({
    id: 'o1',
    userId: '2',
    coin,
    wallet: 'ltc1qexample',
    amount: '0.01250417',
    pln: 5,
    plan: '1m',
    lang: 'nodejs',
    status,
    confirmations: 1,
    txid: 'abc:internal',
    expiresAt: Date.now() + 1e6,
  });
  return [
    hostingReadyView(rec, { user: { email: 'a@b.pl' }, password: 'x' }, '9'),
    hostingReadyView({ ...rec, lang: 'other' }, { user: { email: 'a@b.pl' }, password: null }, '9'),
    hostingRenewedView({ ...rec, started: true }, '9'),
    hostingRenewedView({ ...rec, started: false }, '9'),
    hostingReminderView(rec, '9'),
    hostingExpiredView(rec, '9'),
    ...['waiting', 'seen', 'paid', 'creating', 'error', 'failed', 'done', 'expired', 'cancelled'].map((s) => orderView(order(s), '9')),
    ...Object.keys(cryptoCoins).map((coin) => orderView(order('seen', coin), '9')),
    orderView({ ...order('done'), renew: '7' }, '9'),
    ...Object.keys(hostingPayments).map((payment) => manualPaymentView({ lang: 'nodejs', period: '1m', payment })),
    manualPaymentView({ lang: 'other', period: '12m', payment: 'blik' }),
    myHostingView([rec, { ...rec, id: 8, suspended: true }], [order('waiting')], '9'),
    myHostingView([], [], '9'),
    hostingListView([rec, { ...rec, id: 8, suspended: true }], 'Serwery'),
    hostingListView([], 'Serwery'),
    renewModal('9', '7'),
  ];
}

async function hostingTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Test hostingu nie przeszedł: ${msg}`);
  };
  const J = (p) => JSON.stringify(p?.components?.[0]?.toJSON?.() ?? p);
  const GID = 'hosting-guild';
  const now = Date.now();
  const LTC = 'ltc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const ETH = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';
  const SOL = 'So1anaWa11etAddre55111111111111111111111111';
  const SOL_ATA = 'UsdcTokenAccount1111111111111111111111111111';

  const savedConfig = hostingConfig;
  const savedFetch = httpFetch;
  const savedDelay = hostingDelay;
  hostingConfig = {
    panelUrl: 'http://panel.test/',
    apiKey: 'ptla_test',
    clientApiKey: 'ptlc_test',
    eggs: { nodejs: { nest: 5, egg: 15 }, python: { nest: 5, egg: 16 }, java: { nest: 5, egg: 17 } },
    wallets: { ltc: LTC, eth: ETH, sol: SOL },
    manualPayments: { blik: 'Numer BLIK: 123 456 789' },
  };
  hostingDelay = async () => {};
  eggCache.clear();
  priceCache = { at: 0, data: {} };
  solTxCache.clear();
  solTokenAccounts = { at: 0, wallet: '', list: [] };

  // ── Symulowany panel Pterodactyl ──
  const panel = { users: [], servers: [], calls: [], power: [] };
  let serverSeq = 100;
  const eggVars = {
    15: [{ env_variable: 'MAIN_FILE', default_value: 'index.js' }, { env_variable: 'NODE_PACKAGES', default_value: null }],
    16: [{ env_variable: 'PY_FILE', default_value: 'main.py' }, { env_variable: 'REQUIREMENTS_FILE', default_value: 'requirements.txt' }],
    17: [{ env_variable: 'JARFILE', default_value: 'bot.jar' }],
  };
  const serverAttrs = (s) => ({ ...s, limits: { ...s.limits }, feature_limits: { ...s.feature_limits } });
  function panelRoute(method, path, body) {
    panel.calls.push([method, path, body]);
    let m;
    if ((m = /^\/api\/application\/users\/external\/discord-(\w+)$/.exec(path))) {
      const u = panel.users.find((x) => x.external_id === `discord-${m[1]}`);
      return u ? [200, { attributes: u }] : [404, { errors: [{ detail: 'not found' }] }];
    }
    if ((m = /^\/api\/application\/users\?filter\[email\]=(.+)$/.exec(path))) {
      const email = decodeURIComponent(m[1]);
      return [200, { data: panel.users.filter((u) => u.email === email).map((u) => ({ attributes: u })) }];
    }
    if (method === 'POST' && path === '/api/application/users') {
      if (panel.users.some((u) => u.username === body.username)) return [422, { errors: [{ detail: 'The username has already been taken.' }] }];
      const u = { id: panel.users.length + 1, ...body };
      delete u.password;
      panel.users.push(u);
      return [201, { attributes: u }];
    }
    if ((m = /^\/api\/application\/nests\/5\/eggs\/(\d+)\?include=variables$/.exec(path))) {
      const id = Number(m[1]);
      return [
        200,
        {
          attributes: {
            id,
            docker_image: `ghcr.io/parkervcp/yolks:egg${id}`,
            startup: `start-${id}`,
            relationships: { variables: { data: eggVars[id].map((v) => ({ attributes: v })) } },
          },
        },
      ];
    }
    if (path === '/api/application/locations') return [200, { data: [{ attributes: { id: 1 } }] }];
    if (path === '/api/client') return [200, { data: [] }];
    if (path === '/api/application/nodes?per_page=100') return [200, { data: [{ attributes: { id: 1, name: 'Node1', public: true } }] }];
    if (path === '/api/application/nodes/1/allocations?per_page=500') return [200, { data: [{ attributes: { assigned: true } }, { attributes: { assigned: false } }] }];
    if ((m = /^\/api\/application\/servers\/external\/(.+)$/.exec(path))) {
      const s = panel.servers.find((x) => x.external_id === m[1]);
      return s ? [200, { attributes: serverAttrs(s) }] : [404, { errors: [{ detail: 'not found' }] }];
    }
    if (method === 'POST' && path === '/api/application/servers') {
      const s = {
        id: ++serverSeq,
        identifier: `id${serverSeq}`,
        external_id: body.external_id,
        name: body.name,
        user: body.user,
        egg: body.egg,
        docker_image: body.docker_image,
        environment: body.environment,
        limits: body.limits,
        feature_limits: body.feature_limits,
        allocation: 900 + serverSeq,
        suspended: false,
        deploy: body.deploy,
      };
      panel.servers.push(s);
      return [201, { attributes: serverAttrs(s) }];
    }
    if ((m = /^\/api\/application\/servers\/(\d+)(\/[a-z]+)?$/.exec(path))) {
      const s = panel.servers.find((x) => x.id === Number(m[1]));
      if (!s) return [404, { errors: [{ detail: 'not found' }] }];
      if (method === 'GET') return [200, { attributes: serverAttrs(s) }];
      if (m[2] === '/suspend') return (s.suspended = true), [204, null];
      if (m[2] === '/unsuspend') return (s.suspended = false), [204, null];
      if (m[2] === '/details') return Object.assign(s, { name: body.name, lastDetails: body }), [200, { attributes: serverAttrs(s) }];
      if (m[2] === '/build') {
        s.lastBuild = body;
        Object.assign(s.limits, { memory: body.memory, disk: body.disk, cpu: body.cpu });
        return [200, { attributes: serverAttrs(s) }];
      }
      if (method === 'DELETE') return (panel.servers = panel.servers.filter((x) => x !== s)), [204, null];
    }
    if ((m = /^\/api\/client\/servers\/(\w+)\/power$/.exec(path))) return panel.power.push([m[1], body.signal]), [204, null];
    return [500, { errors: [{ detail: `nieznana ścieżka ${method} ${path}` }] }];
  }

  // ── Symulowane blockchainy ──
  const chain = { coinbaseDown: false, geckoDown: true, ltcSpaceDown: false, ltcTip: 3_000_000, ltcTxs: [], ethTxs: [], ethInternal: [], ethTokens: [], ethBlock: 20_000_000, solSigs: {}, solTxs: {} };
  function chainRoute(url, init) {
    assert(init.headers?.['User-Agent'], 'nagłówek User-Agent');
    // Coinbase blokuje (jak CoinGecko na niektórych serwerach) → kursy z zapasowego źródła; potem Coinbase działa.
    if (url.startsWith('https://api.coinbase.com/')) {
      if (chain.coinbaseDown) return [403, '<HTML><TITLE>ERROR</TITLE>blocked</HTML>'];
      return [200, { data: { currency: 'PLN', rates: { LTC: String(1 / 400), ETH: String(1 / 12000), SOL: String(1 / 600), USDC: String(1 / 3.65), BTC: '0.000003' } } }];
    }
    if (url.startsWith('https://api.coingecko.com/')) {
      if (chain.geckoDown) return [403, '<!DOCTYPE HTML><HTML><TITLE>ERROR</TITLE></HTML>'];
      return [200, { litecoin: { pln: 400 }, ethereum: { pln: 12000 }, solana: { pln: 600 }, 'usd-coin': { pln: 3.65 } }];
    }
    if (url.startsWith('https://litecoinspace.org/') && chain.ltcSpaceDown) throw new Error('The operation was aborted due to timeout');
    if (url === `https://api.blockcypher.com/v1/ltc/main/addrs/${LTC}?limit=50`) {
      // Te same wpłaty w formacie BlockCypher (potwierdzone w txrefs, niepotwierdzone w unconfirmed_txrefs).
      const refs = chain.ltcTxs.flatMap((tx) =>
        tx.vout
          .map((v, n) => [v, n])
          .filter(([v]) => v.scriptpubkey_address === LTC)
          .map(([v, n]) => ({
            tx_hash: tx.txid,
            tx_input_n: -1,
            tx_output_n: n,
            value: v.value,
            confirmations: tx.status.confirmed ? chain.ltcTip - tx.status.block_height + 1 : 0,
            [tx.status.confirmed ? 'confirmed' : 'received']: new Date(tx.status.block_time ? tx.status.block_time * 1000 : Date.now()).toISOString(),
          })),
      );
      return [200, { address: LTC, txrefs: refs.filter((r) => r.confirmed), unconfirmed_txrefs: [...refs.filter((r) => r.received), { tx_hash: 'spend', tx_input_n: 0, tx_output_n: -1, value: 999, confirmations: 0 }] }];
    }
    if (url === 'https://litecoinspace.org/api/blocks/tip/height') return [200, chain.ltcTip];
    if (url === `https://litecoinspace.org/api/address/${LTC}/txs`) return [200, chain.ltcTxs];
    if (url.startsWith('https://eth.blockscout.com/api?')) {
      const q = new URL(url).searchParams;
      assert(q.get('address') === ETH, 'ETH: zapytanie o właściwy adres');
      const list = { txlist: chain.ethTxs, txlistinternal: chain.ethInternal, tokentx: chain.ethTokens }[q.get('action')];
      return [200, list.length ? { status: '1', message: 'OK', result: list } : { status: '0', message: 'No transactions found', result: [] }];
    }
    if (url === 'https://ethereum-rpc.publicnode.com') return [200, { jsonrpc: '2.0', id: 1, result: `0x${chain.ethBlock.toString(16)}` }];
    if (url === 'https://api.mainnet-beta.solana.com') {
      const { method, params } = JSON.parse(init.body);
      if (method === 'getTokenAccountsByOwner') return [200, { result: { value: [{ pubkey: SOL_ATA }] } }];
      if (method === 'getSignaturesForAddress') return [200, { result: chain.solSigs[params[0]] ?? [] }];
      if (method === 'getTransaction') return [200, { result: chain.solTxs[params[0]] ?? null }];
    }
    return [500, 'nieznany adres'];
  }
  httpFetch = async (url, init = {}) => {
    const [status, body] = url.startsWith('http://panel.test/api/')
      ? panelRoute(init.method ?? 'GET', url.slice('http://panel.test'.length), init.body ? JSON.parse(init.body) : null)
      : chainRoute(url, init);
    if (url.startsWith('http://panel.test/')) assert(init.headers?.Authorization?.startsWith('Bearer ptl'), 'klucz API w nagłówku');
    return { ok: status < 400, status, text: async () => (body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body)) };
  };

  // ── Symulowany Discord ──
  const dms = [];
  const dmEdits = [];
  const logs = [];
  const channelSends = [];
  const purchaseLogs = [];
  const mkUser = (id, username, dmOpen = true) => ({
    id,
    username,
    globalName: username,
    tag: username,
    displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
    send: async (p) => {
      if (!dmOpen) throw new Error('Cannot send messages to this user');
      dms.push([id, p]);
      return { id: `dm${dms.length}`, channelId: `dmch-${id}` };
    },
  });
  const users = { c1: mkUser('c1', 'Wojtek3509'), c2: mkUser('c2', 'klient2'), c3: mkUser('c3', 'x'), closed: mkUser('closed', 'zamkniete', false), c4: mkUser('c4', 'nowy4'), staff: mkUser('staff', 'staff') };
  const roleAdds = [];
  const fakeGuild = {
    id: GID,
    roles: { cache: { find: (fn) => [{ id: 'role-client', name: serverLayout.roles.client.name }].find(fn) } },
    members: { fetch: async (id) => ({ id, roles: { add: async (r) => roleAdds.push([id, r.id]) } }) },
  };
  const ticketChannel = {
    id: 'hticket',
    send: async (p) => (channelSends.push(p), { id: `tm${channelSends.length}` }),
    messages: { fetch: async () => ({ edit: async (p) => channelSends.push(['card', p]) }) },
  };
  const client = {
    user: { id: 'bot' },
    users: { fetch: async (id) => users[id] },
    guilds: { cache: { get: (id) => (id === GID ? fakeGuild : null) } },
    channels: {
      fetch: async (id) => {
        if (id === 'hlog') return { send: async (p) => logs.push(J(p)) };
        if (id === 'plog')
          return {
            send: async (p) => (purchaseLogs.push({ id: `pl${purchaseLogs.length}`, json: J(p), edits: 0 }), { id: `pl${purchaseLogs.length - 1}`, channelId: 'plog' }),
            messages: {
              fetch: async (mid) => {
                const entry = purchaseLogs.find((e) => e.id === mid);
                return entry && { edit: async (p) => Object.assign(entry, { json: J(p), edits: entry.edits + 1 }) };
              },
            },
          };
        if (id.startsWith('dmch-')) return { messages: { fetch: async (mid) => ({ edit: async (p) => dmEdits.push([mid, J(p)]) }) } };
        return null;
      },
    },
  };
  const g = guild(GID);
  Object.assign(g.settings, { staffRoleId: 'staff-role', ticketLogs: { hosting: 'hlog' }, lcChannelId: 'lc', purchaseLogChannelId: 'plog' });
  const interaction = (userId, extra = {}) => ({
    user: users[userId],
    client,
    guildId: GID,
    guild: fakeGuild,
    channelId: 'hticket',
    channel: ticketChannel,
    member: { permissions: { has: () => false }, roles: { cache: { has: (r) => userId === 'staff' && r === 'staff-role' } } },
    replies: [],
    reply(p) {
      this.replies.push(p);
      return Promise.resolve();
    },
    deferReply() {
      this.deferred = true;
      return Promise.resolve();
    },
    editReply(p) {
      this.replies.push(p);
      return Promise.resolve();
    },
    update(p) {
      this.replies.push(p);
      return Promise.resolve();
    },
    showModal(m) {
      this.modal = m;
      return Promise.resolve();
    },
    isButton: () => true,
    isModalSubmit: () => false,
    inGuild: () => true,
    ...extra,
  });
  const purchase = async (userId, form) => {
    const i = interaction(userId, {
      fields: {
        getStringSelectValues: (id) => (form[id] ? [form[id]] : []),
        getTextInputValue: (id) => form[id] ?? '',
      },
    });
    await onTicketForm(i, 'hosting');
    return i;
  };
  const lastOrder = (userId) => Object.values(g.hosting.orders).filter((o) => o.userId === userId).at(-1);
  const tick = () => processOrders(client, GID);

  try {
    // 1. Kwoty z unikalną końcówką.
    const ltcAmt = cryptoAmount('ltc', 5, 400, new Set());
    assert(ltcAmt.amount.startsWith('0.01250') && ltcAmt.amount.length === 10 && BigInt(ltcAmt.units) === BigInt(ltcAmt.shownUnits), `LTC: 5 zł / 400 zł = 0.0125 + końcówka (${ltcAmt.amount})`);
    const ethAmt = cryptoAmount('eth', 5, 12000, new Set());
    assert(ethAmt.amount.startsWith('0.00042') && BigInt(ethAmt.units) === BigInt(ethAmt.shownUnits) * 10n ** 10n, `ETH: 8 miejsc po przecinku, jednostki w wei (${ethAmt.amount})`);
    const usdcAmt = cryptoAmount('usdc_eth', 5, 3.65, new Set());
    assert(usdcAmt.amount.startsWith('1.370') && usdcAmt.amount.length === 8, `USDC: 1.37 + końcówka (${usdcAmt.amount})`);
    const taken = new Set(Array.from({ length: 998 }, (_, k) => 1_250_000 + k + 1));
    assert(cryptoAmount('ltc', 5, 400, taken).shownUnits === 1_250_999, 'zajęte końcówki są pomijane');
    assert(unitsToString(5, 8) === '0.00000005' && unitsToString(123456789, 8) === '1.23456789', 'zapis kwot');

    // Kursy: Coinbase (CoinGecko zablokowany jak na serwerze Wojtka), zapasowo CoinGecko, oba padnięte → błąd.
    let prices = await cryptoPricesPln();
    assert(Math.abs(prices.litecoin.pln - 400) < 1e-6 && Math.abs(prices['usd-coin'].pln - 3.65) < 1e-6, 'kursy z Coinbase');
    Object.assign(chain, { coinbaseDown: true, geckoDown: false });
    priceCache.at = 0;
    prices = await cryptoPricesPln();
    assert(prices.ethereum.pln === 12000, 'zapasowo kursy z CoinGecko');
    Object.assign(chain, { geckoDown: true });
    priceCache.at = 0;
    const noPrices = await cryptoPricesPln().catch((err) => err.message);
    assert(/Brak kursów/.test(noPrices) && noPrices.includes('HTTP 403: ERROR blocked'), `oba źródła padnięte → czytelny błąd (${noPrices})`);
    Object.assign(chain, { coinbaseDown: false });
    priceCache.at = 0;

    // 2. Walidacja formularza.
    const form = (extra) => ({ lang: 'nodejs', period: '1m', mode: 'auto', payment: 'ltc', email: 'jan@gmail.com', ...extra });
    assert(hostingFormError(form()) === null, 'poprawny formularz');
    assert(/krypto/i.test(hostingFormError(form({ payment: 'blik' }))), 'auto + BLIK → błąd');
    assert(/ręcznym/.test(hostingFormError(form({ lang: 'other' }))), 'inny język + auto → błąd');
    assert(hostingFormError(form({ lang: 'other', mode: 'manual', payment: 'blik' })) === null, 'inny język ręcznie OK');
    assert(/e-mail/.test(hostingFormError(form({ email: 'zly' }))), 'zły e-mail');
    assert(hostingFormError(form({ email: null, renew: '5', lang: 'other' })) === null, 'przedłużenie bez e-maila i dla innego języka');
    const modalJson = JSON.stringify(ticketModal('hosting').toJSON());
    assert(
      ['Język bota', 'Okres hostingu', 'Sposób zakupu', 'Automatyczny', 'Ręczny', 'USDC (sieć Solana)', 'Revolut', 'E-mail'].every((t) => modalJson.includes(t)) && !modalJson.includes('Nazwa serwera'),
      'formularz zakupu: język, okres, sposób, płatność, e-mail (bez nazwy)',
    );
    assert(ticketModal('hosting').toJSON().components.length === 5, 'formularz ma 5 pól (limit Discorda)');
    assert(cleanServerName('  Mój\u200b   bot\n ticketowy  ') === 'Mój bot ticketowy' && cleanServerName('   ') === null && cleanServerName('x'.repeat(60)).length === 40, 'czyszczenie nazwy serwera');
    assert(normalizeHostingForm({ pay: 'manual:usdc_sol' }).mode === 'manual' && normalizeHostingForm({ pay: 'auto:eth' }).payment === 'eth', 'płatność i sposób z jednego menu');
    assert(/z listy/.test(hostingFormError(normalizeHostingForm({ lang: 'nodejs', period: '1m', pay: 'auto:btc', email: 'a@b.pl' }))), 'nieznana płatność → błąd');

    // 3. Zakup automatyczny LTC: DM z kwotą → wpłata w mempoolu → 2 potwierdzenia → serwer.
    let i = await purchase('c1', form());
    let order = lastOrder('c1');
    assert(order?.status === 'waiting' && order.wallet === LTC && order.amount.startsWith('0.01250'), 'zamówienie LTC utworzone');
    assert(J(i.replies.at(-1)).includes('DM') && dms.length === 1 && J(dms[0][1]).includes(order.amount) && J(dms[0][1]).includes(LTC), 'DM z adresem i kwotą');
    assert(J(dms[0][1]).includes('api.qrserver.com'), 'kod QR adresu');
    i = await purchase('c1', form());
    assert(J(i.replies.at(-1)).includes('czekające na płatność'), 'drugie zamówienie przy oczekującym → błąd');

    const copy = interaction('c1', { customId: `hs:copy:${GID}:${order.id}:amt` });
    await routeHosting(copy);
    assert(copy.replies[0].content === order.amount, 'przycisk „Skopiuj kwotę” daje czysty tekst');

    chain.ltcTxs = [{ txid: 'ltcwrong', vout: [{ scriptpubkey_address: LTC, value: Number(order.units) + 1 }], status: { confirmed: false } }];
    await tick();
    assert(order.status === 'waiting', 'inna kwota nie jest zaliczana');
    chain.ltcTxs.push({ txid: 'ltcgood', vout: [{ scriptpubkey_address: 'ltc1qinny', value: 5 }, { scriptpubkey_address: LTC, value: Number(order.units) }], status: { confirmed: false } });
    await tick();
    assert(order.status === 'seen' && order.txid === 'ltcgood' && order.confirmations === 0, 'wpłata wykryta w mempoolu');
    assert(dmEdits.at(-1)[1].includes('Płatność wykryta') && dmEdits.at(-1)[1].includes('0/2'), 'DM: 0/2 potwierdzeń');
    chain.ltcTxs[1].status = { confirmed: true, block_height: chain.ltcTip, block_time: Math.floor(Date.now() / 1000) };
    chain.ltcSpaceDown = true; // litecoinspace.org nie odpowiada (jak na serwerze Wojtka) → BlockCypher
    await tick();
    assert(ltcSources[ltcSource].name === 'BlockCypher', 'LTC: przełączenie na BlockCypher');
    assert(order.status === 'seen' && order.confirmations === 1, '1 potwierdzenie → jeszcze czekamy');
    chain.ltcTip++;
    await tick();
    assert(order.status === 'done' && order.serverId, `2 potwierdzenia → serwer utworzony (${order.status} ${order.lastError ?? ''})`);
    const s1 = panel.servers.find((s) => s.id === order.serverId);
    assert(s1.name === 'Node.js • Wojtek3509', 'domyślna nazwa serwera: język • nazwa klienta');
    const log1 = purchaseLogs.find((e) => e.json.includes(order.id));
    assert(purchaseLogs.filter((e) => e.json.includes(order.id)).length === 1 && log1.edits >= 4, `jedna wiadomość w logach na zamówienie, aktualizowana (${log1?.edits})`);
    assert(
      ['Zrealizowane', `#${order.serverId}`, 'ltcgood', 'Wpłata wykryta', 'Potwierdzona', '<@c1>', 'kurs 400.00 zł'].every((t) => log1.json.includes(t)),
      'log: status, klient, kurs, tx i oś czasu',
    );
    assert(s1.limits.memory === 256 && s1.limits.disk === 1024 && s1.limits.cpu === 25 && s1.limits.swap === 0, 'limity 256 MB / 1 GB / 25%');
    assert(s1.egg === 15 && s1.docker_image === 'ghcr.io/parkervcp/yolks:egg15' && s1.environment.MAIN_FILE === 'index.js' && s1.environment.NODE_PACKAGES === '', 'jajko Node.js z domyślnymi zmiennymi');
    assert(s1.deploy.locations[0] === 1 && s1.external_id === `tb-${order.id}`, 'automatyczny port (deploy) i external_id');
    const u1 = panel.users.find((u) => u.external_id === 'discord-c1');
    assert(u1 && u1.username === 'wojtek3509' && u1.email === 'jan@gmail.com', 'konto w panelu: nazwa z Discorda, e-mail z formularza');
    const credentials = dms.find(([id, p]) => id === 'c1' && J(p).includes('HOSTING GOTOWY'));
    assert(credentials && J(credentials[1]).includes('jan@gmail.com') && /\|\|`[\w-]{16}`\|\|/.test(J(credentials[1])), 'DM z loginem i hasłem (pod spoilerem)');
    assert(logs.some((l) => l.includes('Nowy hosting') && l.includes('automatycznie') && l.includes('ltcgood')), 'log zakupu');
    assert(roleAdds.some(([id, r]) => id === 'c1' && r === 'role-client'), 'rola klienta');
    const rec1 = g.hosting.servers[order.serverId];
    assert(rec1 && Math.abs(rec1.expiresAt - (Date.now() + 31 * DAY)) < 60_000, 'ważny 31 dni');
    const serversBefore = panel.servers.length;
    await fulfilOrder(client, GID, { ...order, id: order.id, status: 'paid', attempts: 0 });
    assert(panel.servers.length === serversBefore, 'ponowna próba nie tworzy drugiego serwera (external_id)');

    // 4. ETH: wpłata przez transakcję wewnętrzną (giełda), potwierdzenia liczone z numeru bloku.
    await purchase('c2', form({ payment: 'eth', lang: 'python', email: 'k2@wp.pl' }));
    order = lastOrder('c2');
    const tsNow = String(Math.floor(Date.now() / 1000));
    chain.ethTxs = [{ hash: '0xnormal', to: ETH.toLowerCase(), value: '1', isError: '0', txreceipt_status: '1', confirmations: '50', timeStamp: tsNow, blockNumber: '1' }];
    chain.ethInternal = [{ hash: '0xinternal', to: ETH.toLowerCase(), value: order.units, isError: '0', timeStamp: tsNow, blockNumber: String(chain.ethBlock) }];
    await tick();
    assert(order.status === 'seen' && order.confirmations === 1 && order.txid === '0xinternal:internal', 'ETH wewnętrzna: 1 potwierdzenie');
    chain.ethBlock++;
    ethTip.at = 0;
    await tick();
    assert(order.status === 'done', 'ETH: 2 potwierdzenia → serwer');
    const s2 = panel.servers.find((s) => s.id === order.serverId);
    assert(s2.name === 'Python • klient2', 'domyślna nazwa serwera: język • nazwa klienta');
    assert(s2.egg === 16 && s2.environment.PY_FILE === 'main.py', 'jajko Python');

    // 5. USDC (Ethereum) przez tokentx.
    await purchase('c3', form({ payment: 'usdc_eth', lang: 'java', email: 'c3@o2.pl' }));
    order = lastOrder('c3');
    chain.ethTokens = [{ hash: '0xtoken', logIndex: '7', to: ETH.toLowerCase(), value: order.units, contractAddress: cryptoCoins.usdc_eth.token, confirmations: '3', timeStamp: tsNow }];
    await tick();
    assert(order.status === 'done' && order.txid === '0xtoken:7', 'USDC ERC-20 → serwer');
    assert(panel.users.find((u) => u.external_id === 'discord-c3').username === 'klientc3', 'za krótka nazwa → klient<id>');

    // 6. Solana: SOL (confirmed → finalized) i USDC na koncie tokenu.
    delete g.hosting.servers[order.serverId];
    await purchase('c3', form({ payment: 'sol', lang: 'java', email: 'c3@o2.pl' }));
    order = lastOrder('c3');
    const blockTime = Math.floor(Date.now() / 1000);
    chain.solSigs[SOL] = [{ signature: 'solsig1', err: null, blockTime, confirmationStatus: 'confirmed' }];
    chain.solTxs.solsig1 = {
      meta: { err: null, preBalances: [5_000_000_000, 1_000], postBalances: [4_990_000_000, 1_000 + Number(order.units)], preTokenBalances: [], postTokenBalances: [] },
      transaction: { message: { accountKeys: [{ pubkey: 'Payer111' }, { pubkey: SOL }] } },
    };
    await tick();
    assert(order.status === 'seen' && order.confirmations === 1, 'SOL confirmed → czekamy na finalized');
    chain.solSigs[SOL][0].confirmationStatus = 'finalized';
    await tick();
    assert(order.status === 'done', 'SOL finalized → serwer (istniejące konto w panelu)');
    assert(dms.filter(([id, p]) => id === 'c3' && J(p).includes('to samo, co do Twojego konta')).length === 1, 'istniejące konto: bez nowego hasła');

    await purchase('c2', form({ payment: 'usdc_sol', lang: 'nodejs' }));
    order = lastOrder('c2');
    chain.solSigs[SOL_ATA] = [{ signature: 'solsig2', err: null, blockTime, confirmationStatus: 'finalized' }];
    chain.solTxs.solsig2 = {
      meta: {
        err: null,
        preBalances: [1, 2],
        postBalances: [1, 2],
        preTokenBalances: [{ accountIndex: 1, mint: cryptoCoins.usdc_sol.token, owner: SOL, uiTokenAmount: { amount: '1000000' } }],
        postTokenBalances: [{ accountIndex: 1, mint: cryptoCoins.usdc_sol.token, owner: SOL, uiTokenAmount: { amount: String(1_000_000 + Number(order.units)) } }],
      },
      transaction: { message: { accountKeys: ['Payer222', SOL_ATA] } },
    };
    await tick();
    assert(order.status === 'done' && order.txid === 'solsig2:usdc', 'USDC (Solana) → serwer');

    // 7. Wygasłe i anulowane zamówienia, zamknięte DM.
    await purchase('c1', form({ payment: 'ltc' }));
    order = lastOrder('c1');
    order.expiresAt = Date.now() - 6 * 60_000;
    await tick();
    assert(order.status === 'expired' && dmEdits.at(-1)[1].includes('Czas na płatność minął'), 'zamówienie wygasa po 30 min (+5 min zapasu)');
    assert(purchaseLogs.find((e) => e.json.includes(order.id)).json.includes('Wygasło'), 'log: wygasło');
    await purchase('c1', form({ payment: 'sol' }));
    order = lastOrder('c1');
    const cancel = interaction('c1', { customId: `hs:cancel:${GID}:${order.id}` });
    await routeHosting(cancel);
    assert(order.status === 'cancelled' && J(cancel.replies[0]).includes('anulowane'), 'anulowanie zamówienia');
    assert(purchaseLogs.find((e) => e.json.includes(order.id)).json.includes('Anulowane przez klienta'), 'log: anulowane');
    const other = interaction('c2', { customId: `hs:cancel:${GID}:${order.id}` });
    await routeHosting(other);
    assert(J(other.replies[0]).includes('Nie znaleziono'), 'cudzego zamówienia nie można anulować');
    i = await purchase('closed', form({ email: 'z@z.pl' }));
    assert(J(i.replies.at(-1)).includes('wiadomości prywatnej') && lastOrder('closed').status === 'cancelled', 'zamknięte DM → zamówienie anulowane');
    i = await purchase('c4', form({ email: 'jan@gmail.com' }));
    assert(J(i.replies.at(-1)).includes('ma już konto'), 'e-mail innej osoby → błąd przed płatnością');

    // 7b. Zmiana nazwy serwera (przycisk w DM i w /moj-hosting).
    assert(J(credentials[1]).includes(`hs:rename:${GID}:${order.serverId ?? ''}`.split(':').slice(0, 3).join(':')), 'DM z danymi ma przycisk „Zmień nazwę”');
    const recRename = Object.values(g.hosting.servers).find((r) => r.userId === 'c1');
    const renameBtn = interaction('c1', { customId: `hs:rename:${GID}:${recRename.id}` });
    await routeHosting(renameBtn);
    assert(JSON.stringify(renameBtn.modal.toJSON()).includes('Node.js • Wojtek3509'), 'formularz nazwy z obecną nazwą');
    const renameSubmit = interaction('c1', {
      customId: `hs:renamesubmit:${GID}:${recRename.id}`,
      isButton: () => false,
      isModalSubmit: () => true,
      fields: { getTextInputValue: () => '  Bot  Sklepu  ' },
    });
    await routeHosting(renameSubmit);
    const renamed = panel.servers.find((s) => s.id === recRename.id);
    assert(recRename.name === 'Bot Sklepu' && renamed.name === 'Bot Sklepu' && renamed.lastDetails.user === renamed.user && renamed.lastDetails.external_id === renamed.external_id, 'nazwa zmieniona w panelu (właściciel i external_id bez zmian)');
    const renameStranger = interaction('c2', { customId: `hs:rename:${GID}:${recRename.id}` });
    await routeHosting(renameStranger);
    assert(!renameStranger.modal && J(renameStranger.replies[0]).includes('nie jest Twój'), 'cudzej nazwy nie można zmienić');

    // 8. Terminy: przypomnienia, blokada, powiadomienie o usunięciu.
    const dmCount = () => dms.filter(([id]) => id === 'c1').length;
    rec1.expiresAt = Date.now() + 2 * DAY;
    let before = dmCount();
    await checkExpirations(client, GID);
    assert(dmCount() === before + 1 && J(dms.at(-1)[1]).includes('WKRÓTCE WYGAŚNIE') && rec1.reminded.includes(3), `przypomnienie 3 dni przed (${dmCount() - before} ${J(dms.at(-1)[1]).slice(0, 200)} ${rec1.reminded})`);
    await checkExpirations(client, GID);
    assert(dmCount() === before + 1, 'przypomnienie tylko raz');
    rec1.expiresAt = Date.now() + 12 * 3600_000;
    await checkExpirations(client, GID);
    assert(dmCount() === before + 2 && rec1.reminded.includes(1), 'przypomnienie 1 dzień przed');
    rec1.expiresAt = Date.now() - 1000;
    await checkExpirations(client, GID);
    assert(rec1.suspended && panel.servers.find((s) => s.id === rec1.id).suspended, 'po terminie serwer zablokowany w panelu');
    assert(J(dms.at(-1)[1]).includes('ZABLOKOWANY') && J(dms.at(-1)[1]).includes(`hs:renew:${GID}:${rec1.id}`), 'DM o blokadzie z przyciskiem przedłużenia');
    assert(logs.some((l) => l.includes('Hosting zablokowany')), 'log blokady');
    rec1.suspendedAt = Date.now() - 8 * DAY;
    await checkExpirations(client, GID);
    assert(rec1.deleteNotified && logs.some((l) => l.includes('Serwer można usunąć')), 'po 7 dniach: powiadomienie, że można usunąć');
    assert(panel.servers.some((s) => s.id === rec1.id), 'bot sam nie usuwa serwera');

    // 9. Przedłużenie automatyczne z DM: odblokowanie + start.
    const renewBtn = interaction('c1', { customId: `hs:renew:${GID}:${rec1.id}` });
    await routeHosting(renewBtn);
    assert(renewBtn.modal && JSON.stringify(renewBtn.modal.toJSON()).includes(`hs:renewsubmit:${GID}:${rec1.id}`), 'przycisk „Przedłuż” otwiera formularz');
    const renewSubmit = interaction('c1', {
      customId: `hs:renewsubmit:${GID}:${rec1.id}`,
      isButton: () => false,
      isModalSubmit: () => true,
      fields: { getStringSelectValues: (id) => [{ period: '3m', mode: 'auto', payment: 'ltc' }[id]] },
    });
    await routeHosting(renewSubmit);
    order = lastOrder('c1');
    assert(order.status === 'waiting' && order.renew === String(rec1.id) && order.pln === 14, 'zamówienie przedłużenia (3 miesiące, 14 zł)');
    chain.ltcTxs.push({ txid: 'ltcrenew', vout: [{ scriptpubkey_address: LTC, value: Number(order.units) }], status: { confirmed: true, block_height: chain.ltcTip - 1, block_time: blockTime } });
    await tick();
    assert(order.status === 'done', 'przedłużenie opłacone');
    assert(!rec1.suspended && !panel.servers.find((s) => s.id === rec1.id).suspended, 'serwer odblokowany');
    assert(Math.abs(rec1.expiresAt - (Date.now() + 93 * DAY)) < 60_000 && rec1.reminded.length === 0, '+93 dni od dziś');
    assert(panel.power.some(([id, sig]) => id === rec1.identifier && sig === 'start'), 'serwer uruchomiony po odblokowaniu');
    assert(J(dms.at(-1)[1]).includes('PRZEDŁUŻONY') && J(dms.at(-1)[1]).includes('uruchomiony'), 'DM o przedłużeniu');
    const stranger = interaction('c2', { customId: `hs:renew:${GID}:${rec1.id}` });
    await routeHosting(stranger);
    assert(!stranger.modal && J(stranger.replies[0]).includes('nie jest Twój'), 'cudzego serwera nie można przedłużyć');

    // 10. Zakup ręczny: staff klika „Potwierdź płatność” w tickecie.
    g.tickets.hticket = {
      channelId: 'hticket',
      guildId: GID,
      number: 50,
      type: 'hosting',
      userId: 'c2',
      openedAt: Date.now(),
      messageId: 'card',
      form: { lang: 'java', period: '12m', mode: 'manual', payment: 'blik', email: 'k2@wp.pl' },
    };
    const cardJson = J({ components: [ticketMessage(g.tickets.hticket, users.c2)] });
    assert(cardJson.includes('hs:confirm') && cardJson.includes('Potwierdź płatność i utwórz serwer'), 'karta ticketu z przyciskiem potwierdzenia');
    assert(J({ components: [manualPaymentView(g.tickets.hticket.form)] }).includes('Numer BLIK: 123 456 789'), 'dane BLIK z config.json');
    const byClient = interaction('c2', { customId: 'hs:confirm' });
    await routeHosting(byClient);
    assert(J(byClient.replies[0]).includes('Tylko admin'), 'klient nie potwierdzi sam');
    const confirm = interaction('staff', { customId: 'hs:confirm' });
    await routeHosting(confirm);
    const t = g.tickets.hticket;
    assert(t.hostingServerId && J(confirm.replies.at(-1)).includes('Serwer utworzony'), `serwer z ticketu (${J(confirm.replies.at(-1)).slice(0, 300)})`);
    const s3 = panel.servers.find((s) => s.id === t.hostingServerId);
    assert(s3.egg === 17 && s3.environment.JARFILE === 'bot.jar' && s3.external_id === 'tb-t-hticket', 'jajko Java, external_id ticketu');
    assert(Math.abs(g.hosting.servers[s3.id].expiresAt - (Date.now() + 365 * DAY)) < 60_000, '1 rok = 365 dni');
    assert(t.deal.product === 'Hosting 1 rok' && t.deal.price === '50 zł' && t.deal.payment === 'blik' && t.awaitingRep, 'dane do voucha');
    assert(channelSends.some((p) => J(p).includes('+rep')), 'prośba o voucha w tickecie');
    assert(!J(channelSends.find((p) => p[0] === 'card')[1]).includes('hs:confirm'), 'przycisk potwierdzenia znika po utworzeniu');
    const again = interaction('staff', { customId: 'hs:confirm' });
    await routeHosting(again);
    assert(J(again.replies[0]).includes('już aktywny'), 'drugie potwierdzenie nic nie tworzy');

    // 11. /hosting limity, zablokuj, odblokuj, usun, lista, /moj-hosting.
    const cmd = (sub, opts = {}) =>
      interaction('staff', {
        options: {
          getSubcommand: () => sub,
          getInteger: (n) => opts[n] ?? null,
          getString: (n) => opts[n] ?? null,
          getUser: (n) => (opts[n] ? users[opts[n]] : null),
          getBoolean: (n) => opts[n] ?? null,
        },
      });
    let c = cmd('limity', { serwer: s3.id, ram: 512 });
    await commands.get('hosting').execute(c);
    assert(s3.lastBuild.memory === 512 && s3.lastBuild.disk === 1024 && s3.lastBuild.allocation === s3.allocation && s3.lastBuild.feature_limits.backups === 1, 'limity: RAM 512, reszta bez zmian');
    c = cmd('zablokuj', { serwer: s3.id });
    await commands.get('hosting').execute(c);
    assert(s3.suspended && g.hosting.servers[s3.id].suspended, '/hosting zablokuj');
    c = cmd('odblokuj', { serwer: s3.id });
    await commands.get('hosting').execute(c);
    assert(!s3.suspended && !g.hosting.servers[s3.id].suspended, '/hosting odblokuj');
    c = cmd('przedluz', { serwer: s3.id, dni: 10 });
    await commands.get('hosting').execute(c);
    assert(Math.abs(g.hosting.servers[s3.id].expiresAt - (Date.now() + 375 * DAY)) < 60_000, '/hosting przedluz dolicza do końca okresu');
    c = cmd('dodaj', { uzytkownik: 'c1', serwer: s2.id, dni: 5, jezyk: 'python' });
    await commands.get('hosting').execute(c);
    assert(g.hosting.servers[s2.id].userId === 'c1' && g.hosting.servers[s2.id].lang === 'python', '/hosting dodaj');
    c = cmd('usun', { serwer: s2.id, potwierdz: false });
    await commands.get('hosting').execute(c);
    assert(panel.servers.some((s) => s.id === s2.id), 'usunięcie bez potwierdzenia nic nie robi');
    c = cmd('usun', { serwer: s2.id, potwierdz: true });
    await commands.get('hosting').execute(c);
    assert(!panel.servers.some((s) => s.id === s2.id) && g.hosting.servers[s2.id].deleted, '/hosting usun');
    c = cmd('utworz', { uzytkownik: 'c2', jezyk: 'nodejs', okres: '1m', email: 'k2@wp.pl' });
    await commands.get('hosting').execute(c);
    assert(J(c.replies.at(-1)).includes('Utworzono serwer'), '/hosting utworz');
    c = cmd('lista');
    await commands.get('hosting').execute(c);
    assert(J(c.replies[0]).includes('SERWERY KLIENTÓW') === false && J(c.replies[0]).includes('Serwery klientów'), '/hosting lista');
    c = interaction('c1');
    await commands.get('moj-hosting').execute(c);
    assert(J(c.replies[0]).includes(`hs:renew:${GID}:${rec1.id}`) && J(c.replies[0]).includes(`hs:rename:${GID}:${rec1.id}`) && !J(c.replies[0]).includes(`#${s3.id}`), '/moj-hosting: tylko własne serwery, przedłuż i zmień nazwę');
    c = cmd('logi', { kanal: 'nowe-logi' });
    c.options.getChannel = () => ({ id: 'nowe-logi', toString: () => '<#nowe-logi>' });
    await commands.get('hosting').execute(c);
    assert(g.settings.purchaseLogChannelId === 'nowe-logi', '/hosting logi ustawia kanał');

    // 12. Błąd panelu → ponawianie, a potem powiadomienie admina.
    await purchase('c1', form({ payment: 'ltc', lang: 'java' }));
    order = lastOrder('c1');
    const savedEggs = hostingConfig.eggs;
    hostingConfig.eggs = { ...savedEggs, java: undefined };
    eggCache.clear();
    order.status = 'paid';
    order.txid = 'ltcx';
    await tick();
    assert(order.status === 'failed' && logs.at(-1).includes('nie zostało zrealizowane') && logs.at(-1).includes('/hosting utworz'), 'brak jajka → admin dostaje powiadomienie');
    hostingConfig.eggs = savedEggs;

    // 13. /hosting test.
    const diag = await hostingDiagnostics();
    assert(diag.length === 10 && diag.every((l) => l.startsWith('✅')), `diagnostyka: wszystko OK\n${diag.join('\n')}`);
  } finally {
    hostingConfig = savedConfig;
    httpFetch = savedFetch;
    hostingDelay = savedDelay;
    eggCache.clear();
    priceCache = { at: 0, data: {} };
    delete store.guilds[GID];
  }
  console.log('✅ Test hostingu: zakup krypto (LTC, ETH, USDC, SOL), ręczny, terminy, blokada, przedłużenie, komendy OK');
}

// ═══ START ═════════════════════════════════════════════════════════════

if (process.argv.includes('--check')) {
  selfTest();
  await flowTest();
  await generatorTest();
  await registerTest();
  await welcomeTest();
  await autoLcTest();
  databaseTest();
  await boostTest();
  await hostingTest();
  process.exit(0);
}

// Token i ID serwera: config.json obok index.js albo zmienne środowiskowe (DISCORD_TOKEN, GUILD_ID).
const configFile = join(dirname(fileURLToPath(import.meta.url)), 'config.json');
const fileConfig = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || fileConfig.token;
const GUILD_ID = process.env.GUILD_ID || fileConfig.guildId;
hostingConfig = fileConfig.hosting ?? {};
if (!DISCORD_TOKEN || DISCORD_TOKEN === 'TUTAJ_WKLEJ_TOKEN') {
  console.error('Brak tokena. Wpisz go w config.json w polu "token" (albo ustaw DISCORD_TOKEN).');
  process.exit(1);
}


async function onReady(ready) {
  console.log(`✅ Zalogowano jako ${ready.user.tag}`);
  console.log(`🔗 Link zaproszenia: ${inviteUrl(ready.user.id)}`);
  console.log(`🏠 Serwery: ${ready.guilds.cache.map((g) => `${g.name} (${g.id})`).join(', ') || 'brak — zaproś bota linkiem powyżej'}`);
  if (!messageContentOn) {
    console.warn('⚠️ „Message Content Intent” jest wyłączony — bot nie sprawdzi „+rep”, tylko oznaczenie sprzedawcy. Włącz go w Developer Portal → Bot.');
  }
  if (!membersIntentOn) {
    console.warn('⚠️ „Server Members Intent” jest wyłączony — powitania i zaproszenia nie działają. Włącz go w Developer Portal → Bot i zrestartuj bota.');
  }
  for (const g of ready.guilds.cache.values()) {
    if (!(await cacheInvites(g))) console.warn(`⚠️ ${g.name}: bot nie ma uprawnienia „Zarządzanie serwerem”, więc nie ustali, kto kogo zaprosił.`);
    // Pełna lista członków w pamięci — dzięki temu bot widzi moment, w którym ktoś zaczyna boostować.
    if (membersIntentOn) await g.members.fetch().catch((err) => console.warn(`⚠️ ${g.name}: nie pobrano listy członków (${err.message}).`));
    if (!guild(g.id).settings.boostChannelId) console.warn(`⚠️ ${g.name}: brak kanału boostów — podziękowania za boosty są wyłączone (/setup boosty:#kanał).`);
  }
  ready.user.setActivity({ name: `${brand.emoji} ${brand.name} • tanie boty Discord`, type: ActivityType.Custom });
  if (!loopsStarted) {
    loopsStarted = true;
    giveawayTicker(ready);
    counterLoop(ready);
    hostingLoop(ready);
  }
  if (hostingReady()) {
    const coins = Object.keys(cryptoCoins).filter(walletFor);
    console.log(`🖥️ Hosting: panel ${panelUrl()} • automatyczny zakup: ${coins.length ? coins.map((k) => cryptoCoins[k].label + (k.includes('_') ? `/${cryptoCoins[k].network.split(' ')[0]}` : '')).join(', ') : 'brak portfeli'}`);
  } else {
    console.warn('⚠️ Hosting: brak konfiguracji panelu (config.json → hosting) — działa tylko zakup ręczny bez tworzenia serwerów.');
  }

  let guildId = GUILD_ID;
  if (guildId === ready.user.id) {
    console.warn('⚠️ guildId to ID bota, a nie serwera. Kliknij PPM na ikonę serwera → „Kopiuj ID serwera”.');
    guildId = null;
  }
  const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
  await registerCommands(new REST().setToken(DISCORD_TOKEN), ready.user.id, guildId, [...ready.guilds.cache.keys()], body).catch((err) =>
    console.error('Rejestracja komend nie powiodła się:', err.message),
  );
}

const isDisallowedIntents = (err) => err?.code === 4014 || /disallowed|privileged intent/i.test(String(err?.message));

// Kolejne próby logowania, gdy uprzywilejowane intenty nie są włączone w Developer Portal.
const intentAttempts = [
  { content: true, members: true },
  { content: false, members: true },
  { content: true, members: false },
  { content: false, members: false },
];

function start(attempt = 0) {
  const { content, members } = intentAttempts[attempt];
  messageContentOn = content;
  membersIntentOn = members;
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildInvites];
  if (content) intents.push(GatewayIntentBits.MessageContent);
  if (members) intents.push(GatewayIntentBits.GuildMembers);
  botClient = new Client({ intents, partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember] });

  botClient.once(Events.ClientReady, onReady);
  botClient.on(Events.InteractionCreate, onInteraction);
  botClient.on(Events.MessageCreate, (m) => onMessage(m).catch(console.error));
  botClient.on(Events.MessageReactionAdd, (r, u) => onLegitReaction(r, u, true).catch(console.error));
  botClient.on(Events.MessageReactionRemove, (r, u) => onLegitReaction(r, u, false).catch(console.error));
  botClient.on(Events.MessageReactionRemoveAll, (m) => onLegitReactionsCleared(m).catch(console.error));
  botClient.on(Events.MessageReactionRemoveEmoji, (r) => onLegitReactionsCleared(r.message).catch(console.error));
  botClient.on(Events.MessageDelete, (m) => onMessageDeleted(m).catch(console.error));
  botClient.on(Events.MessageBulkDelete, async (msgs) => {
    for (const m of msgs.values()) await onMessageDeleted(m).catch(console.error);
  });
  botClient.on(Events.ChannelDelete, (ch) => onChannelDeleted(ch).catch(console.error));
  botClient.on(Events.InviteCreate, (inv) => inviteCache.get(inv.guild?.id)?.set(inv.code, inv.uses ?? 0));
  botClient.on(Events.InviteDelete, (inv) => inviteCache.get(inv.guild?.id)?.delete(inv.code));
  botClient.on(Events.GuildCreate, (g) => cacheInvites(g));
  if (members) {
    botClient.on(Events.GuildMemberAdd, (m) => onMemberAdd(m).catch(console.error));
    botClient.on(Events.GuildMemberRemove, (m) => onMemberRemove(m));
    botClient.on(Events.GuildMemberUpdate, (a, b) => onMemberUpdate(a, b).catch(console.error));
  }

  let switched = false;
  const fallback = () => {
    if (switched || attempt + 1 >= intentAttempts.length) return;
    switched = true;
    console.warn('⚠️ Część uprzywilejowanych intentów nie jest włączona w Developer Portal — próbuję uruchomić bota bez nich.');
    botClient.destroy();
    start(attempt + 1);
  };
  botClient.on(Events.ShardDisconnect, (ev) => ev?.code === 4014 && fallback());
  botClient.login(DISCORD_TOKEN).catch((err) => {
    if (isDisallowedIntents(err) || switched) return fallback();
    console.error('Logowanie nie powiodło się:', err.message);
    process.exit(1);
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flush();
    botClient?.destroy();
    process.exit(0);
  });
}

start();
