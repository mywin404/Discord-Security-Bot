const db = require('../database/db');

const EVENT_TO_ACTION_TYPE = {
  channelCreate: 'channel',
  channelDelete: 'channel',
  channelUpdate: 'channel',
  roleCreate: 'role',
  roleDelete: 'role',
  roleUpdate: 'role',
  guildBanAdd: 'ban',
  guildMemberRemove: 'kick',
  webhooksUpdate: 'webhook',
  guildUpdate: 'server',
  guildIntegrationsUpdate: 'server',
  everyoneMention: 'mention',
  messageDeleteBulk: 'mass_delete'
};

const ACTION_LABELS = {
  channel: 'Channel Management',
  role: 'Role Management',
  ban: 'Ban Members',
  kick: 'Kick Members',
  webhook: 'Webhook Management',
  server: 'Server Settings',
  mention: 'Mention Everyone/Here',
  mass_delete: 'Bulk Delete Messages'
};


function getActionType(event) {
  return EVENT_TO_ACTION_TYPE[event] || null;
}

function isUserWhitelisted(guild, userId, eventOrAction) {
  const actionType = EVENT_TO_ACTION_TYPE[eventOrAction] || eventOrAction;
  return db.isWhitelisted(guild, userId, actionType);
}

module.exports = {
  EVENT_TO_ACTION_TYPE,
  ACTION_LABELS,
  getActionType,
  isWhitelisted: isUserWhitelisted
};
