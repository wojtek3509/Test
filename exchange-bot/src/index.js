import 'dotenv/config';
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import { commands, ogloszenie } from './commands/index.js';
import { flush, guild, openTicketsOf } from './db.js';
import * as tickets from './handlers/tickets.js';
import * as ui from './ui.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Zalogowano jako ${c.user.tag}`);
  c.user.setActivity({ name: '💱 Exchange • /kalkulator', type: ActivityType.Custom });
});

async function route(i) {
  if (i.isChatInputCommand()) return commands.get(i.commandName)?.execute(i);

  const [scope, action, ...args] = i.customId?.split(':') ?? [];

  if (scope === 'rate' && i.isButton()) return tickets.onRate(i, action, args[0], Number(args[1]));
  if (scope === 'ann' && i.isModalSubmit()) return ogloszenie.onSubmit(i);
  if (scope !== 'tk' || !i.inGuild()) return;

  if (i.isStringSelectMenu()) {
    if (action === 'open') return tickets.onSelectType(i);
    if (action === 'status') return tickets.onStatus(i);
  }
  if (i.isModalSubmit()) {
    if (action === 'form') return tickets.onForm(i, args[0]);
    if (action === 'closereason') return tickets.closeTicket(i, i.fields.getTextInputValue('reason'));
  }
  if (i.isButton()) {
    switch (action) {
      case 'rates':
        return i.reply({ components: [ui.ratesView(guild(i.guildId).rates)], flags: ui.V2_EPHEMERAL });
      case 'mine':
        return i.reply({ components: [ui.myTickets(openTicketsOf(i.guildId, i.user.id))], flags: ui.V2_EPHEMERAL });
      case 'claim':
        return tickets.onClaim(i);
      case 'close':
        return tickets.onCloseRequest(i);
      case 'closeyes':
        return tickets.closeTicket(i);
      case 'closewhy':
        return i.showModal(ui.closeReasonModal());
      case 'transcript':
        return tickets.onTranscript(i);
    }
  }
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    await route(i);
  } catch (err) {
    console.error(err);
    if (!i.isRepliable()) return;
    const payload = { components: [ui.fail('Coś poszło nie tak. Spróbuj ponownie.')], flags: ui.V2_EPHEMERAL };
    if (i.deferred || i.replied) await i.followUp(payload).catch(() => {});
    else await i.reply(payload).catch(() => {});
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flush();
    client.destroy();
    process.exit(0);
  });
}

if (!process.env.DISCORD_TOKEN) {
  console.error('Brak DISCORD_TOKEN w pliku .env (skopiuj .env.example).');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
