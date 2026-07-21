const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const antiraid = require('../modules/antiraid');
const whitelistUtil = require('../utils/whitelist');
const setupState = require('../utils/setupState');
const logger = require('../utils/logger');

module.exports = {
  async execute(interaction) {
    const { client, guild } = interaction;
    if (!guild) return;

    const customId = interaction.customId;

   
    if (customId && customId.startsWith('setup_')) {
      const parts = customId.split('_');
      const initiatorId = parts[parts.length - 1];

     
      if (interaction.user.id !== initiatorId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Only the administrator who opened this setup panel can interact with it.', ephemeral: true });
      }

      const state = setupState.getOrCreateState(guild.id, initiatorId);

     
      if (customId.startsWith('setup_channel_select_')) {
        state.log_channel_id = interaction.values[0];
        const response = setupState.buildConfiguratorMessage(guild, initiatorId);
        return interaction.update(response);
      }

    
      if (customId.startsWith('setup_trusted_select_')) {
        state.override_role_id = interaction.values[0];
        const response = setupState.buildConfiguratorMessage(guild, initiatorId);
        return interaction.update(response);
      }

    
      if (customId.startsWith('setup_bypass_select_')) {
        state.bypass_role_id = interaction.values[0];
        const response = setupState.buildConfiguratorMessage(guild, initiatorId);
        return interaction.update(response);
      }

   
      if (customId.startsWith('setup_toggle_spam_')) {
        state.spam_enabled = !state.spam_enabled;
        const response = setupState.buildConfiguratorMessage(guild, initiatorId);
        return interaction.update(response);
      }

      if (customId.startsWith('setup_toggle_raid_')) {
        state.raid_enabled = !state.raid_enabled;
        const response = setupState.buildConfiguratorMessage(guild, initiatorId);
        return interaction.update(response);
      }

      if (customId.startsWith('setup_toggle_links_')) {
        state.block_all_links = !state.block_all_links;
        const response = setupState.buildConfiguratorMessage(guild, initiatorId);
        return interaction.update(response);
      }

   
      if (customId.startsWith('setup_save_')) {
        setupState.commitState(guild.id, initiatorId);
        const embed = new EmbedBuilder()
          .setTitle('✅ Configurations Saved')
          .setColor(0x00FF00)
          .setDescription('All panel settings and security toggles have been successfully saved to the database.')
          .setTimestamp();
        return interaction.update({ embeds: [embed], components: [] });
      }


      if (customId.startsWith('setup_close_')) {
        setupState.clearState(guild.id, initiatorId);
        return interaction.message.delete().catch(() => null);
      }
    }

  
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Slash Command Error (${interaction.commandName}): ${error.stack}`);
        const errMsg = { content: '❌ An error occurred while executing this command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errMsg).catch(() => null);
        } else {
          await interaction.reply(errMsg).catch(() => null);
        }
      }
      return;
    }

    
    if (interaction.isStringSelectMenu()) {
      if (customId.startsWith('whitelist_select_')) {
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const authorId = parts[3];

        if (interaction.user.id !== authorId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: '❌ Only the administrator who ran the command can configure this whitelist.', ephemeral: true });
        }

        const selectedActions = interaction.values;
        const whitelistData = db.getWhitelist(guild.id);
        
        whitelistData[targetUserId] = selectedActions;
        db.updateGuildConfig(guild.id, {}); 

        const labels = selectedActions.map(act => `\`${whitelistUtil.ACTION_LABELS[act] || act}\``).join(', ');
        
        try {
          await interaction.update({
            content: `✅ Successfully whitelisted <@${targetUserId}> (${targetUserId}) for: ${labels}`,
            components: []
          });
        } catch (err) {
          logger.error(`Failed to update select menu interaction: ${err.message}`);
        }
      }
      return;
    }

  
    if (interaction.isButton()) {
      if (customId === 'raid_unlock') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== interaction.user.id) {
          return interaction.reply({ content: '❌ You must be an Administrator to lift server lockdown.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const success = await antiraid.liftServerLockdown(guild, interaction.user.tag);

        if (success) {
          try {
            await interaction.message.edit({ components: [] }).catch(() => null);
          } catch (err) {}
          
          return interaction.editReply({ content: '🔓 Server lockdown successfully lifted!' });
        } else {
          return interaction.editReply({ content: '❌ Failed to lift lockdown. Please check my hierarchy and permissions.' });
        }
      }
      return;
    }
  }
};
