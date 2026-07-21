const logger = require('../utils/logger');
const recovery = require('../modules/recovery');

module.exports = {
  once: true,
  async execute(client) {
    logger.info(`Bot is online! Logged in as ${client.user.tag}`);
    logger.info(`Serving in ${client.guilds.cache.size} guilds.`);

  
    client.user.setActivity('Waiting for My Master🛡️', { type: 3 }); 

  
    for (const guild of client.guilds.cache.values()) {
      try {
        await recovery.initGuildCache(guild);
      } catch (err) {
        logger.error(`Error initializing cache for guild ${guild.name} (${guild.id}): ${err.message}`);
      }
    }

    logger.info('VamBot startup caching sequence completed.');
  }
};
