import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { guild } from '../db.js';
import * as ui from '../ui.js';

export const data = new SlashCommandBuilder()
  .setName('statystyki')
  .setDescription('Statystyki ticketów i ocen')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(i) {
  await i.reply({ components: [ui.statsView(guild(i.guildId))], flags: ui.V2_EPHEMERAL, allowedMentions: { parse: [] } });
}
