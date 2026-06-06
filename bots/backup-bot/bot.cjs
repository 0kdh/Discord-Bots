const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env')
});

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                    VAULTBOT — DISCORD BACKUP BOT                 ║
 * ║           Production-Ready | Discord.js v14 | Node.js LTS        ║
 * ║                                                                  ║
 * ║  Modules:                                                        ║
 * ║   • Utils           — sleep, generateId, format, colors          ║
 * ║   • Logger          — internal structured logging                ║
 * ║   • DataManager     — persistent JSON storage                    ║
 * ║   • PermissionGuard — whitelist + role-based auth                ║
 * ║   • BackupEngine    — create, validate, diff                     ║
 * ║   • RestoreEngine   — full / safe restore with rate-limit safety ║
 * ║   • AutoBackup      — scheduler, interval management             ║
 * ║   • CommandHandler  — prefix routing, args parsing               ║
 * ║   • Commands        — backup, restore, config, system            ║
 * ║   • AntiCrash       — global error handler                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * @author   VaultBot Team
 * @version  2.0.0
 * @license  MIT
 */

'use strict';

// ─────────────────────────────────────────────
//  DEPENDENCIES
// ─────────────────────────────────────────────
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  OverwriteType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  Colors,
  ActivityType,
} = require('discord.js');

const fs = require('fs');

const BACKUP_PATH = path.join(__dirname, 'backups');

if (!fs.existsSync(BACKUP_PATH)) {
  fs.mkdirSync(BACKUP_PATH);
}

// ─────────────────────────────────────────────
//  DOTENV (optional — graceful if missing)
// ─────────────────────────────────────────────
try {
  require('dotenv').config();
} catch (_) {
  /* dotenv not installed — skip */
}

// ══════════════════════════════════════════════════════════════════════
//  ███████╗███████╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██╔════╝██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ███████╗█████╗  ██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ╚════██║██╔══╝  ██║        ██║   ██║██║   ██║██║╚██╗██║
//  ███████║███████╗╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//  ╚══════╝╚══════╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//  §1 — GLOBAL CONFIGURATION
// ══════════════════════════════════════════════════════════════════════

/** @type {BotConfig} */
const BOT_CONFIG = {
  // ── Token ──────────────────────────────────────────────
  token: process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE',

  // ── Behaviour ──────────────────────────────────────────
  defaultPrefix:        '+',
  defaultEmbedColor:    '#5865F2',   // Discord Blurple
  defaultSuccessColor:  '#57F287',   // Green
  defaultErrorColor:    '#ED4245',   // Red
  defaultWarningColor:  '#FEE75C',   // Yellow
  defaultInfoColor:     '#5865F2',   // Blurple
  defaultNeutralColor:  '#2F3136',   // Dark

  // ── Limits ─────────────────────────────────────────────
  maxBackupsPerGuild:   10,          // max stored backups per guild
  maxAutoBackupInterval: 1440,       // max auto-backup interval (minutes)
  minAutoBackupInterval: 30,         // min auto-backup interval (minutes)
  restoreRateLimitDelay: 600,        // ms between API calls during restore
  confirmationTimeout:   30_000,     // ms for confirmation prompts
  restoreProgressInterval: 5,        // update progress every N operations

  // ── Storage ────────────────────────────────────────────
  dataFilePath: path.join(__dirname, 'data.json'),

  // ── Bot identity ───────────────────────────────────────
  botName:    'VaultBot',
  botVersion: '2.0.0',
  botEmoji: {
    success:  '✅',
    error:    '❌',
    warning:  '⚠️',
    info:     'ℹ️',
    loading:  '⏳',
    backup:   '💾',
    restore:  '♻️',
    config:   '⚙️',
    stats:    '📊',
    shield:   '🛡️',
    clock:    '🕐',
    key:      '🔑',
    trash:    '🗑️',
    list:     '📋',
    lock:     '🔒',
    ping:     '🏓',
    help:     '📚',
    diff:     '🔍',
    preview:  '👁️',
    progress: '📶',
    archive:  '📦',
    guild:    '🏰',
    roles:    '🎭',
    channels: '💬',
    emojis:   '😀',
    stickers: '🎟️',
  },
};

// ══════════════════════════════════════════════════════════════════════
//  ██╗   ██╗████████╗██╗██╗     ███████╗
//  ██║   ██║╚══██╔══╝██║██║     ██╔════╝
//  ██║   ██║   ██║   ██║██║     ███████╗
//  ██║   ██║   ██║   ██║██║     ╚════██║
//  ╚██████╔╝   ██║   ██║███████╗███████║
//   ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝
//  §2 — UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════

/**
 * Pause execution for a given number of milliseconds.
 * Used to stay under Discord's rate-limit.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a unique backup ID.
 * Format: XXXXXX (6 alphanumeric chars, uppercase)
 * @returns {string}
 */
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Format a number of bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format a Unix timestamp into a human-readable date string.
 * @param {number} ts — Unix timestamp (ms)
 * @returns {string}
 */
function formatDate(ts) {
  return new Date(ts).toLocaleString('fr-FR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format a duration in ms → human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/**
 * Truncate a string to a maximum length, appending '...' if needed.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 100) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

/**
 * Chunk an array into smaller arrays of a given size.
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deep-clone a plain object via JSON serialization.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a string is a valid hex color.
 * @param {string} hex
 * @returns {boolean}
 */
function isValidHexColor(hex) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
}

/**
 * Resolve a color value: hex string → integer.
 * @param {string} hex
 * @returns {number}
 */
