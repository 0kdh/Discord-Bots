require('dotenv').config();
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        🎉 GIVEAWAY BOT — Ultra Complet                      ║
 * ║                          discord.js v14 | Node.js 18+                       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Structure :
 *  - Section 1  : Imports & Initialisation
 *  - Section 2  : Utilitaires (temps, couleurs, embeds, logs, sauvegarde)
 *  - Section 3  : Gestionnaire de Giveaways (CRUD, timer, tirage)
 *  - Section 4  : Système de Requirements
 *  - Section 5  : Système de Templates
 *  - Section 6  : Système de Blacklist
 *  - Section 7  : Système de Stats
 *  - Section 8  : Commandes — Giveaway
 *  - Section 9  : Commandes — Configuration
 *  - Section 10 : Commandes — Templates
 *  - Section 11 : Commandes — Blacklist
 *  - Section 12 : Commandes — Stats & Aide
 *  - Section 13 : Gestionnaire d'interactions (boutons)
 *  - Section 14 : Événements Discord
 *  - Section 15 : Démarrage du bot
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — IMPORTS & INITIALISATION
// ═══════════════════════════════════════════════════════════════════════════════

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
  Colors,
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const ms = require("ms");

const DATA_PATH = path.join(__dirname, "data.json");

// ─── Chargement des données ───────────────────────────────────────────────────
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[ERREUR] Impossible de charger data.json :", e.message);
    process.exit(1);
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("[ERREUR] Impossible de sauvegarder data.json :", e.message);
  }
}

let DATA = loadData();

// ─── Client Discord ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
});

// ─── Cooldowns ────────────────────────────────────────────────────────────────
const cooldowns = new Collection();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Formatage du temps ───────────────────────────────────────────────────────

/**
 * Convertit une chaîne de temps (1d, 2h, 30m, 10s, 1w) en millisecondes
 */
function parseDuration(str) {
  if (!str) return null;
  str = str.toLowerCase().trim();
  const weeks = str.match(/^(\d+)w$/);
  if (weeks) return parseInt(weeks[1]) * 7 * 24 * 60 * 60 * 1000;
  const parsed = ms(str);
  if (!parsed || isNaN(parsed)) return null;
  return parsed;
}

/**
 * Formate des millisecondes en chaîne lisible (ex: 2j 3h 15m 40s)
 */
function formatDuration(ms_val) {
  if (!ms_val || ms_val <= 0) return "0s";
  const seconds = Math.floor((ms_val / 1000) % 60);
  const minutes = Math.floor((ms_val / (1000 * 60)) % 60);
  const hours = Math.floor((ms_val / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms_val / (1000 * 60 * 60 * 24));
  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ") || "0s";
}

/**
 * Formate des millisecondes en "Xm Ys" (format photo référence)
 */
function formatTimeLeft(ms_val) {
  if (!ms_val || ms_val <= 0) return "Terminé";
  const totalSeconds = Math.floor(ms_val / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}j ${hours}h ${minutes}m ${seconds}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Retourne un timestamp Discord formaté
 */
function discordTimestamp(date, style = "R") {
  const unix = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

/**
 * Retourne une date formatée pour l'affichage (comme sur la photo)
 */
function formatEndDate(date) {
  const d = new Date(date);
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const dayName = days[d.getDay()];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${discordTimestamp(date, "R")} (${dayName} ${day} ${month} ${year} ${hours}:${mins})`;
}

// ─── Validation couleur hex ───────────────────────────────────────────────────
function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function resolveColor(hex) {
  if (!hex || !isValidHex(hex)) return DATA.config.defaultColor || "#5865F2";
  return hex;
}

// ─── Génération d'ID unique ───────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// ─── Sélection aléatoire de gagnants ─────────────────────────────────────────
function pickWinners(participants, count) {
  if (!participants || participants.length === 0) return [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ─── Vérification des permissions ────────────────────────────────────────────
function isManager(member, guildId) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const managers = DATA.config.managers || [];
  if (managers.includes(member.id)) return true;
  if (member.roles && member.roles.cache) {
    for (const roleId of managers) {
      if (member.roles.cache.has(roleId)) return true;
    }
  }
  return false;
}

// ─── Logger console ───────────────────────────────────────────────────────────
const LOG_LEVELS = { INFO: "ℹ️", SUCCESS: "✅", WARN: "⚠️", ERROR: "❌", GIVEAWAY: "🎉" };

function log(level, message) {
  const ts = new Date().toLocaleTimeString("fr-FR", { hour12: false });
  const icon = LOG_LEVELS[level] || "•";
  console.log(`[${ts}] ${icon}  ${message}`);
}

// ─── Log Discord ──────────────────────────────────────────────────────────────
async function sendLog(embed) {
  const logChannelId = DATA.config.logChannel;
  if (!logChannelId) return;
  try {
    const ch = await client.channels.fetch(logChannelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      await ch.send({ embeds: [embed] });
    }
  } catch (_) {}
}

// ─── Embed de log ─────────────────────────────────────────────────────────────
function buildLogEmbed(action, giveaway, extra = {}) {
  const colors = {
    CREATE: "#57F287",
    END: "#ED4245",
    REROLL: "#FEE75C",
    PAUSE: "#FFA500",
    RESUME: "#57F287",
    DELETE: "#ED4245",
    EDIT: "#5865F2",
  };
  return new EmbedBuilder()
    .setTitle(`📋 Log — ${action}`)
    .setColor(colors[action] || "#5865F2")
    .addFields(
      { name: "Prix", value: giveaway.prize || "?", inline: true },
      { name: "Salon", value: `<#${giveaway.channelId}>`, inline: true },
      { name: "MessageID", value: giveaway.messageId || "?", inline: true },
      ...(extra.field ? [{ name: extra.field, value: extra.value || "?", inline: true }] : [])
    )
    .setTimestamp()
    .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" });
}

// ─── Réponse d'erreur ─────────────────────────────────────────────────────────
async function replyError(message, text) {
  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#ED4245")
        .setDescription(`❌ ${text}`)
    ],
  }).catch(() => {});
}

// ─── Réponse de succès ────────────────────────────────────────────────────────
async function replySuccess(message, text) {
  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#57F287")
        .setDescription(`✅ ${text}`)
    ],
  }).catch(() => {});
}

// ─── Réponse info ─────────────────────────────────────────────────────────────
async function replyInfo(message, title, desc, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(DATA.config.defaultColor || "#7B1FA2")
    .setTitle(title)
    .setDescription(desc)
    .setTimestamp()
    .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" });
  if (fields.length > 0) embed.addFields(fields);
  return message.reply({ embeds: [embed] }).catch(() => {});
}

// ─── Cooldown check ───────────────────────────────────────────────────────────
function checkCooldown(userId, command, seconds = 3) {
  const key = `${userId}-${command}`;
  if (cooldowns.has(key)) {
    const exp = cooldowns.get(key);
    if (Date.now() < exp) return Math.ceil((exp - Date.now()) / 1000);
  }
  cooldowns.set(key, Date.now() + seconds * 1000);
  setTimeout(() => cooldowns.delete(key), seconds * 1000);
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — GESTIONNAIRE DE GIVEAWAYS
// ═══════════════════════════════════════════════════════════════════════════════

const giveawayTimers = new Map();

// ─── Construire l'embed principal du giveaway ─────────────────────────────────
function buildGiveawayEmbed(giveaway) {
  DATA = loadData();
  const cfg = DATA.config;
  const tpl = giveaway.embedTemplate || cfg.embedTemplate || {};

  const now = Date.now();
  const endsAt = giveaway.endsAt;
  const timeLeft = endsAt - now;
  const isEnded = giveaway.ended || timeLeft <= 0;
  const isPaused = giveaway.paused;

  const color = isPaused
    ? "#FFA500"
    : isEnded
    ? (tpl.endedColor || "#2F3136")
    : resolveColor(tpl.color || cfg.defaultColor);

  const title = isEnded
    ? (tpl.endedTitle || `${giveaway.prize} — Terminé`).replace("{prize}", giveaway.prize)
    : (tpl.title || "{prize}").replace("{prize}", giveaway.prize);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setFooter({
      text: tpl.footerText || cfg.defaultFooter || "🎉 SORA",
    });

  // Thumbnail
  if (tpl.thumbnailEnabled && (giveaway.thumbnail || cfg.defaultThumbnail)) {
    embed.setThumbnail(giveaway.thumbnail || cfg.defaultThumbnail);
  }

  // Banner / Image
  if (tpl.bannerEnabled && (giveaway.banner || cfg.defaultBanner)) {
    embed.setImage(giveaway.banner || cfg.defaultBanner);
  }

  const lines = [];

  // Statut pause
  if (isPaused) {
    lines.push("⏸️ **Ce giveaway est en pause.**\n");
  }

  // Last chance
  if (!isEnded && !isPaused && tpl.lastChanceEnabled && timeLeft <= (tpl.lastChanceThreshold || 60) * 1000) {
    lines.push(`${tpl.lastChanceMessage || "⚠️ Dernière chance de participer !"}\n`);
    embed.setColor(tpl.lastChanceColor || "#FF0000");
  }

  // Time Left
  if (!isEnded && tpl.showTimeLeft !== false) {
    lines.push(`**Time left:** ${formatTimeLeft(timeLeft)}`);
  }

  // Ends at
  if (tpl.showEndsAt !== false) {
    lines.push(`**Ends:** ${formatEndDate(endsAt)}`);
  }

  // Hosted by
  if (tpl.showHostedBy !== false && giveaway.hostedBy) {
    lines.push(`**Hosted by:** <@${giveaway.hostedBy}>`);
  }

  // Entries
  if (tpl.showEntries !== false) {
    const count = giveaway.participants ? giveaway.participants.length : 0;
    lines.push(`**Entries:** ${count}`);
  }

  // Winners
  if (tpl.showWinners !== false) {
    lines.push(`**Winners:** ${giveaway.winnerCount}`);
  }

  // Requirements
  if (tpl.showRequirements !== false && giveaway.requirements) {
    const reqs = buildRequirementsText(giveaway.requirements);
    if (reqs) lines.push(`\n**Requirements:**\n${reqs}`);
  }

  // Custom description
  if (giveaway.description) {
    lines.push(`\n${giveaway.description}`);
  }

  // Gagnants (si terminé)
  if (isEnded && giveaway.winners && giveaway.winners.length > 0) {
    const winnerMentions = giveaway.winners.map((id) => `<@${id}>`).join(", ");
    lines.push(`\n🏆 **Gagnant(s):** ${winnerMentions}`);
  } else if (isEnded && (!giveaway.winners || giveaway.winners.length === 0)) {
    lines.push(`\n😔 **Aucun gagnant** — personne n'a participé.`);
  }

  embed.setDescription(lines.join("\n") || "\u200b");
  embed.setTimestamp(new Date(endsAt));

  return embed;
}

/**
 * Construit le texte des requirements
 */
function buildRequirementsText(req) {
  if (!req) return "";
  const lines = [];
  if (req.requiredRoles && req.requiredRoles.length > 0) {
    lines.push(`• Rôles requis : ${req.requiredRoles.map((r) => `<@&${r}>`).join(", ")}`);
  }
  if (req.blacklistedRoles && req.blacklistedRoles.length > 0) {
    lines.push(`• Rôles interdits : ${req.blacklistedRoles.map((r) => `<@&${r}>`).join(", ")}`);
  }
  if (req.minAccountAge && req.minAccountAge > 0) {
    lines.push(`• Compte Discord ≥ ${req.minAccountAge} jour(s)`);
  }
  if (req.minServerAge && req.minServerAge > 0) {
    lines.push(`• Sur le serveur ≥ ${req.minServerAge} jour(s)`);
  }
  if (req.requiredInvites && req.requiredInvites > 0) {
    lines.push(`• Invitations ≥ ${req.requiredInvites}`);
  }
  return lines.join("\n");
}

/**
 * Construit le bouton de participation
 */
function buildGiveawayButton(giveaway) {
  DATA = loadData();
  const cfg = DATA.config;
  const tpl = giveaway.embedTemplate || cfg.embedTemplate || {};
  const label = tpl.buttonLabel || "🎉 Participer";
  const styleName = tpl.buttonStyle || "Primary";
  const styleMap = {
    Primary: ButtonStyle.Primary,
    Secondary: ButtonStyle.Secondary,
    Success: ButtonStyle.Success,
    Danger: ButtonStyle.Danger,
  };
  const style = styleMap[styleName] || ButtonStyle.Primary;
  const isEnded = giveaway.ended;

  const btn = new ButtonBuilder()
    .setCustomId(`giveaway_participate_${giveaway.messageId}`)
    .setLabel(isEnded ? "🎉 Terminé" : label)
    .setStyle(isEnded ? ButtonStyle.Secondary : style)
    .setDisabled(!!isEnded || !!giveaway.paused);

  return new ActionRowBuilder().addComponents(btn);
}

// ─── Créer un giveaway ────────────────────────────────────────────────────────
async function createGiveaway(options) {
  const {
    guild,
    channel,
    prize,
    duration,
    winnerCount,
    hostedBy,
    requirements,
    description,
    thumbnail,
    banner,
    embedTemplate,
    bonusEntries,
  } = options;

  DATA = loadData();
  const cfg = DATA.config;

  // Validation durée
  if (duration < cfg.minDuration) throw new Error(`Durée minimum : ${formatDuration(cfg.minDuration)}`);
  if (duration > cfg.maxDuration) throw new Error(`Durée maximum : ${formatDuration(cfg.maxDuration)}`);
  if (winnerCount < 1) throw new Error("Le nombre de gagnants doit être ≥ 1.");
  if (winnerCount > cfg.maxWinners) throw new Error(`Nombre de gagnants maximum : ${cfg.maxWinners}`);

  // Vérification giveaways actifs dans le salon
  const activeInChannel = DATA.giveaways.filter(
    (g) => g.channelId === channel.id && g.guildId === guild.id && !g.ended && !g.deleted
  );
  if (activeInChannel.length >= (cfg.maxGiveawaysPerChannel || 5)) {
    throw new Error(`Nombre maximum de giveaways actifs dans ce salon atteint (${cfg.maxGiveawaysPerChannel || 5}).`);
  }

  const endsAt = Date.now() + duration;
  const tplToUse = embedTemplate ? { ...cfg.embedTemplate, ...embedTemplate } : { ...cfg.embedTemplate };

  const giveawayData = {
    id: generateId(),
    guildId: guild.id,
    channelId: channel.id,
    messageId: null,
    prize,
    winnerCount,
    hostedBy: hostedBy ? hostedBy.id : null,
    endsAt,
    startedAt: Date.now(),
    participants: [],
    winners: [],
    ended: false,
    paused: false,
    deleted: false,
    requirements: requirements || null,
    description: description || null,
    thumbnail: thumbnail || null,
    banner: banner || null,
    embedTemplate: tplToUse,
    bonusEntries: bonusEntries || [],
  };


// Construire l'embed
const embed = buildGiveawayEmbed(giveawayData);

// Envoyer d'abord le message sans bouton
const msg = await channel.send({
  embeds: [embed],
});

// Maintenant on connaît le vrai messageId
giveawayData.messageId = msg.id;

// Construire le bouton avec le bon messageId
const row = buildGiveawayButton(giveawayData);

// Ajouter le bouton au message
await msg.edit({
  embeds: [embed],
  components: [row],
});

  console.log("MESSAGE ID SAUVEGARDE =", giveawayData.messageId);

  // Sauvegarder
  DATA.giveaways.push(giveawayData);
  DATA.stats.totalGiveaways = (DATA.stats.totalGiveaways || 0) + 1;
  if (!DATA.stats.giveawaysByGuild) DATA.stats.giveawaysByGuild = {};
  DATA.stats.giveawaysByGuild[guild.id] = (DATA.stats.giveawaysByGuild[guild.id] || 0) + 1;
  saveData(DATA);

  // Démarrer le timer
  scheduleGiveaway(giveawayData);

  log("GIVEAWAY", `Giveaway créé : "${prize}" dans #${channel.name} (${guild.name}) — ${formatDuration(duration)} — ${winnerCount} gagnant(s)`);

  // Log Discord
  await sendLog(buildLogEmbed("CREATE", giveawayData, {
    field: "Durée",
    value: formatDuration(duration),
  }));

  return giveawayData;
}

// ─── Mettre à jour l'embed du giveaway ───────────────────────────────────────
async function updateGiveawayMessage(giveaway) {
  try {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;
    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!message) return;

    const embed = buildGiveawayEmbed(giveaway);
    const row = buildGiveawayButton(giveaway);

    await message.edit({
      embeds: [embed],
      components: [row],
    }).catch(() => {});
  } catch (e) {
    // Silencieux
  }
}

