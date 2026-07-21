const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const punishments = require('../utils/punishments');
const logger = require('../utils/logger');


const filterWarns = new Map(); 

function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

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


async function scanMessage(message) {
  if (!message.guild || !message.member || !message.content) return;

  const guild = message.guild;
  const member = message.member;
  const content = message.content;
  const config = db.getGuildConfig(guild.id);

  if (shouldBypass(member, config)) return;

  
  const blacklistedWords = db.getFilterWords(guild.id);
  for (const pattern of blacklistedWords) {
    let regex;
    
    
    if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
      try {
        regex = new RegExp(pattern.substring(1, pattern.length - 1), 'i');
      } catch (e) {
        regex = new RegExp(escapeRegex(pattern), 'i');
      }
    } 
    
    else if (pattern.includes('*')) {
      const glob = escapeRegex(pattern).replace(/\\\*/g, '.*');
      regex = new RegExp(glob, 'i');
    } 
    
    else {
      regex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'i');
    }

    if (regex.test(content)) {
      await executeFilterPunishment(message, `Blacklisted word pattern matched: "${pattern}"`);
      return;
    }
  }


  const urlRegex = /https?:\/\/(www\.)?([-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
  const urlMatches = [...content.matchAll(urlRegex)];

  if (urlMatches.length > 0) {
    const blacklistedLinks = db.getFilterLinks(guild.id);
    const blockAllLinks = config.automod_settings.block_all_links;
    const whitelistedDomains = config.automod_settings.link_whitelisted_domains || [];

    for (const match of urlMatches) {
      const url = match[0];
      const domain = match[2].toLowerCase();

      if (blockAllLinks) {
   
        const isWhitelisted = whitelistedDomains.some(d => 
          domain === d.toLowerCase() || domain.endsWith('.' + d.toLowerCase())
        );
        if (!isWhitelisted) {
          await executeFilterPunishment(message, `Restricted link domain: "${domain}"`);
          return;
        }
      } else {
        
        const isBlacklisted = blacklistedLinks.some(blacklink => 
          domain === blacklink.toLowerCase() || 
          domain.endsWith('.' + blacklink.toLowerCase()) ||
          url.toLowerCase().includes(blacklink.toLowerCase())
        );
        if (isBlacklisted) {
          await executeFilterPunishment(message, `Blacklisted link detected: "${url}"`);
          return;
        }
      }
    }
  }
}

async function executeFilterPunishment(message, triggerReason) {
  const guild = message.guild;
  const member = message.member;
  const config = db.getGuildConfig(guild.id);


  try {
    if (message.deletable) {
      await message.delete();
    }
  } catch (error) {
    logger.error(`Failed to delete message filtered: ${error.message}`);
  }

  const key = `${guild.id}-${member.id}`;
  let warnCount = filterWarns.get(key) || 0;
  let punishmentApplied = '';

  
  if (warnCount >= 1) {
    const punishmentType = config.automod_settings.spam_punishment || 'timeout';
    punishmentApplied = await punishments.executePunishment(
      guild,
      member.id,
      punishmentType,
      `VamBot Filter: ${triggerReason}`
    );
    filterWarns.set(key, 0); 

    const warnMsg = await message.channel.send(`⚠️ ${member}, you were punished (**${punishmentApplied}**) for message filter violation: **${triggerReason}**.`).catch(() => null);
    if (warnMsg) {
      setTimeout(() => warnMsg.delete().catch(() => null), 6000);
    }
  } else {
    warnCount++;
    filterWarns.set(key, warnCount);
    punishmentApplied = 'Warned';

    const warnMsg = await message.channel.send(`⚠️ ${member}, your message was deleted because it violated the server word/link filters.`).catch(() => null);
    if (warnMsg) {
      setTimeout(() => warnMsg.delete().catch(() => null), 6000);
    }
  }


  db.logIncident(
    guild.id,
    member.id,
    'autoFilter',
    message.id,
    punishmentApplied,
    `Message content violated filters. Trigger: ${triggerReason}. Warnings: ${warnCount}`
  );


  if (config.log_channel_id) {
    const logChannel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Automod Triggered: Word/Link Filter')
        .setColor(0xFFA500)
        .setDescription(`Automod deleted a message from ${member.user.tag} for filter violations.`)
        .addFields(
          { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Details', value: `\`${triggerReason}\``, inline: true },
          { name: 'Action Executed', value: `**${punishmentApplied}**`, inline: true }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(err => {
        logger.error(`Could not send autofilter alert embed: ${err.message}`);
      });
    }
  }
}

module.exports = {
  scanMessage
};
