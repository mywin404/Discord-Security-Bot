const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Manage blacklisted words and links')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommandGroup(group =>
      group
        .setName('word')
        .setDescription('Manage filtered words')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Add a word or wildcard pattern to the blacklist')
            .addStringOption(option =>
              option.setName('pattern').setDescription('The word, wildcard (e.g. *badword*), or RegExp (e.g. /regex/) to filter').setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('Remove a word or pattern from the blacklist')
            .addStringOption(option =>
              option.setName('pattern').setDescription('The word or pattern to remove').setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List all blacklisted words/patterns')
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('link')
        .setDescription('Manage blacklisted links/domains')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Add a domain to the blacklist (e.g. scamlink.xyz)')
            .addStringOption(option =>
              option.setName('domain').setDescription('The link domain to filter').setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('Remove a domain from the blacklist')
            .addStringOption(option =>
              option.setName('domain').setDescription('The link domain to remove').setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List all blacklisted links/domains')
        )
    ),


  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You must have Manage Messages permission to run this command.', ephemeral: true });
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (group === 'word') {
      if (subcommand === 'add') {
        const pattern = interaction.options.getString('pattern');
        const added = db.addFilterWord(guildId, pattern);
        
        return interaction.reply({
          content: added 
            ? `✅ Added \`${pattern}\` to the blacklisted words list.`
            : `ℹ️ \`${pattern}\` is already blacklisted.`,
          ephemeral: true
        });
      }

      if (subcommand === 'remove') {
        const pattern = interaction.options.getString('pattern');
        const removed = db.removeFilterWord(guildId, pattern);
        
        return interaction.reply({
          content: removed
            ? `✅ Removed \`${pattern}\` from the blacklisted words list.`
            : `❌ \`${pattern}\` was not found in the blacklist.`,
          ephemeral: true
        });
      }

      if (subcommand === 'list') {
        const words = db.getFilterWords(guildId);
        const embed = new EmbedBuilder()
          .setTitle('🚫 Blacklisted Words')
          .setColor(0xFF3333)
          .setDescription(words.length > 0 
            ? words.map((w, idx) => `**${idx + 1}.** \`${w}\``).join('\n') 
            : '*No words are currently blacklisted.*')
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    }

    if (group === 'link') {
      if (subcommand === 'add') {
        const domain = interaction.options.getString('domain');
        const added = db.addFilterLink(guildId, domain);

        return interaction.reply({
          content: added 
            ? `✅ Added domain \`${domain}\` to the links blacklist.`
            : `ℹ️ Domain \`${domain}\` is already blacklisted.`,
          ephemeral: true
        });
      }

      if (subcommand === 'remove') {
        const domain = interaction.options.getString('domain');
        const removed = db.removeFilterLink(guildId, domain);

        return interaction.reply({
          content: removed 
            ? `✅ Removed domain \`${domain}\` from the links blacklist.`
            : `❌ Domain \`${domain}\` was not found in the blacklist.`,
          ephemeral: true
        });
      }

      if (subcommand === 'list') {
        const links = db.getFilterLinks(guildId);
        const config = db.getGuildConfig(guildId);
        const embed = new EmbedBuilder()
          .setTitle('🔗 Blacklisted Link Domains')
          .setColor(0xFF3333)
          .setDescription(
            `Block All Links Mode: **${config.automod_settings.block_all_links ? 'ENABLED' : 'DISABLED'}**\n\n` +
            (links.length > 0 
              ? links.map((l, idx) => `**${idx + 1}.** \`${l}\``).join('\n')
              : '*No specific domains are blacklisted.*')
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    }
  },


  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && message.guild.ownerId !== message.author.id) {
      return message.reply('❌ You must have Manage Messages permission to run this command.');
    }

    const type = args[0] ? args[0].toLowerCase() : null; 
    const action = args[1] ? args[1].toLowerCase() : null; 
    const value = args.slice(2).join(' '); 

    if (!['word', 'link'].includes(type)) {
      return message.reply('❌ Usage: `-filter <word/link> <add/remove/list> [value]`');
    }

    const guildId = message.guild.id;

    if (type === 'word') {
      if (!action || action === 'list') {
        const words = db.getFilterWords(guildId);
        const embed = new EmbedBuilder()
          .setTitle('🚫 Blacklisted Words')
          .setColor(0xFF3333)
          .setDescription(words.length > 0 
            ? words.map((w, idx) => `**${idx + 1}.** \`${w}\``).join('\n') 
            : '*No words are currently blacklisted.*')
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      if (action === 'add') {
        if (!value) return message.reply('❌ Please specify a word or pattern to add.');
        const added = db.addFilterWord(guildId, value);
        return message.reply(added ? `✅ Added \`${value}\` to the word blacklist.` : `ℹ️ \`${value}\` is already blacklisted.`);
      }

      if (action === 'remove') {
        if (!value) return message.reply('❌ Please specify a word or pattern to remove.');
        const removed = db.removeFilterWord(guildId, value);
        return message.reply(removed ? `✅ Removed \`${value}\` from the word blacklist.` : `❌ \`${value}\` not found in blacklist.`);
      }
    }

    if (type === 'link') {
      if (!action || action === 'list') {
        const links = db.getFilterLinks(guildId);
        const config = db.getGuildConfig(guildId);
        const embed = new EmbedBuilder()
          .setTitle('🔗 Blacklisted Link Domains')
          .setColor(0xFF3333)
          .setDescription(
            `Block All Links Mode: **${config.automod_settings.block_all_links ? 'ENABLED' : 'DISABLED'}**\n\n` +
            (links.length > 0 
              ? links.map((l, idx) => `**${idx + 1}.** \`${l}\``).join('\n')
              : '*No specific domains are blacklisted.*')
          )
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      if (action === 'add') {
        if (!value) return message.reply('❌ Please specify a domain to add.');
        const added = db.addFilterLink(guildId, value);
        return message.reply(added ? `✅ Added \`${value}\` to the link blacklist.` : `ℹ️ \`${value}\` is already blacklisted.`);
      }

      if (action === 'remove') {
        if (!value) return message.reply('❌ Please specify a domain to remove.');
        const removed = db.removeFilterLink(guildId, value);
        return message.reply(removed ? `✅ Removed \`${value}\` from the link blacklist.` : `❌ \`${value}\` not found in blacklist.`);
      }
    }

    return message.reply('❌ Unknown command format. Usage: `-filter <word/link> <add/remove/list> [value]`');
  }
};