// ─── Planifier la fin d'un giveaway ──────────────────────────────────────────
function scheduleGiveaway(giveaway) {
  if (giveawayTimers.has(giveaway.messageId)) {
    clearTimeout(giveawayTimers.get(giveaway.messageId).timeout);
    clearInterval(giveawayTimers.get(giveaway.messageId).interval);
    giveawayTimers.delete(giveaway.messageId);
  }

  if (giveaway.ended || giveaway.deleted || giveaway.paused) return;

  const now = Date.now();
  const timeLeft = giveaway.endsAt - now;
  if (timeLeft <= 0) {
    endGiveaway(giveaway.messageId);
    return;
  }

  // Timer de fin
  const timeout = setTimeout(() => {
    endGiveaway(giveaway.messageId);
  }, timeLeft);

  // Interval de mise à jour de l'embed (toutes les 30 secondes ou toutes les 5s si < 1min)
  const updateInterval = timeLeft < 60000 ? 5000 : 30000;
  const interval = setInterval(async () => {
    DATA = loadData();
    const g = DATA.giveaways.find((x) => x.messageId === giveaway.messageId);
    if (!g || g.ended || g.deleted || g.paused) {
      clearInterval(interval);
      return;
    }
    await updateGiveawayMessage(g);
  }, updateInterval);

  giveawayTimers.set(giveaway.messageId, { timeout, interval });
}

// ─── Terminer un giveaway ─────────────────────────────────────────────────────
async function endGiveaway(messageId, force = false) {
  DATA = loadData();
  const idx = DATA.giveaways.findIndex((g) => g.messageId === messageId);
  if (idx === -1) return null;
  const giveaway = DATA.giveaways[idx];

  if (giveaway.ended && !force) return giveaway;
  if (giveaway.deleted) return null;

  // Annuler les timers
  if (giveawayTimers.has(messageId)) {
    clearTimeout(giveawayTimers.get(messageId).timeout);
    clearInterval(giveawayTimers.get(messageId).interval);
    giveawayTimers.delete(messageId);
  }

  // Filtrer les participants blacklistés
  const blacklist = DATA.blacklist || [];
  const validParticipants = (giveaway.participants || []).filter(
    (id) => !blacklist.includes(id)
  );

  // Tirage au sort avec bonus entries
  const weightedParticipants = [];
  for (const userId of validParticipants) {
    const bonus = giveaway.bonusEntries ? giveaway.bonusEntries.find((b) => b.userId === userId) : null;
    const entries = bonus ? 1 + (bonus.entries || 0) : 1;
    for (let i = 0; i < entries; i++) {
      weightedParticipants.push(userId);
    }
  }

  const winners = pickWinners([...new Set(weightedParticipants)], giveaway.winnerCount);
  const uniqueWinners = [...new Set(winners)];

  giveaway.ended = true;
  giveaway.winners = uniqueWinners;
  DATA.giveaways[idx] = giveaway;

  // Stats
  DATA.stats.totalWinners = (DATA.stats.totalWinners || 0) + uniqueWinners.length;
  DATA.stats.totalEntries = (DATA.stats.totalEntries || 0) + validParticipants.length;

  saveData(DATA);

  // Mettre à jour l'embed
  await updateGiveawayMessage(giveaway);

  // Récupérer le salon
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);

  // Annonce des gagnants
  if (channel && DATA.config.winAnnouncement !== false) {
    if (uniqueWinners.length > 0) {
      const winnerMentions = uniqueWinners.map((id) => `<@${id}>`).join(", ");
      const annMsg = (DATA.config.winAnnouncementMessage || "🎉 Félicitations {winners} ! Vous avez gagné **{prize}** !")
        .replace("{winners}", winnerMentions)
        .replace("{prize}", giveaway.prize)
        .replace("{messageURL}", `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`);

      await channel.send({
        content: winnerMentions,
        embeds: [
          new EmbedBuilder()
            .setColor("#57F287")
            .setTitle("🎉 Giveaway Terminé !")
            .setDescription(annMsg)
            .addFields(
              { name: "Prix", value: giveaway.prize, inline: true },
              { name: "Participants", value: `${validParticipants.length}`, inline: true },
              { name: "Gagnant(s)", value: winnerMentions, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" })
        ],
      }).catch(() => {});
    } else {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setTitle("🎉 Giveaway Terminé")
            .setDescription(DATA.config.noWinnerMessage || "Personne n'a participé au giveaway. Pas de gagnant.")
            .setTimestamp()
            .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" })
        ],
      }).catch(() => {});
    }
  }

// ─── DM aux gagnants ───────────────────────────────────────────────
if (DATA.config.dmWinners && uniqueWinners.length > 0) {
  for (const winnerId of uniqueWinners) {
    try {
      const user = await client.users.fetch(winnerId).catch(() => null);
      if (!user) continue;

      const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
      const host = await client.users.fetch(giveaway.hostedBy).catch(() => null);

      const channelLink = `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}`;

      const dmMsg =
        `🎉 **Félicitations ${user.username} !**\n\n` +
        `🏆 Tu as gagné **${giveaway.prize}** sur **${guild ? guild.name : "le serveur"}** !\n\n` +
        `📩 Pour récupérer ta récompense, contacte directement <@${giveaway.hostedBy}>.\n` +
        `💬 Clique ici pour voir le salon : ${channelLink}`;

      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#57F287")
            .setTitle("🎉 Giveaway gagné !")
            .setDescription(dmMsg)
            .setFooter({ text: "Bravo à toi !" })
            .setTimestamp()
        ],
      }).catch(() => {});

    } catch (err) {
      console.error(`Impossible d'envoyer le DM à ${winnerId}:`, err);
    }
  }
}

  log("GIVEAWAY", `Giveaway terminé : "${giveaway.prize}" — ${uniqueWinners.length} gagnant(s) sur ${validParticipants.length} participant(s)`);
  await sendLog(buildLogEmbed("END", giveaway, { field: "Gagnants", value: uniqueWinners.length > 0 ? uniqueWinners.map((id) => `<@${id}>`).join(", ") : "Aucun" }));

  // Auto-delete
  if (DATA.config.autoDelete && DATA.config.autoDelete.enabled) {
    setTimeout(async () => {
      try {
        const ch = await client.channels.fetch(giveaway.channelId).catch(() => null);
        if (!ch) return;
        const msg = await ch.messages.fetch(giveaway.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      } catch (_) {}
    }, DATA.config.autoDelete.delay || 86400000);
  }

  return giveaway;
}

// ─── Reroll d'un giveaway ─────────────────────────────────────────────────────
async function rerollGiveaway(messageId, newWinnerCount = null) {
  DATA = loadData();
  const giveaway = DATA.giveaways.find((g) => g.messageId === messageId);
  if (!giveaway) return null;
  if (!giveaway.ended) return { error: "Le giveaway n'est pas encore terminé." };

  const blacklist = DATA.blacklist || [];
  const validParticipants = (giveaway.participants || []).filter(
    (id) => !blacklist.includes(id) && !(giveaway.winners || []).includes(id)
  );

  const count = newWinnerCount || giveaway.winnerCount;
  const newWinners = pickWinners(validParticipants, count);

  if (newWinners.length === 0) {
    return { error: "Plus aucun participant disponible pour le reroll." };
  }

  const idx = DATA.giveaways.findIndex((g) => g.messageId === messageId);
  DATA.giveaways[idx].winners = [...(DATA.giveaways[idx].winners || []), ...newWinners];
  saveData(DATA);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel) {
    const winnerMentions = newWinners.map((id) => `<@${id}>`).join(", ");
    const msg = (DATA.config.rerollMessage || "🎉 Nouveau gagnant du reroll : {winners} ! Vous avez gagné **{prize}** !")
      .replace("{winners}", winnerMentions)
      .replace("{prize}", giveaway.prize);

    await channel.send({
      content: winnerMentions,
      embeds: [
        new EmbedBuilder()
          .setColor("#FEE75C")
          .setTitle("🔄 Reroll !")
          .setDescription(msg)
          .setTimestamp()
          .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" })
      ],
    }).catch(() => {});
  }

  log("GIVEAWAY", `Reroll giveaway "${giveaway.prize}" — ${newWinners.length} nouveau(x) gagnant(s)`);
  await sendLog(buildLogEmbed("REROLL", giveaway, { field: "Nouveaux gagnants", value: newWinners.map((id) => `<@${id}>`).join(", ") }));

  // DM reroll winners
  if (DATA.config.dmWinners) {
    for (const winnerId of newWinners) {
      try {
        const user = await client.users.fetch(winnerId).catch(() => null);
        if (!user) continue;
        const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#FEE75C")
              .setTitle("🔄 Tu as gagné un reroll !")
              .setDescription(`🎉 Félicitations ! Tu as été retiré gagnant du giveaway **${giveaway.prize}** dans **${guild ? guild.name : "le serveur"}** !\n🔗 https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`)
              .setTimestamp()
          ],
        }).catch(() => {});
      } catch (_) {}
    }
  }

  return { winners: newWinners, giveaway };
}

// ─── Mettre en pause ──────────────────────────────────────────────────────────
async function pauseGiveaway(messageId) {
  DATA = loadData();
  const idx = DATA.giveaways.findIndex((g) => g.messageId === messageId);
  if (idx === -1) return null;
  const giveaway = DATA.giveaways[idx];
  if (giveaway.ended) return { error: "Ce giveaway est déjà terminé." };
  if (giveaway.paused) return { error: "Ce giveaway est déjà en pause." };

  // Sauvegarder le temps restant
  DATA.giveaways[idx].paused = true;
  DATA.giveaways[idx].pausedAt = Date.now();
  DATA.giveaways[idx].timeLeftAtPause = giveaway.endsAt - Date.now();
  saveData(DATA);

  // Annuler le timer
  if (giveawayTimers.has(messageId)) {
    clearTimeout(giveawayTimers.get(messageId).timeout);
    clearInterval(giveawayTimers.get(messageId).interval);
    giveawayTimers.delete(messageId);
  }

  await updateGiveawayMessage(DATA.giveaways[idx]);
  log("GIVEAWAY", `Giveaway mis en pause : "${giveaway.prize}"`);
  await sendLog(buildLogEmbed("PAUSE", giveaway));

  return DATA.giveaways[idx];
}

// ─── Reprendre un giveaway ────────────────────────────────────────────────────
async function resumeGiveaway(messageId) {
  DATA = loadData();
  const idx = DATA.giveaways.findIndex((g) => g.messageId === messageId);
  if (idx === -1) return null;
  const giveaway = DATA.giveaways[idx];
  if (giveaway.ended) return { error: "Ce giveaway est déjà terminé." };
  if (!giveaway.paused) return { error: "Ce giveaway n'est pas en pause." };

  const newEndsAt = Date.now() + (giveaway.timeLeftAtPause || 60000);
  DATA.giveaways[idx].paused = false;
  DATA.giveaways[idx].pausedAt = null;
  DATA.giveaways[idx].timeLeftAtPause = null;
  DATA.giveaways[idx].endsAt = newEndsAt;
  saveData(DATA);

  await updateGiveawayMessage(DATA.giveaways[idx]);
  scheduleGiveaway(DATA.giveaways[idx]);

  log("GIVEAWAY", `Giveaway repris : "${giveaway.prize}"`);
  await sendLog(buildLogEmbed("RESUME", giveaway));

  return DATA.giveaways[idx];
}

// ─── Supprimer un giveaway ────────────────────────────────────────────────────
async function deleteGiveaway(messageId) {
  DATA = loadData();
  const idx = DATA.giveaways.findIndex((g) => g.messageId === messageId);
  if (idx === -1) return null;
  const giveaway = DATA.giveaways[idx];

  // Annuler les timers
  if (giveawayTimers.has(messageId)) {
    clearTimeout(giveawayTimers.get(messageId).timeout);
    clearInterval(giveawayTimers.get(messageId).interval);
    giveawayTimers.delete(messageId);
  }

  DATA.giveaways[idx].deleted = true;
  DATA.giveaways[idx].ended = true;
  saveData(DATA);

  // Supprimer le message Discord
  try {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) await msg.delete().catch(() => {});
    }
  } catch (_) {}

  log("GIVEAWAY", `Giveaway supprimé : "${giveaway.prize}"`);
  await sendLog(buildLogEmbed("DELETE", giveaway));

  return giveaway;
}