function resolveColor(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Get the size of a JSON-serializable object in bytes.
 * @param {object} obj
 * @returns {number}
 */
function getObjectSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

/**
 * Safely parse an integer, returning a default value on failure.
 * @param {string} str
 * @param {number} def
 * @returns {number}
 */
function safeParseInt(str, def) {
  const n = parseInt(str, 10);
  return isNaN(n) ? def : n;
}

/**
 * Convert a Discord permission bitfield to a human-readable list.
 * @param {bigint} bitfield
 * @returns {string[]}
 */
function permissionsToArray(bitfield) {
  const perms = new PermissionsBitField(bitfield);
  return perms.toArray();
}

// ══════════════════════════════════════════════════════════════════════
//  ██╗      ██████╗  ██████╗  ██████╗ ███████╗██████╗
//  ██║     ██╔═══██╗██╔════╝ ██╔════╝ ██╔════╝██╔══██╗
//  ██║     ██║   ██║██║  ███╗██║  ███╗█████╗  ██████╔╝
//  ██║     ██║   ██║██║   ██║██║   ██║██╔══╝  ██╔══██╗
//  ███████╗╚██████╔╝╚██████╔╝╚██████╔╝███████╗██║  ██║
//  ╚══════╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝
//  §3 — INTERNAL LOGGER
// ══════════════════════════════════════════════════════════════════════

/** Simple structured logger with levels and optional file output. */
const Logger = (() => {
  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
  const COLORS_MAP = {
    DEBUG: '\x1b[36m',  // Cyan
    INFO:  '\x1b[32m',  // Green
    WARN:  '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m',  // Red
    FATAL: '\x1b[35m',  // Magenta
    RESET: '\x1b[0m',
    BOLD:  '\x1b[1m',
    DIM:   '\x1b[2m',
  };

  let logLevel = LEVELS.INFO;

  /**
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'FATAL'} level
   * @param {string} module
   * @param {string} message
   * @param {*} [extra]
   */
  function log(level, module, message, extra) {
    if (LEVELS[level] < logLevel) return;

    const ts   = new Date().toISOString();
    const col  = COLORS_MAP[level] || '';
    const rst  = COLORS_MAP.RESET;
    const bold = COLORS_MAP.BOLD;
    const dim  = COLORS_MAP.DIM;

    const tag = `${col}${bold}[${level}]${rst}`;
    const mod = `${dim}[${module}]${rst}`;
    const out = `${dim}${ts}${rst} ${tag} ${mod} ${message}`;

    if (extra !== undefined) {
      console.log(out, typeof extra === 'object' ? JSON.stringify(extra, null, 2) : extra);
    } else {
      console.log(out);
    }
  }

  return {
    setLevel: (l) => { logLevel = LEVELS[l] ?? LEVELS.INFO; },
    debug:  (mod, msg, extra) => log('DEBUG', mod, msg, extra),
    info:   (mod, msg, extra) => log('INFO',  mod, msg, extra),
    warn:   (mod, msg, extra) => log('WARN',  mod, msg, extra),
    error:  (mod, msg, extra) => log('ERROR', mod, msg, extra),
    fatal:  (mod, msg, extra) => log('FATAL', mod, msg, extra),
    raw:    (...args)          => console.log(...args),
  };
})();

// ══════════════════════════════════════════════════════════════════════
//  ██████╗  █████╗ ████████╗ █████╗     ███╗   ███╗ ██████╗ ██████╗
//  ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗    ████╗ ████║██╔════╝ ██╔══██╗
//  ██║  ██║███████║   ██║   ███████║    ██╔████╔██║██║  ███╗██████╔╝
//  ██║  ██║██╔══██║   ██║   ██╔══██║    ██║╚██╔╝██║██║   ██║██╔══██╗
//  ██████╔╝██║  ██║   ██║   ██║  ██║    ██║ ╚═╝ ██║╚██████╔╝██║  ██║
//  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝    ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝
//  §4 — DATA MANAGER (data.json persistent storage)
// ══════════════════════════════════════════════════════════════════════

/**
 * DataManager — handles all persistent state via data.json
 *
 * Schema:
 * {
 *   "version": "2.0.0",
 *   "guilds": {
 *     "<guildId>": {
 *       "prefix":         string,
 *       "embedColor":     string (hex),
 *       "successColor":   string (hex),
 *       "errorColor":     string (hex),
 *       "warningColor":   string (hex),
 *       "infoColor":      string (hex),
 *       "maxBackups":     number,
 *       "autoBackup":     boolean,
 *       "autoInterval":   number (minutes),
 *       "nextAutoBackup": number (unix ms),
 *       "logChannel":     string|null,
 *       "whitelist":      string[],    // user IDs
 *       "allowedRoles":   string[],    // role IDs
 *       "requireAdmin":   boolean,
 *       "backups":        Backup[],
 *       "createdAt":      number,
 *       "updatedAt":      number,
 *     }
 *   },
 *   "stats": {
 *     "totalBackups":  number,
 *     "totalRestores": number,
 *     "totalDeletes":  number,
 *     "startTime":     number,
 *   }
 * }
 */
const DataManager = (() => {
  const FILE = BOT_CONFIG.dataFilePath || path.join(__dirname, 'data.json');

  const DEFAULT_GUILD = () => ({
    prefix: BOT_CONFIG.defaultPrefix || '+',
    embedColor: BOT_CONFIG.defaultEmbedColor || '#5865F2',
    successColor: BOT_CONFIG.defaultSuccessColor || '#57F287',
    errorColor: BOT_CONFIG.defaultErrorColor || '#ED4245',
    warningColor: BOT_CONFIG.defaultWarningColor || '#FEE75C',
    infoColor: BOT_CONFIG.defaultInfoColor || '#1F8B4C',

    maxBackups: BOT_CONFIG.maxBackupsPerGuild || 10,

    autoBackup: false,
    autoInterval: 60,
    nextAutoBackup: null,

    logChannel: null,
    whitelist: [],
    allowedRoles: [],
    requireAdmin: true,

    backups: [],

    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  let _data = {
    version: BOT_CONFIG.botVersion || '2.0',
    guilds: {},
    stats: {
      totalBackups: 0,
      totalRestores: 0,
      totalDeletes: 0,
      startTime: Date.now(),
    },
  };

  // =====================
  // LOAD / SAVE
  // =====================
  function load() {
    try {
      if (!fs.existsSync(FILE)) {
        save();
        return;
      }

      const raw = fs.readFileSync(FILE, 'utf8');
      _data = JSON.parse(raw);

      if (!_data.guilds) _data.guilds = {};
      if (!_data.stats) _data.stats = {
        totalBackups: 0,
        totalRestores: 0,
        totalDeletes: 0,
        startTime: Date.now(),
      };

    } catch (err) {
      console.error('[DataManager] load error:', err);
    }
  }

  function save() {
    try {
      fs.writeFileSync(FILE, JSON.stringify(_data, null, 2));
    } catch (err) {
      console.error('[DataManager] save error:', err);
    }
  }

  // =====================
  // GUILD MANAGEMENT
  // =====================
  function ensureGuild(guildId) {
    if (!_data.guilds[guildId]) {
      _data.guilds[guildId] = DEFAULT_GUILD();
      save();
    }
    return _data.guilds[guildId];
  }

  function getGuild(guildId) {
    return ensureGuild(guildId);
  }

  function updateGuild(guildId, patch) {
    const guild = ensureGuild(guildId);
    Object.assign(guild, patch);
    guild.updatedAt = Date.now();
    save();
    return guild;
  }

  // =====================
  // BACKUPS
  // =====================
  function getBackups(guildId) {
    return ensureGuild(guildId).backups;
  }

  function getBackup(guildId, id) {
    const guild = ensureGuild(guildId);
    return guild.backups.find(b => b.id === id) || null;
  }

  // 🔥 Cherche un backup dans toutes les guildes
  function getBackupGlobal(id) {
    for (const guildId in _data.guilds) {
      const backup = _data.guilds[guildId].backups.find(b => b.id === id);
      if (backup) return backup;
    }
    return null;
  }

  function saveBackup(guildId, backup) {
    const guild = ensureGuild(guildId);
    const max = guild.maxBackups || BOT_CONFIG.maxBackupsPerGuild;

    // Supprime le plus ancien si dépassement
    while (guild.backups.length >= max) {
      guild.backups.shift();
    }

    guild.backups.push(backup);
    guild.updatedAt = Date.now();
    _data.stats.totalBackups++;
    save();
  }

  function deleteBackup(guildId, id) {
    const guild = ensureGuild(guildId);
    const index = guild.backups.findIndex(b => b.id === id);
    if (index === -1) return false;
    guild.backups.splice(index, 1);
    _data.stats.totalDeletes++;
    save();
    return true;
  }

  function incrementRestores() {
    _data.stats.totalRestores++;
    save();
  }

  function getAllGuilds() {
    return _data.guilds;
  }

  function getStats() {
    return _data.stats;
  }

  // Charge au démarrage
  load();

  return {
    load,
    save,
    ensureGuild,
    getGuild,
    updateGuild,

    getBackups,
    getBackup,
    getBackupGlobal,
    saveBackup,
    deleteBackup,
    incrementRestores,
    getAllGuilds,
    getStats,
  };
})();

// ══════════════════════════════════════════════════════════════════════
//  ██████╗ ███████╗██████╗ ███╗   ███╗     ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
//  ██╔══██╗██╔════╝██╔══██╗████╗ ████║    ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
//  ██████╔╝█████╗  ██████╔╝██╔████╔██║    ██║  ███╗██║   ██║███████║██████╔╝██║  ██║
//  ██╔═══╝ ██╔══╝  ██╔══██╗██║╚██╔╝██║    ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
//  ██║     ███████╗██║  ██║██║ ╚═╝ ██║    ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
//  ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝     ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝
//  §5 — PERMISSION GUARD
// ══════════════════════════════════════════════════════════════════════

/**
 * PermissionGuard — checks if a member is authorised to use backup commands.
 *
 * Auth flow:
 *  1. Guild Owner → always allowed
 *  2. User in whitelist → allowed
 *  3. User has an allowed role → allowed
 *  4. requireAdmin = true  → needs ADMINISTRATOR permission
 *  5. requireAdmin = false → allowed if they have MANAGE_GUILD
 */
const PermissionGuard = (() => {
  /**
   * @param {import('discord.js').GuildMember} member
   * @param {string} guildId
   * @returns {{ allowed: boolean, reason: string }}
   */
  function check(member, guildId) {
    const config = DataManager.getGuild(guildId);

    // Guild owner always allowed
    if (member.guild.ownerId === member.id) {
      return { allowed: true, reason: 'Guild owner' };
    }

    // Whitelist
    if (config.whitelist.includes(member.id)) {
      return { allowed: true, reason: 'Whitelisted user' };
    }

    // Allowed roles
    if (config.allowedRoles.length > 0) {
      const hasRole = config.allowedRoles.some((rid) => member.roles.cache.has(rid));
      if (hasRole) return { allowed: true, reason: 'Allowed role' };
    }

    // Admin / Manage Guild
    if (config.requireAdmin) {
      if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return { allowed: true, reason: 'Administrator' };
      }
      return { allowed: false, reason: 'Administrator permission required' };
    } else {
      if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return { allowed: true, reason: 'Manage Server permission' };
      }
      return { allowed: false, reason: 'Manage Server permission required' };
    }
  }

  return { check };
})();

// ══════════════════════════════════════════════════════════════════════
//  ███████╗███╗   ███╗██████╗ ███████╗██████╗     ██████╗ ██╗   ██╗██╗██╗     ██████╗ ███████╗██████╗
//  ██╔════╝████╗ ████║██╔══██╗██╔════╝██╔══██╗    ██╔══██╗██║   ██║██║██║     ██╔══██╗██╔════╝██╔══██╗
//  █████╗  ██╔████╔██║██████╔╝█████╗  ██║  ██║    ██████╔╝██║   ██║██║██║     ██║  ██║█████╗  ██████╔╝
//  ██╔══╝  ██║╚██╔╝██║██╔══██╗██╔══╝  ██║  ██║    ██╔══██╗██║   ██║██║██║     ██║  ██║██╔══╝  ██╔══██╗
//  ███████╗██║ ╚═╝ ██║██████╔╝███████╗██████╔╝    ██████╔╝╚██████╔╝██║███████╗██████╔╝███████╗██║  ██║
//  ╚══════╝╚═╝     ╚═╝╚═════╝ ╚══════╝╚═════╝     ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝
//  §6 — EMBED BUILDER FACTORY
// ══════════════════════════════════════════════════════════════════════

/**
 * EmbedFactory — constructs styled EmbedBuilder instances using per-guild theme colors.
 */
const EmbedFactory = (() => {
  /**
   * Get the color for a given type and guild.
   * @param {'success'|'error'|'warning'|'info'|'neutral'|'embed'} type
   * @param {string} guildId
   * @returns {number}
   */
  function getColor(type, guildId) {
    const cfg = DataManager.getGuild(guildId);
    const map = {
      success: cfg.successColor || BOT_CONFIG.defaultSuccessColor,
      error:   cfg.errorColor   || BOT_CONFIG.defaultErrorColor,
      warning: cfg.warningColor || BOT_CONFIG.defaultWarningColor,
      info:    cfg.infoColor    || BOT_CONFIG.defaultInfoColor,
      neutral: cfg.embedColor   || BOT_CONFIG.defaultNeutralColor,
      embed:   cfg.embedColor   || BOT_CONFIG.defaultEmbedColor,
    };
    return resolveColor(map[type] || map.embed);
  }

  /**
   * Build a success embed.
   * @param {string} guildId
   * @param {string} title
   * @param {string} description
   * @returns {EmbedBuilder}
   */
  function success(guildId, title, description) {
    return new EmbedBuilder()
      .setColor(getColor('success', guildId))
      .setTitle(`${BOT_CONFIG.botEmoji.success} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Build an error embed.
   * @param {string} guildId
   * @param {string} title
   * @param {string} description
   * @returns {EmbedBuilder}
   */
  function error(guildId, title, description) {
    return new EmbedBuilder()
      .setColor(getColor('error', guildId))
      .setTitle(`${BOT_CONFIG.botEmoji.error} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Build a warning embed.
   * @param {string} guildId
   * @param {string} title
   * @param {string} description
   * @returns {EmbedBuilder}
   */
  function warning(guildId, title, description) {
    return new EmbedBuilder()
      .setColor(getColor('warning', guildId))
      .setTitle(`${BOT_CONFIG.botEmoji.warning} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Build an info embed.
   * @param {string} guildId
   * @param {string} title
   * @param {string} description
   * @returns {EmbedBuilder}
   */
  function info(guildId, title, description) {
    return new EmbedBuilder()
      .setColor(getColor('info', guildId))
      .setTitle(`${BOT_CONFIG.botEmoji.info} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Build a plain (branded) embed.
   * @param {string} guildId
   * @returns {EmbedBuilder}
   */
  function base(guildId) {
    return new EmbedBuilder()
      .setColor(getColor('embed', guildId))
      .setTimestamp()
      .setFooter({ text: `${BOT_CONFIG.botName} v${BOT_CONFIG.botVersion}` });
  }

  /**
   * Build a loading/progress embed.
   * @param {string} guildId
   * @param {string} title
   * @param {string} description
   * @returns {EmbedBuilder}
   */
  function loading(guildId, title, description) {
    return new EmbedBuilder()
      .setColor(getColor('info', guildId))
      .setTitle(`${BOT_CONFIG.botEmoji.loading} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  return { getColor, success, error, warning, info, base, loading };
})();

// ══════════════════════════════════════════════════════════════════════
//  ██████╗  █████╗  ██████╗██╗  ██╗██╗   ██╗██████╗     ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗
//  ██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██║   ██║██╔══██╗    ██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝
//  ██████╔╝███████║██║     █████╔╝ ██║   ██║██████╔╝    █████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗
//  ██╔══██╗██╔══██║██║     ██╔═██╗ ██║   ██║██╔═══╝     ██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝
//  ██████╔╝██║  ██║╚██████╗██║  ██╗╚██████╔╝██║         ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗
//  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝         ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
//  §7 — BACKUP ENGINE
// ══════════════════════════════════════════════════════════════════════

/**
 * BackupEngine — creates, validates, and diffs guild backups.
 *
 * Backup schema:
 * {
 *   id:         string,
 *   version:    string,
 *   name:       string,    (user-given label or auto)
 *   guildId:    string,
 *   guildName:  string,
 *   createdAt:  number,
 *   createdBy:  string,    (user ID)
 *   size:       number,    (bytes)
 *   checksum:   string,    (simple hash for integrity)
 *   metadata: {
 *     memberCount: number,
 *     boostLevel:  number,
 *     features:    string[],
 *     iconURL:     string|null,
 *   },
 *   data: {
 *     roles:    RoleData[],
 *     categories: CategoryData[],
 *     channels: ChannelData[],
 *     emojis:   EmojiData[],
 *     stickers: StickerData[],
 *     bans:     BanData[],     (optional)
 *   }
 * }
 */
const BackupEngine = (() => {

  // ── Channel type map ────────────────────────────────────────────
  const CHANNEL_TYPE_NAMES = {
    [ChannelType.GuildText]:           'text',
    [ChannelType.GuildVoice]:          'voice',
    [ChannelType.GuildCategory]:       'category',
    [ChannelType.GuildAnnouncement]:   'announcement',
    [ChannelType.GuildStageVoice]:     'stage',
    [ChannelType.GuildForum]:          'forum',
    [ChannelType.GuildMedia]:          'media',
  };

  /**
   * Compute a simple checksum for backup integrity validation.
   * @param {object} data
   * @returns {string}
   */
  function computeChecksum(data) {
    const str  = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr  = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }

  /**
   * Serialize a permission overwrite collection.
   * @param {import('discord.js').Collection} overwrites
   * @returns {object[]}
   */
  function serializeOverwrites(overwrites) {
    return overwrites.cache.map((ow) => ({
      id:    ow.id,
      type:  ow.type, // 0 = role, 1 = member
      allow: ow.allow.bitfield.toString(),
      deny:  ow.deny.bitfield.toString(),
    }));
  }

  /**
   * Serialize all roles in a guild.
   * @param {import('discord.js').Guild} guild
   * @returns {object[]}
   */
  function serializeRoles(guild) {
    return guild.roles.cache
      .filter((r) => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id:          r.id,
        name:        r.name,
        color:       r.color,
        hoist:       r.hoist,
        mentionable: r.mentionable,
        permissions: r.permissions.bitfield.toString(),
        position:    r.position,
        managed:     r.managed,
        unicode_emoji: r.unicodeEmoji || null,
        icon:        r.iconURL() || null,
      }));
  }

  /**
   * Serialize a single channel (text, voice, forum, etc.).
   * @param {import('discord.js').GuildBasedChannel} channel
   * @returns {object}
   */
  function serializeChannel(channel) {
    const base = {
      id:       channel.id,
      name:     channel.name,
      type:     channel.type,
      typeName: CHANNEL_TYPE_NAMES[channel.type] || 'unknown',
      position: channel.rawPosition,
      parentId: channel.parentId || null,
      overwrites: serializeOverwrites(channel.permissionOverwrites),
      nsfw:     channel.nsfw || false,
      topic:    channel.topic || null,
      slowmode: channel.rateLimitPerUser || 0,
    };

    // Voice-specific
    if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
      base.bitrate    = channel.bitrate;
      base.userLimit  = channel.userLimit;
      base.rtcRegion  = channel.rtcRegion || null;
    }

    // Forum-specific
    if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
      base.availableTags = (channel.availableTags || []).map((t) => ({
        id:        t.id,
        name:      t.name,
        moderated: t.moderated,
        emoji:     t.emoji || null,
      }));
      base.defaultAutoArchiveDuration = channel.defaultAutoArchiveDuration || null;
      base.defaultReactionEmoji       = channel.defaultReactionEmoji || null;
    }

    // Announcement/text
    if (channel.type === ChannelType.GuildAnnouncement || channel.type === ChannelType.GuildText) {
      base.defaultAutoArchiveDuration = channel.defaultAutoArchiveDuration || null;
    }

    return base;
  }

  /**
   * Serialize categories and their channels.
   * @param {import('discord.js').Guild} guild
   * @returns {{ categories: object[], channels: object[] }}
   */
  function serializeChannels(guild) {
    const categories = [];
    const channels   = [];

    for (const [, channel] of guild.channels.cache) {
      if (channel.type === ChannelType.GuildCategory) {
        categories.push(serializeChannel(channel));
      } else {
        channels.push(serializeChannel(channel));
      }
    }

    // Sort by position
    categories.sort((a, b) => a.position - b.position);
    channels.sort((a, b) => a.position - b.position);

    return { categories, channels };
  }

  /**
   * Serialize all emojis in a guild.
   * @param {import('discord.js').Guild} guild
   * @returns {object[]}
   */
  function serializeEmojis(guild) {
    return guild.emojis.cache.map((e) => ({
      id:       e.id,
      name:     e.name,
      animated: e.animated,
      url:      e.url,
    }));
  }

  /**
   * Serialize all stickers in a guild.
   * @param {import('discord.js').Guild} guild
   * @returns {object[]}
   */
  function serializeStickers(guild) {
    return guild.stickers.cache.map((s) => ({
      id:          s.id,
      name:        s.name,
      description: s.description,
      tags:        s.tags,
      url:         s.url,
      format:      s.format,
    }));
  }

  /**
   * Validate a backup object for integrity and completeness.
   * @param {object} backup
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate(backup) {
    const errors = [];

    if (!backup)                     errors.push('Backup is null or undefined');
    if (!backup.id)                  errors.push('Missing backup ID');
    if (!backup.guildId)             errors.push('Missing guild ID');
    if (!backup.createdAt)           errors.push('Missing createdAt timestamp');
    if (!backup.data)                errors.push('Missing backup data');
    if (!backup.checksum)            errors.push('Missing checksum');

    if (backup.data) {
      if (!Array.isArray(backup.data.roles))      errors.push('data.roles is not an array');
      if (!Array.isArray(backup.data.categories)) errors.push('data.categories is not an array');
      if (!Array.isArray(backup.data.channels))   errors.push('data.channels is not an array');
      if (!Array.isArray(backup.data.emojis))     errors.push('data.emojis is not an array');

      // Verify checksum
      if (backup.checksum) {
        const computed = computeChecksum(backup.data);
        if (computed !== backup.checksum) {
          errors.push(`Checksum mismatch: expected ${backup.checksum}, got ${computed} — backup may be corrupted`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Compute a diff between two backup data objects.
   * Returns added/removed/changed counts per category.
   * @param {object} oldBackup
   * @param {object} newBackup
   * @returns {object}
   */
  function diff(oldBackup, newBackup) {
    const result = {
      roles:      { added: 0, removed: 0, changed: 0 },
      channels:   { added: 0, removed: 0, changed: 0 },
      categories: { added: 0, removed: 0, changed: 0 },
      emojis:     { added: 0, removed: 0, changed: 0 },
      stickers:   { added: 0, removed: 0, changed: 0 },
    };

    /**
     * @param {object[]} oldArr
     * @param {object[]} newArr
     * @param {string} key — key name used as section label
     */
    function diffArrays(oldArr, newArr, key) {
      const oldMap = new Map((oldArr || []).map((x) => [x.id, x]));
      const newMap = new Map((newArr || []).map((x) => [x.id, x]));

      for (const [id, item] of newMap) {
        if (!oldMap.has(id)) {
          result[key].added++;
        } else {
          const oldStr = JSON.stringify(oldMap.get(id));
          const newStr = JSON.stringify(item);
          if (oldStr !== newStr) result[key].changed++;
        }
      }
      for (const [id] of oldMap) {
        if (!newMap.has(id)) result[key].removed++;
      }
    }

    diffArrays(oldBackup.data.roles,      newBackup.data.roles,      'roles');
    diffArrays(oldBackup.data.channels,   newBackup.data.channels,   'channels');
    diffArrays(oldBackup.data.categories, newBackup.data.categories, 'categories');
    diffArrays(oldBackup.data.emojis,     newBackup.data.emojis,     'emojis');
    diffArrays(oldBackup.data.stickers,   newBackup.data.stickers,   'stickers');

    return result;
  }

  /**
   * Main backup creation function.
   * @param {import('discord.js').Guild} guild
   * @param {string} createdBy — user ID
   * @param {string} [label]   — optional custom name
   * @returns {Promise<object>} — the backup object
   */
  async function create(guild, createdBy, label) {
    Logger.info('BackupEngine', `Starting backup for guild ${guild.id} (${guild.name})`);

    // Fetch all channels (ensure cache is fresh)
    await guild.channels.fetch();
    await guild.roles.fetch();
    await guild.emojis.fetch();
    await guild.stickers.fetch();

    const { categories, channels } = serializeChannels(guild);
    const roles    = serializeRoles(guild);
    const emojis   = serializeEmojis(guild);
    const stickers = serializeStickers(guild);

    const data = { roles, categories, channels, emojis, stickers };
    const checksum  = computeChecksum(data);
    const id        = generateId();
    const createdAt = Date.now();

    const backup = {
      id,
      version:   BOT_CONFIG.botVersion,
      name:      label || `Backup ${new Date(createdAt).toLocaleDateString('fr-FR')}`,
      guildId:   guild.id,
      guildName: guild.name,
      createdAt,
      createdBy,
      size: getObjectSize(data),
      checksum,
      metadata: {
        memberCount:   guild.memberCount,
        boostLevel:    guild.premiumTier,
        features:      guild.features,
        iconURL:       guild.iconURL() || null,
        bannerURL:     guild.bannerURL() || null,
        description:   guild.description || null,
        verificationLevel: guild.verificationLevel,
      },
      data,
    };

    Logger.info('BackupEngine', `Backup ${id} created: ${roles.length} roles, ${categories.length} categories, ${channels.length} channels, ${emojis.length} emojis, ${stickers.length} stickers`);

    DataManager.saveBackup(guild.id, backup);
return backup;
  }

  return { create, validate, diff, computeChecksum, serializeChannel, serializeRoles };
})();

// ══════════════════════════════════════════════════════════════════════
//  ██████╗ ███████╗███████╗████████╗ ██████╗ ██████╗ ███████╗
//  ██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝
//  ██████╔╝█████╗  ███████╗   ██║   ██║   ██║██████╔╝█████╗
//  ██╔══██╗██╔══╝  ╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝
//  ██║  ██║███████╗███████║   ██║   ╚██████╔╝██║  ██║███████╗
//  ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
//  ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗
//  ██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝
//  █████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗
//  ██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝
//  ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗
//  ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
//  §8 — RESTORE ENGINE
// ══════════════════════════════════════════════════════════════════════

/**
 * RestoreEngine — handles full and safe restore of a guild from a backup.
 *
 * Modes:
 *   FULL  — deletes all existing roles/channels/emojis/stickers then recreates from backup
 *   SAFE  — only adds missing items; never deletes existing ones
 */
const RestoreEngine = (() => {
  const DELAY = BOT_CONFIG.restoreRateLimitDelay;

  // ── Progress tracker ────────────────────────────────────────────

  /**
   * @typedef {object} ProgressState
   * @property {number} total
   * @property {number} done
   * @property {string} phase
   * @property {string[]} log
   */

  /** @returns {ProgressState} */
  function createProgress(total) {
    return { total, done: 0, phase: 'init', log: [] };
  }

  /**
   * Update progress and optionally update a Discord message.
   * @param {ProgressState} prog
   * @param {string} phase
   * @param {import('discord.js').Message} [msg]
   * @param {string} guildId
   */
  async function updateProgress(prog, phase, msg, guildId) {
    prog.phase = phase;
    prog.log.push(phase);
    const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
    const bar = buildProgressBar(pct);

    if (msg) {
      try {
        const embed = EmbedFactory.loading(guildId, 'Restore en cours…', [
          `**Phase :** ${phase}`,
          `**Progression :** ${bar} ${pct}%`,
          `**Opérations :** ${prog.done}/${prog.total}`,
        ].join('\n'));
        await msg.edit({ embeds: [embed] });
      } catch (_) { /* Message may have been deleted */ }
    }
  }

  /**
   * Build a progress bar string.
   * @param {number} pct 0–100
   * @returns {string}
   */
  function buildProgressBar(pct) {
    const filled = Math.round(pct / 5);
    const empty  = 20 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  // ── Deletion helpers ────────────────────────────────────────────

  /**
   * Delete all non-managed roles (except @everyone).
   * @param {import('discord.js').Guild} guild
   * @param {ProgressState} prog
   * @param {import('discord.js').Message} [msg]
   */
  async function deleteAllRoles(guild, prog, msg) {
    const roles = guild.roles.cache.filter(
      (r) => !r.managed && r.name !== '@everyone' && r.position < guild.members.me.roles.highest.position
    );
    for (const [, role] of roles) {
      try {
        await role.delete('VaultBot Full Restore');
        await sleep(DELAY);
        prog.done++;
        if (prog.done % BOT_CONFIG.restoreProgressInterval === 0) {
          await updateProgress(prog, `🗑️ Suppression rôles (${prog.done}/${prog.total})`, msg, guild.id);
        }
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not delete role ${role.name}: ${err.message}`);
      }
    }
  }

  /**
   * Delete all channels and categories.
   * @param {import('discord.js').Guild} guild
   * @param {ProgressState} prog
   * @param {import('discord.js').Message} [msg]
   */
  async function deleteAllChannels(guild, prog, msg) {
    const channels = guild.channels.cache;
    for (const [, channel] of channels) {
      try {
        await channel.delete('VaultBot Full Restore');
        await sleep(DELAY);
        prog.done++;
        if (prog.done % BOT_CONFIG.restoreProgressInterval === 0) {
          await updateProgress(prog, `🗑️ Suppression salons (${prog.done}/${prog.total})`, msg, guild.id);
        }
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not delete channel ${channel.name}: ${err.message}`);
      }
    }
  }

  /**
   * Delete all custom emojis.
   * @param {import('discord.js').Guild} guild
   */
  async function deleteAllEmojis(guild) {
    for (const [, emoji] of guild.emojis.cache) {
      try {
        await emoji.delete('VaultBot Full Restore');
        await sleep(DELAY);
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not delete emoji ${emoji.name}: ${err.message}`);
      }
    }
  }

  /**
   * Delete all custom stickers.
   * @param {import('discord.js').Guild} guild
   */
  async function deleteAllStickers(guild) {
    for (const [, sticker] of guild.stickers.cache) {
      try {
        await sticker.delete('VaultBot Full Restore');
        await sleep(DELAY);
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not delete sticker ${sticker.name}: ${err.message}`);
      }
    }
  }

  // ── Creation helpers ────────────────────────────────────────────

  /**
   * Restore all roles from backup data.
   * Returns a map of old role ID → new role ID.
   * @param {import('discord.js').Guild} guild
   * @param {object[]} rolesData
   * @param {ProgressState} prog
   * @param {import('discord.js').Message} [msg]
   * @param {boolean} safeMode — skip existing roles by name
   * @returns {Promise<Map<string, string>>}
   */
  async function restoreRoles(guild, rolesData, prog, msg, safeMode) {
    const roleMap = new Map(); // old ID → new ID

    // Sort by position ascending (lowest first) to maintain hierarchy
    const sorted = [...rolesData].sort((a, b) => a.position - b.position);

    for (const roleData of sorted) {
      try {
        if (roleData.managed) {
          // Managed (bot) roles can't be created — skip but record
          Logger.debug('RestoreEngine', `Skipping managed role: ${roleData.name}`);
          continue;
        }

        // In safe mode, check if role with same name already exists
        if (safeMode) {
          const existing = guild.roles.cache.find((r) => r.name === roleData.name);
          if (existing) {
            roleMap.set(roleData.id, existing.id);
            prog.done++;
            continue;
          }
        }

        const created = await guild.roles.create({
          name:        roleData.name,
          color:       roleData.color,
          hoist:       roleData.hoist,
          mentionable: roleData.mentionable,
          permissions: BigInt(roleData.permissions),
          reason:      'VaultBot Restore',
        });

        roleMap.set(roleData.id, created.id);
        prog.done++;
        await sleep(DELAY);

        if (prog.done % BOT_CONFIG.restoreProgressInterval === 0) {
          await updateProgress(prog, `🎭 Restauration rôles (${prog.done}/${prog.total})`, msg, guild.id);
        }
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not create role ${roleData.name}: ${err.message}`);
      }
    }

    return roleMap;
  }

  /**
   * Build permission overwrites array for a channel.
   * Translates old role IDs → new role IDs using roleMap.
   * @param {object[]} overwrites
   * @param {Map<string, string>} roleMap
   * @returns {object[]}
   */
  function buildOverwrites(overwrites, roleMap) {
    return overwrites.map((ow) => {
      const resolvedId = ow.type === 0 ? (roleMap.get(ow.id) || ow.id) : ow.id;
      return {
        id:    resolvedId,
        type:  ow.type,
        allow: BigInt(ow.allow),
        deny:  BigInt(ow.deny),
      };
    }).filter((ow) => {
      // Remove overwrites with IDs that no longer exist
      return ow.id !== undefined;
    });
  }

  /**
   * Restore all categories from backup data.
   * Returns a map of old category ID → new category ID.
   * @param {import('discord.js').Guild} guild
   * @param {object[]} categoriesData
   * @param {Map<string, string>} roleMap
   * @param {ProgressState} prog
   * @param {import('discord.js').Message} [msg]
   * @param {boolean} safeMode
   * @returns {Promise<Map<string, string>>}
   */
  async function restoreCategories(guild, categoriesData, roleMap, prog, msg, safeMode) {
    const catMap = new Map();
    const sorted = [...categoriesData].sort((a, b) => a.position - b.position);

    for (const catData of sorted) {
      try {
        if (safeMode) {
          const existing = guild.channels.cache.find(
            (c) => c.name === catData.name && c.type === ChannelType.GuildCategory
          );
          if (existing) {
            catMap.set(catData.id, existing.id);
            prog.done++;
            continue;
          }
        }

        const overwrites = buildOverwrites(catData.overwrites || [], roleMap);

        const created = await guild.channels.create({
          name:                 catData.name,
          type:                 ChannelType.GuildCategory,
          position:             catData.position,
          permissionOverwrites: overwrites,
          reason:               'VaultBot Restore',
        });

        catMap.set(catData.id, created.id);
        prog.done++;
        await sleep(DELAY);

        if (prog.done % BOT_CONFIG.restoreProgressInterval === 0) {
          await updateProgress(prog, `📂 Restauration catégories (${prog.done}/${prog.total})`, msg, guild.id);
        }
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not create category ${catData.name}: ${err.message}`);
      }
    }

    return catMap;
  }

  /**
   * Restore all channels (text, voice, forum, etc.) from backup.
   * @param {import('discord.js').Guild} guild
   * @param {object[]} channelsData
   * @param {Map<string, string>} roleMap
   * @param {Map<string, string>} catMap
   * @param {ProgressState} prog
   * @param {import('discord.js').Message} [msg]
   * @param {boolean} safeMode
   */
  async function restoreChannels(guild, channelsData, roleMap, catMap, prog, msg, safeMode) {
    const sorted = [...channelsData].sort((a, b) => a.position - b.position);

    for (const chData of sorted) {
      try {
        if (safeMode) {
          const existing = guild.channels.cache.find(
            (c) => c.name === chData.name && c.type === chData.type
          );
          if (existing) {
            prog.done++;
            continue;
          }
        }

        const overwrites  = buildOverwrites(chData.overwrites || [], roleMap);
        const resolvedCat = chData.parentId ? (catMap.get(chData.parentId) || null) : null;

        const options = {
          name:                 chData.name,
          type:                 chData.type,
          position:             chData.position,
          parent:               resolvedCat,
          permissionOverwrites: overwrites,
          nsfw:                 chData.nsfw || false,
          reason:               'VaultBot Restore',
        };

        // Text-specific
        if (chData.topic)    options.topic    = chData.topic;
        if (chData.slowmode) options.rateLimitPerUser = chData.slowmode;

        // Voice-specific
        if (chData.type === ChannelType.GuildVoice || chData.type === ChannelType.GuildStageVoice) {
          options.bitrate   = chData.bitrate   || 64000;
          options.userLimit = chData.userLimit  || 0;
          if (chData.rtcRegion) options.rtcRegion = chData.rtcRegion;
        }

        // Forum-specific
        if (chData.type === ChannelType.GuildForum) {
          if (chData.availableTags && chData.availableTags.length > 0) {
            options.availableTags = chData.availableTags.map((t) => ({
              name:      t.name,
              moderated: t.moderated || false,
            }));
          }
          if (chData.defaultAutoArchiveDuration) {
            options.defaultAutoArchiveDuration = chData.defaultAutoArchiveDuration;
          }
        }

        await guild.channels.create(options);
        prog.done++;
        await sleep(DELAY);

        if (prog.done % BOT_CONFIG.restoreProgressInterval === 0) {
          await updateProgress(prog, `💬 Restauration salons (${prog.done}/${prog.total})`, msg, guild.id);
        }
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not create channel ${chData.name}: ${err.message}`);
      }
    }
  }

  /**
   * Restore emojis from backup.
   * @param {import('discord.js').Guild} guild
   * @param {object[]} emojisData
   * @param {ProgressState} prog
   * @param {import('discord.js').Message} [msg]
   * @param {boolean} safeMode
   */
  async function restoreEmojis(guild, emojisData, prog, msg, safeMode) {
    for (const emojiData of emojisData) {
      try {
        if (safeMode) {
          const exists = guild.emojis.cache.find((e) => e.name === emojiData.name);
          if (exists) { prog.done++; continue; }
        }

        await guild.emojis.create({
          attachment: emojiData.url,
          name:       emojiData.name,
          reason:     'VaultBot Restore',
        });

        prog.done++;
        await sleep(DELAY * 2); // Emojis need more delay

        if (prog.done % BOT_CONFIG.restoreProgressInterval === 0) {
          await updateProgress(prog, `😀 Restauration emojis (${prog.done}/${prog.total})`, msg, guild.id);
        }
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not create emoji ${emojiData.name}: ${err.message}`);
      }
    }
  }

  /**
   * Restore stickers from backup.
   * @param {import('discord.js').Guild} guild
   * @param {object[]} stickersData
   * @param {ProgressState} prog
   * @param {import('discord.js').Message} [msg]
   * @param {boolean} safeMode
   */
  async function restoreStickers(guild, stickersData, prog, msg, safeMode) {
    for (const stickerData of stickersData) {
      try {
        if (safeMode) {
          const exists = guild.stickers.cache.find((s) => s.name === stickerData.name);
          if (exists) { prog.done++; continue; }
        }

        await guild.stickers.create({
          file:        stickerData.url,
          name:        stickerData.name,
          description: stickerData.description || stickerData.name,
          tags:        stickerData.tags || stickerData.name,
          reason:      'VaultBot Restore',
        });

        prog.done++;
        await sleep(DELAY * 2);
      } catch (err) {
        Logger.warn('RestoreEngine', `Could not create sticker ${stickerData.name}: ${err.message}`);
      }
    }
  }

  // ── Main restore functions ───────────────────────────────────────

  /**
   * Perform a FULL restore: clear everything and rebuild from backup.
   * @param {import('discord.js').Guild} guild
   * @param {object} backup
   * @param {import('discord.js').Message} progressMsg
   * @returns {Promise<{ success: boolean, duration: number, errors: string[] }>}
   */
  async function restoreFull(guild, backup, progressMsg) {
    const startTime = Date.now();
    const errors    = [];

    const { data } = backup;
    const totalOps =
      guild.roles.cache.size +
      guild.channels.cache.size +
      data.roles.length +
      data.categories.length +
      data.channels.length +
      data.emojis.length +
      data.stickers.length;

    const prog = createProgress(totalOps);

    Logger.info('RestoreEngine', `[FULL] Starting for guild ${guild.id} — ${totalOps} operations`);

    try {
      // Phase 1: Delete existing channels
      await updateProgress(prog, '🗑️ Suppression des salons existants…', progressMsg, guild.id);
      await deleteAllChannels(guild, prog, progressMsg);

      // Phase 2: Delete existing roles
      await updateProgress(prog, '🗑️ Suppression des rôles existants…', progressMsg, guild.id);
      await deleteAllRoles(guild, prog, progressMsg);

      // Phase 3: Delete existing emojis/stickers
      await updateProgress(prog, '🗑️ Suppression des emojis/stickers existants…', progressMsg, guild.id);
      await deleteAllEmojis(guild);
      await deleteAllStickers(guild);

      // Re-fetch fresh state
      await guild.channels.fetch();
      await guild.roles.fetch();
      await guild.emojis.fetch();
      await guild.stickers.fetch();

      // Phase 4: Restore roles
      await updateProgress(prog, '🎭 Restauration des rôles…', progressMsg, guild.id);
      const roleMap = await restoreRoles(guild, data.roles, prog, progressMsg, false);

      // Phase 5: Restore categories
      await updateProgress(prog, '📂 Restauration des catégories…', progressMsg, guild.id);
      const catMap = await restoreCategories(guild, data.categories, roleMap, prog, progressMsg, false);

      // Phase 6: Restore channels
      await updateProgress(prog, '💬 Restauration des salons…', progressMsg, guild.id);
      await restoreChannels(guild, data.channels, roleMap, catMap, prog, progressMsg, false);

      // Phase 7: Restore emojis
      await updateProgress(prog, '😀 Restauration des emojis…', progressMsg, guild.id);
      await restoreEmojis(guild, data.emojis, prog, progressMsg, false);

      // Phase 8: Restore stickers
      await updateProgress(prog, '🎟️ Restauration des stickers…', progressMsg, guild.id);
      await restoreStickers(guild, data.stickers, prog, progressMsg, false);

      DataManager.incrementRestores();

      const duration = Date.now() - startTime;
      Logger.info('RestoreEngine', `[FULL] Done for guild ${guild.id} in ${formatDuration(duration)}`);
      return { success: true, duration, errors };

    } catch (err) {
      errors.push(err.message);
      Logger.error('RestoreEngine', `[FULL] Fatal error: ${err.message}`);
      return { success: false, duration: Date.now() - startTime, errors };
    }
  }

  /**
   * Perform a SAFE restore: add missing items without deleting existing.
   * @param {import('discord.js').Guild} guild
   * @param {object} backup
   * @param {import('discord.js').Message} progressMsg
   * @returns {Promise<{ success: boolean, duration: number, errors: string[] }>}
   */
  async function restoreSafe(guild, backup, progressMsg) {
    const startTime = Date.now();
    const errors    = [];

    const { data } = backup;
    const totalOps =
      data.roles.length +
      data.categories.length +
      data.channels.length +
      data.emojis.length +
      data.stickers.length;

    const prog = createProgress(totalOps);

    Logger.info('RestoreEngine', `[SAFE] Starting for guild ${guild.id} — ${totalOps} operations`);

    try {
      await guild.channels.fetch();
      await guild.roles.fetch();
      await guild.emojis.fetch();
      await guild.stickers.fetch();

      await updateProgress(prog, '🎭 Ajout des rôles manquants…', progressMsg, guild.id);
      const roleMap = await restoreRoles(guild, data.roles, prog, progressMsg, true);

      await updateProgress(prog, '📂 Ajout des catégories manquantes…', progressMsg, guild.id);
      const catMap = await restoreCategories(guild, data.categories, roleMap, prog, progressMsg, true);

      await updateProgress(prog, '💬 Ajout des salons manquants…', progressMsg, guild.id);
      await restoreChannels(guild, data.channels, roleMap, catMap, prog, progressMsg, true);

      await updateProgress(prog, '😀 Ajout des emojis manquants…', progressMsg, guild.id);
      await restoreEmojis(guild, data.emojis, prog, progressMsg, true);

      await updateProgress(prog, '🎟️ Ajout des stickers manquants…', progressMsg, guild.id);
      await restoreStickers(guild, data.stickers, prog, progressMsg, true);

      DataManager.incrementRestores();

      const duration = Date.now() - startTime;
      Logger.info('RestoreEngine', `[SAFE] Done for guild ${guild.id} in ${formatDuration(duration)}`);
      return { success: true, duration, errors };

    } catch (err) {
      errors.push(err.message);
      Logger.error('RestoreEngine', `[SAFE] Fatal error: ${err.message}`);
      return { success: false, duration: Date.now() - startTime, errors };
    }
  }

  /**
   * Generate a text preview of what a restore would do.
   * @param {import('discord.js').Guild} guild
   * @param {object} backup
   * @param {'full'|'safe'} mode
   * @returns {string}
   */
  function generatePreview(guild, backup, mode) {
    const { data } = backup;
    const lines    = [];

    if (mode === 'full') {
      lines.push(`🗑️ **SUPPRESSION** : ${guild.roles.cache.size} rôles, ${guild.channels.cache.size} salons, ${guild.emojis.cache.size} emojis, ${guild.stickers.cache.size} stickers`);
      lines.push('');
    }

    lines.push(`🎭 **Rôles à créer** : ${data.roles.filter((r) => !r.managed).length}`);
    lines.push(`📂 **Catégories à créer** : ${data.categories.length}`);
    lines.push(`💬 **Salons à créer** : ${data.channels.length}`);
    lines.push(`😀 **Emojis à créer** : ${data.emojis.length}`);
    lines.push(`🎟️ **Stickers à créer** : ${data.stickers.length}`);

    const totalOps = data.roles.length + data.categories.length + data.channels.length + data.emojis.length + data.stickers.length;
    const estimatedSec = Math.ceil((totalOps * DELAY) / 1000);
    lines.push('');
    lines.push(`⏱️ **Durée estimée** : ~${formatDuration(estimatedSec * 1000)}`);

    return lines.join('\n');
  }

  return { restoreFull, restoreSafe, generatePreview, buildProgressBar };
})();

// ══════════════════════════════════════════════════════════════════════
//   █████╗ ██╗   ██╗████████╗ ██████╗     ██████╗  █████╗  ██████╗██╗  ██╗██╗   ██╗██████╗
//  ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗    ██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██║   ██║██╔══██╗
//  ███████║██║   ██║   ██║   ██║   ██║    ██████╔╝███████║██║     █████╔╝ ██║   ██║██████╔╝
//  ██╔══██║██║   ██║   ██║   ██║   ██║    ██╔══██╗██╔══██║██║     ██╔═██╗ ██║   ██║██╔═══╝
//  ██║  ██║╚██████╔╝   ██║   ╚██████╔╝    ██████╔╝██║  ██║╚██████╗██║  ██╗╚██████╔╝██║
//  ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝
//  §9 — AUTO BACKUP SCHEDULER
// ══════════════════════════════════════════════════════════════════════

/**
 * AutoBackup — manages automatic periodic backup for each guild.
 */
const AutoBackup = (() => {
  /** @type {Map<string, NodeJS.Timeout>} guildId → timer */
  const timers = new Map();

  /**
   * Schedule the next auto-backup for a guild.
   * @param {string} guildId
   * @param {import('discord.js').Client} client
   */
  function schedule(guildId, client) {
    // Clear existing timer
    if (timers.has(guildId)) {
      clearTimeout(timers.get(guildId));
      timers.delete(guildId);
    }

    const cfg = DataManager.getGuild(guildId);
    if (!cfg.autoBackup) return;

    const interval = (cfg.autoInterval || 60) * 60 * 1000; // minutes → ms
    const nextTs   = cfg.nextAutoBackup;
    const now      = Date.now();
    const delay    = nextTs && nextTs > now ? nextTs - now : interval;

    Logger.info('AutoBackup', `Guild ${guildId}: next auto-backup in ${formatDuration(delay)}`);

    const timer = setTimeout(async () => {
      await run(guildId, client);
    }, delay);

    timers.set(guildId, timer);
  }

  /**
   * Run an auto-backup for a guild.
   * @param {string} guildId
   * @param {import('discord.js').Client} client
   */
  async function run(guildId, client) {
    Logger.info('AutoBackup', `Running auto-backup for guild ${guildId}`);

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        Logger.warn('AutoBackup', `Guild ${guildId} not found — disabling auto-backup`);
        DataManager.updateGuild(guildId, { autoBackup: false });
        timers.delete(guildId);
        return;
      }

      // Create backup
      const backup = await BackupEngine.create(guild, client.user.id, 'Auto-Backup');

      // Compute next backup time
      const cfg      = DataManager.getGuild(guildId);
      const interval = (cfg.autoInterval || 60) * 60 * 1000;
      const nextTs   = Date.now() + interval;
      DataManager.updateGuild(guildId, { nextAutoBackup: nextTs });

      // Re-schedule
      schedule(guildId, client);

      Logger.info('AutoBackup', `Auto-backup ${backup.id} created for guild ${guildId}`);

      // Log to channel if configured
      const logChId = cfg.logChannel;
      if (logChId) {
        try {
          const ch = await guild.channels.fetch(logChId).catch(() => null);
          if (ch && ch.isTextBased()) {
            const embed = EmbedFactory.success(guildId, 'Auto-Backup Créé', [
              `**ID :** \`${backup.id}\``,
              `**Serveur :** ${guild.name}`,
              `**Taille :** ${formatBytes(backup.size)}`,
              `**Prochain :** <t:${Math.floor(nextTs / 1000)}:R>`,
            ].join('\n'));
            await ch.send({ embeds: [embed] });
          }
        } catch (err) {
          Logger.warn('AutoBackup', `Could not send log to channel: ${err.message}`);
        }
      }
    } catch (err) {
      Logger.error('AutoBackup', `Auto-backup failed for guild ${guildId}: ${err.message}`);

      // Reschedule even on error
      const cfg = DataManager.getGuild(guildId);
      if (cfg.autoBackup) {
        const interval = (cfg.autoInterval || 60) * 60 * 1000;
        DataManager.updateGuild(guildId, { nextAutoBackup: Date.now() + interval });
        schedule(guildId, client);
      }
    }
  }

  /**
   * Enable auto-backup for a guild.
   * @param {string} guildId
   * @param {number} intervalMinutes
   * @param {import('discord.js').Client} client
   */
  function enable(guildId, intervalMinutes, client) {
    const interval = Math.max(
      BOT_CONFIG.minAutoBackupInterval,
      Math.min(BOT_CONFIG.maxAutoBackupInterval, intervalMinutes)
    );
    DataManager.updateGuild(guildId, {
      autoBackup:     true,
      autoInterval:   interval,
      nextAutoBackup: Date.now() + interval * 60 * 1000,
    });
    schedule(guildId, client);
    Logger.info('AutoBackup', `Enabled for guild ${guildId} every ${interval} minutes`);
  }

  /**
   * Disable auto-backup for a guild.
   * @param {string} guildId
   */
  function disable(guildId) {
    if (timers.has(guildId)) {
      clearTimeout(timers.get(guildId));
      timers.delete(guildId);
    }
    DataManager.updateGuild(guildId, { autoBackup: false, nextAutoBackup: null });
    Logger.info('AutoBackup', `Disabled for guild ${guildId}`);
  }

  /**
   * Initialize auto-backups for all guilds on startup.
   * @param {import('discord.js').Client} client
   */
  function initAll(client) {
    const guilds = DataManager.getAllGuilds();
    let count = 0;
    for (const [guildId, cfg] of Object.entries(guilds)) {
      if (cfg.autoBackup) {
        schedule(guildId, client);
        count++;
      }
    }
    Logger.info('AutoBackup', `Initialized ${count} auto-backup schedules`);
  }

  return { schedule, enable, disable, initAll };
})();

