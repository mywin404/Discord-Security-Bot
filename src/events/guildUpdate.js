const { AuditLogEvent } = require('discord.js');
const antinuke = require('../modules/antinuke');
const whitelist = require('../utils/whitelist');

module.exports = {
  async execute(oldGuild, newGuild) {
    const guild = newGuild;
    const botMember = await guild.members.fetchMe().catch(() => null);
    const executor = await antinuke.getAuditLogExecutor(guild, AuditLogEvent.GuildUpdate, guild.id);

   
    if (!executor || (botMember && executor.id === botMember.id) || whitelist.isWhitelisted(guild, executor.id, 'guildUpdate')) {
      return;
    }

    
    await antinuke.processSafeguard({
      guild,
      event: 'guildUpdate',
      targetId: guild.id,
      targetName: guild.name,
      auditLogType: AuditLogEvent.GuildUpdate,
      recoveryAction: async () => {
        const edits = {};
        
        if (oldGuild.name !== newGuild.name) {
          edits.name = oldGuild.name;
        }
        if (oldGuild.icon !== newGuild.icon) {
          edits.icon = oldGuild.iconURL({ extension: 'png' });
        }
        if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
          edits.verificationLevel = oldGuild.verificationLevel;
        }

        if (Object.keys(edits).length > 0) {
          await newGuild.edit(edits, 'Anti-nuke: Reverting unauthorized server changes');
          return true;
        }
        return true;
      }
    });
  }
};
