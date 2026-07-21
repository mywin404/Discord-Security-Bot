const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const logger = require('../utils/logger');


const joinTimestamps = new Map(); 
const lockdowns = new Map(); 
const cooldownTimers = new Map(); 


async function trackMemberJoin(member) {
  const guild = member.guild;
  const config = db.getGuildConfig(guild.id);
  
  if (!config.automod_settings.raid_enabled) {
    return;
  }

  const threshold = config.automod_settings.raid_join_threshold || 10;
  const windowSeconds = config.automod_settings.raid_join_seconds || 30;
  const windowMs = windowSeconds * 1000;
  
  const now = Date.now();
  if (!joinTimestamps.has(guild.id)) {
    joinTimestamps.set(guild.id, []);
  }

  const timestamps = joinTimestamps.get(guild.id);
  const freshTimestamps = timestamps.filter(t => now - t < windowMs);
  freshTimestamps.push(now);
  joinTimestamps.set(guild.id, freshTimestamps);

 
  if (freshTimestamps.length > threshold && !lockdowns.has(guild.id)) {
    logger.warn(`Raid detected in ${guild.name} (${guild.id}): ${freshTimestamps.length} joins in ${windowSeconds}s.`);
    await lockServer(guild, `Join spike detected (${freshTimestamps.length} joins in ${windowSeconds}s)`);
  }
}


async function lockServer(guild, reason = 'Anti-raid trigger') {
  try {
    const config = db.getGuildConfig(guild.id);
    const everyoneRole = guild.roles.everyone;

    
    const originalBitfield = everyoneRole.permissions.bitfield.toString();
    const originalVerification = guild.verificationLevel;

    
    const newPermissions = everyoneRole.permissions.remove([
      'SendMessages',
      'SendMessagesInThreads',
      'CreatePublicThreads',
      'CreatePrivateThreads',
      'Connect'
    ]);


    await everyoneRole.setPermissions(newPermissions, `Anti-raid lockdown: ${reason}`);

    
    if (guild.verificationLevel < 3) {
      await guild.setVerificationLevel(3, `Anti-raid lockdown: ${reason}`).catch(() => null);
    }

    lockdowns.set(guild.id, {
      active: true,
      originalPermissions: originalBitfield,
      originalVerificationLevel: originalVerification,
      timestamp: Date.now()
    });

    logger.warn(`Guild "${guild.name}" lockdown activated.`);


    await sendLockdownAlert(guild, reason, true);

    
    const cooldown = config.automod_settings.raid_cooldown || 300;
    if (cooldown > 0) {
      if (cooldownTimers.has(guild.id)) {
        clearTimeout(cooldownTimers.get(guild.id));
      }
      const timer = setTimeout(() => {
        liftServerLockdown(guild, 'Auto-lockdown cooldown expired');
      }, cooldown * 1000);
      cooldownTimers.set(guild.id, timer);
    }

    return true;
  } catch (error) {
    logger.error(`Failed to execute anti-raid lockdown on guild ${guild.id}: ${error.stack}`);
    return false;
  }
}


async function liftServerLockdown(guild, initiatedBy = 'System') {
  try {
    const state = lockdowns.get(guild.id);
    const everyoneRole = guild.roles.everyone;

    if (state) {

      await everyoneRole.setPermissions(BigInt(state.originalPermissions), `Anti-raid: Unlock by ${initiatedBy}`);
      

      await guild.setVerificationLevel(state.originalVerificationLevel, `Anti-raid: Unlock by ${initiatedBy}`).catch(() => null);
      
      lockdowns.delete(guild.id);
    } else {

      const newPermissions = everyoneRole.permissions.add([
        'SendMessages',
        'SendMessagesInThreads',
        'Connect'
      ]);
      await everyoneRole.setPermissions(newPermissions, `Anti-raid fallback unlock: ${initiatedBy}`);
    }


    if (cooldownTimers.has(guild.id)) {
      clearTimeout(cooldownTimers.get(guild.id));
      cooldownTimers.delete(guild.id);
    }

    logger.info(`Guild "${guild.name}" lockdown lifted by ${initiatedBy}.`);


    await sendLockdownAlert(guild, `Lockdown lifted by ${initiatedBy}`, false);
    return true;
  } catch (error) {
    logger.error(`Failed to lift lockdown in guild ${guild.id}: ${error.stack}`);
    return false;
  }
}

/**
 * Sends a lockdown or unlock alert to the logs channel
 */
async function sendLockdownAlert(guild, reason, isLockdown) {
  const config = db.getGuildConfig(guild.id);
  if (!config.log_channel_id) return;

  try {
    const channel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(isLockdown ? '🚨 Anti-Raid: SERVER LOCKDOWN ACTIVE' : '🔓 Anti-Raid: Lockdown Lifted')
      .setColor(isLockdown ? 0xFF0000 : 0x00FF00)
      .setDescription(isLockdown 
        ? `The server has been locked down due to suspicious activities.\n**Reason:** ${reason}\n\n*Guild permissions for \`@everyone\` have been restricted.*`
        : `Normal server operations have been restored.\n**Details:** ${reason}`)
      .setTimestamp();

    if (isLockdown) {
      const unlockButton = new ButtonBuilder()
        .setCustomId('raid_unlock')
        .setLabel('Unlock Server 🔓')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(unlockButton);
      await channel.send({ embeds: [embed], components: [row] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    logger.error(`Failed to send anti-raid embed to logs channel: ${err.message}`);
  }
}

/**
 * Checks if a guild is currently locked down
 */
function isGuildLocked(guildId) {
  return lockdowns.has(guildId);
}

module.exports = {
  trackMemberJoin,
  lockServer,
  liftServerLockdown,
  isGuildLocked
};
