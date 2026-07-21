
CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    log_channel_id TEXT DEFAULT NULL,
    override_role_id TEXT DEFAULT NULL,
    punishment_settings TEXT NOT NULL, 
    automod_settings TEXT NOT NULL      
);


CREATE TABLE IF NOT EXISTS whitelist (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL, 
    PRIMARY KEY (guild_id, user_id, action_type)
);


CREATE TABLE IF NOT EXISTS filter_words (
    guild_id TEXT NOT NULL,
    word TEXT NOT NULL,
    PRIMARY KEY (guild_id, word)
);


CREATE TABLE IF NOT EXISTS filter_links (
    guild_id TEXT NOT NULL,
    link TEXT NOT NULL,
    PRIMARY KEY (guild_id, link)
);


CREATE TABLE IF NOT EXISTS channel_cache (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    data TEXT NOT NULL, 
    PRIMARY KEY (guild_id, channel_id)
);


CREATE TABLE IF NOT EXISTS role_cache (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    data TEXT NOT NULL, 
    PRIMARY KEY (guild_id, role_id)
);


CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    executor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    punishment_applied TEXT NOT NULL,
    details TEXT DEFAULT NULL
);
