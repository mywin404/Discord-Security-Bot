const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const logger = require('../utils/logger');

module.exports = {
  async execute(member) {
    const guild = member.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);

   
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.MemberKick, member.id);
    
    if (executor) {
    
      if ((botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'guildMemberRemove')) {
        return;
      }

     
      await antinuke.processSafeguard({
        guild,
        event: 'guildMemberRemove', 
        targetId: member.id,
        targetName: member.user.tag,
        auditLogType: AuditLogEvent.MemberKick,
        recoveryAction: async () => {
          
          return true;
        }
      });
    }
  }
};
