// CompV2 Exchange Bot — cały bot w jednym pliku.
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
  ModalBuilder,
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

// Branding and static options. Adjust to your server.
const brand = {
  name: 'CompV2 Exchange',
  footer: 'CompV2 Exchange • Szybko • Bezpiecznie • 24/7',
};

const colors = {
  primary: 0x5865f2,
  success: 0x23a55a,
  warning: 0xf0b232,
  danger: 0xf23f43,
  neutral: 0x2b2d31,
  gold: 0xf5c542,
};

const ticketTypes = {
  exchange: {
    label: 'Exchange',
    emoji: '💱',
    description: 'Wymiana środków pomiędzy metodami płatności',
    color: colors.primary,
    prefix: 'exchange',
  },
  support: {
    label: 'Pomoc',
    emoji: '🛟',
    description: 'Pytania, problemy i pomoc techniczna',
    color: colors.success,
    prefix: 'pomoc',
  },
  partnership: {
    label: 'Współpraca',
    emoji: '🤝',
    description: 'Partnerstwa, reklamy i propozycje',
    color: colors.gold,
    prefix: 'wspolpraca',
  },
  report: {
    label: 'Zgłoszenie',
    emoji: '🚨',
    description: 'Zgłoś oszusta lub nieprawidłowość',
    color: colors.danger,
    prefix: 'zgloszenie',
  },
};

// Payment methods offered in the exchange form (max 25).
const methods = {
  blik: { label: 'BLIK', emoji: '📱' },
  bank: { label: 'Przelew bankowy', emoji: '🏦' },
  paypal: { label: 'PayPal', emoji: '🅿️' },
  revolut: { label: 'Revolut', emoji: '💳' },
  psc: { label: 'Paysafecard', emoji: '🎫' },
  btc: { label: 'Bitcoin (BTC)', emoji: '🪙' },
  ltc: { label: 'Litecoin (LTC)', emoji: '🪙' },
  eth: { label: 'Ethereum (ETH)', emoji: '🪙' },
  usdt: { label: 'USDT (TRC20)', emoji: '💵' },
};

// Default fee (%) when no specific rate is set with /kurs.
const defaultFee = 10;

const statuses = {
  waiting: { label: 'Oczekuje na obsługę', emoji: '🕓', color: colors.neutral },
  payment: { label: 'Oczekuje na płatność', emoji: '💸', color: colors.warning },
  received: { label: 'Płatność otrzymana', emoji: '📥', color: colors.primary },
  processing: { label: 'W realizacji', emoji: '⚙️', color: colors.primary },
  done: { label: 'Zrealizowano', emoji: '✅', color: colors.success },
};

// ═══ BAZA DANYCH (data/db.json) ════════════════════════════════════════

const dbFile = join(dirname(fileURLToPath(import.meta.url)), 'data', 'db.json');

let store = { guilds: {} };
if (existsSync(dbFile)) store = JSON.parse(readFileSync(dbFile, 'utf8'));

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

function flush() {
  clearTimeout(timer);
  mkdirSync(dirname(dbFile), { recursive: true });
  writeFileSync(`${dbFile}.tmp`, JSON.stringify(store, null, 2));
  renameSync(`${dbFile}.tmp`, dbFile);
}

function guild(id) {
  store.guilds[id] ??= {
    settings: { categoryId: null, staffRoleId: null, logChannelId: null, bannerUrl: null, maxOpen: 1 },
    counter: 0,
    rates: {},
    tickets: {},
    stats: { opened: 0, closed: 0, ratings: [] },
  };
  return store.guilds[id];
}

function updateGuild(id, fn) {
  const g = guild(id);
  fn(g);
  save();
  return g;
}

function getTicket(guildId, channelId) {
  return guild(guildId).tickets[channelId] ?? null;
}

function openTicketsOf(guildId, userId) {
  return Object.values(guild(guildId).tickets).filter((t) => t.userId === userId && !t.closedAt);
}

function feeFor(guildId, from, to, fallback) {
  return guild(guildId).rates[`${from}>${to}`] ?? fallback;
}

// ═══ WIDOKI COMPONENTS V2 ══════════════════════════════════════════════

const V2 = MessageFlags.IsComponentsV2;
const V2_EPHEMERAL = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const ts = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;
const money = (n) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const methodName = (key) => (methods[key] ? `${methods[key].emoji} ${methods[key].label}` : key);

function parseAmount(raw) {
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function quote(amount, fee) {
  const receive = amount * (1 - fee / 100);
  return { amount, fee, receive: Math.max(0, Math.round(receive * 100) / 100) };
}

const separator = (c, large = false) =>
  c.addSeparatorComponents((s) => s.setDivider(true).setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small));

const footer = (c) => c.addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));

/** Small single-color notice, used for replies and errors. */
function notice(text, color = colors.primary) {
  return new ContainerBuilder().setAccentColor(color).addTextDisplayComponents((t) => t.setContent(text));
}

const ok = (text) => notice(`### ✅ ${text}`, colors.success);
const fail = (text) => notice(`### ❌ Błąd\n${text}`, colors.danger);

// ─── Panel ─────────────────────────────────────────────────────────────