// ══════════════════════════════════════════════════════════════════════
//  ██████╗  ██████╗ ██╗   ██╗████████╗██╗███╗   ██╗ ██████╗
//  ██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██║████╗  ██║██╔════╝
//  ██████╔╝██║   ██║██║   ██║   ██║   ██║██╔██╗ ██║██║  ███╗
//  ██╔══██╗██║   ██║██║   ██║   ██║   ██║██║╚██╗██║██║   ██║
//  ██║  ██║╚██████╔╝╚██████╔╝   ██║   ██║██║ ╚████║╚██████╔╝
//  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚═╝╚═╝  ╚═══╝ ╚═════╝
//  §10 — COMMAND ROUTING
// ══════════════════════════════════════════════════════════════════════

/**
 * CommandHandler — parses messages and routes to command handlers.
 *
 * Command format: <prefix><command> [subcommand] [...args]
 * e.g.: +backup create MyLabel
 *       +config set embedColor #FF0000
 */
const CommandHandler = (() => {

  /**
   * Parse a message into a command context.
   * @param {import('discord.js').Message} message
   * @returns {{ prefix: string, command: string, sub: string, args: string[], raw: string }|null}
   */
  function parse(message) {
    if (!message.guild || message.author.bot) return null;

    const cfg    = DataManager.getGuild(message.guild.id);
    const prefix = cfg.prefix || BOT_CONFIG.defaultPrefix;

    if (!message.content.startsWith(prefix)) return null;

    const content = message.content.slice(prefix.length).trim();
    if (!content) return null;

    const parts   = content.split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';
    const sub     = parts[1]?.toLowerCase() || '';
    const args    = parts.slice(1); // includes sub

    return { prefix, command, sub, args, raw: content };
  }

  /**
   * Route and execute the command.
   * @param {import('discord.js').Message} message
   * @param {import('discord.js').Client} client
   */
  async function route(message, client) {
    const ctx = parse(message);
    if (!ctx) return;

    const { command, sub, args } = ctx;

    Logger.debug('CommandHandler', `[${message.guild.id}] ${message.author.tag}: ${command} ${args.join(' ')}`);

    try {
      switch (command) {
        // ── Backup commands ───────────────────────────
        case 'backup':
          await handleBackupCommand(message, sub, args.slice(1), client);
          break;

        // ── Config commands ────────────────────────────
        case 'config':
          await handleConfigCommand(message, sub, args.slice(1));
          break;

        // ── Prefix shortcut ────────────────────────────
        case 'prefix':
          if (sub === 'set') {
            await handlePrefixSet(message, args.slice(1));
          }
          break;

        // ── System commands ────────────────────────────
        case 'help':
          await handleHelp(message, sub);
          break;

        case 'stats':
          await handleStats(message, client);
          break;

        case 'ping':
          await handlePing(message, client);
          break;

        default:
          // Unknown command — silently ignore (not every message is a command)
          break;
      }
    } catch (err) {
      Logger.error('CommandHandler', `Unhandled error in command ${command}: ${err.message}`, err.stack);
      try {
        const embed = EmbedFactory.error(
          message.guild.id,
          'Erreur interne',
          `Une erreur inattendue s'est produite.\n\`\`\`${err.message}\`\`\``
        );
        await message.reply({ embeds: [embed] });
      } catch (_) { /* Channel may be gone */ }
    }
  }

  return { parse, route };
})();

