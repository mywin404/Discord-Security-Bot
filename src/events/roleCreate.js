const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const recovery = require('../modules/recovery');

module.exports = {
  async execute(role) {
    const guild = role.guild;
    if (!guild) return;

    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.RoleCreate, role.id);

  
    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'roleCreate')) {
      recovery.updateRoleCache(role);
      return;
    }


    await antinuke.processSafeguard({
      guild,
      event: 'roleCreate',
      targetId: role.id,
      targetName: role.name,
      auditLogType: AuditLogEvent.RoleCreate,
      recoveryAction: async () => {
        if (role.deletable) {
          await role.delete('Anti-nuke: Deleting unauthorized role');
          return true;
        }
        return false;
      }
    });
  }
};
