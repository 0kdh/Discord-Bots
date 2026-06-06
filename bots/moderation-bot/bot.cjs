'use strict';

const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config({
  path: path.join(__dirname, ".env")
});

// ============================================================
// DÉPENDANCES
// ============================================================
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  Collection,
  ChannelType,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AuditLogEvent,
} = require('discord.js');

// ============================================================
// SECTION 1 — CONFIG PAR DÉFAUT
// ============================================================
const DEFAULT_CONFIG = {
  TOKEN: process.env.BOT_TOKEN,
  PREFIX   : '-',
  OWNER_IDS: ['1495764894530666567'],

  COLORS: {
    PRIMARY : 0x5865F2,
    SUCCESS : 0x57F287,
    WARNING : 0xFEE75C,
    DANGER  : 0xED4245,
    NEUTRAL : 0x2B2D31,
    INFO    : 0xEB459E,
  },

  ROLES: [
    { name: 'Fondateur',    color: '#E74C3C', hoist: true,  position: 10, permissions: ['Administrator'] },
    { name: 'BOT=BOT',      color: '#7F8C8D', hoist: true,  position: 10, permissions: ['Administrator'] },
    { name: 'Admin',        color: '#E67E22', hoist: true,  position: 9,  permissions: ['Administrator'] },
    { name: 'Modérateur',   color: '#3498DB', hoist: true,  position: 8,  permissions: ['KickMembers','BanMembers','ManageMessages','MuteMembers','DeafenMembers','ManageNicknames'] },
    { name: 'Ami',          color: '#9B59B6', hoist: true,  position: 6,  permissions: [] },
    { name: 'Bot',          color: '#95A5A6', hoist: false, position: 5,  permissions: [] },
    { name: 'Membre',       color: '#2ECC71', hoist: false, position: 3,  permissions: [] },
    { name: 'Muted',        color: '#7F8C8D', hoist: false, position: 2,  permissions: [] },
  ],

  STAFF_ROLES : ['Fondateur', 'Admin', 'Modérateur'],
  MUTED_ROLE  : 'Muted',

  LOG_CHANNEL_NAME: '📁・logs-modération',

  ANTI: {
    LINK   : true,
    SPAM   : true,
    INVITE : true,
    BOT    : true,
    RAID   : true,
    CAPS   : false,
    MENTION: false,
    ZALGO  : false,
    FLOOD  : false,
  },

  SPAM: {
    MAX_MESSAGES  : 5,
    TIME_WINDOW   : 5000,
    MUTE_DURATION : 5,
  },

  RAID: {
    JOIN_THRESHOLD : 10,
    TIME_WINDOW    : 10000,
    ACTION         : 'kick',
  },

  CAPS: {
    MIN_LENGTH : 10,
    PERCENT    : 70,
  },

  MENTION: {
    MAX_MENTIONS : 5,
  },

  FLOOD: {
    MAX_CHARS   : 500,
    TIME_WINDOW : 3000,
  },

  COOLDOWN: {
    DEFAULT : 2000,
    CLEAR   : 5000,
    SETUP   : 10000,
  },

  // Comportement des messages du bot et des commandes
  BOT_MSG_DELETE   : false, // supprimer les réponses du bot
  BOT_MSG_DELAY    : 5000,  // délai avant suppression (ms)
  CMD_MSG_DELETE   : true,  // supprimer les messages de commande
  CMD_MSG_DELAY    : 0,     // délai avant suppression (ms), 0 = immédiat

  AUTOMOD_ACTIONS: {
    WARN_THRESHOLD : 3,
    MUTE_THRESHOLD : 5,
    KICK_THRESHOLD : 7,
    BAN_THRESHOLD  : 10,
  },
};

// ============================================================
// SECTION 2 — UTILS
// ============================================================

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;
  const val  = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return val * mult[unit];
}

function makeEmbed(options = {}) {
  const embed = new EmbedBuilder();
  if (options.color !== undefined) embed.setColor(options.color);
  if (options.title)  embed.setTitle(String(options.title));
  if (options.desc)   embed.setDescription(String(options.desc));
  if (options.footer) embed.setFooter({ text: String(options.footer) });
  if (options.fields && options.fields.length > 0) {
    const safeFields = options.fields.map(f => ({
      name  : String(f.name  || '\u200b'),
      value : String(f.value || '\u200b'),
      inline: !!f.inline,
    }));
    embed.addFields(safeFields);
  }
  if (options.image) embed.setImage(options.image);
  if (options.thumb) embed.setThumbnail(options.thumb);
  embed.setTimestamp();
  return embed;
}

function isStaff(member) {
  if (!member) return false;
  const cfg = getGuildConfig(member.guild.id);
  return cfg.STAFF_ROLES.some(r => member.roles.cache.find(role => role.name === r))
    || cfg.OWNER_IDS.includes(member.id);
}

function canActOn(executor, target, guild) {
  if (!target) return false;
  if (target.id === guild.ownerId) return false;
  if (executor.id === guild.ownerId) return true;
  return executor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

// ── Helpers config logs ───────────────────────────────────────────────────────

function getLogsConfig(guildId) {
  if (!DATA.logsConfig) DATA.logsConfig = {};
  if (!DATA.logsConfig[guildId]) {
    DATA.logsConfig[guildId] = { channels: {}, enabled: {} };
  }
  return DATA.logsConfig[guildId];
}

async function getLogChannelFor(guild, logType) {
  const cfg = getLogsConfig(guild.id);

  if (cfg.enabled[logType] === false) return null;

  const specificId = cfg.channels[logType];
  if (specificId) {
    const ch = guild.channels.cache.get(specificId);
    if (ch) return ch;
  }

  const defaultId = cfg.channels['default'];
  if (defaultId) {
    const ch = guild.channels.cache.get(defaultId);
    if (ch) return ch;
  }

  // Fallback ancien système
  const gCfg = getGuildConfig(guild.id);
  let ch = guild.channels.cache.find(
    c => c.name === gCfg.LOG_CHANNEL_NAME && c.type === ChannelType.GuildText
  );
  if (!ch) {
    try {
      ch = await guild.channels.create({
        name: gCfg.LOG_CHANNEL_NAME,
        type: ChannelType.GuildText,
      });
    } catch { return null; }
  }
  return ch;
}

// Garde getLogChannel pour compatibilité
async function getLogChannel(guild) {
  return await getLogChannelFor(guild, null);
}

// Nouvelle sendLog avec type
async function sendLog(guild, embed, logType = null) {
  try {
    const ch = await getLogChannelFor(guild, logType);
    if (ch) ch.send({ embeds: [embed] }).catch(() => {});
  } catch {}
}

async function deleteMsg(msg, delay = 0) {
  if (!msg || !msg.deletable) return;
  if (delay > 0) {
    setTimeout(() => { try { msg.delete().catch(() => {}); } catch {} }, delay);
  } else {
    try { await msg.delete(); } catch {}
  }
}

async function reply(msg, options, guildId) {
  try {
    const cfg = guildId ? getGuildConfig(guildId) : DEFAULT_CONFIG;
    const sent = await msg.channel.send(options);
    if (cfg.BOT_MSG_DELETE) {
      deleteMsg(sent, cfg.BOT_MSG_DELAY);
    }
    return sent;
  } catch { return null; }
}

function parseChannels(message, args) {
  // Extrait tous les salons mentionnés ou trouvés dans les args
  const channels = [];
  const mentioned = message.mentions.channels;
  if (mentioned && mentioned.size > 0) {
    mentioned.forEach(ch => channels.push(ch));
  }
  // Recherche aussi par nom ou ID dans les args
  for (const arg of args) {
    if (/^\d{17,20}$/.test(arg)) {
      const ch = message.guild.channels.cache.get(arg);
      if (ch && !channels.find(c => c.id === ch.id)) channels.push(ch);
    }
  }
  return channels;
}

function containsZalgo(str) {
  return /[\u0300-\u036f\u0489\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]{3,}/u.test(str);
}

function capsPercent(str) {
  const letters = str.replace(/[^a-zA-Z]/g, '');
  if (!letters.length) return 0;
  const caps = letters.replace(/[^A-Z]/g, '').length;
  return Math.round((caps / letters.length) * 100);
}

// Génère un ID unique court
function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Formate une liste en pages
function paginate(items, page = 0, perPage = 10) {
  const start = page * perPage;
  return {
    items   : items.slice(start, start + perPage),
    page,
    totalPages: Math.ceil(items.length / perPage),
    total  : items.length,
  };
}

// Parse une mention ou un ID utilisateur
async function resolveUser(guild, str) {
  if (!str) return null;
  const id = str.replace(/[<@!>]/g, '');
  try {
    const member = await guild.members.fetch(id);
    return member;
  } catch {
    try {
      const user = await guild.client.users.fetch(id);
      return { user, id: user.id, roles: { cache: new Map(), highest: { comparePositionTo: () => -1 } }, displayName: user.username };
    } catch { return null; }
  }
}

// ============================================================
// SECTION 3 — STORAGE
// ============================================================

const DATA_FILE = path.join(__dirname, 'data.json');

let DATA = {
  warns            : {},
  bans             : {},
  mutes            : {},
  notes            : {},
  cases            : {},
  anti             : {},
  blacklistWords   : {},
  whitelistRoles   : {},
  whitelistChannels: {},
  guildConfig      : {},
  slowmodeLog      : {},
  lockLog          : {},
  muteRoles        : {},
  modRoles         : {},
  autoroles        : {},
  sanctions        : {},
  floodTracker     : {},
  logsConfig       : {}, // ← AJOUTER CETTE LIGNE
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      DATA = { ...DATA, ...raw };
    }
  } catch { console.error('[DATA] Erreur chargement data.json'); }
}

function saveData() {
  try {
    const toSave = { ...DATA };
    delete toSave.floodTracker;
    fs.writeFileSync(DATA_FILE, JSON.stringify(toSave, null, 2));
  } catch { console.error('[DATA] Erreur sauvegarde data.json'); }
}

// ---- Warns ----
function getWarns(guildId, userId) { return DATA.warns?.[guildId]?.[userId] || []; }
function addWarn(guildId, userId, reason, modTag, modId) {
  if (!DATA.warns[guildId])         DATA.warns[guildId] = {};
  if (!DATA.warns[guildId][userId]) DATA.warns[guildId][userId] = [];
  const id = uid();
  DATA.warns[guildId][userId].push({ id, reason, date: new Date().toISOString(), mod: modTag, modId });
  saveData();
  return id;
}
function removeWarn(guildId, userId, warnId) {
  if (!DATA.warns[guildId]?.[userId]) return false;
  const before = DATA.warns[guildId][userId].length;
  DATA.warns[guildId][userId] = DATA.warns[guildId][userId].filter(w => w.id !== warnId);
  saveData();
  return DATA.warns[guildId][userId].length < before;
}
function clearWarns(guildId, userId) {
  if (DATA.warns[guildId]) delete DATA.warns[guildId][userId];
  saveData();
}

// ---- Cases ----
function addCase(guildId, type, userId, userTag, modId, modTag, reason) {
  if (!DATA.cases[guildId]) DATA.cases[guildId] = [];
  const id = DATA.cases[guildId].length + 1;
  DATA.cases[guildId].push({ id, type, userId, userTag, modId, modTag, reason, date: new Date().toISOString() });
  saveData();
  return id;
}
function getCases(guildId, userId) {
  return (DATA.cases[guildId] || []).filter(c => c.userId === userId);
}
function getCase(guildId, caseId) {
  return (DATA.cases[guildId] || []).find(c => c.id === parseInt(caseId));
}

// ---- Notes ----
function getNotes(guildId, userId) { return DATA.notes?.[guildId]?.[userId] || []; }
function addNote(guildId, userId, note, modTag) {
  if (!DATA.notes[guildId])         DATA.notes[guildId] = {};
  if (!DATA.notes[guildId][userId]) DATA.notes[guildId][userId] = [];
  DATA.notes[guildId][userId].push({ note, date: new Date().toISOString(), mod: modTag, id: uid() });
  saveData();
}
function clearNotes(guildId, userId) {
  if (DATA.notes[guildId]) delete DATA.notes[guildId][userId];
  saveData();
}

// ---- Anti ----
function getAnti(guildId) {
  const cfg = getGuildConfig(guildId);
  if (!DATA.anti[guildId]) DATA.anti[guildId] = { ...(cfg.ANTI || DEFAULT_CONFIG.ANTI) };
  return DATA.anti[guildId];
}
function setAnti(guildId, key, value) {
  if (!DATA.anti[guildId]) DATA.anti[guildId] = { ...DEFAULT_CONFIG.ANTI };
  DATA.anti[guildId][key] = value;
  saveData();
}

// ---- Blacklist mots ----
function getBlacklistWords(guildId) { return DATA.blacklistWords[guildId] || []; }
function addBlacklistWord(guildId, word) {
  if (!DATA.blacklistWords[guildId]) DATA.blacklistWords[guildId] = [];
  if (!DATA.blacklistWords[guildId].includes(word.toLowerCase())) {
    DATA.blacklistWords[guildId].push(word.toLowerCase());
    saveData();
    return true;
  }
  return false;
}
function removeBlacklistWord(guildId, word) {
  if (!DATA.blacklistWords[guildId]) return false;
  const before = DATA.blacklistWords[guildId].length;
  DATA.blacklistWords[guildId] = DATA.blacklistWords[guildId].filter(w => w !== word.toLowerCase());
  saveData();
  return DATA.blacklistWords[guildId].length < before;
}

// ---- Whitelist rôles (anti-systèmes) ----
function getWhitelistRoles(guildId) { return DATA.whitelistRoles[guildId] || []; }
function addWhitelistRole(guildId, roleId) {
  if (!DATA.whitelistRoles[guildId]) DATA.whitelistRoles[guildId] = [];
  if (!DATA.whitelistRoles[guildId].includes(roleId)) {
    DATA.whitelistRoles[guildId].push(roleId);
    saveData();
    return true;
  }
  return false;
}
function removeWhitelistRole(guildId, roleId) {
  if (!DATA.whitelistRoles[guildId]) return false;
  const before = DATA.whitelistRoles[guildId].length;
  DATA.whitelistRoles[guildId] = DATA.whitelistRoles[guildId].filter(r => r !== roleId);
  saveData();
  return DATA.whitelistRoles[guildId].length < before;
}

// ---- Whitelist channels (anti-systèmes) ----
function getWhitelistChannels(guildId) { return DATA.whitelistChannels[guildId] || []; }
function addWhitelistChannel(guildId, chId) {
  if (!DATA.whitelistChannels[guildId]) DATA.whitelistChannels[guildId] = [];
  if (!DATA.whitelistChannels[guildId].includes(chId)) {
    DATA.whitelistChannels[guildId].push(chId);
    saveData();
    return true;
  }
  return false;
}
function removeWhitelistChannel(guildId, chId) {
  if (!DATA.whitelistChannels[guildId]) return false;
  const before = DATA.whitelistChannels[guildId].length;
  DATA.whitelistChannels[guildId] = DATA.whitelistChannels[guildId].filter(c => c !== chId);
  saveData();
  return DATA.whitelistChannels[guildId].length < before;
}

// ---- Guild Config ----
function getGuildConfig(guildId) {
  if (!DATA.guildConfig[guildId]) DATA.guildConfig[guildId] = {};
  return { ...DEFAULT_CONFIG, ...DATA.guildConfig[guildId] };
}
function setGuildConfig(guildId, key, value) {
  if (!DATA.guildConfig[guildId]) DATA.guildConfig[guildId] = {};
  DATA.guildConfig[guildId][key] = value;
  saveData();
}
function setGuildConfigMulti(guildId, obj) {
  if (!DATA.guildConfig[guildId]) DATA.guildConfig[guildId] = {};
  Object.assign(DATA.guildConfig[guildId], obj);
  saveData();
}

// ---- Mute Role ----
function getMuteRole(guildId) { return DATA.muteRoles[guildId] || null; }
function setMuteRole(guildId, roleId) { DATA.muteRoles[guildId] = roleId; saveData(); }

// ---- Mod Roles ----
function getModRoles(guildId) { return DATA.modRoles[guildId] || []; }
function addModRole(guildId, roleId) {
  if (!DATA.modRoles[guildId]) DATA.modRoles[guildId] = [];
  if (!DATA.modRoles[guildId].includes(roleId)) { DATA.modRoles[guildId].push(roleId); saveData(); return true; }
  return false;
}
function removeModRole(guildId, roleId) {
  if (!DATA.modRoles[guildId]) return false;
  DATA.modRoles[guildId] = DATA.modRoles[guildId].filter(r => r !== roleId);
  saveData();
}

// ---- Autoroles ----
function getAutoroles(guildId) { return DATA.autoroles[guildId] || []; }
function addAutorole(guildId, roleId) {
  if (!DATA.autoroles[guildId]) DATA.autoroles[guildId] = [];
  if (!DATA.autoroles[guildId].includes(roleId)) { DATA.autoroles[guildId].push(roleId); saveData(); return true; }
  return false;
}
function removeAutorole(guildId, roleId) {
  if (!DATA.autoroles[guildId]) return false;
  DATA.autoroles[guildId] = DATA.autoroles[guildId].filter(r => r !== roleId);
  saveData();
}

// ---- Temp mutes (persistance) ----
function getTempMutes(guildId) { return DATA.mutes[guildId] || {}; }
function addTempMute(guildId, userId, reason, modTag, until) {
  if (!DATA.mutes[guildId]) DATA.mutes[guildId] = {};
  DATA.mutes[guildId][userId] = { reason, date: new Date().toISOString(), mod: modTag, until };
  saveData();
}
function removeTempMute(guildId, userId) {
  if (DATA.mutes[guildId]) delete DATA.mutes[guildId][userId];
  saveData();
}

// ---- Temp bans (persistance) ----
function getTempBans(guildId) { return DATA.bans[guildId] || {}; }
function addTempBan(guildId, userId, reason, modTag, until) {
  if (!DATA.bans[guildId]) DATA.bans[guildId] = {};
  DATA.bans[guildId][userId] = { reason, date: new Date().toISOString(), mod: modTag, until };
  saveData();
}
function removeTempBan(guildId, userId) {
  if (DATA.bans[guildId]) delete DATA.bans[guildId][userId];
  saveData();
}

// ============================================================
// SECTION 4 — CLIENT & COLLECTIONS
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

const cooldowns    = new Collection();
const spamTracker  = new Map();
const raidTracker  = { count: 0, timer: null };
const floodTracker = new Map();

// ============================================================
// SECTION 4b — TYPES DE LOGS
// ============================================================

const LOG_TYPES = {
  // 🔨 Modération
  BAN         : { key: 'ban',          emoji: '🔨', label: 'Bans',                category: '🔨 Modération' },
  TEMPBAN     : { key: 'tempban',      emoji: '⏳', label: 'Bans temporaires',    category: '🔨 Modération' },
  UNBAN       : { key: 'unban',        emoji: '✅', label: 'Unbans',              category: '🔨 Modération' },
  SOFTBAN     : { key: 'softban',      emoji: '🪃', label: 'Softbans',            category: '🔨 Modération' },
  MASSBAN     : { key: 'massban',      emoji: '🔨', label: 'Massbans',            category: '🔨 Modération' },
  KICK        : { key: 'kick',         emoji: '👢', label: 'Kicks',               category: '🔨 Modération' },
  MASSKICK    : { key: 'masskick',     emoji: '👢', label: 'Masskicks',           category: '🔨 Modération' },
  WARN        : { key: 'warn',         emoji: '⚠️',  label: 'Avertissements',     category: '🔨 Modération' },
  DELWARN     : { key: 'delwarn',      emoji: '🗑️', label: 'Warns supprimés',    category: '🔨 Modération' },
  CLEARWARNS  : { key: 'clearwarns',   emoji: '🧹', label: 'Warns effacés',       category: '🔨 Modération' },
  // 🔇 Mute
  MUTE        : { key: 'mute',         emoji: '🔇', label: 'Mutes',               category: '🔇 Mute' },
  TEMPMUTE    : { key: 'tempmute',     emoji: '⏳', label: 'Mutes temporaires',   category: '🔇 Mute' },
  UNMUTE      : { key: 'unmute',       emoji: '🔊', label: 'Unmutes',             category: '🔇 Mute' },
  TIMEOUT     : { key: 'timeout',      emoji: '⏱️', label: 'Timeouts',            category: '🔇 Mute' },
  UNTIMEOUT   : { key: 'untimeout',    emoji: '⏱️', label: 'Timeouts levés',      category: '🔇 Mute' },
  MASSMUTE    : { key: 'massmute',     emoji: '🔇', label: 'Massmutes',           category: '🔇 Mute' },
  MASSUNMUTE  : { key: 'massunmute',   emoji: '🔊', label: 'Massunmutes',         category: '🔇 Mute' },
  MASSTIMEOUT : { key: 'masstimeout',  emoji: '⏱️', label: 'Masstimeouts',        category: '🔇 Mute' },
  // 👥 Membres
  JOIN        : { key: 'join',         emoji: '📥', label: 'Arrivées',            category: '👥 Membres' },
  LEAVE       : { key: 'leave',        emoji: '📤', label: 'Départs',             category: '👥 Membres' },
  NICK        : { key: 'nick',         emoji: '📝', label: 'Pseudos modifiés',    category: '👥 Membres' },
  VERIFY      : { key: 'verify',       emoji: '✅', label: 'Vérifications',       category: '👥 Membres' },
  NOTE        : { key: 'note',         emoji: '📌', label: 'Notes',               category: '👥 Membres' },
  // 🎭 Rôles
  ROLE_ADD    : { key: 'role_add',     emoji: '🎭', label: 'Rôles ajoutés',       category: '🎭 Rôles' },
  ROLE_REMOVE : { key: 'role_remove',  emoji: '🎭', label: 'Rôles retirés',       category: '🎭 Rôles' },
  ROLEALL     : { key: 'roleall',      emoji: '🎭', label: 'Rôle massif',         category: '🎭 Rôles' },
  ROLE_CREATE : { key: 'role_create',  emoji: '🎨', label: 'Rôles créés',         category: '🎭 Rôles' },
  ROLE_DELETE : { key: 'role_delete',  emoji: '🗑️', label: 'Rôles supprimés',    category: '🎭 Rôles' },
  ROLE_EDIT   : { key: 'role_edit',    emoji: '🔧', label: 'Rôles modifiés',      category: '🎭 Rôles' },
  // 💬 Messages
  MSG_DELETE  : { key: 'msg_delete',   emoji: '🗑️', label: 'Messages supprimés', category: '💬 Messages' },
  MSG_EDIT    : { key: 'msg_edit',     emoji: '✏️',  label: 'Messages modifiés',  category: '💬 Messages' },
  MSG_CLEAR   : { key: 'msg_clear',    emoji: '🧹', label: 'Clear de messages',   category: '💬 Messages' },
  SAY         : { key: 'say',          emoji: '📢', label: 'Say',                 category: '💬 Messages' },
  // 🔒 Salons
  CH_CREATE   : { key: 'ch_create',    emoji: '➕', label: 'Salons créés',        category: '🔒 Salons' },
  CH_DELETE   : { key: 'ch_delete',    emoji: '➖', label: 'Salons supprimés',    category: '🔒 Salons' },
  CH_EDIT     : { key: 'ch_edit',      emoji: '🔧', label: 'Salons modifiés',     category: '🔒 Salons' },
  LOCK        : { key: 'lock',         emoji: '🔒', label: 'Locks',               category: '🔒 Salons' },
  UNLOCK      : { key: 'unlock',       emoji: '🔓', label: 'Unlocks',             category: '🔒 Salons' },
  SLOWMODE    : { key: 'slowmode',     emoji: '🐌', label: 'Slowmodes',           category: '🔒 Salons' },
  // 🎙️ Vocal
  VOICE_JOIN  : { key: 'voice_join',   emoji: '🎙️', label: 'Vocal — Arrivées',   category: '🎙️ Vocal' },
  VOICE_LEAVE : { key: 'voice_leave',  emoji: '🎙️', label: 'Vocal — Départs',    category: '🎙️ Vocal' },
  VOICE_MOVE  : { key: 'voice_move',   emoji: '🎙️', label: 'Vocal — Mouvements', category: '🎙️ Vocal' },
  // 🤖 Automod
  AUTOMOD     : { key: 'automod',      emoji: '🤖', label: 'Automod',             category: '🤖 Automod' },
  ANTILINK    : { key: 'antilink',     emoji: '🔗', label: 'Anti-Liens',          category: '🤖 Automod' },
  ANTISPAM    : { key: 'antispam',     emoji: '🚫', label: 'Anti-Spam',           category: '🤖 Automod' },
  ANTIRAID    : { key: 'antiraid',     emoji: '🛡️', label: 'Anti-Raid',           category: '🤖 Automod' },
  ANTIINVITE  : { key: 'antiinvite',   emoji: '🔗', label: 'Anti-Invite',         category: '🤖 Automod' },
  // ⚙️ Serveur
  CONFIG      : { key: 'config',       emoji: '⚙️', label: 'Configuration',       category: '⚙️ Serveur' },
  INVITE      : { key: 'invite',       emoji: '🔗', label: 'Invitations',         category: '⚙️ Serveur' },
};

// ============================================================
// SECTION 5 — EVENTS
// ============================================================

