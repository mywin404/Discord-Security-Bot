const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const setupState = require('../utils/setupState');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure primary VamBot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('dashboard')
        .setDescription('Open the interactive VamBot settings configurator panel')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logchannel')
        .setDescription('Designate a channel where protection logs will be sent (legacy raw setup)')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Select the channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You must be an Administrator to run this command.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'dashboard') {
      const response = setupState.buildConfiguratorMessage(interaction.guild, interaction.user.id);
      return interaction.reply(response);
    }

    if (subcommand === 'logchannel') {
      const channel = interaction.options.getChannel('channel');
      db.updateGuildConfig(interaction.guild.id, { log_channel_id: channel.id });
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Configuration Saved')
        .setColor(0x00FF00)
        .setDescription(`VamBot security incidents and alerts will now be logged in ${channel}.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },

 
  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && message.guild.ownerId !== message.author.id) {
      return message.reply('❌ You must be an Administrator to run this command.');
    }

    const subcommand = args[0] ? args[0].toLowerCase() : null;

    
    if (!subcommand || subcommand === 'dashboard') {
      const response = setupState.buildConfiguratorMessage(message.guild, message.author.id);
      return message.reply(response);
    }

    if (subcommand === 'logchannel') {
      const channelMention = args[1];
      if (!channelMention) {
        return message.reply('❌ Please specify a channel. Usage: `-setup logchannel #channel`');
      }

      const channelId = channelMention.replace(/[^0-9]/g, '');
      const channel = message.guild.channels.cache.get(channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply('❌ Invalid text channel specified.');
      }

      db.updateGuildConfig(message.guild.id, { log_channel_id: channel.id });

      const embed = new EmbedBuilder()
        .setTitle('✅ Configuration Saved')
        .setColor(0x00FF00)
        .setDescription(`VamBot security incidents and alerts will now be logged in ${channel}.`)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } else {
      return message.reply('❌ Unknown subcommand. Available subcommands: `dashboard`, `logchannel`');
    }
  }
};
