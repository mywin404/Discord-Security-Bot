const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'db.json');


const DEFAULT_PUNISHMENTS = {
  channelCreate: 'ban',
  channelDelete: 'ban',
  channelUpdate: 'ban',
  roleCreate: 'ban',
  roleDelete: 'ban',
  roleUpdate: 'ban',
  guildMemberRemove: 'ban', 
  guildBanAdd: 'ban',
  webhooksUpdate: 'ban',
  guildUpdate: 'ban',
  guildIntegrationsUpdate: 'ban',
  everyoneMention: 'timeout',
  webhookCreate: 'ban',
  permissionElevation: 'ban',
  massDelete: 'ban'
};

const DEFAULT_AUTOMOD = {
  spam_enabled: false,
  spam_message_threshold: 5,
  spam_message_seconds: 5,
  spam_image_threshold: 5,
  spam_image_seconds: 15,
  spam_punishment: 'timeout', 
  raid_enabled: false,
  raid_join_threshold: 10,
  raid_join_seconds: 30,
  raid_punishment: 'lockdown',
  raid_cooldown: 300, 
  block_all_links: false,
  link_whitelisted_domains: [], 
  filter_bypass_roles: [] 
};

let db = {
  guild_config: {},
  whitelist: {},  
  filter_words: {}, 
  filter_links: {},   
  channel_cache: {}, 
  role_cache: {}, 
  incidents: [] 
};


function init() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
      const fileContent = fs.readFileSync(DB_PATH, 'utf8');
      if (fileContent.trim()) {
        db = JSON.parse(fileContent);
      }
    } else {
      saveData();
    }
    logger.info('Database initialized successfully using JSON fallback.');
  } catch (error) {
    logger.error('Failed to initialize database: ' + error.message);
  }
}


