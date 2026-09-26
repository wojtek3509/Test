// TanieBoty — bot Discord dla sklepu z botami, cały w jednym pliku (Components V2).
// Uruchomienie: npm install && node index.js   (sprawdzenie offline: node index.js --check)
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActivityType,
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
};

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

// Kategorie ticketów (maks. 25). "fields" to pola formularza (maks. 5).
const ticketTypes = {
  bot: {
    label: 'Bot discord',
    emoji: '💻',
    description: 'Kliknij, aby zamówić bota discord.',
    prefix: 'bot',
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
    prefix: 'hosting',
    order: true,
    fields: [
      { id: 'bot', label: 'Jaki bot? (język / biblioteka)', placeholder: 'np. discord.js, Python' },
      {
        id: 'period',
        label: 'Okres hostingu',
        select: [
          ['1 miesiąc', '1m'],
          ['3 miesiące', '3m'],
          ['6 miesięcy', '6m'],
          ['12 miesięcy', '12m'],
        ],
      },
      { id: 'notes', label: 'Uwagi', style: 'long', required: false },
    ],
  },
  question: {
    label: 'Pytanie',
    emoji: '❓',
    description: 'Kliknij, aby zadać nam pytanie.',
    prefix: 'pytanie',
    fields: [{ id: 'question', label: 'Twoje pytanie', style: 'long' }],
  },
  partner: {
    label: 'Współpraca',
    emoji: '🤝',
    description: 'Kliknij, aby zaproponować współpracę.',
    prefix: 'wspolpraca',
    fields: [
      { id: 'server', label: 'Link do serwera / strony', required: false },
      { id: 'offer', label: 'Twoja propozycja', style: 'long' },
    ],
  },
};

// Regulamin: sekcje wybierane z menu.
const rules = [
  {
    title: 'Postanowienia ogólne',
    points: [
      'Serwer **TanieBoty** zajmuje się tworzeniem i hostingiem botów Discord.',
      'Składając zamówienie, akceptujesz niniejszy regulamin.',
      'Obowiązuje kultura osobista — obrażanie, spam i scam kończą się banem.',
      'Administracja może zmienić regulamin; zmiany ogłaszamy na serwerze.',
    ],
  },
  {
    title: 'Polityka zwrotów',
    points: [
      'Zwrot jest możliwy, **dopóki prace nad botem się nie rozpoczęły**.',
      'Po rozpoczęciu prac zwracamy część kwoty proporcjonalną do niewykonanej pracy.',
      'Gotowy i przekazany bot nie podlega zwrotowi.',
      'Za niedziałający hosting z naszej winy zwracamy środki za niewykorzystany okres.',
    ],
  },
  {
    title: 'Polityka zamówień',
    points: [
      'Zamówienia składasz wyłącznie przez **ticket**.',
      'Przed startem ustalamy funkcje, cenę i termin — to jest wiążąca wycena.',
      'Dodatkowe funkcje spoza wyceny są płatne osobno.',
      'Po oddaniu bota masz **7 dni** na zgłoszenie błędów, które poprawiamy za darmo.',
    ],
  },
  {
    title: 'Polityka płatności',
    points: [
      'Akceptujemy: BLIK, przelew, PayPal, PSC i krypto.',
      'Przy większych zamówieniach pobieramy **zaliczkę 50%**.',
      'Hosting opłacasz z góry za wybrany okres.',
      'Płatności przyjmuje wyłącznie administracja — **nigdy nie płać w DM osobom spoza staffu**.',
    ],
  },
];