client.on('ready', async () => {
  console.log(`[BOT] Connecté en tant que ${client.user.tag}`);
  loadData();
  const cfg = DEFAULT_CONFIG;
  //client.user.setActivity(`VIP A 1 EURO !`, { type: 2 });
  resumeTempMutes();
  resumeTempBans();
  console.log(`[BOT] ${Object.keys(COMMANDS).length} commandes chargées.`);

  await initAllStatsAutoRefresh();
});

client.on('error', err => console.error('[CLIENT ERROR]', err));
process.on('unhandledRejection', err => console.error('[UNHANDLED REJECTION]', err));
process.on('uncaughtException',  err => console.error('[UNCAUGHT EXCEPTION]',  err));

// ── Refresh quand quelqu'un rejoint/quitte un vocal ──────────────────────
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Seulement si le salon vocal a changé
  if (oldState.channelId !== newState.channelId) {
    const guildId = (oldState.guild || newState.guild)?.id;
    if (guildId) {
      await triggerStatsRefresh(guildId).catch(() => {});
    }
  }
});

// ---- Autorole ----
client.on('guildMemberAdd', async member => {
  const roles = getAutoroles(member.guild.id);
  for (const roleId of roles) {
    const role = member.guild.roles.cache.get(roleId);
    if (role) member.roles.add(role).catch(() => {});
  }
});

// ---- Anti-raid ----
client.on('guildMemberAdd', async member => {
  const anti = getAnti(member.guild.id);
  if (!anti.RAID) return;
  raidTracker.count++;
  if (raidTracker.timer) clearTimeout(raidTracker.timer);
  const cfg = getGuildConfig(member.guild.id);
  raidTracker.timer = setTimeout(() => { raidTracker.count = 0; }, cfg.RAID?.TIME_WINDOW || DEFAULT_CONFIG.RAID.TIME_WINDOW);
  const threshold = cfg.RAID?.JOIN_THRESHOLD || DEFAULT_CONFIG.RAID.JOIN_THRESHOLD;
  if (raidTracker.count >= threshold) {
    try {
      const action = cfg.RAID?.ACTION || DEFAULT_CONFIG.RAID.ACTION;
      if (action === 'ban') await member.ban({ reason: 'Anti-raid automatique' });
      else await member.kick('Anti-raid automatique');
      const log = await getLogChannel(member.guild);
      if (log) log.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `🚨 Anti-raid : **${member.user.tag}** a été **${action === 'ban' ? 'banni' : 'kické'}** automatiquement.` })] }).catch(() => {});
      addCase(member.guild.id, `RAID_${action.toUpperCase()}`, member.id, member.user.tag, client.user.id, client.user.tag, 'Anti-raid automatique');
    } catch { /* ignoré */ }
  }
});

// ---- Anti-bot ----
client.on('guildMemberAdd', async member => {
  if (!member.user.bot) return;
  const anti = getAnti(member.guild.id);
  if (!anti.BOT) return;
  try {
    await member.kick('Anti-bot activé');
    const log = await getLogChannel(member.guild);
    if (log) log.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `🤖 Anti-bot : **${member.user.tag}** a été kické automatiquement.` })] }).catch(() => {});
  } catch { /* ignoré */ }
});

// ---- Message event ----
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  // Check whitelist channel
  const wlChannels = getWhitelistChannels(message.guild.id);
  const isWhitelistChannel = wlChannels.includes(message.channel.id);

  // Check whitelist role
  const wlRoles = getWhitelistRoles(message.guild.id);
  const hasWhitelistRole = wlRoles.some(rId => message.member.roles.cache.has(rId));

  if (!isStaff(message.member) && !isWhitelistChannel && !hasWhitelistRole) {
    await handleAntiSystems(message);
  }

  const cfg = getGuildConfig(message.guild.id);
  const prefix = cfg.PREFIX || DEFAULT_CONFIG.PREFIX;

  if (!message.content.startsWith(prefix)) return;
  await handleCommand(message, prefix, cfg);
});

// ---- Interaction (modals) ----
client.on('interactionCreate', async interaction => {
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'botconfig_modal') { await handleBotConfigModal(interaction); return; }
    if (interaction.customId === 'anticonfig_modal') { await handleAntiConfigModal(interaction); return; }
    if (interaction.customId === 'embed_modal')      { await handleEmbedModal(interaction);      return; }
    if (interaction.customId === 'warn_modal')       { await handleWarnModal(interaction);       return; }
    if (interaction.customId === 'note_modal')       { await handleNoteModal(interaction);       return; }
  }
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('modcase_prev_') || interaction.customId.startsWith('modcase_next_')) {
      await handleCasePagination(interaction);
      return;
    }
    if (interaction.customId.startsWith('warn_remove_')) {
      await handleWarnRemoveButton(interaction);
      return;
    }
  }
});

// ---- Log: messageDelete ----
client.on('messageDelete', async (message) => {
  if (!message.guild) return;
  if (message.author?.bot) return;
  if (!message.content && message.attachments.size === 0) return;
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.DANGER,
    title : '🗑️ Message supprimé',
    fields: [
      { name: '👤 Auteur',  value: `<@${message.author?.id}> \`${message.author?.tag}\``, inline: true },
      { name: '📺 Salon',   value: `<#${message.channel.id}>`, inline: true },
      { name: '💬 Contenu', value: message.content?.slice(0, 1020) || '*(vide)*', inline: false },
    ],
  });
  await sendLog(message.guild, embed, 'msg_delete');
});

// ---- Log: messageUpdate ----
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (oldMsg.partial || newMsg.partial || oldMsg.author?.bot || !oldMsg.guild) return;
  if (oldMsg.content === newMsg.content) return;
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.INFO,
    title : '✏️ Message modifié',
    fields: [
      { name: '👤 Auteur', value: `<@${oldMsg.author?.id}> \`${oldMsg.author?.tag}\``, inline: true },
      { name: '📺 Salon',  value: `<#${oldMsg.channel.id}>`, inline: true },
      { name: '📝 Avant',  value: oldMsg.content?.slice(0, 500) || '*(vide)*', inline: false },
      { name: '✅ Après',  value: newMsg.content?.slice(0, 500) || '*(vide)*', inline: false },
    ],
  });
  await sendLog(oldMsg.guild, embed, 'msg_edit');
});

// ---- Log: guildMemberUpdate (rôles + pseudo) ----
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (!oldMember.guild) return;

  // Pseudo
  if (oldMember.nickname !== newMember.nickname) {
    const embed = makeEmbed({
      color : DEFAULT_CONFIG.COLORS.INFO,
      title : '📝 Pseudo modifié',
      fields: [
        { name: '👤 Membre', value: `<@${newMember.id}> \`${newMember.user.tag}\``, inline: true },
        { name: '📝 Avant',  value: oldMember.nickname || '*(aucun)*', inline: true },
        { name: '✅ Après',  value: newMember.nickname || '*(aucun)*', inline: true },
      ],
    });
    await sendLog(newMember.guild, embed, 'nick');
  }

  // Rôles ajoutés
  const addedRoles   = [...newMember.roles.cache.values()].filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = [...oldMember.roles.cache.values()].filter(r => !newMember.roles.cache.has(r.id));

  if (addedRoles.length > 0) {
    const embed = makeEmbed({
      color : DEFAULT_CONFIG.COLORS.SUCCESS,
      title : '🎭 Rôle(s) ajouté(s)',
      fields: [
        { name: '👤 Membre', value: `<@${newMember.id}> \`${newMember.user.tag}\``, inline: true },
        { name: '✅ Rôles',  value: addedRoles.map(r => r.toString()).join(', '), inline: false },
      ],
    });
    await sendLog(newMember.guild, embed, 'role_add');
  }

  if (removedRoles.length > 0) {
    const embed = makeEmbed({
      color : DEFAULT_CONFIG.COLORS.DANGER,
      title : '🎭 Rôle(s) retiré(s)',
      fields: [
        { name: '👤 Membre', value: `<@${newMember.id}> \`${newMember.user.tag}\``, inline: true },
        { name: '❌ Rôles',  value: removedRoles.map(r => r.toString()).join(', '), inline: false },
      ],
    });
    await sendLog(newMember.guild, embed, 'role_remove');
  }
});

// ---- Log: guildBanAdd ----
client.on('guildBanAdd', async ban => {
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.DANGER,
    title : '🔨 Membre banni',
    fields: [
      { name: '👤 Utilisateur', value: `<@${ban.user.id}> \`${ban.user.tag}\``, inline: true },
      { name: '🆔 ID',          value: `\`${ban.user.id}\``, inline: true },
      { name: '📝 Raison',      value: ban.reason || 'Non spécifiée', inline: false },
    ],
  });
  await sendLog(ban.guild, embed, 'ban');
});

// ---- Log: guildBanRemove ----
client.on('guildBanRemove', async ban => {
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.SUCCESS,
    title : '✅ Membre débanni',
    fields: [
      { name: '👤 Utilisateur', value: `<@${ban.user.id}> \`${ban.user.tag}\``, inline: true },
      { name: '🆔 ID',          value: `\`${ban.user.id}\``, inline: true },
    ],
  });
  await sendLog(ban.guild, embed, 'unban');
});

// ---- Log: guildMemberAdd ----
client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.SUCCESS,
    title : '📥 Nouveau membre',
    thumb : member.user.displayAvatarURL({ dynamic: true }),
    fields: [
      { name: '👤 Utilisateur',  value: `<@${member.id}> \`${member.user.tag}\``, inline: true },
      { name: '🆔 ID',           value: `\`${member.id}\``, inline: true },
      { name: '📅 Compte créé',  value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '👥 Total membres', value: `\`${member.guild.memberCount}\``, inline: true },
    ],
  });
  await sendLog(member.guild, embed, 'join');
});

// ---- Log: guildMemberRemove ----
client.on('guildMemberRemove', async member => {
  if (member.user.bot) return;
  const roles = member.roles.cache
    .filter(r => r.id !== member.guild.id)
    .map(r => r.toString())
    .join(', ') || 'Aucun';
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.DANGER,
    title : '📤 Membre parti',
    thumb : member.user.displayAvatarURL({ dynamic: true }),
    fields: [
      { name: '👤 Utilisateur',  value: `<@${member.id}> \`${member.user.tag}\``, inline: true },
      { name: '🆔 ID',           value: `\`${member.id}\``, inline: true },
      { name: '👥 Total membres', value: `\`${member.guild.memberCount}\``, inline: true },
      { name: '🎭 Rôles',        value: roles.slice(0, 500), inline: false },
    ],
  });
  await sendLog(member.guild, embed, 'leave');
});

// ---- Log: roleCreate ----
client.on('roleCreate', async (role) => {
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.SUCCESS,
    title : '🎨 Rôle créé',
    fields: [
      { name: '🎭 Rôle',    value: `${role} \`${role.name}\``, inline: true },
      { name: '🎨 Couleur', value: role.hexColor, inline: true },
    ],
  });
  await sendLog(role.guild, embed, 'role_create');
});

// ---- Log: roleDelete ----
client.on('roleDelete', async (role) => {
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.DANGER,
    title : '🗑️ Rôle supprimé',
    fields: [
      { name: '🎭 Rôle', value: `\`${role.name}\``, inline: true },
    ],
  });
  await sendLog(role.guild, embed, 'role_delete');
});

// ---- Log: roleUpdate ----
client.on('roleUpdate', async (oldRole, newRole) => {
  const changes = [];
  if (oldRole.name     !== newRole.name)     changes.push(`**Nom :** \`${oldRole.name}\` → \`${newRole.name}\``);
  if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Couleur :** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
  if (oldRole.hoist    !== newRole.hoist)    changes.push(`**Hoist :** \`${oldRole.hoist}\` → \`${newRole.hoist}\``);
  if (changes.length === 0) return;
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.WARNING,
    title : '🔧 Rôle modifié',
    fields: [
      { name: '🎭 Rôle',          value: `\`${newRole.name}\``, inline: true },
      { name: '🔧 Modifications', value: changes.join('\n'), inline: false },
    ],
  });
  await sendLog(newRole.guild, embed, 'role_edit');
});

// ---- Log: channelCreate ----
client.on('channelCreate', async (channel) => {
  if (!channel.guild) return;
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.SUCCESS,
    title : '➕ Salon créé',
    fields: [
      { name: '📺 Salon', value: `${channel} \`${channel.name}\``, inline: true },
    ],
  });
  await sendLog(channel.guild, embed, 'ch_create');
});

// ---- Log: channelDelete ----
client.on('channelDelete', async (channel) => {
  if (!channel.guild) return;
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.DANGER,
    title : '➖ Salon supprimé',
    fields: [
      { name: '📺 Salon', value: `\`${channel.name}\``, inline: true },
    ],
  });
  await sendLog(channel.guild, embed, 'ch_delete');
});

// ---- Log: channelUpdate ----
client.on('channelUpdate', async (oldCh, newCh) => {
  if (!oldCh.guild) return;
  const changes = [];
  if (oldCh.name  !== newCh.name)  changes.push(`**Nom :** \`${oldCh.name}\` → \`${newCh.name}\``);
  if (oldCh.topic !== newCh.topic) changes.push(`**Topic :** \`${oldCh.topic || 'aucun'}\` → \`${newCh.topic || 'aucun'}\``);
  if (changes.length === 0) return;
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.WARNING,
    title : '🔧 Salon modifié',
    fields: [
      { name: '📺 Salon',          value: `<#${newCh.id}>`, inline: true },
      { name: '🔧 Modifications',  value: changes.join('\n'), inline: false },
    ],
  });
  await sendLog(oldCh.guild, embed, 'ch_edit');
});

// ---- Log: inviteCreate ----
client.on('inviteCreate', async (invite) => {
  const embed = makeEmbed({
    color : DEFAULT_CONFIG.COLORS.INFO,
    title : '🔗 Invitation créée',
    fields: [
      { name: '🔗 Code',     value: `\`${invite.code}\``, inline: true },
      { name: '👤 Créateur', value: `<@${invite.inviter?.id}> \`${invite.inviter?.tag}\``, inline: true },
      { name: '📺 Salon',    value: `<#${invite.channel?.id}>`, inline: true },
      { name: '⏳ Expire',   value: invite.maxAge ? `\`${invite.maxAge / 3600}h\`` : '`Jamais`', inline: true },
    ],
  });
  await sendLog(invite.guild, embed, 'invite');
});

// ---- Log: voiceStateUpdate ----
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guild  = oldState.guild || newState.guild;
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  // Refresh stats
  if (oldState.channelId !== newState.channelId) {
    await triggerStatsRefresh(guild.id).catch(() => {});
  }

  if (!oldState.channelId && newState.channelId) {
    const embed = makeEmbed({
      color : DEFAULT_CONFIG.COLORS.SUCCESS,
      title : '🎙️ Vocal — Arrivée',
      fields: [
        { name: '👤 Membre', value: `<@${member.id}> \`${member.user.tag}\``, inline: true },
        { name: '🎙️ Salon',  value: `<#${newState.channelId}>`, inline: true },
      ],
    });
    await sendLog(guild, embed, 'voice_join');
  } else if (oldState.channelId && !newState.channelId) {
    const embed = makeEmbed({
      color : DEFAULT_CONFIG.COLORS.DANGER,
      title : '🎙️ Vocal — Départ',
      fields: [
        { name: '👤 Membre', value: `<@${member.id}> \`${member.user.tag}\``, inline: true },
        { name: '🎙️ Salon',  value: `<#${oldState.channelId}>`, inline: true },
      ],
    });
    await sendLog(guild, embed, 'voice_leave');
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const embed = makeEmbed({
      color : DEFAULT_CONFIG.COLORS.WARNING,
      title : '🎙️ Vocal — Mouvement',
      fields: [
        { name: '👤 Membre', value: `<@${member.id}> \`${member.user.tag}\``, inline: true },
        { name: '📤 Avant',  value: `<#${oldState.channelId}>`, inline: true },
        { name: '📥 Après',  value: `<#${newState.channelId}>`, inline: true },
      ],
    });
    await sendLog(guild, embed, 'voice_move');
  }
});

// ============================================================
// SECTION 6 — ANTI-SYSTÈMES
// ============================================================

async function handleAntiSystems(message) {
  const anti    = getAnti(message.guild.id);
  const cfg     = getGuildConfig(message.guild.id);
  const content = message.content;

  // ---- Anti-invitation ----
  if (anti.INVITE && /discord\.gg\/\S+/i.test(content)) {
    await deleteMsg(message);
    const m = await message.channel.send(`${message.author}, les invitations Discord sont interdites. ⛔`);
    setTimeout(() => deleteMsg(m), 5000);
    autoModAction(message, 'INVITE', 'Publication d\'invitation Discord');
    return;
  }

  // ---- Anti-lien ----
  if (anti.LINK && /https?:\/\/\S+/i.test(content)) {
    await deleteMsg(message);
    const m = await message.channel.send(`${message.author}, les liens sont interdits. ⛔`);
    setTimeout(() => deleteMsg(m), 5000);
    autoModAction(message, 'LINK', 'Publication de lien non autorisé');
    return;
  }

  // ---- Blacklist mots ----
  const blacklist = getBlacklistWords(message.guild.id);
  if (blacklist.length > 0) {
    const lower = content.toLowerCase();
    const found = blacklist.find(w => lower.includes(w));
    if (found) {
      await deleteMsg(message);
      const m = await message.channel.send(`${message.author}, ce mot est interdit sur ce serveur. ⛔`);
      setTimeout(() => deleteMsg(m), 5000);
      autoModAction(message, 'BLACKWORD', `Mot interdit : "${found}"`);
      return;
    }
  }

  // ---- Anti-zalgo ----
  if (anti.ZALGO && containsZalgo(content)) {
    await deleteMsg(message);
    const m = await message.channel.send(`${message.author}, les caractères zalgo sont interdits. ⛔`);
    setTimeout(() => deleteMsg(m), 5000);
    autoModAction(message, 'ZALGO', 'Utilisation de caractères zalgo');
    return;
  }

  // ---- Anti-caps ----
  if (anti.CAPS) {
    const capsMin = cfg.CAPS?.MIN_LENGTH || DEFAULT_CONFIG.CAPS.MIN_LENGTH;
    const capsPct = cfg.CAPS?.PERCENT    || DEFAULT_CONFIG.CAPS.PERCENT;
    if (content.length >= capsMin && capsPercent(content) >= capsPct) {
      await deleteMsg(message);
      const m = await message.channel.send(`${message.author}, évitez les majuscules excessives. ⛔`);
      setTimeout(() => deleteMsg(m), 5000);
      autoModAction(message, 'CAPS', 'Utilisation excessive de majuscules');
      return;
    }
  }

  // ---- Anti-mention (mass mention) ----
  if (anti.MENTION) {
    const maxMentions = cfg.MENTION?.MAX_MENTIONS || DEFAULT_CONFIG.MENTION.MAX_MENTIONS;
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    if (totalMentions >= maxMentions) {
      await deleteMsg(message);
      const m = await message.channel.send(`${message.author}, vous ne pouvez pas mentionner autant de personnes. ⛔`);
      setTimeout(() => deleteMsg(m), 5000);
      autoModAction(message, 'MENTION', `Mass mention (${totalMentions} mentions)`);
      return;
    }
  }

  // ---- Anti-flood (messages identiques) ----
  if (anti.FLOOD) {
    const now     = Date.now();
    const userId  = message.author.id;
    const maxChars = cfg.FLOOD?.MAX_CHARS   || DEFAULT_CONFIG.FLOOD.MAX_CHARS;
    const window   = cfg.FLOOD?.TIME_WINDOW || DEFAULT_CONFIG.FLOOD.TIME_WINDOW;
    if (!floodTracker.has(userId)) floodTracker.set(userId, { msgs: [], chars: 0 });
    const ft = floodTracker.get(userId);
    ft.msgs = ft.msgs.filter(t => now - t.time < window);
    ft.chars = ft.msgs.reduce((a, m) => a + m.len, 0);
    ft.msgs.push({ time: now, len: content.length });
    if (ft.chars + content.length >= maxChars) {
      await deleteMsg(message);
      const m = await message.channel.send(`${message.author}, vous envoyez trop de texte trop vite. ⛔`);
      setTimeout(() => deleteMsg(m), 5000);
      ft.msgs  = [];
      ft.chars = 0;
      autoModAction(message, 'FLOOD', 'Flood de texte');
      return;
    }
  }

  // ---- Anti-spam ----
  if (anti.SPAM) {
    const now    = Date.now();
    const userId = message.author.id;
    const maxMsg = cfg.SPAM?.MAX_MESSAGES || DEFAULT_CONFIG.SPAM.MAX_MESSAGES;
    const window = cfg.SPAM?.TIME_WINDOW  || DEFAULT_CONFIG.SPAM.TIME_WINDOW;
    if (!spamTracker.has(userId)) spamTracker.set(userId, { count: 0, timestamps: [] });
    const tracker = spamTracker.get(userId);
    tracker.timestamps = tracker.timestamps.filter(t => now - t < window);
    tracker.timestamps.push(now);
    tracker.count = tracker.timestamps.length;
    if (tracker.count >= maxMsg) {
      tracker.timestamps = [];
      try {
        const muteRoleId = getMuteRole(message.guild.id);
        const muteRole   = muteRoleId
          ? message.guild.roles.cache.get(muteRoleId)
          : message.guild.roles.cache.find(r => r.name === getGuildConfig(message.guild.id).MUTED_ROLE || r.name === DEFAULT_CONFIG.MUTED_ROLE);
        const muteDuration = (cfg.SPAM?.MUTE_DURATION || DEFAULT_CONFIG.SPAM.MUTE_DURATION) * 60000;
        if (muteRole) {
          await message.member.roles.add(muteRole);
          setTimeout(() => message.member.roles.remove(muteRole).catch(() => {}), muteDuration);
        }
        const m = await message.channel.send(`${message.author}, vous avez été muté **${cfg.SPAM?.MUTE_DURATION || DEFAULT_CONFIG.SPAM.MUTE_DURATION}** minute(s) pour spam. 🔇`);
        setTimeout(() => deleteMsg(m), 8000);
        const log = await getLogChannel(message.guild);
        if (log) log.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, desc: `🔇 Anti-spam : **${message.author.tag}** muté ${cfg.SPAM?.MUTE_DURATION || DEFAULT_CONFIG.SPAM.MUTE_DURATION}m.` })] }).catch(() => {});
        addCase(message.guild.id, 'AUTOMUTE', message.author.id, message.author.tag, client.user.id, client.user.tag, 'Anti-spam automatique');
      } catch { /* ignoré */ }
    }
  }
}

// ---- AutoMod action progressive ----
async function autoModAction(message, type, reason) {
  const guildId = message.guild.id;
  const userId  = message.author.id;
  addWarn(guildId, userId, `[AutoMod] ${reason}`, client.user.tag, client.user.id);
  const warns     = getWarns(guildId, userId).length;
  const thresholds = getGuildConfig(guildId).AUTOMOD_ACTIONS || DEFAULT_CONFIG.AUTOMOD_ACTIONS;

  addCase(guildId, `AUTOMOD_${type}`, userId, message.author.tag, client.user.id, client.user.tag, reason);

  if (warns >= thresholds.BAN_THRESHOLD) {
    try { await message.member.ban({ reason: '[AutoMod] Seuil de ban atteint' }); } catch {}
    addCase(guildId, 'AUTOMOD_BAN', userId, message.author.tag, client.user.id, client.user.tag, 'Seuil automod ban atteint');
  } else if (warns >= thresholds.KICK_THRESHOLD) {
    try { await message.member.kick('[AutoMod] Seuil de kick atteint'); } catch {}
    addCase(guildId, 'AUTOMOD_KICK', userId, message.author.tag, client.user.id, client.user.tag, 'Seuil automod kick atteint');
  } else if (warns >= thresholds.MUTE_THRESHOLD) {
    const muteRoleId = getMuteRole(guildId);
    const muteRole   = muteRoleId ? message.guild.roles.cache.get(muteRoleId) : message.guild.roles.cache.find(r => r.name === DEFAULT_CONFIG.MUTED_ROLE);
    if (muteRole) {
      try { await message.member.roles.add(muteRole); } catch {}
    }
    addCase(guildId, 'AUTOMOD_MUTE', userId, message.author.tag, client.user.id, client.user.tag, 'Seuil automod mute atteint');
  }
}

// ============================================================
// SECTION 7 — HANDLER COMMANDES
// ============================================================

async function handleCommand(message, prefix, cfg) {
  const args    = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmdName = args.shift().toLowerCase();
  const cmd     = COMMANDS[cmdName];
  if (!cmd) return;

  // Supprimer le message de commande
  if (cfg.CMD_MSG_DELETE) {
    deleteMsg(message, cfg.CMD_MSG_DELAY || 0);
  }

  // Cooldown
  if (!cooldowns.has(cmdName)) cooldowns.set(cmdName, new Map());
  const cd    = cooldowns.get(cmdName);
  const now   = Date.now();
  const cdMs = cmd.cooldown ?? cfg.COOLDOWN?.DEFAULT ?? DEFAULT_CONFIG.COOLDOWN.DEFAULT;
  if (cd.has(message.author.id)) {
    const diff = now - cd.get(message.author.id);
    if (diff < cdMs) {
      const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, desc: `⏱️ Attendez encore **${((cdMs - diff) / 1000).toFixed(1)}s** avant de réutiliser cette commande.` })] }, message.guild.id);
      return;
    }
  }
  cd.set(message.author.id, now);
  setTimeout(() => cd.delete(message.author.id), cdMs);

  // Permissions
  if (cmd.staffOnly && !isStaff(message.member) && !cfg.OWNER_IDS.includes(message.author.id)) {
    const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '🚫 Vous n\'avez pas les permissions nécessaires.' })] }, message.guild.id);
    return;
  }
  if (cmd.ownerOnly && !cfg.OWNER_IDS.includes(message.author.id)) {
    const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '🚫 Commande réservée au propriétaire.' })] }, message.guild.id);
    return;
  }

  try { await cmd.execute(message, args, cfg); }
  catch (err) {
    console.error(`[CMD ERROR] ${cmdName}:`, err);
    reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Une erreur est survenue lors de l\'exécution de la commande.' })] }, message.guild.id);
  }
}