function saveData() {
  try {
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (error) {
    logger.error('Database write error: ' + error.message);
  }
}


function getGuildConfig(guildId) {
  if (!db.guild_config[guildId]) {
    db.guild_config[guildId] = {
      guild_id: guildId,
      log_channel_id: null,
      override_role_id: null,
      punishment_settings: { ...DEFAULT_PUNISHMENTS },
      automod_settings: { ...DEFAULT_AUTOMOD }
    };
    saveData();
  }
  
 
  const config = db.guild_config[guildId];
  if (!config.punishment_settings) config.punishment_settings = { ...DEFAULT_PUNISHMENTS };
  if (!config.automod_settings) config.automod_settings = { ...DEFAULT_AUTOMOD };
  
  return config;
}

function updateGuildConfig(guildId, updates) {
  const current = getGuildConfig(guildId);
  db.guild_config[guildId] = {
    ...current,
    ...updates,
    punishment_settings: { ...current.punishment_settings, ...(updates.punishment_settings || {}) },
    automod_settings: { ...current.automod_settings, ...(updates.automod_settings || {}) }
  };
  saveData();
  return db.guild_config[guildId];
}


function getWhitelist(guildId) {
  if (!db.whitelist[guildId]) {
    db.whitelist[guildId] = {};
  }
  return db.whitelist[guildId];
}

function addWhitelist(guildId, userId, actionType) {
  const whitelist = getWhitelist(guildId);
  if (!whitelist[userId]) {
    whitelist[userId] = [];
  }
  if (!whitelist[userId].includes(actionType)) {
    whitelist[userId].push(actionType);
    saveData();
  }
  return whitelist[userId];
}

function removeWhitelist(guildId, userId, actionType) {
  const whitelist = getWhitelist(guildId);
  if (whitelist[userId]) {
    whitelist[userId] = whitelist[userId].filter(action => action !== actionType);
    if (whitelist[userId].length === 0) {
      delete whitelist[userId];
    }
    saveData();
  }
  return whitelist[userId] || [];
}

function isWhitelisted(guild, userId, actionType) {
 
  if (guild.ownerId === userId) return true;
  
  const config = getGuildConfig(guild.id);
  

  if (config.override_role_id) {
    const member = guild.members.cache.get(userId);
    if (member && member.roles.cache.has(config.override_role_id)) {
      return true;
    }
  }

  
  const whitelist = getWhitelist(guild.id);
  if (whitelist[userId] && whitelist[userId].includes(actionType)) {
    return true;
  }
  
  return false;
}


function getFilterWords(guildId) {
  if (!db.filter_words[guildId]) {
    db.filter_words[guildId] = [];
  }
  return db.filter_words[guildId];
}

function addFilterWord(guildId, word) {
  const words = getFilterWords(guildId);
  const normalized = word.toLowerCase().trim();
  if (!words.includes(normalized)) {
    words.push(normalized);
    saveData();
    return true;
  }
  return false;
}

function removeFilterWord(guildId, word) {
  const words = getFilterWords(guildId);
  const normalized = word.toLowerCase().trim();
  if (words.includes(normalized)) {
    db.filter_words[guildId] = words.filter(w => w !== normalized);
    saveData();
    return true;
  }
  return false;
}


function getFilterLinks(guildId) {
  if (!db.filter_links[guildId]) {
    db.filter_links[guildId] = [];
  }
  return db.filter_links[guildId];
}

function addFilterLink(guildId, link) {
  const links = getFilterLinks(guildId);
  const normalized = link.toLowerCase().trim();
  if (!links.includes(normalized)) {
    links.push(normalized);
    saveData();
    return true;
  }
  return false;
}

function removeFilterLink(guildId, link) {
  const links = getFilterLinks(guildId);
  const normalized = link.toLowerCase().trim();
  if (links.includes(normalized)) {
    db.filter_links[guildId] = links.filter(l => l !== normalized);
    saveData();
    return true;
  }
  return false;
}


function getChannelCaches(guildId) {
  if (!db.channel_cache[guildId]) {
    db.channel_cache[guildId] = {};
  }
  return db.channel_cache[guildId];
}

function getChannelCache(guildId, channelId) {
  const caches = getChannelCaches(guildId);
  return caches[channelId] || null;
}

function saveChannelCache(guildId, channelId, data) {
  const caches = getChannelCaches(guildId);
  caches[channelId] = data;
  saveData();
}

function deleteChannelCache(guildId, channelId) {
  const caches = getChannelCaches(guildId);
  if (caches[channelId]) {
    delete caches[channelId];
    saveData();
  }
}

function getRoleCaches(guildId) {
  if (!db.role_cache[guildId]) {
    db.role_cache[guildId] = {};
  }
  return db.role_cache[guildId];
}

function getRoleCache(guildId, roleId) {
  const caches = getRoleCaches(guildId);
  return caches[roleId] || null;
}

function saveRoleCache(guildId, roleId, data) {
  const caches = getRoleCaches(guildId);
  caches[roleId] = data;
  saveData();
}

function deleteRoleCache(guildId, roleId) {
  const caches = getRoleCaches(guildId);
  if (caches[roleId]) {
    delete caches[roleId];
    saveData();
  }
}


function logIncident(guildId, executorId, action, targetId, punishmentApplied, details) {
  const incident = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    guild_id: guildId,
    executor_id: executorId,
    action: action,
    target_id: targetId,
    timestamp: Date.now(),
    punishment_applied: punishmentApplied,
    details: details
  };
  
  db.incidents.push(incident);
  
  
  if (db.incidents.length > 100) {
    db.incidents.shift();
  }
  
  saveData();
  return incident;
}

function getIncidents(guildId) {
  return db.incidents
    .filter(inc => inc.guild_id === guildId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
}


init();

module.exports = {
  getGuildConfig,
  updateGuildConfig,
  getWhitelist,
  addWhitelist,
  removeWhitelist,
  isWhitelisted,
  getFilterWords,
  addFilterWord,
  removeFilterWord,
  getFilterLinks,
  addFilterLink,
  removeFilterLink,
  getChannelCache,
  saveChannelCache,
  deleteChannelCache,
  getRoleCache,
  saveRoleCache,
  deleteRoleCache,
  getChannelCaches,
  getRoleCaches,
  logIncident,
  getIncidents
};
