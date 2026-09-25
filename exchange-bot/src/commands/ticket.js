import { SlashCommandBuilder } from 'discord.js';
import { getTicket, guild } from '../db.js';
import { closeTicket, isStaff } from '../handlers/tickets.js';
import * as ui from '../ui.js';

export const data = new SlashCommandBuilder()
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
  );

export async function execute(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) {
    return i.reply({ components: [ui.fail('Tej komendy używa się w kanale ticketu.')], flags: ui.V2_EPHEMERAL });
  }
  const sub = i.options.getSubcommand();
  if (sub === 'zamknij') return closeTicket(i, i.options.getString('powod'));

  if (!isStaff(i.member, guild(i.guildId).settings)) {
    return i.reply({ components: [ui.fail('Tylko staff może to zrobić.')], flags: ui.V2_EPHEMERAL });
  }

  if (sub === 'nazwa') {
    const name = i.options.getString('nazwa');
    await i.channel.setName(name);
    return i.reply({ components: [ui.ok(`Zmieniono nazwę na **${name}**`)], flags: ui.V2 });
  }

  const user = i.options.getUser('uzytkownik');
  if (sub === 'dodaj') {
    await i.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      AttachFiles: true,
      ReadMessageHistory: true,
    });
    return i.reply({ components: [ui.ok(`Dodano ${user} do ticketu`)], flags: ui.V2 });
  }
  if (user.id === ticket.userId) {
    return i.reply({ components: [ui.fail('Nie można usunąć autora ticketu.')], flags: ui.V2_EPHEMERAL });
  }
  await i.channel.permissionOverwrites.delete(user.id);
  return i.reply({ components: [ui.ok(`Usunięto ${user} z ticketu`)], flags: ui.V2 });
}
