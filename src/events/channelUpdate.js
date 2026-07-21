const { AuditLogEvent } = require('discord.js');
const db = require('../database/db');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const recovery = require('../modules/recovery');

module.exports = {
  async execute(oldChannel, newChannel) {
    const guild = newChannel.guild;
    if (!guild) return;

    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.ChannelUpdate, newChannel.id);


    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'channelUpdate')) {
      recovery.updateChannelCache(newChannel);
      return;
    }

    const cachedData = db.getChannelCache(guild.id, newChannel.id);


    await antinuke.processSafeguard({
      guild,
      event: 'channelUpdate',
      targetId: newChannel.id,
      targetName: newChannel.name,
      auditLogType: AuditLogEvent.ChannelUpdate,
      recoveryAction: async () => {
        if (cachedData) {
          return await recovery.restoreChannelSettings(newChannel, cachedData);
        }
        return false;
      }
    });
  }
};