// ============================================================
// SECTION 8 — COMMANDES
// ============================================================

const COMMANDS = {};

function cmd(name, options) {
  COMMANDS[name] = options;
  if (options.aliases) options.aliases.forEach(a => { COMMANDS[a] = options; });
}

// ============================================================
// 8a. MODÉRATION MEMBRES — BAN / UNBAN / KICK
// ============================================================

cmd('ban', {
  staffOnly: true,
  aliases  : ['b'],
  usage    : 'ban <@membre|ID> [raison]',
  description: 'Bannit définitivement un membre.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un membre ou fournissez son ID.' })] }, message.guild.id);
    if (!canActOn(message.member, target, message.guild)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Vous ne pouvez pas agir sur ce membre.' })] }, message.guild.id);
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    try {
      await message.guild.members.ban(target.id || target.user?.id, { reason, deleteMessageSeconds: 86400 });
    } catch { return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible de bannir ce membre.' })] }, message.guild.id); }
    const caseId = addCase(message.guild.id, 'BAN', target.id || target.user?.id, target.user?.tag || target.tag || 'Inconnu', message.author.id, message.author.tag, reason);
    try { await (target.user || target).send(`🔨 Vous avez été **banni** de **${message.guild.name}**.\nRaison : ${reason}`); } catch {}
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: '🔨 Ban — Cas #' + caseId, fields: [{ name: 'Membre', value: `${target.user?.tag || target.tag || target.id}`, inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: `🔨 Ban — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${target.user?.tag || target.tag} (${target.id || target.user?.id})`, inline: true }, { name: 'Modérateur', value: `${message.author.tag}`, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('tempban', {
  staffOnly: true,
  aliases  : ['tb'],
  usage    : 'tempban <@membre|ID> <durée: 1h/7d> [raison]',
  description: 'Bannit temporairement un membre.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const target   = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un membre ou fournissez son ID.' })] }, message.guild.id);
    if (!canActOn(message.member, target, message.guild)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Vous ne pouvez pas agir sur ce membre.' })] }, message.guild.id);
    const duration = parseDuration(args[1]);
    if (!duration) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Durée invalide. Ex: 1h, 7d, 30m' })] }, message.guild.id);
    const reason   = args.slice(2).join(' ') || 'Aucune raison fournie';
    const userId   = target.id || target.user?.id;
    const userTag  = target.user?.tag || target.tag || 'Inconnu';
    try {
      await message.guild.members.ban(userId, { reason, deleteMessageSeconds: 86400 });
    } catch { return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible de bannir ce membre.' })] }, message.guild.id); }
    const until = Date.now() + duration;
    addTempBan(message.guild.id, userId, reason, message.author.tag, until);
    setTimeout(async () => {
      try {
        await message.guild.members.unban(userId, 'Tempban expiré');
        removeTempBan(message.guild.id, userId);
        const log = await getLogChannel(message.guild);
        if (log) log.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🔓 Tempban expiré pour **${userTag}**.` })] }).catch(() => {});
      } catch {}
    }, duration);
    const caseId = addCase(message.guild.id, 'TEMPBAN', userId, userTag, message.author.id, message.author.tag, reason);
    try { await (target.user || target).send(`🔨 Vous avez été **banni temporairement** de **${message.guild.name}** pour **${formatDuration(duration)}**.\nRaison : ${reason}`); } catch {}
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: `⏳ Tempban — Cas #${caseId}`, fields: [{ name: 'Membre', value: userTag, inline: true }, { name: 'Durée', value: formatDuration(duration), inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: `⏳ Tempban — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${userTag} (${userId})`, inline: true }, { name: 'Durée', value: formatDuration(duration), inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('unban', {
  staffOnly: true,
  aliases  : ['ub'],
  usage    : 'unban <userID> [raison]',
  description: 'Débannit un utilisateur.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId || !/^\d+$/.test(userId)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un ID utilisateur valide.' })] }, message.guild.id);
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    try {
      const ban  = await message.guild.bans.fetch(userId).catch(() => null);
      if (!ban) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Cet utilisateur n\'est pas banni.' })] }, message.guild.id);
      await message.guild.members.unban(userId, reason);
      removeTempBan(message.guild.id, userId);
      const caseId = addCase(message.guild.id, 'UNBAN', userId, ban.user.tag, message.author.id, message.author.tag, reason);
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: `🔓 Unban — Cas #${caseId}`, fields: [{ name: 'Utilisateur', value: ban.user.tag, inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
      await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: `🔓 Unban — Cas #${caseId}`, fields: [{ name: 'Utilisateur', value: `${ban.user.tag} (${userId})`, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
    } catch {
      reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible de débannir (ID invalide ou bot sans permissions).' })] }, message.guild.id);
    }
  }
});

cmd('kick', {
  staffOnly: true,
  aliases  : ['k'],
  usage    : 'kick <@membre> [raison]',
  description: 'Expulse un membre du serveur.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.kickable) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un membre kickable.' })] }, message.guild.id);
    if (!canActOn(message.member, target, message.guild)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Vous ne pouvez pas agir sur ce membre.' })] }, message.guild.id);
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    try { await (target.user || target).send(`Vous avez été **expulsé** de **${message.guild.name}**.\nRaison : ${reason}`); } catch {}
    await target.kick(reason);
    const caseId = addCase(message.guild.id, 'KICK', target.id, target.user.tag, message.author.id, message.author.tag, reason);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `Kick — Cas #${caseId}`, fields: [{ name: 'Membre', value: target.user.tag, inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `Kick — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('softban', {
  staffOnly: true,
  aliases  : ['sb'],
  usage    : 'softban <@membre> [raison]',
  description: 'Banit puis débannit (supprime les messages sans vrai ban).',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un membre.' })] }, message.guild.id);
    if (!canActOn(message.member, target, message.guild)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Vous ne pouvez pas agir sur ce membre.' })] }, message.guild.id);
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    const userId = target.id || target.user?.id;
    const userTag = target.user?.tag || target.tag || 'Inconnu';
    try {
      await message.guild.members.ban(userId, { reason: `Softban — ${reason}`, deleteMessageSeconds: 604800 });
      await message.guild.members.unban(userId, 'Softban — Réintégration automatique');
    } catch { return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible d\'effectuer le softban.' })] }, message.guild.id); }
    const caseId = addCase(message.guild.id, 'SOFTBAN', userId, userTag, message.author.id, message.author.tag, reason);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `🧹 Softban — Cas #${caseId}`, fields: [{ name: 'Membre', value: userTag, inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `🧹 Softban — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${userTag} (${userId})`, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('logsconfig', {
  staffOnly: true,
  aliases  : ['logset', 'configlogs', 'setlogs'],
  usage    : 'logsconfig <sous-commande> [options]',
  description: 'Configure les salons de logs par type.',
  category : '📋 Logs',
  async execute(message, args, cfg) {
    const guild  = message.guild;
    const config = getLogsConfig(guild.id);
    const sub    = args[0]?.toLowerCase();

    if (!sub || sub === 'help') {
      const embed = new EmbedBuilder()
        .setColor(DEFAULT_CONFIG.COLORS.PRIMARY)
        .setTitle('📋 Configuration des Logs — Aide')
        .setDescription([
          '**📺 Salon par défaut**',
          '`logsconfig default <#salon>` — Salon pour tous les logs',
          '`logsconfig default reset` — Supprimer le salon par défaut',
          '',
          '**🎯 Salon spécifique**',
          '`logsconfig set <type> <#salon>` — Salon pour un type précis',
          '`logsconfig set <type> reset` — Supprimer ce salon',
          '',
          '**🔘 Activer / Désactiver**',
          '`logsconfig enable <type>` — Activer un type',
          '`logsconfig disable <type>` — Désactiver un type',
          '`logsconfig enableall` — Tout activer',
          '`logsconfig disableall` — Tout désactiver',
          '',
          '**🔧 Autres**',
          '`logsconfig view` — Voir la configuration',
          '`logsconfig types` — Liste des types',
          '`logsconfig reset` — Réinitialiser',
          '',
          '**📌 Exemples :**',
          '`logsconfig default #📋・logs`',
          '`logsconfig set ban #🔨・modération`',
          '`logsconfig set join #👥・membres`',
          '`logsconfig set msg_delete #💬・messages`',
          '`logsconfig disable voice_join`',
        ].join('\n'));
      return reply(message, { embeds: [embed] }, guild.id);
    }

    if (sub === 'types') {
      const categories = {};
      for (const t of Object.values(LOG_TYPES)) {
        if (!categories[t.category]) categories[t.category] = [];
        categories[t.category].push(t);
      }
      const embed = new EmbedBuilder()
        .setColor(DEFAULT_CONFIG.COLORS.PRIMARY)
        .setTitle('📋 Types de logs disponibles');
      for (const [cat, types] of Object.entries(categories)) {
        embed.addFields({
          name : cat,
          value: types.map(t => `\`${t.key}\` ${t.emoji} ${t.label}`).join('\n'),
          inline: false,
        });
      }
      return reply(message, { embeds: [embed] }, guild.id);
    }

    if (sub === 'default') {
      const val = args[1];
      if (!val) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un salon ou `reset`.' })]
      }, guild.id);
      if (val.toLowerCase() === 'reset') {
        delete config.channels['default'];
        saveData();
        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Salon par défaut supprimé.' })]
        }, guild.id);
      }
      const channel = message.mentions.channels.first()
        || (/^\d{17,20}$/.test(val) && guild.channels.cache.get(val));
      if (!channel || !channel.isTextBased()) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Salon invalide.' })]
      }, guild.id);
      config.channels['default'] = channel.id;
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Salon par défaut : ${channel}` })]
      }, guild.id);
    }

    if (sub === 'set') {
      const typeKey = args[1]?.toLowerCase();
      const val     = args[2];
      if (!typeKey) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `logsconfig set <type> <#salon | reset>`' })]
      }, guild.id);
      const logType = Object.values(LOG_TYPES).find(t => t.key === typeKey);
      if (!logType) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Type \`${typeKey}\` inconnu. Faites \`logsconfig types\`.` })]
      }, guild.id);
      if (!val || val.toLowerCase() === 'reset') {
        delete config.channels[typeKey];
        saveData();
        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Salon spécifique pour \`${typeKey}\` supprimé.` })]
        }, guild.id);
      }
      const channel = message.mentions.channels.first()
        || (/^\d{17,20}$/.test(val) && guild.channels.cache.get(val));
      if (!channel || !channel.isTextBased()) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Salon invalide.' })]
      }, guild.id);
      config.channels[typeKey] = channel.id;
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ ${logType.emoji} **${logType.label}** → ${channel}` })]
      }, guild.id);
    }

    if (sub === 'enable') {
      const typeKey = args[1]?.toLowerCase();
      if (!typeKey) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `logsconfig enable <type>`' })]
      }, guild.id);
      const logType = Object.values(LOG_TYPES).find(t => t.key === typeKey);
      if (!logType) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Type \`${typeKey}\` inconnu.` })]
      }, guild.id);
      config.enabled[typeKey] = true;
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ ${logType.emoji} **${logType.label}** activé.` })]
      }, guild.id);
    }

    if (sub === 'disable') {
      const typeKey = args[1]?.toLowerCase();
      if (!typeKey) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `logsconfig disable <type>`' })]
      }, guild.id);
      const logType = Object.values(LOG_TYPES).find(t => t.key === typeKey);
      if (!logType) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Type \`${typeKey}\` inconnu.` })]
      }, guild.id);
      config.enabled[typeKey] = false;
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ ${logType.emoji} **${logType.label}** désactivé.` })]
      }, guild.id);
    }

    if (sub === 'enableall') {
      for (const t of Object.values(LOG_TYPES)) config.enabled[t.key] = true;
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Tous les types activés.' })]
      }, guild.id);
    }

    if (sub === 'disableall') {
      for (const t of Object.values(LOG_TYPES)) config.enabled[t.key] = false;
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Tous les types désactivés.' })]
      }, guild.id);
    }

    if (sub === 'view' || sub === 'list') {
      const defaultCh = config.channels['default']
        ? guild.channels.cache.get(config.channels['default'])
        : null;
      const categories = {};
      for (const t of Object.values(LOG_TYPES)) {
        if (!categories[t.category]) categories[t.category] = [];
        const specificCh = config.channels[t.key]
          ? guild.channels.cache.get(config.channels[t.key])
          : null;
        const isEnabled = config.enabled[t.key] !== false;
        categories[t.category].push(
          `${isEnabled ? '🟢' : '🔴'} ${t.emoji} \`${t.key}\` ${specificCh ? `→ ${specificCh}` : '*(défaut)*'}`
        );
      }
      const embed = new EmbedBuilder()
        .setColor(DEFAULT_CONFIG.COLORS.PRIMARY)
        .setTitle('📋 Configuration des Logs')
        .addFields({
          name : '📺 Salon par défaut',
          value: defaultCh
            ? `${defaultCh}`
            : `*(non défini — fallback sur \`${getGuildConfig(guild.id).LOG_CHANNEL_NAME}\`)*`,
          inline: false,
        });
      for (const [cat, lines] of Object.entries(categories)) {
        embed.addFields({ name: cat, value: lines.join('\n'), inline: false });
      }
      embed.addFields({
        name : '💡 Légende',
        value: '🟢 Actif • 🔴 Désactivé • *(défaut)* = salon par défaut',
        inline: false,
      });
      return reply(message, { embeds: [embed] }, guild.id);
    }

    if (sub === 'reset') {
      DATA.logsConfig[guild.id] = { channels: {}, enabled: {} };
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Configuration des logs réinitialisée.' })]
      }, guild.id);
    }

    return reply(message, {
      embeds: [makeEmbed({
        color: DEFAULT_CONFIG.COLORS.DANGER,
        desc : `❌ Sous-commande inconnue. Faites \`${cfg.PREFIX}logsconfig help\` pour la liste.`
      })]
    }, guild.id);
  }
});

// ============================================================
// 8b. MUTE / UNMUTE / TIMEOUT
// ============================================================

cmd('mute', {
  staffOnly: true,
  aliases  : ['m'],
  usage    : 'mute <@membre|ID> [durée: 10m/2h] [raison]',
  description: 'Mute un membre (rôle Muted).',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    if (!canActOn(message.member, target, message.guild)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Vous ne pouvez pas agir sur ce membre.' })] }, message.guild.id);
    const muteRoleId = getMuteRole(message.guild.id);
    const muteRole   = muteRoleId
      ? message.guild.roles.cache.get(muteRoleId)
      : message.guild.roles.cache.find(r => r.name === (cfg.MUTED_ROLE || DEFAULT_CONFIG.MUTED_ROLE));
    if (!muteRole) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Rôle Muted introuvable. Utilisez \`${cfg.PREFIX}setmuterole\` ou \`${cfg.PREFIX}setup\`.` })] }, message.guild.id);
    let durationMs  = parseDuration(args[1]);
    let reasonStart = durationMs ? 2 : 1;
    const reason    = args.slice(reasonStart).join(' ') || 'Aucune raison fournie';
    const durationText = durationMs ? formatDuration(durationMs) : 'indéfinie';
    await target.roles.add(muteRole, reason);
    if (durationMs) {
      addTempMute(message.guild.id, target.id, reason, message.author.tag, Date.now() + durationMs);
      setTimeout(() => {
        target.roles.remove(muteRole).catch(() => {});
        removeTempMute(message.guild.id, target.id);
      }, durationMs);
    }
    const caseId = addCase(message.guild.id, 'MUTE', target.id, target.user.tag, message.author.id, message.author.tag, reason);
    try { await target.user.send(`🔇 Vous avez été **muté** sur **${message.guild.name}** (durée: ${durationText}).\nRaison : ${reason}`); } catch {}
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: `🔇 Mute — Cas #${caseId}`, fields: [{ name: 'Membre', value: target.user.tag, inline: true }, { name: 'Durée', value: durationText, inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: `🔇 Mute — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Durée', value: durationText, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('tempmute', {
  staffOnly: true,
  aliases  : ['tm'],
  usage    : 'tempmute <@membre|ID> <durée: 10m/2h/1d> [raison]',
  description: 'Mute temporaire (même que mute mais durée obligatoire).',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    if (!canActOn(message.member, target, message.guild)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Vous ne pouvez pas agir sur ce membre.' })] }, message.guild.id);
    const durationMs = parseDuration(args[1]);
    if (!durationMs) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Durée obligatoire. Ex: 30m, 2h, 1d' })] }, message.guild.id);
    const muteRoleId = getMuteRole(message.guild.id);
    const muteRole   = muteRoleId
      ? message.guild.roles.cache.get(muteRoleId)
      : message.guild.roles.cache.find(r => r.name === (cfg.MUTED_ROLE || DEFAULT_CONFIG.MUTED_ROLE));
    if (!muteRole) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Rôle Muted introuvable. Utilisez \`${cfg.PREFIX}setup\`.` })] }, message.guild.id);
    const reason = args.slice(2).join(' ') || 'Aucune raison fournie';
    await target.roles.add(muteRole, reason);
    addTempMute(message.guild.id, target.id, reason, message.author.tag, Date.now() + durationMs);
    setTimeout(() => {
      target.roles.remove(muteRole).catch(() => {});
      removeTempMute(message.guild.id, target.id);
    }, durationMs);
    const caseId = addCase(message.guild.id, 'TEMPMUTE', target.id, target.user.tag, message.author.id, message.author.tag, reason);
    try { await target.user.send(`🔇 Vous avez été **muté temporairement** sur **${message.guild.name}** pour **${formatDuration(durationMs)}**.\nRaison : ${reason}`); } catch {}
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: `⏳ Tempmute — Cas #${caseId}`, fields: [{ name: 'Membre', value: target.user.tag, inline: true }, { name: 'Durée', value: formatDuration(durationMs), inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: `⏳ Tempmute — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Durée', value: formatDuration(durationMs), inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('unmute', {
  staffOnly: true,
  aliases  : ['um'],
  usage    : 'unmute <@membre|ID>',
  description: 'Unmute un membre.',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const muteRoleId = getMuteRole(message.guild.id);
    const muteRole   = muteRoleId
      ? message.guild.roles.cache.get(muteRoleId)
      : message.guild.roles.cache.find(r => r.name === (cfg.MUTED_ROLE || DEFAULT_CONFIG.MUTED_ROLE));
    if (!muteRole) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Rôle Muted introuvable.' })] }, message.guild.id);
    await target.roles.remove(muteRole);
    removeTempMute(message.guild.id, target.id);
    const caseId = addCase(message.guild.id, 'UNMUTE', target.id, target.user.tag, message.author.id, message.author.tag, 'Unmute manuel');
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: `🔊 Unmute — Cas #${caseId}`, desc: `**${target.user.tag}** a été unmuté.` })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: `🔊 Unmute — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }] }));
  }
});

cmd('timeout', {
  staffOnly: true,
  aliases  : ['to'],
  usage    : 'timeout <@membre> <durée: 10m/2h/28d> [raison]',
  description: 'Timeout natif Discord (max 28j).',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    if (!canActOn(message.member, target, message.guild)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Vous ne pouvez pas agir sur ce membre.' })] }, message.guild.id);
    const durationMs = parseDuration(args[1]);
    if (!durationMs)              return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Durée invalide. Ex: 10m, 2h, 1d (max 28j)' })] }, message.guild.id);
    if (durationMs > 2419200000) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Durée max : 28 jours.' })] }, message.guild.id);
    const reason = args.slice(2).join(' ') || 'Aucune raison fournie';
    await target.timeout(durationMs, reason);
    const caseId = addCase(message.guild.id, 'TIMEOUT', target.id, target.user.tag, message.author.id, message.author.tag, reason);
    try { await target.user.send(`⏰ Vous avez reçu un **timeout** de **${formatDuration(durationMs)}** sur **${message.guild.name}**.\nRaison : ${reason}`); } catch {}
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: `⏰ Timeout — Cas #${caseId}`, fields: [{ name: 'Membre', value: target.user.tag, inline: true }, { name: 'Durée', value: formatDuration(durationMs), inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: `⏰ Timeout — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Durée', value: formatDuration(durationMs), inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('untimeout', {
  staffOnly: true,
  aliases  : ['uto'],
  usage    : 'untimeout <@membre>',
  description: 'Retire le timeout d\'un membre.',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    await target.timeout(null);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Timeout de **${target.user.tag}** retiré.` })] }, message.guild.id);
  }
});

// ============================================================
// 8c. WARN
// ============================================================

cmd('warn', {
  staffOnly: true,
  aliases  : ['w'],
  usage    : 'warn <@membre|ID> [raison]',
  description: 'Avertit un membre.',
  category : '⚠️ Warns',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    const warnId = addWarn(message.guild.id, target.id || target.user?.id, reason, message.author.tag, message.author.id);
    const count  = getWarns(message.guild.id, target.id || target.user?.id).length;
    const caseId = addCase(message.guild.id, 'WARN', target.id || target.user?.id, target.user?.tag || 'Inconnu', message.author.id, message.author.tag, reason);
    try { await (target.user || target).send(`⚠️ Vous avez reçu un **avertissement** sur **${message.guild.name}**.\nRaison : ${reason}\nTotal d'avertissements : **${count}**`); } catch {}
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `⚠️ Warn — Cas #${caseId}`, fields: [{ name: 'Membre', value: target.user?.tag || 'Inconnu', inline: true }, { name: 'Total warns', value: `${count}`, inline: true }, { name: 'ID du warn', value: warnId, inline: true }, { name: 'Raison', value: reason }] })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `⚠️ Warn — Cas #${caseId}`, fields: [{ name: 'Membre', value: `${target.user?.tag} (${target.id || target.user?.id})`, inline: true }, { name: 'Total', value: `${count}`, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }, { name: 'ID Warn', value: warnId }] }));
  }
});

cmd('warnings', {
  staffOnly: true,
  aliases  : ['warns', 'warnlist'],
  usage    : 'warnings <@membre|ID>',
  description: 'Affiche les avertissements d\'un membre.',
  category : '⚠️ Warns',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const userId = target.id || target.user?.id;
    const warns  = getWarns(message.guild.id, userId);
    if (!warns.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ **${target.user?.tag || 'Cet utilisateur'}** n'a aucun avertissement.` })] }, message.guild.id);
    const fields = warns.map((w, i) => ({
      name : `#${i + 1} — ${new Date(w.date).toLocaleDateString('fr-FR')} | ID: ${w.id}`,
      value: `Raison : ${w.reason}\nMod : ${w.mod}`,
    }));
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `⚠️ Avertissements de ${target.user?.tag} (${warns.length} total)`, fields })] }, message.guild.id);
  }
});

cmd('delwarn', {
  staffOnly: true,
  aliases  : ['removewarn', 'warndelete'],
  usage    : 'delwarn <@membre|ID> <ID_du_warn>',
  description: 'Supprime un avertissement spécifique.',
  category : '⚠️ Warns',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const userId = target.id || target.user?.id;
    const warnId = args[1];
    if (!warnId) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez l\'ID du warn (affiché dans la liste des warns).' })] }, message.guild.id);
    const removed = removeWarn(message.guild.id, userId, warnId);
    if (!removed) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Warn introuvable.' })] }, message.guild.id);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Warn \`${warnId}\` supprimé pour **${target.user?.tag}**.` })] }, message.guild.id);
  }
});

