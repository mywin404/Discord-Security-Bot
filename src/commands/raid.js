const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const antiraid = require('../modules/antiraid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Manage server raid controls')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlock')
        .setDescription('Manually lift server lockdown and restore everyone permissions')
    ),


  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You must be an Administrator to run this command.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'unlock') {
      await interaction.deferReply({ ephemeral: true });
      const success = await antiraid.liftServerLockdown(interaction.guild, interaction.user.tag);
      
      if (success) {
        return interaction.editReply({ content: '🔓 Server lockdown lifted successfully. Channel permissions and verification levels have been restored.' });
      } else {
        return interaction.editReply({ content: '❌ Failed to lift server lockdown. Please check my role permissions and hierarchy.' });
      }
    }
  },


  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && message.guild.ownerId !== message.author.id) {
      return message.reply('❌ You must be an Administrator to run this command.');
    }

    const subcommand = args[0] ? args[0].toLowerCase() : null;

    if (subcommand === 'unlock') {
      const msg = await message.reply('⏳ Attempting to lift server lockdown...');
      const success = await antiraid.liftServerLockdown(message.guild, message.author.tag);
      
      if (success) {
        return msg.edit('🔓 Server lockdown lifted successfully. Channel permissions and verification levels have been restored.');
      } else {
        return msg.edit('❌ Failed to lift server lockdown. Check my permissions and hierarchy.');
      }
    } else {
      return message.reply('❌ Usage: `-raid unlock`');
    }
  }
};
