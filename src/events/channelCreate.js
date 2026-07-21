const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const recovery = require('../modules/recovery');

module.exports = {
  async execute(channel) {
    const guild = channel.guild;
    if (!guild) return;

    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);

    
    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'channelCreate')) {
      recovery.updateChannelCache(channel);
      return;
    }

  
    await antinuke.processSafeguard({
      guild,
      event: 'channelCreate',
      targetId: channel.id,
      targetName: channel.name,
      auditLogType: AuditLogEvent.ChannelCreate,
      recoveryAction: async () => {
        if (channel.deletable) {
          await channel.delete('Anti-nuke: Deleting unauthorized channel');
          return true;
        }
        return false;
      }
    });
  }
};
