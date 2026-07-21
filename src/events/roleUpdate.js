const { AuditLogEvent } = require('discord.js');
const db = require('../database/db');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');
const recovery = require('../modules/recovery');

module.exports = {
  async execute(oldRole, newRole) {
    const guild = newRole.guild;
    if (!guild) return;

    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);


    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'roleUpdate')) {
      recovery.updateRoleCache(newRole);
      return;
    }


    const dangerousPerms = ['Administrator', 'BanMembers', 'KickMembers', 'ManageChannels', 'ManageRoles', 'ManageGuild', 'ManageWebhooks'];
    const elevated = [];
    
    for (const perm of dangerousPerms) {
      if (!oldRole.permissions.has(perm) && newRole.permissions.has(perm)) {
        elevated.push(perm);
      }
    }

    let details = '';
    if (elevated.length > 0) {
      details = `🚨 Flagged: Permission Elevation (Granted: ${elevated.join(', ')})`;
    }

    const cachedData = db.getRoleCache(guild.id, newRole.id);


    await antinuke.processSafeguard({
      guild,
      event: 'roleUpdate',
      targetId: newRole.id,
      targetName: newRole.name,
      auditLogType: AuditLogEvent.RoleUpdate,
      details: details,
      recoveryAction: async () => {
        if (cachedData) {
          return await recovery.restoreRoleSettings(newRole, cachedData);
        }
        return false;
      }
    });
  }
};
