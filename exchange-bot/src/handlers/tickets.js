import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { createTranscript } from 'discord-html-transcripts';
import { defaultFee, statuses, ticketTypes } from '../config.js';
import { feeFor, getTicket, guild, openTicketsOf, updateGuild } from '../db.js';
import * as ui from '../ui.js';

const replyV2 = (i, container) => i.reply({ components: [container], flags: ui.V2_EPHEMERAL });

export function isStaff(member, settings) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    (settings.staffRoleId && member.roles.cache.has(settings.staffRoleId))
  );
}

// ─── Opening ───────────────────────────────────────────────────────────

export async function onSelectType(i) {
  const type = i.values[0];
  const { settings } = guild(i.guildId);
  if (!settings.categoryId) return replyV2(i, ui.fail('Bot nie jest skonfigurowany. Administrator musi użyć `/setup`.'));

  const open = openTicketsOf(i.guildId, i.user.id);
  if (open.length >= settings.maxOpen) {
    return replyV2(i, ui.fail(`Masz już otwarty ticket: ${open.map((t) => `<#${t.channelId}>`).join(', ')}`));
  }

  await i.showModal(type === 'exchange' ? ui.exchangeModal() : ui.generalModal(type));
  // Re-render the panel so the select resets and the same category can be picked again.
  await i.message.edit({ components: [ui.panel(settings, i.guild)], flags: ui.V2 }).catch(() => {});
}

export async function onForm(i, type) {
  const { settings } = guild(i.guildId);
  let form;
  if (type === 'exchange') {
    const from = i.fields.getStringSelectValues('from')[0];
    const to = i.fields.getStringSelectValues('to')[0];
    const amount = ui.parseAmount(i.fields.getTextInputValue('amount'));
    if (!amount) return replyV2(i, ui.fail('Podaj poprawną kwotę, np. `250` lub `99,50`.'));
    if (from === to) return replyV2(i, ui.fail('Metoda wysyłki i odbioru muszą być różne.'));
    const q = ui.quote(amount, feeFor(i.guildId, from, to, defaultFee));
    form = { from, to, ...q, notes: i.fields.getTextInputValue('notes') || null };
  } else {
    form = { subject: i.fields.getTextInputValue('subject'), details: i.fields.getTextInputValue('details') };
  }

  // Re-check the limit: two modals could have been open at the same time.
  if (openTicketsOf(i.guildId, i.user.id).length >= settings.maxOpen) {
    return replyV2(i, ui.fail('Osiągnięto limit otwartych ticketów.'));
  }

  await i.deferReply({ flags: ui.V2_EPHEMERAL });

  const number = updateGuild(i.guildId, (g) => g.counter++).counter;
  const tt = ticketTypes[type];
  const overwrites = [
    { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: i.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: i.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (settings.staffRoleId) {
    overwrites.push({
      id: settings.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  let channel;
  try {
    channel = await i.guild.channels.create({
      name: `${tt.prefix}-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: settings.categoryId,
      topic: `${tt.emoji} ${tt.label} • ${i.user.tag} (${i.user.id})`,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    console.error(err);
    return i.editReply({ components: [ui.fail('Nie udało się utworzyć kanału. Sprawdź uprawnienia bota i kategorię.')], flags: ui.V2 });
  }

  const ticket = {
    channelId: channel.id,
    number,
    type,
    userId: i.user.id,
    openedAt: Date.now(),
    status: 'waiting',
    claimedBy: null,
    form,
  };

  const message = await channel.send({ components: [ui.ticketMessage(ticket, i.user)], flags: ui.V2 });
  ticket.messageId = message.id;
  await message.pin().catch(() => {});

  updateGuild(i.guildId, (g) => {
    g.tickets[channel.id] = ticket;
    g.stats.opened++;
  });

  const ping = [`<@${i.user.id}>`, settings.staffRoleId && `<@&${settings.staffRoleId}>`].filter(Boolean).join(' ');
  const pingMsg = await channel.send({ content: ping, allowedMentions: { users: [i.user.id], roles: [settings.staffRoleId].filter(Boolean) } });
  setTimeout(() => pingMsg.delete().catch(() => {}), 3000);

  await i.editReply({ components: [ui.ok(`Ticket utworzony: ${channel}`)], flags: ui.V2 });
}

// ─── Staff actions ─────────────────────────────────────────────────────

function staffTicket(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return { error: 'To nie jest aktywny kanał ticketu.' };
  const { settings } = guild(i.guildId);
  if (!isStaff(i.member, settings)) return { error: 'Tylko staff może to zrobić.' };
  return { ticket, settings };
}

export async function onClaim(i) {
  const { ticket, error } = staffTicket(i);
  if (error) return replyV2(i, ui.fail(error));
  if (ticket.claimedBy) return replyV2(i, ui.fail(`Ticket jest już przejęty przez <@${ticket.claimedBy}>.`));

  updateGuild(i.guildId, (g) => {
    g.tickets[i.channelId].claimedBy = i.user.id;
    if (g.tickets[i.channelId].status === 'waiting') g.tickets[i.channelId].status = ticket.type === 'exchange' ? 'payment' : 'processing';
  });
  const user = await i.client.users.fetch(ticket.userId);
  await i.update({ components: [ui.ticketMessage(getTicket(i.guildId, i.channelId), user)], flags: ui.V2 });
  await i.channel.send({ components: [ui.notice(`### 🙋 <@${i.user.id}> przejął ticket i zajmie się Tobą.`)], flags: ui.V2 });
}

export async function onStatus(i) {
  const { ticket, error } = staffTicket(i);
  if (error) return replyV2(i, ui.fail(error));
  const status = i.values[0];
  updateGuild(i.guildId, (g) => {
    g.tickets[i.channelId].status = status;
    g.tickets[i.channelId].claimedBy ??= i.user.id;
  });
  const user = await i.client.users.fetch(ticket.userId);
  await i.update({ components: [ui.ticketMessage(getTicket(i.guildId, i.channelId), user)], flags: ui.V2 });
  const s = statuses[status];
  await i.channel.send({
    components: [ui.notice(`### ${s.emoji} Status: ${s.label}\n<@${ticket.userId}>, status Twojej wymiany został zaktualizowany.`, s.color)],
    flags: ui.V2,
  });
}

export async function onTranscript(i) {
  const { ticket, error } = staffTicket(i);
  if (error) return replyV2(i, ui.fail(error));
  await i.deferReply({ flags: ui.V2_EPHEMERAL });
  const file = await createTranscript(i.channel, { filename: ui.transcriptName(ticket), poweredBy: false, saveImages: true });
  await i.editReply({ components: [ui.ok('Transcript wygenerowany.')], files: [file], flags: ui.V2 });
}

// ─── Closing ───────────────────────────────────────────────────────────

export async function onCloseRequest(i) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return replyV2(i, ui.fail('To nie jest aktywny kanał ticketu.'));
  const { settings } = guild(i.guildId);
  if (ticket.userId !== i.user.id && !isStaff(i.member, settings)) return replyV2(i, ui.fail('Nie możesz zamknąć tego ticketu.'));
  await replyV2(i, ui.closeConfirm());
}

export async function closeTicket(i, reason = null) {
  const ticket = getTicket(i.guildId, i.channelId);
  if (!ticket || ticket.closedAt) return replyV2(i, ui.fail('Ten ticket jest już zamykany.'));
  const { settings } = guild(i.guildId);
  if (ticket.userId !== i.user.id && !isStaff(i.member, settings)) return replyV2(i, ui.fail('Nie możesz zamknąć tego ticketu.'));

  updateGuild(i.guildId, (g) => {
    Object.assign(g.tickets[i.channelId], { closedAt: Date.now(), closedBy: i.user.id, closeReason: reason });
    g.stats.closed++;
  });

  await i.reply({ components: [ui.closingNotice(i.user.id, reason)], flags: ui.V2 });

  const closed = getTicket(i.guildId, i.channelId);
  const channel = i.channel;
  const transcript = await createTranscript(channel, { filename: ui.transcriptName(closed), poweredBy: false, saveImages: true });

  try {
    if (settings.logChannelId) {
      const log = await i.guild.channels.fetch(settings.logChannelId);
      await log.send({ components: [ui.closedLog(closed, i.guild.name)], files: [transcript], flags: ui.V2, allowedMentions: { parse: [] } });
    }
  } catch (err) {
    console.error('Log failed:', err);
  }

  try {
    const user = await i.client.users.fetch(closed.userId);
    await user.send({ components: [ui.ratingRequest(closed, i.guildId)], files: [transcript], flags: ui.V2 });
  } catch {
    // DMs closed — nothing to do.
  }

  setTimeout(() => channel.delete(`Ticket zamknięty przez ${i.user.tag}`).catch(console.error), 5000);
}

export async function onRate(i, guildId, channelId, stars) {
  const ticket = getTicket(guildId, channelId);
  if (!ticket || ticket.userId !== i.user.id) return replyV2(i, ui.fail('Nie można ocenić tego ticketu.'));
  if (ticket.rating) return replyV2(i, ui.fail('Ten ticket został już oceniony.'));

  updateGuild(guildId, (g) => {
    g.tickets[channelId].rating = stars;
    g.stats.ratings.push({ stars, staffId: ticket.claimedBy, at: Date.now() });
  });
  await i.update({ components: [ui.ratedView(getTicket(guildId, channelId), stars)], flags: ui.V2 });

  const { settings } = guild(guildId);
  if (!settings.logChannelId) return;
  try {
    const log = await i.client.channels.fetch(settings.logChannelId);
    await log.send({ components: [ui.ratingLog(ticket, stars)], flags: ui.V2, allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('Rating log failed:', err);
  }
}