cmd('clearwarns', {
  staffOnly: true,
  aliases  : ['warnsclear', 'cw'],
  usage    : 'clearwarns <@membre|ID>',
  description: 'Supprime tous les avertissements d\'un membre.',
  category : '⚠️ Warns',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const userId = target.id || target.user?.id;
    clearWarns(message.guild.id, userId);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Tous les avertissements de **${target.user?.tag}** ont été supprimés.` })] }, message.guild.id);
  }
});

// ============================================================
// 8d. MODÉRATION MESSAGES / SALONS
// ============================================================

cmd('clear', { 
  staffOnly: true,
  aliases  : ['purge', 'prune'],
  cooldown : 5000,
  usage    : 'clear <1-1000> [@membre]',
  description: 'Supprime des messages (gère les 14j de limite Discord).',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    // Supprime immédiatement le message de la commande
    await message.delete().catch(() => {});

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 1000) 
      return reply(
        message, 
        { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un nombre entre 1 et 1000.' })] }, 
        message.guild.id
      );

    const target   = message.mentions.members.first();
    let deleted    = 0;
    let remaining  = amount;

    while (remaining > 0) {
      const fetchLimit = Math.min(remaining, 100);
      let messages = await message.channel.messages.fetch({ limit: fetchLimit });

      // Retire le message de la commande si présent
      messages = messages.filter(m => m.id !== message.id);

      if (target) messages = messages.filter(m => m.author.id === target.id);
      const deletable = [...messages.values()].filter(m => Date.now() - m.createdTimestamp < 1209600000);
      if (!deletable.length) break;
      await message.channel.bulkDelete(deletable, true);
      deleted    += deletable.length;
      remaining  -= deletable.length;
      if (deletable.length < fetchLimit) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    // Message de confirmation
    const m = await reply(message, `**${deleted}** messages supprimés.`, message.guild.id);
    setTimeout(() => {
      if (m && !m.deleted) m.delete().catch(() => {});
    }, 4000);
  }
});

cmd('clearall', {
  staffOnly: true,
  aliases  : ['nukemsgs', 'clearallmsgs'],
  usage    : 'clearall',
  description: 'Supprime tous les messages récents du salon (jusqu\'à 1000).',
  category : '💬 Messages',

  async execute(message, args, cfg) {
    let deleted = 0;

    for (let i = 0; i < 10; i++) {
      const messages = await message.channel.messages.fetch({ limit: 100 });

      const deletable = [...messages.values()].filter(
        m => Date.now() - m.createdTimestamp < 1209600000
      );

      if (!deletable.length) break;

      await message.channel.bulkDelete(deletable, true);
      deleted += deletable.length;

      if (deletable.length < 100) break;
    }

    // Message de confirmation
    const m = await reply(
      message,
      `**${deleted}** messages supprimés.`,
      message.guild.id
    );

    // Suppression après 3 secondes
    setTimeout(() => {
      if (m && !m.deleted) {
        m.delete().catch(() => {});
      }
    }, 3000);
  }
});

cmd('clearuser', {
  staffOnly: true,
  aliases  : ['purgeuser'],
  cooldown : 5000,
  usage    : 'clearuser <@membre|ID> [nombre: 1-100]',
  description: 'Supprime les messages d\'un utilisateur spécifique.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const amount = parseInt(args[1]) || 50;
    const userId = target.id || target.user?.id;
    let messages = await message.channel.messages.fetch({ limit: 100 });
    messages = messages.filter(m => m.author.id === userId);
    const toDelete = [...messages.values()].slice(0, amount).filter(m => Date.now() - m.createdTimestamp < 1209600000);
    await message.channel.bulkDelete(toDelete, true);
    await reply(message, `**${toDelete.length}** messages de **${target.user?.tag}** supprimés.`, message.guild.id);
  }
});

cmd('clearbot', {
  staffOnly: true,
  aliases  : ['purgebots'],
  cooldown : 5000,
  usage    : 'clearbot [nombre: 1-100]',
  description: 'Supprime les messages des bots dans le salon.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    const amount = Math.min(parseInt(args[0]) || 50, 100);
    let messages = await message.channel.messages.fetch({ limit: 100 });
    const toDelete = [...messages.values()].filter(m => m.author.bot && Date.now() - m.createdTimestamp < 1209600000).slice(0, amount);
    await message.channel.bulkDelete(toDelete, true);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🤖 **${toDelete.length}** message(s) de bots supprimé(s).` })] }, message.guild.id);
  }
});

cmd('clearlinks', {
  staffOnly: true,
  aliases  : ['purgelinks'],
  cooldown : 5000,
  usage    : 'clearlinks [nombre: 1-100]',
  description: 'Supprime les messages contenant des liens.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    const amount = Math.min(parseInt(args[0]) || 50, 100);
    let messages = await message.channel.messages.fetch({ limit: 100 });
    const toDelete = [...messages.values()].filter(m => /https?:\/\/\S+/i.test(m.content) && Date.now() - m.createdTimestamp < 1209600000).slice(0, amount);
    await message.channel.bulkDelete(toDelete, true);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🔗 **${toDelete.length}** message(s) avec liens supprimé(s).` })] }, message.guild.id);
  }
});

cmd('clearcontaining', {
  staffOnly: true,
  aliases  : ['purgecontaining', 'clearfind'],
  cooldown : 5000,
  usage    : 'clearcontaining <mot> [nombre: 1-100]',
  description: 'Supprime les messages contenant un mot/texte spécifique.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    const word   = args[0];
    if (!word) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un mot à rechercher.' })] }, message.guild.id);
    const amount = Math.min(parseInt(args[1]) || 50, 100);
    let messages = await message.channel.messages.fetch({ limit: 100 });
    const toDelete = [...messages.values()].filter(m => m.content.toLowerCase().includes(word.toLowerCase()) && Date.now() - m.createdTimestamp < 1209600000).slice(0, amount);
    await message.channel.bulkDelete(toDelete, true);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🔍 **${toDelete.length}** message(s) contenant \`${word}\` supprimé(s).` })] }, message.guild.id);
  }
});

cmd('clearembed', {
  staffOnly: true,
  aliases  : ['purgeembeds'],
  cooldown : 5000,
  usage    : 'clearembed [nombre: 1-100]',
  description: 'Supprime les messages contenant des embeds ou pièces jointes.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    const amount = Math.min(parseInt(args[0]) || 50, 100);
    let messages = await message.channel.messages.fetch({ limit: 100 });
    const toDelete = [...messages.values()].filter(m => (m.embeds.length > 0 || m.attachments.size > 0) && Date.now() - m.createdTimestamp < 1209600000).slice(0, amount);
    await message.channel.bulkDelete(toDelete, true);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `📎 **${toDelete.length}** message(s) avec embeds/pièces jointes supprimé(s).` })] }, message.guild.id);
  }
});

cmd('say', {
  staffOnly: true,
  usage: 'say [#salons / ids catégories] -- <message>',
  description: 'Envoie un message dans un ou plusieurs salons/catégories.',
  category: '💬 Messages',

  async execute(message, args, cfg) {
    try {
      const DEFAULT_CONFIG = cfg;
      const raw = message.content.slice(cfg.PREFIX.length + 'say'.length).trim();

      const separatorIndex = raw.indexOf('--');

      if (separatorIndex === -1) {
        return reply(
          message,
          {
            embeds: [
              makeEmbed({
                color: DEFAULT_CONFIG.COLORS.DANGER,
                desc: '❌ Utilisation : `-say #salon1 #salon2 -- Votre message`'
              })
            ]
          },
          message.guild.id
        );
      }

      const targetsPart = raw.slice(0, separatorIndex).trim();
      const text = raw.slice(separatorIndex + 2).trim();

      if (!text) {
        return reply(
          message,
          {
            embeds: [
              makeEmbed({
                color: DEFAULT_CONFIG.COLORS.DANGER,
                desc: '❌ Fournissez un message.'
              })
            ]
          },
          message.guild.id
        );
      }

      const channelsToSend = new Set();

      // 1️⃣ Ajouter les salons mentionnés
      for (const channel of message.mentions.channels.values()) {
        if (channel.isTextBased()) {
          channelsToSend.add(channel);
        }
      }

      // 2️⃣ Ajouter les salons ou catégories par ID
      const ids = targetsPart.match(/\d{17,20}/g) || [];

      for (const id of ids) {
        const target = message.guild.channels.cache.get(id);

        if (!target) continue;

        // Catégorie
        if (target.type === 4) { // Discord.js v14 : type 4 = GUILD_CATEGORY
          const childChannels = message.guild.channels.cache.filter(
            c => c.parentId === target.id && c.isTextBased()
          );

          for (const ch of childChannels.values()) {
            channelsToSend.add(ch);
          }
        }
        // Salon texte
        else if (target.isTextBased()) {
          channelsToSend.add(target);
        }
      }

      // 3️⃣ Si aucun salon spécifié => salon actuel
      if (channelsToSend.size === 0) {
        channelsToSend.add(message.channel);
      }

      // 4️⃣ Envoyer le message dans tous les salons sélectionnés
      for (const channel of channelsToSend) {
        try {
          await channel.send({
            content: text,
            allowedMentions: { parse: ['users', 'roles'] }
          });
        } catch (err) {
          console.error(`[SAY] Impossible d'envoyer dans ${channel.name}:`, err);
        }
      }

      await message.react('✅');

    } catch (err) {
      console.error(err);

      return reply(
        message,
        {
          embeds: [
            makeEmbed({
              color: DEFAULT_CONFIG.COLORS.DANGER,
              desc: '❌ Une erreur est survenue lors de l’exécution de la commande.'
            })
          ]
        },
        message.guild.id
      );
    }
  }
});

cmd('edit', {
  staffOnly: true,
  usage    : 'edit <messageID> <nouveau contenu>',
  description: 'Modifie un message du bot.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    const msgId  = args[0];
    const newContent = args.slice(1).join(' ');
    if (!msgId || !newContent) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `edit <messageID> <nouveau contenu>`' })] }, message.guild.id);
    try {
      const msg = await message.channel.messages.fetch(msgId);
      if (msg.author.id !== client.user.id) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Je ne peux modifier que mes propres messages.' })] }, message.guild.id);
      await msg.edit(newContent);
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Message modifié.' })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Message introuvable.' })] }, message.guild.id); }
  }
});

// ============================================================
// STATS — Affichage & Configuration (version complète)
// ============================================================

// ── Map globale pour les intervals d'actualisation ────────────────────────────
const statsAutoRefresh = new Map();

// ── Helpers config ────────────────────────────────────────────────────────────

function getStatsConfig(guildId) {
  if (!DATA.statsConfig) DATA.statsConfig = {};
  if (!DATA.statsConfig[guildId]) DATA.statsConfig[guildId] = {};
  return DATA.statsConfig[guildId];
}

// ── Refresh immédiat — Fonction centrale ──────────────────────────────────────

async function triggerStatsRefresh(guildId) {
  try {
    const config = getStatsConfig(guildId);
    if (!config.autoRefresh)          return;
    if (!config.autoRefreshChannelId) return;
    if (!config.autoRefreshMessageId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const ch = guild.channels.cache.get(config.autoRefreshChannelId);
    if (!ch) return;

    const embed = await buildStatsEmbed(guild, config);
    const now   = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit'
    });

    const footerText    = config.footerText
      ? `${config.footerText} • Aujourd'hui à ${now}`
      : `Aujourd'hui à ${now}`;
    const footerOptions = { text: footerText };
    if (config.footerIcon) {
      try { footerOptions.iconURL = config.footerIcon; } catch {}
    }
    try { embed.setFooter(footerOptions); } catch {}

    try {
      const msg = await ch.messages.fetch(config.autoRefreshMessageId);
      await msg.edit({ embeds: [embed] });
    } catch {
      const newMsg = await ch.send({ embeds: [embed] });
      config.autoRefreshMessageId = newMsg.id;
      if (!DATA.statsConfig) DATA.statsConfig = {};
      DATA.statsConfig[guildId] = config;
      saveData();
    }
  } catch (err) {
    console.error('[STATS TRIGGER REFRESH]', err);
  }
}

// ── Builder principal ─────────────────────────────────────────────────────────

async function buildStatsEmbed(guild, config) {
  try { await guild.members.fetch(); } catch {}

  const members = guild.members.cache;
  const total   = guild.memberCount ?? members.size;

  let online = 0;
  try {
    online = members.filter(m =>
      !m.user.bot &&
      m.presence &&
      ['online', 'idle', 'dnd'].includes(m.presence.status)
    ).size;
  } catch { online = 0; }

  let vocal = 0;
  try {
    vocal = members.filter(m =>
      !m.user.bot &&
      m.voice &&
      m.voice.channelId
    ).size;
  } catch { vocal = 0; }

  let boosts = 0;
  try {
    boosts = guild.premiumSubscriptionCount ?? 0;
  } catch { boosts = 0; }

  const title     = config.title     || `Statistiques ${guild.name}`;
  const color     = config.color     ?? 0x2b2d31;
  const thumbnail = config.thumbnail ?? guild.iconURL({ dynamic: true, size: 256 });

  const defaultFields = [
    { key: 'membres', emoji: config.emojiMembres || '👥', label: config.labelMembres || 'Membres',  value: total.toLocaleString('fr-FR') },
    { key: 'online',  emoji: config.emojiOnline  || '🌐', label: config.labelOnline  || 'En Ligne', value: online.toLocaleString('fr-FR') },
    { key: 'vocal',   emoji: config.emojiVocal   || '🔊', label: config.labelVocal   || 'En Vocal', value: vocal.toLocaleString('fr-FR') },
    { key: 'boosts',  emoji: config.emojiBoosts  || '🌸', label: config.labelBoosts  || 'Boosts',   value: boosts.toLocaleString('fr-FR') },
  ];

  const customFields = Array.isArray(config.customFields) ? config.customFields : [];

  const allFields = [
    ...defaultFields.map(f => {
      const override = customFields.find(c => c.key === f.key);
      return override ? { ...f, ...override } : f;
    }),
    ...customFields.filter(c => !defaultFields.find(f => f.key === c.key)),
  ].filter(f => !f.hidden);

  const desc = allFields
    .map(f => `${f.emoji} **${f.label} :** ${f.value}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(desc);

  if (thumbnail) {
    try { embed.setThumbnail(thumbnail); } catch {}
  }

  if (config.footerText) {
    const footerOptions = { text: config.footerText };
    if (config.footerIcon) {
      try { footerOptions.iconURL = config.footerIcon; } catch {}
    }
    try { embed.setFooter(footerOptions); } catch {}
  }

  return embed;
}

// ── Système d'actualisation automatique ──────────────────────────────────────

async function startStatsAutoRefresh(guildId) {
  stopStatsAutoRefresh(guildId);

  const config = getStatsConfig(guildId);
  if (!config.autoRefresh)          return;
  if (!config.autoRefreshChannelId) return;
  if (!config.autoRefreshMessageId) return;

  const intervalMs = (config.autoRefreshInterval ?? 5) * 60 * 1000;
  if (intervalMs < 60000) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const doRefresh = async () => {
    try {
      const cfg = getStatsConfig(guildId);
      if (!cfg.autoRefresh) {
        stopStatsAutoRefresh(guildId);
        return;
      }

      const g  = client.guilds.cache.get(guildId);
      if (!g) return;

      const ch = g.channels.cache.get(cfg.autoRefreshChannelId);
      if (!ch) return;

      const embed = await buildStatsEmbed(g, cfg);
      const now   = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit'
      });

      const footerText    = cfg.footerText
        ? `${cfg.footerText} • Aujourd'hui ${now}`
        : `Aujourd'hui à ${now}`;
      const footerOptions = { text: footerText };
      if (cfg.footerIcon) {
        try { footerOptions.iconURL = cfg.footerIcon; } catch {}
      }
      try { embed.setFooter(footerOptions); } catch {}

      try {
        const msg = await ch.messages.fetch(cfg.autoRefreshMessageId);
        await msg.edit({ embeds: [embed] });
      } catch {
        const newMsg = await ch.send({ embeds: [embed] });
        cfg.autoRefreshMessageId = newMsg.id;
        if (!DATA.statsConfig) DATA.statsConfig = {};
        DATA.statsConfig[guildId] = cfg;
        saveData();
      }
    } catch (err) {
      console.error('[STATS AUTO-REFRESH]', err);
    }
  };

  const interval = setInterval(doRefresh, intervalMs);
  statsAutoRefresh.set(guildId, { interval, intervalMs });
  console.log(`[STATS] Auto-refresh démarré — guild ${guildId} (${intervalMs / 60000} min)`);
}

function stopStatsAutoRefresh(guildId) {
  const entry = statsAutoRefresh.get(guildId);
  if (entry) {
    clearInterval(entry.interval);
    statsAutoRefresh.delete(guildId);
    console.log(`[STATS] Auto-refresh stoppé — guild ${guildId}`);
  }
}

async function initAllStatsAutoRefresh() {
  if (!DATA.statsConfig) DATA.statsConfig = {};
  for (const [guildId, config] of Object.entries(DATA.statsConfig)) {
    if (config.autoRefresh) {
      await startStatsAutoRefresh(guildId);
    }
  }
}

// ── Events Discord pour refresh immédiat ─────────────────────────────────────

client.on('guildMemberAdd', async (member) => {
  await triggerStatsRefresh(member.guild.id).catch(() => {});
});