// ══════════════════════════════════════════════════════════════════════
//  ██████╗ █████╗  ██████╗██╗  ██╗██╗   ██╗██████╗
//  ██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██║   ██║██╔══██╗
//  ██████╔╝███████║██║     █████╔╝ ██║   ██║██████╔╝
//  ██╔══██╗██╔══██║██║     ██╔═██╗ ██║   ██║██╔═══╝
//  ██████╔╝██║  ██║╚██████╗██║  ██╗╚██████╔╝██║
//  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝
//  ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗ ███████╗
//  ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝
//  ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║███████╗
//  ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║╚════██║
//  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝███████║
//   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝
//  §11 — BACKUP COMMANDS
// ══════════════════════════════════════════════════════════════════════

/**
 * Handle all +backup subcommands.
 * @param {import('discord.js').Message} msg
 * @param {string} sub
 * @param {string[]} args
 * @param {import('discord.js').Client} client
 */
async function handleBackupCommand(msg, sub, args, client) {
  const guildId = msg.guild.id;

  // ── Permission check ───────────────────────────────────────────
  const { allowed, reason } = PermissionGuard.check(msg.member, guildId);
  if (!allowed) {
    const embed = EmbedFactory.error(guildId, 'Permission refusée', `${BOT_CONFIG.botEmoji.lock} ${reason}`);
    return msg.reply({ embeds: [embed] });
  }

  switch (sub) {
    // ─── +backup create [label] ────────────────────────────────────
case 'create': {
  // Nom du backup (label)
  const label = args.join(' ') || 'Backup';

  // Embed de chargement
  const loadEmbed = EmbedFactory.loading(
    guildId,
    'Backup en cours…',
    `${BOT_CONFIG.botEmoji.backup} Analyse du serveur et sauvegarde…`
  );

  const reply = await msg.reply({ embeds: [loadEmbed] });

  try {
    // Création du backup
    const backup = await BackupEngine.create(msg.guild, msg.author.id, label);

    // 💾 Sauvegarde locale dans DataManager
    DataManager.saveBackup(msg.guild.id, backup);

    // Embed succès
    const embed = EmbedFactory.success(
      guildId,
      'Backup Créé !',
      [
        `**ID** : \`${backup.id}\``,
        `**Nom** : ${backup.name}`,
        `**Taille** : ${formatBytes(backup.size)}`,
        `**Rôles** : ${backup.data.roles.length}`,
        `**Catégories** : ${backup.data.categories.length}`,
        `**Salons** : ${backup.data.channels.length}`,
        `**Emojis** : ${backup.data.emojis.length}`,
        `**Stickers** : ${backup.data.stickers.length}`,
        `**Checksum** : \`${backup.checksum}\``,
      ].join('\n')
    ).setFooter({
      text: `Créé par ${msg.author.tag} • VaultBot v${BOT_CONFIG.botVersion}`
    });

    await reply.edit({ embeds: [embed] });

    // Log dans un channel si besoin
    await sendLogMessage(msg.guild, 'backup_create', {
      user: msg.author,
      backup,
    });

  } catch (err) {
    Logger.error('Cmd:backup', `create error: ${err.message}`);

    const errEmbed = EmbedFactory.error(
      guildId,
      'Erreur lors du backup',
      `\`${err.message}\``
    );

    await reply.edit({ embeds: [errEmbed] });
  }

  break;
}

    // ─── +backup list ──────────────────────────────────────────────
    case 'list': {
      const backups = DataManager.getBackups(guildId);

      if (backups.length === 0) {
        const embed = EmbedFactory.info(guildId, 'Aucun backup', 'Ce serveur n\'a aucun backup stocké.\nUtilisez `+backup create` pour en créer un !');
        return msg.reply({ embeds: [embed] });
      }

      const cfg     = DataManager.getGuild(guildId);
      const maxBkps = cfg.maxBackups || BOT_CONFIG.maxBackupsPerGuild;

      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.list} Backups de ${msg.guild.name}`)
        .setDescription(`**${backups.length}/${maxBkps}** backup(s) stocké(s)`)
        .setColor(EmbedFactory.getColor('embed', guildId));

      // Sort newest first
      const sorted = [...backups].sort((a, b) => b.createdAt - a.createdAt);

      for (const b of sorted) {
        const auto = b.createdBy === client.user.id ? ' *(auto)*' : '';
        embed.addFields({
          name:   `${BOT_CONFIG.botEmoji.backup} \`${b.id}\` — ${b.name}${auto}`,
          value:  [
            `📅 ${formatDate(b.createdAt)}`,
            `📦 ${formatBytes(b.size)}`,
            `🎭 ${b.data.roles.length} rôles • 💬 ${b.data.channels.length} salons • 😀 ${b.data.emojis.length} emojis`,
          ].join('\n'),
          inline: false,
        });
      }

      return msg.reply({ embeds: [embed] });
    }

    // ─── +backup info <id> ─────────────────────────────────────────
    case 'info': {
      const id = args[0]?.toUpperCase();
      if (!id) {
        const embed = EmbedFactory.error(guildId, 'ID manquant', 'Usage : `+backup info <ID>`');
        return msg.reply({ embeds: [embed] });
      }

      const backup = DataManager.getBackup(guildId, id);
      if (!backup) {
        const embed = EmbedFactory.error(guildId, 'Backup introuvable', `Aucun backup avec l'ID \`${id}\`.`);
        return msg.reply({ embeds: [embed] });
      }

      // Validate integrity
      const { valid, errors: valErrors } = BackupEngine.validate(backup);

      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.backup} Backup \`${backup.id}\``)
        .setColor(EmbedFactory.getColor(valid ? 'success' : 'warning', guildId))
        .addFields(
          { name: '📛 Nom',          value: backup.name,                              inline: true },
          { name: '🆔 ID',           value: `\`${backup.id}\``,                       inline: true },
          { name: '📅 Date',         value: formatDate(backup.createdAt),              inline: true },
          { name: '📦 Taille',       value: formatBytes(backup.size),                  inline: true },
          { name: '🔑 Checksum',     value: `\`${backup.checksum}\``,                 inline: true },
          { name: '✅ Intégrité',    value: valid ? '✅ Valide' : `⚠️ ${valErrors[0]}`, inline: true },
          { name: '🎭 Rôles',        value: `${backup.data.roles.length}`,             inline: true },
          { name: '📂 Catégories',   value: `${backup.data.categories.length}`,        inline: true },
          { name: '💬 Salons',       value: `${backup.data.channels.length}`,          inline: true },
          { name: '😀 Emojis',       value: `${backup.data.emojis.length}`,            inline: true },
          { name: '🎟️ Stickers',    value: `${backup.data.stickers.length}`,          inline: true },
          { name: '👤 Créé par',     value: `<@${backup.createdBy}>`,                  inline: true },
        );

      if (backup.metadata) {
        embed.addFields({
          name: '📊 Métadonnées serveur',
          value: [
            `Membres : ${backup.metadata.memberCount || 'N/A'}`,
            `Boost : Niveau ${backup.metadata.boostLevel || 0}`,
            `Icône : ${backup.metadata.iconURL ? `[Lien](${backup.metadata.iconURL})` : 'Aucune'}`,
          ].join('\n'),
          inline: false,
        });
      }

      return msg.reply({ embeds: [embed] });
    }

    // ─── +backup delete <id> ───────────────────────────────────────
    case 'delete': {
      const id = args[0]?.toUpperCase();
      if (!id) {
        const embed = EmbedFactory.error(guildId, 'ID manquant', 'Usage : `+backup delete <ID>`');
        return msg.reply({ embeds: [embed] });
      }

      const backup = DataManager.getBackup(guildId, id);
      if (!backup) {
        const embed = EmbedFactory.error(guildId, 'Backup introuvable', `Aucun backup avec l'ID \`${id}\`.`);
        return msg.reply({ embeds: [embed] });
      }

      // Confirmation
      const confirmEmbed = EmbedFactory.warning(guildId,
        'Confirmer la suppression',
        `Vous allez supprimer le backup **${backup.name}** (\`${backup.id}\`).\n\n` +
        `⚠️ Cette action est **irréversible** !\n\n` +
        `Répondez \`confirm\` dans les 30 secondes pour confirmer.`
      );
      await msg.reply({ embeds: [confirmEmbed] });

      const filter = (m) => m.author.id === msg.author.id && m.content.toLowerCase() === 'confirm';
      const collected = await msg.channel.awaitMessages({ filter, max: 1, time: BOT_CONFIG.confirmationTimeout, errors: ['time'] })
        .catch(() => null);

      if (!collected) {
        const embed = EmbedFactory.error(guildId, 'Annulé', 'Temps écoulé. Suppression annulée.');
        return msg.reply({ embeds: [embed] });
      }

      DataManager.removeBackup(guildId, id);

      const embed = EmbedFactory.success(guildId, 'Backup Supprimé', `Le backup \`${id}\` a été supprimé avec succès.`);
      await msg.reply({ embeds: [embed] });

      await sendLogMessage(msg.guild, 'backup_delete', { user: msg.author, backupId: id, backupName: backup.name });
      break;
    }

    // ─── +backup export <id> ──────────────────────────────────────
    case 'export': {
      const id = args[0]?.toUpperCase();
      if (!id) {
        const embed = EmbedFactory.error(guildId, 'ID manquant', 'Usage : `+backup export <ID>`');
        return msg.reply({ embeds: [embed] });
      }

      const backup = DataManager.getBackup(guildId, id);
      if (!backup) {
        const embed = EmbedFactory.error(guildId, 'Backup introuvable', `Aucun backup avec l'ID \`${id}\`.`);
        return msg.reply({ embeds: [embed] });
      }

      const json   = JSON.stringify(backup, null, 2);
      const buf    = Buffer.from(json, 'utf8');
      const fname  = `backup_${backup.id}_${Date.now()}.json`;

      try {
        await msg.reply({
          content: `${BOT_CONFIG.botEmoji.archive} Voici votre export du backup \`${backup.id}\` :`,
          files: [{ attachment: buf, name: fname }],
        });
      } catch (err) {
        const embed = EmbedFactory.error(guildId, 'Export impossible', `Erreur : \`${err.message}\``);
        await msg.reply({ embeds: [embed] });
      }
      break;
    }

    // ─── +backup import ───────────────────────────────────────────
    case 'import': {
      const attachment = msg.attachments.first();
      if (!attachment || !attachment.name.endsWith('.json')) {
        const embed = EmbedFactory.error(guildId, 'Fichier manquant', 'Joignez un fichier `.json` exporté par VaultBot à votre message.\nUsage : `+backup import` (avec le fichier attaché)');
        return msg.reply({ embeds: [embed] });
      }

      const loadEmbed = EmbedFactory.loading(guildId, 'Import en cours…', 'Téléchargement et validation du fichier backup…');
      const reply = await msg.reply({ embeds: [loadEmbed] });

      try {
        const res  = await fetch(attachment.url);
        const json = await res.json();

        // Validate
        const { valid, errors: valErrors } = BackupEngine.validate(json);
        if (!valid) {
          const errEmbed = EmbedFactory.error(guildId, 'Backup invalide', `Le fichier de backup est corrompu ou invalide :\n\`\`\`${valErrors.join('\n')}\`\`\``);
          return reply.edit({ embeds: [errEmbed] });
        }

        // Re-assign to this guild
        const imported = deepClone(json);
        imported.id        = generateId();
        imported.guildId   = guildId;
        imported.guildName = msg.guild.name;
        imported.createdAt = Date.now();
        imported.createdBy = msg.author.id;
        imported.name      = `Import — ${json.name || json.id}`;

        DataManager.saveBackup(guildId, imported);

        const embed = EmbedFactory.success(guildId, 'Backup Importé !', [
          `**Nouveau ID** : \`${imported.id}\``,
          `**Nom** : ${imported.name}`,
          `**Taille** : ${formatBytes(imported.size || 0)}`,
          `**Rôles** : ${imported.data.roles.length}`,
          `**Salons** : ${imported.data.channels.length}`,
        ].join('\n'));
        await reply.edit({ embeds: [embed] });

      } catch (err) {
        const errEmbed = EmbedFactory.error(guildId, 'Erreur d\'import', `\`${err.message}\``);
        await reply.edit({ embeds: [errEmbed] });
      }
      break;
    }

    // ─── +backup restore <id> / +backup restore full <id> / safe <id> ──
    case 'restore': {
  let mode = 'full';
  let id;

  if (args[0] === 'full') {
    mode = 'full';
    id = args[1];
  } else if (args[0] === 'safe') {
    mode = 'safe';
    id = args[1];
  } else if (args[0] === 'preview') {
    mode = 'preview';
    id = args[1];
  } else {
    id = args[0];
  }

  if (!id) {
    return msg.reply({
      embeds: [
        EmbedFactory.error(guildId, 'ID manquant', [
          'Usage :',
          '`+backup restore <ID>`',
          '`+backup restore full <ID>`',
          '`+backup restore safe <ID>`',
          '`+backup restore preview <ID>`',
        ].join('\n'))
      ]
    });
  }

  // 🔥 IMPORTANT : NO UPPERCASE (sinon casse les IDs)
  id = id.trim();

  // 🔎 SEARCH LOCAL + GLOBAL
  let backup =
    DataManager.getBackup(msg.guild.id, id) ||
    DataManager.getBackupGlobal(id);

  if (!backup) {
    return msg.reply({
      embeds: [
        EmbedFactory.error(
          guildId,
          'Backup introuvable',
          `Aucun backup trouvé avec l'ID \`${id}\`.`
        )
      ]
    });
  }

  // 🔐 VALIDATION
  const { valid, errors } = BackupEngine.validate(backup);
  if (!valid) {
    return msg.reply({
      embeds: [
        EmbedFactory.error(
          guildId,
          'Backup corrompu',
          `\`\`\`${errors.join('\n')}\`\`\``
        )
      ]
    });
  }

  // 👀 PREVIEW
  if (mode === 'preview') {
    const previewText = RestoreEngine.generatePreview(msg.guild, backup, 'full');

    return msg.reply({
      embeds: [
        EmbedFactory.base(guildId)
          .setTitle(`${BOT_CONFIG.botEmoji.preview} Aperçu Restore — \`${backup.id}\``)
          .setDescription(previewText)
          .setColor(EmbedFactory.getColor('warning', guildId))
      ]
    });
  }

  // ⚠️ CONFIRMATION
  const previewText = RestoreEngine.generatePreview(msg.guild, backup, mode);

  const warnMsg = await msg.reply({
    embeds: [
      EmbedFactory.warning(
        guildId,
        `Confirm ${mode.toUpperCase()} Restore`,
        [
          `Backup : **${backup.name}** (\`${backup.id}\`)`,
          '',
          mode === 'full'
            ? '⚠️ FULL : tout sera supprimé avant restauration'
            : '🟢 SAFE : rien ne sera supprimé',
          '',
          '**Détails :**',
          previewText,
          '',
          'Tapez `confirm` pour continuer (30s)'
        ].join('\n')
      )
    ]
  });

  const collected = await msg.channel.awaitMessages({
    filter: m => m.author.id === msg.author.id && m.content.toLowerCase() === 'confirm',
    max: 1,
    time: BOT_CONFIG.confirmationTimeout || 30000,
    errors: ['time']
  }).catch(() => null);

  if (!collected) {
    return msg.reply({
      embeds: [
        EmbedFactory.error(guildId, 'Annulé', 'Temps écoulé.')
      ]
    });
  }

  // 🔄 RESTORE
  const progressMsg = await msg.reply({
    embeds: [
      EmbedFactory.loading(
        guildId,
        'Restauration…',
        `${BOT_CONFIG.botEmoji.loading} En cours…`
      )
    ]
  });

  let result;

  try {
    result =
      mode === 'full'
        ? await RestoreEngine.restoreFull(msg.guild, backup, progressMsg)
        : await RestoreEngine.restoreSafe(msg.guild, backup, progressMsg);

    DataManager.incrementRestores();

  } catch (err) {
    return progressMsg.edit({
      embeds: [
        EmbedFactory.error(
          guildId,
          'Erreur restauration',
          err.message
        )
      ]
    });
  }

  const finalEmbed = result.success
    ? EmbedFactory.success(
        guildId,
        'Restauration terminée',
        [
          `Backup : \`${backup.id}\``,
          `Mode : ${mode.toUpperCase()}`,
          `Durée : ${formatDuration(result.duration)}`
        ].join('\n')
      )
    : EmbedFactory.error(
        guildId,
        'Échec restauration',
        result.errors?.[0] || 'Erreur inconnue'
      );

  await progressMsg.edit({ embeds: [finalEmbed] });

  await sendLogMessage(msg.guild, 'restore', {
    user: msg.author,
    backup,
    mode,
    result,
  });

  break;
}

    // ─── +backup auto on/off ───────────────────────────────────────
    case 'auto': {
      const toggle = args[0]?.toLowerCase();
      const cfg    = DataManager.getGuild(guildId);

      if (toggle === 'on') {
        AutoBackup.enable(guildId, cfg.autoInterval || 60, client);
        const ts = Math.floor((Date.now() + (cfg.autoInterval || 60) * 60 * 1000) / 1000);
        const embed = EmbedFactory.success(guildId, 'Auto-Backup Activé',
          `${BOT_CONFIG.botEmoji.clock} Auto-backup activé toutes les **${cfg.autoInterval || 60} minutes**.\n` +
          `Prochain backup : <t:${ts}:R>`
        );
        return msg.reply({ embeds: [embed] });
      }

      if (toggle === 'off') {
        AutoBackup.disable(guildId);
        const embed = EmbedFactory.success(guildId, 'Auto-Backup Désactivé', `${BOT_CONFIG.botEmoji.clock} L'auto-backup a été désactivé.`);
        return msg.reply({ embeds: [embed] });
      }

      // Status
      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.clock} Auto-Backup`)
        .setDescription([
          `**Statut** : ${cfg.autoBackup ? '🟢 Activé' : '🔴 Désactivé'}`,
          `**Intervalle** : ${cfg.autoInterval || 60} minutes`,
          cfg.autoBackup && cfg.nextAutoBackup
            ? `**Prochain backup** : <t:${Math.floor(cfg.nextAutoBackup / 1000)}:R>`
            : '',
          '',
          '`+backup auto on` — Activer',
          '`+backup auto off` — Désactiver',
          '`+backup interval <minutes>` — Changer l\'intervalle',
        ].filter(Boolean).join('\n'));

      return msg.reply({ embeds: [embed] });
    }

    // ─── +backup interval <minutes> ───────────────────────────────
    case 'interval': {
      const min = safeParseInt(args[0], 0);
      if (min < BOT_CONFIG.minAutoBackupInterval || min > BOT_CONFIG.maxAutoBackupInterval) {
        const embed = EmbedFactory.error(guildId, 'Intervalle invalide',
          `L'intervalle doit être entre **${BOT_CONFIG.minAutoBackupInterval}** et **${BOT_CONFIG.maxAutoBackupInterval}** minutes.`
        );
        return msg.reply({ embeds: [embed] });
      }

      DataManager.updateGuild(guildId, { autoInterval: min });

      const cfg = DataManager.getGuild(guildId);
      if (cfg.autoBackup) {
        AutoBackup.enable(guildId, min, client);
      }

      const embed = EmbedFactory.success(guildId, 'Intervalle mis à jour',
        `L'intervalle d'auto-backup est maintenant de **${min} minutes**.`
      );
      return msg.reply({ embeds: [embed] });
    }

    // ─── +backup diff <id1> <id2> ─────────────────────────────────
    case 'diff': {
      const id1 = args[0]?.toUpperCase();
      const id2 = args[1]?.toUpperCase();

      if (!id1 || !id2) {
        const embed = EmbedFactory.error(guildId, 'IDs manquants', 'Usage : `+backup diff <ID1> <ID2>`');
        return msg.reply({ embeds: [embed] });
      }

      const b1 = DataManager.getBackup(guildId, id1);
      const b2 = DataManager.getBackup(guildId, id2);

      if (!b1) return msg.reply({ embeds: [EmbedFactory.error(guildId, 'Backup introuvable', `ID \`${id1}\` inconnu.`)] });
      if (!b2) return msg.reply({ embeds: [EmbedFactory.error(guildId, 'Backup introuvable', `ID \`${id2}\` inconnu.`)] });

      const diffResult = BackupEngine.diff(b1, b2);

      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.diff} Diff Backup`)
        .setDescription(`Comparaison de \`${id1}\` → \`${id2}\``)
        .addFields(
          { name: '🎭 Rôles',        value: formatDiffSection(diffResult.roles),      inline: true },
          { name: '📂 Catégories',   value: formatDiffSection(diffResult.categories), inline: true },
          { name: '💬 Salons',       value: formatDiffSection(diffResult.channels),   inline: true },
          { name: '😀 Emojis',       value: formatDiffSection(diffResult.emojis),     inline: true },
          { name: '🎟️ Stickers',    value: formatDiffSection(diffResult.stickers),   inline: true },
        );

      return msg.reply({ embeds: [embed] });
    }

    // ─── Default: show backup help ─────────────────────────────────
    default: {
      await handleHelp(msg, 'backup');
      break;
    }
  }
}