// ─── Modifier un giveaway ─────────────────────────────────────────────────────
async function editGiveaway(messageId, field, value) {
  DATA = loadData();
  const idx = DATA.giveaways.findIndex((g) => g.messageId === messageId);
  if (idx === -1) return { error: "Giveaway introuvable." };
  const giveaway = DATA.giveaways[idx];
  if (giveaway.ended) return { error: "Impossible de modifier un giveaway terminé." };
  if (giveaway.deleted) return { error: "Impossible de modifier un giveaway supprimé." };

  const allowedFields = {
    prize: (v) => { DATA.giveaways[idx].prize = v; return `Prix mis à jour : **${v}**`; },
    winners: (v) => {
      const n = parseInt(v);
      if (isNaN(n) || n < 1 || n > (DATA.config.maxWinners || 20)) return null;
      DATA.giveaways[idx].winnerCount = n;
      return `Nombre de gagnants mis à jour : **${n}**`;
    },
    duration: (v) => {
      const d = parseDuration(v);
      if (!d) return null;
      DATA.giveaways[idx].endsAt = Date.now() + d;
      scheduleGiveaway(DATA.giveaways[idx]);
      return `Durée mise à jour. Nouveau fin : ${formatEndDate(DATA.giveaways[idx].endsAt)}`;
    },
    description: (v) => { DATA.giveaways[idx].description = v; return `Description mise à jour.`; },
    color: (v) => {
      if (!isValidHex(v)) return null;
      DATA.giveaways[idx].embedTemplate = { ...(DATA.giveaways[idx].embedTemplate || {}), color: v };
      return `Couleur mise à jour : ${v}`;
    },
  };

  if (!allowedFields[field]) {
    return { error: `Champ inconnu. Champs disponibles : ${Object.keys(allowedFields).join(", ")}` };
  }

  const result = allowedFields[field](value);
  if (!result) return { error: "Valeur invalide pour ce champ." };

  saveData(DATA);
  await updateGiveawayMessage(DATA.giveaways[idx]);

  log("GIVEAWAY", `Giveaway édité : "${giveaway.prize}" — ${field} = ${value}`);
  await sendLog(buildLogEmbed("EDIT", giveaway, { field: "Modification", value: `${field} → ${value}` }));

  return { success: result, giveaway: DATA.giveaways[idx] };
}

// ─── Trouver un giveaway par messageId ───────────────────────────────────────
function findGiveaway(messageId, guildId = null) {
  DATA = loadData();
  return DATA.giveaways.find(
    (g) => g.messageId === messageId && (!guildId || g.guildId === guildId) && !g.deleted
  ) || null;
}

// ─── Giveaways actifs ────────────────────────────────────────────────────────
function getActiveGiveaways(guildId = null, channelId = null) {
  DATA = loadData();
  return DATA.giveaways.filter((g) => {
    if (g.ended || g.deleted) return false;
    if (guildId && g.guildId !== guildId) return false;
    if (channelId && g.channelId !== channelId) return false;
    return true;
  });
}

// ─── Reprendre tous les giveaways au démarrage ───────────────────────────────
async function resumeAllGiveaways() {
  DATA = loadData();
  const active = DATA.giveaways.filter((g) => !g.ended && !g.deleted && !g.paused);
  log("INFO", `Reprise de ${active.length} giveaway(s) actif(s)...`);

  for (const g of active) {
    if (g.endsAt <= Date.now()) {
      await endGiveaway(g.messageId);
    } else {
      scheduleGiveaway(g);
      await updateGiveawayMessage(g);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — SYSTÈME DE REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si un membre peut participer à un giveaway
 * Retourne { allowed: boolean, reason: string }
 */
async function checkRequirements(member, giveaway) {
  const req = giveaway.requirements;
  if (!req) return { allowed: true };

  // Rôles requis
  if (req.requiredRoles && req.requiredRoles.length > 0) {
    const hasRole = req.requiredRoles.some((roleId) => member.roles.cache.has(roleId));
    if (!hasRole) {
      const roleMentions = req.requiredRoles.map((id) => `<@&${id}>`).join(", ");
      return { allowed: false, reason: `Tu dois avoir l'un de ces rôles : ${roleMentions}` };
    }
  }

  // Rôles blacklistés
  if (req.blacklistedRoles && req.blacklistedRoles.length > 0) {
    const hasBlacklistedRole = req.blacklistedRoles.some((roleId) => member.roles.cache.has(roleId));
    if (hasBlacklistedRole) {
      return { allowed: false, reason: "Tu as un rôle qui t'empêche de participer à ce giveaway." };
    }
  }

  // Ancienneté du compte Discord
  if (req.minAccountAge && req.minAccountAge > 0) {
    const accountAge = (Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge < req.minAccountAge) {
      return {
        allowed: false,
        reason: `Ton compte Discord doit avoir au moins **${req.minAccountAge} jour(s)** (actuellement : ${Math.floor(accountAge)} jour(s)).`,
      };
    }
  }

  // Ancienneté dans le serveur
  if (req.minServerAge && req.minServerAge > 0) {
    if (!member.joinedAt) return { allowed: true };
    const serverAge = (Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (serverAge < req.minServerAge) {
      return {
        allowed: false,
        reason: `Tu dois être dans le serveur depuis au moins **${req.minServerAge} jour(s)** (actuellement : ${Math.floor(serverAge)} jour(s)).`,
      };
    }
  }

  return { allowed: true };
}

// ─── Parser les requirements depuis un texte ──────────────────────────────────
function parseRequirements(guild, args) {
  const req = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    if (arg === "--roles" || arg === "-r") {
      const roles = [];
      i++;
      while (i < args.length && !args[i].startsWith("--") && !args[i].startsWith("-")) {
        const roleId = args[i].replace(/[<@&>]/g, "");
        if (guild.roles.cache.has(roleId)) roles.push(roleId);
        i++;
      }
      i--;
      if (roles.length > 0) req.requiredRoles = roles;
    } else if (arg === "--blacklistedroles" || arg === "--br") {
      const roles = [];
      i++;
      while (i < args.length && !args[i].startsWith("--") && !args[i].startsWith("-")) {
        const roleId = args[i].replace(/[<@&>]/g, "");
        if (guild.roles.cache.has(roleId)) roles.push(roleId);
        i++;
      }
      i--;
      if (roles.length > 0) req.blacklistedRoles = roles;
    } else if (arg === "--accountage" || arg === "--aa") {
      i++;
      const days = parseInt(args[i]);
      if (!isNaN(days) && days > 0) req.minAccountAge = days;
    } else if (arg === "--serverage" || arg === "--sa") {
      i++;
      const days = parseInt(args[i]);
      if (!isNaN(days) && days > 0) req.minServerAge = days;
    } else if (arg === "--invites" || arg === "--inv") {
      i++;
      const inv = parseInt(args[i]);
      if (!isNaN(inv) && inv > 0) req.requiredInvites = inv;
    }
  }
  return Object.keys(req).length > 0 ? req : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — SYSTÈME DE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Créer un template en mode interactif (wizard Discord)
 */
async function createTemplateWizard(message) {
  DATA = loadData();
  const cfg = DATA.config;
  const channel = message.channel;
  const author = message.author;
  const guildId = message.guild.id;

  const filter = (m) => m.author.id === author.id;
  const timeout = 60000;

  const ask = async (question) => {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(cfg.defaultColor || "#5865F2")
          .setDescription(`📝 ${question}\n\n*Tapez \`annuler\` pour arrêter.*`)
          .setFooter({ text: "Timeout : 60 secondes" })
      ],
    });
    const collected = await channel.awaitMessages({ filter, max: 1, time: timeout, errors: ["time"] }).catch(() => null);
    if (!collected) return null;
    const response = collected.first().content.trim();
    if (response.toLowerCase() === "annuler") return "CANCEL";
    return response;
  };

  const cancel = async () => {
    await channel.send({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("❌ Création du template annulée.")] });
  };

  // Nom du template
  const name = await ask("Quel est le **nom** du template ?");
  if (!name || name === "CANCEL") return cancel();
  if (DATA.templates && DATA.templates[guildId] && DATA.templates[guildId][name]) {
    return channel.send({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription(`❌ Un template avec ce nom existe déjà : **${name}**`)] });
  }

  // Couleur
  let color = await ask("Quelle **couleur** pour l'embed ? (ex: `#5865F2`) — ou `skip` pour utiliser la couleur par défaut");
  if (!color || color === "CANCEL") return cancel();
  if (color.toLowerCase() === "skip") color = cfg.defaultColor || "#5865F2";
  if (!isValidHex(color)) color = cfg.defaultColor || "#5865F2";

  // Titre
  let title = await ask("Quel **titre** pour l'embed ? Vous pouvez utiliser `{prize}` — ou `skip` pour `{prize}`");
  if (!title || title === "CANCEL") return cancel();
  if (title.toLowerCase() === "skip") title = "{prize}";

  // Footer
  let footer = await ask("Quel **footer** pour l'embed ? — ou `skip` pour le footer par défaut");
  if (!footer || footer === "CANCEL") return cancel();
  if (footer.toLowerCase() === "skip") footer = cfg.defaultFooter || "🎉 SORA";

  // Label bouton
  let buttonLabel = await ask("Quel **label** pour le bouton ? (ex: `🎉 Participer`) — ou `skip` pour le défaut");
  if (!buttonLabel || buttonLabel === "CANCEL") return cancel();
  if (buttonLabel.toLowerCase() === "skip") buttonLabel = cfg.embedTemplate?.buttonLabel || "🎉 Participer";

  // Style bouton
  let buttonStyle = await ask("Quel **style** pour le bouton ? (`Primary`, `Secondary`, `Success`, `Danger`) — ou `skip` pour `Primary`");
  if (!buttonStyle || buttonStyle === "CANCEL") return cancel();
  const validStyles = ["Primary", "Secondary", "Success", "Danger"];
  if (!validStyles.includes(buttonStyle)) buttonStyle = "Primary";

  // Last chance
  let lastChanceEnabled = await ask("Activer le **last chance** ? (`oui` / `non`)");
  if (!lastChanceEnabled || lastChanceEnabled === "CANCEL") return cancel();
  lastChanceEnabled = lastChanceEnabled.toLowerCase() === "oui";

  let lastChanceThreshold = 60;
  let lastChanceMessage = "⚠️ Dernière chance de participer !";
  let lastChanceColor = "#FF0000";

  if (lastChanceEnabled) {
    const thr = await ask("**Seuil** du last chance en secondes ? (ex: `60`) — ou `skip` pour 60s");
    if (!thr || thr === "CANCEL") return cancel();
    if (thr.toLowerCase() !== "skip") {
      const n = parseInt(thr);
      if (!isNaN(n) && n > 0) lastChanceThreshold = n;
    }
    const lcMsg = await ask("**Message** du last chance ? — ou `skip` pour le défaut");
    if (!lcMsg || lcMsg === "CANCEL") return cancel();
    if (lcMsg.toLowerCase() !== "skip") lastChanceMessage = lcMsg;
    const lcColor = await ask("**Couleur** du last chance ? (ex: `#FF0000`) — ou `skip`");
    if (!lcColor || lcColor === "CANCEL") return cancel();
    if (lcColor.toLowerCase() !== "skip" && isValidHex(lcColor)) lastChanceColor = lcColor;
  }

  // Thumbnail
  let thumbnailEnabled = await ask("Afficher une **thumbnail** ? (`oui` / `non`)");
  if (!thumbnailEnabled || thumbnailEnabled === "CANCEL") return cancel();
  thumbnailEnabled = thumbnailEnabled.toLowerCase() === "oui";

  // Banner
  let bannerEnabled = await ask("Afficher une **banner** (image) ? (`oui` / `non`)");
  if (!bannerEnabled || bannerEnabled === "CANCEL") return cancel();
  bannerEnabled = bannerEnabled.toLowerCase() === "oui";

  // Champs à afficher
  const showFields = await ask("Champs à afficher ? (répondez avec les numéros séparés par des espaces)\n`1` Time Left\n`2` Ends At\n`3` Hosted By\n`4` Entries\n`5` Winners\n`6` Requirements\n— ou `skip` pour tous");
  if (!showFields || showFields === "CANCEL") return cancel();
  let showTimeLeft = true, showEndsAt = true, showHostedBy = true, showEntries = true, showWinnersField = true, showRequirements = true;
  if (showFields.toLowerCase() !== "skip") {
    const nums = showFields.split(" ").map(Number);
    showTimeLeft = nums.includes(1);
    showEndsAt = nums.includes(2);
    showHostedBy = nums.includes(3);
    showEntries = nums.includes(4);
    showWinnersField = nums.includes(5);
    showRequirements = nums.includes(6);
  }

  // Sauvegarder le template
  if (!DATA.templates) DATA.templates = {};
  if (!DATA.templates[guildId]) DATA.templates[guildId] = {};

  DATA.templates[guildId][name] = {
    name,
    color,
    title,
    footerText: footer,
    buttonLabel,
    buttonStyle,
    lastChanceEnabled,
    lastChanceThreshold,
    lastChanceMessage,
    lastChanceColor,
    thumbnailEnabled,
    bannerEnabled,
    showTimeLeft,
    showEndsAt,
    showHostedBy,
    showEntries,
    showWinners: showWinnersField,
    showRequirements,
    endedColor: "#2F3136",
    endedTitle: "{prize} — Terminé",
    createdAt: Date.now(),
    createdBy: author.id,
  };

  saveData(DATA);

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Template créé !")
        .setDescription(`Le template **${name}** a été créé avec succès !`)
        .addFields(
          { name: "Couleur", value: color, inline: true },
          { name: "Titre", value: title, inline: true },
          { name: "Bouton", value: `${buttonLabel} (${buttonStyle})`, inline: true },
          { name: "Last Chance", value: lastChanceEnabled ? `✅ (${lastChanceThreshold}s)` : "❌", inline: true },
          { name: "Thumbnail", value: thumbnailEnabled ? "✅" : "❌", inline: true },
          { name: "Banner", value: bannerEnabled ? "✅" : "❌", inline: true }
        )
        .setFooter({ text: `Utilisez: ${cfg.prefix}gtemplate use ${name} <durée> <gagnants> <#salon> <prix>` })
    ],
  });

  log("INFO", `Template créé : "${name}" par ${author.tag} dans ${message.guild.name}`);
}

// ─── Lister les templates ─────────────────────────────────────────────────────
async function listTemplates(message) {
  DATA = loadData();
  const guildId = message.guild.id;
  const templates = DATA.templates && DATA.templates[guildId] ? DATA.templates[guildId] : {};
  const names = Object.keys(templates);

  if (names.length === 0) {
    return replyInfo(message, "📋 Templates", "Aucun template créé.\nUtilisez `!gtemplate create <nom>` pour en créer un.");
  }

  const fields = names.map((n) => {
    const t = templates[n];
    return {
      name: `📌 ${n}`,
      value: `Couleur: ${t.color}\nBouton: ${t.buttonLabel}\nCréé par: <@${t.createdBy || "?"}>`,
      inline: true,
    };
  });

  return replyInfo(message, `📋 Templates (${names.length})`, `Utilisez \`${DATA.config.prefix}gtemplate use <nom> ...\` pour utiliser un template.`, fields);
}