client.on('guildMemberRemove', async (member) => {
  await triggerStatsRefresh(member.guild.id).catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDE : stats
// ═══════════════════════════════════════════════════════════════════════════════

cmd('stats', {
  staffOnly: false,
  aliases: ['serverstats', 'statistics'],
  usage: 'stats',
  description: 'Affiche les statistiques du serveur.',
  category: '📊 Stats',
  async execute(message, args, cfg) {
    try {
      const config = getStatsConfig(message.guild.id);
      const embed  = await buildStatsEmbed(message.guild, config);
      await reply(message, { embeds: [embed] }, message.guild.id);
    } catch (err) {
      console.error('[STATS] Erreur :', err);
      await reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible de charger les statistiques.' })]
      }, message.guild.id);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDE : statsconfig
// ═══════════════════════════════════════════════════════════════════════════════

cmd('statsconfig', {
  staffOnly: true,
  aliases: ['statset', 'configstats'],
  usage: 'statsconfig <sous-commande> [options]',
  description: 'Configure la commande stats.',
  category: '📊 Stats',
  async execute(message, args, cfg) {
    const guild  = message.guild;
    const config = getStatsConfig(guild.id);
    const sub    = args[0]?.toLowerCase();

    // ── Aide ────────────────────────────────────────────────────
    if (!sub || sub === 'help') {
      const embed = new EmbedBuilder()
        .setColor(DEFAULT_CONFIG.COLORS.PRIMARY)
        .setTitle('📊 Configuration des Stats — Aide')
        .setDescription([
          '**🎨 Apparence**',
          `\`statsconfig title <titre>\` — Titre de l'embed`,
          `\`statsconfig color <#hex>\` — Couleur de l'embed`,
          `\`statsconfig thumbnail <url | reset>\` — Miniature`,
          '',
          '**📝 Footer**',
          `\`statsconfig footer <texte>\` — Texte du footer`,
          `\`statsconfig footericon <url | reset>\` — Icône du footer`,
          `\`statsconfig footerclear\` — Supprimer le footer`,
          '',
          '**🔄 Actualisation automatique**',
          `\`statsconfig refresh on <#salon>\` — Activer l'auto-refresh`,
          `\`statsconfig refresh off\` — Désactiver l'auto-refresh`,
          `\`statsconfig refresh interval <minutes>\` — Intervalle (min: 1, défaut: 5)`,
          `\`statsconfig refresh now\` — Forcer une mise à jour`,
          `\`statsconfig refresh status\` — Voir le statut`,
          '',
          '**🔢 Champs par défaut**',
          `\`statsconfig emoji <key> <emoji>\` — Emoji d'un champ`,
          `\`statsconfig label <key> <label>\` — Label d'un champ`,
          `\`statsconfig hide <key>\` — Masquer un champ`,
          `\`statsconfig show <key>\` — Afficher un champ`,
          '',
          '**➕ Champs custom**',
          `\`statsconfig addfield <key> <emoji> <label> | <valeur>\` — Ajouter un champ`,
          `\`statsconfig setvalue <key> <valeur>\` — Modifier la valeur d'un champ custom`,
          `\`statsconfig removefield <key>\` — Supprimer un champ custom`,
          '',
          '**🔧 Autres**',
          `\`statsconfig view\` — Voir la config actuelle`,
          `\`statsconfig preview\` — Prévisualiser`,
          `\`statsconfig reset\` — Tout réinitialiser`,
          '',
          '**🔑 Keys par défaut :** `membres` `online` `vocal` `boosts`',
          '💡 *Les emojis animés sont supportés !*',
          '⚡ *Le refresh se déclenche automatiquement lors de chaque changement.*',
        ].join('\n'));

      return reply(message, { embeds: [embed] }, guild.id);
    }

    // ── Titre ────────────────────────────────────────────────────
    if (sub === 'title') {
      const title = args.slice(1).join(' ');
      if (!title) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un titre.' })]
      }, guild.id);
      config.title = title;
      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Titre : **${title}**` })]
      }, guild.id);
    }

    // ── Couleur ──────────────────────────────────────────────────
    if (sub === 'color' || sub === 'colour') {
      const hex = args[1]?.replace('#', '');
      if (!hex || !/^[0-9A-Fa-f]{6}$/.test(hex)) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Couleur hex invalide. Ex: `#FF0000`' })]
      }, guild.id);
      config.color = parseInt(hex, 16);
      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [new EmbedBuilder()
          .setColor(config.color)
          .setDescription(`✅ Couleur mise à jour : **#${hex.toUpperCase()}**`)]
      }, guild.id);
    }

    // ── Thumbnail ────────────────────────────────────────────────
    if (sub === 'thumbnail') {
      const val = args[1];
      if (!val) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez une URL ou `reset`.' })]
      }, guild.id);

      if (val.toLowerCase() === 'reset') {
        delete config.thumbnail;
        saveData();
        await triggerStatsRefresh(guild.id).catch(() => {});
        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Miniature réinitialisée.' })]
        }, guild.id);
      }

      if (!/^https?:\/\/.+/.test(val)) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ URL invalide.' })]
      }, guild.id);

      config.thumbnail = val;
      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [new EmbedBuilder()
          .setColor(DEFAULT_CONFIG.COLORS.SUCCESS)
          .setDescription('✅ Miniature mise à jour.')
          .setThumbnail(val)]
      }, guild.id);
    }

    // ── Footer texte ─────────────────────────────────────────────
    if (sub === 'footer') {
      const text = args.slice(1).join(' ');
      if (!text) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un texte de footer.' })]
      }, guild.id);
      config.footerText = text;
      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Footer : **${text}**` })]
      }, guild.id);
    }

    // ── Footer icône ─────────────────────────────────────────────
    if (sub === 'footericon') {
      const val = args[1];
      if (!val) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez une URL ou `reset`.' })]
      }, guild.id);

      if (val.toLowerCase() === 'reset') {
        delete config.footerIcon;
        saveData();
        await triggerStatsRefresh(guild.id).catch(() => {});
        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Icône du footer supprimée.' })]
        }, guild.id);
      }

      if (!/^https?:\/\/.+/.test(val)) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ URL invalide.' })]
      }, guild.id);

      config.footerIcon = val;
      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [new EmbedBuilder()
          .setColor(DEFAULT_CONFIG.COLORS.SUCCESS)
          .setDescription('✅ Icône du footer mise à jour.')
          .setFooter({ text: config.footerText || 'Aperçu footer', iconURL: val })]
      }, guild.id);
    }

    // ── Footer clear ──────────────────────────────────────────────
    if (sub === 'footerclear') {
      delete config.footerText;
      delete config.footerIcon;
      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Footer supprimé.' })]
      }, guild.id);
    }

    // ── Auto-Refresh ─────────────────────────────────────────────
    if (sub === 'refresh') {
      const action = args[1]?.toLowerCase();

      // refresh on <#salon>
      if (action === 'on') {
        const channel = message.mentions.channels.first()
          || (args[2] && /^\d{17,20}$/.test(args[2]) && guild.channels.cache.get(args[2]));

        if (!channel) return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un salon ou fournissez son ID.\nEx: `statsconfig refresh on #stats`' })]
        }, guild.id);

        if (!channel.isTextBased()) return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Ce salon n\'est pas un salon textuel.' })]
        }, guild.id);

        const embed = await buildStatsEmbed(guild, config);
        const now   = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit'
        });
        const footerText    = config.footerText
          ? `${config.footerText} • Aujourd'hui ${now}`
          : `Aujourd'hui à ${now}`;
        const footerOptions = { text: footerText };
        if (config.footerIcon) {
          try { footerOptions.iconURL = config.footerIcon; } catch {}
        }
        try { embed.setFooter(footerOptions); } catch {}

        const statsMsg = await channel.send({ embeds: [embed] });

        config.autoRefresh          = true;
        config.autoRefreshChannelId = channel.id;
        config.autoRefreshMessageId = statsMsg.id;
        if (!config.autoRefreshInterval) config.autoRefreshInterval = 5;
        saveData();

        await startStatsAutoRefresh(guild.id);

        return reply(message, {
          embeds: [new EmbedBuilder()
            .setColor(DEFAULT_CONFIG.COLORS.SUCCESS)
            .setTitle('🔄 Auto-refresh activé')
            .setDescription([
              `✅ Stats envoyées dans ${channel}`,
              `⏱️ Intervalle : **${config.autoRefreshInterval} minute(s)**`,
              '',
              '🔁 Le refresh se déclenche aussi automatiquement',
              'lors de chaque ajout/suppression de membre.',
              '',
              `Changer l'intervalle : \`statsconfig refresh interval <minutes>\``,
              `Désactiver : \`statsconfig refresh off\``,
            ].join('\n'))]
        }, guild.id);
      }

      // refresh off
      if (action === 'off') {
        stopStatsAutoRefresh(guild.id);
        config.autoRefresh = false;
        saveData();
        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Auto-refresh désactivé.' })]
        }, guild.id);
      }

      // refresh interval <minutes>
      if (action === 'interval') {
        const minutes = parseInt(args[2]);
        if (isNaN(minutes) || minutes < 1) return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un nombre de minutes valide (minimum : 1).\nEx: `statsconfig refresh interval 10`' })]
        }, guild.id);

        config.autoRefreshInterval = minutes;
        saveData();

        if (config.autoRefresh) {
          await startStatsAutoRefresh(guild.id);
          return reply(message, {
            embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Intervalle : **${minutes} minute(s)**\n🔄 Auto-refresh redémarré.` })]
          }, guild.id);
        }

        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Intervalle défini : **${minutes} minute(s)**\n*(Activez avec \`statsconfig refresh on #salon\`)*` })]
        }, guild.id);
      }

      // refresh now
      if (action === 'now') {
        if (!config.autoRefresh || !config.autoRefreshChannelId || !config.autoRefreshMessageId) {
          return reply(message, {
            embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ L\'auto-refresh n\'est pas activé. Utilisez `statsconfig refresh on #salon`.' })]
          }, guild.id);
        }

        await triggerStatsRefresh(guild.id).catch(() => {});
        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Stats mises à jour immédiatement.' })]
        }, guild.id);
      }

      // refresh status
      if (action === 'status' || !action) {
        const entry     = statsAutoRefresh.get(guild.id);
        const isRunning = !!entry;
        const channel   = config.autoRefreshChannelId
          ? guild.channels.cache.get(config.autoRefreshChannelId)
          : null;

        const embed = new EmbedBuilder()
          .setColor(DEFAULT_CONFIG.COLORS.PRIMARY)
          .setTitle('🔄 Statut Auto-Refresh')
          .addFields(
            {
              name : '📡 État',
              value: config.autoRefresh && isRunning
                ? '🟢 **Actif**'
                : config.autoRefresh && !isRunning
                  ? '🟡 **Configuré mais non démarré** *(redémarrez le bot)*'
                  : '🔴 **Inactif**',
              inline: false,
            },
            {
              name : '📺 Salon',
              value: channel ? `${channel}` : 'Non défini',
              inline: true,
            },
            {
              name : '⏱️ Intervalle',
              value: `**${config.autoRefreshInterval ?? 5} minute(s)**`,
              inline: true,
            },
            {
              name : '💬 Message ID',
              value: config.autoRefreshMessageId
                ? `\`${config.autoRefreshMessageId}\``
                : 'Non défini',
              inline: false,
            },
            {
              name : '⚡ Triggers immédiats',
              value: [
                '👥 Nouveau membre',
                '👥 Membre parti',
              ].join('\n'),
              inline: false,
            },
          );

        return reply(message, { embeds: [embed] }, guild.id);
      }

      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: [
          '❌ Sous-commande `refresh` inconnue.',
          '',
          '`statsconfig refresh on <#salon>` — Activer',
          '`statsconfig refresh off` — Désactiver',
          '`statsconfig refresh interval <minutes>` — Intervalle',
          '`statsconfig refresh now` — Mise à jour immédiate',
          '`statsconfig refresh status` — Statut',
        ].join('\n') })]
      }, guild.id);
    }

    // ── Emoji ─────────────────────────────────────────────────────
    if (sub === 'emoji') {
      const key   = args[1]?.toLowerCase();
      const emoji = args.slice(2).join(' ').trim();

      if (!key || !emoji) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `statsconfig emoji <key> <emoji>`' })]
      }, guild.id);

      const emojiKeyMap = {
        membres : 'emojiMembres',
        online  : 'emojiOnline',
        vocal   : 'emojiVocal',
        boosts  : 'emojiBoosts',
      };

      if (emojiKeyMap[key]) {
        config[emojiKeyMap[key]] = emoji;
      } else {
        if (!Array.isArray(config.customFields)) config.customFields = [];
        const f = config.customFields.find(c => c.key === key);
        if (f) f.emoji = emoji;
        else config.customFields.push({ key, emoji, label: key, value: '—' });
      }

      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Emoji \`${key}\` : ${emoji}` })]
      }, guild.id);
    }

    // ── Label ─────────────────────────────────────────────────────
    if (sub === 'label') {
      const key   = args[1]?.toLowerCase();
      const label = args.slice(2).join(' ');

      if (!key || !label) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `statsconfig label <key> <label>`' })]
      }, guild.id);

      const labelKeyMap = {
        membres : 'labelMembres',
        online  : 'labelOnline',
        vocal   : 'labelVocal',
        boosts  : 'labelBoosts',
      };

      if (labelKeyMap[key]) {
        config[labelKeyMap[key]] = label;
      } else {
        if (!Array.isArray(config.customFields)) config.customFields = [];
        const f = config.customFields.find(c => c.key === key);
        if (f) f.label = label;
        else config.customFields.push({ key, emoji: '❓', label, value: '—' });
      }

      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Label \`${key}\` : **${label}**` })]
      }, guild.id);
    }

    // ── Hide ──────────────────────────────────────────────────────
    if (sub === 'hide') {
      const key = args[1]?.toLowerCase();
      if (!key) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `statsconfig hide <key>`' })]
      }, guild.id);

      if (!Array.isArray(config.customFields)) config.customFields = [];
      const f = config.customFields.find(c => c.key === key);
      if (f) { f.hidden = true; }
      else { config.customFields.push({ key, hidden: true }); }

      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Champ \`${key}\` masqué.` })]
      }, guild.id);
    }

    // ── Show ──────────────────────────────────────────────────────
    if (sub === 'show') {
      const key = args[1]?.toLowerCase();
      if (!key) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `statsconfig show <key>`' })]
      }, guild.id);

      if (!Array.isArray(config.customFields)) config.customFields = [];
      const f = config.customFields.find(c => c.key === key);
      if (f) f.hidden = false;

      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Champ \`${key}\` affiché.` })]
      }, guild.id);
    }

    // ── Add Field ─────────────────────────────────────────────────
    if (sub === 'addfield') {
      const key = args[1]?.toLowerCase();
      if (!key) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `statsconfig addfield <key> <emoji> <label> | <valeur>`' })]
      }, guild.id);

      const rest  = args.slice(2).join(' ');
      const parts = rest.split('|');
      const left  = parts[0]?.trim().split(' ') ?? [];
      const emoji = left[0] ?? '❓';
      const label = left.slice(1).join(' ') || key;
      const value = parts[1]?.trim() || '—';

      if (!Array.isArray(config.customFields)) config.customFields = [];
      const existing = config.customFields.find(c => c.key === key);
      if (existing) {
        existing.emoji  = emoji;
        existing.label  = label;
        existing.value  = value;
        existing.hidden = false;
      } else {
        config.customFields.push({ key, emoji, label, value, custom: true });
      }

      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Champ \`${key}\` : ${emoji} **${label}** → ${value}` })]
      }, guild.id);
    }

    // ── Set Value ─────────────────────────────────────────────────
    if (sub === 'setvalue') {
      const key   = args[1]?.toLowerCase();
      const value = args.slice(2).join(' ');

      if (!key || !value) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `statsconfig setvalue <key> <valeur>`' })]
      }, guild.id);

      if (!Array.isArray(config.customFields)) config.customFields = [];
      const f = config.customFields.find(c => c.key === key);
      if (!f) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Champ \`${key}\` introuvable. Créez-le avec \`addfield\`.` })]
      }, guild.id);

      f.value = value;
      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Valeur \`${key}\` : **${value}**` })]
      }, guild.id);
    }

    // ── Remove Field ──────────────────────────────────────────────
    if (sub === 'removefield') {
      const key = args[1]?.toLowerCase();
      if (!key) return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `statsconfig removefield <key>`' })]
      }, guild.id);

      if (!Array.isArray(config.customFields)) config.customFields = [];
      config.customFields = config.customFields.filter(c => c.key !== key);

      saveData();
      await triggerStatsRefresh(guild.id).catch(() => {});
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Champ \`${key}\` supprimé.` })]
      }, guild.id);
    }

    // ── View ──────────────────────────────────────────────────────
    if (sub === 'view' || sub === 'list') {
      const customFields = Array.isArray(config.customFields) ? config.customFields : [];

      const entry     = statsAutoRefresh.get(guild.id);
      const refreshCh = config.autoRefreshChannelId
        ? guild.channels.cache.get(config.autoRefreshChannelId)
        : null;

      const defaultsDisplay = [
        `\`membres\` ${config.emojiMembres || '👥'} **${config.labelMembres || 'Membres'}**`,
        `\`online\`  ${config.emojiOnline  || '🌐'} **${config.labelOnline  || 'En Ligne'}**`,
        `\`vocal\`   ${config.emojiVocal   || '🔊'} **${config.labelVocal   || 'En Vocal'}**`,
        `\`boosts\`  ${config.emojiBoosts  || '🌸'} **${config.labelBoosts  || 'Boosts'}**`,
      ];

      const customDisplay = customFields.length
        ? customFields.map(f =>
            `\`${f.key}\` ${f.emoji || ''} **${f.label || f.key}** = ${f.value || '—'} ${f.hidden ? '*(masqué)*' : ''}`
          ).join('\n')
        : 'Aucun';

      const embed = new EmbedBuilder()
        .setColor(DEFAULT_CONFIG.COLORS.PRIMARY)
        .setTitle('📊 Configuration Stats actuelle')
        .addFields(
          {
            name: '🎨 Apparence',
            value: [
              `**Titre :** ${config.title || `Statistiques ${guild.name}`}`,
              `**Couleur :** ${config.color ? `#${config.color.toString(16).toUpperCase()}` : 'Défaut'}`,
              `**Thumbnail :** ${config.thumbnail ? '[URL personnalisée]' : 'Icône du serveur'}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '📝 Footer',
            value: [
              `**Texte :** ${config.footerText || 'Aucun'}`,
              `**Icône :** ${config.footerIcon ? '[URL]' : 'Aucune'}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🔄 Auto-Refresh',
            value: [
              `**État :** ${config.autoRefresh && entry ? '🟢 Actif' : '🔴 Inactif'}`,
              `**Salon :** ${refreshCh ? `${refreshCh}` : 'Non défini'}`,
              `**Intervalle :** ${config.autoRefreshInterval ?? 5} minute(s)`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🔢 Champs par défaut',
            value: defaultsDisplay.join('\n'),
            inline: false,
          },
          {
            name: '➕ Champs custom',
            value: customDisplay,
            inline: false,
          },
        );

      return reply(message, { embeds: [embed] }, guild.id);
    }

    // ── Preview ───────────────────────────────────────────────────
    if (sub === 'preview') {
      try {
        const embed = await buildStatsEmbed(guild, config);
        embed.setTitle(`👁️ Aperçu — ${embed.data.title}`);
        return reply(message, { embeds: [embed] }, guild.id);
      } catch (err) {
        console.error('[STATSCONFIG PREVIEW]', err);
        return reply(message, {
          embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Erreur lors de la prévisualisation.' })]
        }, guild.id);
      }
    }

    // ── Reset ─────────────────────────────────────────────────────
    if (sub === 'reset') {
      stopStatsAutoRefresh(guild.id);
      DATA.statsConfig[guild.id] = {};
      saveData();
      return reply(message, {
        embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Configuration réinitialisée.' })]
      }, guild.id);
    }

    // ── Sous-commande inconnue ────────────────────────────────────
    return reply(message, {
      embeds: [makeEmbed({
        color: DEFAULT_CONFIG.COLORS.DANGER,
        desc: `❌ Sous-commande inconnue. Faites \`${cfg.PREFIX}statsconfig help\` pour la liste.`
      })]
    }, guild.id);
  }
});

cmd('embed', {
  staffOnly: true,
  usage    : 'embed',
  description: 'Ouvre un formulaire pour créer un embed.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_embed_modal').setLabel('✏️ Créer l\'embed').setStyle(ButtonStyle.Primary)
    );
    const prompt = await message.channel.send({
      embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, desc: `${message.author}, clique sur le bouton pour créer ton embed.` })],
      components: [row],
    });
    pendingEmbedChannels.set(message.author.id, message.channel.id);
    const filter = i => i.customId === 'open_embed_modal' && i.user.id === message.author.id;
    const collector = prompt.createMessageComponentCollector({ filter, time: 30000, max: 1 });
    collector.on('collect', async interaction => {
      const modal = new ModalBuilder().setCustomId('embed_modal').setTitle('Créer un embed');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_title').setLabel('Titre').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Titre de l\'embed')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Contenu de l\'embed...')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_color').setLabel('Couleur hex (ex: #FF0000)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('#5865F2')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_footer').setLabel('Footer (optionnel)').setStyle(TextInputStyle.Short).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_image').setLabel('URL image (optionnel)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://...')),
      );
      pendingEmbedChannels.set(interaction.user.id, message.channel.id);
      await interaction.showModal(modal);
    });
    collector.on('end', (_, reason) => { if (reason === 'time') prompt.delete().catch(() => {}); });
  }
});

const pendingEmbedChannels = new Map();

async function handleEmbedModal(interaction) {
  const channelId    = pendingEmbedChannels.get(interaction.user.id) || interaction.channelId;
  pendingEmbedChannels.delete(interaction.user.id);
  const title  = interaction.fields.getTextInputValue('embed_title') || null;
  const desc   = interaction.fields.getTextInputValue('embed_desc');
  const color  = interaction.fields.getTextInputValue('embed_color')?.replace('#', '') || null;
  const footer = interaction.fields.getTextInputValue('embed_footer') || null;
  const image  = interaction.fields.getTextInputValue('embed_image') || null;
  let parsedColor = DEFAULT_CONFIG.COLORS.PRIMARY;
  if (color) { const hex = parseInt(color, 16); if (!isNaN(hex)) parsedColor = hex; }
  const embed = new EmbedBuilder().setColor(parsedColor).setDescription(desc).setTimestamp();
  if (title)  embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });
  if (image)  embed.setImage(image);
  const targetChannel = interaction.guild.channels.cache.get(channelId) || interaction.channel;
  await targetChannel.send({ embeds: [embed] });
  await interaction.reply({ content: '✅ Embed envoyé !', ephemeral: true });
}

// ============================================================
// 8e. SALONS — LOCK / UNLOCK / HIDE / MANAGE
// ============================================================

cmd('lock', {
  staffOnly: true,
  aliases  : ['lockdown'],
  usage    : 'lock [#salon1] [#salon2] ... [raison]',
  description: 'Verrouille un ou plusieurs salons (supporte plusieurs #salon).',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channels = parseChannels(message, args);
    const target   = channels.length > 0 ? channels : [message.channel];
    const reason   = args.filter(a => !a.match(/^<#\d+>$/) && !a.match(/^\d{17,20}$/)).join(' ') || 'Aucune raison';
    let locked = 0;
    for (const ch of target) {
      if (ch.type !== ChannelType.GuildText) continue;
      try {
        await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        if (!DATA.lockLog[message.guild.id]) DATA.lockLog[message.guild.id] = [];
        if (!DATA.lockLog[message.guild.id].includes(ch.id)) DATA.lockLog[message.guild.id].push(ch.id);
        locked++;
      } catch {}
    }
    saveData();
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: '🔒 Salon(s) verrouillé(s)', desc: `**${locked}** salon(s) verrouillé(s).\nRaison : ${reason}` })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: '🔒 Lock', fields: [{ name: 'Salons', value: target.map(c => `${c}`).join(', ') }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('unlock', {
  staffOnly: true,
  usage    : 'unlock [#salon1] [#salon2] ...',
  description: 'Déverrouille un ou plusieurs salons.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channels = parseChannels(message, args);
    const target   = channels.length > 0 ? channels : [message.channel];
    let unlocked   = 0;
    for (const ch of target) {
      if (ch.type !== ChannelType.GuildText) continue;
      try {
        await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        if (DATA.lockLog[message.guild.id]) DATA.lockLog[message.guild.id] = DATA.lockLog[message.guild.id].filter(id => id !== ch.id);
        unlocked++;
      } catch {}
    }
    saveData();
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: '🔓 Salon(s) déverrouillé(s)', desc: `**${unlocked}** salon(s) déverrouillé(s).` })] }, message.guild.id);
  }
});

cmd('lockall', {
  staffOnly: true,
  usage    : 'lockall [raison]',
  description: 'Verrouille tous les salons texte du serveur.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const reason = args.join(' ') || 'Verrouillage général';
    const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    let count = 0;
    if (!DATA.lockLog[message.guild.id]) DATA.lockLog[message.guild.id] = [];
    for (const [, ch] of channels) {
      try {
        await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        if (!DATA.lockLog[message.guild.id].includes(ch.id)) DATA.lockLog[message.guild.id].push(ch.id);
        count++;
      } catch {}
    }
    saveData();
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, desc: `🔒 **${count}** salon(s) verrouillé(s).\nRaison : ${reason}` })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: '🔒 LockAll', fields: [{ name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: reason }] }));
  }
});

cmd('unlockall', {
  staffOnly: true,
  usage    : 'unlockall',
  description: 'Déverrouille tous les salons verrouillés.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const locked = DATA.lockLog[message.guild.id] || [];
    let count    = 0;
    for (const chId of locked) {
      const ch = message.guild.channels.cache.get(chId);
      if (!ch) continue;
      try { await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }); count++; } catch {}
    }
    DATA.lockLog[message.guild.id] = [];
    saveData();
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🔓 **${count}** salon(s) déverrouillé(s).` })] }, message.guild.id);
  }
});

cmd('hide', {
  staffOnly: true,
  usage    : 'hide [#salon1] [#salon2] ...',
  description: 'Cache un ou plusieurs salons à @everyone.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channels = parseChannels(message, args);
    const target   = channels.length > 0 ? channels : [message.channel];
    let hidden = 0;
    for (const ch of target) {
      try { await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false }); hidden++; } catch {}
    }
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `**${hidden}** salon(s) caché(s).` })] }, message.guild.id);
  }
});

cmd('unhide', {
  staffOnly: true,
  usage    : 'unhide [#salon1] [#salon2] ...',
  description: 'Rend un ou plusieurs salons visibles.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channels = parseChannels(message, args);
    const target   = channels.length > 0 ? channels : [message.channel];
    let shown = 0;
    for (const ch of target) {
      try { await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null }); shown++; } catch {}
    }
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `**${shown}** salon(s) visible(s).` })] }, message.guild.id);
  }
});

cmd('hideall', {
  staffOnly: true,
  usage    : 'hideall',
  description: 'Cache tous les salons texte.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    let count = 0;
    for (const [, ch] of channels) {
      try { await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false }); count++; } catch {}
    }
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `🙈 **${count}** salon(s) caché(s).` })] }, message.guild.id);
  }
});

cmd('unhideall', {
  staffOnly: true,
  usage    : 'unhideall',
  description: 'Rend tous les salons visibles.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    let count = 0;
    for (const [, ch] of channels) {
      try { await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null }); count++; } catch {}
    }
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `👁️ **${count}** salon(s) rendu(s) visible(s).` })] }, message.guild.id);
  }
});

cmd('slowmode', {
  staffOnly: true,
  aliases  : ['slow'],
  usage    : 'slowmode <secondes: 0-21600> [#salon1] [#salon2] ...',
  description: 'Définit le mode lent (0 = désactiver) sur un ou plusieurs salons.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const sec = parseInt(args[0]);
    if (isNaN(sec) || sec < 0 || sec > 21600) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un nombre de secondes valide (0-21600).' })] }, message.guild.id);
    const channels = parseChannels(message, args.slice(1));
    const target   = channels.length > 0 ? channels : [message.channel];
    let count = 0;
    for (const ch of target) {
      if (ch.type !== ChannelType.GuildText) continue;
      try { await ch.setRateLimitPerUser(sec); count++; } catch {}
    }
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: sec === 0 ? `⚡ Mode lent désactivé sur **${count}** salon(s).` : `🐌 Mode lent défini à **${sec}s** sur **${count}** salon(s).` })] }, message.guild.id);
  }
});

cmd('recreate', {
  staffOnly: true,
  aliases: ['nuke'],
  usage: 'recreate [#salon]',
  description: 'Recrée un salon à l\'identique (nuke — supprime et recrée).',
  category: '🔒 Salons',

  async execute(message, args, cfg) {
    const channel  = message.mentions.channels.first() || message.channel;
    const position = channel.position;

    const newCh = await channel.clone({
      reason: `Recréé par ${message.author.tag}`
    });

    await newCh.setPosition(position);

    await channel.delete(`Recréé par ${message.author.tag}`);

    const msg = await newCh.send(`Salon recréé par ${message.author}.`);

    setTimeout(() => {
      msg.delete().catch(() => {});
    }, 3500);
  }
});

cmd('clone', {
  staffOnly: true,
  cooldown: 0,
  usage: 'clone [nombre]',
  description: 'Clone un salon plusieurs fois.',
  category: '🔒 Salons',

  async execute(message, args, cfg) {
    const channel = message.channel;

    const amount = parseInt(args[0]) || 1;

    if (amount < 1) {
      return reply(message, {
        embeds: [
          makeEmbed({
            color: DEFAULT_CONFIG.COLORS.ERROR,
            desc: '❌ Nombre invalide.'
          })
        ]
      }, message.guild.id);
    }

    if (amount > 50) {
      return reply(message, {
        embeds: [
          makeEmbed({
            color: DEFAULT_CONFIG.COLORS.ERROR,
            desc: '❌ Maximum 50 clones.'
          })
        ]
      }, message.guild.id);
    }

    for (let i = 0; i < amount; i++) {
      await channel.clone({
        reason: `Cloné par ${message.author.tag}`
      });
    }

    await reply(
      message,
      {
        embeds: [
          makeEmbed({
            color: '#7B1FA2',
            desc: `✅ ${amount} salon(s) cloné(s).`
          })
        ]
      },
      message.guild.id
    );
  }
});

cmd('renamechannel', {
  staffOnly: true,
  aliases  : ['chanrename', 'setchannel'],
  usage    : 'renamechannel [#salon] <nouveau-nom>',
  description: 'Renomme un salon.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const newName = args.filter(a => !a.startsWith('<#')).join('-').toLowerCase().replace(/\s+/g, '-');
    if (!newName) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un nouveau nom.' })] }, message.guild.id);
    const oldName = channel.name;
    await channel.setName(newName);
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `Salon renommé : **${oldName}** → **${newName}**` })] }, message.guild.id);
  }
});

cmd('delete', {
  staffOnly: true,
  cooldown: 0,
  usage: 'delete [#salon1 #salon2 ...]',
  description: 'Supprime un ou plusieurs salons.',
  category: '🔒 Salons',

  async execute(message, args, cfg) {

    const channels = message.mentions.channels.size
      ? message.mentions.channels
      : new Map([[message.channel.id, message.channel]]);

    if (!channels.size) {
      return reply(message, {
        embeds: [
          makeEmbed({
            color: DEFAULT_CONFIG.COLORS.ERROR,
            desc: '❌ Aucun salon trouvé.'
          })
        ]
      }, message.guild.id);
    }

    let deleted = 0;

    for (const channel of channels.values()) {
      try {
        await channel.delete(`Supprimé par ${message.author.tag}`);
        deleted++;

        // petit délai pour éviter rate limit
        await new Promise(r => setTimeout(r, 800));

      } catch (err) {
        console.error(`Erreur suppression salon ${channel.id}:`, err);
      }
    }

    return reply(message, {
      embeds: [
        makeEmbed({
          color: '#7B1FA2',
          desc: `${deleted} salon(s) supprimé(s).`
        })
      ]
    }, message.guild.id);
  }
});

cmd('topic', {
  staffOnly: true,
  usage    : 'topic [#salon] <nouveau topic>',
  description: 'Change le topic d\'un salon.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const topic   = args.filter(a => !a.startsWith('<#')).join(' ');
    if (!topic) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un topic.' })] }, message.guild.id);
    await channel.setTopic(topic);
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `Topic mis à jour dans ${channel}.` })] }, message.guild.id);
  }
});

cmd('setchannelemoji', {
  staffOnly: true,
  usage    : 'setchannelemoji [#salon] <emoji>',
  description: 'Définit l\'emoji NSFW d\'un salon (active/désactive le mode NSFW).',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const isNsfw  = !channel.nsfw;
    await channel.setNSFW(isNsfw);
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `${isNsfw ? '🔞' : '✅'} Mode NSFW **${isNsfw ? 'activé' : 'désactivé'}** pour ${channel}.` })] }, message.guild.id);
  }
});

cmd('createchannel', {
  staffOnly: true,
  aliases  : ['newchannel', 'addchannel'],
  usage    : 'createchannel <nom> [texte|vocal|catégorie]',
  description: 'Crée un nouveau salon.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const name = args[0];
    if (!name) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un nom.' })] }, message.guild.id);
    const typeArg = args[1]?.toLowerCase();
    let type = ChannelType.GuildText;
    if (typeArg === 'vocal' || typeArg === 'voice') type = ChannelType.GuildVoice;
    else if (typeArg === 'catégorie' || typeArg === 'category') type = ChannelType.GuildCategory;
    const ch = await message.guild.channels.create({ name, type, reason: `Créé par ${message.author.tag}` });
    await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `Salon créé : ${ch}` })] }, message.guild.id);
  }
});

cmd('deletechannel', {
  staffOnly: true,
  aliases  : ['delchannel', 'removechannel'],
  usage    : 'deletechannel [#salon] [raison]',
  description: 'Supprime un salon.',
  category : '🔒 Salons',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const reason  = args.filter(a => !a.startsWith('<#')).join(' ') || 'Aucune raison';
    const name    = channel.name;
    await channel.delete(reason);
    if (channel.id !== message.channel.id) {
      await reply(message, { embeds: [makeEmbed({ color: '#7B1FA2', desc: `Salon **${name}** supprimé.` })] }, message.guild.id);
    }
  }
});

cmd('lockreact', {
  staffOnly: true,
  aliases  : ['noreact', 'disableemojis'],
  usage    : 'lockreact [#salon...]',
  description: 'Désactive la possibilité de réagir aux messages dans un ou plusieurs salons.',
  category : '💬 Messages',
  async execute(message, args, cfg) {
    // Récupère les salons mentionnés, ou le salon actuel si aucun
    const channels = message.mentions.channels.size ? message.mentions.channels : [message.channel];

    const failed = [];
    const succeeded = [];

    for (const [, channel] of channels) {
      // Vérifie que c'est un TextChannel
      if (!channel.isTextBased()) continue;

      try {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
          AddReactions: false
        });
        succeeded.push(channel.name);
      } catch (err) {
        console.error(`Impossible de modifier les permissions dans ${channel.name}:`, err);
        failed.push(channel.name);
      }
    }

    // Message de confirmation
    let replyText = '';
    if (succeeded.length) replyText += `Réactions désactivées dans : ${succeeded.join(', ')}\n`;
    if (failed.length) replyText += `Impossible de modifier : ${failed.join(', ')}`;

    if (!replyText) replyText = '❌ Aucune modification effectuée.';
    await reply(message, replyText, message.guild.id);
  }
});

// ============================================================
// 8f. RÔLES
// ============================================================

cmd('role', {
  staffOnly: true,
  aliases  : ['giverole', 'addrole'],
  usage    : 'role <@membre|ID> <@rôle>',
  description: 'Ajoute un rôle à un membre.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    const role   = message.mentions.roles.first();
    if (!target || !role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un membre et un rôle.' })] }, message.guild.id);
    await target.roles.add(role);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** ajouté à **${target.user.tag}**.` })] }, message.guild.id);
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: '🎭 Rôle ajouté', fields: [{ name: 'Membre', value: target.user.tag, inline: true }, { name: 'Rôle', value: role.name, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }] }));
  }
});