/**
 * Format a diff section result.
 * @param {{ added: number, removed: number, changed: number }} section
 * @returns {string}
 */
function formatDiffSection(section) {
  return [
    `➕ ${section.added}`,
    `➖ ${section.removed}`,
    `✏️ ${section.changed}`,
  ].join('\n');
}

// ══════════════════════════════════════════════════════════════════════
//  ██████╗ █████╗  ██████╗ ██████╗ ███████╗     ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗ ███████╗
//  ██╔════╝██╔══██╗██╔════╝ ╚════██╗╚════██║    ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝
//  ██║     ██║  ██║██║  ███╗ █████╔╝    ██╔╝    ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║███████╗
//  ██║     ██║  ██║██║   ██║ ╚═══██╗   ██╔╝     ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║╚════██║
//  ╚██████╗╚█████╔╝╚██████╔╝██████╔╝   ██║      ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝███████║
//   ╚═════╝ ╚════╝  ╚═════╝ ╚═════╝    ╚═╝       ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝
//  §12 — CONFIG COMMANDS
// ══════════════════════════════════════════════════════════════════════

/**
 * Handle +config subcommands.
 * @param {import('discord.js').Message} msg
 * @param {string} sub
 * @param {string[]} args
 */
async function handleConfigCommand(msg, sub, args) {
  const guildId = msg.guild.id;

  // Permission check
  const { allowed } = PermissionGuard.check(msg.member, guildId);
  if (!allowed) {
    const embed = EmbedFactory.error(guildId, 'Permission refusée', `${BOT_CONFIG.botEmoji.lock} Vous n'avez pas la permission d'utiliser cette commande.`);
    return msg.reply({ embeds: [embed] });
  }

  switch (sub) {
    // ─── +config get ──────────────────────────────────────────────
    case 'get': {
      const cfg = DataManager.getGuild(guildId);
      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.config} Configuration de ${msg.guild.name}`)
        .addFields(
          { name: '🔤 Préfixe',              value: `\`${cfg.prefix}\``,                                       inline: true },
          { name: '🎨 Couleur embed',         value: `\`${cfg.embedColor}\``,                                   inline: true },
          { name: '✅ Couleur succès',        value: `\`${cfg.successColor}\``,                                 inline: true },
          { name: '❌ Couleur erreur',        value: `\`${cfg.errorColor}\``,                                   inline: true },
          { name: '⚠️ Couleur warning',      value: `\`${cfg.warningColor}\``,                                 inline: true },
          { name: 'ℹ️ Couleur info',          value: `\`${cfg.infoColor}\``,                                    inline: true },
          { name: '📦 Max backups',           value: `${cfg.maxBackups}`,                                       inline: true },
          { name: '🔒 Require Admin',         value: cfg.requireAdmin ? 'Oui' : 'Non',                          inline: true },
          { name: '🕐 Auto-backup',           value: cfg.autoBackup ? `✅ ${cfg.autoInterval}min` : '❌ Off',   inline: true },
          { name: '📢 Canal logs',            value: cfg.logChannel ? `<#${cfg.logChannel}>` : 'Non défini',   inline: true },
          { name: '👤 Whitelist',             value: cfg.whitelist.length > 0 ? cfg.whitelist.map((id) => `<@${id}>`).join(', ') : 'Vide', inline: false },
          { name: '🎭 Rôles autorisés',       value: cfg.allowedRoles.length > 0 ? cfg.allowedRoles.map((id) => `<@&${id}>`).join(', ') : 'Vide', inline: false },
        );
      return msg.reply({ embeds: [embed] });
    }

    // ─── +config set <key> <value> ────────────────────────────────
    case 'set': {
      const key   = args[0]?.toLowerCase();
      const value = args.slice(1).join(' ');

      if (!key || !value) {
        const embed = EmbedFactory.error(guildId, 'Arguments manquants', [
          'Usage : `+config set <clé> <valeur>`',
          '',
          '**Clés disponibles** :',
          '`embedColor` — couleur principale des embeds (hex)',
          '`successColor` — couleur succès (hex)',
          '`errorColor` — couleur erreur (hex)',
          '`warningColor` — couleur warning (hex)',
          '`infoColor` — couleur info (hex)',
          '`maxBackups` — nombre maximum de backups (1-50)',
          '`requireAdmin` — true/false',
          '`logChannel` — ID ou mention du canal de logs',
          '`autoInterval` — intervalle auto-backup (minutes)',
        ].join('\n'));
        return msg.reply({ embeds: [embed] });
      }

      const colorKeys = ['embedColor', 'successColor', 'errorColor', 'warningColor', 'infoColor'];

      if (colorKeys.includes(key)) {
        if (!isValidHexColor(value)) {
          const embed = EmbedFactory.error(guildId, 'Couleur invalide', `La valeur \`${value}\` n'est pas une couleur hexadécimale valide.\nExemple : \`#5865F2\``);
          return msg.reply({ embeds: [embed] });
        }
        DataManager.updateGuild(guildId, { [key]: value });
        const embed = EmbedFactory.success(guildId, 'Configuration mise à jour', `\`${key}\` → \`${value}\``);
        return msg.reply({ embeds: [embed] });
      }

      if (key === 'maxbackups' || key === 'maxBackups') {
        const n = safeParseInt(value, 0);
        if (n < 1 || n > 50) {
          const embed = EmbedFactory.error(guildId, 'Valeur invalide', 'Le nombre maximum de backups doit être entre 1 et 50.');
          return msg.reply({ embeds: [embed] });
        }
        DataManager.updateGuild(guildId, { maxBackups: n });
        const embed = EmbedFactory.success(guildId, 'Configuration mise à jour', `\`maxBackups\` → \`${n}\``);
        return msg.reply({ embeds: [embed] });
      }

      if (key === 'requireadmin' || key === 'requireAdmin') {
        const bool = value === 'true' || value === '1' || value === 'yes';
        DataManager.updateGuild(guildId, { requireAdmin: bool });
        const embed = EmbedFactory.success(guildId, 'Configuration mise à jour', `\`requireAdmin\` → \`${bool}\``);
        return msg.reply({ embeds: [embed] });
      }

      if (key === 'logchannel' || key === 'logChannel') {
        const chId = value.replace(/[<#>]/g, '');
        const ch   = msg.guild.channels.cache.get(chId);
        if (!ch) {
          const embed = EmbedFactory.error(guildId, 'Canal introuvable', `Le canal \`${chId}\` est introuvable.`);
          return msg.reply({ embeds: [embed] });
        }
        DataManager.updateGuild(guildId, { logChannel: chId });
        const embed = EmbedFactory.success(guildId, 'Configuration mise à jour', `Canal de logs → <#${chId}>`);
        return msg.reply({ embeds: [embed] });
      }

      if (key === 'autointerval' || key === 'autoInterval') {
        const n = safeParseInt(value, 0);
        if (n < BOT_CONFIG.minAutoBackupInterval || n > BOT_CONFIG.maxAutoBackupInterval) {
          const embed = EmbedFactory.error(guildId, 'Valeur invalide', `L'intervalle doit être entre ${BOT_CONFIG.minAutoBackupInterval} et ${BOT_CONFIG.maxAutoBackupInterval} minutes.`);
          return msg.reply({ embeds: [embed] });
        }
        DataManager.updateGuild(guildId, { autoInterval: n });
        const embed = EmbedFactory.success(guildId, 'Configuration mise à jour', `\`autoInterval\` → \`${n} minutes\``);
        return msg.reply({ embeds: [embed] });
      }

      const embed = EmbedFactory.error(guildId, 'Clé inconnue', `La clé \`${key}\` est inconnue. Utilisez \`+config set\` sans arguments pour voir la liste.`);
      return msg.reply({ embeds: [embed] });
    }

    // ─── +config reset ────────────────────────────────────────────
    case 'reset': {
      const confirmEmbed = EmbedFactory.warning(guildId, 'Confirmer la réinitialisation',
        'Vous allez réinitialiser **toute la configuration** de ce serveur aux valeurs par défaut.\n\n' +
        '⚠️ Les backups ne seront **PAS** supprimés.\n\n' +
        'Répondez `confirm` pour confirmer.'
      );
      await msg.reply({ embeds: [confirmEmbed] });

      const filter = (m) => m.author.id === msg.author.id && m.content.toLowerCase() === 'confirm';
      const collected = await msg.channel.awaitMessages({ filter, max: 1, time: BOT_CONFIG.confirmationTimeout, errors: ['time'] })
        .catch(() => null);

      if (!collected) {
        const embed = EmbedFactory.error(guildId, 'Annulé', 'Temps écoulé. Réinitialisation annulée.');
        return msg.reply({ embeds: [embed] });
      }

      const backups = DataManager.getBackups(guildId);
      DataManager.updateGuild(guildId, {
        prefix:         BOT_CONFIG.defaultPrefix,
        embedColor:     BOT_CONFIG.defaultEmbedColor,
        successColor:   BOT_CONFIG.defaultSuccessColor,
        errorColor:     BOT_CONFIG.defaultErrorColor,
        warningColor:   BOT_CONFIG.defaultWarningColor,
        infoColor:      BOT_CONFIG.defaultInfoColor,
        maxBackups:     BOT_CONFIG.maxBackupsPerGuild,
        requireAdmin:   true,
        logChannel:     null,
        whitelist:      [],
        allowedRoles:   [],
        backups,
      });

      const embed = EmbedFactory.success(guildId, 'Configuration réinitialisée', 'Toutes les options ont été remises aux valeurs par défaut.');
      return msg.reply({ embeds: [embed] });
    }

    // ─── +config whitelist <add/remove/list> <userId> ────────────
    case 'whitelist': {
      const action = args[0]?.toLowerCase();
      const userId = args[1]?.replace(/[<@!>]/g, '');
      const cfg    = DataManager.getGuild(guildId);

      if (action === 'add') {
        if (!userId) return msg.reply({ embeds: [EmbedFactory.error(guildId, 'Usage', '`+config whitelist add <@user>`')] });
        if (cfg.whitelist.includes(userId)) {
          return msg.reply({ embeds: [EmbedFactory.warning(guildId, 'Déjà présent', `<@${userId}> est déjà dans la whitelist.`)] });
        }
        cfg.whitelist.push(userId);
        DataManager.updateGuild(guildId, { whitelist: cfg.whitelist });
        return msg.reply({ embeds: [EmbedFactory.success(guildId, 'Whitelist mise à jour', `<@${userId}> ajouté à la whitelist.`)] });
      }

      if (action === 'remove') {
        if (!userId) return msg.reply({ embeds: [EmbedFactory.error(guildId, 'Usage', '`+config whitelist remove <@user>`')] });
        const idx = cfg.whitelist.indexOf(userId);
        if (idx === -1) {
          return msg.reply({ embeds: [EmbedFactory.warning(guildId, 'Non trouvé', `<@${userId}> n'est pas dans la whitelist.`)] });
        }
        cfg.whitelist.splice(idx, 1);
        DataManager.updateGuild(guildId, { whitelist: cfg.whitelist });
        return msg.reply({ embeds: [EmbedFactory.success(guildId, 'Whitelist mise à jour', `<@${userId}> retiré de la whitelist.`)] });
      }

      // List
      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.key} Whitelist`)
        .setDescription(cfg.whitelist.length > 0
          ? cfg.whitelist.map((id) => `<@${id}>`).join('\n')
          : 'La whitelist est vide.'
        );
      return msg.reply({ embeds: [embed] });
    }

    // ─── +config roles <add/remove/list> <roleId> ────────────────
    case 'roles': {
      const action = args[0]?.toLowerCase();
      const roleId = args[1]?.replace(/[<@&>]/g, '');
      const cfg    = DataManager.getGuild(guildId);

      if (action === 'add') {
        if (!roleId) return msg.reply({ embeds: [EmbedFactory.error(guildId, 'Usage', '`+config roles add <@role>`')] });
        if (cfg.allowedRoles.includes(roleId)) {
          return msg.reply({ embeds: [EmbedFactory.warning(guildId, 'Déjà présent', `<@&${roleId}> est déjà dans la liste.`)] });
        }
        cfg.allowedRoles.push(roleId);
        DataManager.updateGuild(guildId, { allowedRoles: cfg.allowedRoles });
        return msg.reply({ embeds: [EmbedFactory.success(guildId, 'Rôles autorisés mis à jour', `<@&${roleId}> ajouté.`)] });
      }

      if (action === 'remove') {
        if (!roleId) return msg.reply({ embeds: [EmbedFactory.error(guildId, 'Usage', '`+config roles remove <@role>`')] });
        const idx = cfg.allowedRoles.indexOf(roleId);
        if (idx === -1) {
          return msg.reply({ embeds: [EmbedFactory.warning(guildId, 'Non trouvé', `<@&${roleId}> n'est pas dans la liste.`)] });
        }
        cfg.allowedRoles.splice(idx, 1);
        DataManager.updateGuild(guildId, { allowedRoles: cfg.allowedRoles });
        return msg.reply({ embeds: [EmbedFactory.success(guildId, 'Rôles autorisés mis à jour', `<@&${roleId}> retiré.`)] });
      }

      // List
      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.shield} Rôles Autorisés`)
        .setDescription(cfg.allowedRoles.length > 0
          ? cfg.allowedRoles.map((id) => `<@&${id}>`).join('\n')
          : 'Aucun rôle autorisé défini.'
        );
      return msg.reply({ embeds: [embed] });
    }

    default: {
      const embed = EmbedFactory.base(guildId)
        .setTitle(`${BOT_CONFIG.botEmoji.config} Configuration`)
        .setDescription([
          '`+config get` — Voir la configuration actuelle',
          '`+config set <clé> <valeur>` — Modifier une option',
          '`+config reset` — Réinitialiser tout',
          '`+config whitelist add/remove <@user>` — Gérer la whitelist',
          '`+config roles add/remove <@role>` — Gérer les rôles autorisés',
        ].join('\n'));
      return msg.reply({ embeds: [embed] });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
//  §13 — PREFIX COMMAND
// ══════════════════════════════════════════════════════════════════════

/**
 * Handle +prefix set <newPrefix>
 * @param {import('discord.js').Message} msg
 * @param {string[]} args
 */
async function handlePrefixSet(msg, args) {
  const guildId = msg.guild.id;
  const { allowed } = PermissionGuard.check(msg.member, guildId);

  if (!allowed) {
    const embed = EmbedFactory.error(guildId, 'Permission refusée', `${BOT_CONFIG.botEmoji.lock} Permission requise.`);
    return msg.reply({ embeds: [embed] });
  }

  const newPrefix = args[0];
  if (!newPrefix || newPrefix.length > 5) {
    const embed = EmbedFactory.error(guildId, 'Préfixe invalide', 'Le préfixe doit faire entre 1 et 5 caractères.');
    return msg.reply({ embeds: [embed] });
  }

  DataManager.updateGuild(guildId, { prefix: newPrefix });
  const embed = EmbedFactory.success(guildId, 'Préfixe mis à jour', `Le nouveau préfixe est \`${newPrefix}\`.`);
  return msg.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════════════
