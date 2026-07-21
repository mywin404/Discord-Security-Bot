const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const whitelist = require('../utils/whitelist');
const punishments = require('../utils/punishments');
const antispam = require('../modules/antispam');
const autofilter = require('../modules/autofilter');
const logger = require('../utils/logger');

module.exports = {
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const guild = message.guild;
    const member = message.member;
    if (!member) return;

  
    const prefix = process.env.PREFIX || '-';
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const commandName = args.shift().toLowerCase();
      const command = message.client.commands.get(commandName);

      if (command && typeof command.executePrefix === 'function') {
        try {
          await command.executePrefix(message, args);
        } catch (error) {
          logger.error(`Prefix Command Error (${commandName}): ${error.stack}`);
          await message.reply('❌ An error occurred while executing this command.').catch(() => null);
        }
        return; 
      }
    }

  
    if (message.mentions.everyone) {
      const isAuth = whitelist.isWhitelisted(guild, member.id, 'everyoneMention');
      if (!isAuth) {
        
        try {
          if (message.deletable) await message.delete();
        } catch (err) {
          logger.error(`Failed to delete unauthorized everyone mention message: ${err.message}`);
        }

        const config = db.getGuildConfig(guild.id);
        const punishmentType = config.punishment_settings.everyoneMention || 'timeout';

     
        const punishmentApplied = await punishments.executePunishment(
          guild,
          member.id,
          punishmentType,
          'Anti-nuke: Unauthorized @everyone / @here mention'
        );

     
        db.logIncident(
          guild.id,
          member.id,
          'everyoneMention',
          message.id,
          punishmentApplied,
          `Channel: <#${message.channel.id}>. Sender attempted to mention everyone/here.`
        );

        
        if (config.log_channel_id) {
          const logChannel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🛡️ Anti-Nuke: Unauthorized Mention')
              .setColor(0xD00000)
              .setDescription(`An unauthorized @everyone or @here mention was intercepted and deleted.`)
              .addFields(
                { name: 'Executor', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Action Taken', value: `**${punishmentApplied}**`, inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => null);
          }
        }
        return; 
      }
    }

   
    await antispam.handleSpamCheck(message);

  
    await antispam.handleImageSpamCheck(message);

  
    await autofilter.scanMessage(message);
  }
};
