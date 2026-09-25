import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { methods } from '../config.js';
import { guild, updateGuild } from '../db.js';
import * as ui from '../ui.js';

const methodChoices = Object.entries(methods).map(([value, m]) => ({ name: m.label, value }));

export const data = new SlashCommandBuilder()
  .setName('kurs')
  .setDescription('Zarządzanie prowizjami wymian')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('ustaw')
      .setDescription('Ustaw prowizję dla kierunku wymiany')
      .addStringOption((o) => o.setName('od').setDescription('Metoda wysyłki').addChoices(...methodChoices).setRequired(true))
      .addStringOption((o) => o.setName('do').setDescription('Metoda odbioru').addChoices(...methodChoices).setRequired(true))
      .addNumberOption((o) => o.setName('prowizja').setDescription('Prowizja w %').setMinValue(0).setMaxValue(100).setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('usun')
      .setDescription('Usuń indywidualną prowizję')
      .addStringOption((o) => o.setName('od').setDescription('Metoda wysyłki').addChoices(...methodChoices).setRequired(true))
      .addStringOption((o) => o.setName('do').setDescription('Metoda odbioru').addChoices(...methodChoices).setRequired(true)),
  )
  .addSubcommand((s) => s.setName('lista').setDescription('Pokaż wszystkie prowizje'));

export async function execute(i) {
  const sub = i.options.getSubcommand();
  if (sub === 'lista') {
    return i.reply({ components: [ui.ratesView(guild(i.guildId).rates)], flags: ui.V2_EPHEMERAL });
  }
  const from = i.options.getString('od');
  const to = i.options.getString('do');
  if (from === to) return i.reply({ components: [ui.fail('Metody muszą być różne.')], flags: ui.V2_EPHEMERAL });
  const key = `${from}>${to}`;
  if (sub === 'ustaw') {
    const fee = i.options.getNumber('prowizja');
    updateGuild(i.guildId, (g) => (g.rates[key] = fee));
    return i.reply({ components: [ui.ok(`${ui.methodName(from)} ➜ ${ui.methodName(to)}: **${fee}%**`)], flags: ui.V2_EPHEMERAL });
  }
  updateGuild(i.guildId, (g) => delete g.rates[key]);
  return i.reply({ components: [ui.ok(`Usunięto prowizję ${ui.methodName(from)} ➜ ${ui.methodName(to)}`)], flags: ui.V2_EPHEMERAL });
}
