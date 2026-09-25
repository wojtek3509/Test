import { SlashCommandBuilder } from 'discord.js';
import { defaultFee, methods } from '../config.js';
import { feeFor } from '../db.js';
import * as ui from '../ui.js';

const methodChoices = Object.entries(methods).map(([value, m]) => ({ name: m.label, value }));

export const data = new SlashCommandBuilder()
  .setName('kalkulator')
  .setDescription('Oblicz, ile otrzymasz po wymianie')
  .setDMPermission(false)
  .addNumberOption((o) => o.setName('kwota').setDescription('Kwota w PLN').setMinValue(1).setRequired(true))
  .addStringOption((o) => o.setName('od').setDescription('Metoda wysyłki').addChoices(...methodChoices).setRequired(true))
  .addStringOption((o) => o.setName('do').setDescription('Metoda odbioru').addChoices(...methodChoices).setRequired(true));

export async function execute(i) {
  const from = i.options.getString('od');
  const to = i.options.getString('do');
  if (from === to) return i.reply({ components: [ui.fail('Metody muszą być różne.')], flags: ui.V2_EPHEMERAL });
  const q = ui.quote(i.options.getNumber('kwota'), feeFor(i.guildId, from, to, defaultFee));
  await i.reply({ components: [ui.calculator(from, to, q)], flags: ui.V2_EPHEMERAL });
}
