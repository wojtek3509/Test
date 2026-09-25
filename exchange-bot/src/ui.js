import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { brand, colors, defaultFee, methods, statuses, ticketTypes } from './config.js';

export const V2 = MessageFlags.IsComponentsV2;
export const V2_EPHEMERAL = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const ts = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;
const money = (n) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const methodName = (key) => (methods[key] ? `${methods[key].emoji} ${methods[key].label}` : key);

export function parseAmount(raw) {
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function quote(amount, fee) {
  const receive = amount * (1 - fee / 100);
  return { amount, fee, receive: Math.max(0, Math.round(receive * 100) / 100) };
}

const separator = (c, large = false) =>
  c.addSeparatorComponents((s) => s.setDivider(true).setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small));

const footer = (c) => c.addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));

/** Small single-color notice, used for replies and errors. */
export function notice(text, color = colors.primary) {
  return new ContainerBuilder().setAccentColor(color).addTextDisplayComponents((t) => t.setContent(text));
}

export const ok = (text) => notice(`### ✅ ${text}`, colors.success);
export const fail = (text) => notice(`### ❌ Błąd\n${text}`, colors.danger);

// ─── Panel ─────────────────────────────────────────────────────────────

export function panel(settings, guild) {
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

  if (guild?.iconURL()) {
    c.addSectionComponents((s) =>
      s.addTextDisplayComponents((t) => t.setContent(header)).setThumbnailAccessory((th) => th.setURL(guild.iconURL({ size: 256 }))),
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

export function ratesView(rates) {
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

export function exchangeModal() {
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

export function generalModal(type) {
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

export function closeReasonModal() {
  return new ModalBuilder()
    .setCustomId('tk:closereason')
    .setTitle('🔒 Zamknij ticket')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Powód zamknięcia')
        .setTextInputComponent(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setMaxLength(300)),
    );
}

export function announcementModal() {
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

export function announcement({ title, body, image, color = colors.primary, author }) {
  const c = new ContainerBuilder().setAccentColor(color).addTextDisplayComponents((t) => t.setContent(`# ${title}\n${body}`));
  if (image) c.addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(image)));
  separator(c);
  return c.addTextDisplayComponents((t) => t.setContent(`-# 📣 ${author} • ${brand.name}`));
}

// ─── Ticket ────────────────────────────────────────────────────────────

export function ticketMessage(ticket, user) {
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

export function closeConfirm() {
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

export function closingNotice(by, reason) {
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

export function closedLog(ticket, guildName) {
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

export const transcriptName = (ticket) => `transcript-${String(ticket.number).padStart(4, '0')}.html`;

export function ratingRequest(ticket, guildId) {
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

export function ratedView(ticket, stars) {
  const c = closedLog(ticket, 'Dziękujemy za skorzystanie z naszych usług!');
  separator(c, true);
  return c.addTextDisplayComponents((t) => t.setContent(`### 💛 Dziękujemy za ocenę!\nTwoja ocena: ${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}`));
}

export function ratingLog(ticket, stars) {
  return notice(
    `### ⭐ Nowa ocena: ${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}\n` +
      `<@${ticket.userId}> ocenił ticket **#${String(ticket.number).padStart(4, '0')}**` +
      (ticket.claimedBy ? ` obsługiwany przez <@${ticket.claimedBy}>` : ''),
    colors.gold,
  );
}

export function statsView(g) {
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

export function myTickets(list) {
  const lines = list.length
    ? list.map((t) => `${ticketTypes[t.type].emoji} <#${t.channelId}> · otwarty ${ts(t.openedAt)}`)
    : ['*Nie masz otwartych ticketów.*'];
  return notice(`### 🗂️ Twoje tickety\n${lines.join('\n')}`);
}

export function calculator(from, to, q) {
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

export { methodName };