function panel(settings, server) {
  const c = new ContainerBuilder().setAccentColor(colors.primary);
  if (settings.bannerUrl) c.addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(settings.bannerUrl)));

  const header = [
    `# ${brand.name}`,
    'Profesjonalna wymiana środków pomiędzy metodami płatności.',
    '',
    '**Dlaczego my?**',
    '> ⚡ Realizacja nawet w kilka minut',
    '> 🔒 Każda transakcja obsługiwana przez zweryfikowany staff',
    '> 📜 Pełna historia rozmowy zapisywana w transcriptach',
  ].join('\n');

  if (server?.iconURL()) {
    c.addSectionComponents((s) =>
      s.addTextDisplayComponents((t) => t.setContent(header)).setThumbnailAccessory((th) => th.setURL(server.iconURL({ size: 256 }))),
    );
  } else {
    c.addTextDisplayComponents((t) => t.setContent(header));
  }

  separator(c, true);
  c.addTextDisplayComponents((t) =>
    t.setContent(
      [
        '### 🎫 Kategorie',
        ...Object.values(ticketTypes).map((tt) => `${tt.emoji} **${tt.label}** — ${tt.description}`),
      ].join('\n'),
    ),
  );
  c.addActionRowComponents((row) =>
    row.setComponents(
      new StringSelectMenuBuilder()
        .setCustomId('tk:open')
        .setPlaceholder('📂 Wybierz kategorię, aby otworzyć ticket')
        .addOptions(
          Object.entries(ticketTypes).map(([value, tt]) => ({
            label: tt.label,
            value,
            description: tt.description,
            emoji: tt.emoji,
          })),
        ),
    ),
  );
  c.addActionRowComponents((row) =>
    row.setComponents(
      new ButtonBuilder().setCustomId('tk:rates').setLabel('Kursy i prowizje').setEmoji('📊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('tk:mine').setLabel('Moje tickety').setEmoji('🗂️').setStyle(ButtonStyle.Secondary),
    ),
  );
  separator(c);
  footer(c);
  return c;
}

function ratesView(rates) {
  const entries = Object.entries(rates);
  const lines = entries.length
    ? entries.map(([k, fee]) => {
        const [from, to] = k.split('>');
        return `${methodName(from)} ➜ ${methodName(to)} · **${fee}%**`;
      })
    : ['*Brak indywidualnych kursów.*'];
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents((t) => t.setContent(`## 📊 Kursy i prowizje\n${lines.join('\n')}`))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((t) => t.setContent(`-# Pozostałe kierunki: **${defaultFee}%** prowizji • użyj \`/kalkulator\`, aby policzyć kwotę`));
}

// ─── Modals ────────────────────────────────────────────────────────────

const methodSelect = (id, placeholder) =>
  new StringSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .addOptions(Object.entries(methods).map(([value, m]) => ({ label: m.label, value, emoji: m.emoji })));

function exchangeModal() {
  return new ModalBuilder()
    .setCustomId('tk:form:exchange')
    .setTitle('💱 Nowa wymiana')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Wysyłam')
        .setDescription('Metoda, którą przekażesz środki')
        .setStringSelectMenuComponent(methodSelect('from', 'Wybierz metodę…')),
      new LabelBuilder()
        .setLabel('Otrzymuję')
        .setDescription('Metoda, na którą chcesz otrzymać środki')
        .setStringSelectMenuComponent(methodSelect('to', 'Wybierz metodę…')),
      new LabelBuilder()
        .setLabel('Kwota (PLN)')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('amount').setStyle(TextInputStyle.Short).setPlaceholder('np. 250').setMaxLength(12),
        ),
      new LabelBuilder()
        .setLabel('Dodatkowe informacje')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('notes')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Adres portfela, preferowana godzina itp.')
            .setRequired(false)
            .setMaxLength(500),
        ),
    );
}

function generalModal(type) {
  const tt = ticketTypes[type];
  return new ModalBuilder()
    .setCustomId(`tk:form:${type}`)
    .setTitle(`${tt.emoji} ${tt.label}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Temat')
        .setTextInputComponent(new TextInputBuilder().setCustomId('subject').setStyle(TextInputStyle.Short).setMaxLength(80)),
      new LabelBuilder()
        .setLabel('Opisz sprawę')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('details').setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(1000),
        ),
    );
}

function closeReasonModal() {
  return new ModalBuilder()
    .setCustomId('tk:closereason')
    .setTitle('🔒 Zamknij ticket')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Powód zamknięcia')
        .setTextInputComponent(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setMaxLength(300)),
    );
}

function announcementModal() {
  return new ModalBuilder()
    .setCustomId('ann:send')
    .setTitle('📣 Nowe ogłoszenie')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Tytuł')
        .setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100)),
      new LabelBuilder()
        .setLabel('Treść (Markdown)')
        .setTextInputComponent(new TextInputBuilder().setCustomId('body').setStyle(TextInputStyle.Paragraph).setMaxLength(3000)),
      new LabelBuilder()
        .setLabel('Link do obrazka')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('image').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://…'),
        ),
    );
}

function announcement({ title, body, image, color = colors.primary, author }) {
  const c = new ContainerBuilder().setAccentColor(color).addTextDisplayComponents((t) => t.setContent(`# ${title}\n${body}`));
  if (image) c.addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(image)));
  separator(c);
  return c.addTextDisplayComponents((t) => t.setContent(`-# 📣 ${author} • ${brand.name}`));
}

// ─── Ticket ────────────────────────────────────────────────────────────

