const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const logger = require('../utils/logger');

module.exports = {
  async execute(channel) {
    const guild = channel.guild;
    if (!guild) return;

    const botMember = await guild.members.fetchMe().catch(() => null);

    
    let latestEntry = null;
    const webhookEvents = [
      AuditLogEvent.WebhookCreate,
      AuditLogEvent.WebhookUpdate,
      AuditLogEvent.WebhookDelete
    ];

    try {
      for (const eventType of webhookEvents) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: eventType });
        const match = logs.entries.find(e => 
          e.targetId === channel.id || 
          e.extra?.channelId === channel.id ||
          (e.target && e.target.channelId === channel.id)
        );

        if (match) {
          if (!latestEntry || match.createdTimestamp > latestEntry.createdTimestamp) {
            latestEntry = match;
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to fetch webhook audit logs: ${err.message}`);
    }

    if (!latestEntry) return;

    
    const age = Math.abs(Date.now() - latestEntry.createdTimestamp);
    if (age > 10000) return;

    const executor = latestEntry.executor;
    if (!executor) return;

  
    if (botMember && executor.id === botMember.id) return;

  
    if (whitelist.isWhitelisted(guild, executor.id, 'webhooksUpdate')) {
      return;
    }


    await antinuke.processSafeguard({
      guild,
      event: 'webhooksUpdate',
      targetId: latestEntry.targetId,
      targetName: latestEntry.target?.name || 'Webhook',
      auditLogType: latestEntry.action,
      recoveryAction: async () => {

        if (latestEntry.action === AuditLogEvent.WebhookCreate) {
          const webhooks = await channel.fetchWebhooks().catch(() => null);
          if (webhooks) {
            const webhookToDelete = webhooks.get(latestEntry.targetId);
            if (webhookToDelete) {
              await webhookToDelete.delete('Anti-nuke: Deleting unauthorized webhook');
              logger.info(`Deleted unauthorized webhook "${webhookToDelete.name}" (${webhookToDelete.id}).`);
              return true;
            }
          }
        }
        return true;
      }
    });
  }
};
