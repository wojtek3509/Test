import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import * as ui from '../ui.js';

export const data = new SlashCommandBuilder()
  .setName('ogloszenie')
  .setDescription('Wyślij ładne ogłoszenie w bieżącym kanale')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(i) {
  await i.showModal(ui.announcementModal());
}

export async function onSubmit(i) {
  const image = i.fields.getTextInputValue('image').trim();
  if (image && !/^https?:\/\/\S+$/.test(image)) {
    return i.reply({ components: [ui.fail('Link do obrazka musi zaczynać się od http(s)://')], flags: ui.V2_EPHEMERAL });
  }
  await i.channel.send({
    components: [
      ui.announcement({
        title: i.fields.getTextInputValue('title'),
        body: i.fields.getTextInputValue('body'),
        image: image || null,
        author: i.user.displayName,
      }),
    ],
    flags: ui.V2,
  });
  await i.reply({ components: [ui.ok('Ogłoszenie wysłane.')], flags: ui.V2_EPHEMERAL });
}
