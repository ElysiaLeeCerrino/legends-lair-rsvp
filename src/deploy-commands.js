require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('bot-info')
    .setDescription('Show information about the Legends Lair RSVP Bot'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show the bot command help'),
  new SlashCommandBuilder()
    .setName('event-create')
    .setDescription('Create a basic RSVP event in this channel')
    .addStringOption(option =>
      option.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(option =>
      option.setName('when').setDescription('Date and time text, e.g. Saturday 7pm').setRequired(true))
    .addIntegerOption(option =>
      option.setName('capacity').setDescription('Maximum number of Going RSVPs').setMinValue(1).setRequired(false))
].map(command => command.toJSON());

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID environment variable.');
  }
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  console.log('Registering Legends Lair RSVP slash commands...');
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Successfully registered slash commands.');
}
main().catch(error => { console.error('Command registration failed:', error); process.exit(1); });
