import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');

let data = { guilds: {} };
if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf8'));

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

export function flush() {
  clearTimeout(timer);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${file}.tmp`, file);
}

export function guild(id) {
  data.guilds[id] ??= {
    settings: { categoryId: null, staffRoleId: null, logChannelId: null, bannerUrl: null, maxOpen: 1 },
    counter: 0,
    rates: {},
    tickets: {},
    stats: { opened: 0, closed: 0, ratings: [] },
  };
  return data.guilds[id];
}

export function updateGuild(id, fn) {
  const g = guild(id);
  fn(g);
  save();
  return g;
}

export function getTicket(guildId, channelId) {
  return guild(guildId).tickets[channelId] ?? null;
}

export function openTicketsOf(guildId, userId) {
  return Object.values(guild(guildId).tickets).filter((t) => t.userId === userId && !t.closedAt);
}

export function feeFor(guildId, from, to, fallback) {
  return guild(guildId).rates[`${from}>${to}`] ?? fallback;
}
