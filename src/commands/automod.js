const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure automod safeguards (Spam, Raid, Links)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Configure automod policies')
        .addBooleanOption(option =>
          option.setName('spam_enabled').setDescription('Enable/Disable spam message safeguards')
        )
        .addIntegerOption(option =>
          option.setName('spam_messages').setDescription('Number of spam messages allowed in the time window')
        )
        .addIntegerOption(option =>
          option.setName('spam_seconds').setDescription('Time window size in seconds for spam messages')
        )
        .addIntegerOption(option =>
          option.setName('image_limit').setDescription('Number of attachments/images allowed in the window')
        )
        .addIntegerOption(option =>
          option.setName('image_seconds').setDescription('Time window size in seconds for attachments/images')
        )
        .addStringOption(option =>
          option.setName('spam_punishment')
            .setDescription('Punishment when spam/images limit is breached')
            .addChoices(
              { name: 'Warn Only', value: 'warn' },
              { name: 'Timeout Member', value: 'timeout' },
              { name: 'Kick Member', value: 'kick' },
              { name: 'Ban Member', value: 'ban' }
            )
        )
        .addBooleanOption(option =>
          option.setName('raid_enabled').setDescription('Enable/Disable join-spike raid protection')
        )
        .addIntegerOption(option =>
          option.setName('raid_threshold').setDescription('Max joins allowed within the raid window')
        )
        .addIntegerOption(option =>
          option.setName('raid_seconds').setDescription('Time window size in seconds for member joins')
        )
        .addIntegerOption(option =>
          option.setName('raid_cooldown').setDescription('Cooldown in seconds before lifting automatic lockdown')
        )
        .addBooleanOption(option =>
          option.setName('block_links').setDescription('Enable block all links mode (ignores whitelist links config)')
        )
        .addRoleOption(option =>
          option.setName('bypass_role').setDescription('Role that bypasses all automod filters')
        )
    ),


  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You must be an Administrator to run this command.', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const config = db.getGuildConfig(guildId);
    const automod = { ...config.automod_settings };

    // Capture options
    const spamEnabled = interaction.options.getBoolean('spam_enabled');
    const spamMessages = interaction.options.getInteger('spam_messages');
    const spamSeconds = interaction.options.getInteger('spam_seconds');
    const imgLimit = interaction.options.getInteger('image_limit');
    const imgSec = interaction.options.getInteger('image_seconds');
    const spamPunish = interaction.options.getString('spam_punishment');
    
    const raidEnabled = interaction.options.getBoolean('raid_enabled');
    const raidThreshold = interaction.options.getInteger('raid_threshold');
    const raidSeconds = interaction.options.getInteger('raid_seconds');
    const raidCooldown = interaction.options.getInteger('raid_cooldown');
    
    const blockLinks = interaction.options.getBoolean('block_links');
    const bypassRole = interaction.options.getRole('bypass_role');


    if (spamEnabled !== null) automod.spam_enabled = spamEnabled;
    if (spamMessages !== null) automod.spam_message_threshold = spamMessages;
    if (spamSeconds !== null) automod.spam_message_seconds = spamSeconds;
    if (imgLimit !== null) automod.spam_image_threshold = imgLimit;
    if (imgSec !== null) automod.spam_image_seconds = imgSec;
    if (spamPunish !== null) automod.spam_punishment = spamPunish;

    if (raidEnabled !== null) automod.raid_enabled = raidEnabled;
    if (raidThreshold !== null) automod.raid_join_threshold = raidThreshold;
    if (raidSeconds !== null) automod.raid_join_seconds = raidSeconds;
    if (raidCooldown !== null) automod.raid_cooldown = raidCooldown;

    if (blockLinks !== null) automod.block_all_links = blockLinks;
    
    if (bypassRole) {

      if (!automod.filter_bypass_roles) automod.filter_bypass_roles = [];
      if (!automod.filter_bypass_roles.includes(bypassRole.id)) {
        automod.filter_bypass_roles.push(bypassRole.id);
      }
    }

    db.updateGuildConfig(guildId, { automod_settings: automod });

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Automod Configurations Updated')
      .setColor(0x00FFBB)
      .setTimestamp()
      .setDescription('Saved updated automod thresholds and configurations.');

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && message.guild.ownerId !== message.author.id) {
      return message.reply('❌ You must be an Administrator to run this command.');
    }

    const subcommand = args[0] ? args[0].toLowerCase() : null;
    const guildId = message.guild.id;

    if (subcommand !== 'config') {
      return message.reply('❌ Usage: `-automod config <option> <value>`\nAvailable options: `spam_enabled`, `spam_messages`, `spam_seconds`, `image_limit`, `image_seconds`, `spam_punishment`, `raid_enabled`, `block_links`, `bypass_role`');
    }

    const option = args[1] ? args[1].toLowerCase() : null;
    const valueStr = args[2];

    if (!option || valueStr === undefined) {
      return message.reply('❌ Please specify both an option and a value to set. E.g. `-automod config spam_enabled true`');
    }

    const config = db.getGuildConfig(guildId);
    const automod = { ...config.automod_settings };
    
    let isSuccess = true;
    let feedback = '';

    switch (option) {
      case 'spam_enabled':
        automod.spam_enabled = valueStr.toLowerCase() === 'true';
        feedback = `Spam safeguard: ${automod.spam_enabled ? 'ENABLED' : 'DISABLED'}`;
        break;
      case 'spam_messages':
        automod.spam_message_threshold = parseInt(valueStr, 10);
        feedback = `Spam message threshold: ${automod.spam_message_threshold}`;
        break;
      case 'spam_seconds':
        automod.spam_message_seconds = parseInt(valueStr, 10);
        feedback = `Spam message time window: ${automod.spam_message_seconds} seconds`;
        break;
      case 'image_limit':
        automod.spam_image_threshold = parseInt(valueStr, 10);
        feedback = `Spam image threshold: ${automod.spam_image_threshold}`;
        break;
      case 'image_seconds':
        automod.spam_image_seconds = parseInt(valueStr, 10);
        feedback = `Spam image time window: ${automod.spam_image_seconds} seconds`;
        break;
      case 'spam_punishment':
        if (['warn', 'timeout', 'kick', 'ban'].includes(valueStr.toLowerCase())) {
          automod.spam_punishment = valueStr.toLowerCase();
          feedback = `Spam punishment action: ${automod.spam_punishment}`;
        } else {
          isSuccess = false;
          feedback = 'Invalid punishment type. Select: `warn`, `timeout`, `kick`, `ban`';
        }
        break;
      case 'raid_enabled':
        automod.raid_enabled = valueStr.toLowerCase() === 'true';
        feedback = `Raid protection status: ${automod.raid_enabled ? 'ENABLED' : 'DISABLED'}`;
        break;
      case 'block_links':
        automod.block_all_links = valueStr.toLowerCase() === 'true';
        feedback = `Block all links: ${automod.block_all_links ? 'ENABLED' : 'DISABLED'}`;
        break;
      case 'bypass_role':
        const roleId = valueStr.replace(/[^0-9]/g, '');
        const role = message.guild.roles.cache.get(roleId);
        if (role) {
          if (!automod.filter_bypass_roles) automod.filter_bypass_roles = [];
          if (!automod.filter_bypass_roles.includes(role.id)) {
            automod.filter_bypass_roles.push(role.id);
          }
          feedback = `Added ${role.name} to automod bypass roles.`;
        } else {
          isSuccess = false;
          feedback = 'Invalid role specified.';
        }
        break;
      default:
        isSuccess = false;
        feedback = `Unknown option: \`${option}\``;
    }

    if (isSuccess) {
      db.updateGuildConfig(guildId, { automod_settings: automod });
      return message.reply(`✅ **Config Updated:** ${feedback}`);
    } else {
      return message.reply(`❌ **Failed to update config:** ${feedback}`);
    }
  }
};
