require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');


if (!process.env.DISCORD_TOKEN) {
  logger.error('Missing DISCORD_TOKEN in .env configuration. Exiting bot process.');
  process.exit(1);
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();


const commandsPath = path.join(__dirname, 'src/commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        logger.warn(`Command at ${file} is missing required data or execute functions.`);
      }
    } catch (err) {
      logger.error(`Error loading command file ${file}: ${err.message}`);
    }
  }
  logger.info(`Loaded ${client.commands.size} commands.`);
} else {
  logger.error('Commands directory not found at src/commands.');
}


const eventsPath = path.join(__dirname, 'src/events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  let loadedEvents = 0;
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      const eventName = file.split('.')[0];
      
      if (event.once) {
        client.once(eventName, (...args) => event.execute(...args));
      } else {
        client.on(eventName, (...args) => event.execute(...args));
      }
      loadedEvents++;
    } catch (err) {
      logger.error(`Error loading event file ${file}: ${err.message}`);
    }
  }
  logger.info(`Loaded ${loadedEvents} event listeners.`);
} else {
  logger.error('Events directory not found at src/events.');
}


process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason.stack || reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.stack || error}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  logger.error(`Failed to authenticate with Discord API: ${err.message}`);
});
