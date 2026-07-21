const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');

module.exports = {
  async execute(messages) {
    const firstMsg = messages.first();
    if (!firstMsg || !firstMsg.guild) return;

    const guild = firstMsg.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);

   
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.MessageBulkDelete, firstMsg.channel.id);


    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'messageDeleteBulk')) {
      return;
    }


    await antinuke.processSafeguard({
      guild,
      event: 'messageDeleteBulk',
      targetId: firstMsg.channel.id,
      targetName: `Channel: #${firstMsg.channel.name}`,
      auditLogType: AuditLogEvent.MessageBulkDelete,
      details: `Bulk deleted ${messages.size} messages in channel <#${firstMsg.channel.id}>.`,
      recoveryAction: async () => {

        return true;
      }
    });
  }
};
