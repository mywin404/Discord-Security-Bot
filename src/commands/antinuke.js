const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure and check VamBot anti-nuke protection status')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Display the current anti-nuke configuration and recent logs')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Set override roles and change individual event punishments')
        .addRoleOption(option =>
          option
            .setName('trusted_role')
            .setDescription('A role that bypasses all anti-nuke checks (Trusted Admins)')
        )
        .addStringOption(option =>
          option
            .setName('channel_delete')
            .setDescription('Punishment for unauthorized channel deletions')
            .addChoices(
              { name: 'Ban', value: 'ban' },
              { name: 'Kick', value: 'kick' },
              { name: 'Timeout (24h)', value: 'timeout' },
              { name: 'None (Alert Only)', value: 'none' }
            )
        )
        .addStringOption(option =>
          option
            .setName('role_delete')
            .setDescription('Punishment for unauthorized role deletions')
            .addChoices(
              { name: 'Ban', value: 'ban' },
              { name: 'Kick', value: 'kick' },
              { name: 'Timeout (24h)', value: 'timeout' },
              { name: 'None (Alert Only)', value: 'none' }
            )
        )
        .addStringOption(option =>
          option
            .setName('everyone_mention')
            .setDescription('Punishment for unauthorized @everyone mentions')
            .addChoices(
              { name: 'Ban', value: 'ban' },
              { name: 'Kick', value: 'kick' },
              { name: 'Timeout (24h)', value: 'timeout' },
              { name: 'None (Alert Only)', value: 'none' }
            )
        )
        .addStringOption(option =>
          option
            .setName('webhook_create')
            .setDescription('Punishment for unauthorized webhook creations/edits')
            .addChoices(
              { name: 'Ban', value: 'ban' },
              { name: 'Kick', value: 'kick' },
              { name: 'Timeout (24h)', value: 'timeout' },
              { name: 'None (Alert Only)', value: 'none' }
            )
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You must be an Administrator to run this command.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'status') {
      const config = db.getGuildConfig(guildId);
      const whitelistData = db.getWhitelist(guildId);
      const whitelistedUsersCount = Object.keys(whitelistData).length;
      const incidents = db.getIncidents(guildId).slice(0, 5);

      const statusEmbed = new EmbedBuilder()
        .setTitle('🛡️ Anti-Nuke Status')
        .setColor(0x00A2FF)
        .setDescription('Here is the current security posture for this server.')
        .addFields(
          { name: 'Log Channel', value: config.log_channel_id ? `<#${config.log_channel_id}>` : '🔴 *Not Configured*', inline: true },
          { name: 'Trusted Admin Role', value: config.override_role_id ? `<@&${config.override_role_id}>` : '⚪ *None*', inline: true },
          { name: 'Whitelisted Users', value: `\`${whitelistedUsersCount} users\``, inline: true }
        );

      // Format punishment fields
      const p = config.punishment_settings;
      const punishmentsStr = 
        `• **Channel Deletions:** \`${p.channelDelete || 'ban'}\`\n` +
        `• **Channel Creations:** \`${p.channelCreate || 'ban'}\`\n` +
        `• **Role Deletions:** \`${p.roleDelete || 'ban'}\`\n` +
        `• **Everyone Mention:** \`${p.everyoneMention || 'timeout'}\`\n` +
        `• **Webhook Actions:** \`${p.webhooksUpdate || 'ban'}\`\n` +
        `• **Integrations/Server Updates:** \`${p.guildUpdate || 'ban'}\``;

      statusEmbed.addFields({ name: 'Configured Punishments', value: punishmentsStr });

      // Add recent incidents
      let logsStr = '*No recent incidents recorded.*';
      if (incidents.length > 0) {
        logsStr = incidents.map(inc => {
          const date = new Date(inc.timestamp).toLocaleTimeString();
          return `\`[${date}]\` **${inc.action}** on <@${inc.executor_id}> - Punish: \`${inc.punishment_applied}\``;
        }).join('\n');
      }
      statusEmbed.addFields({ name: 'Recent Incidents (Last 5)', value: logsStr });

      return interaction.reply({ embeds: [statusEmbed] });
    }

    if (subcommand === 'config') {
      const config = db.getGuildConfig(guildId);
      
      const trustedRole = interaction.options.getRole('trusted_role');
      const chanDel = interaction.options.getString('channel_delete');
      const roleDel = interaction.options.getString('role_delete');
      const everyoneMent = interaction.options.getString('everyone_mention');
      const webCreate = interaction.options.getString('webhook_create');

      const updates = {};
      const newPunishments = { ...config.punishment_settings };

      if (trustedRole) {
        updates.override_role_id = trustedRole.id;
      }
      if (chanDel) {
        newPunishments.channelDelete = chanDel;
        newPunishments.channelCreate = chanDel;
      }
      if (roleDel) {
        newPunishments.roleDelete = roleDel;
        newPunishments.roleCreate = roleDel;
        newPunishments.roleUpdate = roleDel;
      }
      if (everyoneMent) {
        newPunishments.everyoneMention = everyoneMent;
      }
      if (webCreate) {
        newPunishments.webhooksUpdate = webCreate;
        newPunishments.webhookCreate = webCreate;
      }

      updates.punishment_settings = newPunishments;
      db.updateGuildConfig(guildId, updates);

      return interaction.reply({ content: '✅ Anti-nuke configurations updated successfully.', ephemeral: true });
    }
  },


  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && message.guild.ownerId !== message.author.id) {
      return message.reply('❌ You must be an Administrator to run this command.');
    }

    const subcommand = args[0] ? args[0].toLowerCase() : null;
    const guildId = message.guild.id;

    if (!subcommand || subcommand === 'status') {
      const config = db.getGuildConfig(guildId);
      const whitelistData = db.getWhitelist(guildId);
      const whitelistedUsersCount = Object.keys(whitelistData).length;
      const incidents = db.getIncidents(guildId).slice(0, 5);

      const statusEmbed = new EmbedBuilder()
        .setTitle('🛡️ Anti-Nuke Status')
        .setColor(0x00A2FF)
        .setDescription('Here is the current security posture for this server.')
        .addFields(
          { name: 'Log Channel', value: config.log_channel_id ? `<#${config.log_channel_id}>` : '幅 *Not Configured*', inline: true },
          { name: 'Trusted Admin Role', value: config.override_role_id ? `<@&${config.override_role_id}>` : '⚪ *None*', inline: true },
          { name: 'Whitelisted Users', value: `\`${whitelistedUsersCount} users\``, inline: true }
        );

      const p = config.punishment_settings;
      const punishmentsStr = 
        `• **Channel Deletions:** \`${p.channelDelete || 'ban'}\`\n` +
        `• **Channel Creations:** \`${p.channelCreate || 'ban'}\`\n` +
        `• **Role Deletions:** \`${p.roleDelete || 'ban'}\`\n` +
        `• **Everyone Mention:** \`${p.everyoneMention || 'timeout'}\`\n` +
        `• **Webhook Actions:** \`${p.webhooksUpdate || 'ban'}\`\n` +
        `• **Integrations/Server Updates:** \`${p.guildUpdate || 'ban'}\``;

      statusEmbed.addFields({ name: 'Configured Punishments', value: punishmentsStr });

      let logsStr = '*No recent incidents recorded.*';
      if (incidents.length > 0) {
        logsStr = incidents.map(inc => {
          const date = new Date(inc.timestamp).toLocaleTimeString();
          return `\`[${date}]\` **${inc.action}** on <@${inc.executor_id}> - Punish: \`${inc.punishment_applied}\``;
        }).join('\n');
      }
      statusEmbed.addFields({ name: 'Recent Incidents (Last 5)', value: logsStr });

      return message.reply({ embeds: [statusEmbed] });
    }

    if (subcommand === 'config') {
      const config = db.getGuildConfig(guildId);
      const configKey = args[1] ? args[1].toLowerCase() : null;

      if (!configKey) {
        return message.reply('❌ Usage: `-antinuke config trusted_role <@role>` OR `-antinuke config punishment <event> <ban/timeout/kick/none>`');
      }

      if (configKey === 'trusted_role') {
        const roleMention = args[2];
        if (!roleMention) return message.reply('❌ Please specify a role. Usage: `-antinuke config trusted_role @Role`');
        
        const roleId = roleMention.replace(/[^0-9]/g, '');
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply('❌ Invalid role specified.');

        db.updateGuildConfig(guildId, { override_role_id: role.id });
        return message.reply(`✅ Configured Trusted Admin Role to: ${role.name}`);
      }

      if (configKey === 'punishment') {
        const event = args[2]; 
        const punishVal = args[3] ? args[3].toLowerCase() : null; 

        if (!event || !punishVal) {
          return message.reply('❌ Usage: `-antinuke config punishment <channelDelete/roleDelete/everyoneMention/webhookCreate> <ban/timeout/kick/none>`');
        }

        const validPunishments = ['ban', 'kick', 'timeout', 'none'];
        if (!validPunishments.includes(punishVal)) {
          return message.reply('❌ Invalid punishment value. Choose from: `ban`, `kick`, `timeout`, `none`');
        }

        const newPunishments = { ...config.punishment_settings };
        newPunishments[event] = punishVal;
        
        if (event === 'channelDelete') newPunishments.channelCreate = punishVal;
        if (event === 'roleDelete') {
          newPunishments.roleCreate = punishVal;
          newPunishments.roleUpdate = punishVal;
        }
        if (event === 'webhookCreate') newPunishments.webhooksUpdate = punishVal;

        db.updateGuildConfig(guildId, { punishment_settings: newPunishments });
        return message.reply(`✅ Updated punishment for **${event}** to **${punishVal}**.`);
      }

      return message.reply('❌ Unknown config key. Use `trusted_role` or `punishment`.');
    }
  }
};
