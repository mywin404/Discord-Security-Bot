const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const whitelist = require('../utils/whitelist');
const punishments = require('../utils/punishments');
const logger = require('../utils/logger');


const actionTracks = new Map();


async function getAuditLogExecutor(guild, auditLogType, targetId, retries = 3, delay = 200) {
  for (let i = 0; i < retries; i++) {
    try {
      const logs = await guild.fetchAuditLogs({ limit: 6, type: auditLogType });
      
      const entry = logs.entries.find(e => e.targetId === targetId);
      if (entry) {

        const age = Math.abs(Date.now() - entry.createdTimestamp);
        if (age < 12000) {
          return entry.executor;
        }
      }
    } catch (error) {
      logger.error(`Failed to fetch audit logs for ${guild.name}: ${error.message}`);
    }
    
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
}


function isMassActionTriggered(guildId, executorId, actionType) {
  const config = db.getGuildConfig(guildId);
  
s
  const threshold = 3; 
  const windowMs = 10000;

  const key = `${guildId}-${executorId}-${actionType}`;
  const now = Date.now();
  
  if (!actionTracks.has(key)) {
    actionTracks.set(key, []);
  }

  const timestamps = actionTracks.get(key);
  
  const freshTimestamps = timestamps.filter(t => now - t < windowMs);
  freshTimestamps.push(now);
  actionTracks.set(key, freshTimestamps);

  return freshTimestamps.length > threshold;
}


async function processSafeguard({ guild, event, targetId, targetName, auditLogType, recoveryAction, details = '' }) {
  try {
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember) return;

    
    const executor = await getAuditLogExecutor(guild, auditLogType, targetId);
    if (!executor) {
      logger.warn(`Could not identify executor for ${event} on target ${targetName} (${targetId}) in ${guild.name}.`);
      return;
    }

  
    if (executor.id === botMember.id) {
      return;
    }

    const config = db.getGuildConfig(guild.id);
    const actionType = whitelist.getActionType(event);

    
    const isUserAuth = whitelist.isWhitelisted(guild, executor.id, actionType);

    if (isUserAuth) {
      logger.info(`Whitelisted action: User ${executor.tag} executed ${event} on ${targetName}. (Bypassed)`);
      return;
    }

    
    logger.warn(`UNAUTHORIZED ACTION: User ${executor.tag} executed ${event} on ${targetName} inside ${guild.name}. Initiating recovery and punishment!`);
    
   
    let recoveryStatus = 'Reversion attempted';
    if (typeof recoveryAction === 'function') {
      try {
        const recoveryResult = await recoveryAction();
        if (recoveryResult === false) {
          recoveryStatus = 'Reversion failed';
        } else {
          recoveryStatus = 'Reversion successful';
        }
      } catch (err) {
        logger.error(`Recovery execution error: ${err.message}`);
        recoveryStatus = `Reversion failed: ${err.message}`;
      }
    }

    
    let isMassAction = isMassActionTriggered(guild.id, executor.id, actionType);
    let punishmentToApply = config.punishment_settings[event] || 'ban';
    
    if (isMassAction) {
      punishmentToApply = 'ban'; 
      details += ' (Flagged: Mass Actions Limit Exceeded)';
    }

   
    const punishmentApplied = await punishments.executePunishment(
      guild,
      executor.id,
      punishmentToApply,
      `VamBot: Unauthorized ${event} on ${targetName}`
    );

   
    db.logIncident(
      guild.id,
      executor.id,
      event,
      targetId,
      punishmentApplied,
      `Target: ${targetName}. Status: ${recoveryStatus}. Details: ${details}`
    );

  
    if (config.log_channel_id) {
      const logChannel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Anti-Nuke Protection Triggered')
          .setColor(0xD00000) 
          .setDescription(`An unauthorized action was intercepted and reverted.`)
          .addFields(
            { name: 'Executor', value: `${executor.tag} (${executor.id})`, inline: true },
            { name: 'Event Intercepted', value: `\`${event}\` (${ACTION_LABELS[actionType] || actionType})`, inline: true },
            { name: 'Target', value: `\`${targetName}\` (${targetId})`, inline: true },
            { name: 'Punishment Configured', value: `\`${config.punishment_settings[event] || 'ban'}\``, inline: true },
            { name: 'Punishment Executed', value: `**${punishmentApplied}**`, inline: true },
            { name: 'Recovery Status', value: `**${recoveryStatus}**`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Vam Bot Safeguard Engine v2' });

        if (details) {
          embed.addFields({ name: 'Details', value: details });
        }

        await logChannel.send({ embeds: [embed] }).catch(err => {
          logger.error(`Could not send anti-nuke alert embed to log channel: ${err.message}`);
        });
      }
    }

  } catch (error) {
    logger.error(`Error in processSafeguard for event ${event}: ${error.stack}`);
  }
}


const ACTION_LABELS = whitelist.ACTION_LABELS;

module.exports = {
  getAuditLogExecutor,
  isMassActionTriggered,
  processSafeguard
};
