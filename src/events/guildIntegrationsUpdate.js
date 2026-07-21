const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const logger = require('../utils/logger');

module.exports = {
  async execute(guild) {
    const botMember = await guild.members.fetchMe().catch(() => null);

    
    let latestEntry = null;
    const integrationEvents = [
      AuditLogEvent.IntegrationCreate,
      AuditLogEvent.IntegrationUpdate,
      AuditLogEvent.IntegrationDelete
    ];

    try {
      for (const eventType of integrationEvents) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: eventType });
        if (logs.entries.size > 0) {
          const match = logs.entries.first(); 
          if (!latestEntry || match.createdTimestamp > latestEntry.createdTimestamp) {
            latestEntry = match;
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to fetch integrations audit logs: ${err.message}`);
    }

    if (!latestEntry) return;

  
    const age = Math.abs(Date.now() - latestEntry.createdTimestamp);
    if (age > 10000) return;

    const executor = latestEntry.executor;
    if (!executor) return;

  
    if (botMember && executor.id === botMember.id) return;


    if (whitelist.isWhitelisted(guild, executor.id, 'guildIntegrationsUpdate')) {
      return;
    }


    await antinuke.processSafeguard({
      guild,
      event: 'guildIntegrationsUpdate',
      targetId: latestEntry.targetId || guild.id,
      targetName: latestEntry.target?.name || 'Server Integration',
      auditLogType: latestEntry.action,
      details: 'Unauthorized integration created/updated. Server configurations breached.',
      recoveryAction: async () => {
        
        return true;
      }
    });
  }
};