function ticketMessage(ticket, user) {
  const tt = ticketTypes[ticket.type];
  const status = statuses[ticket.status] ?? statuses.waiting;
  const accent = ticket.type === 'exchange' ? status.color : tt.color;
  const c = new ContainerBuilder().setAccentColor(accent);

  c.addSectionComponents((s) =>
    s
      .addTextDisplayComponents((t) =>
        t.setContent(
          [
            `## ${tt.emoji} ${tt.label} · #${String(ticket.number).padStart(4, '0')}`,
            `Witaj <@${ticket.userId}>! Zespół odpowie najszybciej, jak to możliwe.`,
            `-# Otwarto ${ts(ticket.openedAt)}`,
          ].join('\n'),
        ),
      )
      .setThumbnailAccessory((th) => th.setURL(user.displayAvatarURL({ size: 256 }))),
  );
  separator(c);

  if (ticket.type === 'exchange') {
    const { from, to, amount, fee, receive, notes } = ticket.form;
    c.addTextDisplayComponents((t) =>
      t.setContent(
        [
          '### 🧾 Szczegóły wymiany',
          `> **Wysyłasz:** ${methodName(from)}`,
          `> **Otrzymujesz:** ${methodName(to)}`,
          `> **Kwota:** \`${money(amount)} PLN\``,
          `> **Prowizja:** \`${fee}%\``,
          `> **Otrzymasz ok.:** \`${money(receive)} PLN\``,
          notes ? `\n**Uwagi:**\n${notes}` : null,
        ]
          .filter((x) => x !== null)
          .join('\n'),
      ),
    );
  } else {
    c.addTextDisplayComponents((t) => t.setContent(`### ${ticket.form.subject}\n${ticket.form.details}`));
  }

  separator(c);
  c.addTextDisplayComponents((t) =>
    t.setContent(
      [
        `**Status:** ${status.emoji} ${status.label}`,
        `**Obsługuje:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : '*nikt — czeka na przejęcie*'}`,
      ].join('\n'),
    ),
  );

  if (ticket.type === 'exchange') {
    c.addActionRowComponents((row) =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('tk:status')
          .setPlaceholder('🛠️ Zmień status (staff)')
          .addOptions(
            Object.entries(statuses).map(([value, s]) => ({
              label: s.label,
              value,
              emoji: s.emoji,
              default: value === ticket.status,
            })),
          ),
      ),
    );
  }

  c.addActionRowComponents((row) =>
    row.setComponents(
      new ButtonBuilder()
        .setCustomId('tk:claim')
        .setLabel(ticket.claimedBy ? 'Przejęty' : 'Przejmij')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(Boolean(ticket.claimedBy)),
      new ButtonBuilder().setCustomId('tk:close').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('tk:transcript').setLabel('Transcript').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    ),
  );
  footer(c);
  return c;
}

function closeConfirm() {
  return new ContainerBuilder()
    .setAccentColor(colors.danger)
    .addTextDisplayComponents((t) =>
      t.setContent('### 🔒 Zamknąć ticket?\nKanał zostanie usunięty, a transcript trafi do logów i do autora ticketu.'),
    )
    .addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setCustomId('tk:closeyes').setLabel('Zamknij').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('tk:closewhy').setLabel('Zamknij z powodem').setStyle(ButtonStyle.Secondary),
      ),
    );
}

function closingNotice(by, reason) {
  return new ContainerBuilder()
    .setAccentColor(colors.danger)
    .addTextDisplayComponents((t) =>
      t.setContent(
        [`### 🔒 Ticket zamykany przez <@${by}>`, reason ? `**Powód:** ${reason}` : null, `-# Kanał zniknie za kilka sekund…`]
          .filter(Boolean)
          .join('\n'),
      ),
    );
}

function closedLog(ticket, guildName) {
  const tt = ticketTypes[ticket.type];
  const lines = [
    `## ${tt.emoji} Ticket #${String(ticket.number).padStart(4, '0')} zamknięty`,
    `-# ${guildName}`,
    '',
    `**Autor:** <@${ticket.userId}>`,
    `**Kategoria:** ${tt.label}`,
    `**Obsługiwał:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : '—'}`,
    `**Zamknął:** <@${ticket.closedBy}>`,
    `**Powód:** ${ticket.closeReason ?? 'brak'}`,
    `**Otwarty:** ${ts(ticket.openedAt, 'f')}`,
    `**Zamknięty:** ${ts(ticket.closedAt, 'f')}`,
  ];
  if (ticket.type === 'exchange') {
    const f = ticket.form;
    lines.push(`**Wymiana:** ${methodName(f.from)} ➜ ${methodName(f.to)} · \`${money(f.amount)} PLN\``);
  }
  return new ContainerBuilder()
    .setAccentColor(colors.neutral)
    .addTextDisplayComponents((t) => t.setContent(lines.join('\n')))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addFileComponents((f) => f.setURL(`attachment://${transcriptName(ticket)}`));
}

const transcriptName = (ticket) => `transcript-${String(ticket.number).padStart(4, '0')}.html`;

