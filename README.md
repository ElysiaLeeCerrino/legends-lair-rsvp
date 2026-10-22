# Legends Lair RSVP Bot

Discord.js RSVP bot with optional **Google Calendar** integration. Events and RSVPs are stored in SQLite. When Google Calendar is configured, `/event-create` can also create a calendar event and keep its description updated with live RSVP counts.

## Features
- `/bot-info`, `/help`, `/event-create`
- RSVP buttons: Going · Maybe · Can't Go
- Optional capacity limit
- Optional Google Calendar event creation + description sync
- Health endpoint for Render (`/` and `/health`)

## Setup

### 1. Discord
1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy **Application ID** → `CLIENT_ID`.
3. Copy bot token → `DISCORD_TOKEN` (keep private).
4. Copy your server ID → `GUILD_ID`.
5. Invite the bot with scopes `bot` + `applications.commands` and permissions: Send Messages, Embed Links, Read Message History.

### 2. Environment
Copy `.env.example` to `.env` and fill in values.

```bash
npm install
npm run deploy-commands
npm start
```

### 3. Google Calendar (optional)

The bot works without Calendar. To enable it:

1. In [Google Cloud Console](https://console.cloud.google.com/):
   - Create or select a project.
   - Enable **Google Calendar API**.
   - Create a **Service Account**.
   - Create a JSON key for that service account and download it.
2. Open the Google Calendar you want to use → **Settings and sharing** → **Share with specific people**.
   - Add the service account email (looks like `name@project.iam.gserviceaccount.com`).
   - Permission: **Make changes to events**.
3. Calendar ID:
   - For your primary calendar: use `primary`, **or**
   - In calendar settings, copy the Calendar ID (often an email-like address).
4. Put these in `.env` / Render environment variables:
   - `GOOGLE_CLIENT_EMAIL` — from the JSON (`client_email`)
   - `GOOGLE_PRIVATE_KEY` — from the JSON (`private_key`). Keep the `\n` sequences or paste with real newlines inside quotes.
   - `GOOGLE_CALENDAR_ID` — e.g. `primary` or the shared calendar ID
   - `GOOGLE_CALENDAR_TIMEZONE` — e.g. `Europe/London` (default)

**Security:** Never commit the service-account JSON or private key to GitHub.

### 4. Deploy on Render
1. Connect this GitHub repository as a Web Service.
2. Build: `npm install` · Start: `npm start`
3. Set environment variables: Discord + (optional) Google ones above.
4. For persistent RSVP data, attach a disk mounted at `/opt/render/project/src/data` if your plan supports it.

After deploy, run `npm run deploy-commands` once with the same env vars (locally or via a one-off job) so slash commands are registered.

## Using `/event-create`

| Option | Required | Purpose |
|--------|----------|---------|
| `title` | yes | Event name |
| `when` | yes | Human text shown in Discord (e.g. `Saturday 7pm`) |
| `start` | no | Calendar start, e.g. `2026-10-25T19:00` or `2026-10-25 19:00` |
| `end` | no | Calendar end (default: 2 hours after start) |
| `timezone` | no | IANA zone (default from env) |
| `capacity` | no | Max “Going” RSVPs |

If Calendar is configured **and** you pass a valid `start`, a Google Calendar event is created and linked in the Discord embed. RSVP changes update the calendar description.

## Notes
- This is a recovery-oriented starter, not a full restore of any previous private bot.
- Do not upload `.env`, bot tokens, or Google private keys to GitHub.
