const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');
const whitelistUtil = require('../utils/whitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage the server anti-nuke whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Grant specific anti-nuke bypass privileges to a user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to whitelist')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove all whitelist bypass privileges from a user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all users currently on the whitelist')
    ),

  
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You must be an Administrator to run this command.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'add') {
      const targetUser = interaction.options.getUser('user');
      if (targetUser.bot) {
        return interaction.reply({ content: '❌ You cannot whitelist bot accounts.', ephemeral: true });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`whitelist_select_${targetUser.id}_${interaction.user.id}`)
        .setPlaceholder('Select bypass permissions for this user')
        .setMinValues(1)
        .setMaxValues(8)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Channel Management').setValue('channel').setDescription('Create, delete, update channels'),
          new StringSelectMenuOptionBuilder().setLabel('Role Management').setValue('role').setDescription('Create, delete, update roles'),
          new StringSelectMenuOptionBuilder().setLabel('Ban Members').setValue('ban').setDescription('Bypass ban check'),
          new StringSelectMenuOptionBuilder().setLabel('Kick Members').setValue('kick').setDescription('Bypass kick check'),
          new StringSelectMenuOptionBuilder().setLabel('Webhook Management').setValue('webhook').setDescription('Bypass webhooks checks'),
          new StringSelectMenuOptionBuilder().setLabel('Server Settings').setValue('server').setDescription('Bypass server edits'),
          new StringSelectMenuOptionBuilder().setLabel('Mention Everyone').setValue('mention').setDescription('Bypass @everyone block'),
          new StringSelectMenuOptionBuilder().setLabel('Bulk Delete Messages').setValue('mass_delete').setDescription('Bypass bulk deletes')
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.reply({
        content: `🔧 Select which anti-nuke permissions to grant to **${targetUser.tag}**:`,
        components: [row]
      });
    }

    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const whitelistData = db.getWhitelist(guildId);
      
      if (!whitelistData[targetUser.id]) {
        return interaction.reply({ content: `❌ **${targetUser.tag}** is not currently whitelisted.`, ephemeral: true });
      }

      delete whitelistData[targetUser.id];
      db.updateGuildConfig(guildId, {}); 

      return interaction.reply({ content: `✅ Removed all whitelist permissions for **${targetUser.tag}**.` });
    }

    if (subcommand === 'list') {
      const listEmbed = buildWhitelistEmbed(interaction.guild);
      return interaction.reply({ embeds: [listEmbed] });
    }
  },


  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && message.guild.ownerId !== message.author.id) {
      return message.reply('❌ You must be an Administrator to run this command.');
    }

    const subcommand = args[0] ? args[0].toLowerCase() : null;
    const guildId = message.guild.id;

    if (!subcommand || subcommand === 'list') {
      const listEmbed = buildWhitelistEmbed(message.guild);
      return message.reply({ embeds: [listEmbed] });
    }

    if (subcommand === 'add') {
      const userMention = args[1];
      if (!userMention) {
        return message.reply('❌ Please specify a user to whitelist. Usage: `-whitelist add @user`');
      }

      const userId = userMention.replace(/[^0-9]/g, '');
      const member = await message.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return message.reply('❌ User not found in this server.');
      }
      if (member.user.bot) {
        return message.reply('❌ You cannot whitelist bot accounts.');
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`whitelist_select_${member.id}_${message.author.id}`)
        .setPlaceholder('Select bypass permissions for this user')
        .setMinValues(1)
        .setMaxValues(8)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Channel Management').setValue('channel').setDescription('Create, delete, update channels'),
          new StringSelectMenuOptionBuilder().setLabel('Role Management').setValue('role').setDescription('Create, delete, update roles'),
          new StringSelectMenuOptionBuilder().setLabel('Ban Members').setValue('ban').setDescription('Bypass ban check'),
          new StringSelectMenuOptionBuilder().setLabel('Kick Members').setValue('kick').setDescription('Bypass kick check'),
          new StringSelectMenuOptionBuilder().setLabel('Webhook Management').setValue('webhook').setDescription('Bypass webhooks checks'),
          new StringSelectMenuOptionBuilder().setLabel('Server Settings').setValue('server').setDescription('Bypass server edits'),
          new StringSelectMenuOptionBuilder().setLabel('Mention Everyone').setValue('mention').setDescription('Bypass @everyone block'),
          new StringSelectMenuOptionBuilder().setLabel('Bulk Delete Messages').setValue('mass_delete').setDescription('Bypass bulk deletes')
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return message.reply({
        content: `🔧 Select which anti-nuke permissions to grant to **${member.user.tag}**:`,
        components: [row]
      });
    }

    if (subcommand === 'remove') {
      const userMention = args[1];
      if (!userMention) {
        return message.reply('❌ Please specify a user to remove. Usage: `-whitelist remove @user`');
      }

      const userId = userMention.replace(/[^0-9]/g, '');
      const whitelistData = db.getWhitelist(guildId);
      
      if (!whitelistData[userId]) {
        return message.reply(`❌ User is not currently whitelisted.`);
      }

      delete whitelistData[userId];
      db.updateGuildConfig(guildId, {}); 

      const user = await message.client.users.fetch(userId).catch(() => null);
      const name = user ? user.tag : userId;

      return message.reply(`✅ Removed all whitelist permissions for **${name}**.`);
    }

    return message.reply('❌ Unknown subcommand. Use `add`, `remove`, or `list`.');
  }
};


function buildWhitelistEmbed(guild) {
  const guildId = guild.id;
  const config = db.getGuildConfig(guildId);
  const whitelistData = db.getWhitelist(guildId);

  const embed = new EmbedBuilder()
    .setTitle('📋 Whitelist Configurations')
    .setColor(0x00FF99)
    .setTimestamp();

  const details = [];


  details.push(`👑 **Server Owner (Full Bypass):** <@${guild.ownerId}>`);


  if (config.override_role_id) {
    details.push(`🛡️ **Trusted Admin Role (Full Bypass):** <@&${config.override_role_id}>`);
  } else {
    details.push('🛡️ **Trusted Admin Role:** *None configured (use `/antinuke config`)*');
  }

  details.push('\n**Granular Whitelisted Users:**');

  const userIds = Object.keys(whitelistData);
  if (userIds.length === 0) {
    details.push('*No granular whitelisted users registered.*');
  } else {
    userIds.forEach(userId => {
      const actions = whitelistData[userId] || [];
      const labels = actions.map(act => `\`${whitelistUtil.ACTION_LABELS[act] || act}\``).join(', ');
      details.push(`• <@${userId}>: ${labels || '*No permissions*'}`);
    });
  }

  embed.setDescription(details.join('\n'));
  return embed;
}