//  §14 — HELP COMMAND
// ══════════════════════════════════════════════════════════════════════

/**
 * Display help embed.
 * @param {import('discord.js').Message} msg
 * @param {string} [section]
 */
async function handleHelp(msg, section) {
  const guildId = msg.guild.id;
  const cfg     = DataManager.getGuild(guildId);
  const p       = cfg.prefix;

  if (section === 'backup' || section === 'restore') {
    const embed = EmbedFactory.base(guildId)
      .setTitle(`${BOT_CONFIG.botEmoji.backup} Commandes Backup & Restore`)
      .addFields(
        {
          name: '💾 Backup',
          value: [
            `\`${p}backup create [label]\` — Créer un backup`,
            `\`${p}backup list\` — Lister les backups`,
            `\`${p}backup info <ID>\` — Détails d'un backup`,
            `\`${p}backup delete <ID>\` — Supprimer un backup`,
            `\`${p}backup export <ID>\` — Exporter en JSON`,
            `\`${p}backup import\` — Importer un JSON`,
            `\`${p}backup diff <ID1> <ID2>\` — Comparer deux backups`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '♻️ Restore',
          value: [
            `\`${p}backup restore <ID>\` — Restore complet`,
            `\`${p}backup restore full <ID>\` — Supprime tout & recrée`,
            `\`${p}backup restore safe <ID>\` — Ajoute sans supprimer`,
            `\`${p}backup restore preview <ID>\` — Aperçu`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🤖 Auto-Backup',
          value: [
            `\`${p}backup auto on\` — Activer l'auto-backup`,
            `\`${p}backup auto off\` — Désactiver`,
            `\`${p}backup auto\` — Voir le statut`,
            `\`${p}backup interval <minutes>\` — Changer l'intervalle`,
          ].join('\n'),
          inline: false,
        }
      );
    return msg.reply({ embeds: [embed] });
  }

  if (section === 'config') {
    const embed = EmbedFactory.base(guildId)
      .setTitle(`${BOT_CONFIG.botEmoji.config} Commandes Configuration`)
      .addFields(
        {
          name: '⚙️ Config',
          value: [
            `\`${p}config get\` — Voir la configuration`,
            `\`${p}config set <clé> <valeur>\` — Modifier une option`,
            `\`${p}config reset\` — Réinitialiser`,
            `\`${p}config whitelist add/remove <@user>\` — Whitelist`,
            `\`${p}config roles add/remove <@role>\` — Rôles autorisés`,
            `\`${p}prefix set <préfixe>\` — Changer le préfixe`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎨 Couleurs configurables',
          value: [
            '`embedColor` — Couleur principale',
            '`successColor` — Couleur succès',
            '`errorColor` — Couleur erreur',
            '`warningColor` — Couleur warning',
            '`infoColor` — Couleur info',
          ].join('\n'),
          inline: false,
        }
      );
    return msg.reply({ embeds: [embed] });
  }

  // Main help menu
  const embed = EmbedFactory.base(guildId)
    .setTitle(`${BOT_CONFIG.botEmoji.help} ${BOT_CONFIG.botName} — Aide`)
    .setDescription(`Bot de backup et restauration de serveurs Discord.\nPréfixe actuel : \`${p}\`\nVersion : \`${BOT_CONFIG.botVersion}\``)
    .addFields(
      {
        name: `${BOT_CONFIG.botEmoji.backup} Backup & Restore`,
        value: `\`${p}help backup\` — Voir les commandes de backup`,
        inline: false,
      },
      {
        name: `${BOT_CONFIG.botEmoji.config} Configuration`,
        value: `\`${p}help config\` — Voir les commandes de config`,
        inline: false,
      },
      {
        name: `${BOT_CONFIG.botEmoji.stats} Système`,
        value: [
          `\`${p}stats\` — Statistiques du bot`,
          `\`${p}ping\` — Latence du bot`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🚀 Démarrage rapide',
        value: [
          `1. \`${p}backup create\` — Créer votre premier backup`,
          `2. \`${p}backup list\` — Lister vos backups`,
          `3. \`${p}backup restore <ID>\` — Restaurer un backup`,
          `4. \`${p}backup auto on\` — Activer l'auto-backup`,
        ].join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: `${BOT_CONFIG.botName} v${BOT_CONFIG.botVersion} — Production Ready` });

  return msg.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════════════
//  §15 — STATS COMMAND
// ══════════════════════════════════════════════════════════════════════

/**
 * Display bot statistics.
 * @param {import('discord.js').Message} msg
 * @param {import('discord.js').Client} client
 */
async function handleStats(msg, client) {
  const guildId  = msg.guild.id;
  const stats    = DataManager.getStats();
  const allGuilds = DataManager.getAllGuilds();

  const totalBackups = Object.values(allGuilds).reduce((acc, g) => acc + (g.backups?.length || 0), 0);
  const guildCount   = client.guilds.cache.size;
  const uptime       = formatDuration(process.uptime() * 1000);
  const memMB        = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  const dataSizeBytes = Buffer.byteLength(JSON.stringify(DataManager.getRaw()), 'utf8');

  const embed = EmbedFactory.base(guildId)
    .setTitle(`${BOT_CONFIG.botEmoji.stats} Statistiques — ${BOT_CONFIG.botName}`)
    .addFields(
      { name: '🤖 Bot',             value: `${client.user.tag}`,   inline: true },
      { name: '🏰 Serveurs',        value: `${guildCount}`,        inline: true },
      { name: '⏱️ Uptime',          value: uptime,                 inline: true },
      { name: '💾 Backups totaux',   value: `${totalBackups}`,      inline: true },
      { name: '♻️ Restores totaux', value: `${stats.totalRestores}`,inline: true },
      { name: '🗑️ Suppressions',    value: `${stats.totalDeletes}`, inline: true },
      { name: '🧠 RAM utilisée',    value: `${memMB} MB`,           inline: true },
      { name: '📂 data.json',       value: formatBytes(dataSizeBytes), inline: true },
      { name: '🟢 Node.js',         value: process.version,         inline: true },
      { name: '📦 discord.js',      value: `v14`,                   inline: true },
      { name: '🔄 Ping API',        value: `${Math.round(client.ws.ping)}ms`, inline: true },
      { name: '⚡ Latence',         value: `${Date.now() - msg.createdTimestamp}ms`, inline: true },
    )
    .setThumbnail(client.user.displayAvatarURL());

  return msg.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════════════
//  §16 — PING COMMAND
// ══════════════════════════════════════════════════════════════════════

/**
 * Handle the ping command.
 * @param {import('discord.js').Message} msg
 * @param {import('discord.js').Client} client
 */
async function handlePing(msg, client) {
  const guildId = msg.guild.id;
  const sent    = await msg.reply({ embeds: [EmbedFactory.loading(guildId, 'Pong…', '⏱️ Calcul de la latence…')] });
  const latency = sent.createdTimestamp - msg.createdTimestamp;
  const wsLatency = Math.round(client.ws.ping);

  const embed = EmbedFactory.base(guildId)
    .setTitle(`${BOT_CONFIG.botEmoji.ping} Pong !`)
    .addFields(
      { name: '⏱️ Latence Bot', value: `${latency}ms`,   inline: true },
      { name: '🌐 WebSocket',   value: `${wsLatency}ms`, inline: true },
    );

  await sent.edit({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════════════
//  §17 — LOG SYSTEM
// ══════════════════════════════════════════════════════════════════════

/**
 * Send a log message to the configured log channel.
 * @param {import('discord.js').Guild} guild
 * @param {'backup_create'|'backup_delete'|'restore'} event
 * @param {object} data
 */
async function sendLogMessage(guild, event, data) {
  try {
    const cfg = DataManager.getGuild(guild.id);
    if (!cfg.logChannel) return;

    const ch = guild.channels.cache.get(cfg.logChannel)
      || await guild.channels.fetch(cfg.logChannel).catch(() => null);

    if (!ch || !ch.isTextBased()) return;

    let embed;

    switch (event) {
      case 'backup_create':
        embed = EmbedFactory.info(guild.id, 'Backup Créé',
          `**Par** : <@${data.user.id}> (${data.user.tag})\n` +
          `**ID** : \`${data.backup.id}\`\n` +
          `**Nom** : ${data.backup.name}\n` +
          `**Taille** : ${formatBytes(data.backup.size)}`
        );
        break;

      case 'backup_delete':
        embed = EmbedFactory.warning(guild.id, 'Backup Supprimé',
          `**Par** : <@${data.user.id}> (${data.user.tag})\n` +
          `**ID** : \`${data.backupId}\`\n` +
          `**Nom** : ${data.backupName}`
        );
        break;

      case 'restore':
        embed = data.result.success
          ? EmbedFactory.success(guild.id, 'Restauration Effectuée',
              `**Par** : <@${data.user.id}> (${data.user.tag})\n` +
              `**Backup** : \`${data.backup.id}\`\n` +
              `**Mode** : ${data.mode}\n` +
              `**Durée** : ${formatDuration(data.result.duration)}`
            )
          : EmbedFactory.error(guild.id, 'Restauration Échouée',
              `**Par** : <@${data.user.id}> (${data.user.tag})\n` +
              `**Backup** : \`${data.backup.id}\`\n` +
              `**Erreur** : ${data.result.errors[0] || 'Inconnue'}`
            );
        break;

      default:
        return;
    }

    await ch.send({ embeds: [embed] });
  } catch (err) {
    Logger.warn('LogSystem', `Failed to send log message: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  █████╗ ███╗   ██╗████████╗██╗     ██████╗ ██████╗  █████╗ ███████╗██╗  ██╗
//  ██╔══██╗████╗  ██║╚══██╔══╝██║    ██╔════╝██╔══██╗██╔══██╗██╔════╝██║  ██║
//  ███████║██╔██╗ ██║   ██║   ██║    ██║     ██████╔╝███████║███████╗███████║
//  ██╔══██║██║╚██╗██║   ██║   ██║    ██║     ██╔══██╗██╔══██║╚════██║██╔══██║
//  ██║  ██║██║ ╚████║   ██║   ██║    ╚██████╗██║  ██║██║  ██║███████║██║  ██║
//  ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝     ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
//  §18 — ANTI-CRASH SYSTEM
// ══════════════════════════════════════════════════════════════════════

/**
 * AntiCrash — global error handling to prevent bot crashes.
 * Catches: unhandledRejection, uncaughtException, SIGINT, SIGTERM
 */
function setupAntiCrash(client) {
  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('AntiCrash', 'Unhandled Promise Rejection', {
      reason: reason?.message || String(reason),
      stack:  reason?.stack || 'N/A',
    });
  });

  process.on('uncaughtException', (err) => {
    Logger.fatal('AntiCrash', `Uncaught Exception: ${err.message}`, err.stack);
    // Don't exit — log and continue
  });

  process.on('uncaughtExceptionMonitor', (err) => {
    Logger.fatal('AntiCrash', `UncaughtExceptionMonitor: ${err.message}`);
  });

  process.on('warning', (warning) => {
    Logger.warn('AntiCrash', `Node Warning: ${warning.name} — ${warning.message}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    Logger.info('AntiCrash', `Received ${signal} — graceful shutdown…`);
    DataManager.save();
    client.user?.setStatus('invisible');
    await sleep(500);
    client.destroy();
    Logger.info('AntiCrash', 'Bot shut down cleanly. Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  Logger.info('AntiCrash', 'Anti-crash system initialized');
}

// ══════════════════════════════════════════════════════════════════════
//  ██████╗  ██████╗ ████████╗    ██╗███╗   ██╗██╗████████╗
//  ██╔══██╗██╔═══██╗╚══██╔══╝    ██║████╗  ██║██║╚══██╔══╝
//  ██████╔╝██║   ██║   ██║       ██║██╔██╗ ██║██║   ██║
//  ██╔══██╗██║   ██║   ██║       ██║██║╚██╗██║██║   ██║
//  ██████╔╝╚██████╔╝   ██║       ██║██║ ╚████║██║   ██║
//  ╚═════╝  ╚═════╝    ╚═╝       ╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝
//  §19 — BOT INITIALIZATION
// ══════════════════════════════════════════════════════════════════════

async function main() {
  Logger.raw('\x1b[35m\x1b[1m');
  Logger.raw('╔══════════════════════════════════════════════════════╗');
  Logger.raw('║         VAULTBOT — Discord Backup Bot v2.0           ║');
  Logger.raw('║          Production-Ready | discord.js v14           ║');
  Logger.raw('╚══════════════════════════════════════════════════════╝');
  Logger.raw('\x1b[0m');

  // Load persistent data
  DataManager.load();

  // Create Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
    ],
    presence: {
      //activities: [{ name: `${BOT_CONFIG.defaultPrefix}help | Backup & Restore`, type: ActivityType.Watching }],
      status: 'online',
    },
  });

  // Setup anti-crash
  setupAntiCrash(client);

  // ── Event: Ready ─────────────────────────────────────────────────
  client.once('ready', async () => {
    Logger.info('Bot', `Logged in as ${client.user.tag}`);
    Logger.info('Bot', `Serving ${client.guilds.cache.size} guild(s)`);

    // Ensure all guilds have a data entry
    for (const [, guild] of client.guilds.cache) {
      DataManager.ensureGuild(guild.id);
    }

    // Initialize auto-backup schedules
    AutoBackup.initAll(client);

    // Rotate activity
    const activities = [
      //{ name: `${BOT_CONFIG.defaultPrefix}help | Backup & Restore`, type: ActivityType.Watching },
      //{ name: `${client.guilds.cache.size} serveurs protégés`, type: ActivityType.Watching },
      //{ name: `VaultBot v${BOT_CONFIG.botVersion}`, type: ActivityType.Playing },
    ];
    let actIdx = 0;
    setInterval(() => {
      actIdx = (actIdx + 1) % activities.length;
      client.user.setActivity(activities[actIdx].name, { type: activities[actIdx].type });
    }, 30_000);

    Logger.info('Bot', '✅ VaultBot is ready!');
  });

  // ── Event: Guild Create ───────────────────────────────────────────
  client.on('guildCreate', (guild) => {
    DataManager.ensureGuild(guild.id);
    Logger.info('Bot', `Joined guild: ${guild.name} (${guild.id})`);
  });

  // ── Event: Message Create ─────────────────────────────────────────
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    await CommandHandler.route(message, client);
  });

  // ── Event: Error ──────────────────────────────────────────────────
  client.on('error', (err) => {
    Logger.error('Discord', `Client error: ${err.message}`);
  });

  client.on('warn', (info) => {
    Logger.warn('Discord', `Client warning: ${info}`);
  });

  // ── Login ─────────────────────────────────────────────────────────
  const token = BOT_CONFIG.token;

  if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    Logger.fatal('Bot', '❌ No Discord token provided!');
    Logger.raw('\n📌 Setup instructions:');
    Logger.raw('   1. Copy .env.example to .env');
    Logger.raw('   2. Set DISCORD_TOKEN=your_token_here');
    Logger.raw('   3. Run: node bot.cjs\n');
    process.exit(1);
  }

  Logger.info('Bot', 'Connecting to Discord…');

  await client.login(token).catch((err) => {
    Logger.fatal('Bot', `Failed to login: ${err.message}`);
    process.exit(1);
  });
}

// ── Launch ──────────────────────────────────────────────────────────
main().catch((err) => {
  Logger.fatal('Boot', `Fatal boot error: ${err.message}`, err.stack);
  process.exit(1);
});
