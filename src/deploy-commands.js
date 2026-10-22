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
    .setDescription('Create an RSVP event in this channel (optionally on Google Calendar)')
    .addStringOption(option =>
      option.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(option =>
      option.setName('when').setDescription('Human-readable when text, e.g. Saturday 7pm').setRequired(true))
    .addStringOption(option =>
      option
        .setName('start')
        .setDescription('Start time for Google Calendar, e.g. 2026-10-25T19:00 or 2026-10-25 19:00')
        .setRequired(false))
    .addStringOption(option =>
      option
        .setName('end')
        .setDescription('End time for Google Calendar (default: 2 hours after start)')
        .setRequired(false))
    .addStringOption(option =>
      option
        .setName('timezone')
        .setDescription('IANA timezone, e.g. Europe/London (default from env)')
        .setRequired(false))
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
main().catch(error => {
  console.error('Command registration failed:', error);
  process.exit(1);
});