cmd('removerole', {
  staffOnly: true,
  aliases  : ['delrole', 'takerole'],
  usage    : 'removerole <@membre|ID> <@rôle>',
  description: 'Retire un rôle à un membre.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    const role   = message.mentions.roles.first();
    if (!target || !role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un membre et un rôle.' })] }, message.guild.id);
    await target.roles.remove(role);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** retiré de **${target.user.tag}**.` })] }, message.guild.id);
  }
});

cmd('roleall', {
  staffOnly: true,
  aliases  : ['massrole', 'giveroleall'],
  usage    : 'roleall <@rôle> [--bots|--humans]',
  description: 'Donne un rôle à tous les membres.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    const filter = args.includes('--bots') ? m => m.user.bot : args.includes('--humans') ? m => !m.user.bot : () => true;
    const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `⏳ Attribution du rôle **${role.name}** en cours...` })] }, message.guild.id);
    await message.guild.members.fetch();
    const members = [...message.guild.members.cache.values()].filter(filter);
    let count = 0;
    for (const member of members) {
      try { await member.roles.add(role); count++; await new Promise(r => setTimeout(r, 300)); } catch {}
    }
    if (m) m.edit({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** attribué à **${count}** membre(s).` })] });
  }
});

cmd('removeroleall', {
  staffOnly: true,
  aliases  : ['massremoverole'],
  usage    : 'removeroleall <@rôle>',
  description: 'Retire un rôle à tous les membres qui l\'ont.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `⏳ Retrait du rôle **${role.name}** en cours...` })] }, message.guild.id);
    await message.guild.members.fetch();
    const members = [...message.guild.members.cache.values()].filter(mb => mb.roles.cache.has(role.id));
    let count = 0;
    for (const member of members) {
      try { await member.roles.remove(role); count++; await new Promise(r => setTimeout(r, 300)); } catch {}
    }
    if (m) m.edit({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** retiré de **${count}** membre(s).` })] });
  }
});

cmd('createrole', {
  staffOnly: true,
  aliases  : ['newrole', 'addrole2'],
  usage    : 'createrole <nom> [#couleur]',
  description: 'Crée un nouveau rôle.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const name  = args[0];
    const color = args[1]?.startsWith('#') ? args[1] : null;
    if (!name) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un nom de rôle.' })] }, message.guild.id);
    const role  = await message.guild.roles.create({ name, color: color || null, reason: `Créé par ${message.author.tag}` });
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** créé.` })] }, message.guild.id);
  }
});

cmd('deleterole', {
  staffOnly: true,
  aliases  : ['remrole', 'deletethisrole'],
  usage    : 'deleterole <@rôle>',
  description: 'Supprime un rôle.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    const name = role.name;
    await role.delete(`Supprimé par ${message.author.tag}`);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🗑️ Rôle **${name}** supprimé.` })] }, message.guild.id);
  }
});

cmd('rolecolor', {
  staffOnly: true,
  aliases  : ['colorrole'],
  usage    : 'rolecolor <@rôle> <#couleur>',
  description: 'Change la couleur d\'un rôle.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const role  = message.mentions.roles.first();
    const color = args[1];
    if (!role || !color) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle et une couleur hex.' })] }, message.guild.id);
    await role.setColor(color);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🎨 Couleur de **${role.name}** changée en \`${color}\`.` })] }, message.guild.id);
  }
});

cmd('rolename', {
  staffOnly: true,
  aliases  : ['renamerole'],
  usage    : 'rolename <@rôle> <nouveau nom>',
  description: 'Renomme un rôle.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const role    = message.mentions.roles.first();
    const newName = args.slice(1).join(' ');
    if (!role || !newName) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle et un nouveau nom.' })] }, message.guild.id);
    const old = role.name;
    await role.setName(newName);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle renommé : **${old}** → **${newName}**` })] }, message.guild.id);
  }
});

cmd('hoist', {
  staffOnly: true,
  usage    : 'hoist <@rôle>',
  description: 'Toggle l\'affichage séparé d\'un rôle dans la liste des membres.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    await role.setHoist(!role.hoist);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** : affichage séparé ${role.hoist ? 'désactivé' : 'activé'}.` })] }, message.guild.id);
  }
});

cmd('mentionable', {
  staffOnly: true,
  usage    : 'mentionable <@rôle>',
  description: 'Toggle la mentionnabilité d\'un rôle.',
  category : '🎭 Rôles',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    await role.setMentionable(!role.mentionable);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** : mentionnable ${role.mentionable ? 'désactivé' : 'activé'}.` })] }, message.guild.id);
  }
});

// ============================================================
// 8g. SURNOM / MEMBRE
// ============================================================

cmd('nick', {
  staffOnly: true,
  aliases  : ['nickname', 'setnick'],
  usage    : 'nick <@membre|ID> [surnom] (vide = réinitialiser)',
  description: 'Change le surnom d\'un membre.',
  category : '👤 Membres',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const nick = args.slice(1).join(' ') || null;
    await target.setNickname(nick, `Par ${message.author.tag}`);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: nick ? `✅ Surnom de **${target.user.tag}** changé en **${nick}**.` : `✅ Surnom de **${target.user.tag}** réinitialisé.` })] }, message.guild.id);
  }
});

cmd('massnick', {
  staffOnly: true,
  aliases  : ['nickall'],
  usage    : 'massnick <surnom> (vide = réinitialiser)',
  description: 'Change le surnom de tous les membres.',
  category : '👤 Membres',
  async execute(message, args, cfg) {
    const nick = args.join(' ') || null;
    const m    = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `⏳ Changement des surnoms en cours...` })] }, message.guild.id);
    await message.guild.members.fetch();
    let count = 0;
    for (const [, member] of message.guild.members.cache) {
      if (member.id === message.guild.ownerId || member.user.bot) continue;
      try { await member.setNickname(nick); count++; await new Promise(r => setTimeout(r, 300)); } catch {}
    }
    if (m) m.edit({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Surnoms modifiés pour **${count}** membre(s).` })] });
  }
});

cmd('note', {
  staffOnly: true,
  aliases  : ['addnote'],
  usage    : 'note <@membre|ID> <note>',
  description: 'Ajoute une note privée à un membre (staff seulement).',
  category : '👤 Membres',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const userId = target.id || target.user?.id;
    const note   = args.slice(1).join(' ');
    if (!note) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez une note.' })] }, message.guild.id);
    addNote(message.guild.id, userId, note, message.author.tag);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `📝 Note ajoutée pour **${target.user?.tag}**.` })] }, message.guild.id);
  }
});

cmd('notes', {
  staffOnly: true,
  aliases  : ['viewnotes'],
  usage    : 'notes <@membre|ID>',
  description: 'Affiche les notes d\'un membre.',
  category : '👤 Membres',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const userId = target.id || target.user?.id;
    const notes  = getNotes(message.guild.id, userId);
    if (!notes.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `📭 Aucune note pour **${target.user?.tag}**.` })] }, message.guild.id);
    const fields = notes.map((n, i) => ({
      name : `#${i + 1} — ${new Date(n.date).toLocaleDateString('fr-FR')}`,
      value: `${n.note}\n— par ${n.mod}`,
    }));
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: `📝 Notes de ${target.user?.tag}`, fields })] }, message.guild.id);
  }
});

cmd('clearnotes', {
  staffOnly: true,
  usage    : 'clearnotes <@membre|ID>',
  description: 'Supprime toutes les notes d\'un membre.',
  category : '👤 Membres',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    clearNotes(message.guild.id, target.id || target.user?.id);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Notes de **${target.user?.tag}** supprimées.` })] }, message.guild.id);
  }
});

// ============================================================
// 8h. INFOS
// ============================================================

cmd('userinfo', {
  aliases : ['ui', 'whois'],
  usage   : 'userinfo [@membre|ID]',
  description: 'Affiche les informations d\'un membre.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || (args[0] ? await resolveUser(message.guild, args[0]) : null) || message.member;
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const user   = target.user || target;
    const member = target.roles ? target : null;
    const warns  = getWarns(message.guild.id, user.id).length;
    const notes  = getNotes(message.guild.id, user.id).length;
    const cases  = getCases(message.guild.id, user.id).length;
    const roles  = member ? [...member.roles.cache.values()].filter(r => r.id !== message.guild.roles.everyone.id).map(r => `<@&${r.id}>`).join(', ') || 'Aucun' : 'N/A';
    const fields = [
      { name: 'ID',              value: user.id,                                                         inline: true },
      { name: 'Tag',             value: user.tag,                                                         inline: true },
      { name: 'Surnom',          value: member?.displayName || 'Aucun',                                   inline: true },
      { name: 'Compte créé le',  value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`,              inline: true },
      { name: 'Rejoint le',      value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'N/A', inline: true },
      { name: 'Bot',             value: user.bot ? '✅ Oui' : '❌ Non',                                    inline: true },
      { name: '⚠️ Warns',         value: `${warns}`,                                                       inline: true },
      { name: '📋 Cas totaux',    value: `${cases}`,                                                       inline: true },
      { name: '📝 Notes',         value: `${notes}`,                                                       inline: true },
      { name: 'Rôles',           value: roles.slice(0, 1024) },
    ];
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `👤 ${user.tag}`, thumb: user.displayAvatarURL({ dynamic: true }), fields })] }, message.guild.id);
  }
});

cmd('serverinfo', {
  aliases : ['si', 'guildinfo'],
  usage   : 'serverinfo',
  description: 'Affiche les informations du serveur.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const g = message.guild;
    await g.fetch();
    const textChannels  = g.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = g.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories    = g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const bots          = [...g.members.cache.values()].filter(m => m.user.bot).length;
    await reply(message, { embeds: [makeEmbed({
      color : DEFAULT_CONFIG.COLORS.PRIMARY,
      title : `🏠 ${g.name}`,
      thumb : g.iconURL({ dynamic: true }),
      fields: [
        { name: 'ID',              value: g.id,                                                  inline: true },
        { name: 'Propriétaire',    value: `<@${g.ownerId}>`,                                     inline: true },
        { name: 'Membres',         value: `${g.memberCount}`,                                    inline: true },
        { name: 'Bots',            value: `${bots}`,                                             inline: true },
        { name: 'Rôles',           value: `${g.roles.cache.size}`,                               inline: true },
        { name: 'Boosts',          value: `${g.premiumSubscriptionCount}`,                       inline: true },
        { name: 'Salons texte',    value: `${textChannels}`,                                     inline: true },
        { name: 'Salons vocaux',   value: `${voiceChannels}`,                                    inline: true },
        { name: 'Catégories',      value: `${categories}`,                                       inline: true },
        { name: 'Vérification',    value: g.verificationLevel.toString(),                        inline: true },
        { name: 'Créé le',         value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`,      inline: true },
        { name: 'Niveau Boost',    value: `Niveau ${g.premiumTier}`,                             inline: true },
      ],
    })] }, message.guild.id);
  }
});

cmd('avatar', {
  aliases : ['av', 'pfp'],
  usage   : 'avatar [@membre|ID]',
  description: 'Affiche l\'avatar d\'un membre.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const target = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null) || message.author;
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Utilisateur introuvable.' })] }, message.guild.id);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `🖼️ Avatar de ${target.tag}`, image: target.displayAvatarURL({ dynamic: true, size: 1024 }) })] }, message.guild.id);
  }
});

cmd('banner', {
  aliases : ['userbanner'],
  usage   : 'banner [@membre|ID]',
  description: 'Affiche la bannière de profil d\'un membre.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const userId = (message.mentions.users.first()?.id) || args[0]?.replace(/[<@!>]/g, '') || message.author.id;
    try {
      const user = await client.users.fetch(userId, { force: true });
      if (!user.bannerURL()) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: '❌ Cet utilisateur n\'a pas de bannière.' })] }, message.guild.id);
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `🖼️ Bannière de ${user.tag}`, image: user.bannerURL({ dynamic: true, size: 1024 }) })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Utilisateur introuvable.' })] }, message.guild.id); }
  }
});

cmd('roleinfo', {
  aliases : ['ri'],
  usage   : 'roleinfo <@rôle>',
  description: 'Affiche les informations d\'un rôle.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    await reply(message, { embeds: [makeEmbed({
      color : role.color || DEFAULT_CONFIG.COLORS.PRIMARY,
      title : `🎭 ${role.name}`,
      fields: [
        { name: 'ID',            value: role.id,                                                 inline: true },
        { name: 'Couleur',       value: role.hexColor,                                           inline: true },
        { name: 'Membres',       value: `${role.members.size}`,                                  inline: true },
        { name: 'Mentionnable',  value: role.mentionable ? '✅ Oui' : '❌ Non',                  inline: true },
        { name: 'Affiché',       value: role.hoist ? '✅ Oui' : '❌ Non',                         inline: true },
        { name: 'Géré',          value: role.managed ? '✅ Oui' : '❌ Non',                       inline: true },
        { name: 'Position',      value: `${role.position}`,                                      inline: true },
        { name: 'Créé le',       value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`,     inline: true },
        { name: 'Permissions',   value: role.permissions.toArray().join(', ').slice(0, 1024) || 'Aucune' },
      ],
    })] }, message.guild.id);
  }
});

cmd('ping', {
  usage   : 'ping',
  description: 'Affiche la latence du bot.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const sent  = await message.channel.send('⏳ Calcul...');
    const diff  = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit({ content: null, embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: '🏓 Pong!', fields: [{ name: 'Latence', value: `${diff}ms`, inline: true }, { name: 'WebSocket', value: `${client.ws.ping}ms`, inline: true }] })] });
  }
});

cmd('botinfo', {
  aliases : ['bi', 'info'],
  usage   : 'botinfo',
  description: 'Informations sur le bot.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const uptime = formatDuration(client.uptime);
    const mem    = process.memoryUsage().heapUsed / 1024 / 1024;
    await reply(message, { embeds: [makeEmbed({
      color : DEFAULT_CONFIG.COLORS.PRIMARY,
      title : `🤖 ${client.user.tag}`,
      thumb : client.user.displayAvatarURL(),
      fields: [
        { name: 'Uptime',       value: uptime,                           inline: true },
        { name: 'Serveurs',     value: `${client.guilds.cache.size}`,    inline: true },
        { name: 'Utilisateurs', value: `${client.users.cache.size}`,     inline: true },
        { name: 'Commandes',    value: `${Object.keys(COMMANDS).length}`, inline: true },
        { name: 'RAM',          value: `${mem.toFixed(1)} MB`,           inline: true },
        { name: 'Node.js',      value: process.version,                  inline: true },
        { name: 'Préfixe',      value: cfg.PREFIX,                       inline: true },
        { name: 'Latence',      value: `${client.ws.ping}ms`,            inline: true },
      ],
    })] }, message.guild.id);
  }
});

cmd('membercount', {
  aliases : ['mc', 'members'],
  usage   : 'membercount',
  description: 'Affiche le nombre de membres.',
  category: 'ℹ️ Infos',
  async execute(message, args, cfg) {
    await message.guild.members.fetch();
    const bots    = [...message.guild.members.cache.values()].filter(m => m.user.bot).length;
    const humans  = message.guild.memberCount - bots;
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: '👥 Compteur de membres', fields: [{ name: 'Total', value: `${message.guild.memberCount}`, inline: true }, { name: 'Humains', value: `${humans}`, inline: true }, { name: 'Bots', value: `${bots}`, inline: true }] })] }, message.guild.id);
  }
});

cmd('permissions', {
  staffOnly: true,
  aliases  : ['perms'],
  usage    : 'permissions [@membre|ID] [#salon]',
  description: 'Affiche les permissions d\'un membre dans un salon.',
  category : 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const target  = message.mentions.members.first() || message.member;
    const channel = message.mentions.channels.first() || message.channel;
    const perms   = target.permissionsIn(channel).toArray();
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `🔑 Permissions de ${target.user.tag}`, desc: `Dans ${channel}\n\n${perms.join(', ') || 'Aucune'}` })] }, message.guild.id);
  }
});

cmd('inviteinfo', {
  staffOnly: true,
  aliases  : ['invite'],
  usage    : 'inviteinfo <code>',
  description: 'Affiche les infos d\'une invitation Discord.',
  category : 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const code = args[0]?.replace('discord.gg/', '');
    if (!code) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un code d\'invitation.' })] }, message.guild.id);
    try {
      const inv = await client.fetchInvite(code);
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: `🔗 Invitation ${code}`, fields: [{ name: 'Serveur', value: inv.guild?.name || 'N/A', inline: true }, { name: 'Membres', value: `${inv.memberCount || 0}`, inline: true }, { name: 'Créé par', value: inv.inviter?.tag || 'N/A', inline: true }, { name: 'Expire', value: inv.expiresAt ? `<t:${Math.floor(inv.expiresAt.getTime() / 1000)}:R>` : 'Jamais', inline: true }] })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Invitation invalide ou expirée.' })] }, message.guild.id); }
  }
});

cmd('listbans', {
  staffOnly: true,
  aliases  : ['bans'],
  usage    : 'listbans [page]',
  description: 'Liste les membres bannis.',
  category : 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const bans = await message.guild.bans.fetch();
    if (!bans.size) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Aucun membre banni.' })] }, message.guild.id);
    const page = parseInt(args[0]) - 1 || 0;
    const { items, totalPages } = paginate([...bans.values()], page, 10);
    const fields = items.map(b => ({ name: b.user.tag, value: `ID: ${b.user.id} | Raison: ${b.reason || 'N/A'}` }));
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: `🔨 Membres bannis (${bans.size} total)`, fields, footer: `Page ${page + 1}/${totalPages}` })] }, message.guild.id);
  }
});

cmd('listmutes', {
  staffOnly: true,
  aliases  : ['mutes'],
  usage    : 'listmutes',
  description: 'Liste les membres mutés (via tempmute).',
  category : 'ℹ️ Infos',
  async execute(message, args, cfg) {
    const mutes = getTempMutes(message.guild.id);
    const entries = Object.entries(mutes);
    if (!entries.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Aucun membre muté.' })] }, message.guild.id);
    const fields = entries.map(([userId, data]) => ({
      name : `ID: ${userId}`,
      value: `Raison: ${data.reason} | Mod: ${data.mod} | Expire: ${data.until ? `<t:${Math.floor(data.until / 1000)}:R>` : 'Jamais'}`,
    }));
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, title: '🔇 Membres mutés', fields })] }, message.guild.id);
  }
});

// ============================================================
// 8i. CAS MODÉRATION (historique)
// ============================================================

cmd('case', {
  staffOnly: true,
  aliases  : ['modcase'],
  usage    : 'case <numéro>',
  description: 'Affiche un cas de modération.',
  category : '📋 Cas',
  async execute(message, args, cfg) {
    const caseId = args[0];
    if (!caseId) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un numéro de cas.' })] }, message.guild.id);
    const c = getCase(message.guild.id, caseId);
    if (!c) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Cas #${caseId} introuvable.` })] }, message.guild.id);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `📋 Cas #${c.id} — ${c.type}`, fields: [{ name: 'Utilisateur', value: `${c.userTag} (${c.userId})`, inline: true }, { name: 'Modérateur', value: `${c.modTag}`, inline: true }, { name: 'Date', value: `<t:${Math.floor(new Date(c.date).getTime() / 1000)}:D>`, inline: true }, { name: 'Raison', value: c.reason }] })] }, message.guild.id);
  }
});

cmd('modlog', {
  staffOnly: true,
  aliases  : ['history', 'modhistory'],
  usage    : 'modlog <@membre|ID> [page]',
  description: 'Affiche l\'historique de modération d\'un membre.',
  category : '📋 Cas',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const userId = target.id || target.user?.id;
    const page   = parseInt(args[1]) - 1 || 0;
    const allCases = getCases(message.guild.id, userId);
    if (!allCases.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Aucun cas pour **${target.user?.tag}**.` })] }, message.guild.id);
    const { items, totalPages } = paginate(allCases, page, 5);
    const fields = items.map(c => ({
      name : `#${c.id} — ${c.type} | <t:${Math.floor(new Date(c.date).getTime() / 1000)}:D>`,
      value: `Raison: ${c.reason}\nMod: ${c.modTag}`,
    }));
    const embed = makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `📋 Historique de ${target.user?.tag} (${allCases.length} cas)`, fields, footer: `Page ${page + 1}/${totalPages} — Utilisez ${cfg.PREFIX}modlog @membre <page>` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`modcase_prev_${userId}_${page}`).setLabel('◀️ Préc.').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(`modcase_next_${userId}_${page}`).setLabel('Suiv. ▶️').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
    );
    await reply(message, { embeds: [embed], components: totalPages > 1 ? [row] : [] }, message.guild.id);
  }
});

async function handleCasePagination(interaction) {
  const parts  = interaction.customId.split('_');
  const dir    = parts[1];
  const userId = parts[2];
  const curPage = parseInt(parts[3]);
  const newPage = dir === 'next' ? curPage + 1 : curPage - 1;
  const cfg     = getGuildConfig(interaction.guild.id);
  const allCases = getCases(interaction.guild.id, userId);
  const { items, totalPages } = paginate(allCases, newPage, 5);
  const user   = await client.users.fetch(userId).catch(() => ({ tag: userId }));
  const fields = items.map(c => ({
    name : `#${c.id} — ${c.type} | <t:${Math.floor(new Date(c.date).getTime() / 1000)}:D>`,
    value: `Raison: ${c.reason}\nMod: ${c.modTag}`,
  }));
  const embed = makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `📋 Historique de ${user.tag} (${allCases.length} cas)`, fields, footer: `Page ${newPage + 1}/${totalPages}` });
  const row   = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`modcase_prev_${userId}_${newPage}`).setLabel('◀️ Préc.').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 0),
    new ButtonBuilder().setCustomId(`modcase_next_${userId}_${newPage}`).setLabel('Suiv. ▶️').setStyle(ButtonStyle.Primary).setDisabled(newPage >= totalPages - 1),
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

cmd('clearcase', {
  ownerOnly: true,
  usage    : 'clearcase <@membre|ID>',
  description: 'Supprime l\'historique de cas d\'un membre.',
  category : '📋 Cas',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const userId = target.id || target.user?.id;
    if (DATA.cases[message.guild.id]) {
      DATA.cases[message.guild.id] = DATA.cases[message.guild.id].filter(c => c.userId !== userId);
      saveData();
    }
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Cas de **${target.user?.tag}** supprimés.` })] }, message.guild.id);
  }
});

cmd('editcase', {
  staffOnly: true,
  usage    : 'editcase <numéro> <nouvelle raison>',
  description: 'Modifie la raison d\'un cas.',
  category : '📋 Cas',
  async execute(message, args, cfg) {
    const caseId = parseInt(args[0]);
    const reason = args.slice(1).join(' ');
    if (!caseId || !reason) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `editcase <numéro> <raison>`' })] }, message.guild.id);
    const c = getCase(message.guild.id, caseId);
    if (!c) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Cas #${caseId} introuvable.` })] }, message.guild.id);
    c.reason = reason;
    saveData();
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Cas #${caseId} mis à jour.` })] }, message.guild.id);
  }
});

// ============================================================
// 8j. MODÉRATION AVANCÉE
// ============================================================

