const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const whitelist = require('../utils/whitelist');
const punishments = require('../utils/punishments');
const autofilter = require('../modules/autofilter');
const logger = require('../utils/logger');

module.exports = {
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return; 

    const guild = newMessage.guild;
    const member = newMessage.member;
    if (!member) return;

    
    if (newMessage.mentions.everyone) {
      const isAuth = whitelist.isWhitelisted(guild, member.id, 'everyoneMention');
      if (!isAuth) {
        try {
          if (newMessage.deletable) await newMessage.delete();
        } catch (err) {
          logger.error(`Failed to delete edited everyone mention: ${err.message}`);
        }

        const config = db.getGuildConfig(guild.id);
        const punishmentType = config.punishment_settings.everyoneMention || 'timeout';

        const punishmentApplied = await punishments.executePunishment(
          guild,
          member.id,
          punishmentType,
          'Anti-nuke: Unauthorized @everyone / @here mention via message edit'
        );

        db.logIncident(
          guild.id,
          member.id,
          'everyoneMention',
          newMessage.id,
          punishmentApplied,
          `Channel: <#${newMessage.channel.id}>. Sender edited message to mention everyone/here.`
        );

        if (config.log_channel_id) {
          const logChannel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🛡️ Anti-Nuke: Unauthorized Mention (Edit)')
              .setColor(0xD00000)
              .setDescription(`An unauthorized @everyone or @here mention in an *edited* message was intercepted and deleted.`)
              .addFields(
                { name: 'Executor', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
                { name: 'Action Taken', value: `**${punishmentApplied}**`, inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => null);
          }
        }
        return;
      }
    }

   
    await autofilter.scanMessage(newMessage);
  }
};