// ─── Informations d'un template ───────────────────────────────────────────────
async function infoTemplate(message, name) {
  DATA = loadData();
  const guildId = message.guild.id;
  const templates = DATA.templates && DATA.templates[guildId] ? DATA.templates[guildId] : {};
  const t = templates[name];

  if (!t) return replyError(message, `Template **${name}** introuvable.`);

  const embed = new EmbedBuilder()
    .setColor(t.color || DATA.config.defaultColor || "#5865F2")
    .setTitle(`📌 Template : ${name}`)
    .addFields(
      { name: "Couleur", value: t.color || "Défaut", inline: true },
      { name: "Titre", value: t.title || "{prize}", inline: true },
      { name: "Footer", value: t.footerText || "Défaut", inline: true },
      { name: "Bouton", value: `${t.buttonLabel || "🎉 Participer"} (${t.buttonStyle || "Primary"})`, inline: true },
      { name: "Last Chance", value: t.lastChanceEnabled ? `✅ ${t.lastChanceThreshold}s` : "❌", inline: true },
      { name: "Thumbnail", value: t.thumbnailEnabled ? "✅" : "❌", inline: true },
      { name: "Banner", value: t.bannerEnabled ? "✅" : "❌", inline: true },
      {
        name: "Champs affichés",
        value: [
          t.showTimeLeft ? "✅ Time Left" : "❌ Time Left",
          t.showEndsAt ? "✅ Ends At" : "❌ Ends At",
          t.showHostedBy ? "✅ Hosted By" : "❌ Hosted By",
          t.showEntries ? "✅ Entries" : "❌ Entries",
          t.showWinners ? "✅ Winners" : "❌ Winners",
          t.showRequirements ? "✅ Requirements" : "❌ Requirements",
        ].join("\n"),
        inline: false,
      }
    )
    .setTimestamp(t.createdAt ? new Date(t.createdAt) : new Date())
    .setFooter({ text: `Créé par ${t.createdBy ? `<@${t.createdBy}>` : "inconnu"}` });

  return message.reply({ embeds: [embed] });
}

// ─── Supprimer un template ────────────────────────────────────────────────────
async function deleteTemplate(message, name) {
  DATA = loadData();
  const guildId = message.guild.id;
  if (!DATA.templates || !DATA.templates[guildId] || !DATA.templates[guildId][name]) {
    return replyError(message, `Template **${name}** introuvable.`);
  }
  delete DATA.templates[guildId][name];
  saveData(DATA);
  return replySuccess(message, `Template **${name}** supprimé avec succès.`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — SYSTÈME DE BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════════

function addToBlacklist(userId) {
  DATA = loadData();
  if (!DATA.blacklist) DATA.blacklist = [];
  if (DATA.blacklist.includes(userId)) return false;
  DATA.blacklist.push(userId);
  saveData(DATA);
  return true;
}

function removeFromBlacklist(userId) {
  DATA = loadData();
  if (!DATA.blacklist) DATA.blacklist = [];
  const idx = DATA.blacklist.indexOf(userId);
  if (idx === -1) return false;
  DATA.blacklist.splice(idx, 1);
  saveData(DATA);
  return true;
}

function isBlacklisted(userId) {
  DATA = loadData();
  return (DATA.blacklist || []).includes(userId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — SYSTÈME DE STATS
// ═══════════════════════════════════════════════════════════════════════════════

function getGlobalStats() {
  DATA = loadData();
  const total = DATA.giveaways.filter((g) => !g.deleted).length;
  const active = DATA.giveaways.filter((g) => !g.ended && !g.deleted).length;
  const ended = DATA.giveaways.filter((g) => g.ended && !g.deleted).length;
  const totalParticipants = DATA.giveaways.reduce((acc, g) => acc + (g.participants ? g.participants.length : 0), 0);
  const totalWinners = DATA.giveaways.reduce((acc, g) => acc + (g.winners ? g.winners.length : 0), 0);
  return {
    total,
    active,
    ended,
    totalParticipants,
    totalWinners,
    blacklistCount: (DATA.blacklist || []).length,
  };
}

function getUserStats(userId) {
  DATA = loadData();
  const participated = DATA.giveaways.filter((g) => (g.participants || []).includes(userId) && !g.deleted);
  const won = DATA.giveaways.filter((g) => (g.winners || []).includes(userId) && !g.deleted);
  const winRate = participated.length > 0 ? ((won.length / participated.length) * 100).toFixed(1) : "0.0";
  return {
    participated: participated.length,
    won: won.length,
    winRate,
    isBlacklisted: isBlacklisted(userId),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — COMMANDES GIVEAWAY
// ═══════════════════════════════════════════════════════════════════════════════

// ─── !gstart ──────────────────────────────────────────────────────────────────
async function cmdGstart(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de lancer des giveaways.");
  }

  // Syntaxe : !gstart <durée> <gagnants> <#salon> <prix> [options...]
  // Options : --description <desc> --roles <@role...> --accountage <jours> --serverage <jours>
  // --color <hex> --thumbnail <url> --banner <url>

  if (args.length < 4) {
    return replyError(
      message,
      `Syntaxe : \`${DATA.config.prefix}gstart <durée> <gagnants> <#salon> <prix>\`\n\n**Options disponibles :**\n\`--description <texte>\` — Description personnalisée\n\`--roles <@role>\` — Rôles requis\n\`--accountage <jours>\` — Ancienneté du compte\n\`--serverage <jours>\` — Ancienneté dans le serveur\n\`--color <hex>\` — Couleur de l'embed\n\`--thumbnail <url>\` — Thumbnail\n\`--banner <url>\` — Banner\n\`--bonus <@user> <entrées>\` — Bonus d'entrées\n\n**Exemple :**\n\`${DATA.config.prefix}gstart 1h 2 #giveaways Nitro Boost --roles @Booster --color #5865F2\``
    );
  }

  const duration = parseDuration(args[0]);
  if (!duration) return replyError(message, "Durée invalide. Exemples : `1d`, `2h`, `30m`, `10s`, `1w`");

  const winnerCount = parseInt(args[1]);
  if (isNaN(winnerCount) || winnerCount < 1) return replyError(message, "Nombre de gagnants invalide (minimum 1).");

  const channelMention = args[2];
  const channelId = channelMention.replace(/[<#>]/g, "");
  const channel = message.guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return replyError(message, "Salon invalide ou non textuel.");

  // Extraire les options
  const prizeArgs = [];
  const optionArgs = [];
  let isOption = false;
  for (let i = 3; i < args.length; i++) {
    if (args[i].startsWith("--") || args[i].startsWith("-")) {
      isOption = true;
    }
    if (!isOption) {
      prizeArgs.push(args[i]);
    } else {
      optionArgs.push(args[i]);
    }
  }

  if (prizeArgs.length === 0) return replyError(message, "Vous devez spécifier un prix.");
  const prize = prizeArgs.join(" ");

  // Parser les options
  let description = null, color = null, thumbnail = null, banner = null;
  const requirements = parseRequirements(message.guild, optionArgs);
  const bonusEntries = [];

  for (let i = 0; i < optionArgs.length; i++) {
    const opt = optionArgs[i].toLowerCase();
    if (opt === "--description" || opt === "--desc" || opt === "-d") {
      i++;
      const descParts = [];
      while (i < optionArgs.length && !optionArgs[i].startsWith("--") && !optionArgs[i].startsWith("-")) {
        descParts.push(optionArgs[i]);
        i++;
      }
      i--;
      description = descParts.join(" ");
    } else if (opt === "--color" || opt === "-c") {
      i++;
      if (optionArgs[i] && isValidHex(optionArgs[i])) color = optionArgs[i];
    } else if (opt === "--thumbnail" || opt === "-t") {
      i++;
      if (optionArgs[i]) thumbnail = optionArgs[i];
    } else if (opt === "--banner" || opt === "-b") {
      i++;
      if (optionArgs[i]) banner = optionArgs[i];
    } else if (opt === "--bonus") {
      i++;
      const userId = optionArgs[i] ? optionArgs[i].replace(/[<@!>]/g, "") : null;
      i++;
      const entries = optionArgs[i] ? parseInt(optionArgs[i]) : null;
      if (userId && entries && !isNaN(entries) && entries > 0) {
        bonusEntries.push({ userId, entries });
      }
    }
  }

  const embedTemplate = color ? { ...DATA.config.embedTemplate, color } : null;
  if (thumbnail) {
    if (!embedTemplate) {
      // Already handled in createGiveaway
    }
  }

  try {
    const giveaway = await createGiveaway({
      guild: message.guild,
      channel,
      prize,
      duration,
      winnerCount,
      hostedBy: message.author,
      requirements,
      description,
      thumbnail,
      banner,
      embedTemplate,
      bonusEntries,
    });

    const confirmEmbed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("🎉 Giveaway Lancé !")
      .setDescription(`Le giveaway **${prize}** a été lancé dans <#${channel.id}> !`)
      .addFields(
        { name: "Durée", value: formatDuration(duration), inline: true },
        { name: "Gagnants", value: `${winnerCount}`, inline: true },
        { name: "Fin", value: formatEndDate(giveaway.endsAt), inline: false },
        { name: "Message ID", value: giveaway.messageId, inline: true }
      )
      .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" });

    if (requirements) {
      const reqText = buildRequirementsText(requirements);
      if (reqText) confirmEmbed.addFields({ name: "Requirements", value: reqText, inline: false });
    }

    await message.reply({ embeds: [confirmEmbed] });
  } catch (e) {
    return replyError(message, e.message);
  }
}

// ─── !gcreate (wizard) ────────────────────────────────────────────────────────
async function cmdGcreate(message) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de créer des giveaways.");
  }

  DATA = loadData();
  const cfg = DATA.config;
  const channel = message.channel;
  const author = message.author;

  const filter = (m) => m.author.id === author.id;
  const timeout = 90000;

  const ask = async (question, optional = false) => {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(cfg.defaultColor || "#5865F2")
          .setDescription(`🧙 **Assistant Giveaway**\n\n${question}${optional ? "\n\n*Tapez `skip` pour ignorer.*" : ""}\n\n*Tapez \`annuler\` pour arrêter.*`)
          .setFooter({ text: "Timeout : 90 secondes" })
      ],
    });
    const collected = await channel.awaitMessages({ filter, max: 1, time: timeout, errors: ["time"] }).catch(() => null);
    if (!collected) return null;
    const response = collected.first().content.trim();
    if (response.toLowerCase() === "annuler") return "CANCEL";
    if (optional && response.toLowerCase() === "skip") return null;
    return response;
  };

  const cancel = async () => {
    await channel.send({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("❌ Création du giveaway annulée.")] });
  };

  // 1. Salon
  const channelAnswer = await ask("Dans quel **salon** lancer le giveaway ? (mentionnez-le avec #)");
  if (!channelAnswer || channelAnswer === "CANCEL") return cancel();
  const channelId = channelAnswer.replace(/[<#>]/g, "");
  const targetChannel = message.guild.channels.cache.get(channelId);
  if (!targetChannel || !targetChannel.isTextBased()) {
    return channel.send({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("❌ Salon invalide.")] });
  }

  // 2. Prix
  const prize = await ask("Quel est le **prix** du giveaway ?");
  if (!prize || prize === "CANCEL") return cancel();

  // 3. Durée
  const durationStr = await ask("Quelle est la **durée** du giveaway ? (ex: `1h`, `30m`, `2d`, `1w`)");
  if (!durationStr || durationStr === "CANCEL") return cancel();
  const duration = parseDuration(durationStr);
  if (!duration) {
    return channel.send({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("❌ Durée invalide.")] });
  }

  // 4. Nombre de gagnants
  const winnersStr = await ask("Combien de **gagnants** ? (nombre entier ≥ 1)");
  if (!winnersStr || winnersStr === "CANCEL") return cancel();
  const winnerCount = parseInt(winnersStr);
  if (isNaN(winnerCount) || winnerCount < 1) {
    return channel.send({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("❌ Nombre de gagnants invalide.")] });
  }

  // 5. Description
  const description = await ask("Voulez-vous ajouter une **description** personnalisée ?", true);
  if (description === "CANCEL") return cancel();

  // 6. Couleur
  let color = await ask("Quelle **couleur** pour l'embed ? (ex: `#5865F2`)", true);
  if (color === "CANCEL") return cancel();
  if (color && !isValidHex(color)) color = null;

  // 7. Rôles requis
  const rolesAnswer = await ask("Des **rôles requis** ? (mentionnez-les, séparés par des espaces — ex: `@Booster @Nitro`)", true);
  if (rolesAnswer === "CANCEL") return cancel();
  let requiredRoles = [];
  if (rolesAnswer) {
    requiredRoles = rolesAnswer.split(" ").map((r) => r.replace(/[<@&>]/g, "")).filter((id) => message.guild.roles.cache.has(id));
  }

  // 8. Ancienneté compte
  const accountAgeStr = await ask("Ancienneté minimum du **compte Discord** (en jours) ?", true);
  if (accountAgeStr === "CANCEL") return cancel();
  const minAccountAge = accountAgeStr ? parseInt(accountAgeStr) : 0;

  // 9. Ancienneté serveur
  const serverAgeStr = await ask("Ancienneté minimum dans le **serveur** (en jours) ?", true);
  if (serverAgeStr === "CANCEL") return cancel();
  const minServerAge = serverAgeStr ? parseInt(serverAgeStr) : 0;

  // 10. Template
  const guildTemplates = DATA.templates && DATA.templates[message.guild.id] ? Object.keys(DATA.templates[message.guild.id]) : [];
  let embedTemplate = null;
  if (guildTemplates.length > 0) {
    const tplAnswer = await ask(`Utiliser un **template** ? (${guildTemplates.join(", ")})`, true);
    if (tplAnswer === "CANCEL") return cancel();
    if (tplAnswer && DATA.templates[message.guild.id][tplAnswer]) {
      embedTemplate = { ...DATA.templates[message.guild.id][tplAnswer] };
    }
  }

  // Construire les requirements
  const requirements = {};
  if (requiredRoles.length > 0) requirements.requiredRoles = requiredRoles;
  if (minAccountAge > 0) requirements.minAccountAge = minAccountAge;
  if (minServerAge > 0) requirements.minServerAge = minServerAge;

  // Appliquer couleur personnalisée
  if (color) {
    if (!embedTemplate) embedTemplate = { ...cfg.embedTemplate };
    embedTemplate.color = color;
  }

  try {
    const giveaway = await createGiveaway({
      guild: message.guild,
      channel: targetChannel,
      prize,
      duration,
      winnerCount,
      hostedBy: author,
      requirements: Object.keys(requirements).length > 0 ? requirements : null,
      description,
      embedTemplate,
    });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#57F287")
          .setTitle("🎉 Giveaway Créé avec Succès !")
          .setDescription(`Le giveaway **${prize}** a été lancé dans <#${targetChannel.id}> !`)
          .addFields(
            { name: "Durée", value: formatDuration(duration), inline: true },
            { name: "Gagnants", value: `${winnerCount}`, inline: true },
            { name: "Fin", value: formatEndDate(giveaway.endsAt), inline: false }
          )
          .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" })
      ],
    });
  } catch (e) {
    await channel.send({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription(`❌ ${e.message}`)] });
  }
}