function ratingRequest(ticket, guildId) {
  const c = closedLog(ticket, 'Dziękujemy za skorzystanie z naszych usług!');
  separator(c, true);
  c.addTextDisplayComponents((t) => t.setContent('### ⭐ Oceń obsługę\nTwoja opinia pomaga nam być lepszymi.'));
  c.addActionRowComponents((row) =>
    row.setComponents(
      [1, 2, 3, 4, 5].map((n) =>
        new ButtonBuilder()
          .setCustomId(`rate:${guildId}:${ticket.channelId}:${n}`)
          .setLabel('⭐'.repeat(n))
          .setStyle(n >= 4 ? ButtonStyle.Success : n === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      ),
    ),
  );
  return c;
}

function ratedView(ticket, stars) {
  const c = closedLog(ticket, 'Dziękujemy za skorzystanie z naszych usług!');
  separator(c, true);
  return c.addTextDisplayComponents((t) => t.setContent(`### 💛 Dziękujemy za ocenę!\nTwoja ocena: ${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}`));
}

function ratingLog(ticket, stars) {
  return notice(
    `### ⭐ Nowa ocena: ${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}\n` +
      `<@${ticket.userId}> ocenił ticket **#${String(ticket.number).padStart(4, '0')}**` +
      (ticket.claimedBy ? ` obsługiwany przez <@${ticket.claimedBy}>` : ''),
    colors.gold,
  );
}

function statsView(g) {
  const ratings = g.stats.ratings;
  const avg = ratings.length ? ratings.reduce((a, r) => a + r.stars, 0) / ratings.length : 0;
  const open = Object.values(g.tickets).filter((t) => !t.closedAt);
  const perStaff = {};
  for (const t of Object.values(g.tickets)) if (t.claimedBy && t.closedAt) perStaff[t.claimedBy] = (perStaff[t.claimedBy] ?? 0) + 1;
  const top = Object.entries(perStaff)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n], i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} <@${id}> — **${n}**`);

  return new ContainerBuilder()
    .setAccentColor(colors.gold)
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          '## 📈 Statystyki',
          `> 🎫 Otwarte teraz: **${open.length}**`,
          `> 📂 Łącznie otwartych: **${g.stats.opened}**`,
          `> 🔒 Zamkniętych: **${g.stats.closed}**`,
          `> ⭐ Średnia ocena: **${avg ? avg.toFixed(2) : '—'}** (${ratings.length} ocen)`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((t) => t.setContent(`### 🏆 Top staff\n${top.length ? top.join('\n') : '*Brak danych*'}`));
}

function myTickets(list) {
  const lines = list.length
    ? list.map((t) => `${ticketTypes[t.type].emoji} <#${t.channelId}> · otwarty ${ts(t.openedAt)}`)
    : ['*Nie masz otwartych ticketów.*'];
  return notice(`### 🗂️ Twoje tickety\n${lines.join('\n')}`);
}

function calculator(from, to, q) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          '## 🧮 Kalkulator wymiany',
          `${methodName(from)} ➜ ${methodName(to)}`,
          '',
          `> Wysyłasz: \`${money(q.amount)} PLN\``,
          `> Prowizja: \`${q.fee}%\``,
          `> **Otrzymasz: \`${money(q.receive)} PLN\`**`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((t) => t.setContent('-# Chcesz wymienić? Otwórz ticket **Exchange** w panelu.'));
}

// ═══ TICKETY ═══════════════════════════════════════════════════════════

const replyV2 = (i, container) => i.reply({ components: [container], flags: V2_EPHEMERAL });

function isStaff(member, settings) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    (settings.staffRoleId && member.roles.cache.has(settings.staffRoleId))
  );
}

// ─── Opening ───────────────────────────────────────────────────────────

