import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { guild } from '../db.js';
import * as ui from '../ui.js';

export const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Wyślij panel ticketów')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addChannelOption((o) => o.setName('kanal').setDescription('Kanał docelowy (domyślnie bieżący)').addChannelTypes(ChannelType.GuildText));

export async function execute(i) {
  const { settings } = guild(i.guildId);
  if (!settings.categoryId) return i.reply({ components: [ui.fail('Najpierw użyj `/setup`.')], flags: ui.V2_EPHEMERAL });
  const channel = i.options.getChannel('kanal') ?? i.channel;
  await channel.send({ components: [ui.panel(settings, i.guild)], flags: ui.V2 });
  await i.reply({ components: [ui.ok(`Panel wysłany na ${channel}`)], flags: ui.V2_EPHEMERAL });
}
