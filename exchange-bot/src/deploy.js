import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Uzupełnij DISCORD_TOKEN i CLIENT_ID w pliku .env');
  process.exit(1);
}

const body = [...commands.values()].map((c) => c.data.toJSON());
const rest = new REST().setToken(DISCORD_TOKEN);
const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID);

await rest.put(route, { body });
console.log(`✅ Zarejestrowano ${body.length} komend ${GUILD_ID ? `na serwerze ${GUILD_ID}` : 'globalnie'}`);
