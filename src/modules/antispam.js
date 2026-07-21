const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const punishments = require('../utils/punishments');
const logger = require('../utils/logger');


const messageTracks = new Map(); 
const attachmentTracks = new Map(); 
const warnHistory = new Map(); 


function shouldBypass(member, config) {
  if (!member) return true;
  if (member.user.bot) return true;
  
 
  if (member.guild.ownerId === member.id) return true;
  

  if (member.permissions.has('Administrator')) return true;

  
  const bypassRoles = config.automod_settings.filter_bypass_roles || [];
  if (bypassRoles.some(roleId => member.roles.cache.has(roleId))) {
    return true;
  }

  return false;
}


async function handleSpamCheck(message) {
  if (!message.guild || !message.member) return;
  
  const guild = message.guild;
  const member = message.member;
  const config = db.getGuildConfig(guild.id);

  if (!config.automod_settings.spam_enabled) return;
  if (shouldBypass(member, config)) return;

  const threshold = config.automod_settings.spam_message_threshold || 5;
  const seconds = config.automod_settings.spam_message_seconds || 5;
  const windowMs = seconds * 1000;
  
  const key = `${guild.id}-${member.id}`;
  const now = Date.now();

  if (!messageTracks.has(key)) {
    messageTracks.set(key, []);
  }

  const timestamps = messageTracks.get(key);
  const freshTimestamps = timestamps.filter(t => now - t < windowMs);
  freshTimestamps.push(now);
  messageTracks.set(key, freshTimestamps);

  if (freshTimestamps.length > threshold) {

    await executeSpamPunishment(message, 'Message spamting detected');
  }
}


async function handleImageSpamCheck(message) {
  if (!message.guild || !message.member || message.attachments.size === 0) return;
  
  const guild = message.guild;
  const member = message.member;
  const config = db.getGuildConfig(guild.id);

  if (!config.automod_settings.spam_enabled) return;
  if (shouldBypass(member, config)) return;

  const threshold = config.automod_settings.spam_image_threshold || 5;
  const seconds = config.automod_settings.spam_image_seconds || 15;
  const windowMs = seconds * 1000;

  const key = `${guild.id}-${member.id}`;
  const now = Date.now();

  if (!attachmentTracks.has(key)) {
    attachmentTracks.set(key, []);
  }

  const timestamps = attachmentTracks.get(key);
  const freshTimestamps = timestamps.filter(t => now - t < windowMs);
  

  for (let i = 0; i < message.attachments.size; i++) {
    freshTimestamps.push(now);
  }
  attachmentTracks.set(key, freshTimestamps);

  if (freshTimestamps.length > threshold) {
    
    await executeSpamPunishment(message, 'Image/Attachment spamming detected', true);
  }
}


async function executeSpamPunishment(message, reason, forceTimeout = false) {
  const guild = message.guild;
  const member = message.member;
  const config = db.getGuildConfig(guild.id);


  try {
    if (message.deletable) {
      await message.delete();
    }
  } catch (err) {
    logger.error(`Failed to delete spam message: ${err.message}`);
  }

  const key = `${guild.id}-${member.id}`;
  let warnCount = warnHistory.get(key) || 0;
  
  let punishmentApplied = '';
  
  if (forceTimeout || warnCount >= 1) {
  
    const punishmentType = config.automod_settings.spam_punishment || 'timeout';
    punishmentApplied = await punishments.executePunishment(
      guild,
      member.id,
      punishmentType,
      `VamBot Automod: ${reason}`
    );
    
    warnHistory.set(key, 0); 
    
   
    const warnMsg = await message.channel.send(`⚠️ ${member}, you were punished (**${punishmentApplied}**) for: **${reason}**.`).catch(() => null);
    if (warnMsg) {
      setTimeout(() => warnMsg.delete().catch(() => null), 6000);
    }
  } else {

    warnCount++;
    warnHistory.set(key, warnCount);
    punishmentApplied = 'Warned';
    
    const warnMsg = await message.channel.send(`⚠️ ${member}, please stop spamming! Further spam will result in a timeout/kick.`).catch(() => null);
    if (warnMsg) {
      setTimeout(() => warnMsg.delete().catch(() => null), 6000);
    }
  }


  db.logIncident(
    guild.id,
    member.id,
    'antiSpam',
    message.id,
    punishmentApplied,
    `Spam behavior: ${reason}. Warning count: ${warnCount}.`
  );


  if (config.log_channel_id) {
    const logChannel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Automod Triggered: Anti-Spam')
        .setColor(0xFFA500) 
        .setDescription(`Automod intercepted spam behavior from user ${member.user.tag}.`)
        .addFields(
          { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Trigger', value: `\`${reason}\``, inline: true },
          { name: 'Warning Count', value: `\`${warnCount}\``, inline: true },
          { name: 'Action Executed', value: `**${punishmentApplied}**`, inline: true }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(err => {
        logger.error(`Could not send antispam alert embed to log channel: ${err.message}`);
      });
    }
  }
}

module.exports = {
  handleSpamCheck,
  handleImageSpamCheck
};
