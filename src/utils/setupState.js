const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ChannelSelectMenuBuilder, 
  RoleSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType 
} = require('discord.js');
const db = require('../database/db');


const pendingStates = new Map();

function getOrCreateState(guildId, userId) {
  const key = `${guildId}-${userId}`;
  let state = pendingStates.get(key);
  
  if (!state) {
    const config = db.getGuildConfig(guildId);
    state = {
      log_channel_id: config.log_channel_id,
      override_role_id: config.override_role_id,
      bypass_role_id: config.automod_settings.filter_bypass_roles?.[0] || null,
      spam_enabled: config.automod_settings.spam_enabled,
      raid_enabled: config.automod_settings.raid_enabled,
      block_all_links: config.automod_settings.block_all_links
    };
    pendingStates.set(key, state);
  }
  
  return state;
}

function commitState(guildId, userId) {
  const key = `${guildId}-${userId}`;
  const state = pendingStates.get(key);
  if (!state) return false;

  const config = db.getGuildConfig(guildId);
  const automod = { ...config.automod_settings };
  
  automod.spam_enabled = state.spam_enabled;
  automod.raid_enabled = state.raid_enabled;
  automod.block_all_links = state.block_all_links;
  
  if (state.bypass_role_id) {
    automod.filter_bypass_roles = [state.bypass_role_id];
  } else {
    automod.filter_bypass_roles = [];
  }

  db.updateGuildConfig(guildId, {
    log_channel_id: state.log_channel_id,
    override_role_id: state.override_role_id,
    automod_settings: automod
  });

  pendingStates.delete(key);
  return true;
}


function clearState(guildId, userId) {
  const key = `${guildId}-${userId}`;
  pendingStates.delete(key);
}

function buildConfiguratorMessage(guild, userId) {
  const state = getOrCreateState(guild.id, userId);


  const embed = new EmbedBuilder()
    .setTitle('⚙️ VamBot System Configurator')
    .setColor(0x00D2FF)
    .setDescription('Use the selectors below to choose channels and reviewer roles, then click **Save Settings**.')
    .addFields(
      { 
        name: 'Public Log Channel', 
        value: state.log_channel_id ? `<#${state.log_channel_id}>` : '🔴 *Not Configured*' 
      },
      { 
        name: 'Trusted Admin Role (Anti-Nuke)', 
        value: state.override_role_id ? `<@&${state.override_role_id}>` : '⚪ *None*' 
      },
      { 
        name: 'Bypass Role (Automod)', 
        value: state.bypass_role_id ? `<@&${state.bypass_role_id}>` : '⚪ *None*' 
      },
      { 
        name: 'Spam Protection', 
        value: state.spam_enabled ? '🟢 **Enabled**' : '🔴 **Disabled**', 
        inline: true 
      },
      { 
        name: 'Raid Protection', 
        value: state.raid_enabled ? '🟢 **Enabled**' : '🔴 **Disabled**', 
        inline: true 
      },
      { 
        name: 'Block All Links', 
        value: state.block_all_links ? '🟢 **Enabled**' : '🔴 **Disabled**', 
        inline: true 
      }
    )
    .setTimestamp()
    .setFooter({ text: `Configuring for Admin: ${guild.members.cache.get(userId)?.user.tag || userId}` });

  
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`setup_channel_select_${userId}`)
    .setPlaceholder('Select Log Channel (where security alerts are sent)...')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  
  const trustedSelect = new RoleSelectMenuBuilder()
    .setCustomId(`setup_trusted_select_${userId}`)
    .setPlaceholder('Select Trusted Admin Role (anti-nuke bypass)...')
    .setMinValues(1)
    .setMaxValues(1);

  
  const bypassSelect = new RoleSelectMenuBuilder()
    .setCustomId(`setup_bypass_select_${userId}`)
    .setPlaceholder('Select Automod Bypass Role (spam/links bypass)...')
    .setMinValues(1)
    .setMaxValues(1);

  
  const btnToggleSpam = new ButtonBuilder()
    .setCustomId(`setup_toggle_spam_${userId}`)
    .setLabel('Toggle Spam 💬')
    .setStyle(state.spam_enabled ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnToggleRaid = new ButtonBuilder()
    .setCustomId(`setup_toggle_raid_${userId}`)
    .setLabel('Toggle Raid 🛡️')
    .setStyle(state.raid_enabled ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnToggleLinks = new ButtonBuilder()
    .setCustomId(`setup_toggle_links_${userId}`)
    .setLabel('Toggle Links 🔗')
    .setStyle(state.block_all_links ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnSave = new ButtonBuilder()
    .setCustomId(`setup_save_${userId}`)
    .setLabel('Save Settings ✅')
    .setStyle(ButtonStyle.Success);

  const btnClose = new ButtonBuilder()
    .setCustomId(`setup_close_${userId}`)
    .setLabel('Close Menu ❌')
    .setStyle(ButtonStyle.Danger);


  const row1 = new ActionRowBuilder().addComponents(channelSelect);
  const row2 = new ActionRowBuilder().addComponents(trustedSelect);
  const row3 = new ActionRowBuilder().addComponents(bypassSelect);
  const row4 = new ActionRowBuilder().addComponents(btnToggleSpam, btnToggleRaid, btnToggleLinks, btnSave, btnClose);

  return {
    embeds: [embed],
    components: [row1, row2, row3, row4]
  };
}

module.exports = {
  pendingStates,
  getOrCreateState,
  commitState,
  clearState,
  buildConfiguratorMessage
};