cmd('massban', {
  ownerOnly: true,
  aliases  : ['banmass'],
  usage    : 'massban <ID1> <ID2> <ID3> ... [--reason <raison>]',
  description: 'Bannit plusieurs utilisateurs par ID en même temps.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const reasonIndex = args.indexOf('--reason');
    const reason      = reasonIndex !== -1 ? args.slice(reasonIndex + 1).join(' ') : 'Massban';
    const ids         = (reasonIndex !== -1 ? args.slice(0, reasonIndex) : args).filter(a => /^\d{17,20}$/.test(a));
    if (!ids.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez des IDs valides.' })] }, message.guild.id);
    const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `⏳ Bannissement de **${ids.length}** utilisateur(s)...` })] }, message.guild.id);
    let success = 0, failed = 0;
    for (const id of ids) {
      try { await message.guild.members.ban(id, { reason }); success++; addCase(message.guild.id, 'MASSBAN', id, id, message.author.id, message.author.tag, reason); } catch { failed++; }
      await new Promise(r => setTimeout(r, 500));
    }
    if (m) m.edit({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: '🔨 Massban terminé', fields: [{ name: '✅ Réussis', value: `${success}`, inline: true }, { name: '❌ Échoués', value: `${failed}`, inline: true }, { name: 'Raison', value: reason }] })] });
    await sendLog(message.guild, makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: '🔨 Massban', fields: [{ name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'IDs', value: ids.join(', ').slice(0, 1024) }, { name: 'Raison', value: reason }] }));
  }
});

cmd('masskick', {
  ownerOnly: true,
  usage    : 'masskick <@m1> <@m2> ... [--reason <raison>]',
  description: 'Expulse plusieurs membres en même temps.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const reasonIndex = args.indexOf('--reason');
    const reason      = reasonIndex !== -1 ? args.slice(reasonIndex + 1).join(' ') : 'Masskick';
    const members     = [...message.mentions.members.values()];
    if (!members.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez des membres.' })] }, message.guild.id);
    const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `⏳ Expulsion de **${members.length}** membre(s)...` })] }, message.guild.id);
    let success = 0, failed = 0;
    for (const member of members) {
      try { await member.kick(reason); success++; } catch { failed++; }
      await new Promise(r => setTimeout(r, 300));
    }
    if (m) m.edit({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: 'Masskick terminé', fields: [{ name: '✅ Réussis', value: `${success}`, inline: true }, { name: '❌ Échoués', value: `${failed}`, inline: true }] })] });
  }
});

cmd('massmute', {
  staffOnly: true,
  usage    : 'massmute <@m1> <@m2> ... [durée]',
  description: 'Mute plusieurs membres en même temps.',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const members  = [...message.mentions.members.values()];
    const duration = parseDuration(args.find(a => /^\d+[smhd]$/i.test(a)));
    if (!members.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez des membres.' })] }, message.guild.id);
    const muteRoleId = getMuteRole(message.guild.id);
    const muteRole   = muteRoleId ? message.guild.roles.cache.get(muteRoleId) : message.guild.roles.cache.find(r => r.name === (cfg.MUTED_ROLE || DEFAULT_CONFIG.MUTED_ROLE));
    if (!muteRole) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Rôle Muted introuvable.' })] }, message.guild.id);
    let success = 0;
    for (const member of members) {
      try {
        await member.roles.add(muteRole);
        if (duration) setTimeout(() => member.roles.remove(muteRole).catch(() => {}), duration);
        success++;
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, desc: `🔇 **${success}** membre(s) muté(s)${duration ? ` pour ${formatDuration(duration)}` : ''}.` })] }, message.guild.id);
  }
});

cmd('massunmute', {
  staffOnly: true,
  usage    : 'massunmute <@m1> <@m2> ...',
  description: 'Unmute plusieurs membres en même temps.',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const members    = [...message.mentions.members.values()];
    const muteRoleId = getMuteRole(message.guild.id);
    const muteRole   = muteRoleId ? message.guild.roles.cache.get(muteRoleId) : message.guild.roles.cache.find(r => r.name === (cfg.MUTED_ROLE || DEFAULT_CONFIG.MUTED_ROLE));
    if (!muteRole) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Rôle Muted introuvable.' })] }, message.guild.id);
    let success = 0;
    for (const member of members) {
      try { await member.roles.remove(muteRole); success++; } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🔊 **${success}** membre(s) unmuté(s).` })] }, message.guild.id);
  }
});

cmd('masstimeout', {
  staffOnly: true,
  usage    : 'masstimeout <@m1> <@m2> ... <durée>',
  description: 'Timeout natif pour plusieurs membres.',
  category : '🔇 Mute',
  async execute(message, args, cfg) {
    const members    = [...message.mentions.members.values()];
    const durationMs = parseDuration(args.find(a => /^\d+[smhd]$/i.test(a)));
    if (!members.length || !durationMs) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez des membres et une durée.' })] }, message.guild.id);
    let success = 0;
    for (const member of members) {
      try { await member.timeout(durationMs); success++; } catch {}
    }
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.NEUTRAL, desc: `⏰ **${success}** membre(s) mis en timeout pour **${formatDuration(durationMs)}**.` })] }, message.guild.id);
  }
});

cmd('unbanall', {
  ownerOnly: true,
  usage    : 'unbanall',
  description: 'Débannit tous les membres bannis.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const bans = await message.guild.bans.fetch();
    if (!bans.size) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: '✅ Aucun membre banni.' })] }, message.guild.id);
    const m = await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `⏳ Débannissement de **${bans.size}** utilisateur(s)...` })] }, message.guild.id);
    let success = 0;
    for (const [userId] of bans) {
      try { await message.guild.members.unban(userId); success++; await new Promise(r => setTimeout(r, 500)); } catch {}
    }
    if (m) m.edit({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ **${success}** membre(s) débanni(s).` })] });
  }
});

cmd('checkban', {
  staffOnly: true,
  usage    : 'checkban <userID>',
  description: 'Vérifie si un utilisateur est banni.',
  category : '🔨 Modération',
  async execute(message, args, cfg) {
    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un ID.' })] }, message.guild.id);
    try {
      const ban = await message.guild.bans.fetch(userId);
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, title: '🔨 Utilisateur banni', fields: [{ name: 'Tag', value: ban.user.tag, inline: true }, { name: 'ID', value: ban.user.id, inline: true }, { name: 'Raison', value: ban.reason || 'Non spécifiée' }] })] }, message.guild.id);
    } catch {
      reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Cet utilisateur n\'est pas banni.' })] }, message.guild.id);
    }
  }
});

// ============================================================
// 8k. ANTI-SYSTÈMES (commandes de config)
// ============================================================

function makeAntiCmd(key, label) {
  cmd(`anti${key.toLowerCase()}`, {
    staffOnly: true,
    usage    : `anti${key.toLowerCase()} <on|off>`,
    description: `Active/désactive l'anti-${label}.`,
    category : '🛡️ Anti-Systèmes',
    async execute(message, args, cfg) {
      const state = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(state)) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Usage : \`anti${key.toLowerCase()} <on|off>\`` })] }, message.guild.id);
      const value = state === 'on';
      setAnti(message.guild.id, key.toUpperCase(), value);
      await reply(message, { embeds: [makeEmbed({ color: value ? DEFAULT_CONFIG.COLORS.SUCCESS : DEFAULT_CONFIG.COLORS.NEUTRAL, desc: `🛡️ Anti-**${label}** **${value ? 'activé ✅' : 'désactivé ❌'}**.` })] }, message.guild.id);
    }
  });
}

makeAntiCmd('link',    'lien');
makeAntiCmd('spam',    'spam');
makeAntiCmd('invite',  'invitation');
makeAntiCmd('bot',     'bot');
makeAntiCmd('raid',    'raid');
makeAntiCmd('caps',    'majuscules');
makeAntiCmd('mention', 'mass-mention');
makeAntiCmd('zalgo',   'zalgo');
makeAntiCmd('flood',   'flood');

cmd('antistatus', {
  staffOnly: true,
  aliases  : ['anticonfig', 'antisettings'],
  usage    : 'antistatus',
  description: 'Affiche l\'état de tous les systèmes anti.',
  category : '🛡️ Anti-Systèmes',
  async execute(message, args, cfg) {
    const anti   = getAnti(message.guild.id);
    const status = (key) => anti[key] ? '✅ ON' : '❌ OFF';
    await reply(message, { embeds: [makeEmbed({
      color : DEFAULT_CONFIG.COLORS.PRIMARY,
      title : '🛡️ État des anti-systèmes',
      fields: [
        { name: '🔗 Anti-Lien',        value: status('LINK'),    inline: true },
        { name: '💬 Anti-Spam',        value: status('SPAM'),    inline: true },
        { name: '📨 Anti-Invitation',  value: status('INVITE'),  inline: true },
        { name: '🤖 Anti-Bot',         value: status('BOT'),     inline: true },
        { name: '🚨 Anti-Raid',        value: status('RAID'),    inline: true },
        { name: '🔠 Anti-Caps',        value: status('CAPS'),    inline: true },
        { name: '📢 Anti-Mention',     value: status('MENTION'), inline: true },
        { name: '👹 Anti-Zalgo',       value: status('ZALGO'),   inline: true },
        { name: '🌊 Anti-Flood',       value: status('FLOOD'),   inline: true },
      ],
    })] }, message.guild.id);
  }
});

cmd('blacklist', {
  staffOnly: true,
  aliases  : ['blacklistword', 'badword'],
  usage    : 'blacklist <add|remove|list> [mot]',
  description: 'Gère la blacklist de mots interdits.',
  category : '🛡️ Anti-Systèmes',
  async execute(message, args, cfg) {
    const action = args[0]?.toLowerCase();
    const word   = args[1]?.toLowerCase();
    if (action === 'add') {
      if (!word) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un mot.' })] }, message.guild.id);
      const ok = addBlacklistWord(message.guild.id, word);
      return reply(message, { embeds: [makeEmbed({ color: ok ? DEFAULT_CONFIG.COLORS.SUCCESS : DEFAULT_CONFIG.COLORS.WARNING, desc: ok ? `✅ Mot \`${word}\` ajouté à la blacklist.` : `⚠️ Ce mot est déjà dans la blacklist.` })] }, message.guild.id);
    }
    if (action === 'remove' || action === 'del') {
      if (!word) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un mot.' })] }, message.guild.id);
      const ok = removeBlacklistWord(message.guild.id, word);
      return reply(message, { embeds: [makeEmbed({ color: ok ? DEFAULT_CONFIG.COLORS.SUCCESS : DEFAULT_CONFIG.COLORS.DANGER, desc: ok ? `✅ Mot \`${word}\` retiré de la blacklist.` : `❌ Ce mot n'est pas dans la blacklist.` })] }, message.guild.id);
    }
    if (action === 'list' || action === 'show') {
      const words = getBlacklistWords(message.guild.id);
      if (!words.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: '📃 La blacklist est vide.' })] }, message.guild.id);
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.WARNING, title: `🚫 Blacklist (${words.length} mots)`, desc: words.map(w => `\`${w}\``).join(', ') })] }, message.guild.id);
    }
    if (action === 'clear') {
      DATA.blacklistWords[message.guild.id] = [];
      saveData();
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Blacklist vidée.' })] }, message.guild.id);
    }
    reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Usage : \`${cfg.PREFIX}blacklist <add|remove|list|clear> [mot]\`` })] }, message.guild.id);
  }
});

cmd('whitelist', {
  staffOnly: true,
  aliases  : ['whitelistrole'],
  usage    : 'whitelist <add|remove|list> <role|channel> <@rôle|#salon>',
  description: 'Gère la whitelist (rôles/salons exempts des anti-systèmes).',
  category : '🛡️ Anti-Systèmes',
  async execute(message, args, cfg) {
    const action = args[0]?.toLowerCase();
    const type   = args[1]?.toLowerCase();
    if (!['add', 'remove', 'list'].includes(action) || !['role', 'channel'].includes(type)) {
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Usage : \`${cfg.PREFIX}whitelist <add|remove|list> <role|channel> [@rôle|#salon]\`` })] }, message.guild.id);
    }
    if (type === 'role') {
      const role = message.mentions.roles.first();
      if (action === 'list') {
        const wl = getWhitelistRoles(message.guild.id);
        return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: '✅ Rôles whitelistés', desc: wl.map(id => `<@&${id}>`).join(', ') || 'Aucun' })] }, message.guild.id);
      }
      if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
      if (action === 'add') {
        addWhitelistRole(message.guild.id, role.id);
        return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** ajouté à la whitelist.` })] }, message.guild.id);
      }
      if (action === 'remove') {
        removeWhitelistRole(message.guild.id, role.id);
        return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** retiré de la whitelist.` })] }, message.guild.id);
      }
    }
    if (type === 'channel') {
      const ch = message.mentions.channels.first();
      if (action === 'list') {
        const wl = getWhitelistChannels(message.guild.id);
        return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: '✅ Salons whitelistés', desc: wl.map(id => `<#${id}>`).join(', ') || 'Aucun' })] }, message.guild.id);
      }
      if (!ch) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un salon.' })] }, message.guild.id);
      if (action === 'add') {
        addWhitelistChannel(message.guild.id, ch.id);
        return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Salon **${ch.name}** ajouté à la whitelist.` })] }, message.guild.id);
      }
      if (action === 'remove') {
        removeWhitelistChannel(message.guild.id, ch.id);
        return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Salon **${ch.name}** retiré de la whitelist.` })] }, message.guild.id);
      }
    }
  }
});

// ============================================================
// 8l. CONFIGURATION DU BOT (via Discord !)
// ============================================================

const pendingConfigModals = new Map();

cmd('config', {
  ownerOnly: true,
  aliases  : ['settings', 'botconfig', 'configure'],
  usage    : 'config',
  description: 'Ouvre le panneau de configuration du bot via un formulaire Discord.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_botconfig_modal').setLabel('⚙️ Configurer le bot').setStyle(ButtonStyle.Secondary)
    );
    const prompt = await message.channel.send({
      embeds: [makeEmbed({
        color : DEFAULT_CONFIG.COLORS.PRIMARY,
        title : '⚙️ Configuration du bot',
        desc  : `${message.author}, clique sur le bouton pour configurer le bot sur ce serveur.\n\n**Paramètres configurables :**\n• Préfixe\n• Rôle Muted\n• Salon de logs\n• Suppression des messages du bot\n• Suppression des messages de commande`,
      })],
      components: [row],
    });
    const filter    = i => i.customId === 'open_botconfig_modal' && i.user.id === message.author.id;
    const collector = prompt.createMessageComponentCollector({ filter, time: 60000, max: 1 });
    collector.on('collect', async interaction => {
      const currentCfg = getGuildConfig(message.guild.id);
      const modal = new ModalBuilder().setCustomId('botconfig_modal').setTitle('Configuration du bot');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cfg_prefix').setLabel('Préfixe de commande').setStyle(TextInputStyle.Short).setRequired(true).setValue(currentCfg.PREFIX || '-').setMaxLength(5)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cfg_log_channel').setLabel('Nom du salon de logs').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentCfg.LOG_CHANNEL_NAME || 'logs-modération').setMaxLength(100)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cfg_muted_role').setLabel('Nom du rôle Muted').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentCfg.MUTED_ROLE || 'Muted').setMaxLength(100)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cfg_bot_delete').setLabel('Supprimer réponses bot? (on/off/5s/30s)').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentCfg.BOT_MSG_DELETE ? `${currentCfg.BOT_MSG_DELAY / 1000}s` : 'off').setMaxLength(10).setPlaceholder('off | on | 5s | 30s')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cfg_cmd_delete').setLabel('Supprimer cmds utilisateur? (on/off/immédiat)').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentCfg.CMD_MSG_DELETE ? (currentCfg.CMD_MSG_DELAY > 0 ? `${currentCfg.CMD_MSG_DELAY / 1000}s` : 'on') : 'off').setMaxLength(10).setPlaceholder('off | on | 5s | 30s')
        ),
      );
      await interaction.showModal(modal);
    });
    collector.on('end', (_, reason) => { if (reason === 'time') prompt.delete().catch(() => {}); });
  }
});

async function handleBotConfigModal(interaction) {
  const prefix     = interaction.fields.getTextInputValue('cfg_prefix').trim();
  const logChannel = interaction.fields.getTextInputValue('cfg_log_channel').trim();
  const mutedRole  = interaction.fields.getTextInputValue('cfg_muted_role').trim();
  const botDelete  = interaction.fields.getTextInputValue('cfg_bot_delete').trim().toLowerCase();
  const cmdDelete  = interaction.fields.getTextInputValue('cfg_cmd_delete').trim().toLowerCase();

  // Parse bot delete
  let botMsgDelete = false, botMsgDelay = 5000;
  if (botDelete !== 'off' && botDelete !== '') {
    botMsgDelete = true;
    const ms = parseDuration(botDelete.replace('s', 's').replace('m', 'm'));
    if (ms) botMsgDelay = ms;
    else if (botDelete === 'on') { botMsgDelete = true; botMsgDelay = 5000; }
  }

  // Parse cmd delete
  let cmdMsgDelete = true, cmdMsgDelay = 0;
  if (cmdDelete === 'off') { cmdMsgDelete = false; cmdMsgDelay = 0; }
  else if (cmdDelete !== 'off') {
    cmdMsgDelete = true;
    const ms = parseDuration(cmdDelete.replace('s', 's').replace('m', 'm'));
    if (ms) cmdMsgDelay = ms;
  }

  setGuildConfigMulti(interaction.guild.id, {
    PREFIX          : prefix || '-',
    LOG_CHANNEL_NAME: logChannel || 'logs-modération',
    MUTED_ROLE      : mutedRole || 'Muted',
    BOT_MSG_DELETE  : botMsgDelete,
    BOT_MSG_DELAY   : botMsgDelay,
    CMD_MSG_DELETE  : cmdMsgDelete,
    CMD_MSG_DELAY   : cmdMsgDelay,
  });

  await interaction.reply({
    embeds: [makeEmbed({
      color : DEFAULT_CONFIG.COLORS.SUCCESS,
      title : '✅ Configuration sauvegardée',
      fields: [
        { name: 'Préfixe',               value: prefix || '-',                                              inline: true },
        { name: 'Salon logs',             value: logChannel || 'logs-modération',                            inline: true },
        { name: 'Rôle Muted',            value: mutedRole || 'Muted',                                       inline: true },
        { name: 'Suppr. réponses bot',   value: botMsgDelete ? `✅ ${botMsgDelay / 1000}s` : '❌ Off',       inline: true },
        { name: 'Suppr. cmd utilisateur', value: cmdMsgDelete ? `✅ ${cmdMsgDelay > 0 ? cmdMsgDelay / 1000 + 's' : 'Immédiat'}` : '❌ Off', inline: true },
      ],
    })],
    ephemeral: true,
  });
}

cmd('setprefix', {
  ownerOnly: true,
  usage    : 'setprefix <nouveau préfixe>',
  description: 'Change le préfixe de commande du bot.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const prefix = args[0];
    if (!prefix || prefix.length > 5) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un préfixe (max 5 caractères).' })] }, message.guild.id);
    setGuildConfig(message.guild.id, 'PREFIX', prefix);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Préfixe changé en \`${prefix}\`.` })] }, message.guild.id);
  }
});

cmd('setlogchannel', {
  staffOnly: true,
  aliases  : ['setlogs', 'logchannel'],
  usage    : 'setlogchannel [#salon]',
  description: 'Définit le salon de logs de modération.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    setGuildConfig(message.guild.id, 'LOG_CHANNEL_NAME', channel.name);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Salon de logs défini : ${channel}` })] }, message.guild.id);
  }
});

cmd('setmuterole', {
  staffOnly: true,
  aliases  : ['muterole'],
  usage    : 'setmuterole <@rôle>',
  description: 'Définit le rôle Muted du serveur.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    setMuteRole(message.guild.id, role.id);
    setGuildConfig(message.guild.id, 'MUTED_ROLE', role.name);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle Muted défini : **${role.name}**` })] }, message.guild.id);
  }
});

cmd('addmodrole', {
  ownerOnly: true,
  usage    : 'addmodrole <@rôle>',
  description: 'Ajoute un rôle staff (peut utiliser les commandes de modération).',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    const ok = addModRole(message.guild.id, role.id);
    // Mettre à jour STAFF_ROLES dans la config
    const currentStaff = getGuildConfig(message.guild.id).STAFF_ROLES || [...DEFAULT_CONFIG.STAFF_ROLES];
    if (!currentStaff.includes(role.name)) currentStaff.push(role.name);
    setGuildConfig(message.guild.id, 'STAFF_ROLES', currentStaff);
    await reply(message, { embeds: [makeEmbed({ color: ok ? DEFAULT_CONFIG.COLORS.SUCCESS : DEFAULT_CONFIG.COLORS.WARNING, desc: ok ? `✅ Rôle **${role.name}** ajouté comme rôle staff.` : `⚠️ Ce rôle est déjà staff.` })] }, message.guild.id);
  }
});

cmd('removemodrole', {
  ownerOnly: true,
  usage    : 'removemodrole <@rôle>',
  description: 'Retire un rôle staff.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    removeModRole(message.guild.id, role.id);
    const currentStaff = (getGuildConfig(message.guild.id).STAFF_ROLES || [...DEFAULT_CONFIG.STAFF_ROLES]).filter(r => r !== role.name);
    setGuildConfig(message.guild.id, 'STAFF_ROLES', currentStaff);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** retiré du staff.` })] }, message.guild.id);
  }
});

cmd('listmodroles', {
  staffOnly: true,
  usage    : 'listmodroles',
  description: 'Liste les rôles staff configurés.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const staffRoles = cfg.STAFF_ROLES || DEFAULT_CONFIG.STAFF_ROLES;
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: '👥 Rôles staff', desc: staffRoles.map(r => `• \`${r}\``).join('\n') || 'Aucun' })] }, message.guild.id);
  }
});

cmd('setbotdelete', {
  ownerOnly: true,
  aliases  : ['botdelete', 'autodeletebotmsg'],
  usage    : 'setbotdelete <off|on|5s|30s>',
  description: 'Configure la suppression automatique des réponses du bot.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const val = args[0]?.toLowerCase();
    if (!val) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Options : `off` | `on` (5s par défaut) | `5s` | `30s` | `1m`' })] }, message.guild.id);
    if (val === 'off') {
      setGuildConfigMulti(message.guild.id, { BOT_MSG_DELETE: false });
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Suppression auto des messages bot **désactivée**.' })] }, message.guild.id);
    }
    const ms = parseDuration(val) || 5000;
    setGuildConfigMulti(message.guild.id, { BOT_MSG_DELETE: true, BOT_MSG_DELAY: ms });
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Réponses du bot supprimées après **${formatDuration(ms)}**.` })] }, message.guild.id);
  }
});

cmd('setcmddelete', {
  ownerOnly: true,
  aliases  : ['cmddelete', 'autodeleteusercmd'],
  usage    : 'setcmddelete <off|on|immédiat|5s>',
  description: 'Configure la suppression automatique des messages de commande.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const val = args[0]?.toLowerCase();
    if (!val) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Options : `off` | `on` | `5s` | `30s`' })] }, message.guild.id);
    if (val === 'off') {
      setGuildConfigMulti(message.guild.id, { CMD_MSG_DELETE: false });
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Suppression auto des commandes utilisateur **désactivée**.' })] }, message.guild.id);
    }
    const ms = parseDuration(val) || 0;
    setGuildConfigMulti(message.guild.id, { CMD_MSG_DELETE: true, CMD_MSG_DELAY: ms });
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Commandes utilisateur supprimées ${ms > 0 ? `après **${formatDuration(ms)}**` : '**immédiatement**'}.` })] }, message.guild.id);
  }
});

cmd('anticonfig', {
  staffOnly: true,
  usage    : 'anticonfig',
  description: 'Configure les seuils des anti-systèmes via un formulaire.',
  category : '🛡️ Anti-Systèmes',
  async execute(message, args, cfg) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_anticonfig_modal').setLabel('🛡️ Configurer les anti-systèmes').setStyle(ButtonStyle.Secondary)
    );
    const prompt = await message.channel.send({
      embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, desc: `${message.author}, clique pour configurer les seuils des anti-systèmes.` })],
      components: [row],
    });
    const filter    = i => i.customId === 'open_anticonfig_modal' && i.user.id === message.author.id;
    const collector = prompt.createMessageComponentCollector({ filter, time: 60000, max: 1 });
    collector.on('collect', async interaction => {
      const currentCfg = getGuildConfig(message.guild.id);
      const modal = new ModalBuilder().setCustomId('anticonfig_modal').setTitle('Configuration Anti-Systèmes');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('anti_spam_max').setLabel('Anti-Spam : nb max messages / fenêtre').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(currentCfg.SPAM?.MAX_MESSAGES || 5)).setPlaceholder('5')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('anti_spam_window').setLabel('Anti-Spam : fenêtre temps (ms)').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(currentCfg.SPAM?.TIME_WINDOW || 5000)).setPlaceholder('5000')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('anti_spam_mute').setLabel('Anti-Spam : durée mute (minutes)').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(currentCfg.SPAM?.MUTE_DURATION || 5)).setPlaceholder('5')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('anti_raid_threshold').setLabel('Anti-Raid : seuil de joins').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(currentCfg.RAID?.JOIN_THRESHOLD || 10)).setPlaceholder('10')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('anti_caps_percent').setLabel('Anti-Caps : % majuscules (ex: 70)').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(currentCfg.CAPS?.PERCENT || 70)).setPlaceholder('70')
        ),
      );
      await interaction.showModal(modal);
    });
    collector.on('end', (_, reason) => { if (reason === 'time') prompt.delete().catch(() => {}); });
  }
});