// ─── !gend ────────────────────────────────────────────────────────────────────
async function cmdGend(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de terminer des giveaways.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gend <messageID>\``);

  const g = findGiveaway(args[0], message.guild.id);
  if (!g) return replyError(message, "Giveaway introuvable avec cet ID.");
  if (g.ended) return replyError(message, "Ce giveaway est déjà terminé.");

  await endGiveaway(args[0], true);
}

// ─── !greroll ─────────────────────────────────────────────────────────────────
async function cmdGreroll(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de reroll des giveaways.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}greroll <messageID> [gagnants]\``);

  const newCount = args[1] ? parseInt(args[1]) : null;
  const result = await rerollGiveaway(args[0], newCount);

  if (!result) return replyError(message, "Giveaway introuvable avec cet ID.");
  if (result.error) return replyError(message, result.error);

  const winnerMentions = result.winners.map((id) => `<@${id}>`).join(", ");
  return replySuccess(message, `Reroll effectué ! Nouveau(x) gagnant(s) : ${winnerMentions} pour **${result.giveaway.prize}** !`);
}

// ─── !gpause ──────────────────────────────────────────────────────────────────
async function cmdGpause(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de mettre en pause des giveaways.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gpause <messageID>\``);

  const result = await pauseGiveaway(args[0]);
  if (!result) return replyError(message, "Giveaway introuvable.");
  if (result.error) return replyError(message, result.error);

  return replySuccess(message, `Giveaway **${result.prize}** mis en pause. Temps restant sauvegardé : ${formatTimeLeft(result.timeLeftAtPause)}`);
}

// ─── !gresume ─────────────────────────────────────────────────────────────────
async function cmdGresume(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de reprendre des giveaways.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gresume <messageID>\``);

  const result = await resumeGiveaway(args[0]);
  if (!result) return replyError(message, "Giveaway introuvable.");
  if (result.error) return replyError(message, result.error);

  return replySuccess(message, `Giveaway **${result.prize}** repris ! Nouvelle fin : ${formatEndDate(result.endsAt)}`);
}

// ─── !gdelete ─────────────────────────────────────────────────────────────────
async function cmdGdelete(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de supprimer des giveaways.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gdelete <messageID>\``);

  const g = findGiveaway(args[0], message.guild.id);
  if (!g) return replyError(message, "Giveaway introuvable.");

  await deleteGiveaway(args[0]);
  return replySuccess(message, `Giveaway **${g.prize}** supprimé avec succès.`);
}

// ─── !gedit ───────────────────────────────────────────────────────────────────
async function cmdGedit(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de modifier des giveaways.");
  }
  if (args.length < 3) {
    return replyError(
      message,
      `Syntaxe : \`${DATA.config.prefix}gedit <messageID> <champ> <valeur>\`\n\n**Champs disponibles :**\n\`prize\` — Changer le prix\n\`winners\` — Changer le nombre de gagnants\n\`duration\` — Changer la durée restante\n\`description\` — Changer la description\n\`color\` — Changer la couleur (hex)`
    );
  }

  const [msgId, field, ...valueParts] = args;
  const value = valueParts.join(" ");
  const result = await editGiveaway(msgId, field, value);

  if (result.error) return replyError(message, result.error);
  return replySuccess(message, result.success);
}

// ─── !glist ───────────────────────────────────────────────────────────────────
async function cmdGlist(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de voir la liste des giveaways.");
  }

  let channelId = null;
  if (args[0]) {
    channelId = args[0].replace(/[<#>]/g, "");
  }

  const active = getActiveGiveaways(message.guild.id, channelId);
  const paused = DATA.giveaways.filter((g) => g.paused && !g.deleted && g.guildId === message.guild.id);

  if (active.length === 0 && paused.length === 0) {
    return replyInfo(message, "📋 Giveaways Actifs", "Aucun giveaway actif en ce moment.");
  }

  const allShown = [...active, ...paused.filter((g) => !active.includes(g))];
  const fields = allShown.slice(0, 10).map((g) => ({
    name: `${g.paused ? "⏸️" : "🎉"} ${g.prize}`,
    value: [
      `Salon: <#${g.channelId}>`,
      `Fin: ${formatEndDate(g.endsAt)}`,
      `Gagnants: ${g.winnerCount}`,
      `Participants: ${g.participants ? g.participants.length : 0}`,
      `ID: \`${g.messageId}\``,
      g.paused ? "**⏸️ EN PAUSE**" : `Temps restant: ${formatTimeLeft(g.endsAt - Date.now())}`,
    ].join("\n"),
    inline: false,
  }));

  return replyInfo(
    message,
    `📋 Giveaways Actifs (${allShown.length})`,
    channelId ? `Giveaways dans <#${channelId}>` : "Tous les giveaways actifs du serveur",
    fields
  );
}

// ─── !ginfo ───────────────────────────────────────────────────────────────────
async function cmdGinfo(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de voir les infos des giveaways.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}ginfo <messageID>\``);

  const g = findGiveaway(args[0], message.guild.id);
  if (!g) return replyError(message, "Giveaway introuvable.");

  const tpl = g.embedTemplate || DATA.config.embedTemplate || {};
  const timeLeft = g.endsAt - Date.now();

  const embed = new EmbedBuilder()
    .setColor(resolveColor(tpl.color || DATA.config.defaultColor))
    .setTitle(`ℹ️ Info — ${g.prize}`)
    .addFields(
      { name: "Prix", value: g.prize, inline: true },
      { name: "Statut", value: g.ended ? "✅ Terminé" : g.paused ? "⏸️ En pause" : "🟢 Actif", inline: true },
      { name: "Salon", value: `<#${g.channelId}>`, inline: true },
      { name: "Hébergé par", value: g.hostedBy ? `<@${g.hostedBy}>` : "Inconnu", inline: true },
      { name: "Gagnants prévus", value: `${g.winnerCount}`, inline: true },
      { name: "Participants", value: `${g.participants ? g.participants.length : 0}`, inline: true },
      { name: "Début", value: g.startedAt ? discordTimestamp(g.startedAt, "F") : "?", inline: true },
      { name: "Fin", value: formatEndDate(g.endsAt), inline: true },
      { name: "Temps restant", value: g.ended ? "Terminé" : g.paused ? `⏸️ ${formatTimeLeft(g.timeLeftAtPause)}` : formatTimeLeft(timeLeft), inline: true },
      { name: "ID Message", value: `\`${g.messageId}\``, inline: true }
    );

  if (g.winners && g.winners.length > 0) {
    embed.addFields({ name: "🏆 Gagnants", value: g.winners.map((id) => `<@${id}>`).join(", "), inline: false });
  }
  if (g.requirements) {
    const reqText = buildRequirementsText(g.requirements);
    if (reqText) embed.addFields({ name: "Requirements", value: reqText, inline: false });
  }
  if (g.description) {
    embed.addFields({ name: "Description", value: g.description, inline: false });
  }
  if (g.bonusEntries && g.bonusEntries.length > 0) {
    embed.addFields({
      name: "Bonus Entries",
      value: g.bonusEntries.map((b) => `<@${b.userId}> (+${b.entries})`).join(", "),
      inline: false,
    });
  }

  embed.setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" }).setTimestamp();
  return message.reply({ embeds: [embed] });
}

// ─── !gparticipants ───────────────────────────────────────────────────────────
async function cmdGparticipants(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de voir les participants.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gparticipants <messageID>\``);

  const g = findGiveaway(args[0], message.guild.id);
  if (!g) return replyError(message, "Giveaway introuvable.");

  const participants = g.participants || [];
  if (participants.length === 0) {
    return replyInfo(message, `👥 Participants — ${g.prize}`, "Aucun participant pour le moment.");
  }

  // Découper en pages de 20
  const PAGE_SIZE = 20;
  const pages = [];
  for (let i = 0; i < participants.length; i += PAGE_SIZE) {
    pages.push(participants.slice(i, i + PAGE_SIZE));
  }

  const pageLines = pages[0].map((id, idx) => `${idx + 1}. <@${id}>`).join("\n");
  const embed = new EmbedBuilder()
    .setColor(DATA.config.defaultColor || "#5865F2")
    .setTitle(`👥 Participants — ${g.prize}`)
    .setDescription(pageLines)
    .setFooter({ text: `${participants.length} participant(s) — Page 1/${pages.length}` });

  const components = [];
  if (pages.length > 1) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`participants_prev_0_${g.messageId}`).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`participants_page_0_${g.messageId}`).setLabel("1 / " + pages.length).setStyle(ButtonStyle.Primary).setDisabled(true),
      new ButtonBuilder().setCustomId(`participants_next_0_${g.messageId}`).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(pages.length <= 1)
    );
    components.push(row);
  }

  return message.reply({ embeds: [embed], components });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — COMMANDES CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// ─── !setprefix ───────────────────────────────────────────────────────────────
async function cmdSetprefix(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de changer le préfixe.");
  }
  if (!args[0]) return replyError(message, `Syntaxe : \`${DATA.config.prefix}setprefix <nouveau_préfixe>\``);

  const newPrefix = args[0].slice(0, 5); // Max 5 caractères
  DATA = loadData();
  DATA.config.prefix = newPrefix;
  saveData(DATA);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Préfixe mis à jour !")
        .setDescription(`Le préfixe est maintenant : \`${newPrefix}\`\n\nExemple : \`${newPrefix}ghelp\``)
    ],
  });
}

