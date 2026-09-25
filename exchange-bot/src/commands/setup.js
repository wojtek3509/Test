import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { updateGuild } from '../db.js';
import * as ui from '../ui.js';

export const data = new SlashCommandBuilder()
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
  .addIntegerOption((o) => o.setName('limit').setDescription('Maks. otwartych ticketów na osobę').setMinValue(1).setMaxValue(10));

export async function execute(i) {
  const banner = i.options.getString('baner');
  if (banner && !/^https?:\/\/\S+$/.test(banner)) {
    return i.reply({ components: [ui.fail('Baner musi być linkiem http(s).')], flags: ui.V2_EPHEMERAL });
  }
  const g = updateGuild(i.guildId, (g) => {
    g.settings.categoryId = i.options.getChannel('kategoria').id;
    g.settings.staffRoleId = i.options.getRole('staff').id;
    g.settings.logChannelId = i.options.getChannel('logi').id;
    if (banner) g.settings.bannerUrl = banner;
    g.settings.maxOpen = i.options.getInteger('limit') ?? g.settings.maxOpen;
  });
  const s = g.settings;
  await i.reply({
    components: [
      ui.notice(
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
    flags: ui.V2_EPHEMERAL,
    allowedMentions: { parse: [] },
  });
}
