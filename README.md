# Legends Lair RSVP Bot — Recovery Starter

This is a **recovery starter project**, not a copy of the deleted GitHub repository. It provides a basic Discord.js bot with `/bot-info`, `/help`, `/event-create`, and persistent RSVP buttons backed by SQLite.

## Before you start
- This does not recover your old source code, database, or Google Calendar credentials.
- Google Calendar syncing and the full original command set are **not included** in this starter.
- Do not upload `.env`, bot tokens, client secrets, or credentials to GitHub.

## 1. Upload to GitHub
1. Create a new repository named `legends-lair-rsvp`.
2. Extract this ZIP on your computer.
3. Upload the files and folders inside the extracted folder to the repository root (not the ZIP itself).

## 2. Configure Discord
1. In the Discord Developer Portal, open your application.
2. Copy the **Application ID** for `CLIENT_ID`.
3. Reset/copy the bot token for `DISCORD_TOKEN` if needed. Keep it private.
4. Copy your Discord server ID for `GUILD_ID`.
5. In OAuth2 URL Generator, select `bot` and `applications.commands`; grant Send Messages, Embed Links, and Read Message History.
6. Locally, copy `.env.example` to `.env`, fill in the values, then run:
   - `npm install`
   - `npm run deploy-commands`
   - `npm start`

## 3. Deploy on Render
1. Create a new Web Service connected to the new GitHub repository.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` as environment variables in Render.
5. Add a persistent disk mounted at `/opt/render/project/src/data` if your Render plan supports it, so SQLite data can survive redeploys. Without persistent storage, local SQLite data may be lost when the service is replaced.
6. Deploy. Check the logs for errors.

## Commands included
- `/bot-info`
- `/help`
- `/event-create` — creates a basic RSVP post in the current channel
- RSVP buttons: Going, Maybe, Can't Go

This starter uses a simple table for events and RSVP choices. It is intentionally conservative and does not claim to replace the complete original bot.
