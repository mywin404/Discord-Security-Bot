const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const recovery = require('../modules/recovery');

module.exports = {
  async execute(channel) {
    const guild = channel.guild;
    if (!guild) return;

    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.ChannelDelete, channel.id);

   
    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'channelDelete')) {
      recovery.removeChannelFromCache(guild.id, channel.id);
      return;
    }


    await antinuke.processSafeguard({
      guild,
      event: 'channelDelete',
      targetId: channel.id,
      targetName: channel.name,
      auditLogType: AuditLogEvent.ChannelDelete,
      recoveryAction: async () => {
        return await recovery.recoverChannel(guild, channel.id);
      }
    });
  }
};