async function onSelectType(i) {
  const type = i.values[0];
  const { settings } = guild(i.guildId);
  if (!settings.categoryId) return replyV2(i, fail('Bot nie jest skonfigurowany. Administrator musi użyć `/setup`.'));

  const open = openTicketsOf(i.guildId, i.user.id);
  if (open.length >= settings.maxOpen) {
    return replyV2(i, fail(`Masz już otwarty ticket: ${open.map((t) => `<#${t.channelId}>`).join(', ')}`));
  }

  await i.showModal(type === 'exchange' ? exchangeModal() : generalModal(type));
  // Re-render the panel so the select resets and the same category can be picked again.
  await i.message.edit({ components: [panel(settings, i.guild)], flags: V2 }).catch(() => {});
}

async function onForm(i, type) {
  const { settings } = guild(i.guildId);
  let form;
  if (type === 'exchange') {
    const from = i.fields.getStringSelectValues('from')[0];
    const to = i.fields.getStringSelectValues('to')[0];
    const amount = parseAmount(i.fields.getTextInputValue('amount'));
    if (!amount) return replyV2(i, fail('Podaj poprawną kwotę, np. `250` lub `99,50`.'));
    if (from === to) return replyV2(i, fail('Metoda wysyłki i odbioru muszą być różne.'));
    const q = quote(amount, feeFor(i.guildId, from, to, defaultFee));
    form = { from, to, ...q, notes: i.fields.getTextInputValue('notes') || null };
  } else {
    form = { subject: i.fields.getTextInputValue('subject'), details: i.fields.getTextInputValue('details') };
  }

  // Re-check the limit: two modals could have been open at the same time.
  if (openTicketsOf(i.guildId, i.user.id).length >= settings.maxOpen) {
    return replyV2(i, fail('Osiągnięto limit otwartych ticketów.'));
  }

  await i.deferReply({ flags: V2_EPHEMERAL });

  const number = updateGuild(i.guildId, (g) => g.counter++).counter;
  const tt = ticketTypes[type];
  const overwrites = [
    { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: i.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: i.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (settings.staffRoleId) {
    overwrites.push({
      id: settings.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  let channel;
  try {
    channel = await i.guild.channels.create({
      name: `${tt.prefix}-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: settings.categoryId,
      topic: `${tt.emoji} ${tt.label} • ${i.user.tag} (${i.user.id})`,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    console.error(err);
    return i.editReply({ components: [fail('Nie udało się utworzyć kanału. Sprawdź uprawnienia bota i kategorię.')], flags: V2 });
  }

  const ticket = {
    channelId: channel.id,
    number,
    type,
    userId: i.user.id,
    openedAt: Date.now(),
    status: 'waiting',
    claimedBy: null,
    form,
  };

  const message = await channel.send({ components: [ticketMessage(ticket, i.user)], flags: V2 });
  ticket.messageId = message.id;
  await message.pin().catch(() => {});

  updateGuild(i.guildId, (g) => {
    g.tickets[channel.id] = ticket;
    g.stats.opened++;
  });

  const ping = [`<@${i.user.id}>`, settings.staffRoleId && `<@&${settings.staffRoleId}>`].filter(Boolean).join(' ');
  const pingMsg = await channel.send({ content: ping, allowedMentions: { users: [i.user.id], roles: [settings.staffRoleId].filter(Boolean) } });
  setTimeout(() => pingMsg.delete().catch(() => {}), 3000);

  await i.editReply({ components: [ok(`Ticket utworzony: ${channel}`)], flags: V2 });
}

// ─── Staff actions ─────────────────────────────────────────────────────

function staffTicket(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return { error: 'To nie jest aktywny kanał ticketu.' };
  const { settings } = guild(i.guildId);
  if (!isStaff(i.member, settings)) return { error: 'Tylko staff może to zrobić.' };
  return { ticket, settings };
}

async function onClaim(i) {
  const { ticket, error } = staffTicket(i);
  if (error) return replyV2(i, fail(error));
  if (ticket.claimedBy) return replyV2(i, fail(`Ticket jest już przejęty przez <@${ticket.claimedBy}>.`));

  updateGuild(i.guildId, (g) => {
    g.tickets[i.channelId].claimedBy = i.user.id;
    if (g.tickets[i.channelId].status === 'waiting') g.tickets[i.channelId].status = ticket.type === 'exchange' ? 'payment' : 'processing';
  });
  const user = await i.client.users.fetch(ticket.userId);
  await i.update({ components: [ticketMessage(getTicket(i.guildId, i.channelId), user)], flags: V2 });
  await i.channel.send({ components: [notice(`### 🙋 <@${i.user.id}> przejął ticket i zajmie się Tobą.`)], flags: V2 });
}

async function onStatus(i) {
  const { ticket, error } = staffTicket(i);
  if (error) return replyV2(i, fail(error));
  const status = i.values[0];
  updateGuild(i.guildId, (g) => {
    g.tickets[i.channelId].status = status;
    g.tickets[i.channelId].claimedBy ??= i.user.id;
  });
  const user = await i.client.users.fetch(ticket.userId);
  await i.update({ components: [ticketMessage(getTicket(i.guildId, i.channelId), user)], flags: V2 });
  const s = statuses[status];
  await i.channel.send({
    components: [notice(`### ${s.emoji} Status: ${s.label}\n<@${ticket.userId}>, status Twojej wymiany został zaktualizowany.`, s.color)],
    flags: V2,
  });
}

async function onTranscript(i) {
  const { ticket, error } = staffTicket(i);
  if (error) return replyV2(i, fail(error));
  await i.deferReply({ flags: V2_EPHEMERAL });
  const file = await createTranscript(i.channel, { filename: transcriptName(ticket), poweredBy: false, saveImages: true });
  await i.editReply({ components: [ok('Transcript wygenerowany.')], files: [file], flags: V2 });
}

// ─── Closing ───────────────────────────────────────────────────────────

async function onCloseRequest(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return replyV2(i, fail('To nie jest aktywny kanał ticketu.'));
  const { settings } = guild(i.guildId);
  if (ticket.userId !== i.user.id && !isStaff(i.member, settings)) return replyV2(i, fail('Nie możesz zamknąć tego ticketu.'));
  await replyV2(i, closeConfirm());
}

async function closeTicket(i, reason = null) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return replyV2(i, fail('Ten ticket jest już zamykany.'));
  const { settings } = guild(i.guildId);
  if (ticket.userId !== i.user.id && !isStaff(i.member, settings)) return replyV2(i, fail('Nie możesz zamknąć tego ticketu.'));

  updateGuild(i.guildId, (g) => {
    Object.assign(g.tickets[i.channelId], { closedAt: Date.now(), closedBy: i.user.id, closeReason: reason });
    g.stats.closed++;
  });

  await i.reply({ components: [closingNotice(i.user.id, reason)], flags: V2 });

  const closed = getTicket(i.guildId, i.channelId);
  const channel = i.channel;
  const transcript = await createTranscript(channel, { filename: transcriptName(closed), poweredBy: false, saveImages: true });

  try {
    if (settings.logChannelId) {
      const log = await i.guild.channels.fetch(settings.logChannelId);
      await log.send({ components: [closedLog(closed, i.guild.name)], files: [transcript], flags: V2, allowedMentions: { parse: [] } });
    }
  } catch (err) {
    console.error('Log failed:', err);
  }

  try {
    const user = await i.client.users.fetch(closed.userId);
    await user.send({ components: [ratingRequest(closed, i.guildId)], files: [transcript], flags: V2 });
  } catch {
    // DMs closed — nothing to do.
  }

  setTimeout(() => channel.delete(`Ticket zamknięty przez ${i.user.tag}`).catch(console.error), 5000);
}

async function onRate(i, guildId, channelId, stars) {
  const ticket = getTicket(guildId, channelId);
  if (!ticket || ticket.userId !== i.user.id) return replyV2(i, fail('Nie można ocenić tego ticketu.'));
  if (ticket.rating) return replyV2(i, fail('Ten ticket został już oceniony.'));

  updateGuild(guildId, (g) => {
    g.tickets[channelId].rating = stars;
    g.stats.ratings.push({ stars, staffId: ticket.claimedBy, at: Date.now() });
  });
  await i.update({ components: [ratedView(getTicket(guildId, channelId), stars)], flags: V2 });

  const { settings } = guild(guildId);
  if (!settings.logChannelId) return;
  try {
    const log = await i.client.channels.fetch(settings.logChannelId);
    await log.send({ components: [ratingLog(ticket, stars)], flags: V2, allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('Rating log failed:', err);
  }
}

// ═══ KOMENDY SLASH ═══════════════════════════════════════════════════════

const methodChoices = Object.entries(methods).map(([value, m]) => ({ name: m.label, value }));
const methodOption = (o, name, description) => o.setName(name).setDescription(description).addChoices(...methodChoices).setRequired(true);
const replyOk = (i, text, flags = V2_EPHEMERAL) => i.reply({ components: [ok(text)], flags, allowedMentions: { parse: [] } });
const replyFail = (i, text) => i.reply({ components: [fail(text)], flags: V2_EPHEMERAL });

const commands = new Map();
const command = (data, execute) => commands.set(data.name, { data, execute });

command(
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Konfiguracja systemu ticketów')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o.setName('kategoria').setDescription('Kategoria, w której tworzone są tickety').addChannelTypes(ChannelType.GuildCategory).setRequired(true),
    )
    .addRoleOption((o) => o.setName('staff').setDescription('Rola obsługująca tickety').setRequired(true))
    .addChannelOption((o) =>
      o.setName('logi').setDescription('Kanał na logi i transcripty').addChannelTypes(ChannelType.GuildText).setRequired(true),
    )
    .addStringOption((o) => o.setName('baner').setDescription('Link do baneru panelu (opcjonalnie)'))
    .addIntegerOption((o) => o.setName('limit').setDescription('Maks. otwartych ticketów na osobę').setMinValue(1).setMaxValue(10)),
  async (i) => {
    const banner = i.options.getString('baner');
    if (banner && !/^https?:\/\/\S+$/.test(banner)) return replyFail(i, 'Baner musi być linkiem http(s).');
    const { settings: s } = updateGuild(i.guildId, (g) => {
      g.settings.categoryId = i.options.getChannel('kategoria').id;
      g.settings.staffRoleId = i.options.getRole('staff').id;
      g.settings.logChannelId = i.options.getChannel('logi').id;
      if (banner) g.settings.bannerUrl = banner;
      g.settings.maxOpen = i.options.getInteger('limit') ?? g.settings.maxOpen;
    });
    await i.reply({
      components: [
        notice(
          [
            '## ⚙️ Konfiguracja zapisana',
            `> 📁 Kategoria: <#${s.categoryId}>`,
            `> 🛡️ Staff: <@&${s.staffRoleId}>`,
            `> 📜 Logi: <#${s.logChannelId}>`,
            `> 🖼️ Baner: ${s.bannerUrl ? 'ustawiony' : 'brak'}`,
            `> 🎫 Limit ticketów: **${s.maxOpen}**`,
            '',
            '-# Teraz wyślij panel komendą `/panel`.',
          ].join('\n'),
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
    .setDescription('Wyślij panel ticketów')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption((o) => o.setName('kanal').setDescription('Kanał docelowy (domyślnie bieżący)').addChannelTypes(ChannelType.GuildText)),
  async (i) => {
    const { settings } = guild(i.guildId);
    if (!settings.categoryId) return replyFail(i, 'Najpierw użyj `/setup`.');
    const channel = i.options.getChannel('kanal') ?? i.channel;

    const needed = { ViewChannel: 'Wyświetlanie kanału', SendMessages: 'Wysyłanie wiadomości', ReadMessageHistory: 'Czytanie historii' };
    const perms = channel.permissionsFor(i.client.user);
    const missing = Object.entries(needed).filter(([flag]) => !perms?.has(PermissionFlagsBits[flag]));
    if (missing.length) {
      return replyFail(i, `Bot nie ma uprawnień na ${channel}:\n${missing.map(([, name]) => `> • ${name}`).join('\n')}`);
    }

    await i.deferReply({ flags: V2_EPHEMERAL });
    try {
      await channel.send({ components: [panel(settings, i.guild)], flags: V2 });
    } catch (err) {
      // 50035 = Discord odrzucił treść, najczęściej przez link do baneru, który nie jest bezpośrednim obrazkiem.
      if (err.code !== 50035 || !settings.bannerUrl) throw err;
      console.warn('Panel odrzucony z banerem, wysyłam bez niego:', err.message);
      await channel.send({ components: [panel({ ...settings, bannerUrl: null }, i.guild)], flags: V2 });
      return i.editReply({
        components: [
          notice(
            `### ⚠️ Panel wysłany bez baneru\nLink do baneru jest nieprawidłowy. Podaj bezpośredni link do obrazka (kończący się na .png/.jpg/.gif) w \`/setup\`.`,
            colors.warning,
          ),
        ],
        flags: V2,
      });
    }
    await i.editReply({ components: [ok(`Panel wysłany na ${channel}`)], flags: V2 });
  },
);

command(
  new SlashCommandBuilder()
    .setName('kurs')
    .setDescription('Zarządzanie prowizjami wymian')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('ustaw')
        .setDescription('Ustaw prowizję dla kierunku wymiany')
        .addStringOption((o) => methodOption(o, 'od', 'Metoda wysyłki'))
        .addStringOption((o) => methodOption(o, 'do', 'Metoda odbioru'))
        .addNumberOption((o) => o.setName('prowizja').setDescription('Prowizja w %').setMinValue(0).setMaxValue(100).setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Usuń indywidualną prowizję')
        .addStringOption((o) => methodOption(o, 'od', 'Metoda wysyłki'))
        .addStringOption((o) => methodOption(o, 'do', 'Metoda odbioru')),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Pokaż wszystkie prowizje')),
  async (i) => {
    const sub = i.options.getSubcommand();
    if (sub === 'lista') return i.reply({ components: [ratesView(guild(i.guildId).rates)], flags: V2_EPHEMERAL });
    const from = i.options.getString('od');
    const to = i.options.getString('do');
    if (from === to) return replyFail(i, 'Metody muszą być różne.');
    const key = `${from}>${to}`;
    if (sub === 'ustaw') {
      const fee = i.options.getNumber('prowizja');
      updateGuild(i.guildId, (g) => (g.rates[key] = fee));
      return replyOk(i, `${methodName(from)} ➜ ${methodName(to)}: **${fee}%**`);
    }
    updateGuild(i.guildId, (g) => delete g.rates[key]);
    return replyOk(i, `Usunięto prowizję ${methodName(from)} ➜ ${methodName(to)}`);
  },
);

command(
  new SlashCommandBuilder()
    .setName('kalkulator')
    .setDescription('Oblicz, ile otrzymasz po wymianie')
    .setDMPermission(false)
    .addNumberOption((o) => o.setName('kwota').setDescription('Kwota w PLN').setMinValue(1).setRequired(true))
    .addStringOption((o) => methodOption(o, 'od', 'Metoda wysyłki'))
    .addStringOption((o) => methodOption(o, 'do', 'Metoda odbioru')),
  async (i) => {
    const from = i.options.getString('od');
    const to = i.options.getString('do');
    if (from === to) return replyFail(i, 'Metody muszą być różne.');
    const q = quote(i.options.getNumber('kwota'), feeFor(i.guildId, from, to, defaultFee));
    await i.reply({ components: [calculator(from, to, q)], flags: V2_EPHEMERAL });
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
    if (sub === 'zamknij') return closeTicket(i, i.options.getString('powod'));
    if (!isStaff(i.member, guild(i.guildId).settings)) return replyFail(i, 'Tylko staff może to zrobić.');

    if (sub === 'nazwa') {
      const name = i.options.getString('nazwa');
      await i.channel.setName(name);
      return replyOk(i, `Zmieniono nazwę na **${name}**`, V2);
    }
    const user = i.options.getUser('uzytkownik');
    if (sub === 'dodaj') {
      await i.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        ReadMessageHistory: true,
      });
      return replyOk(i, `Dodano ${user} do ticketu`, V2);
    }
    if (user.id === ticket.userId) return replyFail(i, 'Nie można usunąć autora ticketu.');
    await i.channel.permissionOverwrites.delete(user.id);
    return replyOk(i, `Usunięto ${user} z ticketu`, V2);
  },
);

command(
  new SlashCommandBuilder()
    .setName('statystyki')
    .setDescription('Statystyki ticketów i ocen')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  (i) => i.reply({ components: [statsView(guild(i.guildId))], flags: V2_EPHEMERAL, allowedMentions: { parse: [] } }),
);

command(
  new SlashCommandBuilder()
    .setName('ogloszenie')
    .setDescription('Wyślij ładne ogłoszenie w bieżącym kanale')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  (i) => i.showModal(announcementModal()),
);

async function onAnnouncement(i) {
  const image = i.fields.getTextInputValue('image').trim();
  if (image && !/^https?:\/\/\S+$/.test(image)) return replyFail(i, 'Link do obrazka musi zaczynać się od http(s)://');
  await i.channel.send({
    components: [
      announcement({
        title: i.fields.getTextInputValue('title'),
        body: i.fields.getTextInputValue('body'),
        image: image || null,
        author: i.user.displayName,
      }),
    ],
    flags: V2,
  });
  await replyOk(i, 'Ogłoszenie wysłane.');
}

// ═══ ROUTING INTERAKCJI ══════════════════════════════════════════════════

async function route(i) {
  if (i.isChatInputCommand()) return commands.get(i.commandName)?.execute(i);

  const [scope, action, ...args] = i.customId?.split(':') ?? [];

  if (scope === 'rate' && i.isButton()) return onRate(i, action, args[0], Number(args[1]));
  if (scope === 'ann' && i.isModalSubmit()) return onAnnouncement(i);
  if (scope !== 'tk' || !i.inGuild()) return;

  if (i.isStringSelectMenu()) {
    if (action === 'open') return onSelectType(i);
    if (action === 'status') return onStatus(i);
  }
  if (i.isModalSubmit()) {
    if (action === 'form') return onForm(i, args[0]);
    if (action === 'closereason') return closeTicket(i, i.fields.getTextInputValue('reason'));
  }
  if (i.isButton()) {
    switch (action) {
      case 'rates':
        return i.reply({ components: [ratesView(guild(i.guildId).rates)], flags: V2_EPHEMERAL });
      case 'mine':
        return i.reply({ components: [myTickets(openTicketsOf(i.guildId, i.user.id))], flags: V2_EPHEMERAL });
      case 'claim':
        return onClaim(i);
      case 'close':
        return onCloseRequest(i);
      case 'closeyes':
        return closeTicket(i);
      case 'closewhy':
        return i.showModal(closeReasonModal());
      case 'transcript':
        return onTranscript(i);
    }
  }
}

// ═══ SPRAWDZENIE OFFLINE (node index.js --check) ═════════════════════════

function selfTest() {
  const fakeUser = { displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' };
  const fakeGuild = { iconURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png' };
  const base = { channelId: '1', number: 7, userId: '2', openedAt: Date.now(), status: 'payment', claimedBy: '3' };
  const exchange = { ...base, type: 'exchange', form: { from: 'blik', to: 'ltc', ...quote(250, 8), notes: 'adres' } };
  const closed = { ...exchange, closedAt: Date.now(), closedBy: '3', closeReason: 'ok' };
  const others = Object.keys(ticketTypes).filter((t) => t !== 'exchange');

  const built = [
    ...[...commands.values()].map((c) => c.data),
    panel({ bannerUrl: 'https://example.com/banner.png' }, fakeGuild),
    panel({}, { iconURL: () => null }),
    ratesView({ 'blik>ltc': 8 }),
    ticketMessage(exchange, fakeUser),
    ...others.map((type) => ticketMessage({ ...base, type, claimedBy: null, form: { subject: 'Temat', details: 'Opis sprawy' } }, fakeUser)),
    exchangeModal(),
    ...others.map(generalModal),
    closeReasonModal(),
    announcementModal(),
    announcement({ title: 'T', body: 'B', image: 'https://example.com/a.png', author: 'x' }),
    closeConfirm(),
    closingNotice('3', 'powód'),
    closedLog(closed, 'Serwer'),
    ratingRequest(closed, '9'),
    ratedView(closed, 4),
    ratingLog(closed, 5),
    statsView({ tickets: { 1: closed }, stats: { opened: 1, closed: 1, ratings: [{ stars: 5 }] } }),
    myTickets([exchange]),
    calculator('blik', 'ltc', quote(100, 8)),
  ];
  for (const b of built) b.toJSON();
  console.log(`✅ ${built.length} komponentów/komend przeszło walidację`);
}

// ═══ START ═══════════════════════════════════════════════════════════════

if (process.argv.includes('--check')) {
  selfTest();
  process.exit(0);
}

// Token i ID serwera: z pliku config.json obok index.js albo ze zmiennych środowiskowych / .env.
const configFile = join(dirname(fileURLToPath(import.meta.url)), 'config.json');
const fileConfig = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || fileConfig.token;
const GUILD_ID = process.env.GUILD_ID || fileConfig.guildId;
if (!DISCORD_TOKEN || DISCORD_TOKEN === 'TUTAJ_WKLEJ_TOKEN') {
  console.error('Brak tokena. Wpisz go w config.json w polu "token" (albo ustaw DISCORD_TOKEN).');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Zalogowano jako ${c.user.tag}`);
  c.user.setActivity({ name: '💱 Exchange • /kalkulator', type: ActivityType.Custom });

  // Rejestracja komend przy każdym starcie: na serwerze GUILD_ID (od razu) albo globalnie.
  const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
  const rest = new REST().setToken(DISCORD_TOKEN);
  const registerGlobal = async () => {
    await rest.put(Routes.applicationCommands(c.user.id), { body });
    console.log(`✅ Zarejestrowano ${body.length} komend globalnie (mogą pojawić się z opóźnieniem do ~1h)`);
  };

  let guildId = GUILD_ID;
  if (guildId === c.user.id) {
    console.warn('⚠️ guildId to ID bota, a nie serwera. Kliknij PPM na ikonę serwera → „Kopiuj ID serwera”.');
    guildId = null;
  }
  try {
    if (!guildId) return await registerGlobal();
    await rest.put(Routes.applicationGuildCommands(c.user.id, guildId), { body });
    console.log(`✅ Zarejestrowano ${body.length} komend na serwerze ${guildId}`);
  } catch (err) {
    if (err.code === 50001) {
      console.warn(
        `⚠️ Brak dostępu do serwera ${guildId}. Sprawdź, czy to ID serwera i czy bot jest na nim ` +
          'z zakresem applications.commands. Rejestruję komendy globalnie.',
      );
      return registerGlobal().catch((e) => console.error('Rejestracja komend nie powiodła się:', e.message));
    }
    console.error('Rejestracja komend nie powiodła się:', err.message);
  }
});

const knownErrors = {
  50001: 'Bot nie ma dostępu do tego kanału lub serwera.',
  50013: 'Bot nie ma wymaganych uprawnień. Nadaj mu uprawnienia z README (najprościej rolę z Administratorem) i przesuń jego rolę wyżej.',
  50035: 'Discord odrzucił wiadomość (nieprawidłowe dane, np. zły link do obrazka).',
  10003: 'Kanał nie istnieje. Sprawdź konfigurację w `/setup`.',
};

function describeError(err) {
  const hint = knownErrors[err?.code] ?? 'Coś poszło nie tak. Spróbuj ponownie.';
  const detail = String(err?.message ?? err).slice(0, 300);
  return `${hint}\n-# Szczegóły: \`${err?.code ?? 'brak kodu'}\` ${detail.replace(/`/g, "'")}`;
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    await route(i);
  } catch (err) {
    console.error(err);
    if (!i.isRepliable()) return;
    const payload = { components: [fail(describeError(err))], flags: V2_EPHEMERAL };
    if (i.deferred || i.replied) await i.followUp(payload).catch(() => {});
    else await i.reply(payload).catch(() => {});
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flush();
    client.destroy();
    process.exit(0);
  });
}

client.login(DISCORD_TOKEN);
