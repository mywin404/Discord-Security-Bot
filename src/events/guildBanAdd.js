const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');

module.exports = {
  async execute(ban) {
    const guild = ban.guild;
    const user = ban.user;
    
    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.MemberBanAdd, user.id);


    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'guildBanAdd')) {
      return;
    }


    await antinuke.processSafeguard({
      guild,
      event: 'guildBanAdd',
      targetId: user.id,
      targetName: user.tag,
      auditLogType: AuditLogEvent.MemberBanAdd,
      recoveryAction: async () => {
        // Recover: Unban the user
        await guild.members.unban(user.id, 'Anti-nuke: Reverting unauthorized member ban').catch(() => null);
        return true;
      }
    });
  }
};
