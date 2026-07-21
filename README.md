## Features
- **Anti-Nuke / Anti-Raid**: Detects and stops mass deletions/creation of roles/channels, suspicious webhooks, and rate-limited bans/kicks.
- **Automated Moderation**: Auto-filters toxic words, links, and prevents chat spam (messages or images).
- **Fallback Database**: Runs on a local JSON-based fallback system (`data/db.json`), requiring zero external database configuration.
- **Role & Channel Cache**: Backs up structures to restore channels or roles in case of unauthorized deletions.

---
## Hosting Instructions

### 1. Prerequisites
- **Node.js**: Version `18.0.0` or higher is required.
- **npm**: Installed with Node.js.

### 2. Installation
1. Clone or download the bot files to your hosting server.
2. In the project root directory, run:
   ```bash
   npm install
   ```

### 3. Configuration
1. Copy the `.env.example` template to create your `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your details:
   - `DISCORD_TOKEN`: Your Discord Bot Token (obtained from the [Discord Developer Portal](https://discord.com/developers/applications)).
   - `CLIENT_ID`: Your Bot's Application ID.
   - `GUILD_ID`: (Optional) Input a Guild ID if you want to deploy and test commands instantly in a single server. Leave empty to register commands globally across all servers (takes up to 1 hour to propagate).
   - `PREFIX`: Prefix for legacy text commands (defaults to `-`).

### 4. Deploying slash (/) commands
To register the bot's application commands with Discord, run the deploy command:
```bash
npm run deploy
```

### 5. Running the Bot
- **Development/Standard Execution**:
  ```bash
  npm start
  ```
- **24/7 Hosting (Recommended)**: Use a process manager like **PM2** to keep the bot running continuously:
  1. Install PM2 globally:
     ```bash
     npm install -g pm2
     ```
  2. Start the bot:
     ```bash
     pm2 start index.js --name "discord-security-bot"
     ```
  3. Set up PM2 to startup on system boots:
     ```bash
     pm2 startup
     pm2 save
     ```