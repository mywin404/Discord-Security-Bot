const logger = require('./logger');

async function stripDangerousRoles(member) {
  try {
    const guild = member.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember) return false;

    
    const rolesToRemove = member.roles.cache.filter(role => 
      role.id !== guild.id && 
      role.comparePositionTo(botMember.roles.highest) < 0
    );

    if (rolesToRemove.size === 0) {
      logger.warn(`No manageable roles to strip from ${member.user.tag}.`);
      return false;
    }

    logger.info(`Stripping ${rolesToRemove.size} roles from ${member.user.tag} before applying punishment.`);
    await member.roles.remove(rolesToRemove, 'Anti-nuke: Permissions stripped due to unauthorized action');
    return true;
  } catch (error) {
    logger.error(`Failed to strip roles from ${member.user.tag}: ${error.message}`);
    return false;
  }
}


async function executePunishment(guild, userId, punishmentType, reason = 'Anti-nuke protection trigger') {
  if (!punishmentType || punishmentType === 'none') {
    return 'No action taken (configured to none)';
  }

  
  const member = await guild.members.fetch(userId).catch(() => null);

  
  if (member) {
    
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (botMember && member.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
      logger.warn(`Warning: Executor ${member.user.tag} has a higher or equal role compared to the bot. Punishment might fail.`);
    }
    await stripDangerousRoles(member);
  }

  try {
    if (punishmentType === 'ban') {
      await guild.members.ban(userId, { deleteMessageSeconds: 0, reason });
      return 'Banned';
    } else if (punishmentType === 'kick') {
      if (!member) {
        return 'Not kicked (user not in server)';
      }
      if (!member.kickable) {
        return 'Failed (Member is not kickable by bot)';
      }
      await member.kick(reason);
      return 'Kicked';
    } else if (punishmentType === 'timeout') {
      if (!member) {
        return 'Not timed out (user not in server)';
      }
      if (!member.moderatable) {
        return 'Failed (Member is not moderatable by bot)';
      }

      await member.timeout(24 * 60 * 60 * 1000, reason);
      return 'Timed out (24 Hours)';
    }
    return `Unknown punishment type: ${punishmentType}`;
  } catch (error) {
    logger.error(`Punishment error for user ${userId}: ${error.message}`);
    return `Failed punishment: ${error.message}`;
  }
}

module.exports = {
  stripDangerousRoles,
  executePunishment
};
