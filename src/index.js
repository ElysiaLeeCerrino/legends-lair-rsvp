require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const {
  Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const calendar = require('./calendar');

const { DISCORD_TOKEN, PORT = 10000 } = process.env;
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is missing. Add it to Render Environment Variables or your local .env file.');
  process.exit(1);
}

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'legends-lair.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    title TEXT NOT NULL,
    when_text TEXT NOT NULL,
    capacity INTEGER,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    google_event_id TEXT,
    google_html_link TEXT
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    choice TEXT NOT NULL CHECK(choice IN ('going','maybe','cant_go')),
    PRIMARY KEY (event_id, user_id)
  );
`);

// Lightweight migrations for existing databases
try { db.exec('ALTER TABLE events ADD COLUMN google_event_id TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE events ADD COLUMN google_html_link TEXT'); } catch (_) {}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();
app.get('/', (_req, res) => res.status(200).send('Legends Lair RSVP Bot is running.'));
app.get('/health', (_req, res) =>
  res.status(200).json({
    status: 'ok',
    discordReady: client.isReady(),
    googleCalendar: calendar.isConfigured()
  })
);
app.listen(Number(PORT), '0.0.0.0', () => console.log(`Health endpoint listening on ${PORT}.`));

const eventById = db.prepare('SELECT * FROM events WHERE id = ?');
const rsvpCounts = db.prepare(`
  SELECT choice, COUNT(*) AS count FROM rsvps WHERE event_id = ? GROUP BY choice
`);
const getRsvp = db.prepare('SELECT choice FROM rsvps WHERE event_id = ? AND user_id = ?');
const setRsvp = db.prepare(`
  INSERT INTO rsvps(event_id, user_id, choice) VALUES (?, ?, ?)
  ON CONFLICT(event_id, user_id) DO UPDATE SET choice = excluded.choice
`);
const removeRsvp = db.prepare('DELETE FROM rsvps WHERE event_id = ? AND user_id = ?');
const updateGoogleFields = db.prepare(
  'UPDATE events SET google_event_id = ?, google_html_link = ? WHERE id = ?'
);

function countsFor(eventId) {
  const rows = rsvpCounts.all(eventId);
  const counts = { going: 0, maybe: 0, cant_go: 0 };
  for (const row of rows) counts[row.choice] = row.count;
  return counts;
}

function rsvpDescription(event, counts) {
  const lines = [
    `Discord RSVP event (ID ${event.id})`,
    `When: ${event.when_text}`,
    '',
    `Going: ${counts.going}${event.capacity ? ` / ${event.capacity}` : ''}`,
    `Maybe: ${counts.maybe}`,
    `Can't Go: ${counts.cant_go}`,
    '',
    'RSVP via the Discord message buttons.'
  ];
  return lines.join('\n');
}

function eventEmbed(event, counts) {
  const embed = new EmbedBuilder()
    .setTitle(event.title)
    .setDescription(`**When:** ${event.when_text}`)
    .addFields(
      { name: 'Going', value: String(counts.going), inline: true },
      { name: 'Maybe', value: String(counts.maybe), inline: true },
      { name: "Can't Go", value: String(counts.cant_go), inline: true }
    )
    .setFooter({
      text: event.capacity
        ? `Capacity: ${event.capacity} • Event ID: ${event.id}`
        : `Event ID: ${event.id}`
    })
    .setColor(0x5865F2);

  if (event.google_html_link) {
    embed.addFields({
      name: 'Google Calendar',
      value: `[Open event](${event.google_html_link})`
    });
  }
  return embed;
}

