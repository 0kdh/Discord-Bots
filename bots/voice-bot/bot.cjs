'use strict';

const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config({
  path: path.join(__dirname, ".env")
});

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                      SORA Voice Bot                         ║
 * ║         The Ultimate Discord Voice Channel Manager          ║
 * ║                      Version 2.0.0                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Stack      : Node.js LTS + Discord.js v14 + CommonJS
 * File       : bot.cjs
 * Data       : data.json
 * Author     : SORA Voice Team
 * License    : MIT
 */

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  Collection,
  AuditLogEvent,
  ActivityType,
} = require('discord.js');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const DATA_FILE        = path.join(__dirname, 'data.json');
const DEFAULT_PREFIX   = '=';
const DEFAULT_COLOR    = '#7B1FA2';
const BOT_NAME         = 'SORA Voice';
const VERSION          = '2.0.0';
const SAVE_INTERVAL_MS = 30_000; // auto-save every 30 seconds
const COOLDOWN_MS      = 2_000;  // 2s command cooldown per user
const TEMP_VC_COOLDOWN = 10_000; // 10s anti-spam for temp VC creation
const MAX_BITRATE      = 384_000;
const MIN_BITRATE      = 8_000;

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT DATA MANAGER
// ─────────────────────────────────────────────────────────────────────────────
let db = {
  guilds:       {}, // guild-level config
  voiceStats:   {}, // per-user voice time stats
  tempChannels: {}, // active temp voice channels
  antiVoice:    {}, // anti-abuse config per guild
  autoVoice:    {}, // auto-voice config per guild
  voiceSessions:{}, // active voice sessions (join timestamps)
};

/** Safely load data.json with fallback */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // Merge parsed into defaults so we never lose keys
      db = Object.assign({
        guilds:       {},
        voiceStats:   {},
        tempChannels: {},
        antiVoice:    {},
        autoVoice:    {},
        voiceSessions:{},
      }, parsed);
      console.log(`[SORA] ✅ data.json loaded successfully.`);
    } else {
      saveData();
      console.log(`[SORA] 📄 data.json created with defaults.`);
    }
  } catch (err) {
    console.error(`[SORA] ❌ Failed to load data.json:`, err.message);
    console.log(`[SORA] ⚠️  Using default in-memory data.`);
  }
}

/** Atomically save data.json (write to temp then rename) */
function saveData() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error(`[SORA] ❌ Failed to save data.json:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GUILD CONFIG HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Get (or create) guild config */
function getGuild(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      prefix:       DEFAULT_PREFIX,
      color:        DEFAULT_COLOR,
      logChannel:   null,
      logsEnabled:  false,
      tempVcSetup:  null,  // channel ID that triggers temp VC creation
      tempVcCategory: null,
      mods:         [],
      helpers:      [],
      language:     'en',
    };
  }
  return db.guilds[guildId];
}

/** Get (or create) anti-voice config for a guild */
function getAntiVoice(guildId) {
  if (!db.antiVoice[guildId]) {
    db.antiVoice[guildId] = {
      enabled:     false,
      sensitivity: 3,
      action:      'warn',
      events:      {}, // userId -> { joins: [], moves: [], mutes: [] }
    };
  }
  return db.antiVoice[guildId];
}

/** Get (or create) auto-voice config for a guild */
function getAutoVoice(guildId) {
  if (!db.autoVoice[guildId]) {
    db.autoVoice[guildId] = {
      autoMute:    false,
      afkTime:     30,    // minutes
      autoCleanup: true,
      autoName:    null,  // template e.g. "Room {n}"
    };
  }
  return db.autoVoice[guildId];
}

/** Get (or create) voice stats for a user */
function getStats(guildId, userId) {
  if (!db.voiceStats[guildId]) db.voiceStats[guildId] = {};
  if (!db.voiceStats[guildId][userId]) {
    db.voiceStats[guildId][userId] = {
      totalMs: 0,
      joins:   0,
      lastTag: 'Unknown',
    };
  }
  return db.voiceStats[guildId][userId];
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCORD CLIENT
// ─────────────────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Cooldown map: userId -> timestamp
const cooldowns = new Collection();

// Temp VC creation cooldown: userId -> timestamp
const tempVcCooldowns = new Collection();

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Build a standard embed */
function embed(color, description) {
  return new EmbedBuilder()
    .setColor(color || DEFAULT_COLOR)
    .setDescription(description);
}

/** Build a success embed */
function ok(guildId, desc) {
  const col = getGuild(guildId).color || DEFAULT_COLOR;
  return embed(col, `✅ ${desc}`);
}

/** Build an error embed */
function err(guildId, desc) {
  return embed('#FF4444', `❌ ${desc}`);
}

/** Build an info embed */
function info(guildId, desc) {
  const col = getGuild(guildId).color || DEFAULT_COLOR;
  return embed(col, `ℹ️ ${desc}`);
}

/** Format ms to hh:mm:ss or Xh Xm Xs */
function formatDuration(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Log to voice log channel */
async function voiceLog(guild, embedData) {
  try {
    const cfg = getGuild(guild.id);
    if (!cfg.logsEnabled || !cfg.logChannel) return;
    const ch = guild.channels.cache.get(cfg.logChannel);
    if (!ch || ch.type !== ChannelType.GuildText) return;
    await ch.send({ embeds: [embedData] });
  } catch { /* silent */ }
}

/** Check if user has permission (owner, admin, mod, helper) */
function hasPermission(member, level = 'mod') {
  if (!member) return false;
  // Server owner always has full access
  if (member.guild.ownerId === member.id) return true;
  // Administrator permission
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const cfg = getGuild(member.guild.id);

  if (level === 'mod') {
    if (cfg.mods.includes(member.id)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  }
  if (level === 'helper') {
    if (cfg.helpers.includes(member.id)) return true;
    if (cfg.mods.includes(member.id)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  }
  return false;
}

/** Check if member is owner of a temp channel */
function isTempOwner(channelId, memberId) {
  const tc = db.tempChannels[channelId];
  return tc && tc.ownerId === memberId;
}

/** Get temp channel data */
function getTempChannel(channelId) {
  return db.tempChannels[channelId] || null;
}

/** Validate integer in range */
function parseIntRange(str, min, max) {
  const n = parseInt(str, 10);
  if (isNaN(n) || n < min || n > max) return null;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VOICE ABUSE TRACKER
// ─────────────────────────────────────────────────────────────────────────────
const SENSITIVITY_THRESHOLDS = {
  1: { joins: 20, moves: 15, mutes: 20 }, // very lenient
  2: { joins: 15, moves: 10, mutes: 15 },
  3: { joins: 10, moves: 7,  mutes: 10 }, // default
  4: { joins: 7,  moves: 5,  mutes: 7  },
  5: { joins: 4,  moves: 3,  mutes: 4  }, // very strict
};
const WINDOW_MS = 60_000; // 1 minute window

/** Record anti-voice event and check thresholds */
async function recordAntiEvent(guild, member, eventType) {
  try {
    const av = getAntiVoice(guild.id);
    if (!av.enabled) return;

    if (!av.events[member.id]) {
      av.events[member.id] = { joins: [], moves: [], mutes: [] };
    }

    const now = Date.now();
    const userEvents = av.events[member.id];

    // Push current timestamp
    if (!userEvents[eventType]) userEvents[eventType] = [];
    userEvents[eventType].push(now);

    // Clean old events outside window
    userEvents[eventType] = userEvents[eventType].filter(t => now - t < WINDOW_MS);

    const sens = av.sensitivity || 3;
    const thresholds = SENSITIVITY_THRESHOLDS[sens] || SENSITIVITY_THRESHOLDS[3];
    const count = userEvents[eventType].length;
    const limit = thresholds[eventType] || 10;

    if (count >= limit) {
      // Reset to avoid repeated triggers
      userEvents[eventType] = [];
      await executeAntiAction(guild, member, av.action, eventType, count);
    }
  } catch (e) {
    console.error('[SORA][AntiVoice] Error:', e.message);
  }
}

/** Execute anti-abuse action */
async function executeAntiAction(guild, member, action, reason, count) {
  try {
    const cfg = getGuild(guild.id);
    const desc = `**Anti-Voice triggered** on ${member.user.tag}\nEvent: \`${reason}\` (${count}x in 60s)\nAction: \`${action}\``;

    // Log
    await voiceLog(guild, new EmbedBuilder()
      .setColor('#FF6600')
      .setTitle('🛡️ Anti-Voice Abuse Detected')
      .setDescription(desc)
      .setTimestamp());

    console.log(`[SORA][AntiVoice] ${action} on ${member.user.tag} for ${reason} (${count}x)`);

    if (action === 'warn') {
      try {
        await member.send({ embeds: [embed('#FF6600', `⚠️ **Warning** from **${guild.name}**: You are triggering voice abuse detection (${reason}). Please stop.`)] });
      } catch { /* DMs closed */ }
    } else if (action === 'kick') {
      if (member.voice?.channel) await member.voice.disconnect('Anti-Voice: Abuse detected');
      await member.kick(`Anti-Voice: ${reason} abuse (${count}x)`).catch(() => {});
    } else if (action === 'ban') {
      await member.ban({ reason: `Anti-Voice: ${reason} abuse (${count}x)`, deleteMessageSeconds: 0 }).catch(() => {});
    } else if (action === 'tempban') {
      await member.ban({ reason: `Anti-Voice: ${reason} abuse (${count}x) [TEMP 1h]`, deleteMessageSeconds: 0 }).catch(() => {});
      // Unban after 1 hour
      setTimeout(async () => {
        try { await guild.members.unban(member.id, 'Anti-Voice: Temp ban expired'); } catch {}
      }, 3_600_000);
    }
  } catch (e) {
    console.error('[SORA][AntiVoice] Execute action error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE STATS TRACKER
// ─────────────────────────────────────────────────────────────────────────────

/** Called when a member joins a voice channel */
function startSession(guildId, userId, userTag) {
  if (!db.voiceSessions[guildId]) db.voiceSessions[guildId] = {};
  db.voiceSessions[guildId][userId] = Date.now();
  const stats = getStats(guildId, userId);
  stats.joins++;
  stats.lastTag = userTag;
}

/** Called when a member leaves a voice channel */
function endSession(guildId, userId) {
  if (!db.voiceSessions[guildId]) return;
  const joinTime = db.voiceSessions[guildId][userId];
  if (!joinTime) return;
  const elapsed = Date.now() - joinTime;
  const stats = getStats(guildId, userId);
  stats.totalMs += elapsed;
  delete db.voiceSessions[guildId][userId];
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY VOICE CHANNEL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/** Create a temporary voice channel for a member */
async function createTempVC(guild, member) {
  try {
    const cfg = getGuild(guild.id);
    if (!cfg.tempVcSetup) return;

    // Anti-spam cooldown
    const lastCreate = tempVcCooldowns.get(member.id);
    if (lastCreate && Date.now() - lastCreate < TEMP_VC_COOLDOWN) return;
    tempVcCooldowns.set(member.id, Date.now());

    const av = getAutoVoice(guild.id);
    const channelName = av.autoName
      ? av.autoName.replace('{user}', member.displayName).replace('{n}', Object.keys(db.tempChannels).length + 1)
      : `${member.displayName}'s Room`;

    const options = {
      name: channelName,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
          ],
        },
      ],
    };

    if (cfg.tempVcCategory) options.parent = cfg.tempVcCategory;

    const channel = await guild.channels.create(options);

    // Move member to new channel
    await member.voice.setChannel(channel);

    // Register temp channel
    db.tempChannels[channel.id] = {
      ownerId:   member.id,
      ownerTag:  member.user.tag,
      guildId:   guild.id,
      createdAt: Date.now(),
      whitelist: [],
      blacklist: [],
    };

    saveData();
    console.log(`[SORA][TempVC] Created "${channel.name}" for ${member.user.tag}`);

    // Log
    await voiceLog(guild, new EmbedBuilder()
      .setColor(cfg.color || DEFAULT_COLOR)
      .setTitle('🔊 Temp Channel Created')
      .setDescription(`**${member.user.tag}** created **${channel.name}**`)
      .setTimestamp());

  } catch (e) {
    console.error('[SORA][TempVC] Create error:', e.message);
  }
}

