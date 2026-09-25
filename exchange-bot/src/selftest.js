// Builds every command and UI component offline so Discord's validation errors show up before running the bot.
import { commands } from './commands/index.js';
import { ticketTypes } from './config.js';
import * as ui from './ui.js';

const fakeUser = { displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' };
const fakeGuild = { iconURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png' };
const settings = { bannerUrl: 'https://example.com/banner.png' };
const base = { channelId: '1', number: 7, userId: '2', openedAt: Date.now(), status: 'payment', claimedBy: '3' };
const exchange = { ...base, type: 'exchange', form: { from: 'blik', to: 'ltc', ...ui.quote(250, 8), notes: 'adres' } };
const closed = { ...exchange, closedAt: Date.now(), closedBy: '3', closeReason: 'ok' };

const built = [
  ...[...commands.values()].map((c) => c.data),
  ui.panel(settings, fakeGuild),
  ui.panel({}, { iconURL: () => null }),
  ui.ratesView({ 'blik>ltc': 8 }),
  ui.ticketMessage(exchange, fakeUser),
  ...Object.keys(ticketTypes)
    .filter((t) => t !== 'exchange')
    .map((type) => ui.ticketMessage({ ...base, type, claimedBy: null, form: { subject: 'Temat', details: 'Opis sprawy' } }, fakeUser)),
  ui.exchangeModal(),
  ...Object.keys(ticketTypes).filter((t) => t !== 'exchange').map(ui.generalModal),
  ui.closeReasonModal(),
  ui.announcementModal(),
  ui.announcement({ title: 'T', body: 'B', image: 'https://example.com/a.png', author: 'x' }),
  ui.closeConfirm(),
  ui.closingNotice('3', 'powód'),
  ui.closedLog(closed, 'Serwer'),
  ui.ratingRequest(closed, '9'),
  ui.ratedView(closed, 4),
  ui.ratingLog(closed, 5),
  ui.statsView({ tickets: { 1: closed }, stats: { opened: 1, closed: 1, ratings: [{ stars: 5 }] } }),
  ui.myTickets([exchange]),
  ui.calculator('blik', 'ltc', ui.quote(100, 8)),
];

for (const b of built) b.toJSON();
console.log(`✅ ${built.length} komponentów/komend przeszło walidację`);