async function handleAntiConfigModal(interaction) {
  const spamMax     = parseInt(interaction.fields.getTextInputValue('anti_spam_max'))     || 5;
  const spamWindow  = parseInt(interaction.fields.getTextInputValue('anti_spam_window'))  || 5000;
  const spamMute    = parseInt(interaction.fields.getTextInputValue('anti_spam_mute'))    || 5;
  const raidThresh  = parseInt(interaction.fields.getTextInputValue('anti_raid_threshold')) || 10;
  const capsPct     = parseInt(interaction.fields.getTextInputValue('anti_caps_percent'))  || 70;

  setGuildConfigMulti(interaction.guild.id, {
    SPAM: { MAX_MESSAGES: spamMax, TIME_WINDOW: spamWindow, MUTE_DURATION: spamMute },
    RAID: { JOIN_THRESHOLD: raidThresh, TIME_WINDOW: 10000, ACTION: 'kick' },
    CAPS: { MIN_LENGTH: 10, PERCENT: capsPct },
  });

  await interaction.reply({
    embeds: [makeEmbed({
      color : DEFAULT_CONFIG.COLORS.SUCCESS,
      title : '✅ Anti-systèmes configurés',
      fields: [
        { name: 'Spam — Max msgs',  value: `${spamMax}`,   inline: true },
        { name: 'Spam — Fenêtre',   value: `${spamWindow}ms`, inline: true },
        { name: 'Spam — Mute',      value: `${spamMute}min`,  inline: true },
        { name: 'Raid — Seuil',     value: `${raidThresh} joins`, inline: true },
        { name: 'Caps — %',         value: `${capsPct}%`,  inline: true },
      ],
    })],
    ephemeral: true,
  });
}

cmd('automod', {
  ownerOnly: true,
  usage    : 'automod <warn|mute|kick|ban> <seuil>',
  description: 'Configure les seuils de l\'automod progressif.',
  category : '🛡️ Anti-Systèmes',
  async execute(message, args, cfg) {
    const type      = args[0]?.toLowerCase();
    const threshold = parseInt(args[1]);
    if (!['warn', 'mute', 'kick', 'ban'].includes(type) || isNaN(threshold) || threshold < 1) {
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Usage : \`${cfg.PREFIX}automod <warn|mute|kick|ban> <seuil>\`` })] }, message.guild.id);
    }
    const key = `${type.toUpperCase()}_THRESHOLD`;
    const currentAutomod = cfg.AUTOMOD_ACTIONS || { ...DEFAULT_CONFIG.AUTOMOD_ACTIONS };
    currentAutomod[key] = threshold;
    setGuildConfig(message.guild.id, 'AUTOMOD_ACTIONS', currentAutomod);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Seuil **${type}** de l'automod défini à **${threshold} warns**.` })] }, message.guild.id);
  }
});

// ============================================================
// 8m. AUTOROLE
// ============================================================

cmd('autorole', {
  staffOnly: true,
  usage    : 'autorole <add|remove|list> [@rôle]',
  description: 'Gère les rôles automatiques donnés aux nouveaux membres.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const action = args[0]?.toLowerCase();
    if (action === 'list') {
      const roles = getAutoroles(message.guild.id);
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: '🎭 Autoroles', desc: roles.map(id => `<@&${id}>`).join(', ') || 'Aucun autorole configuré.' })] }, message.guild.id);
    }
    const role = message.mentions.roles.first();
    if (!role) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Mentionnez un rôle.' })] }, message.guild.id);
    if (action === 'add') {
      const ok = addAutorole(message.guild.id, role.id);
      return reply(message, { embeds: [makeEmbed({ color: ok ? DEFAULT_CONFIG.COLORS.SUCCESS : DEFAULT_CONFIG.COLORS.WARNING, desc: ok ? `✅ Rôle **${role.name}** ajouté aux autoroles.` : `⚠️ Ce rôle est déjà un autorole.` })] }, message.guild.id);
    }
    if (action === 'remove') {
      removeAutorole(message.guild.id, role.id);
      return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle **${role.name}** retiré des autoroles.` })] }, message.guild.id);
    }
    reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: `❌ Usage : \`${cfg.PREFIX}autorole <add|remove|list> [@rôle]\`` })] }, message.guild.id);
  }
});

// ============================================================
// 8n. SETUP SERVEUR
// ============================================================

cmd('setup', {
  ownerOnly: true,
  cooldown : 10000,
  usage    : 'setup',
  description: 'Configure automatiquement le serveur (rôles, salons logs).',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const guild  = message.guild;
    const status = [];

    for (const roleDef of [...DEFAULT_CONFIG.ROLES].reverse()) {
      const existing = guild.roles.cache.find(r => r.name === roleDef.name);
      if (existing) { status.push(`♻️ Rôle existant : **${roleDef.name}**`); continue; }
      try {
        const perms = roleDef.permissions.reduce((acc, p) => acc | (PermissionFlagsBits[p] || 0n), 0n);
        const newRole = await guild.roles.create({ name: roleDef.name, color: roleDef.color, hoist: roleDef.hoist, permissions: perms, reason: 'Setup automatique' });
        status.push(`✅ Rôle créé : **${roleDef.name}**`);
        if (roleDef.name === (cfg.MUTED_ROLE || DEFAULT_CONFIG.MUTED_ROLE)) {
          setMuteRole(guild.id, newRole.id);
          for (const [, ch] of guild.channels.cache) {
            ch.permissionOverwrites.edit(newRole, { SendMessages: false, AddReactions: false, Speak: false }).catch(() => {});
          }
        }
      } catch (e) { status.push(`❌ Erreur rôle ${roleDef.name} : ${e.message}`); }
    }

    for (const chName of [cfg.LOG_CHANNEL_NAME || DEFAULT_CONFIG.LOG_CHANNEL_NAME]) {
      const exists = guild.channels.cache.find(c => c.name === chName);
      if (!exists) {
        try { await guild.channels.create({ name: chName, type: ChannelType.GuildText }); status.push(`✅ Salon créé : **${chName}**`); }
        catch { status.push(`❌ Erreur création salon **${chName}**.`); }
      } else { status.push(`♻️ Salon existant : **${chName}**`); }
    }

    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, title: '✅ Setup terminé', desc: status.join('\n') })] }, message.guild.id);
  }
});

cmd('setname', {
  ownerOnly: true,
  usage    : 'setname <nouveau nom>',
  description: 'Renomme le serveur.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const name = args.join(' ');
    if (!name) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un nom.' })] }, message.guild.id);
    const old = message.guild.name;
    await message.guild.setName(name);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Serveur renommé : **${old}** → **${name}**` })] }, message.guild.id);
  }
});

cmd('seticon', {
  ownerOnly: true,
  usage    : 'seticon <url>',
  description: 'Change l\'icône du serveur.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const url = args[0] || message.attachments.first()?.url;
    if (!url) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez une URL d\'image.' })] }, message.guild.id);
    await message.guild.setIcon(url);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Icône du serveur mise à jour.' })] }, message.guild.id);
  }
});

cmd('setbanner', {
  ownerOnly: true,
  usage    : 'setbanner <url>',
  description: 'Change la bannière du serveur.',
  category : '⚙️ Configuration',
  async execute(message, args, cfg) {
    const url = args[0] || message.attachments.first()?.url;
    if (!url) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez une URL d\'image.' })] }, message.guild.id);
    await message.guild.setBanner(url);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Bannière du serveur mise à jour.' })] }, message.guild.id);
  }
});

// ============================================================
// 8o. TRANSCRIPT / ARCHIVE
// ============================================================

cmd('transcript', {
  staffOnly: true,
  aliases  : ['archive', 'logs'],
  usage    : 'transcript [#salon] [nombre: 1-200]',
  description: 'Génère un transcript des messages d\'un salon.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const limit   = Math.min(parseInt(args.find(a => /^\d+$/.test(a))) || 100, 200);
    const messages = await channel.messages.fetch({ limit });
    const sorted   = [...messages.values()].reverse();
    const lines    = [
      `═══════════════════════════════════`,
      `TRANSCRIPT — #${channel.name}`,
      `Serveur  : ${message.guild.name} (${message.guild.id})`,
      `Exporté  : ${new Date().toLocaleString('fr-FR')}`,
      `Messages : ${sorted.length}`,
      `═══════════════════════════════════`,
      '',
      ...sorted.map(m => {
        const time = new Date(m.createdTimestamp).toLocaleString('fr-FR');
        const attachments = m.attachments.size > 0 ? ` [${m.attachments.size} pièce(s) jointe(s)]` : '';
        const embeds = m.embeds.length > 0 ? ` [${m.embeds.length} embed(s)]` : '';
        return `[${time}] ${m.author.tag}: ${m.content || ''}${attachments}${embeds}`;
      }),
    ];
    const buffer = Buffer.from(lines.join('\n'), 'utf8');
    const attach = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}-${Date.now()}.txt` });
    await message.channel.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `📄 Transcript de ${channel} généré (${sorted.length} messages).` })], files: [attach] });
  }
});

cmd('export', {
  ownerOnly: true,
  usage    : 'export',
  description: 'Exporte toutes les données du bot en JSON.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const guildData = {
      warns      : DATA.warns[message.guild.id] || {},
      cases      : DATA.cases[message.guild.id] || [],
      notes      : DATA.notes[message.guild.id] || {},
      anti       : DATA.anti[message.guild.id]  || {},
      guildConfig: DATA.guildConfig[message.guild.id] || {},
      blacklist  : DATA.blacklistWords[message.guild.id] || [],
    };
    const buffer = Buffer.from(JSON.stringify(guildData, null, 2), 'utf8');
    const attach = new AttachmentBuilder(buffer, { name: `export-${message.guild.id}-${Date.now()}.json` });
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Export des données généré.' })], files: [attach] }, message.guild.id);
  }
});

// ============================================================
// 8p. UTILITAIRES DIVERS
// ============================================================

cmd('dm', {
  staffOnly: true,
  aliases  : ['send', 'privatemsg'],
  usage    : 'dm <@membre|ID> <message>',
  description: 'Envoie un message privé à un membre.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const target = message.mentions.users.first() || await client.users.fetch(args[0]?.replace(/[<@!>]/g, '')).catch(() => null);
    if (!target) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Utilisateur introuvable.' })] }, message.guild.id);
    const text = args.slice(1).join(' ');
    if (!text) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un message.' })] }, message.guild.id);
    try {
      await target.send(`📬 Message de la part de la modération de **${message.guild.name}** :\n\n${text}`);
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Message envoyé à **${target.tag}**.` })] }, message.guild.id);
    } catch {
      reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible d\'envoyer le MP (DMs fermés ?).' })] }, message.guild.id);
    }
  }
});

cmd('announce', {
  staffOnly: true,
  aliases  : ['annonce'],
  usage    : 'announce [#salon] <message>',
  description: 'Envoie une annonce embed dans un salon.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const text    = args.filter(a => !a.startsWith('<#')).join(' ');
    if (!text) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un message.' })] }, message.guild.id);
    await channel.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: '📢 Annonce', desc: text })] });
    if (channel.id !== message.channel.id) {
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Annonce envoyée dans ${channel}.` })] }, message.guild.id);
    }
  }
});

cmd('poll', {
  staffOnly: true,
  usage    : 'poll [#salon] <question> | <option1> | <option2> | ...',
  description: 'Crée un sondage avec émojis.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const raw     = args.filter(a => !a.startsWith('<#')).join(' ');
    const parts   = raw.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Usage : `poll <question> | <option1> | <option2>`' })] }, message.guild.id);
    const question = parts[0];
    const options  = parts.slice(1);
    if (options.length > 10) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Maximum 10 options.' })] }, message.guild.id);
    const emojis   = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const desc     = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n\n');
    const sent     = await channel.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.PRIMARY, title: `📊 ${question}`, desc })] });
    for (let i = 0; i < options.length; i++) {
      await sent.react(emojis[i]);
    }
    if (channel.id !== message.channel.id) {
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Sondage créé dans ${channel}.` })] }, message.guild.id);
    }
  }
});

cmd('invites', {
  staffOnly: true,
  aliases  : ['listinvites'],
  usage    : 'invites [@membre]',
  description: 'Liste les invitations du serveur ou d\'un membre.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const target    = message.mentions.users.first() || null;
    const allInvites = await message.guild.invites.fetch();
    const filtered  = target ? allInvites.filter(inv => inv.inviter?.id === target.id) : allInvites;
    if (!filtered.size) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: '📭 Aucune invitation trouvée.' })] }, message.guild.id);
    const fields = [...filtered.values()].slice(0, 10).map(inv => ({
      name : `discord.gg/${inv.code}`,
      value: `Par : ${inv.inviter?.tag || 'N/A'} | Utilisations : ${inv.uses}/${inv.maxUses || '∞'} | Expire : ${inv.expiresAt ? `<t:${Math.floor(inv.expiresAt.getTime() / 1000)}:R>` : 'Jamais'} | Canal : ${inv.channel?.name || 'N/A'}`,
    }));
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: `🔗 Invitations (${filtered.size})`, fields })] }, message.guild.id);
  }
});

cmd('delinvite', {
  staffOnly: true,
  aliases  : ['revokeinvite'],
  usage    : 'delinvite <code>',
  description: 'Supprime une invitation.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const code = args[0];
    if (!code) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un code.' })] }, message.guild.id);
    try {
      const inv = await message.guild.invites.fetch().then(invites => invites.find(i => i.code === code));
      if (!inv) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Invitation introuvable.' })] }, message.guild.id);
      await inv.delete(`Supprimée par ${message.author.tag}`);
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Invitation \`${code}\` supprimée.` })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Erreur lors de la suppression.' })] }, message.guild.id); }
  }
});

cmd('delinviteall', {
  ownerOnly: true,
  usage    : 'delinviteall',
  description: 'Supprime toutes les invitations du serveur.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const invites = await message.guild.invites.fetch();
    let count = 0;
    for (const [, inv] of invites) {
      try { await inv.delete(); count++; } catch {}
    }
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ **${count}** invitation(s) supprimée(s).` })] }, message.guild.id);
  }
});

cmd('search', {
  staffOnly: true,
  usage    : 'search <texte> [#salon]',
  description: 'Recherche un texte dans les messages récents d\'un salon.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const query   = args.filter(a => !a.startsWith('<#')).join(' ');
    if (!query) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un texte à rechercher.' })] }, message.guild.id);
    const messages = await channel.messages.fetch({ limit: 100 });
    const found    = [...messages.values()].filter(m => m.content.toLowerCase().includes(query.toLowerCase()));
    if (!found.length) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: `🔍 Aucun message contenant \`${query}\` trouvé dans ${channel}.` })] }, message.guild.id);
    const fields = found.slice(0, 5).map(m => ({
      name : `${m.author.tag} — ${new Date(m.createdTimestamp).toLocaleString('fr-FR')}`,
      value: m.content.slice(0, 200),
    }));
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: `🔍 ${found.length} résultat(s) pour "${query}"`, fields })] }, message.guild.id);
  }
});

cmd('movemsg', {
  staffOnly: true,
  aliases  : ['movemsgs'],
  usage    : 'movemsg <messageID> <#salon>',
  description: 'Déplace un message vers un autre salon.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const msgId   = args[0];
    const channel = message.mentions.channels.first();
    if (!msgId || !channel) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un ID de message et un salon.' })] }, message.guild.id);
    try {
      const msg = await message.channel.messages.fetch(msgId);
      await channel.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: `📤 Message déplacé depuis #${message.channel.name}`, desc: msg.content || '*[vide]*', fields: [{ name: 'Auteur original', value: msg.author.tag, inline: true }] })] });
      await msg.delete().catch(() => {});
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Message déplacé vers ${channel}.` })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Message introuvable.' })] }, message.guild.id); }
  }
});

cmd('pin', {
  staffOnly: true,
  usage    : 'pin <messageID>',
  description: 'Épingle un message.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const msgId = args[0];
    if (!msgId) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un ID de message.' })] }, message.guild.id);
    try {
      const msg = await message.channel.messages.fetch(msgId);
      await msg.pin();
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '📌 Message épinglé.' })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible d\'épingler le message.' })] }, message.guild.id); }
  }
});

cmd('unpin', {
  staffOnly: true,
  usage    : 'unpin <messageID>',
  description: 'Désépingle un message.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const msgId = args[0];
    if (!msgId) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un ID de message.' })] }, message.guild.id);
    try {
      const msg = await message.channel.messages.fetch(msgId);
      await msg.unpin();
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '📌 Message désépinglé.' })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible de désépingler.' })] }, message.guild.id); }
  }
});

cmd('pins', {
  usage    : 'pins [#salon]',
  description: 'Affiche les messages épinglés d\'un salon.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const channel = message.mentions.channels.first() || message.channel;
    const pins    = await channel.messages.fetchPinned();
    if (!pins.size) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, desc: '📌 Aucun message épinglé dans ce salon.' })] }, message.guild.id);
    const fields = [...pins.values()].slice(0, 5).map(m => ({
      name : `${m.author.tag} — ${new Date(m.createdTimestamp).toLocaleString('fr-FR')}`,
      value: m.content?.slice(0, 100) || '*[embed/pièce jointe]*',
    }));
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.INFO, title: `📌 Messages épinglés dans #${channel.name} (${pins.size})`, fields })] }, message.guild.id);
  }
});

cmd('react', {
  staffOnly: true,
  usage    : 'react <messageID> <emoji>',
  description: 'Fait réagir le bot à un message.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const msgId = args[0];
    const emoji = args[1];
    if (!msgId || !emoji) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un ID et un emoji.' })] }, message.guild.id);
    try {
      const msg = await message.channel.messages.fetch(msgId);
      await msg.react(emoji);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible de réagir.' })] }, message.guild.id); }
  }
});

cmd('unreact', {
  staffOnly: true,
  usage    : 'unreact <messageID>',
  description: 'Supprime les réactions du bot sur un message.',
  category : '📋 Utilitaires',
  async execute(message, args, cfg) {
    const msgId = args[0];
    if (!msgId) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Fournissez un ID.' })] }, message.guild.id);
    try {
      const msg = await message.channel.messages.fetch(msgId);
      await msg.reactions.removeAll();
      await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: '✅ Réactions supprimées.' })] }, message.guild.id);
    } catch { reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Impossible de supprimer les réactions.' })] }, message.guild.id); }
  }
});

cmd('verify', {
  staffOnly: true,
  aliases  : ['accept'],
  usage    : 'verify <@membre|ID>',
  description: 'Donne le rôle Membre à un utilisateur (vérification manuelle).',
  category : '👤 Membres',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const memberRole = message.guild.roles.cache.find(r => r.name === 'Membre');
    if (!memberRole) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Rôle "Membre" introuvable.' })] }, message.guild.id);
    await target.roles.add(memberRole);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ **${target.user.tag}** vérifié et rôle Membre attribué.` })] }, message.guild.id);
    try { await target.user.send(`✅ Vous avez été vérifié sur **${message.guild.name}** !`); } catch {}
  }
});

cmd('unverify', {
  staffOnly: true,
  usage    : 'unverify <@membre|ID>',
  description: 'Retire le rôle Membre d\'un utilisateur.',
  category : '👤 Membres',
  async execute(message, args, cfg) {
    const target = message.mentions.members.first() || await resolveUser(message.guild, args[0]);
    if (!target || !target.roles) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Membre introuvable.' })] }, message.guild.id);
    const memberRole = message.guild.roles.cache.find(r => r.name === 'Membre');
    if (!memberRole) return reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.DANGER, desc: '❌ Rôle "Membre" introuvable.' })] }, message.guild.id);
    await target.roles.remove(memberRole);
    await reply(message, { embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `✅ Rôle Membre retiré de **${target.user.tag}**.` })] }, message.guild.id);
  }
});

// ============================================================
// 8q. HELP
// ============================================================

cmd('help', {
  aliases : ['h', 'aide', 'commands', 'cmds'],
  usage   : 'help [commande|catégorie]',
  description: 'Affiche l\'aide complète.',
  category: '📖 Aide',
  async execute(message, args, cfg) {
    const prefix = cfg.PREFIX || DEFAULT_CONFIG.PREFIX;

    if (args[0]) {
      const searchTerm = args[0].toLowerCase();
      const c = COMMANDS[searchTerm];
      if (c) {
        return reply(message, { embeds: [makeEmbed({
          color : DEFAULT_CONFIG.COLORS.PRIMARY,
          title : `📖 ${prefix}${searchTerm}`,
          fields: [
            { name: 'Description', value: c.description || 'Aucune description.' },
            { name: 'Usage',       value: `\`${prefix}${c.usage || searchTerm}\`` },
            { name: 'Catégorie',   value: c.category || 'Général', inline: true },
            { name: 'Staff only',  value: c.staffOnly ? '✅ Oui' : '❌ Non', inline: true },
            { name: 'Owner only',  value: c.ownerOnly ? '✅ Oui' : '❌ Non', inline: true },
            ...(c.aliases?.length ? [{ name: 'Alias', value: c.aliases.map(a => `\`${prefix}${a}\``).join(', ') }] : []),
          ],
        })] }, message.guild.id);
      }
    }

    const categories = {};
    const seen = new Set();
    for (const [name, c] of Object.entries(COMMANDS)) {
      if (seen.has(c)) continue;
      seen.add(c);
      const cat = c.category || '📖 Général';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(name);
    }

    const fields = Object.entries(categories).sort(([a], [b]) => a.localeCompare(b)).map(([cat, cmds]) => ({
      name : cat,
      value: cmds.map(c => `\`${prefix}${c}\``).join(' '),
    }));

    await reply(message, { embeds: [makeEmbed({
      color : DEFAULT_CONFIG.COLORS.PRIMARY,
      title : '📋 Aide complète',
      desc  : `Préfixe : \`${prefix}\` — Utilisez \`${prefix}help <commande>\` pour plus de détails.\n⚙️ Config : \`${prefix}config\``,
      fields,
    })] }, message.guild.id);
  }
});

// ============================================================
// SECTION 9 — REPRISE DES TEMP-MUTES / TEMP-BANS
// ============================================================

async function resumeTempMutes() {
  for (const [guildId, mutes] of Object.entries(DATA.mutes || {})) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    const muteRoleId = getMuteRole(guildId);
    const muteRole   = muteRoleId ? guild.roles.cache.get(muteRoleId) : null;
    if (!muteRole) continue;
    for (const [userId, data] of Object.entries(mutes)) {
      if (!data.until) continue;
      const remaining = data.until - Date.now();
      if (remaining <= 0) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) member.roles.remove(muteRole).catch(() => {});
        removeTempMute(guildId, userId);
      } else {
        setTimeout(async () => {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) member.roles.remove(muteRole).catch(() => {});
          removeTempMute(guildId, userId);
          const log = await getLogChannel(guild);
          if (log) log.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🔊 Tempmute expiré pour **${data.mod ? userId : userId}**.` })] }).catch(() => {});
        }, remaining);
      }
    }
  }
}

async function resumeTempBans() {
  for (const [guildId, bans] of Object.entries(DATA.bans || {})) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    for (const [userId, data] of Object.entries(bans)) {
      if (!data.until) continue;
      const remaining = data.until - Date.now();
      if (remaining <= 0) {
        await guild.members.unban(userId, 'Tempban expiré').catch(() => {});
        removeTempBan(guildId, userId);
      } else {
        setTimeout(async () => {
          await guild.members.unban(userId, 'Tempban expiré').catch(() => {});
          removeTempBan(guildId, userId);
          const log = await getLogChannel(guild);
          if (log) log.send({ embeds: [makeEmbed({ color: DEFAULT_CONFIG.COLORS.SUCCESS, desc: `🔓 Tempban expiré pour **${userId}**.` })] }).catch(() => {});
        }, remaining);
      }
    }
  }
}

// ============================================================
// SECTION 10 — DÉMARRAGE
// ============================================================

loadData();
const TOKEN = process.env.BOT_TOKEN || DEFAULT_CONFIG.TOKEN;
if (!TOKEN || TOKEN === 'VOTRE_TOKEN_ICI') {
  console.error('[ERROR] Aucun token fourni. Définissez BOT_TOKEN dans les variables d\'environnement ou dans DEFAULT_CONFIG.TOKEN.');
  process.exit(1);
}
client.login(TOKEN).catch(err => {
  console.error('[LOGIN ERROR]', err.message);
  process.exit(1);
});

client.on('guildMemberAdd', async member => {
  try {
    const channelIds = ['1508248133623222492', '1506723034583793845', '1506001992047136990']; // Remplace par les IDs de tes salons

    for (const id of channelIds) {
      const channel = member.guild.channels.cache.get(id);
      if (!channel || !channel.isTextBased()) continue;

      // Envoie du message
      const welcomeMessage = await channel.send({
        content: `Bienvenue sur le serveur, ${member} !`,
        allowedMentions: { users: [member.id] }
      });

      // Supprime le message après 5 secondes
      setTimeout(() => {
        welcomeMessage.delete().catch(() => {});
      }, 10000);
    }
  } catch (err) {
    console.error('Erreur lors de l\'envoi du message de bienvenue:', err);
  }
});