/** Delete temp channel if empty */
async function cleanupTempVC(channel) {
  try {
    if (!channel || !db.tempChannels[channel.id]) return;
    if (channel.members.size === 0) {
      await channel.delete('SORA: Temp VC empty');
      delete db.tempChannels[channel.id];
      saveData();
      console.log(`[SORA][TempVC] Deleted empty temp channel: ${channel.name}`);
    }
  } catch (e) {
    console.error('[SORA][TempVC] Cleanup error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AFK DISCONNECT TIMER
// ─────────────────────────────────────────────────────────────────────────────
const afkTimers = new Map(); // memberId -> timeoutId

function setAfkTimer(member) {
  clearAfkTimer(member.id);
  const av = getAutoVoice(member.guild.id);
  const cfg = getGuild(member.guild.id);
  if (!av.afkTime || av.afkTime <= 0) return;
  const ms = av.afkTime * 60_000;
  const tid = setTimeout(async () => {
    try {
      if (member.voice?.channel) {
        await voiceLog(member.guild, new EmbedBuilder()
          .setColor(cfg.color || DEFAULT_COLOR)
          .setTitle('💤 AFK Disconnect')
          .setDescription(`**${member.user.tag}** disconnected (AFK ${av.afkTime}min)`)
          .setTimestamp());
        await member.voice.disconnect('SORA: AFK timeout');
      }
    } catch { /* ignore */ }
    afkTimers.delete(member.id);
  }, ms);
  afkTimers.set(member.id, tid);
}

function clearAfkTimer(memberId) {
  if (afkTimers.has(memberId)) {
    clearTimeout(afkTimers.get(memberId));
    afkTimers.delete(memberId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND HANDLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a raw message into { prefix, command, subcommand, args, raw }
 */
function parseMessage(content, prefix) {
  if (!content.startsWith(prefix)) return null;
  const withoutPrefix = content.slice(prefix.length).trim();
  const parts = withoutPrefix.split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const subcommand = parts[1]?.toLowerCase();
  const args = parts.slice(1);
  const rawArgs = parts.slice(2);
  return { command, subcommand, args, rawArgs };
}

/** Extract first mentioned member */
async function getMentionedMember(message, args) {
  if (message.mentions.members.size > 0) return message.mentions.members.first();
  const id = args.find(a => /^\d{17,20}$/.test(a));
  if (id) {
    try { return await message.guild.members.fetch(id); } catch { return null; }
  }
  return null;
}

/** Extract first mentioned channel */
function getMentionedChannel(message, args) {
  if (message.mentions.channels.size > 0) return message.mentions.channels.first();
  const id = args.find(a => /^\d{17,20}$/.test(a));
  if (id) return message.guild.channels.cache.get(id) || null;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/** Send a paginated help embed */
async function cmdHelp(message, cfg) {
  const color = cfg.color || DEFAULT_COLOR;
  const p = cfg.prefix || DEFAULT_PREFIX;
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🎙️ ${BOT_NAME} — Command Reference v${VERSION}`)
    .setDescription(`Prefix: \`${p}\` | All commands are voice-channel focused.`)
    .addFields(
      {
        name: '🔧 Voice Moderation (`=vc`)',
        value: [
          `\`${p}mute @user\` — Server mute`,
          `\`${p}unmute @user\` — Server unmute`,
          `\`${p}deafen @user\` — Server deafen`,
          `\`${p}undeafen @user\` — Server undeafen`,
          `\`${p}kick @user\` — Kick from voice`,
          `\`${p}move @user #channel\` — Move to channel`,
          `\`${p}disconnect @user\` — Disconnect from voice`,
          `\`${p}lock\` — Lock current channel`,
          `\`${p}unlock\` — Unlock current channel`,
          `\`${p}hide\` — Hide current channel`,
          `\`${p}unhide\` — Unhide current channel`,
          `\`${p}limit <0-99>\` — Set user limit`,
          `\`${p}bitrate <8-384>\` — Set bitrate (kbps)`,
          `\`${p}rename <name>\` — Rename channel`,
          `\`${p}permit @user\` — Allow user in channel`,
          `\`${p}reject @user\` — Block user from channel`,
          `\`${p}clearperms\` — Clear all permission overrides`,
        ].join('\n'),
      },
      {
        name: '🏠 Temp Voice Channels',
        value: [
          `\`${p}setup tempvc #join-channel [#category]\` — Configure temp VC`,
          `\`${p}vc claim\` — Claim ownership of empty owner's temp channel`,
          `\`${p}vc transfer @user\` — Transfer temp channel ownership`,
          `\`${p}vc info\` — Show your temp channel info`,
        ].join('\n'),
      },
      {
        name: '🛡️ Anti-Voice Abuse',
        value: [
          `\`${p}antivoice on\` — Enable anti-voice`,
          `\`${p}antivoice off\` — Disable anti-voice`,
          `\`${p}antivoice sensitivity <1-5>\` — Set sensitivity`,
          `\`${p}antivoice action <warn/kick/ban/tempban>\` — Set action`,
        ].join('\n'),
      },
      {
        name: '📋 Voice Logs',
        value: [
          `\`${p}setlog #channel\` — Set log channel`,
          `\`${p}logs on\` — Enable logs`,
          `\`${p}logs off\` — Disable logs`,
        ].join('\n'),
      },
      {
        name: '📊 Voice Statistics',
        value: [
          `\`${p}vstats\` — Your voice stats`,
          `\`${p}vstats @user\` — User's voice stats`,
          `\`${p}vtop\` — Voice time leaderboard`,
          `\`${p}vreset [@user]\` — Reset stats`,
        ].join('\n'),
      },
      {
        name: '⚙️ Auto Voice Management',
        value: [
          `\`${p}automute on/off\` — Auto-mute new joiners`,
          `\`${p}afktime <minutes>\` — Set AFK disconnect time`,
          `\`${p}autocleanup on/off\` — Auto-delete empty channels`,
          `\`${p}autoname <template>\` — Temp VC name template ({user}, {n})`,
        ].join('\n'),
      },
      {
        name: '👑 Permissions',
        value: [
          `\`${p}addmod @user\` — Add bot moderator`,
          `\`${p}removemod @user\` — Remove bot moderator`,
          `\`${p}addhelper @user\` — Add bot helper`,
          `\`${p}remhelper @user\` — Remove bot helper`,
        ].join('\n'),
      },
      {
        name: '🔩 Configuration',
        value: [
          `\`${p}prefix <new>\` — Change prefix`,
          `\`${p}embedcolor #hex\` — Change embed color`,
          `\`${p}config\` — Show current config`,
          `\`${p}resetconfig\` — Reset guild config`,
          `\`${p}backup\` — Export config as JSON`,
          `\`${p}restore <json>\` — Import config from JSON`,
        ].join('\n'),
      }
    )
    .setFooter({ text: `${BOT_NAME} ${VERSION} • Voice Excellence` })
    .setTimestamp();

  await message.channel.send({ embeds: [e] });
}

// ─────────────────────────────────────────────────────────────────────────────
// VC SUB-COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

async function handleVC(message, args, cfg) {
  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;
  const color = cfg.color || DEFAULT_COLOR;

  if (!sub) {
    return message.channel.send({ embeds: [info(guildId, `Use \`${cfg.prefix}help\` to see voice commands.`)] });
  }

  // ── mute ──────────────────────────────────────────────────────────────────
  if (sub === 'mute') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid member.')] });
    if (!target.voice?.channel) return message.channel.send({ embeds: [err(guildId, `${target.user.tag} is not in a voice channel.`)] });
    try {
      await target.voice.setMute(true, `Muted by ${message.author.tag}`);
      await message.channel.send({ embeds: [ok(guildId, `Server muted **${target.user.tag}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🔇 Voice Muted')
        .setDescription(`**${target.user.tag}** muted by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── unmute ────────────────────────────────────────────────────────────────
  if (sub === 'unmute') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid member.')] });
    if (!target.voice?.channel) return message.channel.send({ embeds: [err(guildId, `${target.user.tag} is not in a voice channel.`)] });
    try {
      await target.voice.setMute(false, `Unmuted by ${message.author.tag}`);
      await message.channel.send({ embeds: [ok(guildId, `Server unmuted **${target.user.tag}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🔊 Voice Unmuted')
        .setDescription(`**${target.user.tag}** unmuted by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── deafen ────────────────────────────────────────────────────────────────
  if (sub === 'deafen') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid member.')] });
    if (!target.voice?.channel) return message.channel.send({ embeds: [err(guildId, `${target.user.tag} is not in a voice channel.`)] });
    try {
      await target.voice.setDeaf(true, `Deafened by ${message.author.tag}`);
      await message.channel.send({ embeds: [ok(guildId, `Server deafened **${target.user.tag}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🔕 Voice Deafened')
        .setDescription(`**${target.user.tag}** deafened by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── undeafen ──────────────────────────────────────────────────────────────
  if (sub === 'undeafen') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid member.')] });
    if (!target.voice?.channel) return message.channel.send({ embeds: [err(guildId, `${target.user.tag} is not in a voice channel.`)] });
    try {
      await target.voice.setDeaf(false, `Undeafened by ${message.author.tag}`);
      await message.channel.send({ embeds: [ok(guildId, `Server undeafened **${target.user.tag}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🔔 Voice Undeafened')
        .setDescription(`**${target.user.tag}** undeafened by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── kick (voice kick = disconnect) ────────────────────────────────────────
  if (sub === 'kick') {
    if (!hasPermission(message.member, 'mod')) return noPermEmbed(message, guildId);
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid member.')] });
    if (!target.voice?.channel) return message.channel.send({ embeds: [err(guildId, `${target.user.tag} is not in a voice channel.`)] });
    try {
      const chName = target.voice.channel.name;
      await target.voice.disconnect(`Voice kicked by ${message.author.tag}`);
      await message.channel.send({ embeds: [ok(guildId, `Kicked **${target.user.tag}** from **${chName}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('👢 Voice Kick')
        .setDescription(`**${target.user.tag}** kicked from **${chName}** by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── disconnect ────────────────────────────────────────────────────────────
  if (sub === 'disconnect') {
    if (!hasPermission(message.member, 'mod')) return noPermEmbed(message, guildId);
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid member.')] });
    if (!target.voice?.channel) return message.channel.send({ embeds: [err(guildId, `${target.user.tag} is not in a voice channel.`)] });
    try {
      await target.voice.disconnect(`Disconnected by ${message.author.tag}`);
      await message.channel.send({ embeds: [ok(guildId, `Disconnected **${target.user.tag}** from voice.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🔌 Voice Disconnect')
        .setDescription(`**${target.user.tag}** disconnected by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── move ──────────────────────────────────────────────────────────────────
  if (sub === 'move') {
    if (!hasPermission(message.member, 'mod')) return noPermEmbed(message, guildId);
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid member.')] });
    if (!target.voice?.channel) return message.channel.send({ embeds: [err(guildId, `${target.user.tag} is not in a voice channel.`)] });
    const dest = message.mentions.channels.first() || message.guild.channels.cache.get(args.find(a => /^\d{17,20}$/.test(a) && a !== target.id));
    if (!dest || dest.type !== ChannelType.GuildVoice) return message.channel.send({ embeds: [err(guildId, 'Please mention a valid voice channel to move to.')] });
    try {
      await target.voice.setChannel(dest, `Moved by ${message.author.tag}`);
      await message.channel.send({ embeds: [ok(guildId, `Moved **${target.user.tag}** to **${dest.name}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🚀 Voice Move')
        .setDescription(`**${target.user.tag}** moved to **${dest.name}** by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── lock ──────────────────────────────────────────────────────────────────
  if (sub === 'lock') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'You or the bot must be in a voice channel, or your temp channel must exist.')] });
    try {
      await vc.permissionOverwrites.edit(message.guild.id, { Connect: false });
      await message.channel.send({ embeds: [ok(guildId, `🔒 Locked **${vc.name}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🔒 Channel Locked')
        .setDescription(`**${vc.name}** locked by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── unlock ────────────────────────────────────────────────────────────────
  if (sub === 'unlock') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'You or the bot must be in a voice channel.')] });
    try {
      await vc.permissionOverwrites.edit(message.guild.id, { Connect: true });
      await message.channel.send({ embeds: [ok(guildId, `🔓 Unlocked **${vc.name}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🔓 Channel Unlocked')
        .setDescription(`**${vc.name}** unlocked by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── hide ──────────────────────────────────────────────────────────────────
  if (sub === 'hide') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    try {
      await vc.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
      await message.channel.send({ embeds: [ok(guildId, `👁️ Hidden **${vc.name}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('🙈 Channel Hidden')
        .setDescription(`**${vc.name}** hidden by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── unhide ────────────────────────────────────────────────────────────────
  if (sub === 'unhide') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    try {
      await vc.permissionOverwrites.edit(message.guild.id, { ViewChannel: true });
      await message.channel.send({ embeds: [ok(guildId, `👁️ Unhidden **${vc.name}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('👁️ Channel Unhidden')
        .setDescription(`**${vc.name}** unhidden by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── limit ─────────────────────────────────────────────────────────────────
  if (sub === 'limit') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    const num = parseIntRange(args[1], 0, 99);
    if (num === null) return message.channel.send({ embeds: [err(guildId, 'Provide a number between 0 and 99.')] });
    try {
      await vc.setUserLimit(num);
      await message.channel.send({ embeds: [ok(guildId, `User limit for **${vc.name}** set to **${num === 0 ? 'Unlimited' : num}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('👥 Limit Changed')
        .setDescription(`**${vc.name}** limit set to \`${num}\` by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── bitrate ───────────────────────────────────────────────────────────────
  if (sub === 'bitrate') {
    if (!hasPermission(message.member, 'mod')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    const kbps = parseIntRange(args[1], 8, 384);
    if (kbps === null) return message.channel.send({ embeds: [err(guildId, 'Provide a bitrate between 8 and 384 kbps.')] });
    const bps = kbps * 1000;
    try {
      await vc.setBitrate(Math.min(bps, MAX_BITRATE));
      await message.channel.send({ embeds: [ok(guildId, `Bitrate of **${vc.name}** set to **${kbps}kbps**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('📡 Bitrate Changed')
        .setDescription(`**${vc.name}** bitrate → \`${kbps}kbps\` by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── rename ────────────────────────────────────────────────────────────────
  if (sub === 'rename') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    const newName = args.slice(1).join(' ').trim();
    if (!newName || newName.length > 100) return message.channel.send({ embeds: [err(guildId, 'Provide a name (1-100 chars).')] });
    try {
      const old = vc.name;
      await vc.setName(newName);
      await message.channel.send({ embeds: [ok(guildId, `Renamed **${old}** → **${newName}**.`)] });
      await voiceLog(message.guild, new EmbedBuilder().setColor(color)
        .setTitle('✏️ Channel Renamed')
        .setDescription(`**${old}** → **${newName}** by **${message.author.tag}**`)
        .setTimestamp());
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── permit ────────────────────────────────────────────────────────────────
  if (sub === 'permit') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Mention a member to permit.')] });
    try {
      await vc.permissionOverwrites.edit(target.id, { Connect: true, ViewChannel: true });
      // Update whitelist on temp channel if applicable
      if (db.tempChannels[vc.id]) {
        if (!db.tempChannels[vc.id].whitelist.includes(target.id))
          db.tempChannels[vc.id].whitelist.push(target.id);
        // Remove from blacklist
        db.tempChannels[vc.id].blacklist = db.tempChannels[vc.id].blacklist.filter(id => id !== target.id);
        saveData();
      }
      await message.channel.send({ embeds: [ok(guildId, `✅ **${target.user.tag}** permitted in **${vc.name}**.`)] });
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── reject ────────────────────────────────────────────────────────────────
  if (sub === 'reject') {
    if (!hasPermission(message.member, 'helper')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Mention a member to reject.')] });
    try {
      await vc.permissionOverwrites.edit(target.id, { Connect: false, ViewChannel: false });
      // Kick from channel if currently in it
      if (target.voice?.channel?.id === vc.id) await target.voice.disconnect('Rejected from channel');
      if (db.tempChannels[vc.id]) {
        if (!db.tempChannels[vc.id].blacklist.includes(target.id))
          db.tempChannels[vc.id].blacklist.push(target.id);
        db.tempChannels[vc.id].whitelist = db.tempChannels[vc.id].whitelist.filter(id => id !== target.id);
        saveData();
      }
      await message.channel.send({ embeds: [ok(guildId, `🚫 **${target.user.tag}** rejected from **${vc.name}**.`)] });
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── clearperms ────────────────────────────────────────────────────────────
  if (sub === 'clearperms') {
    if (!hasPermission(message.member, 'mod')) return noPermEmbed(message, guildId);
    const vc = getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'No target voice channel found.')] });
    try {
      // Remove all overrides except @everyone
      const toDelete = vc.permissionOverwrites.cache.filter(o => o.id !== message.guild.id);
      for (const [, override] of toDelete) await override.delete();
      if (db.tempChannels[vc.id]) {
        db.tempChannels[vc.id].whitelist = [];
        db.tempChannels[vc.id].blacklist = [];
        saveData();
      }
      await message.channel.send({ embeds: [ok(guildId, `Permission overrides cleared for **${vc.name}**.`)] });
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Failed: ${e.message}`)] }); }
    return;
  }

  // ── claim ─────────────────────────────────────────────────────────────────
  if (sub === 'claim') {
    if (!message.member.voice?.channel) return message.channel.send({ embeds: [err(guildId, 'You must be in a voice channel.')] });
    const vc = message.member.voice.channel;
    const tc = getTempChannel(vc.id);
    if (!tc) return message.channel.send({ embeds: [err(guildId, 'This is not a temp channel.')] });
    if (tc.ownerId === message.author.id) return message.channel.send({ embeds: [info(guildId, 'You already own this channel.')] });
    // Check if owner is still in channel
    const ownerInChannel = vc.members.has(tc.ownerId);
    if (ownerInChannel) return message.channel.send({ embeds: [err(guildId, 'The current owner is still in this channel.')] });
    tc.ownerId = message.author.id;
    tc.ownerTag = message.author.tag;
    saveData();
    // Grant permissions
    try {
      await vc.permissionOverwrites.edit(message.author.id, {
        Connect: true, ViewChannel: true, ManageChannels: true, MoveMembers: true, MuteMembers: true
      });
      await message.channel.send({ embeds: [ok(guildId, `You have claimed ownership of **${vc.name}**.`)] });
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Claim recorded but failed to set perms: ${e.message}`)] }); }
    return;
  }

  // ── transfer ──────────────────────────────────────────────────────────────
  if (sub === 'transfer') {
    if (!message.member.voice?.channel) return message.channel.send({ embeds: [err(guildId, 'You must be in a voice channel.')] });
    const vc = message.member.voice.channel;
    const tc = getTempChannel(vc.id);
    if (!tc) return message.channel.send({ embeds: [err(guildId, 'This is not a temp channel.')] });
    if (tc.ownerId !== message.author.id && !hasPermission(message.member, 'mod'))
      return message.channel.send({ embeds: [err(guildId, 'Only the channel owner can transfer.')] });
    const target = await getMentionedMember(message, args.slice(1));
    if (!target) return message.channel.send({ embeds: [err(guildId, 'Mention the member to transfer to.')] });
    if (!vc.members.has(target.id)) return message.channel.send({ embeds: [err(guildId, 'That member must be in the channel.')] });
    const oldOwnerTag = tc.ownerTag;
    tc.ownerId = target.id;
    tc.ownerTag = target.user.tag;
    saveData();
    try {
      await vc.permissionOverwrites.edit(target.id, {
        Connect: true, ViewChannel: true, ManageChannels: true, MoveMembers: true, MuteMembers: true
      });
      await message.channel.send({ embeds: [ok(guildId, `Ownership of **${vc.name}** transferred from **${oldOwnerTag}** to **${target.user.tag}**.`)] });
    } catch (e) { await message.channel.send({ embeds: [err(guildId, `Transfer recorded but failed to set perms: ${e.message}`)] }); }
    return;
  }

  // ── info ──────────────────────────────────────────────────────────────────
  if (sub === 'info') {
    const vc = message.member.voice?.channel || getTargetVC(message);
    if (!vc) return message.channel.send({ embeds: [err(guildId, 'You are not in a voice channel.')] });
    const tc = getTempChannel(vc.id);
    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🔊 ${vc.name} — Channel Info`)
      .addFields(
        { name: '🆔 Channel ID',   value: `\`${vc.id}\``,                           inline: true },
        { name: '👥 Members',      value: `${vc.members.size}/${vc.userLimit || '∞'}`, inline: true },
        { name: '📡 Bitrate',      value: `${Math.floor(vc.bitrate / 1000)}kbps`,    inline: true },
        { name: '🔒 Locked',       value: vc.permissionsFor(message.guild.id)?.has(PermissionFlagsBits.Connect) ? 'No' : 'Yes', inline: true },
        { name: '👁️ Visible',      value: vc.permissionsFor(message.guild.id)?.has(PermissionFlagsBits.ViewChannel) ? 'Yes' : 'No', inline: true },
        { name: '🌍 Region',       value: vc.rtcRegion || 'Auto',                   inline: true },
      )
      .setTimestamp();

    if (tc) {
      e.addFields(
        { name: '👑 Owner', value: tc.ownerTag,                              inline: true },
        { name: '✅ Whitelist', value: tc.whitelist.length ? tc.whitelist.map(id => `<@${id}>`).join(', ') : 'None', inline: false },
        { name: '🚫 Blacklist', value: tc.blacklist.length ? tc.blacklist.map(id => `<@${id}>`).join(', ') : 'None', inline: false },
      );
    }

    await message.channel.send({ embeds: [e] });
    return;
  }

  await message.channel.send({ embeds: [err(guildId, `Unknown subcommand \`${sub}\`. Use \`${cfg.prefix}help\` for help.`)] });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET TARGET VOICE CHANNEL (message author's VC or temp channel they own)
// ─────────────────────────────────────────────────────────────────────────────
function getTargetVC(message) {
  // 1. Prefer author's current channel
  if (message.member.voice?.channel) return message.member.voice.channel;
  // 2. Find a temp channel they own
  const ownedId = Object.keys(db.tempChannels).find(
    id => db.tempChannels[id].ownerId === message.author.id &&
          db.tempChannels[id].guildId === message.guild.id
  );
  if (ownedId) return message.guild.channels.cache.get(ownedId) || null;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NO PERMISSION EMBED
// ─────────────────────────────────────────────────────────────────────────────
async function noPermEmbed(message, guildId) {
  return message.channel.send({ embeds: [err(guildId, 'You don\'t have permission to use this command.')] });
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP COMMAND
// ─────────────────────────────────────────────────────────────────────────────
async function handleSetup(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Manage Guild or Mod permission.')] });

  const sub = args[0]?.toLowerCase();

  if (sub === 'tempvc') {
    const joinCh = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
    if (!joinCh || joinCh.type !== ChannelType.GuildVoice)
      return message.channel.send({ embeds: [err(guildId, 'Mention a voice channel as the trigger (join-to-create) channel.')] });

    // Optional category
    const catId = args[2] ? args[2].replace(/[<#>]/g, '') : null;
    const cat = catId ? message.guild.channels.cache.get(catId) : null;

    cfg.tempVcSetup   = joinCh.id;
    cfg.tempVcCategory = cat?.id || joinCh.parent?.id || null;
    saveData();

    const catName = cat?.name || message.guild.channels.cache.get(joinCh.parent?.id)?.name || 'Same category';
    return message.channel.send({ embeds: [ok(guildId,
      `Temp VC system configured!\n**Trigger channel:** ${joinCh.name}\n**Category:** ${catName}`
    )] });
  }

  return message.channel.send({ embeds: [err(guildId, `Unknown setup option. Try \`${cfg.prefix}setup tempvc #channel\``)] });
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VOICE COMMAND
// ─────────────────────────────────────────────────────────────────────────────
async function handleAntiVoice(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const av = getAntiVoice(guildId);
  const sub = args[0]?.toLowerCase();

  if (sub === 'on') {
    av.enabled = true;
    saveData();
    return message.channel.send({ embeds: [ok(guildId, 'Anti-Voice protection **enabled**.')] });
  }
  if (sub === 'off') {
    av.enabled = false;
    saveData();
    return message.channel.send({ embeds: [ok(guildId, 'Anti-Voice protection **disabled**.')] });
  }
  if (sub === 'sensitivity') {
    const val = parseIntRange(args[1], 1, 5);
    if (val === null) return message.channel.send({ embeds: [err(guildId, 'Sensitivity must be between 1 and 5.')] });
    av.sensitivity = val;
    saveData();
    return message.channel.send({ embeds: [ok(guildId, `Anti-Voice sensitivity set to **${val}**.`)] });
  }
  if (sub === 'action') {
    const allowed = ['warn', 'kick', 'ban', 'tempban'];
    if (!allowed.includes(args[1])) return message.channel.send({ embeds: [err(guildId, `Action must be one of: ${allowed.join(', ')}`)] });
    av.action = args[1];
    saveData();
    return message.channel.send({ embeds: [ok(guildId, `Anti-Voice action set to **${args[1]}**.`)] });
  }

  // Show current config
  return message.channel.send({ embeds: [new EmbedBuilder()
    .setColor(cfg.color || DEFAULT_COLOR)
    .setTitle('🛡️ Anti-Voice Configuration')
    .addFields(
      { name: 'Status',      value: av.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'Sensitivity', value: `${av.sensitivity}/5`,                    inline: true },
      { name: 'Action',      value: av.action,                                 inline: true },
    )
    .setTimestamp()
  ] });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGS COMMANDS
// ─────────────────────────────────────────────────────────────────────────────
async function handleSetLog(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
  if (!ch || ch.type !== ChannelType.GuildText)
    return message.channel.send({ embeds: [err(guildId, 'Mention a text channel for logs.')] });

  cfg.logChannel = ch.id;
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `Log channel set to ${ch}.`)] });
}

async function handleLogs(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const sub = args[0]?.toLowerCase();
  if (sub === 'on') {
    cfg.logsEnabled = true;
    saveData();
    return message.channel.send({ embeds: [ok(guildId, 'Voice logs **enabled**.')] });
  }
  if (sub === 'off') {
    cfg.logsEnabled = false;
    saveData();
    return message.channel.send({ embeds: [ok(guildId, 'Voice logs **disabled**.')] });
  }
  return message.channel.send({ embeds: [err(guildId, 'Use `logs on` or `logs off`.')] });
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE STATS COMMANDS
// ─────────────────────────────────────────────────────────────────────────────
async function handleVStats(message, args, cfg) {
  const guildId = message.guild.id;
  const target = await getMentionedMember(message, args) || message.member;
  const stats = getStats(guildId, target.id);

  // Add current live session if active
  let liveMs = 0;
  if (db.voiceSessions[guildId]?.[target.id]) {
    liveMs = Date.now() - db.voiceSessions[guildId][target.id];
  }

  const totalMs = stats.totalMs + liveMs;

  const e = new EmbedBuilder()
    .setColor(cfg.color || DEFAULT_COLOR)
    .setTitle(`📊 Voice Stats — ${target.user.tag}`)
    .setThumbnail(target.user.displayAvatarURL())
    .addFields(
      { name: '⏱️ Total Time', value: totalMs > 0 ? formatDuration(totalMs) : '0s', inline: true },
      { name: '🔊 Total Joins', value: `${stats.joins}`,                              inline: true },
      { name: '📡 Live Session', value: liveMs > 0 ? formatDuration(liveMs) : 'Not in VC', inline: true },
    )
    .setTimestamp();

  return message.channel.send({ embeds: [e] });
}

async function handleVTop(message, cfg) {
  const guildId = message.guild.id;
  const guildStats = db.voiceStats[guildId] || {};

  const entries = Object.entries(guildStats)
    .map(([uid, s]) => {
      let liveMs = db.voiceSessions[guildId]?.[uid] ? Date.now() - db.voiceSessions[guildId][uid] : 0;
      return { uid, totalMs: s.totalMs + liveMs, tag: s.lastTag, joins: s.joins };
    })
    .filter(e => e.totalMs > 0)
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 10);

  if (entries.length === 0)
    return message.channel.send({ embeds: [info(guildId, 'No voice stats recorded yet.')] });

  const medals = ['🥇', '🥈', '🥉'];
  const desc = entries.map((e, i) =>
    `${medals[i] || `\`${i + 1}.\``} **${e.tag}** — ${formatDuration(e.totalMs)} (${e.joins} joins)`
  ).join('\n');

  return message.channel.send({ embeds: [new EmbedBuilder()
    .setColor(cfg.color || DEFAULT_COLOR)
    .setTitle('🏆 Voice Time Leaderboard')
    .setDescription(desc)
    .setTimestamp()
  ] });
}

async function handleVReset(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const target = await getMentionedMember(message, args);
  if (target) {
    if (db.voiceStats[guildId]) delete db.voiceStats[guildId][target.id];
    if (db.voiceSessions[guildId]) delete db.voiceSessions[guildId][target.id];
    saveData();
    return message.channel.send({ embeds: [ok(guildId, `Voice stats reset for **${target.user.tag}**.`)] });
  }

  // Reset all
  db.voiceStats[guildId] = {};
  db.voiceSessions[guildId] = {};
  saveData();
  return message.channel.send({ embeds: [ok(guildId, 'All voice stats for this server have been reset.')] });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO VOICE COMMANDS
// ─────────────────────────────────────────────────────────────────────────────
async function handleAutoMute(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const av = getAutoVoice(guildId);
  const sub = args[0]?.toLowerCase();
  if (sub === 'on')  { av.autoMute = true;  saveData(); return message.channel.send({ embeds: [ok(guildId, 'Auto-mute on join **enabled**.')] }); }
  if (sub === 'off') { av.autoMute = false; saveData(); return message.channel.send({ embeds: [ok(guildId, 'Auto-mute on join **disabled**.')] }); }
  return message.channel.send({ embeds: [err(guildId, 'Use `automute on` or `automute off`.')] });
}

async function handleAfkTime(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const av = getAutoVoice(guildId);
  const minutes = parseIntRange(args[0], 0, 1440);
  if (minutes === null) return message.channel.send({ embeds: [err(guildId, 'Provide minutes between 0 (disabled) and 1440.')] });
  av.afkTime = minutes;
  saveData();
  const msg = minutes === 0 ? 'AFK auto-disconnect **disabled**.' : `AFK auto-disconnect set to **${minutes} minutes**.`;
  return message.channel.send({ embeds: [ok(guildId, msg)] });
}

async function handleAutoCleanup(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const av = getAutoVoice(guildId);
  const sub = args[0]?.toLowerCase();
  if (sub === 'on')  { av.autoCleanup = true;  saveData(); return message.channel.send({ embeds: [ok(guildId, 'Auto-cleanup of empty channels **enabled**.')] }); }
  if (sub === 'off') { av.autoCleanup = false; saveData(); return message.channel.send({ embeds: [ok(guildId, 'Auto-cleanup **disabled**.')] }); }
  return message.channel.send({ embeds: [err(guildId, 'Use `autocleanup on` or `autocleanup off`.')] });
}

async function handleAutoName(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const av = getAutoVoice(guildId);
  const template = args.join(' ').trim();
  if (!template) {
    av.autoName = null;
    saveData();
    return message.channel.send({ embeds: [ok(guildId, 'Auto-name template reset to default (`{user}\'s Room`).')] });
  }
  if (template.length > 100) return message.channel.send({ embeds: [err(guildId, 'Template too long (max 100 chars).')] });
  av.autoName = template;
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `Auto-name template set to: \`${template}\`\nVariables: \`{user}\` = username, \`{n}\` = room number`)] });
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
async function handleAddMod(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'Only admins/server owner can manage mods.')] });
  const target = await getMentionedMember(message, args);
  if (!target) return message.channel.send({ embeds: [err(guildId, 'Mention a member.')] });
  if (!cfg.mods.includes(target.id)) cfg.mods.push(target.id);
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `**${target.user.tag}** added as SORA Mod.`)] });
}

async function handleRemoveMod(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'Only admins/server owner can manage mods.')] });
  const target = await getMentionedMember(message, args);
  if (!target) return message.channel.send({ embeds: [err(guildId, 'Mention a member.')] });
  cfg.mods = cfg.mods.filter(id => id !== target.id);
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `**${target.user.tag}** removed from SORA Mods.`)] });
}

async function handleAddHelper(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });
  const target = await getMentionedMember(message, args);
  if (!target) return message.channel.send({ embeds: [err(guildId, 'Mention a member.')] });
  if (!cfg.helpers.includes(target.id)) cfg.helpers.push(target.id);
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `**${target.user.tag}** added as SORA Helper.`)] });
}

async function handleRemoveHelper(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });
  const target = await getMentionedMember(message, args);
  if (!target) return message.channel.send({ embeds: [err(guildId, 'Mention a member.')] });
  cfg.helpers = cfg.helpers.filter(id => id !== target.id);
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `**${target.user.tag}** removed from SORA Helpers.`)] });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG COMMANDS
// ─────────────────────────────────────────────────────────────────────────────
async function handleConfig(message, cfg) {
  const guildId = message.guild.id;
  const av = getAutoVoice(guildId);
  const anti = getAntiVoice(guildId);
  const triggerCh = cfg.tempVcSetup ? message.guild.channels.cache.get(cfg.tempVcSetup)?.name || cfg.tempVcSetup : 'Not set';
  const logCh = cfg.logChannel ? message.guild.channels.cache.get(cfg.logChannel)?.toString() || cfg.logChannel : 'Not set';

  return message.channel.send({ embeds: [new EmbedBuilder()
    .setColor(cfg.color || DEFAULT_COLOR)
    .setTitle(`⚙️ ${BOT_NAME} — Server Configuration`)
    .addFields(
      { name: '🔧 Prefix',        value: `\`${cfg.prefix}\``,                       inline: true },
      { name: '🎨 Embed Color',   value: cfg.color || DEFAULT_COLOR,                 inline: true },
      { name: '🌍 Language',      value: cfg.language || 'en',                       inline: true },
      { name: '📋 Log Channel',   value: logCh,                                      inline: true },
      { name: '📋 Logs Enabled',  value: cfg.logsEnabled ? '✅' : '❌',              inline: true },
      { name: '🔊 Temp VC Trigger', value: triggerCh,                               inline: true },
      { name: '🔇 Auto Mute',     value: av.autoMute ? '✅' : '❌',                  inline: true },
      { name: '💤 AFK Time',      value: av.afkTime ? `${av.afkTime}min` : 'Off',   inline: true },
      { name: '🧹 Auto Cleanup',  value: av.autoCleanup ? '✅' : '❌',               inline: true },
      { name: '🛡️ Anti-Voice',    value: anti.enabled ? `✅ (S:${anti.sensitivity}, ${anti.action})` : '❌', inline: true },
      { name: '👮 Mods',          value: cfg.mods.length ? cfg.mods.map(id => `<@${id}>`).join(', ') : 'None', inline: false },
      { name: '🤝 Helpers',       value: cfg.helpers.length ? cfg.helpers.map(id => `<@${id}>`).join(', ') : 'None', inline: false },
    )
    .setTimestamp()
  ] });
}

async function handlePrefix(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const newPrefix = args[0];
  if (!newPrefix || newPrefix.length > 5)
    return message.channel.send({ embeds: [err(guildId, 'Prefix must be 1-5 characters.')] });
  cfg.prefix = newPrefix;
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `Prefix changed to \`${newPrefix}\`.`)] });
}

async function handleEmbedColor(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const hex = args[0];
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex))
    return message.channel.send({ embeds: [err(guildId, 'Provide a valid hex color like `#7B1FA2`.')] });

  cfg.color = hex;
  saveData();
  return message.channel.send({ embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ Embed color set to \`${hex}\`.`)] });
}

async function handleLanguage(message, args, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });
  // Language support placeholder (en by default)
  const lang = args[0]?.toLowerCase();
  if (!['en', 'fr', 'es', 'de', 'pt'].includes(lang))
    return message.channel.send({ embeds: [err(guildId, 'Supported languages: en, fr, es, de, pt')] });
  cfg.language = lang;
  saveData();
  return message.channel.send({ embeds: [ok(guildId, `Language set to \`${lang}\`.`)] });
}

async function handleResetConfig(message, cfg) {
  const guildId = message.guild.id;
  if (message.guild.ownerId !== message.author.id && !message.member.permissions.has(PermissionFlagsBits.Administrator))
    return message.channel.send({ embeds: [err(guildId, 'Only server owner or admins can reset config.')] });

  delete db.guilds[guildId];
  delete db.antiVoice[guildId];
  delete db.autoVoice[guildId];
  saveData();
  return message.channel.send({ embeds: [ok(guildId, 'Server configuration has been reset to defaults.')] });
}

async function handleBackup(message, cfg) {
  const guildId = message.guild.id;
  if (!hasPermission(message.member, 'mod'))
    return message.channel.send({ embeds: [err(guildId, 'You need Mod permission.')] });

  const backup = {
    guild:     db.guilds[guildId] || {},
    antiVoice: db.antiVoice[guildId] || {},
    autoVoice: db.autoVoice[guildId] || {},
  };

  const json = JSON.stringify(backup, null, 2);
  // Send as attachment
  const buf = Buffer.from(json, 'utf8');
  await message.channel.send({
    embeds: [ok(guildId, 'Config backup generated. Download the attached file.')],
    files: [{ attachment: buf, name: `sora-backup-${guildId}.json` }]
  });
}

async function handleRestore(message, args, cfg) {
  const guildId = message.guild.id;
  if (message.guild.ownerId !== message.author.id && !message.member.permissions.has(PermissionFlagsBits.Administrator))
    return message.channel.send({ embeds: [err(guildId, 'Only server owner/admin can restore config.')] });

  // Try to parse from attachment or inline JSON
  let jsonStr = args.join(' ').trim();
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (!attachment.name.endsWith('.json'))
      return message.channel.send({ embeds: [err(guildId, 'Attach a valid .json backup file.')] });
    try {
      const resp = await fetch(attachment.url);
      jsonStr = await resp.text();
    } catch {
      return message.channel.send({ embeds: [err(guildId, 'Failed to download attachment.')] });
    }
  }

  if (!jsonStr) return message.channel.send({ embeds: [err(guildId, 'Attach a backup file or provide JSON inline.')] });

  try {
    const data = JSON.parse(jsonStr);
    if (data.guild) db.guilds[guildId] = data.guild;
    if (data.antiVoice) db.antiVoice[guildId] = data.antiVoice;
    if (data.autoVoice) db.autoVoice[guildId] = data.autoVoice;
    saveData();
    return message.channel.send({ embeds: [ok(guildId, 'Config restored successfully from backup!')] });
  } catch {
    return message.channel.send({ embeds: [err(guildId, 'Invalid JSON. Restore failed.')] });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE EVENT — MAIN ROUTER
// ─────────────────────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const cfg = getGuild(guildId);
    const prefix = cfg.prefix || DEFAULT_PREFIX;

    if (!message.content.startsWith(prefix)) return;

    // ── Cooldown check ──────────────────────────────────────────────────────
    const now = Date.now();
    const lastUsed = cooldowns.get(message.author.id) || 0;
    if (now - lastUsed < COOLDOWN_MS) return; // silently ignore
    cooldowns.set(message.author.id, now);

    const parsed = parseMessage(message.content, prefix);
    if (!parsed) return;

    const { command, args } = parsed;

    // ── Route commands ──────────────────────────────────────────────────────
    switch (command) {

      // Help
      case 'help':
      case 'h':
        await cmdHelp(message, cfg);
        break;

      // Voice moderation + temp VC
      case 'vc':
        await handleVC(message, args, cfg);
        break;

      // Setup
      case 'setup':
        await handleSetup(message, args, cfg);
        break;

      // Anti-voice
      case 'antivoice':
      case 'av':
        await handleAntiVoice(message, args, cfg);
        break;

      // Logs
      case 'setlog':
        await handleSetLog(message, args, cfg);
        break;
      case 'logs':
        await handleLogs(message, args, cfg);
        break;

      // Voice stats
      case 'vstats':
      case 'vs':
        await handleVStats(message, args, cfg);
        break;
      case 'vtop':
        await handleVTop(message, cfg);
        break;
      case 'vreset':
        await handleVReset(message, args, cfg);
        break;

      // Auto voice
      case 'automute':
        await handleAutoMute(message, args, cfg);
        break;
      case 'afktime':
        await handleAfkTime(message, args, cfg);
        break;
      case 'autocleanup':
        await handleAutoCleanup(message, args, cfg);
        break;
      case 'autoname':
        await handleAutoName(message, args, cfg);
        break;

      // Permissions
      case 'addmod':
        await handleAddMod(message, args, cfg);
        break;
      case 'removemod':
      case 'remmod':
        await handleRemoveMod(message, args, cfg);
        break;
      case 'addhelper':
        await handleAddHelper(message, args, cfg);
        break;
      case 'remhelper':
      case 'removehelper':
        await handleRemoveHelper(message, args, cfg);
        break;

      // Config
      case 'config':
        await handleConfig(message, cfg);
        break;
      case 'prefix':
        await handlePrefix(message, args, cfg);
        break;
      case 'embedcolor':
      case 'color':
        await handleEmbedColor(message, args, cfg);
        break;
      case 'language':
      case 'lang':
        await handleLanguage(message, args, cfg);
        break;
      case 'resetconfig':
        await handleResetConfig(message, cfg);
        break;
      case 'backup':
        await handleBackup(message, cfg);
        break;
      case 'restore':
        await handleRestore(message, args, cfg);
        break;

      // Ping / info
      case 'ping':
        await message.channel.send({ embeds: [info(guildId, `🏓 Pong! Latency: **${Math.round(client.ws.ping)}ms**`)] });
        break;
      case 'invite':
        await message.channel.send({ embeds: [info(guildId,
          `Invite SORA Voice to your server:\nhttps://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`
        )] });
        break;

      default:
        // Unknown command — silently ignore to avoid spam
        break;
    }
  } catch (e) {
    console.error('[SORA][MessageCreate] Unhandled error:', e);
    try {
      await message.channel.send({ embeds: [embed('#FF4444', `❌ An unexpected error occurred: ${e.message}`)] });
    } catch { /* ignore */ }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VOICE STATE UPDATE EVENT — CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const guild  = newState.guild;
    const member = newState.member;
    if (!member || member.user.bot) return;

    const guildId = guild.id;
    const cfg     = getGuild(guildId);
    const av      = getAutoVoice(guildId);
    const color   = cfg.color || DEFAULT_COLOR;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // ────────────────────────────────────────────────────────────────────────
    // JOIN: member entered a voice channel
    // ────────────────────────────────────────────────────────────────────────
    if (!oldChannel && newChannel) {
      startSession(guildId, member.id, member.user.tag);
      clearAfkTimer(member.id);

      // Anti-voice join tracking
      await recordAntiEvent(guild, member, 'joins');

      // Temp VC: trigger channel
      if (cfg.tempVcSetup && newChannel.id === cfg.tempVcSetup) {
        await createTempVC(guild, member);
      }

      // Auto-mute on join
      if (av.autoMute && newChannel.id !== cfg.tempVcSetup) {
        try { await member.voice.setMute(true, 'SORA: Auto-mute on join'); } catch {}
      }

      // AFK timer
      if (av.afkTime > 0) setAfkTimer(member);

      // Logs
      await voiceLog(guild, new EmbedBuilder().setColor(color)
        .setTitle('🟢 Voice Join')
        .setDescription(`**${member.user.tag}** joined **${newChannel.name}**`)
        .addFields({ name: 'Channel ID', value: `\`${newChannel.id}\``, inline: true })
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp());
    }

    // ────────────────────────────────────────────────────────────────────────
    // LEAVE: member left a voice channel
    // ────────────────────────────────────────────────────────────────────────
    else if (oldChannel && !newChannel) {
      endSession(guildId, member.id);
      clearAfkTimer(member.id);

      // Temp VC cleanup
      if (db.tempChannels[oldChannel.id]) {
        if (av.autoCleanup) await cleanupTempVC(oldChannel);
      }

      // Logs
      await voiceLog(guild, new EmbedBuilder().setColor('#FF5555')
        .setTitle('🔴 Voice Leave')
        .setDescription(`**${member.user.tag}** left **${oldChannel.name}**`)
        .addFields({ name: 'Channel ID', value: `\`${oldChannel.id}\``, inline: true })
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp());
    }

    // ────────────────────────────────────────────────────────────────────────
    // MOVE: member switched channels
    // ────────────────────────────────────────────────────────────────────────
    else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      // Reset AFK timer on move
      clearAfkTimer(member.id);
      if (av.afkTime > 0) setAfkTimer(member);

      // Anti-voice move tracking
      await recordAntiEvent(guild, member, 'moves');

      // Temp VC: trigger channel in new channel
      if (cfg.tempVcSetup && newChannel.id === cfg.tempVcSetup) {
        await createTempVC(guild, member);
      }

      // Cleanup old temp channel if empty
      if (db.tempChannels[oldChannel.id] && av.autoCleanup) {
        await cleanupTempVC(oldChannel);
      }

      // Logs
      await voiceLog(guild, new EmbedBuilder().setColor('#FFAA00')
        .setTitle('🔀 Voice Move')
        .setDescription(`**${member.user.tag}** moved\n**${oldChannel.name}** → **${newChannel.name}**`)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp());
    }

    // ────────────────────────────────────────────────────────────────────────
    // MUTE/UNMUTE (server mute)
    // ────────────────────────────────────────────────────────────────────────
    if (oldState.serverMute !== newState.serverMute && newChannel) {
      const muted = newState.serverMute;
      await recordAntiEvent(guild, member, 'mutes');
      await voiceLog(guild, new EmbedBuilder().setColor(muted ? '#FF9900' : '#00FF99')
        .setTitle(muted ? '🔇 Server Muted' : '🔊 Server Unmuted')
        .setDescription(`**${member.user.tag}** was server ${muted ? 'muted' : 'unmuted'} in **${newChannel.name}**`)
        .setTimestamp());
    }

    // ────────────────────────────────────────────────────────────────────────
    // DEAFEN/UNDEAFEN (server deaf)
    // ────────────────────────────────────────────────────────────────────────
    if (oldState.serverDeaf !== newState.serverDeaf && newChannel) {
      const deafened = newState.serverDeaf;
      await voiceLog(guild, new EmbedBuilder().setColor(deafened ? '#FF9900' : '#00FF99')
        .setTitle(deafened ? '🔕 Server Deafened' : '🔔 Server Undeafened')
        .setDescription(`**${member.user.tag}** was server ${deafened ? 'deafened' : 'undeafened'} in **${newChannel.name}**`)
        .setTimestamp());
    }

  } catch (e) {
    console.error('[SORA][VoiceStateUpdate] Unhandled error:', e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL UPDATE/DELETE EVENTS — LOGS
// ─────────────────────────────────────────────────────────────────────────────
client.on('channelUpdate', async (oldCh, newCh) => {
  try {
    if (oldCh.type !== ChannelType.GuildVoice) return;
    const guild = newCh.guild;
    const color = getGuild(guild.id).color || DEFAULT_COLOR;

    // Name change
    if (oldCh.name !== newCh.name) {
      await voiceLog(guild, new EmbedBuilder().setColor(color)
        .setTitle('✏️ Channel Renamed')
        .setDescription(`**${oldCh.name}** → **${newCh.name}**`)
        .setTimestamp());
    }

    // User limit change
    if (oldCh.userLimit !== newCh.userLimit) {
      await voiceLog(guild, new EmbedBuilder().setColor(color)
        .setTitle('👥 User Limit Changed')
        .setDescription(`**${newCh.name}**: ${oldCh.userLimit || '∞'} → ${newCh.userLimit || '∞'}`)
        .setTimestamp());
    }

    // Bitrate change
    if (oldCh.bitrate !== newCh.bitrate) {
      await voiceLog(guild, new EmbedBuilder().setColor(color)
        .setTitle('📡 Bitrate Changed')
        .setDescription(`**${newCh.name}**: ${Math.floor(oldCh.bitrate / 1000)}kbps → ${Math.floor(newCh.bitrate / 1000)}kbps`)
        .setTimestamp());
    }
  } catch { /* ignore */ }
});

client.on('channelCreate', async (channel) => {
  try {
    if (channel.type !== ChannelType.GuildVoice) return;
    const color = getGuild(channel.guild.id).color || DEFAULT_COLOR;
    await voiceLog(channel.guild, new EmbedBuilder().setColor(color)
      .setTitle('🆕 Voice Channel Created')
      .setDescription(`**${channel.name}** (\`${channel.id}\`)`)
      .setTimestamp());
  } catch { /* ignore */ }
});

client.on('channelDelete', async (channel) => {
  try {
    if (channel.type !== ChannelType.GuildVoice) return;
    // Clean up temp channel registry
    if (db.tempChannels[channel.id]) {
      delete db.tempChannels[channel.id];
      saveData();
    }
    const color = getGuild(channel.guild.id).color || DEFAULT_COLOR;
    await voiceLog(channel.guild, new EmbedBuilder().setColor('#FF4444')
      .setTitle('🗑️ Voice Channel Deleted')
      .setDescription(`**${channel.name}** (\`${channel.id}\`)`)
      .setTimestamp());
  } catch { /* ignore */ }
});

// ─────────────────────────────────────────────────────────────────────────────
// READY EVENT
// ─────────────────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║   ${BOT_NAME} v${VERSION} — ONLINE              ║`);
  console.log(`║   Logged in as: ${client.user.tag.padEnd(28)}║`);
  console.log(`║   Guilds: ${String(client.guilds.cache.size).padEnd(35)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  client.user.setPresence({
    //activities: [{ name: `voice channels | =help`, type: ActivityType.Watching }],
    status: 'online',
  });

  // Start periodic auto-save
  setInterval(() => {
    saveData();
    console.log(`[SORA] 💾 Auto-saved data.json`);
  }, SAVE_INTERVAL_MS);

  // Periodic cleanup: remove stale temp channels from registry
  setInterval(async () => {
    let changed = false;
    for (const [chId, tc] of Object.entries(db.tempChannels)) {
      try {
        const guild = client.guilds.cache.get(tc.guildId);
        if (!guild) { delete db.tempChannels[chId]; changed = true; continue; }
        const ch = guild.channels.cache.get(chId);
        if (!ch) { delete db.tempChannels[chId]; changed = true; continue; }
        const av = getAutoVoice(tc.guildId);
        if (av.autoCleanup && ch.members.size === 0) {
          await ch.delete('SORA: Auto-cleanup empty temp channel');
          delete db.tempChannels[chId];
          changed = true;
        }
      } catch { delete db.tempChannels[chId]; changed = true; }
    }
    if (changed) saveData();
  }, 60_000); // every 60s
});

// ─────────────────────────────────────────────────────────────────────────────
// GUILD JOIN — Initialize config
// ─────────────────────────────────────────────────────────────────────────────
client.on('guildCreate', (guild) => {
  getGuild(guild.id);
  saveData();
  console.log(`[SORA] ➕ Joined guild: ${guild.name} (${guild.id})`);
});

client.on('guildDelete', (guild) => {
  console.log(`[SORA] ➖ Left guild: ${guild.name} (${guild.id})`);
});

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-CRASH HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[SORA][CRASH] Uncaught Exception:', err);
  saveData(); // Save before anything bad happens
});

process.on('unhandledRejection', (reason) => {
  console.error('[SORA][CRASH] Unhandled Rejection:', reason);
});

process.on('SIGINT', () => {
  console.log('\n[SORA] 🛑 Shutting down gracefully...');
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[SORA] 🛑 SIGTERM received. Saving & exiting...');
  saveData();
  process.exit(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
loadData();

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!TOKEN) {
  console.error('[SORA] ❌ FATAL: No Discord token found!');
  console.error('[SORA] Set the DISCORD_TOKEN environment variable:');
  console.error('[SORA]   export DISCORD_TOKEN=your_bot_token_here');
  console.error('[SORA]   node bot.cjs');
  process.exit(1);
}

client.login(TOKEN).catch((err) => {
  console.error('[SORA] ❌ Failed to login:', err.message);
  process.exit(1);
});