// Cennik (/panel typ:cennik).
const pricing = [
  {
    emoji: '🤖',
    title: 'Boty Discord',
    items: [
      ['Bot z ticketami', 'od 25 PLN'],
      ['Bot weryfikacyjny', 'od 20 PLN'],
      ['Bot z konkursami', 'od 25 PLN'],
      ['Bot „wszystko w jednym”', 'od 60 PLN'],
      ['Bot na zamówienie', 'wycena indywidualna'],
    ],
  },
  {
    emoji: '🖥️',
    title: 'Hosting',
    items: [
      ['1 miesiąc', '5 PLN'],
      ['3 miesiące', '13 PLN'],
      ['12 miesięcy', '45 PLN'],
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
};
const paymentName = (key) => (payments[key] ? `${payments[key].emoji} ${payments[key].label}` : key);

// Przykładowe vouche pokazywane na kanale legit checków (panel „Jak napisać voucha?”).
const vouchExamples = ['+rep @sprzedawca Bot discord [ 30 PLN ] [ BLIK ]', '+rep @sprzedawca Hosting 3 miesiące [ 13 PLN ] [ PAYPAL ]'];

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

// „Czy legit?”: reakcja ❌ jest zawsze usuwana, a autor dostaje przerwę (dni, 0 = bez przerwy, maks. 28).
// Staff i admini nie dostają przerwy (Discord i tak nie pozwala wyciszyć właściciela ani administratorów).
const legitTimeoutDays = 7;
// Nazwy kanałów z licznikiem ({n} = liczba). Aktualizowane co 10 minut (limit Discorda).
const counterNames = {
  legit: '🤔┃czy-legit→{n}',
  legitCheck: '✅┃legit-check→{n}',
  reviews: '⭐┃opinie→{n}',
};

// Układ serwera tworzony przez /generuj.
// mode: 'readonly' = tylko czytanie (piszą Administracja i Staff), 'reactions' = bez pisania, z reakcjami,
//       'open' = wszyscy piszą, 'voice' = kanał głosowy.
// counter: nazwa z licznikiem z counterNames. panel: panel wysyłany na kanał. setting: pole w /setup.
const serverLayout = {
  categoryName: (emoji, name) => `━━ ${emoji} ${name} ━━`,
  channelName: (emoji, name) => `${emoji}┃${name}`,
  roles: {
    admin: { name: '👑 Administracja', color: 0xe74c3c, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
    staff: { name: '🛡️ Staff', color: 0x3498db, hoist: true, permissions: [] },
    client: { name: '💎 Klient', color: 0x9b59b6, hoist: true, permissions: [] },
    verified: { name: '✅ Zweryfikowany', color: 0x2ecc71, hoist: false, permissions: [] },
  },
  categories: [
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
    // Tu bot tworzy kanały ticketów — widoczne tylko dla Administracji i Staffu (+ autora ticketu).
    { emoji: '📂', name: 'OTWARTE TICKETY', private: true, setting: 'categoryId', channels: [] },
    {
      emoji: '🛡️',
      name: 'ADMINISTRACJA',
      private: true,
      channels: [
        { emoji: '📁', name: 'logi', mode: 'open', setting: 'logChannelId' },
        { emoji: '💬', name: 'staff-czat', mode: 'open', report: true },
      ],
    },
  ],
};

// ═══ BAZA DANYCH (data/db.json) ════════════════════════════════════════

const dbFile = join(dirname(fileURLToPath(import.meta.url)), 'data', 'db.json');
let store = { guilds: {} };
if (existsSync(dbFile)) store = JSON.parse(readFileSync(dbFile, 'utf8'));

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}
function flush() {
  clearTimeout(saveTimer);
  mkdirSync(dirname(dbFile), { recursive: true });
  writeFileSync(`${dbFile}.tmp`, JSON.stringify(store, null, 2));
  renameSync(`${dbFile}.tmp`, dbFile);
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
  return g;
}

function updateGuild(id, fn) {
  const g = guild(id);
  fn(g);
  save();
  return g;
}

const getTicket = (guildId, channelId) => guild(guildId).tickets[channelId] ?? null;
const openTicketsOf = (guildId, userId) => Object.values(guild(guildId).tickets).filter((t) => t.userId === userId && !t.closedAt);

// ═══ STAN BOTA ═════════════════════════════════════════════════════════

// „Message Content Intent” (Developer Portal → Bot) pozwala sprawdzić, czy rep zaczyna się od „+rep”.
// Jeśli nie jest włączony, bot i tak wystartuje — wtedy rep musi tylko oznaczać sprzedawcę.
let messageContentOn = true;
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

/** Tytuł w ramce: # `🤖 TanieBoty × TEKST`. Własne emoji stoi przed ramką (w kodzie się nie wyświetla). */
function title(text, emoji = brand.emoji) {
  const body = `${brand.name} ${x} ${upper(text)}`;
  return emoji.startsWith('<') ? `# ${emoji} \`${body}\`` : `# \`${emoji} ${body}\``;
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

const box = (color = colors.brand) => new ContainerBuilder().setAccentColor(color);
const notice = (content, color = colors.brand) => text(box(color), content);
const ok = (content) => notice(`### ✅ ${content}`, colors.success);
const fail = (content) => notice(`### ❌ ${x} ${content}`, colors.danger);

/** Obrazek do nagłówków: ikona serwera, a gdy jej brak — avatar bota. */
const logoOf = (g, client) => g?.iconURL?.({ size: 256 }) ?? client?.user?.displayAvatarURL?.({ size: 256 }) ?? null;

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
  banner(b, g.settings.banners.tickety);
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
  header(b, [title('Regulamin', '📜'), '>>> ' + rules.map((r, i) => `**§${i + 1}. ${r.title}.**`).join('\n')].join('\n'), logo);
  text(b, `> -# Korzystając z serwera, akceptujesz regulamin. Ostatnia aktualizacja: ${ts(Date.now(), 'D')}`);
  banner(b, g.settings.banners.regulamin);
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(
      new StringSelectMenuBuilder()
        .setCustomId('rules:show')
        .setPlaceholder(placeholderNone)
        .addOptions(
          rules.map((rule, idx) => ({ label: `§${idx + 1}. ${rule.title}`, value: String(idx), description: 'Kliknij, aby wyświetlić tą sekcję regulaminu.', emoji: '📄' })),
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

function rulesSection(index) {
  const r = rules[index];
  const b = box();
  text(b, title(`§${index + 1}. ${r.title}`, '📜'));
  sep(b);
  text(b, '>>> ' + r.points.map((p, i) => `\`${index + 1}.${i + 1}\` ${p}`).join('\n'));
  sep(b);
  footer(b);
  return b;
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
  banner(b, g.settings.banners.opinie);
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

function legitPanel(logo) {
  const b = box();
  header(
    b,
    [
      title('Czy legit?', '🤔'),
      `## ❓ Czy nasz serwer __${brand.name}__ jest LEGIT?`,
      `- ✅ Jeżeli uważasz, że __**TAK**__ zaznacz reakcję ✅ poniżej!`,
      `- ❌ Jeżeli uważasz, że __**NIE**__ zaznacz reakcję ❌ poniżej!`,
    ].join('\n'),
    logo,
  );
  if (legitTimeoutDays > 0) {
    text(b, `> -# Zaznaczenie reakcji ❌ bez dowodu skutkuje **automatyczną przerwą na ${legitTimeoutDays} dni!** Dowody zgłaszaj w tickecie.`);
  }
  sep(b);
  footer(b);
  return b;
}

function pricingPanel(g, logo) {
  const b = box();
  header(b, [title('Cennik', '💰'), `>>> ${point('Poniżej znajdziesz **orientacyjne ceny** naszych usług.')}\n${point('Dokładną wycenę dostaniesz w **tickecie**.')}`].join('\n'), logo);
  for (const cat of pricing) {
    sep(b);
    text(b, [`### ${cat.emoji} ${x} ${cat.title}`, ...cat.items.map(([name, price]) => row(name, `\`${price}\``))].join('\n'));
  }
  banner(b, g.settings.banners.cennik);
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(
      new ButtonBuilder().setCustomId('tk:quick:bot').setLabel('Zamów bota').setEmoji('💻').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tk:quick:hosting').setLabel('Kup hosting').setEmoji('🖥️').setStyle(ButtonStyle.Secondary),
    ),
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
  if (gw.image) banner(b, gw.image);
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

function boostView(member, count, tier) {
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
          .setMaxLength(f.style === 'long' ? 1000 : 100);
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
  text(b, [`### ${t.emoji} ${x} ${t.label}`, ...answers].join('\n'));
  sep(b);
  b.addActionRowComponents((r) =>
    r.setComponents(
      new ButtonBuilder().setCustomId('tk:close').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    ),
  );
  sep(b);
  footer(b);
  return b;
}

const transcriptName = (ticket) => `transcript-${String(ticket.number).padStart(4, '0')}.html`;
// Podmieniane w teście offline.
let makeTranscript = (channel, ticket) => createTranscript(channel, { filename: transcriptName(ticket), poweredBy: false, saveImages: true });

/** Kto zdecydował o wyniku: osoba, która kliknęła „Zrealizowane” / „Niezrealizowane” (albo klient, jeśli sam zamknął). */
function closerRow(ticket) {
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
          row('Wynik', ticket.result === 'done' ? '✅ **Zrealizowane**' : '❌ **Niezrealizowane**'),
          row('Autor', `<@${ticket.userId}>`),
          row('Kategoria', `${t.emoji} ${t.label}`),
          closerRow(ticket),
          ticket.deal ? row('Sprzedawca', `<@${ticket.deal.sellerId}>`) : null,
          ticket.deal ? row('Produkt', `\`${ticket.deal.product}\``) : null,
          ticket.deal ? row('Cena', `\`${ticket.deal.price}\``) : null,
          ticket.deal ? row('Płatność', paymentName(ticket.deal.payment)) : null,
          ticket.lcUrl ? row('Legit check', ticket.lcUrl) : null,
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

async function onTicketSelect(i, type) {
  const { settings } = guild(i.guildId);
  if (!settings.categoryId) return replyV2(i, fail('Bot nie jest skonfigurowany. Administrator musi użyć `/setup`.'));
  const open = openTicketsOf(i.guildId, i.user.id);
  if (open.length >= settings.maxOpen) return replyV2(i, fail(`Masz już otwarty ticket: ${open.map((t) => `<#${t.channelId}>`).join(', ')}`));
  await i.showModal(ticketModal(type));
}

async function onTicketForm(i, type) {
  const g = guild(i.guildId);
  const { settings } = g;
  if (openTicketsOf(i.guildId, i.user.id).length >= settings.maxOpen) return replyV2(i, fail('Osiągnięto limit otwartych ticketów.'));

  const form = {};
  for (const f of ticketTypes[type].fields) {
    form[f.id] = f.select ? (i.fields.getStringSelectValues(f.id)[0] ?? null) : i.fields.getTextInputValue(f.id) || null;
  }

  await i.deferReply({ flags: V2_EPHEMERAL });
  const number = updateGuild(i.guildId, (gg) => gg.counter++).counter;
  const t = ticketTypes[type];
  const allowUser = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  const overwrites = [
    { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: i.user.id, allow: allowUser },
    { id: i.client.user.id, allow: [...allowUser, PermissionFlagsBits.ManageChannels] },
  ];
  if (settings.staffRoleId) overwrites.push({ id: settings.staffRoleId, allow: [...allowUser, PermissionFlagsBits.ManageMessages] });

  let channel;
  try {
    channel = await i.guild.channels.create({
      name: `${t.prefix}-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: settings.categoryId,
      topic: `${t.emoji} ${t.label} • ${i.user.tag} (${i.user.id})`,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    console.error(err);
    return i.editReply({ components: [fail('Nie udało się utworzyć kanału. Sprawdź uprawnienia bota i kategorię w `/setup`.')], flags: V2 });
  }

  const ticket = { channelId: channel.id, number, type, userId: i.user.id, openedAt: Date.now(), form };
  const message = await channel.send({ components: [ticketMessage(ticket, i.user)], flags: V2, allowedMentions: { parse: [] } });
  ticket.messageId = message.id;
  await message.pin().catch(() => {});
  updateGuild(i.guildId, (gg) => {
    gg.tickets[channel.id] = ticket;
    gg.stats.opened++;
  });

  const ping = await channel.send({
    content: [`<@${i.user.id}>`, settings.staffRoleId && `<@&${settings.staffRoleId}>`].filter(Boolean).join(' '),
    allowedMentions: { users: [i.user.id], roles: [settings.staffRoleId].filter(Boolean) },
  });
  setTimeout(() => ping.delete().catch(() => {}), 3000);
  await i.editReply({ components: [ok(`Ticket utworzony: ${channel}`)], flags: V2 });
}

function staffTicket(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return { error: 'To nie jest aktywny kanał ticketu.' };
  if (!isStaff(i.member, guild(i.guildId).settings)) return { error: 'Tylko staff może to zrobić.' };
  return { ticket };
}

async function onCloseRequest(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return replyV2(i, fail('To nie jest aktywny kanał ticketu.'));
  const staff = isStaff(i.member, guild(i.guildId).settings);
  if (ticket.userId !== i.user.id && !staff) return replyV2(i, fail('Nie możesz zamknąć tego ticketu.'));
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
      new ButtonBuilder().setCustomId('tk:closenorep').setLabel('Zamknij bez repa (staff)').setEmoji('🔒').setStyle(ButtonStyle.Danger),
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
      point(`Dotychczas wystawiono **${g.stats.lc}** vouchy — dziękujemy za zaufanie! 💙`),
    ]
      .filter(Boolean)
      .join('\n'),
  );
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
  if (message.channelId !== g.settings.lcChannelId || message.author.bot) return false;
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

  updateGuild(message.guild.id, (gg) => gg.stats.lc++);
  await message.react('✅').catch(() => {});

  if (ticket) {
    updateGuild(message.guild.id, (gg) => Object.assign(gg.tickets[ticket.channelId], { awaitingRep: false, lcUrl: message.url }));
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
          row('Wynik', result === 'done' ? '✅ Zrealizowane' : '❌ Niezrealizowane'),
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
  if (settings.logChannelId) {
    const log = await g.channels.fetch(settings.logChannelId).catch(() => null);
    await log?.send({ components: [closedView(closed, g.name, false)], files: [transcript], flags: V2, allowedMentions: { parse: [] } }).catch(console.error);
  }
  const user = await client.users.fetch(closed.userId).catch(() => null);
  await user
    ?.send({ components: [closedView(closed, `Dziękujemy za skorzystanie z ${brand.name}!`, result === 'done', g.id)], files: [transcript], flags: V2 })
    .catch(() => {});
  setTimeout(() => channel.delete('Ticket zamknięty').catch(console.error), 5000);
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
  legit: (g, logo) => legitPanel(logo),
  cennik: (g, logo) => pricingPanel(g, logo),
  vouch: (g, logo) => vouchPanel(g, logo),
};

/** Wysyła panel na kanał i zapamiętuje go. Zły link do baneru → wysyła bez baneru. */
async function postPanel(client, discordGuild, channel, type) {
  const logo = logoOf(discordGuild, client);
  let message;
  let warning = '';
  try {
    message = await channel.send({ components: [panelBuilders[type](guild(discordGuild.id), logo)], flags: V2 });
  } catch (err) {
    // 50035 = Discord odrzucił treść — zwykle zły link do baneru. Próbujemy bez niego.
    if (err.code !== 50035 || !guild(discordGuild.id).settings.banners[type]) throw err;
    updateGuild(discordGuild.id, (gg) => delete gg.settings.banners[type]);
    message = await channel.send({ components: [panelBuilders[type](guild(discordGuild.id), logo)], flags: V2 });
    warning = '\n⚠️ Link do baneru był nieprawidłowy — panel wysłano bez niego.';
  }
  updateGuild(discordGuild.id, (gg) => (gg.panels[type] = { channelId: channel.id, messageId: message.id }));
  if (type === 'legit') {
    updateGuild(discordGuild.id, (gg) => (gg.legitVotes = { yes: 0, no: 0 }));
    await message.react('✅').catch(() => {});
    await message.react('❌').catch(() => {});
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
  await message.edit({ components: [panelBuilders[type](g, logo)], flags: V2 }).catch((err) => console.error(`Panel ${type}:`, err.message));
}

// ─── Liczniki w nazwach kanałów (np. ⭐┃opinie→9) ───────────────────────
// Liczby są od razu zapisywane w bazie. Discord pozwala zmienić nazwę kanału tylko 2 razy na 10 minut,
// więc nazwy kanałów aktualizujemy co 10 minut (i raz przy starcie bota) — tylko gdy liczba się zmieniła.

/** [id kanału, wzór nazwy, liczba] dla wszystkich liczników serwera. */
function counterTargets(g) {
  return [
    [g.panels.legit?.channelId, counterNames.legit, g.legitVotes?.yes ?? 0],
    [g.settings.lcChannelId, counterNames.legitCheck, g.stats.lc],
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

/** Liczba reakcji bez reakcji samego bota. */
function votesOf(message, name) {
  const r = message.reactions.cache.get(name);
  return r ? Math.max(0, r.count - (r.me ? 1 : 0)) : 0;
}

async function onLegitReaction(reaction, user, added) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);
  const message = reaction.message;
  if (!message.guildId) return;
  const g = guild(message.guildId);
  if (g.panels.legit?.messageId !== message.id) return;
  const emoji = reaction.emoji.name;

  if (emoji === '❌' && added) {
    // ❌ zawsze znika, a autor (poza staffem) dostaje przerwę.
    await reaction.users.remove(user.id).catch((err) => console.warn('Usuwanie ❌:', err.message));
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (legitTimeoutDays > 0 && member && !isStaff(member, g.settings) && member.moderatable) {
      const timedOut = await member
        .timeout(legitTimeoutDays * 86_400_000, 'Czy legit: reakcja ❌ bez dowodu')
        .then(() => true)
        .catch((err) => (console.warn('Przerwa:', err.message), false));
      if (timedOut) {
        await user
          .send({
            components: [
              notice(
                `### 🔇 ${x} Otrzymałeś/aś przerwę na ${legitTimeoutDays} dni\nReakcja ❌ na **czy legit** wymaga dowodu. Jeśli go masz — napisz do administracji.`,
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
  if (emoji === '✅') updateGuild(message.guildId, (gg) => (gg.legitVotes = { yes: votesOf(message, '✅'), no: 0 }));
}

/** Przy starcie: przelicza ✅ na panelu (reakcje dodane, gdy bot był wyłączony). */
async function syncLegitVotes(client) {
  for (const [guildId, g] of Object.entries(store.guilds)) {
    const ref = g.panels?.legit;
    if (!ref || !client.guilds.cache.has(guildId)) continue;
    const channel = await client.channels.fetch(ref.channelId).catch(() => null);
    const message = await channel?.messages.fetch(ref.messageId).catch(() => null);
    if (message) updateGuild(guildId, (gg) => (gg.legitVotes = { yes: votesOf(message, '✅'), no: 0 }));
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

async function onMessage(message) {
  if (!message.guild) return;
  if (await onLegitCheckMessage(message)) return;
  if (!boostTypes.includes(message.type)) return;
  const { settings } = guild(message.guild.id);
  if (!settings.boostChannelId) return;
  const channel = await message.guild.channels.fetch(settings.boostChannelId).catch(() => null);
  const fresh = await message.guild.fetch().catch(() => message.guild);
  await channel
    ?.send({
      components: [boostView(message.author, fresh.premiumSubscriptionCount ?? 0, fresh.premiumTier ?? 0)],
      flags: V2,
      allowedMentions: { users: [message.author.id] },
    })
    .catch((err) => console.error('Boost:', err.message));
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
  const values = { reviews: g.reviews.length, legitCheck: g.stats.lc, legit: 0 };
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
          point('Podsumowanie wyślę Ci w **DM** i na kanał staffu.'),
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
  const settings = { staffRoleId: roles.staff.id, rulesRoleId: roles.verified.id, counters: true };
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
      if (ch.panel) panels.push([ch.panel, channel]);
      if (ch.report) reportChannel = channel;
    }
  }

  // 4. Konfiguracja bota (to samo, co /setup).
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
    components: [notice(`### 🏗️ ${x} Generuję serwer…\nTen kanał za chwilę zniknie. Podsumowanie dostaniesz w **DM** i na kanale staffu.`, colors.brand)],
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
    .addRoleOption((o) => o.setName('staff').setDescription('Rola obsługująca tickety').setRequired(true))
    .addChannelOption((o) => o.setName('logi').setDescription('Kanał logów i transcriptów').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((o) => o.setName('opinie').setDescription('Kanał, na który trafiają opinie').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('boosty').setDescription('Kanał podziękowań za boosty').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('legitcheck').setDescription('Kanał legit checków (rep po zrealizowanym zamówieniu)').addChannelTypes(ChannelType.GuildText))
    .addRoleOption((o) => o.setName('rola-regulamin').setDescription('Rola nadawana po akceptacji regulaminu'))
    .addBooleanOption((o) => o.setName('liczniki').setDescription('Liczniki w nazwach kanałów (opinie→9, czy-legit→404)'))
    .addIntegerOption((o) => o.setName('limit').setDescription('Maks. otwartych ticketów na osobę').setMinValue(1).setMaxValue(10)),
  async (i) => {
    const s = updateGuild(i.guildId, (g) => {
      const st = g.settings;
      st.categoryId = i.options.getChannel('kategoria').id;
      st.staffRoleId = i.options.getRole('staff').id;
      st.logChannelId = i.options.getChannel('logi').id;
      st.reviewChannelId = i.options.getChannel('opinie')?.id ?? st.reviewChannelId ?? null;
      st.boostChannelId = i.options.getChannel('boosty')?.id ?? st.boostChannelId ?? null;
      st.lcChannelId = i.options.getChannel('legitcheck')?.id ?? st.lcChannelId ?? null;
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
                row('🛡️ Staff', `<@&${s.staffRoleId}>`),
                row('📜 Logi', ch(s.logChannelId)),
                row('⭐ Opinie', ch(s.reviewChannelId)),
                row('🚀 Boosty', ch(s.boostChannelId)),
                row('✅ Legit check', ch(s.lcChannelId)),
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
    .addStringOption((o) => o.setName('baner').setDescription('Link do obrazka pod panelem (zapamiętywany)')),
  async (i) => {
    const type = i.options.getString('typ');
    const bannerUrl = i.options.getString('baner');
    if (bannerUrl && !isUrl(bannerUrl)) return replyFail(i, 'Baner musi być bezpośrednim linkiem do obrazka (http/https).');
    if (type === 'tickety' && !guild(i.guildId).settings.categoryId) return replyFail(i, 'Najpierw użyj `/setup`.');
    if (bannerUrl) updateGuild(i.guildId, (g) => (g.settings.banners[type] = bannerUrl));

    const channelId = i.options.getChannel('kanal')?.id ?? i.channelId;
    const channel = await i.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return replyFail(i, 'Bot nie widzi tego kanału.');
    const perms = channel.permissionsFor(i.client.user);
    const needed = { ViewChannel: 'Wyświetlanie kanału', SendMessages: 'Wysyłanie wiadomości', AddReactions: 'Dodawanie reakcji' };
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
      hostId: i.user.id,
      endsAt: Date.now() + duration,
      entrants: [],
      ended: false,
    };
    const message = await channel.send({ components: [giveawayView(gw, i.guild.memberCount)], flags: V2, allowedMentions: { parse: [] } });
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
    if (!isStaff(i.member, guild(i.guildId).settings)) return replyFail(i, 'Tylko staff może to zrobić.');
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
  if (!i.inGuild()) return;

  if (scope === 'tk') {
    if (i.isStringSelectMenu() && action === 'open') {
      await onTicketSelect(i, i.values[0]);
      // Odświeżamy panel, żeby menu wróciło do „Nie wybrałeś/aś żadnej kategorii”.
      return i.message.edit({ components: [ticketsPanel(guild(i.guildId), logoOf(i.guild, i.client))], flags: V2 }).catch(() => {});
    }
    if (i.isModalSubmit() && action === 'form') return onTicketForm(i, arg);
    if (i.isModalSubmit() && action === 'donesubmit') return onDoneSubmit(i);
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
      await replyV2(i, rulesSection(Number(i.values[0])));
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
    { ...base, type: 'hosting', form: { bot: 'discord.js', period: '3m', notes: 'x' } },
    { ...base, type: 'question', form: { question: 'Ile kosztuje?' } },
    { ...base, type: 'partner', form: { server: null, offer: 'Reklama' } },
  ];
  const closed = { ...tickets[0], closedAt: Date.now(), closedBy: '3', closeReason: 'Gotowe' };
  const dealTicket = { ...tickets[0], deal: { product: 'Bot do exchange', price: '50 PLN', payment: 'ltc', sellerId: '3' } };
  const gw = { channelId: '1', prize: '20% zniżki', winners: 1, requirements: null, image: img, hostId: '2', endsAt: Date.now() + 1e6, entrants: ['1', '2'], ended: false };

  const built = [
    ...[...commands.values()].map((cmd) => cmd.data),
    ...Object.values(panelBuilders).flatMap((fn) => [fn(g, img), fn(guild('empty'), null)]),
    ...rules.map((_, idx) => rulesSection(idx)),
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
  ];
  for (const item of built) item.toJSON();
  if (parseDuration('1d 2h 30m') !== 95_400_000) throw new Error('parseDuration');
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
  const cardJson = JSON.stringify(ticketMessage(g.tickets[TICKET_CH], users[CLIENT]).toJSON());
  assert(!cardJson.includes('tk:status'), 'ticket nie może mieć menu statusu');
  assert(!cardJson.includes('tk:claim'), 'ticket nie może mieć przycisku Przejmij');
  const modals = [...Object.keys(ticketTypes).map(ticketModal), reviewModal('x'), doneModal(), notDoneModal()];
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
  assert(g.stats.lc === 1, 'vouch innej osoby liczy się do licznika');

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

  // 8b. Niezrealizowane: log pokazuje osobę, która kliknęła.
  channels['ticket-2'] = mkChannel('ticket-2', 'bot-0002');
  g.tickets['ticket-2'] = { channelId: 'ticket-2', number: 2, type: 'bot', userId: CLIENT, openedAt: Date.now(), form: { desc: 'y' }, messageId: 'card2' };
  const iNot = interaction(STAFF, { channelId: 'ticket-2', channel: channels['ticket-2'] });
  await closeTicket(iNot, { reason: 'Klient zrezygnował' });
  const notLog = JSON.stringify(closedView(getTicket(GID, 'ticket-2'), 'x', false).toJSON());
  assert(notLog.includes('Oznaczył jako niezrealizowane') && notLog.includes(`<@${STAFF}>`), 'log pokazuje, kto kliknął Niezrealizowane');
  assert(JSON.stringify(iNot.replies[0].components[0].toJSON()).includes('Oznaczył jako niezrealizowane'), 'wiadomość w tickecie pokazuje, kto kliknął');

  // 9. Bez Message Content: wystarczy oznaczenie sprzedawcy.
  messageContentOn = false;
  assert(isRep({ content: '', mentions: { users: { size: 1 } } }), 'bez intentu: oznaczenie kogoś wystarcza');
  messageContentOn = true;

  // 10. „Czy legit?” — ✅ zapisuje się od razu (bez bota), ❌ znika i daje przerwę 7 dni (staff bez przerwy).
  g.panels.legit = { channelId: LEGIT_CH, messageId: 'legit-msg' };
  const reactions = new Map([
    ['✅', { count: 405, me: true }],
    ['❌', { count: 2, me: true }],
  ]);
  const removed = [];
  const reaction = (name) => ({
    partial: false,
    emoji: { name },
    users: { remove: async (id) => removed.push([name, id]) },
    message: { id: 'legit-msg', partial: false, guildId: GID, guild: fakeGuild, channelId: LEGIT_CH, client: fakeClient, reactions: { cache: reactions } },
  });
  await onLegitReaction(reaction('✅'), mkUser('fan'), true);
  assert(g.legitVotes.yes === 404, 'głosy ✅ zapisane w bazie bez reakcji bota');
  await onLegitReaction(reaction('❌'), mkUser('hater'), true);
  assert(removed.some(([e, id]) => e === '❌' && id === 'hater'), '❌ usunięte');
  const hater = log.find(([type, id]) => type === 'timeout' && id === 'hater');
  assert(hater && hater[2] === 7 * 86_400_000, 'przerwa 7 dni za ❌');
  assert(log.some(([type, id]) => type === 'dm' && id === 'hater'), 'DM o przerwie');
  const timeoutsBefore = log.filter(([type]) => type === 'timeout').length;
  await onLegitReaction(reaction('❌'), mkUser(STAFF), true);
  assert(removed.some(([e, id]) => e === '❌' && id === STAFF), '❌ staffu też usunięte');
  assert(log.filter(([type]) => type === 'timeout').length === timeoutsBefore, 'staff bez przerwy');
  assert(g.legitVotes.yes === 404, '❌ nie zmienia licznika');
  reactions.get('✅').count = 404;
  await onLegitReaction(reaction('✅'), mkUser('fan'), false);
  assert(g.legitVotes.yes === 403, 'cofnięcie ✅ zmniejsza licznik');
  reactions.get('✅').count = 405;
  await onLegitReaction(reaction('✅'), mkUser('fan'), true);

  // 11. Liczniki kanałów: nazwy z bazy.
  g.settings.reviewChannelId = null;
  await updateCounters(fakeClient);
  assert(channels[LEGIT_CH].name === '🤔┃czy-legit→404', `licznik czy legit (${channels[LEGIT_CH].name})`);
  assert(channels[LC_CH].name === '✅┃legit-check→2', `licznik legit check (${channels[LC_CH].name})`);
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
  assert(cats.length === 7 && chans.length === 16, `7 kategorii i 16 kanałów (${cats.length}/${chans.length})`);
  assert(['━━ 📌 WAŻNE ━━', '━━ 🤝 ZAUFANIE ━━', '━━ 🎫 TICKETY ━━', '━━ 📂 OTWARTE TICKETY ━━', '━━ 🛡️ ADMINISTRACJA ━━'].every(byName), 'nazwy kategorii w stylu ━━');
  const parentOf = (name) => created.find((item) => item.id === byName(name).parent)?.name;
  assert(['📜┃regulamin', '📢┃ogłoszenia', '💰┃cennik', '🎉┃konkursy', '🚀┃boosty'].every((n) => parentOf(n) === '━━ 📌 WAŻNE ━━'), 'WAŻNE: regulamin, ogłoszenia, cennik, konkursy, boosty');
  assert(['✅┃legit-check→0', '⭐┃opinie→0', '🤔┃czy-legit→0'].every((n) => parentOf(n) === '━━ 🤝 ZAUFANIE ━━'), 'ZAUFANIE: legit-check, opinie, czy-legit');
  assert(parentOf('🎫┃tickety') === '━━ 🎫 TICKETY ━━', 'panel ticketów w osobnej kategorii');
  assert(byName('🎉┃konkursy') && byName('📜┃regulamin') && byName('⭐┃opinie→0') && byName('🤔┃czy-legit→0') && byName('✅┃legit-check→0'), 'nazwy kanałów w stylu ┃');
  assert(byName('🔊┃rozmowy').type === ChannelType.GuildVoice, 'kanały głosowe');
  assert([...roles.values()].filter((r) => r.name !== '@everyone').length === 4, '4 role');
  assert(dms.some(([t, id]) => t === 'role' && id === 'admin-user'), 'rola Administracja dla osoby, która generuje');

  const everyoneDeny = (ch) => ch.permissionOverwrites.find((o) => o.id === 'everyone').deny;
  assert(everyoneDeny(byName('📁┃logi')).includes(F.ViewChannel), 'logi ukryte przed wszystkimi');
  assert(everyoneDeny(byName('━━ 📂 OTWARTE TICKETY ━━')).includes(F.ViewChannel), 'kategoria otwartych ticketów prywatna');
  assert(!everyoneDeny(byName('━━ 🎫 TICKETY ━━')).includes(F.ViewChannel), 'kategoria z panelem ticketów publiczna');
  assert(everyoneDeny(byName('📜┃regulamin')).includes(F.SendMessages), 'regulamin tylko do czytania');
  assert(!everyoneDeny(byName('✅┃legit-check→0')).includes(F.SendMessages), 'na legit-check można pisać');
  assert(!everyoneDeny(byName('💬┃czat')).includes(F.SendMessages), 'na czacie można pisać');
  assert(byName('📜┃regulamin').permissionOverwrites.some((o) => o.id === 'bot' && o.allow.includes(F.SendMessages)), 'bot może pisać wszędzie');

  const s = guild(GID).settings;
  assert(s.categoryId === byName('━━ 📂 OTWARTE TICKETY ━━').id, 'tickety tworzą się w OTWARTE TICKETY');
  assert(s.logChannelId === byName('📁┃logi').id && s.lcChannelId === byName('✅┃legit-check→0').id, 'logi i legit check ustawione');
  assert(s.reviewChannelId === byName('⭐┃opinie→0').id && s.boostChannelId === byName('🚀┃boosty').id, 'opinie i boosty ustawione');
  assert(s.staffRoleId && s.rulesRoleId, 'role staff i regulaminu ustawione');
  assert(report.panels.length === 6 && ['📜┃regulamin', '💰┃cennik', '🎫┃tickety', '⭐┃opinie→0', '🤔┃czy-legit→0', '✅┃legit-check→0'].every((n) => byName(n).sent.length === 1), '6 paneli wysłanych');
  assert(JSON.stringify(byName('📜┃regulamin').sent[0].components[0].toJSON()).includes('rules:accept'), 'regulamin z przyciskiem akceptacji');
  assert(byName('💬┃staff-czat').sent.length === 1 && dms.some(([t]) => t === 'dm'), 'podsumowanie na staff-czat i w DM');
  assert(guild(GID).tickets.old.closedAt, 'stare tickety zamknięte w bazie');
  assert(openTicketsOf(GID, 'u').length === 0, 'klient może otworzyć nowy ticket');

  delete store.guilds[GID];
  console.log('✅ Test generatora: 25 sprawdzeń OK');
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

// ═══ START ═════════════════════════════════════════════════════════════

if (process.argv.includes('--check')) {
  selfTest();
  await flowTest();
  await generatorTest();
  await registerTest();
  process.exit(0);
}

// Token i ID serwera: config.json obok index.js albo zmienne środowiskowe (DISCORD_TOKEN, GUILD_ID).
const configFile = join(dirname(fileURLToPath(import.meta.url)), 'config.json');
const fileConfig = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || fileConfig.token;
const GUILD_ID = process.env.GUILD_ID || fileConfig.guildId;
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
  ready.user.setActivity({ name: `${brand.emoji} ${brand.name} • tanie boty Discord`, type: ActivityType.Custom });
  if (!loopsStarted) {
    loopsStarted = true;
    giveawayTicker(ready);
    counterLoop(ready);
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

function start(withContent) {
  messageContentOn = withContent;
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions];
  if (withContent) intents.push(GatewayIntentBits.MessageContent);
  botClient = new Client({ intents, partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User] });

  botClient.once(Events.ClientReady, onReady);
  botClient.on(Events.InteractionCreate, onInteraction);
  botClient.on(Events.MessageCreate, (m) => onMessage(m).catch(console.error));
  botClient.on(Events.MessageReactionAdd, (r, u) => onLegitReaction(r, u, true).catch(console.error));
  botClient.on(Events.MessageReactionRemove, (r, u) => onLegitReaction(r, u, false).catch(console.error));

  const fallback = () => {
    if (!messageContentOn) return;
    console.warn('⚠️ „Message Content Intent” nie jest włączony w Developer Portal — uruchamiam bota bez niego.');
    botClient.destroy();
    start(false);
  };
  botClient.on(Events.ShardDisconnect, (ev) => ev?.code === 4014 && fallback());
  botClient.login(DISCORD_TOKEN).catch((err) => {
    if (withContent && (isDisallowedIntents(err) || !messageContentOn)) return fallback();
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

start(true);