// ─── !gconfig ─────────────────────────────────────────────────────────────────
async function cmdGconfig(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de voir/modifier la configuration.");
  }

  DATA = loadData();
  const cfg = DATA.config;

  if (!args[0]) {
    // Afficher la config actuelle
    const embed = new EmbedBuilder()
      .setColor(cfg.defaultColor || "#5865F2")
      .setTitle("⚙️ Configuration du Bot")
      .addFields(
        { name: "Préfixe", value: `\`${cfg.prefix}\``, inline: true },
        { name: "Couleur défaut", value: cfg.defaultColor || "#7B1FA2", inline: true },
        { name: "Footer défaut", value: cfg.defaultFooter || "🎉 SORA", inline: true },
        { name: "Salon de logs", value: cfg.logChannel ? `<#${cfg.logChannel}>` : "Non défini", inline: true },
        { name: "DM gagnants", value: cfg.dmWinners ? "✅ Activé" : "❌ Désactivé", inline: true },
        { name: "Annonce gagnants", value: cfg.winAnnouncement !== false ? "✅ Activé" : "❌ Désactivé", inline: true },
        { name: "Fuseau horaire", value: cfg.timezone || "Europe/Paris", inline: true },
        { name: "Max gagnants", value: `${cfg.maxWinners || 20}`, inline: true },
        { name: "Durée max", value: formatDuration(cfg.maxDuration || 2592000000), inline: true },
        { name: "Durée min", value: formatDuration(cfg.minDuration || 10000), inline: true },
        { name: "Max giveaways/salon", value: `${cfg.maxGiveawaysPerChannel || 5}`, inline: true },
        { name: "Auto-suppression", value: cfg.autoDelete?.enabled ? `✅ (${formatDuration(cfg.autoDelete.delay)})` : "❌", inline: true },
        {
          name: "Managers",
          value: (cfg.managers || []).length > 0
            ? cfg.managers.map((id) => `<@${id}> ou <@&${id}>`).join(", ")
            : "Aucun (ManageGuild requis)",
          inline: false,
        },
        {
          name: "Embed Template",
          value: `Bouton: ${cfg.embedTemplate?.buttonLabel || "🎉 Participer"} (${cfg.embedTemplate?.buttonStyle || "Primary"})\nLast Chance: ${cfg.embedTemplate?.lastChanceEnabled ? `✅ (${cfg.embedTemplate?.lastChanceThreshold}s)` : "❌"}`,
          inline: false,
        }
      )
      .setFooter({ text: `Utilisez ${cfg.prefix}gconfig set <clé> <valeur> pour modifier` });

    return message.reply({ embeds: [embed] });
  }

  const subCmd = args[0].toLowerCase();

  if (subCmd === "set") {
    if (args.length < 3) return replyError(message, `Syntaxe : \`${cfg.prefix}gconfig set <clé> <valeur>\``);
    const key = args[1].toLowerCase();
    const value = args.slice(2).join(" ");

    const settableKeys = {
      maxwinners: (v) => { const n = parseInt(v); if (isNaN(n)) return "Nombre invalide."; DATA.config.maxWinners = n; return `maxWinners = ${n}`; },
      maxduration: (v) => { const d = parseDuration(v); if (!d) return "Durée invalide."; DATA.config.maxDuration = d; return `maxDuration = ${formatDuration(d)}`; },
      minduration: (v) => { const d = parseDuration(v); if (!d) return "Durée invalide."; DATA.config.minDuration = d; return `minDuration = ${formatDuration(d)}`; },
      maxperchannel: (v) => { const n = parseInt(v); if (isNaN(n)) return "Nombre invalide."; DATA.config.maxGiveawaysPerChannel = n; return `maxGiveawaysPerChannel = ${n}`; },
      timezone: (v) => { DATA.config.timezone = v; return `timezone = ${v}`; },
      language: (v) => { DATA.config.language = v; return `language = ${v}`; },
      winnermessage: (v) => { DATA.config.winAnnouncementMessage = v; return `winAnnouncementMessage mis à jour.`; },
      rerollmessage: (v) => { DATA.config.rerollMessage = v; return `rerollMessage mis à jour.`; },
      nowinnermessage: (v) => { DATA.config.noWinnerMessage = v; return `noWinnerMessage mis à jour.`; },
      dmmessage: (v) => { DATA.config.dmMessage = v; return `dmMessage mis à jour.`; },
    };

    if (!settableKeys[key]) {
      return replyError(message, `Clé inconnue. Clés disponibles : ${Object.keys(settableKeys).join(", ")}`);
    }

    const result = settableKeys[key](value);
    if (result && result.includes("invalide")) return replyError(message, result);
    saveData(DATA);
    return replySuccess(message, `Configuration mise à jour : **${result}**`);
  }

  if (subCmd === "color") {
    const hex = args[1];
    if (!hex || !isValidHex(hex)) return replyError(message, "Couleur invalide. Format : `#RRGGBB`");
    DATA.config.defaultColor = hex;
    saveData(DATA);
    return replySuccess(message, `Couleur par défaut mise à jour : **${hex}**`);
  }

  if (subCmd === "footer") {
    const footer = args.slice(1).join(" ");
    if (!footer) return replyError(message, "Footer vide.");
    DATA.config.defaultFooter = footer;
    saveData(DATA);
    return replySuccess(message, `Footer par défaut mis à jour : **${footer}**`);
  }

  if (subCmd === "button") {
    const label = args.slice(1).join(" ");
    if (!label) return replyError(message, "Label vide.");
    if (!DATA.config.embedTemplate) DATA.config.embedTemplate = {};
    DATA.config.embedTemplate.buttonLabel = label;
    saveData(DATA);
    return replySuccess(message, `Label du bouton mis à jour : **${label}**`);
  }

  if (subCmd === "buttonstyle") {
    const style = args[1];
    const validStyles = ["Primary", "Secondary", "Success", "Danger"];
    if (!style || !validStyles.includes(style)) {
      return replyError(message, `Style invalide. Styles disponibles : ${validStyles.join(", ")}`);
    }
    if (!DATA.config.embedTemplate) DATA.config.embedTemplate = {};
    DATA.config.embedTemplate.buttonStyle = style;
    saveData(DATA);
    return replySuccess(message, `Style du bouton mis à jour : **${style}**`);
  }

  if (subCmd === "dmwinners") {
    const val = args[1]?.toLowerCase();
    if (!val || !["on", "off", "oui", "non", "true", "false"].includes(val)) {
      return replyError(message, "Valeur invalide. Utilisez `on` ou `off`.");
    }
    DATA.config.dmWinners = ["on", "oui", "true"].includes(val);
    saveData(DATA);
    return replySuccess(message, `DM aux gagnants : **${DATA.config.dmWinners ? "Activé" : "Désactivé"}**`);
  }

  if (subCmd === "winannouncement") {
    const val = args[1]?.toLowerCase();
    if (!val || !["on", "off", "oui", "non", "true", "false"].includes(val)) {
      return replyError(message, "Valeur invalide. Utilisez `on` ou `off`.");
    }
    DATA.config.winAnnouncement = ["on", "oui", "true"].includes(val);
    saveData(DATA);
    return replySuccess(message, `Annonce des gagnants : **${DATA.config.winAnnouncement ? "Activée" : "Désactivée"}**`);
  }

  if (subCmd === "logchannel") {
    const chId = args[1]?.replace(/[<#>]/g, "");
    if (!chId) {
      DATA.config.logChannel = "";
      saveData(DATA);
      return replySuccess(message, "Salon de logs retiré.");
    }
    const ch = message.guild.channels.cache.get(chId);
    if (!ch) return replyError(message, "Salon introuvable.");
    DATA.config.logChannel = chId;
    saveData(DATA);
    return replySuccess(message, `Salon de logs défini : <#${chId}>`);
  }

  if (subCmd === "autodelete") {
    const val = args[1]?.toLowerCase();
    if (!val) return replyError(message, "Syntaxe : `gconfig autodelete on/off [durée]`");
    if (["off", "non", "false"].includes(val)) {
      if (!DATA.config.autoDelete) DATA.config.autoDelete = {};
      DATA.config.autoDelete.enabled = false;
      saveData(DATA);
      return replySuccess(message, "Auto-suppression désactivée.");
    }
    if (["on", "oui", "true"].includes(val)) {
      const delay = args[2] ? parseDuration(args[2]) : 86400000;
      if (!DATA.config.autoDelete) DATA.config.autoDelete = {};
      DATA.config.autoDelete.enabled = true;
      DATA.config.autoDelete.delay = delay || 86400000;
      saveData(DATA);
      return replySuccess(message, `Auto-suppression activée après ${formatDuration(DATA.config.autoDelete.delay)}.`);
    }
  }

  if (subCmd === "lastchance") {
    const val = args[1]?.toLowerCase();
    if (!["on", "off", "oui", "non"].includes(val)) {
      return replyError(message, "Syntaxe : `gconfig lastchance on/off [seuil_en_secondes]`");
    }
    if (!DATA.config.embedTemplate) DATA.config.embedTemplate = {};
    DATA.config.embedTemplate.lastChanceEnabled = ["on", "oui"].includes(val);
    if (args[2]) {
      const thr = parseInt(args[2]);
      if (!isNaN(thr)) DATA.config.embedTemplate.lastChanceThreshold = thr;
    }
    saveData(DATA);
    return replySuccess(message, `Last Chance : **${DATA.config.embedTemplate.lastChanceEnabled ? "Activé" : "Désactivé"}** (seuil: ${DATA.config.embedTemplate.lastChanceThreshold || 60}s)`);
  }

  if (subCmd === "manager") {
    const action = args[1]?.toLowerCase();
    if (!["add", "remove", "list"].includes(action)) {
      return replyError(message, `Syntaxe : \`${cfg.prefix}gconfig manager <add|remove|list> [@user/@role]\``);
    }
    if (action === "list") {
      const managers = DATA.config.managers || [];
      if (managers.length === 0) return replyInfo(message, "👥 Managers", "Aucun manager défini.\nTout membre avec la permission ManageGuild peut gérer les giveaways.");
      return replyInfo(message, "👥 Managers", managers.map((id) => `• <@${id}> / <@&${id}> (\`${id}\`)`).join("\n"));
    }
    const mentionId = args[2]?.replace(/[<@!&>]/g, "");
    if (!mentionId) return replyError(message, "Mentionnez un utilisateur ou un rôle.");
    if (!DATA.config.managers) DATA.config.managers = [];
    if (action === "add") {
      if (DATA.config.managers.includes(mentionId)) return replyError(message, "Déjà manager.");
      DATA.config.managers.push(mentionId);
      saveData(DATA);
      return replySuccess(message, `Manager ajouté : <@${mentionId}> / <@&${mentionId}>`);
    }
    if (action === "remove") {
      const idx = DATA.config.managers.indexOf(mentionId);
      if (idx === -1) return replyError(message, "Pas un manager.");
      DATA.config.managers.splice(idx, 1);
      saveData(DATA);
      return replySuccess(message, `Manager retiré : <@${mentionId}> / <@&${mentionId}>`);
    }
  }

  if (subCmd === "embed") {
    const embed = new EmbedBuilder()
      .setColor(cfg.defaultColor || "#5865F2")
      .setTitle("⚙️ Configuration de l'Embed")
      .addFields(
        { name: "Couleur", value: cfg.embedTemplate?.color || cfg.defaultColor || "#7B1FA2", inline: true },
        { name: "Titre", value: cfg.embedTemplate?.title || "{prize}", inline: true },
        { name: "Footer", value: cfg.embedTemplate?.footerText || cfg.defaultFooter || "🎉 SORA", inline: true },
        { name: "Bouton Label", value: cfg.embedTemplate?.buttonLabel || "🎉 Participer", inline: true },
        { name: "Bouton Style", value: cfg.embedTemplate?.buttonStyle || "Primary", inline: true },
        { name: "Last Chance", value: cfg.embedTemplate?.lastChanceEnabled ? `✅ (${cfg.embedTemplate?.lastChanceThreshold || 60}s)` : "❌", inline: true },
        { name: "Thumbnail", value: cfg.embedTemplate?.thumbnailEnabled ? "✅" : "❌", inline: true },
        { name: "Banner", value: cfg.embedTemplate?.bannerEnabled ? "✅" : "❌", inline: true },
        { name: "Couleur terminé", value: cfg.embedTemplate?.endedColor || "#7B1FA2", inline: true },
        {
          name: "Champs affichés",
          value: [
            `Time Left: ${cfg.embedTemplate?.showTimeLeft !== false ? "✅" : "❌"}`,
            `Ends At: ${cfg.embedTemplate?.showEndsAt !== false ? "✅" : "❌"}`,
            `Hosted By: ${cfg.embedTemplate?.showHostedBy !== false ? "✅" : "❌"}`,
            `Entries: ${cfg.embedTemplate?.showEntries !== false ? "✅" : "❌"}`,
            `Winners: ${cfg.embedTemplate?.showWinners !== false ? "✅" : "❌"}`,
            `Requirements: ${cfg.embedTemplate?.showRequirements !== false ? "✅" : "❌"}`,
          ].join(" | "),
          inline: false,
        }
      )
      .setFooter({ text: `Utilisez ${cfg.prefix}gconfig color, footer, button, buttonstyle pour modifier` });
    return message.reply({ embeds: [embed] });
  }

  if (subCmd === "embedfield") {
    const field = args[1]?.toLowerCase();
    const val = args[2]?.toLowerCase();
    const validFields = ["timeleft", "endsat", "hostedby", "entries", "winners", "requirements"];
    const fieldMap = {
      timeleft: "showTimeLeft",
      endsat: "showEndsAt",
      hostedby: "showHostedBy",
      entries: "showEntries",
      winners: "showWinners",
      requirements: "showRequirements",
    };
    if (!validFields.includes(field)) return replyError(message, `Champ invalide. Disponibles : ${validFields.join(", ")}`);
    if (!["on", "off"].includes(val)) return replyError(message, "Valeur invalide. Utilisez `on` ou `off`.");
    if (!DATA.config.embedTemplate) DATA.config.embedTemplate = {};
    DATA.config.embedTemplate[fieldMap[field]] = val === "on";
    saveData(DATA);
    return replySuccess(message, `Champ **${field}** : **${val === "on" ? "Affiché" : "Masqué"}**`);
  }

  if (subCmd === "reset") {
    if (args[1]?.toLowerCase() !== "confirm") {
      return replyError(message, `⚠️ Cette action va réinitialiser la configuration par défaut !\nConfirmez avec : \`${cfg.prefix}gconfig reset confirm\``);
    }
    DATA.config.defaultColor = "#7B1FA2";
    DATA.config.defaultFooter = "🎉 SORA";
    DATA.config.dmWinners = true;
    DATA.config.winAnnouncement = true;
    DATA.config.embedTemplate = {
      title: "{prize}",
      color: "#7B1FA2",
      buttonLabel: "🎉 Participer",
      buttonStyle: "Primary",
      showTimeLeft: true,
      showEndsAt: true,
      showHostedBy: true,
      showEntries: true,
      showWinners: true,
      showRequirements: true,
      footerText: "🎉 SORA",
      thumbnailEnabled: false,
      bannerEnabled: false,
      lastChanceEnabled: true,
      lastChanceThreshold: 60,
      lastChanceMessage: "⚠️ Dernière chance de participer !",
      lastChanceColor: "#FF0000",
      endedColor: "#2F3136",
      endedTitle: "{prize} — Terminé",
    };
    saveData(DATA);
    return replySuccess(message, "Configuration réinitialisée aux valeurs par défaut.");
  }

  return replyError(message, `Sous-commande inconnue. Utilisez \`${cfg.prefix}gconfig\` pour voir toutes les options.`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — COMMANDES TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

async function cmdGtemplate(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de gérer les templates.");
  }

  DATA = loadData();
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === "help") {
    return replyInfo(
      message,
      "📋 Templates — Aide",
      [
        `\`${DATA.config.prefix}gtemplate create <nom>\` — Créer un template (wizard)`,
        `\`${DATA.config.prefix}gtemplate list\` — Lister les templates`,
        `\`${DATA.config.prefix}gtemplate use <nom> <durée> <gagnants> <#salon> <prix>\` — Utiliser un template`,
        `\`${DATA.config.prefix}gtemplate delete <nom>\` — Supprimer un template`,
        `\`${DATA.config.prefix}gtemplate info <nom>\` — Infos sur un template`,
        `\`${DATA.config.prefix}gtemplate edit <nom> <champ> <valeur>\` — Modifier un template`,
        `\`${DATA.config.prefix}gtemplate clone <nom> <nouveau_nom>\` — Cloner un template`,
      ].join("\n")
    );
  }

  if (sub === "create") {
    const name = args[1];
    if (!name) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gtemplate create <nom>\``);
    return createTemplateWizard(message);
  }

  if (sub === "list") {
    return listTemplates(message);
  }

  if (sub === "info") {
    const name = args[1];
    if (!name) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gtemplate info <nom>\``);
    return infoTemplate(message, name);
  }

  if (sub === "delete") {
    const name = args[1];
    if (!name) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gtemplate delete <nom>\``);
    return deleteTemplate(message, name);
  }

  if (sub === "use") {
    // !gtemplate use <nom> <durée> <gagnants> <#salon> <prix...>
    if (args.length < 6) {
      return replyError(message, `Syntaxe : \`${DATA.config.prefix}gtemplate use <nom> <durée> <gagnants> <#salon> <prix>\``);
    }
    const [, name, durationStr, winnersStr, channelMention, ...prizeArgs] = args;
    const guildId = message.guild.id;

    if (!DATA.templates || !DATA.templates[guildId] || !DATA.templates[guildId][name]) {
      return replyError(message, `Template **${name}** introuvable. Utilisez \`${DATA.config.prefix}gtemplate list\` pour voir les templates disponibles.`);
    }

    const duration = parseDuration(durationStr);
    if (!duration) return replyError(message, "Durée invalide.");

    const winnerCount = parseInt(winnersStr);
    if (isNaN(winnerCount) || winnerCount < 1) return replyError(message, "Nombre de gagnants invalide.");

    const channelId = channelMention.replace(/[<#>]/g, "");
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return replyError(message, "Salon invalide.");

    const prize = prizeArgs.join(" ");
    if (!prize) return replyError(message, "Prix manquant.");

    const embedTemplate = { ...DATA.templates[guildId][name] };

    try {
      const giveaway = await createGiveaway({
        guild: message.guild,
        channel,
        prize,
        duration,
        winnerCount,
        hostedBy: message.author,
        embedTemplate,
      });

      return replySuccess(
        message,
        `Giveaway **${prize}** lancé avec le template **${name}** dans <#${channel.id}> ! (fin : ${formatEndDate(giveaway.endsAt)})`
      );
    } catch (e) {
      return replyError(message, e.message);
    }
  }

  if (sub === "edit") {
    // !gtemplate edit <nom> <champ> <valeur>
    if (args.length < 4) {
      return replyError(message, `Syntaxe : \`${DATA.config.prefix}gtemplate edit <nom> <champ> <valeur>\`\n\nChamps : color, title, footer, buttonlabel, buttonstyle, lastchance, lastchancethreshold, lastchancemessage, lastchancecolor, thumbnail, banner`);
    }
    const [, name, field, ...valueParts] = args;
    const value = valueParts.join(" ");
    const guildId = message.guild.id;

    if (!DATA.templates || !DATA.templates[guildId] || !DATA.templates[guildId][name]) {
      return replyError(message, `Template **${name}** introuvable.`);
    }

    const tpl = DATA.templates[guildId][name];
    const fieldLower = field.toLowerCase();
    const editable = {
      color: (v) => { if (!isValidHex(v)) return "Couleur invalide."; tpl.color = v; return `color = ${v}`; },
      title: (v) => { tpl.title = v; return `title = ${v}`; },
      footer: (v) => { tpl.footerText = v; return `footer = ${v}`; },
      buttonlabel: (v) => { tpl.buttonLabel = v; return `buttonLabel = ${v}`; },
      buttonstyle: (v) => {
        const valid = ["Primary", "Secondary", "Success", "Danger"];
        if (!valid.includes(v)) return `Style invalide. Disponibles : ${valid.join(", ")}`;
        tpl.buttonStyle = v; return `buttonStyle = ${v}`;
      },
      lastchance: (v) => {
        tpl.lastChanceEnabled = ["on", "oui", "true"].includes(v.toLowerCase());
        return `lastChanceEnabled = ${tpl.lastChanceEnabled}`;
      },
      lastchancethreshold: (v) => { const n = parseInt(v); if (isNaN(n)) return "Nombre invalide."; tpl.lastChanceThreshold = n; return `lastChanceThreshold = ${n}s`; },
      lastchancemessage: (v) => { tpl.lastChanceMessage = v; return `lastChanceMessage mis à jour`; },
      lastchancecolor: (v) => { if (!isValidHex(v)) return "Couleur invalide."; tpl.lastChanceColor = v; return `lastChanceColor = ${v}`; },
      thumbnail: (v) => { tpl.thumbnailEnabled = ["on", "oui", "true"].includes(v.toLowerCase()); return `thumbnailEnabled = ${tpl.thumbnailEnabled}`; },
      banner: (v) => { tpl.bannerEnabled = ["on", "oui", "true"].includes(v.toLowerCase()); return `bannerEnabled = ${tpl.bannerEnabled}`; },
      endedcolor: (v) => { if (!isValidHex(v)) return "Couleur invalide."; tpl.endedColor = v; return `endedColor = ${v}`; },
      endedtitle: (v) => { tpl.endedTitle = v; return `endedTitle = ${v}`; },
    };

    if (!editable[fieldLower]) return replyError(message, `Champ inconnu. Champs disponibles : ${Object.keys(editable).join(", ")}`);
    const result = editable[fieldLower](value);
    if (result.includes("invalide") || result.includes("Invalide")) return replyError(message, result);

    DATA.templates[guildId][name] = tpl;
    saveData(DATA);
    return replySuccess(message, `Template **${name}** mis à jour : **${result}**`);
  }

  if (sub === "clone") {
    const [, name, newName] = args;
    if (!name || !newName) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gtemplate clone <nom> <nouveau_nom>\``);
    const guildId = message.guild.id;
    if (!DATA.templates || !DATA.templates[guildId] || !DATA.templates[guildId][name]) {
      return replyError(message, `Template **${name}** introuvable.`);
    }
    if (DATA.templates[guildId][newName]) return replyError(message, `Un template **${newName}** existe déjà.`);
    DATA.templates[guildId][newName] = { ...DATA.templates[guildId][name], name: newName, createdAt: Date.now(), createdBy: message.author.id };
    saveData(DATA);
    return replySuccess(message, `Template **${name}** cloné en **${newName}** avec succès !`);
  }

  return replyError(message, `Sous-commande inconnue. Utilisez \`${DATA.config.prefix}gtemplate help\``);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — COMMANDES BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════════

async function cmdGblacklist(message, args) {
  if (!isManager(message.member, message.guild.id)) {
    return replyError(message, "Tu n'as pas la permission de gérer la blacklist.");
  }

  DATA = loadData();
  const sub = args[0]?.toLowerCase();

  if (!sub) {
    return replyInfo(
      message,
      "⛔ Blacklist — Aide",
      [
        `\`${DATA.config.prefix}gblacklist add <@user>\` — Blacklister un utilisateur`,
        `\`${DATA.config.prefix}gblacklist remove <@user>\` — Retirer de la blacklist`,
        `\`${DATA.config.prefix}gblacklist list\` — Voir la blacklist`,
        `\`${DATA.config.prefix}gblacklist check <@user>\` — Vérifier si un user est blacklisté`,
        `\`${DATA.config.prefix}gblacklist clear\` — Vider toute la blacklist`,
      ].join("\n")
    );
  }

  if (sub === "add") {
    const userId = args[1]?.replace(/[<@!>]/g, "");
    if (!userId) return replyError(message, "Mentionnez un utilisateur.");
    let user;
    try { user = await client.users.fetch(userId); } catch (_) { return replyError(message, "Utilisateur introuvable."); }
    if (userId === message.author.id) return replyError(message, "Tu ne peux pas te blacklister toi-même.");
    const added = addToBlacklist(userId);
    if (!added) return replyError(message, `**${user.tag}** est déjà dans la blacklist.`);
    return replySuccess(message, `**${user.tag}** a été ajouté à la blacklist. Il ne pourra plus participer aux giveaways.`);
  }

  if (sub === "remove") {
    const userId = args[1]?.replace(/[<@!>]/g, "");
    if (!userId) return replyError(message, "Mentionnez un utilisateur.");
    let user;
    try { user = await client.users.fetch(userId); } catch (_) { return replyError(message, "Utilisateur introuvable."); }
    const removed = removeFromBlacklist(userId);
    if (!removed) return replyError(message, `**${user.tag}** n'est pas dans la blacklist.`);
    return replySuccess(message, `**${user.tag}** a été retiré de la blacklist.`);
  }

  if (sub === "list") {
    const blacklist = DATA.blacklist || [];
    if (blacklist.length === 0) return replyInfo(message, "⛔ Blacklist", "La blacklist est vide.");
    const lines = [];
    for (const userId of blacklist) {
      const user = await client.users.fetch(userId).catch(() => null);
      lines.push(`• ${user ? `**${user.tag}**` : "Utilisateur inconnu"} (\`${userId}\`)`);
    }
    return replyInfo(message, `⛔ Blacklist (${blacklist.length})`, lines.join("\n"));
  }

  if (sub === "check") {
    const userId = args[1]?.replace(/[<@!>]/g, "");
    if (!userId) return replyError(message, "Mentionnez un utilisateur.");
    let user;
    try { user = await client.users.fetch(userId); } catch (_) { return replyError(message, "Utilisateur introuvable."); }
    const bl = isBlacklisted(userId);
    return replyInfo(message, `🔍 Blacklist — ${user.tag}`, bl ? `⛔ **${user.tag}** est dans la blacklist.` : `✅ **${user.tag}** n'est pas dans la blacklist.`);
  }

  if (sub === "clear") {
    if (args[1]?.toLowerCase() !== "confirm") {
      return replyError(message, `⚠️ Cette action va vider toute la blacklist !\nConfirmez avec : \`${DATA.config.prefix}gblacklist clear confirm\``);
    }
    DATA.blacklist = [];
    saveData(DATA);
    return replySuccess(message, "Blacklist vidée.");
  }

  return replyError(message, `Sous-commande inconnue. Utilisez \`${DATA.config.prefix}gblacklist\` pour l'aide.`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — COMMANDES STATS & AIDE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── !gstats ──────────────────────────────────────────────────────────────────
async function cmdGstats(message, args) {
  DATA = loadData();
  const sub = args[0]?.toLowerCase();

  if (!sub) {
    const stats = getGlobalStats();
    const guildGiveaways = DATA.giveaways.filter((g) => g.guildId === message.guild.id && !g.deleted);
    const guildActive = guildGiveaways.filter((g) => !g.ended).length;
    const guildEnded = guildGiveaways.filter((g) => g.ended).length;
    const guildParticipants = guildGiveaways.reduce((acc, g) => acc + (g.participants ? g.participants.length : 0), 0);
    const guildWinners = guildGiveaways.reduce((acc, g) => acc + (g.winners ? g.winners.length : 0), 0);

    return replyInfo(
      message,
      "📊 Statistiques du Bot",
      "",
      [
        { name: "📋 Ce serveur", value: `Giveaways : ${guildGiveaways.length}\nActifs : ${guildActive}\nTerminés : ${guildEnded}\nParticipants (total) : ${guildParticipants}\nGagnants (total) : ${guildWinners}`, inline: true },
        { name: "🌐 Global", value: `Giveaways : ${stats.total}\nActifs : ${stats.active}\nTerminés : ${stats.ended}\nParticipants : ${stats.totalParticipants}\nGagnants : ${stats.totalWinners}`, inline: true },
        { name: "⛔ Blacklist", value: `${stats.blacklistCount} utilisateur(s)`, inline: true },
        { name: "📌 Templates (ce serveur)", value: `${DATA.templates && DATA.templates[message.guild.id] ? Object.keys(DATA.templates[message.guild.id]).length : 0}`, inline: true },
      ]
    );
  }

  if (sub === "user") {
    const userId = args[1]?.replace(/[<@!>]/g, "");
    if (!userId) return replyError(message, `Syntaxe : \`${DATA.config.prefix}gstats user <@user>\``);
    let user;
    try { user = await client.users.fetch(userId); } catch (_) { return replyError(message, "Utilisateur introuvable."); }
    const stats = getUserStats(userId);

    const wonGiveaways = DATA.giveaways.filter((g) => (g.winners || []).includes(userId) && g.guildId === message.guild.id).slice(-5);
    const recentWins = wonGiveaways.length > 0
      ? wonGiveaways.map((g) => `• **${g.prize}** — <#${g.channelId}>`).join("\n")
      : "Aucune victoire";

    return replyInfo(
      message,
      `📊 Stats — ${user.tag}`,
      "",
      [
        { name: "Participations", value: `${stats.participated}`, inline: true },
        { name: "Victoires", value: `${stats.won}`, inline: true },
        { name: "Taux de victoire", value: `${stats.winRate}%`, inline: true },
        { name: "Blacklisté", value: stats.isBlacklisted ? "⛔ Oui" : "✅ Non", inline: true },
        { name: "5 dernières victoires", value: recentWins, inline: false },
      ]
    );
  }

  if (sub === "server") {
    const guildGiveaways = DATA.giveaways.filter((g) => g.guildId === message.guild.id && !g.deleted);
    const topHosts = {};
    for (const g of guildGiveaways) {
      if (g.hostedBy) {
        topHosts[g.hostedBy] = (topHosts[g.hostedBy] || 0) + 1;
      }
    }
    const sortedHosts = Object.entries(topHosts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topHostsText = sortedHosts.length > 0
      ? sortedHosts.map(([id, count]) => `<@${id}> : ${count} giveaway(s)`).join("\n")
      : "Aucune donnée";

    const topPrizes = guildGiveaways.filter((g) => g.ended).sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0)).slice(0, 3);
    const topPrizesText = topPrizes.length > 0
      ? topPrizes.map((g) => `**${g.prize}** — ${g.participants?.length || 0} participant(s)`).join("\n")
      : "Aucune donnée";

    return replyInfo(
      message,
      `📊 Stats — ${message.guild.name}`,
      "",
      [
        { name: "Total giveaways", value: `${guildGiveaways.length}`, inline: true },
        { name: "Actifs", value: `${guildGiveaways.filter((g) => !g.ended).length}`, inline: true },
        { name: "Terminés", value: `${guildGiveaways.filter((g) => g.ended).length}`, inline: true },
        { name: "Top Hôtes", value: topHostsText, inline: false },
        { name: "Top Giveaways (participants)", value: topPrizesText, inline: false },
      ]
    );
  }

  return replyError(message, `Syntaxe : \`${DATA.config.prefix}gstats [user <@user> | server]\``);
}

// ─── !gping ───────────────────────────────────────────────────────────────────
async function cmdGping(message) {
  const start = Date.now();
  const msg = await message.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setDescription("🏓 Calcul de la latence...")] });
  const latency = Date.now() - start;
  const wsLatency = client.ws.ping;

  await msg.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(latency < 100 ? "#57F287" : latency < 300 ? "#FEE75C" : "#ED4245")
        .setTitle("🏓 Pong !")
        .addFields(
          { name: "Latence Bot", value: `${latency}ms`, inline: true },
          { name: "Latence API", value: `${wsLatency}ms`, inline: true }
        )
        .setTimestamp()
    ],
  });
}

