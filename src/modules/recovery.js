const db = require('../database/db');
const logger = require('../utils/logger');
const { ChannelType } = require('discord.js');


const roleIdMap = new Map();
const channelIdMap = new Map();

function serializeChannel(channel) {
  const overwrites = channel.permissionOverwrites.cache.map(ow => ({
    id: ow.id,
    type: ow.type, 
    allow: ow.allow.bitfield.toString(),
    deny: ow.deny.bitfield.toString()
  }));

  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    position: channel.position,
    parentId: channel.parentId,
    topic: channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement ? channel.topic : null,
    nsfw: channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement ? channel.nsfw : null,
    rateLimitPerUser: channel.type === ChannelType.GuildText ? channel.rateLimitPerUser : null,
    permissionOverwrites: overwrites
  };
}

function serializeRole(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(),
    position: role.position
  };
}


async function initGuildCache(guild) {
  try {
    logger.info(`Initializing channel and role cache snapshots for guild: ${guild.name} (${guild.id})`);
    
    
    const roles = await guild.roles.fetch();
    roles.forEach(role => {
      if (role.id !== guild.id) { 
        db.saveRoleCache(guild.id, role.id, serializeRole(role));
      }
    });

   
    const channels = await guild.channels.fetch();
    channels.forEach(channel => {
      if (channel) {
        db.saveChannelCache(guild.id, channel.id, serializeChannel(channel));
      }
    });

    logger.info(`Cache populated: ${roles.size - 1} roles, ${channels.size} channels cached.`);
  } catch (error) {
    logger.error(`Error populating cache for guild ${guild.id}: ${error.message}`);
  }
}


function updateChannelCache(channel) {
  if (!channel || !channel.guild) return;
  db.saveChannelCache(channel.guild.id, channel.id, serializeChannel(channel));
}


function removeChannelFromCache(guildId, channelId) {
  db.deleteChannelCache(guildId, channelId);
}


function updateRoleCache(role) {
  if (!role || !role.guild || role.id === role.guild.id) return;
  db.saveRoleCache(role.guild.id, role.id, serializeRole(role));
}


function removeRoleFromCache(guildId, roleId) {
  db.deleteRoleCache(guildId, roleId);
}

async function recoverChannel(guild, channelId) {
  const cachedData = db.getChannelCache(guild.id, channelId);
  if (!cachedData) {
    logger.warn(`No channel cache found for channel ID ${channelId} in guild ${guild.id}. Cannot recover.`);
    return null;
  }

  try {
    
    let parentId = cachedData.parentId;
    if (parentId && channelIdMap.has(parentId)) {
      parentId = channelIdMap.get(parentId);
    }

    
    const permissionOverwrites = (cachedData.permissionOverwrites || []).map(ow => {
      let targetId = ow.id;
      if (roleIdMap.has(targetId)) {
        targetId = roleIdMap.get(targetId); 
      }
      return {
        id: targetId,
        type: ow.type,
        allow: BigInt(ow.allow),
        deny: BigInt(ow.deny)
      };
    });

    logger.info(`Attempting to recreate channel: "${cachedData.name}"`);
    const newChannel = await guild.channels.create({
      name: cachedData.name,
      type: cachedData.type,
      parent: parentId,
      position: cachedData.position,
      topic: cachedData.topic || undefined,
      nsfw: cachedData.nsfw !== null ? cachedData.nsfw : undefined,
      rateLimitPerUser: cachedData.rateLimitPerUser !== null ? cachedData.rateLimitPerUser : undefined,
      permissionOverwrites: permissionOverwrites,
      reason: 'Anti-nuke: Recreating deleted channel'
    });

  
    channelIdMap.set(channelId, newChannel.id);
    
    
    db.deleteChannelCache(guild.id, channelId);
    db.saveChannelCache(guild.id, newChannel.id, serializeChannel(newChannel));

    logger.info(`Successfully recovered channel: "${newChannel.name}" -> ID: ${newChannel.id}`);
    return newChannel;
  } catch (error) {
    logger.error(`Failed to recover channel ${channelId} ("${cachedData.name}"): ${error.message}`);
    return null;
  }
}


async function recoverRole(guild, roleId) {
  const cachedData = db.getRoleCache(guild.id, roleId);
  if (!cachedData) {
    logger.warn(`No role cache found for role ID ${roleId} in guild ${guild.id}. Cannot recover.`);
    return null;
  }

  try {
    logger.info(`Attempting to recreate role: "${cachedData.name}"`);
    const newRole = await guild.roles.create({
      name: cachedData.name,
      color: cachedData.color,
      hoist: cachedData.hoist,
      mentionable: cachedData.mentionable,
      permissions: BigInt(cachedData.permissions),
      reason: 'Anti-nuke: Recreating deleted role'
    });

    
    if (cachedData.position) {
      await newRole.setPosition(cachedData.position).catch(() => null);
    }

   
    roleIdMap.set(roleId, newRole.id);

    
    db.deleteRoleCache(guild.id, roleId);
    db.saveRoleCache(guild.id, newRole.id, serializeRole(newRole));

    logger.info(`Successfully recovered role: "${newRole.name}" -> ID: ${newRole.id}`);
    return newRole;
  } catch (error) {
    logger.error(`Failed to recover role ${roleId} ("${cachedData.name}"): ${error.message}`);
    return null;
  }
}


async function restoreChannelSettings(channel, cachedData) {
  try {
    let parentId = cachedData.parentId;
    if (parentId && channelIdMap.has(parentId)) {
      parentId = channelIdMap.get(parentId);
    }

    const overwrites = (cachedData.permissionOverwrites || []).map(ow => {
      let targetId = ow.id;
      if (roleIdMap.has(targetId)) {
        targetId = roleIdMap.get(targetId);
      }
      return {
        id: targetId,
        type: ow.type,
        allow: BigInt(ow.allow),
        deny: BigInt(ow.deny)
      };
    });

    await channel.edit({
      name: cachedData.name,
      parent: parentId,
      position: cachedData.position,
      topic: cachedData.topic || undefined,
      nsfw: cachedData.nsfw !== null ? cachedData.nsfw : undefined,
      rateLimitPerUser: cachedData.rateLimitPerUser !== null ? cachedData.rateLimitPerUser : undefined,
      permissionOverwrites: overwrites,
      reason: 'Anti-nuke: Reverting unauthorized channel modification'
    });
    
    logger.info(`Restored settings for channel "${channel.name}" (${channel.id}).`);
    return true;
  } catch (error) {
    logger.error(`Failed to restore channel settings for "${channel.name}": ${error.message}`);
    return false;
  }
}


async function restoreRoleSettings(role, cachedData) {
  try {
    await role.edit({
      name: cachedData.name,
      color: cachedData.color,
      hoist: cachedData.hoist,
      mentionable: cachedData.mentionable,
      permissions: BigInt(cachedData.permissions),
      reason: 'Anti-nuke: Reverting unauthorized role modification'
    });

    if (cachedData.position) {
      await role.setPosition(cachedData.position).catch(() => null);
    }

    logger.info(`Restored settings for role "${role.name}" (${role.id}).`);
    return true;
  } catch (error) {
    logger.error(`Failed to restore role settings for "${role.name}": ${error.message}`);
    return false;
  }
}

module.exports = {
  initGuildCache,
  updateChannelCache,
  removeChannelFromCache,
  updateRoleCache,
  removeRoleFromCache,
  recoverChannel,
  recoverRole,
  restoreChannelSettings,
  restoreRoleSettings,
  roleIdMap,
  channelIdMap
};
