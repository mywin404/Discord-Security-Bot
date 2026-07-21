const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const recovery = require('../modules/recovery');

module.exports = {
  async execute(role) {
    const guild = role.guild;
    if (!guild) return;

    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.RoleDelete, role.id);


    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'roleDelete')) {
      recovery.removeRoleFromCache(guild.id, role.id);
      return;
    }


    await antinuke.processSafeguard({
      guild,
      event: 'roleDelete',
      targetId: role.id,
      targetName: role.name,
      auditLogType: AuditLogEvent.RoleDelete,
      recoveryAction: async () => {
        return await recovery.recoverRole(guild, role.id);
      }
    });
  }
};