// ─── !ghelp ───────────────────────────────────────────────────────────────────
async function cmdGhelp(message, args) {
  DATA = loadData();
  const p = DATA.config.prefix;

  if (args[0]) {
    const cmd = args[0].toLowerCase().replace(/^g/, "");
    const helpTexts = {
      start: {
        title: `${p}gstart — Lancer un giveaway`,
        desc: `Lance un giveaway rapidement.\n\n**Syntaxe :** \`${p}gstart <durée> <gagnants> <#salon> <prix> [options]\`\n\n**Exemples :**\n\`${p}gstart 1h 1 #giveaways Nitro Boost\`\n\`${p}gstart 2d 3 #giveaways Carte cadeau 50€ --roles @Booster --color #FF0000\`\n\n**Options :**\n\`--description <texte>\` — Description\n\`--roles <@role>\` — Rôles requis\n\`--blacklistedroles <@role>\` — Rôles interdits\n\`--accountage <jours>\` — Ancienneté compte\n\`--serverage <jours>\` — Ancienneté serveur\n\`--color <hex>\` — Couleur\n\`--thumbnail <url>\` — Thumbnail\n\`--banner <url>\` — Banner\n\`--bonus <@user> <entrées>\` — Bonus d'entrées`,
      },
      create: {
        title: `${p}gcreate — Wizard de création`,
        desc: `Lance un assistant interactif pour créer un giveaway étape par étape. Plus simple mais moins rapide que \`${p}gstart\`.`,
      },
      end: {
        title: `${p}gend — Terminer un giveaway`,
        desc: `Termine immédiatement un giveaway et tire les gagnants.\n\n**Syntaxe :** \`${p}gend <messageID>\``,
      },
      reroll: {
        title: `${p}greroll — Reroll`,
        desc: `Relance le tirage au sort pour un giveaway terminé.\n\n**Syntaxe :** \`${p}greroll <messageID> [nombre_gagnants]\``,
      },
      pause: {
        title: `${p}gpause — Mettre en pause`,
        desc: `Met en pause un giveaway en cours. Le temps restant est sauvegardé.\n\n**Syntaxe :** \`${p}gpause <messageID>\``,
      },
      resume: {
        title: `${p}gresume — Reprendre`,
        desc: `Reprend un giveaway mis en pause. La durée restante est restaurée.\n\n**Syntaxe :** \`${p}gresume <messageID>\``,
      },
      delete: {
        title: `${p}gdelete — Supprimer`,
        desc: `Supprime un giveaway et son message Discord.\n\n**Syntaxe :** \`${p}gdelete <messageID>\``,
      },
      edit: {
        title: `${p}gedit — Modifier`,
        desc: `Modifie un giveaway en cours.\n\n**Syntaxe :** \`${p}gedit <messageID> <champ> <valeur>\`\n\n**Champs :** \`prize\`, \`winners\`, \`duration\`, \`description\`, \`color\``,
      },
      list: {
        title: `${p}glist — Liste des giveaways`,
        desc: `Affiche les giveaways actifs du serveur.\n\n**Syntaxe :** \`${p}glist [#salon]\``,
      },
      info: {
        title: `${p}ginfo — Infos d'un giveaway`,
        desc: `Affiche les informations détaillées d'un giveaway.\n\n**Syntaxe :** \`${p}ginfo <messageID>\``,
      },
      participants: {
        title: `${p}gparticipants — Participants`,
        desc: `Affiche la liste des participants d'un giveaway.\n\n**Syntaxe :** \`${p}gparticipants <messageID>\``,
      },
      config: {
        title: `${p}gconfig — Configuration`,
        desc: `Gère la configuration du bot.\n\n**Sous-commandes :**\n\`${p}gconfig\` — Voir la config\n\`${p}gconfig set <clé> <valeur>\` — Modifier\n\`${p}gconfig color <hex>\` — Couleur\n\`${p}gconfig footer <texte>\` — Footer\n\`${p}gconfig button <label>\` — Bouton\n\`${p}gconfig buttonstyle <style>\` — Style bouton\n\`${p}gconfig dmwinners on/off\` — DM gagnants\n\`${p}gconfig winannouncement on/off\` — Annonce\n\`${p}gconfig logchannel <#salon>\` — Salon logs\n\`${p}gconfig manager add/remove <id>\` — Managers\n\`${p}gconfig autodelete on/off [durée]\` — Auto-delete\n\`${p}gconfig lastchance on/off [seuil]\` — Last Chance\n\`${p}gconfig embed\` — Config embed\n\`${p}gconfig embedfield <champ> on/off\` — Champs\n\`${p}gconfig reset confirm\` — Réinitialiser`,
      },
      template: {
        title: `${p}gtemplate — Templates`,
        desc: `Gère les templates de giveaways.\n\n**Sous-commandes :**\n\`${p}gtemplate create <nom>\` — Créer (wizard)\n\`${p}gtemplate list\` — Lister\n\`${p}gtemplate use <nom> <durée> <gagnants> <#salon> <prix>\` — Utiliser\n\`${p}gtemplate delete <nom>\` — Supprimer\n\`${p}gtemplate info <nom>\` — Infos\n\`${p}gtemplate edit <nom> <champ> <valeur>\` — Modifier\n\`${p}gtemplate clone <nom> <nouveau_nom>\` — Cloner`,
      },
      blacklist: {
        title: `${p}gblacklist — Blacklist`,
        desc: `Gère la blacklist des utilisateurs.\n\n**Sous-commandes :**\n\`${p}gblacklist add <@user>\`\n\`${p}gblacklist remove <@user>\`\n\`${p}gblacklist list\`\n\`${p}gblacklist check <@user>\`\n\`${p}gblacklist clear confirm\``,
      },
      stats: {
        title: `${p}gstats — Statistiques`,
        desc: `Affiche les statistiques.\n\n**Syntaxe :**\n\`${p}gstats\` — Stats globales\n\`${p}gstats user <@user>\` — Stats d'un user\n\`${p}gstats server\` — Stats du serveur`,
      },
      setprefix: {
        title: `${p}setprefix — Changer le préfixe`,
        desc: `Change le préfixe du bot.\n\n**Syntaxe :** \`${p}setprefix <nouveau_préfixe>\`\n\n**Exemple :** \`${p}setprefix !\``,
      },
    };

    const h = helpTexts[cmd];
    if (!h) return replyError(message, `Commande \`${cmd}\` introuvable.`);
    return replyInfo(message, h.title, h.desc);
  }

  const embed = new EmbedBuilder()
    .setColor(DATA.config.defaultColor || '#7B1FA2')
    .setTitle("🎉 SORA — Aide Complète")
    .setDescription(`Préfixe actuel : \`${p}\`\nUtilisez \`${p}ghelp <commande>\` pour plus de détails.`)
    .addFields(
      {
        name: "🎉 Giveaways",
        value: [
          `\`${p}gstart\` — Lancer un giveaway rapide`,
          `\`${p}gcreate\` — Wizard de création interactif`,
          `\`${p}gend\` — Terminer un giveaway`,
          `\`${p}greroll\` — Reroll d'un giveaway`,
          `\`${p}gpause\` — Mettre en pause`,
          `\`${p}gresume\` — Reprendre`,
          `\`${p}gdelete\` — Supprimer`,
          `\`${p}gedit\` — Modifier un giveaway`,
          `\`${p}glist\` — Lister les giveaways actifs`,
          `\`${p}ginfo\` — Infos d'un giveaway`,
          `\`${p}gparticipants\` — Voir les participants`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "📋 Templates",
        value: [
          `\`${p}gtemplate create\` — Créer un template`,
          `\`${p}gtemplate list\` — Lister les templates`,
          `\`${p}gtemplate use\` — Utiliser un template`,
          `\`${p}gtemplate delete\` — Supprimer un template`,
          `\`${p}gtemplate edit\` — Modifier un template`,
          `\`${p}gtemplate clone\` — Cloner un template`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "⚙️ Configuration",
        value: [
          `\`${p}setprefix\` — Changer le préfixe`,
          `\`${p}gconfig\` — Voir/modifier la config`,
          `\`${p}gconfig color\` — Couleur par défaut`,
          `\`${p}gconfig footer\` — Footer par défaut`,
          `\`${p}gconfig button\` — Label du bouton`,
          `\`${p}gconfig dmwinners\` — DM aux gagnants`,
          `\`${p}gconfig logchannel\` — Salon de logs`,
          `\`${p}gconfig manager\` — Gérer les managers`,
          `\`${p}gconfig embed\` — Config de l'embed`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "⛔ Blacklist & 📊 Stats",
        value: [
          `\`${p}gblacklist add/remove/list\` — Blacklist`,
          `\`${p}gstats\` — Stats globales`,
          `\`${p}gstats user @user\` — Stats utilisateur`,
          `\`${p}gstats server\` — Stats du serveur`,
          `\`${p}gping\` — Latence du bot`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "⏱️ Format de durée",
        value: "`10s` · `30m` · `2h` · `1d` · `1w`",
        inline: false,
      }
    )
    .setFooter({ text: DATA.config.defaultFooter || "🎉 SORA" })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — GESTIONNAIRE D'INTERACTIONS (BOUTONS)
// ═══════════════════════════════════════════════════════════════════════════════

async function handleInteraction(interaction) {
  if (!interaction.isButton()) return;

  const { customId, user, member } = interaction;

  // ─── Bouton de participation ─────────────────────────────
  if (customId.startsWith("giveaway_participate_")) {

    const messageId = customId.split("giveaway_participate_")[1];

    DATA = loadData();

    console.log("CUSTOM ID =", customId);
    console.log("MESSAGE ID EXTRAIT =", messageId);
    console.log("GIVEAWAYS =", DATA.giveaways.map(g => g.messageId));

    if (!Array.isArray(DATA.giveaways)) {
      return interaction.reply({
        content: "❌ Erreur lors du chargement des giveaways.",
        ephemeral: true,
      });
    }

    const giveaway = DATA.giveaways.find(
      (g) => String(g.messageId).trim() === messageId
    );

    if (!giveaway) {
      return interaction.reply({
        content: "❌ Ce giveaway n'existe plus.",
        ephemeral: true,
      });
    }

    if (giveaway.ended || giveaway.deleted) {
      return interaction.reply({
        content: "❌ Ce giveaway est déjà terminé.",
        ephemeral: true,
      });
    }

    if (giveaway.paused) {
      return interaction.reply({
        content: "⏸️ Ce giveaway est actuellement en pause.",
        ephemeral: true,
      });
    }

    // blacklist
    if (isBlacklisted(user.id)) {
      return interaction.reply({
        content: "⛔ Tu es dans la blacklist.",
        ephemeral: true,
      });
    }

    if (giveaway.requirements && member) {
      const check = await checkRequirements(member, giveaway);
      if (!check.allowed) {
        return interaction.reply({
          content: `❌ Conditions non remplies:\n${check.reason}`,
          ephemeral: true,
        });
      }
    }

    const idx = DATA.giveaways.findIndex(
      (g) => String(g.messageId).trim() === messageId
    );

    if (!DATA.giveaways[idx].participants) {
      DATA.giveaways[idx].participants = [];
    }

    const alreadyIn = DATA.giveaways[idx].participants.includes(user.id);

    // ─── désinscription
    if (alreadyIn) {
      DATA.giveaways[idx].participants =
        DATA.giveaways[idx].participants.filter((id) => id !== user.id);

      saveData(DATA);
      await updateGiveawayMessage(DATA.giveaways[idx]);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setDescription(`😔 Désinscrit du giveaway **${giveaway.prize}**`)
        ],
        ephemeral: true,
      });
    }

    // ─── inscription
    DATA.giveaways[idx].participants.push(user.id);
    saveData(DATA);
    await updateGiveawayMessage(DATA.giveaways[idx]);

    const participantCount = DATA.giveaways[idx].participants.length;

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#1eff00")
          .setTitle("🎉 Participation confirmée !")
          .setDescription(
            `Tu participes au giveaway **${giveaway.prize}**`
          )
          .addFields(
            { name: "Fin", value: formatEndDate(giveaway.endsAt), inline: true },
            { name: "Gagnants", value: `${giveaway.winnerCount}`, inline: true },
            { name: "Participants", value: `${participantCount}`, inline: true }
          )
          .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // ─── Pagination ─────────────────────────────
  if (customId.startsWith("participants_")) {
    const parts = customId.split("_");
    const action = parts[1];
    let currentPage = parseInt(parts[2]);
    const messageId = parts[3];

    DATA = loadData();

    const giveaway = DATA.giveaways.find(
      (g) => String(g.messageId).trim() === messageId
    );

    if (!giveaway) {
      return interaction.reply({
        content: "❌ Giveaway introuvable.",
        ephemeral: true,
      });
    }

    const participants = giveaway.participants || [];
    const PAGE_SIZE = 20;
    const totalPages = Math.max(1, Math.ceil(participants.length / PAGE_SIZE));

    if (action === "prev") currentPage = Math.max(0, currentPage - 1);
    if (action === "next") currentPage = Math.min(totalPages - 1, currentPage + 1);

    const pageParticipants = participants.slice(
      currentPage * PAGE_SIZE,
      (currentPage + 1) * PAGE_SIZE
    );

    const pageLines = pageParticipants
      .map((id, i) => `${currentPage * PAGE_SIZE + i + 1}. <@${id}>`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(DATA.config.defaultColor || "#5865F2")
      .setTitle(`👥 Participants — ${giveaway.prize}`)
      .setDescription(pageLines || "Aucun participant")
      .setFooter({
        text: `${participants.length} participants — Page ${currentPage + 1}/${totalPages}`
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`participants_prev_${currentPage}_${messageId}`)
        .setLabel("◀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),

      new ButtonBuilder()
        .setCustomId(`participants_page_${currentPage}_${messageId}`)
        .setLabel(`${currentPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId(`participants_next_${currentPage}_${messageId}`)
        .setLabel("▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — ÉVÉNEMENTS DISCORD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once("ready", async () => {
  log("SUCCESS", `Bot connecté en tant que ${client.user.tag}`);
  log("INFO", `Sur ${client.guilds.cache.size} serveur(s)`);
  log("INFO", `Préfixe : ${DATA.config.prefix}`);

  // Statut
  client.user.setPresence({
    status: "online",
  });

  // Reprendre les giveaways actifs
  await resumeAllGiveaways();

  log("SUCCESS", "Bot prêt !");
});

// ─── messageCreate ────────────────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  DATA = loadData();
  const prefix = DATA.config.prefix;

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // ─── Cooldown global ─────────────────────────────────────────────────────
  const cd = checkCooldown(message.author.id, command, 2);
  if (cd > 0) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor("#FEE75C").setDescription(`⏳ Attends **${cd}s** avant de réutiliser cette commande.`)],
    }).then((m) => setTimeout(() => m.delete().catch(() => {}), 3000));
  }

  // ─── Routage des commandes ────────────────────────────────────────────────
  try {
    switch (command) {
      // Giveaways
      case "gstart":
        await cmdGstart(message, args);
        break;
      case "gcreate":
        await cmdGcreate(message);
        break;
      case "gend":
        await cmdGend(message, args);
        break;
      case "greroll":
        await cmdGreroll(message, args);
        break;
      case "gpause":
        await cmdGpause(message, args);
        break;
      case "gresume":
        await cmdGresume(message, args);
        break;
      case "gdelete":
        await cmdGdelete(message, args);
        break;
      case "gedit":
        await cmdGedit(message, args);
        break;
      case "glist":
        await cmdGlist(message, args);
        break;
      case "ginfo":
        await cmdGinfo(message, args);
        break;
      case "gparticipants":
      case "gparts":
        await cmdGparticipants(message, args);
        break;

      // Configuration
      case "setprefix":
        await cmdSetprefix(message, args);
        break;
      case "gconfig":
        await cmdGconfig(message, args);
        break;

      // Templates
      case "gtemplate":
      case "gtpl":
        await cmdGtemplate(message, args);
        break;

      // Blacklist
      case "gblacklist":
      case "gbl":
        await cmdGblacklist(message, args);
        break;

      // Stats & Aide
      case "gstats":
        await cmdGstats(message, args);
        break;
      case "gping":
        await cmdGping(message);
        break;
      case "ghelp":
        await cmdGhelp(message, args);
        break;

      // Alias bonus
      case "giveaway":
      case "g":
        // Alias vers ghelp
        await cmdGhelp(message, args);
        break;
    }
  } catch (e) {
    log("ERROR", `Erreur sur la commande ${command} : ${e.message}`);
    console.error(e);
    await replyError(message, `Une erreur est survenue : ${e.message}`).catch(() => {});
  }
});

// ─── interactionCreate ────────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (e) {
    log("ERROR", `Erreur interaction : ${e.message}`);
    console.error(e);
    if (interaction.replied || interaction.deferred) return;
    await interaction.reply({ content: "❌ Une erreur est survenue.", ephemeral: true }).catch(() => {});
  }
});

// ─── guildCreate ──────────────────────────────────────────────────────────────
client.on("guildCreate", (guild) => {
  log("INFO", `Nouveau serveur : ${guild.name} (${guild.id}) — ${guild.memberCount} membres`);
  client.user.setPresence({
    activities: [{ name: `${DATA.config.prefix}ghelp | 🎉 Giveaways | ${client.guilds.cache.size} serveurs`, type: 0 }],
    status: "online",
  });
});

// ─── guildDelete ──────────────────────────────────────────────────────────────
client.on("guildDelete", (guild) => {
  log("INFO", `Serveur retiré : ${guild.name} (${guild.id})`);
});

// ─── error ────────────────────────────────────────────────────────────────────
client.on("error", (e) => {
  log("ERROR", `Erreur client Discord : ${e.message}`);
});

// ─── warn ─────────────────────────────────────────────────────────────────────
client.on("warn", (info) => {
  log("WARN", info);
});

// ─── Gestion des rejets non capturés ─────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  log("ERROR", `Unhandled Rejection : ${reason}`);
  if (reason instanceof Error) console.error(reason);
});

process.on("uncaughtException", (err) => {
  log("ERROR", `Uncaught Exception : ${err.message}`);
  console.error(err);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — DÉMARRAGE DU BOT
// ═══════════════════════════════════════════════════════════════════════════════

(async () => {
  DATA = loadData();
  const token = DATA.config.token;

  if (!token || token === "TON_TOKEN_ICI") {
    log("ERROR", "Token manquant ! Éditez data.json et remplacez 'TON_TOKEN_ICI' par votre token Discord.");
    process.exit(1);
  }

  log("INFO", "Connexion à Discord...");

  try {
    await client.login(token);
  } catch (e) {
    log("ERROR", `Impossible de se connecter : ${e.message}`);
    process.exit(1);
  }
})();