function eventButtons(eventId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rsvp:${eventId}:going`).setLabel('Going').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rsvp:${eventId}:maybe`).setLabel('Maybe').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rsvp:${eventId}:cant_go`).setLabel("Can't Go").setStyle(ButtonStyle.Secondary)
  );
}

async function refreshEventMessage(event) {
  if (!event.message_id) return;
  try {
    const channel = await client.channels.fetch(event.channel_id);
    const message = await channel.messages.fetch(event.message_id);
    await message.edit({
      embeds: [eventEmbed(event, countsFor(event.id))],
      components: [eventButtons(event.id)]
    });
  } catch (err) {
    console.error('Failed to refresh event message:', err.message);
  }
}

async function syncCalendarDescription(event) {
  if (!event.google_event_id) return;
  try {
    await calendar.updateCalendarEventDescription(
      event.google_event_id,
      rsvpDescription(event, countsFor(event.id))
    );
  } catch (err) {
    console.error('Failed to update Google Calendar description:', err.message);
  }
}

client.once(Events.ClientReady, c => {
  console.log(`Logged in as ${c.user.tag}`);
  console.log(`Google Calendar: ${calendar.isConfigured() ? 'configured' : 'not configured (optional)'}`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'bot-info') {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Legends Lair RSVP Bot')
              .setDescription('RSVP bot with optional Google Calendar sync.')
              .addFields(
                { name: 'Commands', value: '`/bot-info`, `/help`, `/event-create`' },
                { name: 'Storage', value: 'SQLite (local data folder)' },
                {
                  name: 'Google Calendar',
                  value: calendar.isConfigured() ? 'Connected' : 'Not configured'
                }
              )
              .setColor(0x5865F2)
          ],
          ephemeral: true
        });
        return;
      }

      if (interaction.commandName === 'help') {
        await interaction.reply({
          content: [
            '**Legends Lair RSVP Bot — Help**',
            '',
            '`/bot-info` — About this bot',
            '`/help` — This message',
            '`/event-create` — Create an RSVP event in the current channel',
            '  • `title` (required) — Event name',
            '  • `when` (required) — Human-readable time, e.g. Saturday 7pm',
            '  • `start` (optional) — Calendar start, e.g. `2026-10-25T19:00`',
            '  • `end` (optional) — Calendar end (default +2 hours)',
            '  • `timezone` (optional) — e.g. Europe/London',
            '  • `capacity` (optional) — Max Going RSVPs',
            '',
            'After an event is created, use the buttons on the message to RSVP.',
            calendar.isConfigured()
              ? 'Google Calendar is connected: providing `start` will also create a calendar event.'
              : 'Google Calendar is not configured yet — Discord RSVP still works without it.'
          ].join('\n'),
          ephemeral: true
        });
        return;
      }

      if (interaction.commandName === 'event-create') {
        await interaction.deferReply({ ephemeral: true });
        const title = interaction.options.getString('title', true);
        const when = interaction.options.getString('when', true);
        const start = interaction.options.getString('start');
        const end = interaction.options.getString('end');
        const timezone = interaction.options.getString('timezone');
        const capacity = interaction.options.getInteger('capacity');

        const info = db.prepare(`
          INSERT INTO events (guild_id, channel_id, title, when_text, capacity, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          interaction.guildId,
          interaction.channelId,
          title,
          when,
          capacity,
          interaction.user.id
        );

        let event = eventById.get(info.lastInsertRowid);
        let calendarNote = '';

        if (start || calendar.isConfigured()) {
          try {
            const created = await calendar.createCalendarEvent({
              title,
              description: rsvpDescription(event, countsFor(event.id)),
              start,
              end,
              timezone
            });
            if (created && created.id) {
              updateGoogleFields.run(created.id, created.htmlLink || null, event.id);
              event = eventById.get(event.id);
              calendarNote = created.htmlLink
                ? `\nGoogle Calendar: ${created.htmlLink}`
                : '\nGoogle Calendar event created.';
            } else if (created && created.skipped) {
              calendarNote = `\n(Calendar skipped: ${created.reason})`;
            }
          } catch (err) {
            console.error('Google Calendar create failed:', err.message);
            calendarNote = `\n(Calendar error: ${err.message})`;
          }
        }

        const message = await interaction.channel.send({
          embeds: [eventEmbed(event, countsFor(event.id))],
          components: [eventButtons(event.id)]
        });
        db.prepare('UPDATE events SET message_id = ? WHERE id = ?').run(message.id, event.id);
        await interaction.editReply(
          `Created RSVP event **${title}** (ID ${event.id}) in this channel.${calendarNote}`
        );
        return;
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('rsvp:')) {
      await interaction.deferReply({ ephemeral: true });
      const [, eventIdText, choice] = interaction.customId.split(':');
      const eventId = Number(eventIdText);
      let event = eventById.get(eventId);
      if (!event) {
        await interaction.editReply('Sorry, this event could not be found.');
        return;
      }
      if (choice === 'going' && event.capacity) {
        const current = getRsvp.get(eventId, interaction.user.id);
        const count = countsFor(eventId).going;
        if ((!current || current.choice !== 'going') && count >= event.capacity) {
          await interaction.editReply(
            'This event is full. The waitlist feature is not included in this recovery starter.'
          );
          return;
        }
      }
      if (!['going', 'maybe', 'cant_go'].includes(choice)) {
        await interaction.editReply('That RSVP option is not recognised.');
        return;
      }
      if (choice === 'cant_go') removeRsvp.run(eventId, interaction.user.id);
      else setRsvp.run(eventId, interaction.user.id, choice);

      event = eventById.get(eventId);
      await refreshEventMessage(event);
      await syncCalendarDescription(event);

      const labels = {
        going: 'Going',
        maybe: 'Maybe',
        cant_go: "Can't Go (your RSVP was removed)"
      };
      await interaction.editReply(`Your response has been updated: **${labels[choice]}**.`);
    }
  } catch (error) {
    console.error('Interaction handler error:', error);
    const message =
      'Something went wrong while processing that interaction. Please check the bot logs.';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    } catch (replyError) {
      console.error('Could not send interaction error response:', replyError.message);
    }
  }
});

client.login(DISCORD_TOKEN).catch(error => {
  console.error('Discord login failed:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  try {
    db.close();
  } catch {}
  client.destroy();
  process.exit(0);
});
