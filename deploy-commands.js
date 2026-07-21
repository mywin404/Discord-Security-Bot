require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));


for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}


if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ Error: Missing DISCORD_TOKEN or CLIENT_ID in your configuration (.env).');
  process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands...`);

    if (process.env.GUILD_ID) {
     
      console.log(`Guild ID detected. Registering commands for test guild: ${process.env.GUILD_ID}`);
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`✅ Successfully reloaded ${data.length} application (/) commands in dev guild.`);
    } else {
     
      console.log('No Guild ID detected. Deploying commands globally for production...');
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`✅ Successfully reloaded ${data.length} application (/) commands globally.`);
    }
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
  }
})();
