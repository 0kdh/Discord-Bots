const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env')
});

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const CLIENT_ID = '1505966547200508074';
const CLIENT_SECRET = 'Z_mJ_sbv6OcusHfa-ztiOZ0VDFFWZ8jt';
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║           DISCORD BOT - Ultra-Complet avec Discord.js v14                  ║
 * ║           Embeds | Annonces | Boutons | Tickets | Permissions               ║
 * ║           Auteur : BotMaster Pro | Version : 2.0.0                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Fonctionnalités :
 *  - Prefix dynamique
 *  - Embeds entièrement personnalisables
 *  - Annonces avec boutons interactifs
 *  - Système de tickets
 *  - Gestion des permissions / accès aux salons
 *  - Rôles automatiques et de réaction
 *  - Modération (warn, mute, ban, kick)
 *  - Commandes personnalisées
 *  - Sondages (polls)
 *  - Message de bienvenue
 *  - Logs persistantes dans data.json
 */

'use strict';

// ══════════════════════════════════════════════════════════════
//  IMPORTS & CONFIGURATION INITIALE
// ══════════════════════════════════════════════════════════════

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType,
  Collection,
  Events,
  ActivityType,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
  MessageFlags,
} = require('discord.js');

const fs   = require('fs');

// ══════════════════════════════════════════════════════════════
//  CHARGEMENT DES DONNÉES PERSISTANTES
// ══════════════════════════════════════════════════════════════

/** @type {string} Chemin absolu vers data.json */
const DATA_PATH = path.join(__dirname, 'data.json');

/**
 * Charge les données depuis data.json.
 * @returns {Object} L'objet de données complet
 */
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[ERREUR] Impossible de charger data.json :', err.message);
    process.exit(1);
  }
}

/**
 * Sauvegarde les données dans data.json.
 * @param {Object} data - L'objet de données à sauvegarder
 */
function saveData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ERREUR] Impossible de sauvegarder data.json :', err.message);
  }
}

/** Données globales chargées au démarrage */
let db = loadData();

// ══════════════════════════════════════════════════════════════
//  INITIALISATION DU CLIENT DISCORD
// ══════════════════════════════════════════════════════════════

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
});

const app = express();
const PORT = 3000;

// Stockage en mémoire pour l’instant
const authorizedUsers = new Map();

// Route callback OAuth2
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('Aucun code OAuth reçu');

  try {
    const data = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: '1505966547200508074',
        client_secret: 'Z_mJ_sbv6OcusHfa-ztiOZ0VDFFWZ8jt',
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:3000/oauth/callback'
      })
    }).then(r => r.json());

    const userData = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    }).then(r => r.json());

    authorizedUsers.set(userData.id, data.access_token);
    res.send(`Utilisateur ${userData.username} enregistré avec succès !`);
  } catch (err) {
    console.error(err);
    res.send('Erreur lors de l\'autorisation');
  }
});

app.listen(PORT, () => console.log(`OAuth server running on port ${PORT}`));

// ══════════════════════════════════════════════════════════════
//  UTILITAIRES GLOBAUX
// ══════════════════════════════════════════════════════════════

/**
 * Formate une couleur hexadécimale en nombre entier.
 * @param {string} hex - Couleur en format #RRGGBB ou RRGGBB
 * @returns {number} La couleur en entier
 */
function parseColor(hex) {
  if (!hex) return 0x5865F2;
  const clean = hex.replace('#', '');
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0x5865F2 : parsed;
}

/**
 * Vérifie si un membre a un rôle admin ou mod.
 * @param {GuildMember} member
 * @returns {boolean}
 */
function isAdminOrMod(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const adminRoles = db.config.adminRoles || [];
  const modRoles   = db.config.modRoles   || [];
  return member.roles.cache.some(r => adminRoles.includes(r.id) || modRoles.includes(r.id));
}

/**
 * Vérifie si un membre est admin.
 * @param {GuildMember} member
 * @returns {boolean}
 */
function isAdmin(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const adminRoles = db.config.adminRoles || [];
  return member.roles.cache.some(r => adminRoles.includes(r.id));
}

/**
 * Crée un embed d'erreur standardisé.
 * @param {string} desc - Description de l'erreur
 * @returns {EmbedBuilder}
 */
function errorEmbed(desc) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('❌ Erreur')
    .setDescription(desc)
    .setTimestamp();
}

/**
 * Crée un embed de succès standardisé.
 * @param {string} desc - Description du succès
 * @returns {EmbedBuilder}
 */
function successEmbed(desc) {
  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Succès')
    .setDescription(desc)
    .setTimestamp();
}

/**
 * Crée un embed d'information standardisé.
 * @param {string} title
 * @param {string} desc
 * @returns {EmbedBuilder}
 */
function infoEmbed(title, desc) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(desc)
    .setTimestamp();
}

/**
 * Remplace les variables dans un texte.
 * @param {string} text
 * @param {GuildMember} member
 * @returns {string}
 */
function replacePlaceholders(text, member) {
  if (!text) return '';
  return text
    .replace(/{user}/gi, member.toString())
    .replace(/{username}/gi, member.user.username)
    .replace(/{server}/gi, member.guild.name)
    .replace(/{membercount}/gi, member.guild.memberCount.toString())
    .replace(/{id}/gi, member.user.id);
}

/**
 * Construit un EmbedBuilder depuis un objet de données.
 * @param {Object} data - Les données de l'embed
 * @param {GuildMember|null} member - Membre pour les placeholders
 * @returns {EmbedBuilder}
 */
function buildEmbedFromData(data, member = null) {
  const embed = new EmbedBuilder();

  const r = (txt) => member ? replacePlaceholders(txt, member) : (txt || '');

  if (data.color)       embed.setColor(parseColor(data.color));
  if (data.title)       embed.setTitle(r(data.title));
  if (data.description) embed.setDescription(r(data.description));
  if (data.url)         embed.setURL(data.url);
  if (data.timestamp)   embed.setTimestamp(data.timestamp === 'now' ? new Date() : new Date(data.timestamp));

  if (data.author && data.author.name) {
    embed.setAuthor({
      name: r(data.author.name),
      iconURL: data.author.iconURL || undefined,
      url: data.author.url || undefined,
    });
  }

  if (data.thumbnail) embed.setThumbnail(data.thumbnail);
  if (data.image)     embed.setImage(data.image);

  if (data.footer && data.footer.text) {
    embed.setFooter({
      text: r(data.footer.text),
      iconURL: data.footer.iconURL || undefined,
    });
  }

  if (data.fields && Array.isArray(data.fields)) {
    const validFields = data.fields
      .filter(f => f.name && f.value)
      .map(f => ({
        name: r(f.name),
        value: r(f.value),
        inline: f.inline === true || f.inline === 'true',
      }));
    if (validFields.length > 0) embed.addFields(validFields);
  }

  return embed;
}

/**
 * Construit les ActionRow de boutons depuis les IDs.
 * @param {string[]} buttonIds
 * @returns {ActionRowBuilder[]}
 */
function buildButtonRows(buttonIds) {
  const rows = [];
  const chunks = [];

  // Discord limite : 5 boutons par ligne, 5 lignes max
  for (let i = 0; i < buttonIds.length; i += 5) {
    chunks.push(buttonIds.slice(i, i + 5));
  }

  for (const chunk of chunks.slice(0, 5)) {
    const row = new ActionRowBuilder();
    for (const btnId of chunk) {
      const btnData = db.buttons[btnId];
      if (!btnData) continue;

      const btn = new ButtonBuilder()
        .setCustomId(`btn_${btnId}`)
        .setLabel(btnData.label || 'Bouton')
        .setStyle(
          btnData.style === 'danger'    ? ButtonStyle.Danger  :
          btnData.style === 'success'   ? ButtonStyle.Success :
          btnData.style === 'secondary' ? ButtonStyle.Secondary :
                                          ButtonStyle.Primary
        );

      if (btnData.emoji) btn.setEmoji(btnData.emoji);
      if (btnData.disabled) btn.setDisabled(true);

      row.addComponents(btn);
    }
    if (row.components.length > 0) rows.push(row);
  }

  return rows;
}

// ══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DE COMMANDES (Collection)
// ══════════════════════════════════════════════════════════════

/** @type {Collection<string, Function>} */
const commands = new Collection();

/**
 * Enregistre une commande dans la collection.
 * @param {string} name
 * @param {Function} handler
 */
function registerCommand(name, handler) {
  commands.set(name.toLowerCase(), handler);
}

// ══════════════════════════════════════════════════════════════
//  COMMANDES : UTILITAIRES
// ══════════════════════════════════════════════════════════════

// ─── !ping ────────────────────────────────────────────────────
registerCommand('ping', async (message) => {
  const sent = await message.reply('🏓 Calcul du ping...');
  const latency = sent.createdTimestamp - message.createdTimestamp;
  await sent.edit({
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🏓 Pong !')
        .addFields(
          { name: '⏱️ Latence du bot', value: `${latency}ms`, inline: true },
          { name: '💓 API Discord', value: `${Math.round(client.ws.ping)}ms`, inline: true }
        )
        .setTimestamp()
    ]
  });
});

registerCommand('botinvite', async (message) => {
  const oauthURL = `https://discord.com/oauth2/authorize?client_id=TON_CLIENT_ID&scope=identify%20guilds%20guilds.join&response_type=code&redirect_uri=${encodeURIComponent('http://localhost:3000/oauth/callback')}`;

  const button = new ButtonBuilder()
    .setLabel('Autoriser le bot')
    .setStyle(ButtonStyle.Link)
    .setURL(oauthURL);

  const row = new ActionRowBuilder().addComponents(button);

  message.channel.send({ content: 'Clique ici pour autoriser le bot !', components: [row] });
});

registerCommand('adduser', async (message, args) => {
  if (!message.member.permissions.has('Administrator'))
    return message.reply('Permission refusée.');

  const userId = args[0];
  const guildId = args[1];

  if (!authorizedUsers.has(userId))
    return message.reply('Utilisateur non autorisé.');

  const accessToken = authorizedUsers.get(userId);

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${client.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ access_token: accessToken })
    }
  );

  if (res.ok) message.reply('✅ Utilisateur ajouté.');
  else message.reply('❌ Impossible de l\'ajouter.');
});

registerCommand('restore', async (message, args) => {
  if (!message.member.permissions.has('Administrator'))
    return message.reply('Permission refusée.');

  const guildId = args[0];
  if (!guildId) return message.reply('Usage: !restore <guild_id>');

  let success = 0;
  let failed = 0;

  for (const [userId, accessToken] of authorizedUsers) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bot ${client.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ access_token: accessToken })
        }
      );

      if (res.ok) success++;
      else failed++;
    } catch {
      failed++;
    }
  }

  message.reply(`✅ ${success} utilisateur(s) ajouté(s)\n❌ ${failed} échec(s)`);
});

// ─── !uptime ──────────────────────────────────────────────────
registerCommand('uptime', async (message) => {
  const seconds = Math.floor(process.uptime());
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  await message.reply({
    embeds: [
      infoEmbed('⏰ Uptime du bot',
        `Le bot est en ligne depuis :\n**${d}j ${h}h ${m}m ${s}s**`
      )
    ]
  });
});

// ─── !botinfo ─────────────────────────────────────────────────
registerCommand('botinfo', async (message) => {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 Informations sur le bot')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: '📛 Nom', value: client.user.tag, inline: true },
      { name: '🆔 ID', value: client.user.id, inline: true },
      { name: '📅 Créé le', value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:D>`, inline: true },
      { name: '🌐 Serveurs', value: `${client.guilds.cache.size}`, inline: true },
      { name: '👥 Utilisateurs', value: `${client.users.cache.size}`, inline: true },
      { name: '📦 Discord.js', value: require('discord.js').version, inline: true },
      { name: '⚙️ Node.js', value: process.version, inline: true },
      { name: '💾 RAM', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
      { name: '🏷️ Préfixe', value: db.config.prefix, inline: true }
    )
    .setTimestamp();
  await message.reply({ embeds: [embed] });
});

// ─── !serverinfo ──────────────────────────────────────────────
registerCommand('serverinfo', async (message) => {
  const guild = message.guild;
  if (!guild) return;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📊 Informations sur ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '🆔 ID', value: guild.id, inline: true },
      { name: '👑 Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
      { name: '📅 Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
      { name: '📢 Salons', value: `${guild.channels.cache.size}`, inline: true },
      { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
      { name: '🎭 Rôles', value: `${guild.roles.cache.size}`, inline: true },
      { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
      { name: '🔒 Vérification', value: guild.verificationLevel.toString(), inline: true }
    )
    .setTimestamp();
  await message.reply({ embeds: [embed] });
});

// ─── !userinfo ────────────────────────────────────────────────
registerCommand('userinfo', async (message, args) => {
  let target = message.mentions.members.first() || message.member;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`👤 Informations sur ${target.user.tag}`)
    .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '🆔 ID', value: target.user.id, inline: true },
      { name: '📛 Pseudo', value: target.displayName, inline: true },
      { name: '🤖 Bot', value: target.user.bot ? 'Oui' : 'Non', inline: true },
      { name: '📅 Compte créé', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:D>`, inline: true },
      { name: '📥 A rejoint le', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`, inline: true },
      { name: '🎭 Rôles', value: target.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).join(', ') || 'Aucun', inline: false }
    )
    .setTimestamp();
  await message.reply({ embeds: [embed] });
});

// ─── !avatar ──────────────────────────────────────────────────
registerCommand('avatar', async (message) => {
  const target = message.mentions.users.first() || message.author;
  const url = target.displayAvatarURL({ dynamic: true, size: 1024 });
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🖼️ Avatar de ${target.username}`)
    .setImage(url)
    .setURL(url)
    .setTimestamp();
  await message.reply({ embeds: [embed] });
});

// ─── !help ────────────────────────────────────────────────────
registerCommand('help', async (message, args) => {
  const prefix = db.config.prefix;
  const category = args[0] ? args[0].toLowerCase() : null;

  const categories = {
    utilitaires: {
      emoji: '🔧',
      commands: [
        ['ping', 'Affiche la latence du bot'],
        ['uptime', 'Durée en ligne du bot'],
        ['botinfo', 'Infos sur le bot'],
        ['serverinfo', 'Infos sur le serveur'],
        ['userinfo [@user]', 'Infos sur un utilisateur'],
        ['avatar [@user]', 'Affiche l\'avatar d\'un utilisateur'],
        ['help [catégorie]', 'Affiche l\'aide'],
      ]
    },
    config: { 
      emoji: '⚙️',
      commands: [
        ['setprefix <prefix>', 'Change le préfixe du bot'],
        ['setlogchannel <#salon>', 'Définit le salon de logs'],
        ['setadminrole <@role>', 'Ajoute un rôle admin'],
        ['setmodrole <@role>', 'Ajoute un rôle modérateur'],
        ['autorole <@role>', 'Définit le rôle auto à l\'arrivée'],
        ['autorole disable', 'Désactive le rôle automatique'],
        ['setwelcome', 'Configure le message de bienvenue'],
        ['welcometest', 'Teste le message de bienvenue'],
      ]
    },
    embeds: {
      emoji: '📝',
      commands: [
        ['embed create <id>', 'Crée un nouvel embed'],
        ['embed title <id> <titre>', 'Définit le titre'],
        ['embed description <id> <texte>', 'Définit la description'],
        ['embed color <id> <couleur>', 'Définit la couleur (#HEX)'],
        ['embed image <id> <url>', 'Définit l\'image principale'],
        ['embed thumbnail <id> <url>', 'Définit la miniature'],
        ['embed footer <id> <texte>', 'Définit le footer'],
        ['embed footericon <id> <url>', 'Icône du footer'],
        ['embed author <id> <nom>', 'Définit l\'auteur'],
        ['embed authoricon <id> <url>', 'Icône de l\'auteur'],
        ['embed authorurl <id> <url>', 'URL de l\'auteur'],
        ['embed url <id> <url>', 'URL du titre'],
        ['embed timestamp <id>', 'Active/désactive le timestamp'],
        ['embed addfield <id> <nom> | <valeur>', 'Ajoute un champ'],
        ['embed addinlinefield <id> <nom> | <valeur>', 'Ajoute un champ inline'],
        ['embed clearfields <id>', 'Supprime tous les champs'],
        ['embed preview <id>', 'Prévisualise l\'embed'],
        ['embed send <id> [#salon]', 'Envoie l\'embed'],
        ['embed list', 'Liste tous les embeds'],
        ['embed delete <id>', 'Supprime un embed'],
        ['embed clone <id> <nouvel_id>', 'Clone un embed'],
      ]
    },
    annonces: {
      emoji: '📢',
      commands: [
        ['announce create <id>', 'Crée une annonce'],
        ['announce title <id> <titre>', 'Titre de l\'annonce'],
        ['announce description <id> <texte>', 'Description'],
        ['announce color <id> <couleur>', 'Couleur de l\'annonce'],
        ['announce image <id> <url>', 'Image de l\'annonce'],
        ['announce thumbnail <id> <url>', 'Miniature'],
        ['announce footer <id> <texte>', 'Footer'],
        ['announce timestamp <id>', 'Active le timestamp'],
        ['announce addbutton <id> <btn_id>', 'Ajoute un bouton'],
        ['announce removebutton <id> <btn_id>', 'Retire un bouton'],
        ['announce content <id> <texte>', 'Texte brut avant l\'embed'],
        ['announce send <id> [#salon]', 'Envoie l\'annonce'],
        ['announce edit <id> <msg_id> [#salon]', 'Modifie une annonce'],
        ['announce preview <id>', 'Prévisualise'],
        ['announce list', 'Liste les annonces'],
        ['announce delete <id>', 'Supprime une annonce'],
      ]
    },
    boutons: {
      emoji: '🔘',
      commands: [
        ['button create <id> <label>', 'Crée un bouton'],
        ['button label <id> <texte>', 'Modifie le label'],
        ['button style <id> <primary|secondary|success|danger>', 'Style du bouton'],
        ['button emoji <id> <emoji>', 'Emoji du bouton'],
        ['button action <id> <type>', 'Type d\'action (ticket|access|invite|role|message|dm)'],
        ['button settarget <id> <valeur>', 'Cible de l\'action'],
        ['button setmessage <id> <texte>', 'Message de réponse'],
        ['button setembed <id> <embed_id>', 'Embed de réponse'],
        ['button disable <id>', 'Désactive un bouton'],
        ['button enable <id>', 'Active un bouton'],
        ['button list', 'Liste tous les boutons'],
        ['button delete <id>', 'Supprime un bouton'],
        ['button info <id>', 'Infos sur un bouton'],
      ]
    },
    tickets: {
      emoji: '🎫',
      commands: [
        ['ticket setup', 'Configure le système de tickets'],
        ['ticket setcategory <#catégorie>', 'Définit la catégorie'],
        ['ticket setlog <#salon>', 'Salon de logs des tickets'],
        ['ticket setsupport <@role>', 'Rôle de support'],
        ['ticket close [raison]', 'Ferme le ticket actuel'],
        ['ticket add <@user>', 'Ajoute un utilisateur au ticket'],
        ['ticket remove <@user>', 'Retire un utilisateur'],
        ['ticket rename <nom>', 'Renomme le ticket'],
        ['ticket list', 'Liste les tickets ouverts'],
        ['ticket panel [#salon]', 'Crée un panneau de tickets'],
      ]
    },
    access: {
      emoji: '🔑',
      commands: [
        ['access create <id> <#salon>', 'Crée un accès à un salon'],
        ['access setrole <id> <@role>', 'Rôle donné/retiré à l\'accès'],
        ['access settype <id> <give|toggle>', 'Type d\'accès'],
        ['access setlabel <id> <texte>', 'Label du bouton d\'accès'],
        ['access list', 'Liste les accès'],
        ['access delete <id>', 'Supprime un accès'],
      ]
    },
    moderation: {
      emoji: '🔨',
      commands: [
        ['warn <@user> [raison]', 'Avertit un utilisateur'],
        ['warnings <@user>', 'Affiche les warnings'],
        ['clearwarns <@user>', 'Efface les warnings'],
        ['mute <@user> [durée] [raison]', 'Mute un utilisateur'],
        ['unmute <@user>', 'Démute un utilisateur'],
        ['kick <@user> [raison]', 'Expulse un utilisateur'],
        ['ban <@user> [raison]', 'Bannit un utilisateur'],
        ['unban <user_id>', 'Débannit un utilisateur'],
        ['purge <nombre>', 'Supprime des messages'],
        ['slowmode <secondes>', 'Définit le slowmode'],
        ['lock [#salon]', 'Verrouille un salon'],
        ['unlock [#salon]', 'Déverrouille un salon'],
      ]
    },
    roles: {
      emoji: '🎭',
      commands: [
        ['role add <@user> <@role>', 'Donne un rôle'],
        ['role remove <@user> <@role>', 'Retire un rôle'],
        ['role create <nom> [couleur]', 'Crée un rôle'],
        ['role delete <@role>', 'Supprime un rôle'],
        ['role color <@role> <couleur>', 'Change la couleur'],
        ['role info <@role>', 'Infos sur un rôle'],
        ['role members <@role>', 'Membres avec ce rôle'],
        ['reactionrole set <msg_id> <emoji> <@role>', 'Rôle de réaction'],
        ['reactionrole remove <msg_id> <emoji>', 'Retire un rôle de réaction'],
      ]
    },
    custom: {
      emoji: '⚡',
      commands: [
        ['cc create <nom> <réponse>', 'Crée une commande personnalisée'],
        ['cc edit <nom> <nouvelle_réponse>', 'Modifie une CC'],
        ['cc delete <nom>', 'Supprime une CC'],
        ['cc list', 'Liste les CC'],
        ['cc info <nom>', 'Infos sur une CC'],
        ['cc setembed <nom> <embed_id>', 'Embed pour une CC'],
      ]
    },
    sondages: {
      emoji: '📊',
      commands: [
        ['poll create <question>', 'Crée un sondage oui/non'],
        ['poll multichoice <question> | <opt1> | <opt2> ...', 'Sondage multi-choix'],
        ['poll end <msg_id>', 'Termine un sondage'],
      ]
    }
  };

  if (category && categories[category]) {
    const cat = categories[category];
    const desc = cat.commands.map(([cmd, desc]) => `\`${prefix}${cmd}\` — ${desc}`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${cat.emoji} Aide — ${category.charAt(0).toUpperCase() + category.slice(1)}`)
      .setDescription(desc)
      .setFooter({ text: `Utilisez ${prefix}help pour voir toutes les catégories` })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // Menu principal
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📚 Aide — Menu Principal')
    .setDescription(`Préfixe actuel : \`${prefix}\`\nUtilisez \`${prefix}help <catégorie>\` pour plus de détails.`)
    .addFields(
      Object.entries(categories).map(([key, val]) => ({
        name: `${val.emoji} ${key.charAt(0).toUpperCase() + key.slice(1)}`,
        value: `\`${prefix}help ${key}\``,
        inline: true,
      }))
    )
    .setFooter({ text: `${commands.size} commandes disponibles` })
    .setTimestamp();
  await message.reply({ embeds: [embed] });
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : CONFIGURATION
// ══════════════════════════════════════════════════════════════

// ─── !setprefix ───────────────────────────────────────────────
registerCommand('setprefix', async (message, args) => {
  if (!isAdmin(message.member)) {
    return message.reply({ embeds: [errorEmbed('Vous devez être administrateur pour changer le préfixe.')] });
  }
  if (!args[0]) {
    return message.reply({ embeds: [errorEmbed('Usage : `!setprefix <nouveau_prefix>`')] });
  }
  const newPrefix = args[0].trim();
  if (newPrefix.length > 5) {
    return message.reply({ embeds: [errorEmbed('Le préfixe ne peut pas dépasser 5 caractères.')] });
  }
  db.config.prefix = newPrefix;
  saveData(db);
  await message.reply({ embeds: [successEmbed(`Le préfixe a été changé en \`${newPrefix}\``)] });
});

// ─── !setlogchannel ───────────────────────────────────────────
registerCommand('setlogchannel', async (message, args) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const channel = message.mentions.channels.first();
  if (!channel) return message.reply({ embeds: [errorEmbed('Mentionnez un salon valide.')] });
  db.config.logChannelId = channel.id;
  saveData(db);
  await message.reply({ embeds: [successEmbed(`Salon de logs défini : ${channel}`)] });
});

// ─── !setadminrole ────────────────────────────────────────────
registerCommand('setadminrole', async (message, args) => {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  }
  const role = message.mentions.roles.first();
  if (!role) return message.reply({ embeds: [errorEmbed('Mentionnez un rôle valide.')] });
  if (!db.config.adminRoles) db.config.adminRoles = [];
  if (!db.config.adminRoles.includes(role.id)) {
    db.config.adminRoles.push(role.id);
    saveData(db);
    await message.reply({ embeds: [successEmbed(`Rôle admin ajouté : ${role}`)] });
  } else {
    db.config.adminRoles = db.config.adminRoles.filter(r => r !== role.id);
    saveData(db);
    await message.reply({ embeds: [successEmbed(`Rôle admin retiré : ${role}`)] });
  }
});

// ─── !setmodrole ──────────────────────────────────────────────
registerCommand('setmodrole', async (message, args) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const role = message.mentions.roles.first();
  if (!role) return message.reply({ embeds: [errorEmbed('Mentionnez un rôle valide.')] });
  if (!db.config.modRoles) db.config.modRoles = [];
  if (!db.config.modRoles.includes(role.id)) {
    db.config.modRoles.push(role.id);
    saveData(db);
    await message.reply({ embeds: [successEmbed(`Rôle modérateur ajouté : ${role}`)] });
  } else {
    db.config.modRoles = db.config.modRoles.filter(r => r !== role.id);
    saveData(db);
    await message.reply({ embeds: [successEmbed(`Rôle modérateur retiré : ${role}`)] });
  }
});

// ─── !autorole ────────────────────────────────────────────────
registerCommand('autorole', async (message, args) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  if (args[0] === 'disable') {
    db.autoRole.enabled = false;
    saveData(db);
    return message.reply({ embeds: [successEmbed('Rôle automatique désactivé.')] });
  }
  const role = message.mentions.roles.first();
  if (!role) return message.reply({ embeds: [errorEmbed('Mentionnez un rôle valide.')] });
  db.autoRole.enabled = true;
  db.autoRole.roleId = role.id;
  saveData(db);
  await message.reply({ embeds: [successEmbed(`Rôle automatique défini : ${role}`)] });
});

// ─── !setwelcome ──────────────────────────────────────────────
registerCommand('setwelcome', async (message, args) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const sub = args[0];
  const rest = args.slice(1).join(' ');

  switch (sub) {
    case 'channel': {
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply({ embeds: [errorEmbed('Mentionnez un salon.')] });
      db.welcomeConfig.channelId = ch.id;
      db.welcomeConfig.enabled = true;
      saveData(db);
      return message.reply({ embeds: [successEmbed(`Salon de bienvenue : ${ch}`)] });
    }
    case 'message': {
      if (!rest) return message.reply({ embeds: [errorEmbed('Fournissez un message. Variables : {user}, {username}, {server}, {membercount}')] });
      db.welcomeConfig.message = rest;
      saveData(db);
      return message.reply({ embeds: [successEmbed(`Message de bienvenue défini.\nVariables disponibles : \`{user}\`, \`{username}\`, \`{server}\`, \`{membercount}\``)] });
    }
    case 'title': {
      db.welcomeConfig.embedTitle = rest;
      db.welcomeConfig.embedEnabled = true;
      saveData(db);
      return message.reply({ embeds: [successEmbed(`Titre de l'embed de bienvenue défini.`)] });
    }
    case 'description': {
      db.welcomeConfig.embedDescription = rest;
      db.welcomeConfig.embedEnabled = true;
      saveData(db);
      return message.reply({ embeds: [successEmbed(`Description de l'embed de bienvenue définie.`)] });
    }
    case 'color': {
      db.welcomeConfig.embedColor = rest;
      db.welcomeConfig.embedEnabled = true;
      saveData(db);
      return message.reply({ embeds: [successEmbed(`Couleur de l'embed de bienvenue définie.`)] });
    }
    case 'image': {
      db.welcomeConfig.embedImage = rest;
      saveData(db);
      return message.reply({ embeds: [successEmbed(`Image de bienvenue définie.`)] });
    }
    case 'thumbnail': {
      db.welcomeConfig.embedThumbnail = rest;
      saveData(db);
      return message.reply({ embeds: [successEmbed(`Miniature de bienvenue définie.`)] });
    }
    case 'embedon': {
      db.welcomeConfig.embedEnabled = true;
      saveData(db);
      return message.reply({ embeds: [successEmbed('Embed de bienvenue activé.')] });
    }
    case 'embedoff': {
      db.welcomeConfig.embedEnabled = false;
      saveData(db);
      return message.reply({ embeds: [successEmbed('Embed de bienvenue désactivé (message texte uniquement).')] });
    }
    case 'disable': {
      db.welcomeConfig.enabled = false;
      saveData(db);
      return message.reply({ embeds: [successEmbed('Système de bienvenue désactivé.')] });
    }
    case 'status': {
      const cfg = db.welcomeConfig;
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('👋 Configuration de bienvenue')
            .addFields(
              { name: 'Activé', value: cfg.enabled ? '✅' : '❌', inline: true },
              { name: 'Salon', value: cfg.channelId ? `<#${cfg.channelId}>` : 'Non défini', inline: true },
              { name: 'Embed', value: cfg.embedEnabled ? '✅' : '❌', inline: true },
              { name: 'Message', value: cfg.message || 'Défaut', inline: false },
              { name: 'Titre embed', value: cfg.embedTitle || 'Non défini', inline: true },
              { name: 'Couleur embed', value: cfg.embedColor || '#5865F2', inline: true }
            )
            .setTimestamp()
        ]
      });
    }
    default:
      return message.reply({
        embeds: [infoEmbed('⚙️ Commande setwelcome',
          `Usage :\n` +
          `\`setwelcome channel #salon\` — Définit le salon\n` +
          `\`setwelcome message <texte>\` — Message texte\n` +
          `\`setwelcome title <texte>\` — Titre de l'embed\n` +
          `\`setwelcome description <texte>\` — Description\n` +
          `\`setwelcome color <#hex>\` — Couleur\n` +
          `\`setwelcome image <url>\` — Image\n` +
          `\`setwelcome thumbnail <url>\` — Miniature\n` +
          `\`setwelcome embedon/embedoff\` — Active/désactive l'embed\n` +
          `\`setwelcome disable\` — Désactive\n` +
          `\`setwelcome status\` — Affiche la config`
        )]
      });
  }
});

// ─── !welcometest ─────────────────────────────────────────────
registerCommand('welcometest', async (message) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  await handleWelcome(message.member, message.channel);
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : EMBEDS
// ══════════════════════════════════════════════════════════════

registerCommand('embed', async (message, args) => {
  if (!isAdminOrMod(message.member)) {
    return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  }

  const sub = args[0];
  const id  = args[1];
  const rest = message.content.split(' ').slice(3).join(' ');
  const prefix = db.config.prefix;

  switch (sub) {

    // ── Créer un embed ────────────────────────────────────────
    case 'create': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed create <id>\``)] });
      if (db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Un embed avec l'ID \`${id}\` existe déjà.`)] });
      db.embeds[id] = {
        title: 'Nouvel Embed',
        description: 'Description de l\'embed.',
        color: '#5865F2',
        timestamp: null,
        fields: [],
        author: {},
        footer: {},
        image: null,
        thumbnail: null,
        url: null,
        createdAt: new Date().toISOString(),
        createdBy: message.author.id,
      };
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Embed \`${id}\` créé avec succès !\nUtilisez \`${prefix}embed preview ${id}\` pour le prévisualiser.`)] });
      break;
    }

    // ── Titre ─────────────────────────────────────────────────
    case 'title': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed title <id> <titre>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      db.embeds[id].title = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Titre de \`${id}\` défini : **${rest}**`)] });
      break;
    }

    // ── Description ───────────────────────────────────────────
    case 'description': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed description <id> <texte>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      db.embeds[id].description = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Description de \`${id}\` mise à jour.`)] });
      break;
    }

    // ── Couleur ───────────────────────────────────────────────
    case 'color': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed color <id> <#HEX>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      const colorHex = rest.startsWith('#') ? rest : `#${rest}`;
      db.embeds[id].color = colorHex;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Couleur de \`${id}\` définie : \`${colorHex}\``)] });
      break;
    }

    // ── Image ─────────────────────────────────────────────────
    case 'image': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed image <id> <url>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      db.embeds[id].image = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Image de \`${id}\` définie.`)] });
      break;
    }

    // ── Thumbnail ─────────────────────────────────────────────
    case 'thumbnail': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed thumbnail <id> <url>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      db.embeds[id].thumbnail = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Miniature de \`${id}\` définie.`)] });
      break;
    }

    // ── Footer ────────────────────────────────────────────────
    case 'footer': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed footer <id> <texte>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      if (!db.embeds[id].footer) db.embeds[id].footer = {};
      db.embeds[id].footer.text = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Footer de \`${id}\` défini.`)] });
      break;
    }

    // ── Footer icon ───────────────────────────────────────────
    case 'footericon': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed footericon <id> <url>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      if (!db.embeds[id].footer) db.embeds[id].footer = {};
      db.embeds[id].footer.iconURL = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Icône du footer de \`${id}\` définie.`)] });
      break;
    }

    // ── Author ────────────────────────────────────────────────
    case 'author': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed author <id> <nom>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      if (!db.embeds[id].author) db.embeds[id].author = {};
      db.embeds[id].author.name = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Auteur de \`${id}\` défini : **${rest}**`)] });
      break;
    }

    // ── Author icon ───────────────────────────────────────────
    case 'authoricon': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed authoricon <id> <url>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      if (!db.embeds[id].author) db.embeds[id].author = {};
      db.embeds[id].author.iconURL = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Icône de l'auteur de \`${id}\` définie.`)] });
      break;
    }

    // ── Author URL ────────────────────────────────────────────
    case 'authorurl': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed authorurl <id> <url>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      if (!db.embeds[id].author) db.embeds[id].author = {};
      db.embeds[id].author.url = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`URL de l'auteur de \`${id}\` définie.`)] });
      break;
    }

    // ── URL du titre ──────────────────────────────────────────
    case 'url': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed url <id> <url>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      db.embeds[id].url = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`URL du titre de \`${id}\` définie.`)] });
      break;
    }

    // ── Timestamp ─────────────────────────────────────────────
    case 'timestamp': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed timestamp <id>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      db.embeds[id].timestamp = db.embeds[id].timestamp ? null : 'now';
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Timestamp de \`${id}\` : ${db.embeds[id].timestamp ? '✅ activé' : '❌ désactivé'}`)] });
      break;
    }

    // ── Ajouter un champ ──────────────────────────────────────
    case 'addfield':
    case 'addinlinefield': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed addfield <id> <nom> | <valeur>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      const parts = rest.split('|');
      if (parts.length < 2) return message.reply({ embeds: [errorEmbed('Séparez le nom et la valeur avec `|`')] });
      const fieldName  = parts[0].trim();
      const fieldValue = parts.slice(1).join('|').trim();
      if (!db.embeds[id].fields) db.embeds[id].fields = [];
      if (db.embeds[id].fields.length >= 25) {
        return message.reply({ embeds: [errorEmbed('Maximum 25 champs par embed.')] });
      }
      db.embeds[id].fields.push({
        name: fieldName,
        value: fieldValue,
        inline: sub === 'addinlinefield',
      });
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Champ ajouté à \`${id}\` : **${fieldName}**`)] });
      break;
    }

    // ── Supprimer tous les champs ─────────────────────────────
    case 'clearfields': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed clearfields <id>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      db.embeds[id].fields = [];
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Champs de \`${id}\` supprimés.`)] });
      break;
    }

    // ── Prévisualisation ──────────────────────────────────────
    case 'preview': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed preview <id>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      const embed = buildEmbedFromData(db.embeds[id]);
      await message.reply({
        content: `📋 Prévisualisation de l'embed \`${id}\` :`,
        embeds: [embed]
      });
      break;
    }

    // ── Envoyer ───────────────────────────────────────────────
    case 'send': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed send <id> [#salon]\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      const target = message.mentions.channels.first() || message.channel;
      const embed = buildEmbedFromData(db.embeds[id]);
      await target.send({ embeds: [embed] });
      if (target.id !== message.channel.id) {
        await message.reply({ embeds: [successEmbed(`Embed \`${id}\` envoyé dans ${target}.`)] });
      }
      break;
    }

    // ── Liste ─────────────────────────────────────────────────
    case 'list': {
      const ids = Object.keys(db.embeds);
      if (ids.length === 0) {
        return message.reply({ embeds: [infoEmbed('📝 Embeds', 'Aucun embed créé.')] });
      }
      const desc = ids.map(k => {
        const e = db.embeds[k];
        return `**\`${k}\`** — ${e.title || 'Sans titre'} (par <@${e.createdBy || 'inconnu'}>)`;
      }).join('\n');
      await message.reply({ embeds: [infoEmbed(`📝 Embeds (${ids.length})`, desc)] });
      break;
    }

    // ── Supprimer ─────────────────────────────────────────────
    case 'delete': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed delete <id>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      delete db.embeds[id];
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Embed \`${id}\` supprimé.`)] });
      break;
    }

    // ── Cloner ────────────────────────────────────────────────
    case 'clone': {
      const newId = args[2];
      if (!id || !newId) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed clone <id> <nouvel_id>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      if (db.embeds[newId]) return message.reply({ embeds: [errorEmbed(`L'ID \`${newId}\` existe déjà.`)] });
      db.embeds[newId] = JSON.parse(JSON.stringify(db.embeds[id]));
      db.embeds[newId].createdAt = new Date().toISOString();
      db.embeds[newId].createdBy = message.author.id;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Embed \`${id}\` cloné en \`${newId}\`.`)] });
      break;
    }

    // ── Info ──────────────────────────────────────────────────
    case 'info': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}embed info <id>\``)] });
      if (!db.embeds[id]) return message.reply({ embeds: [errorEmbed(`Embed \`${id}\` introuvable.`)] });
      const e = db.embeds[id];
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(parseColor(e.color))
            .setTitle(`📝 Info — Embed \`${id}\``)
            .addFields(
              { name: 'Titre', value: e.title || 'Non défini', inline: true },
              { name: 'Couleur', value: e.color || '#5865F2', inline: true },
              { name: 'Champs', value: `${(e.fields || []).length}`, inline: true },
              { name: 'Image', value: e.image ? '✅' : '❌', inline: true },
              { name: 'Thumbnail', value: e.thumbnail ? '✅' : '❌', inline: true },
              { name: 'Timestamp', value: e.timestamp ? '✅' : '❌', inline: true },
              { name: 'Auteur', value: e.author?.name || 'Non défini', inline: true },
              { name: 'Footer', value: e.footer?.text || 'Non défini', inline: true },
              { name: 'Créé par', value: e.createdBy ? `<@${e.createdBy}>` : 'Inconnu', inline: true },
            )
            .setTimestamp()
        ]
      });
      break;
    }

    default:
      await message.reply({
        embeds: [infoEmbed('📝 Commande embed',
          `Sous-commandes disponibles :\n` +
          `\`create\`, \`title\`, \`description\`, \`color\`, \`image\`, \`thumbnail\`, \`footer\`, \`footericon\`, \`author\`, \`authoricon\`, \`authorurl\`, \`url\`, \`timestamp\`, \`addfield\`, \`addinlinefield\`, \`clearfields\`, \`preview\`, \`send\`, \`list\`, \`delete\`, \`clone\`, \`info\`\n\nUtilisez \`${prefix}help embeds\` pour plus de détails.`
        )]
      });
  }
});

registerCommand('say', async (message) => {
  if (!isAdminOrMod(message.member)) {
    return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  }

  // 🔥 Récupère tous les salons mentionnés
  const mentionedChannels = message.mentions.channels;

  // 🧠 Si aucun salon mentionné → salon actuel
  const channels = mentionedChannels.size > 0
    ? [...mentionedChannels.values()]
    : [message.channel];

  // 🔥 Retire la commande et garde le texte brut
  let text = message.content
    .replace(/^!say/i, '')
    .trim();

  // 🔥 enlève toutes les mentions de salons du début du message
  text = text.replace(/(<#\d+>\s*)+/g, '').trim();

  if (!text) {
    return message.reply({
      embeds: [errorEmbed('❌ Fournis un message à envoyer.')]
    });
  }

  try {
    // 🔥 envoie dans tous les salons demandés
    for (const channel of channels) {
      await channel.send({
        content: text,
        allowedMentions: {
          parse: ['users', 'roles']
        }
      });
    }

    return message.reply({
      embeds: [
        successEmbed(
          `Message envoyé dans **${channels.map(c => c.name).join(', ')}**`
        )
      ]
    });

  } catch (err) {
    console.error(err);
    return message.reply({
      embeds: [errorEmbed("❌ Impossible d'envoyer le message.")]
    });
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : ANNONCES
// ══════════════════════════════════════════════════════════════

registerCommand('announce', async (message, args) => {
  if (!isAdminOrMod(message.member)) {
    return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  }

  const sub  = args[0];
  const id   = args[1];
  const rest = message.content.split(' ').slice(3).join(' ');
  const prefix = db.config.prefix;

  switch (sub) {

    case 'create': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce create <id>\``)] });
      if (db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` existe déjà.`)] });
      db.announcements[id] = {
        title: 'Nouvelle Annonce',
        description: 'Contenu de l\'annonce.',
        color: '#5865F2',
        content: null,
        timestamp: 'now',
        fields: [],
        author: {},
        footer: { text: 'Annonce officielle' },
        image: null,
        thumbnail: null,
        buttons: [],
        createdAt: new Date().toISOString(),
        createdBy: message.author.id,
      };
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Annonce \`${id}\` créée !`)] });
      break;
    }

    case 'title': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce title <id> <titre>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].title = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Titre de l'annonce \`${id}\` défini.`)] });
      break;
    }

    case 'description': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce description <id> <texte>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].description = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Description de l'annonce \`${id}\` définie.`)] });
      break;
    }

    case 'color': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce color <id> <#HEX>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].color = rest.startsWith('#') ? rest : `#${rest}`;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Couleur de l'annonce \`${id}\` définie.`)] });
      break;
    }

    case 'image': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce image <id> <url>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].image = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Image de l'annonce \`${id}\` définie.`)] });
      break;
    }

    case 'thumbnail': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce thumbnail <id> <url>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].thumbnail = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Miniature de l'annonce \`${id}\` définie.`)] });
      break;
    }

case 'footer': {
  if (!id || !rest)
    return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce footer <id> <texte>\``)] });

  if (!db.announcements[id])
    return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });

  if (!db.announcements[id].footer)
    db.announcements[id].footer = {};

  db.announcements[id].footer.text = rest;

  saveData(db);

  await message.reply({
    embeds: [successEmbed(`Footer de \`${id}\` défini.`)]
  });
  break;
}

    case 'timestamp': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce timestamp <id>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].timestamp = db.announcements[id].timestamp ? null : 'now';
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Timestamp de l'annonce \`${id}\` : ${db.announcements[id].timestamp ? '✅' : '❌'}`)] });
      break;
    }

    case 'content': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce content <id> <texte>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].content = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Contenu texte de l'annonce \`${id}\` défini.`)] });
      break;
    }

    case 'addfield': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce addfield <id> <nom> | <valeur>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      const parts = rest.split('|');
      if (parts.length < 2) return message.reply({ embeds: [errorEmbed('Séparez nom et valeur avec `|`')] });
      if (!db.announcements[id].fields) db.announcements[id].fields = [];
      db.announcements[id].fields.push({
        name: parts[0].trim(),
        value: parts.slice(1).join('|').trim(),
        inline: false,
      });
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Champ ajouté à l'annonce \`${id}\`.`)] });
      break;
    }

    case 'addbutton': {
      const btnId = args[2];
      if (!id || !btnId) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce addbutton <id> <btn_id>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      if (!db.buttons[btnId]) return message.reply({ embeds: [errorEmbed(`Bouton \`${btnId}\` introuvable.`)] });
      if (!db.announcements[id].buttons) db.announcements[id].buttons = [];
      if (!db.announcements[id].buttons.includes(btnId)) {
        db.announcements[id].buttons.push(btnId);
        saveData(db);
        await message.reply({ embeds: [successEmbed(`Bouton \`${btnId}\` ajouté à l'annonce \`${id}\`.`)] });
      } else {
        await message.reply({ embeds: [errorEmbed(`Le bouton \`${btnId}\` est déjà dans l'annonce.`)] });
      }
      break;
    }

    case 'removebutton': {
      const btnId = args[2];
      if (!id || !btnId) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce removebutton <id> <btn_id>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      db.announcements[id].buttons = (db.announcements[id].buttons || []).filter(b => b !== btnId);
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Bouton \`${btnId}\` retiré de l'annonce \`${id}\`.`)] });
      break;
    }

    case 'preview': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce preview <id>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      const ann = db.announcements[id];
      const embed = buildEmbedFromData(ann);
      const rows = buildButtonRows(ann.buttons || []);
      await message.reply({
        content: ann.content ? `📋 Prévisualisation :\n${ann.content}` : '📋 Prévisualisation :',
        embeds: [embed],
        components: rows,
      });
      break;
    }

    case 'send': {
  if (!id)
    return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce send <id> [#salon]\``)] });

  if (!db.announcements[id])
    return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });

  const target = message.mentions.channels.first() || message.channel;
  const ann = db.announcements[id];

  const embed = buildEmbedFromData(ann);
  const rows = buildButtonRows(ann.buttons || []);

  
  // 📤 envoi message
  const sent = await target.send({
    content: ann.content || undefined,
    embeds: [embed],
    components: [...rows], // 👈 IMPORTANT
  });

  // 💾 sauvegarde message ID
  if (!db.announcements[id].sentMessages)
    db.announcements[id].sentMessages = [];

  db.announcements[id].sentMessages.push({
    messageId: sent.id,
    channelId: target.id,
    sentAt: new Date().toISOString(),
  });

  saveData(db);

  if (target.id !== message.channel.id) {
    await message.reply({
      embeds: [successEmbed(`Annonce \`${id}\` envoyée dans ${target}.`)]
    });
  }

  break;
}

    case 'edit': {
      const msgId = args[2];
      if (!id || !msgId) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce edit <id> <msg_id> [#salon]\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      const target = message.mentions.channels.first() || message.channel;
      try {
        const msg = await target.messages.fetch(msgId);
        const ann = db.announcements[id];
        const embed = buildEmbedFromData(ann);
        const rows = buildButtonRows(ann.buttons || []);
        await msg.edit({
          content: ann.content || null,
          embeds: [embed],
          components: rows,
        });
        await message.reply({ embeds: [successEmbed(`Annonce \`${id}\` modifiée.`)] });
      } catch (err) {
        await message.reply({ embeds: [errorEmbed(`Impossible de modifier le message : ${err.message}`)] });
      }
      break;
    }

    case 'list': {
      const ids = Object.keys(db.announcements);
      if (ids.length === 0) return message.reply({ embeds: [infoEmbed('📢 Annonces', 'Aucune annonce créée.')] });
      const desc = ids.map(k => {
        const a = db.announcements[k];
        return `**\`${k}\`** — ${a.title || 'Sans titre'} | Boutons : ${(a.buttons || []).length}`;
      }).join('\n');
      await message.reply({ embeds: [infoEmbed(`📢 Annonces (${ids.length})`, desc)] });
      break;
    }

    case 'delete': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}announce delete <id>\``)] });
      if (!db.announcements[id]) return message.reply({ embeds: [errorEmbed(`Annonce \`${id}\` introuvable.`)] });
      delete db.announcements[id];
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Annonce \`${id}\` supprimée.`)] });
      break;
    }

    default:
      await message.reply({
        embeds: [infoEmbed('📢 Commande announce',
          `Sous-commandes : \`create\`, \`title\`, \`description\`, \`color\`, \`image\`, \`thumbnail\`, \`footer\`, \`timestamp\`, \`content\`, \`addfield\`, \`addbutton\`, \`removebutton\`, \`preview\`, \`send\`, \`edit\`, \`list\`, \`delete\`\n\nUtilisez \`${prefix}help annonces\` pour plus de détails.`
        )]
      });
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : auth
// ══════════════════════════════════════════════════════════════

registerCommand('auth', async (message, args) => {

  if (args[0] === 'list') {
    return message.reply({
      content: `👤 Users auth: ${Object.keys(db.authUsers || {}).length}`
    });
  }

  if (args[0] === 'addguild') {
    const guildId = args[1];
    db.authGuild = guildId;
    saveData(db);

    return message.reply('Guild enregistrée');
  }

  if (args[0] === 'restore') {
    const guildId = args[1] || db.authGuild;

    if (!guildId)
      return message.reply('Aucune guild définie');

    let success = 0;
    let fail = 0;

    for (const userId in db.authUsers) {
      try {
        const token = db.authUsers[userId];

        const res = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${client.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              access_token: token
            })
          }
        );

        if (res.ok) success++;
        else fail++;

      } catch {
        fail++;
      }
    }

    return message.reply(`✅ ${success} ajoutés | ❌ ${fail} échecs`);
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : BOUTONS
// ══════════════════════════════════════════════════════════════

registerCommand('button', async (message, args) => {
  if (!isAdminOrMod(message.member)) {
    return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  }

  const sub  = args[0];
  const id   = args[1];
  const rest = args.slice(2).join(' ');
  const prefix = db.config.prefix;

  switch (sub) {

    case 'create': {
      const label = args.slice(2).join(' ');
      if (!id || !label) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button create <id> <label>\``)] });
      if (db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` existe déjà.`)] });
      db.buttons[id] = {
        label,
        style: 'primary',
        emoji: null,
        action: 'message',
        target: null,
        responseMessage: 'Bouton cliqué !',
        responseEmbed: null,
        ephemeral: true,
        disabled: false,
        roles: [],
        createdAt: new Date().toISOString(),
        createdBy: message.author.id,
      };
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Bouton \`${id}\` créé avec le label **${label}**.\nAction par défaut : \`message\`\nUtilisez \`${prefix}button action ${id} <type>\` pour définir une action.`)] });
      break;
    }

    case 'label': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button label <id> <texte>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      db.buttons[id].label = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Label de \`${id}\` défini : **${rest}**`)] });
      break;
    }

    case 'style': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button style <id> <primary|secondary|success|danger>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      const validStyles = ['primary', 'secondary', 'success', 'danger'];
      if (!validStyles.includes(rest.toLowerCase())) {
        return message.reply({ embeds: [errorEmbed(`Style invalide. Options : \`primary\`, \`secondary\`, \`success\`, \`danger\``)] });
      }
      db.buttons[id].style = rest.toLowerCase();
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Style de \`${id}\` défini : **${rest}**`)] });
      break;
    }

    case 'emoji': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button emoji <id> <emoji>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      db.buttons[id].emoji = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Emoji de \`${id}\` défini : ${rest}`)] });
      break;
    }

    case 'action': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button action <id> <ticket|access|invite|role|message|dm|modal>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      const validActions = ['ticket', 'access', 'invite', 'role', 'message', 'dm', 'modal'];
      if (!validActions.includes(rest.toLowerCase())) {
        return message.reply({ embeds: [errorEmbed(`Action invalide. Options : \`${validActions.join('`, `')}\``)] });
      }
      db.buttons[id].action = rest.toLowerCase();
      saveData(db);
      await message.reply({
        embeds: [successEmbed(
          `Action de \`${id}\` définie : **${rest}**\n\n` +
          `**ticket** — Crée un ticket de support\n` +
          `**access** — Donne accès à un salon/catégorie\n` +
          `**invite** — Envoie un lien d'invitation au serveur\n` +
          `**role** — Donne/retire un rôle\n` +
          `**message** — Envoie un message de réponse\n` +
          `**dm** — Envoie un DM à l'utilisateur\n` +
          `**modal** — Ouvre un formulaire (modal)\n\n` +
          `Utilisez \`${prefix}button settarget ${id} <valeur>\` pour définir la cible.`
        )]
      });
      break;
    }

    case 'settarget': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button settarget <id> <valeur>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      // Extraire la cible (channel ou role mention ou texte brut)
      const mentionedChannel = message.mentions.channels.first();
      const mentionedRole    = message.mentions.roles.first();
      db.buttons[id].target = mentionedChannel ? mentionedChannel.id :
                               mentionedRole    ? mentionedRole.id    : rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Cible de \`${id}\` définie.`)] });
      break;
    }

    case 'setmessage': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button setmessage <id> <texte>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      db.buttons[id].responseMessage = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Message de réponse de \`${id}\` défini.`)] });
      break;
    }

    case 'setembed': {
      const embedId = args[2];
      if (!id || !embedId) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button setembed <id> <embed_id>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      if (!db.embeds[embedId]) return message.reply({ embeds: [errorEmbed(`Embed \`${embedId}\` introuvable.`)] });
      db.buttons[id].responseEmbed = embedId;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Embed de réponse de \`${id}\` défini : \`${embedId}\``)] });
      break;
    }

    case 'setephemeral': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button setephemeral <id>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      db.buttons[id].ephemeral = !db.buttons[id].ephemeral;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Réponse éphémère de \`${id}\` : ${db.buttons[id].ephemeral ? '✅ Activée' : '❌ Désactivée'}`)] });
      break;
    }

    case 'addrole': {
      const role = message.mentions.roles.first();
      if (!id || !role) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button addrole <id> <@role>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      if (!db.buttons[id].roles) db.buttons[id].roles = [];
      if (!db.buttons[id].roles.includes(role.id)) {
        db.buttons[id].roles.push(role.id);
        saveData(db);
        await message.reply({ embeds: [successEmbed(`Rôle ${role} ajouté au bouton \`${id}\`.`)] });
      }
      break;
    }

    case 'disable': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button disable <id>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      db.buttons[id].disabled = true;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Bouton \`${id}\` désactivé.`)] });
      break;
    }

    case 'enable': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button enable <id>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      db.buttons[id].disabled = false;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Bouton \`${id}\` activé.`)] });
      break;
    }

    case 'list': {
      const ids = Object.keys(db.buttons);
      if (ids.length === 0) return message.reply({ embeds: [infoEmbed('🔘 Boutons', 'Aucun bouton créé.')] });
      const desc = ids.map(k => {
        const b = db.buttons[k];
        return `**\`${k}\`** — ${b.label} | Action: \`${b.action}\` | Style: \`${b.style}\` ${b.disabled ? '🔴' : '🟢'}`;
      }).join('\n');
      await message.reply({ embeds: [infoEmbed(`🔘 Boutons (${ids.length})`, desc)] });
      break;
    }

    case 'delete': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button delete <id>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      delete db.buttons[id];
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Bouton \`${id}\` supprimé.`)] });
      break;
    }

    case 'info': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button info <id>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      const b = db.buttons[id];
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(
              b.style === 'danger'    ? 0xED4245 :
              b.style === 'success'   ? 0x57F287 :
              b.style === 'secondary' ? 0x4F545C : 0x5865F2
            )
            .setTitle(`🔘 Info — Bouton \`${id}\``)
            .addFields(
              { name: 'Label', value: b.label, inline: true },
              { name: 'Style', value: b.style, inline: true },
              { name: 'Emoji', value: b.emoji || 'Aucun', inline: true },
              { name: 'Action', value: b.action, inline: true },
              { name: 'Cible', value: b.target ? `\`${b.target}\`` : 'Non définie', inline: true },
              { name: 'Éphémère', value: b.ephemeral ? '✅' : '❌', inline: true },
              { name: 'Désactivé', value: b.disabled ? '🔴 Oui' : '🟢 Non', inline: true },
              { name: 'Embed réponse', value: b.responseEmbed || 'Aucun', inline: true },
              { name: 'Rôles requis', value: (b.roles || []).length > 0 ? b.roles.map(r => `<@&${r}>`).join(', ') : 'Aucun', inline: false },
              { name: 'Message réponse', value: b.responseMessage || 'Aucun', inline: false },
            )
            .setTimestamp()
        ]
      });
      break;
    }

    case 'test': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}button test <id>\``)] });
      if (!db.buttons[id]) return message.reply({ embeds: [errorEmbed(`Bouton \`${id}\` introuvable.`)] });
      const b = db.buttons[id];
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_${id}`)
          .setLabel(b.label)
          .setStyle(
            b.style === 'danger'    ? ButtonStyle.Danger    :
            b.style === 'success'   ? ButtonStyle.Success   :
            b.style === 'secondary' ? ButtonStyle.Secondary : ButtonStyle.Primary
          )
          .setDisabled(b.disabled || false)
      );
      if (b.emoji) row.components[0].setEmoji(b.emoji);
      await message.reply({
        content: `🧪 Test du bouton \`${id}\` :`,
        components: [row],
      });
      break;
    }

    default:
      await message.reply({
        embeds: [infoEmbed('🔘 Commande button',
          `Sous-commandes : \`create\`, \`label\`, \`style\`, \`emoji\`, \`action\`, \`settarget\`, \`setmessage\`, \`setembed\`, \`setephemeral\`, \`addrole\`, \`disable\`, \`enable\`, \`list\`, \`delete\`, \`info\`, \`test\`\n\nUtilisez \`${prefix}help boutons\` pour plus de détails.`
        )]
      });
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : TICKETS
// ══════════════════════════════════════════════════════════════

registerCommand('ticket', async (message, args) => {
  if (!isAdminOrMod(message.member)) {
    return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  }

  const sub  = args[0];
  const rest = args.slice(1).join(' ');
  const prefix = db.config.prefix;

  switch (sub) {

    case 'setup': {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎫 Configuration des tickets')
        .addFields(
          { name: 'Statut', value: db.tickets.enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
          { name: 'Catégorie', value: db.tickets.categoryId ? `<#${db.tickets.categoryId}>` : 'Non définie', inline: true },
          { name: 'Salon de logs', value: db.tickets.logChannelId ? `<#${db.tickets.logChannelId}>` : 'Non défini', inline: true },
          { name: 'Rôle support', value: db.tickets.supportRoleId ? `<@&${db.tickets.supportRoleId}>` : '1505993875888537762', inline: true },
          { name: 'Tickets ouverts', value: `${Object.keys(db.tickets.openTickets || {}).length}`, inline: true },
          { name: 'Tickets fermés', value: `${Object.keys(db.tickets.closedTickets || {}).length}`, inline: true },
          { name: 'Compteur', value: `${db.tickets.counter}`, inline: true },
        )
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      break;
    }

    case 'addsupport': {

  const role = message.mentions.roles.first();

  if (!role) {
    return message.reply({
      embeds: [errorEmbed('Mentionnez un rôle.')]
    });
  }

  if (!db.tickets.supportRoleIds) {
    db.tickets.supportRoleIds = [];
  }

  if (db.tickets.supportRoleIds.includes(role.id)) {
    return message.reply({
      embeds: [errorEmbed('Ce rôle est déjà support.')]
    });
  }

  db.tickets.supportRoleIds.push(role.id);
  saveData(db);

  return message.reply({
    embeds: [successEmbed(`Rôle ajouté : ${role}`)]
  });
}

case 'remsupport': {

  const role = message.mentions.roles.first();

  if (!role) {
    return message.reply({
      embeds: [errorEmbed('Mentionnez un rôle.')]
    });
  }

  if (!db.tickets.supportRoleIds) {
    db.tickets.supportRoleIds = [];
  }

  db.tickets.supportRoleIds = db.tickets.supportRoleIds
    .filter(id => id !== role.id);

  saveData(db);

  return message.reply({
    embeds: [successEmbed(`Rôle retiré : ${role}`)]
  });
}

case 'listsupport': {

  const roles = db.tickets.supportRoleIds || [];

  if (roles.length === 0) {
    return message.reply({
      embeds: [infoEmbed('Support', 'Aucun rôle configuré.')]
    });
  }

  return message.reply({
    embeds: [
      infoEmbed(
        'Rôles support',
        roles.map(id => `<@&${id}>`).join('\n')
      )
    ]
  });
}

case 'setcategory': {

  const type = args[1];

  // mention OU id
  const cat =
    message.mentions.channels.first() ||
    message.guild.channels.cache.get(args[2]);

  if (!type || !cat) {
    return message.reply({
      embeds: [
        errorEmbed(
          'Usage : !ticket setcategory <type> #categorie'
        )
      ]
    });
  }

  // Vérifie catégorie
  if (cat.type !== 4) {
    return message.reply({
      embeds: [
        errorEmbed('❌ Ce salon n’est pas une catégorie.')
      ]
    });
  }

  // init
  if (!db.tickets.categories) {
    db.tickets.categories = {};
  }

  // sauvegarde
  db.tickets.categories[type] = cat.id;

  saveData(db);

  await message.reply({
    embeds: [
      successEmbed(
        `✅ Catégorie **${type}** définie sur ${cat}`
      )
    ]
  });

  break;
}

    case 'setlog': {
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply({ embeds: [errorEmbed('Mentionnez un salon.')] });
      db.tickets.logChannelId = ch.id;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Salon de logs des tickets défini : ${ch}`)] });
      break;
    }

case 'setsupport': {

  const roles = message.mentions.roles;

  if (!roles || roles.size === 0) {
    return message.reply({
      embeds: [errorEmbed('Mentionnez un ou plusieurs rôles.')]
    });
  }

  if (!db.tickets.supportRoleIds) {
    db.tickets.supportRoleIds = [];
  }

  db.tickets.supportRoleIds = roles.map(r => r.id);

  saveData(db);

  await message.reply({
    embeds: [
      successEmbed(
        `Rôles support définis : ${roles.map(r => r).join(', ')}`
      )
    ]
  });

  break;
}

    case 'close': {
      const reason = rest || 'Aucune raison fournie';
      const ticketData = Object.values(db.tickets.openTickets || {}).find(t => t.channelId === message.channel.id);
      if (!ticketData) return message.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket.')] });
      await closeTicket(message.guild, message.channel, message.member, reason, ticketData);
      break;
    }

    case 'add': {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
      const ticketData = Object.values(db.tickets.openTickets || {}).find(t => t.channelId === message.channel.id);
      if (!ticketData) return message.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket.')] });
      await message.channel.permissionOverwrites.edit(target, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      await message.reply({ embeds: [successEmbed(`${target} a été ajouté au ticket.`)] });
      break;
    }

    case 'remove': {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
      const ticketData = Object.values(db.tickets.openTickets || {}).find(t => t.channelId === message.channel.id);
      if (!ticketData) return message.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket.')] });
      if (ticketData.userId === target.id) return message.reply({ embeds: [errorEmbed('Vous ne pouvez pas retirer le créateur du ticket.')] });
      await message.channel.permissionOverwrites.delete(target);
      await message.reply({ embeds: [successEmbed(`${target} a été retiré du ticket.`)] });
      break;
    }

    case 'rename': {
      if (!rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}ticket rename <nom>\``)] });
      const ticketData = Object.values(db.tickets.openTickets || {}).find(t => t.channelId === message.channel.id);
      if (!ticketData) return message.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket.')] });
      await message.channel.setName(`ticket-${rest}`);
      await message.reply({ embeds: [successEmbed(`Ticket renommé : \`ticket-${rest}\``)] });
      break;
    }

    case 'list': {
      const open = Object.values(db.tickets.openTickets || {});
      if (open.length === 0) return message.reply({ embeds: [infoEmbed('🎫 Tickets', 'Aucun ticket ouvert.')] });
      const desc = open.map(t => `**Ticket #${t.number}** — <@${t.userId}> — <#${t.channelId}>`).join('\n');
      await message.reply({ embeds: [infoEmbed(`🎫 Tickets ouverts (${open.length})`, desc)] });
      break;
    }

case 'panel': {
  const target = message.mentions.channels.first() || message.channel;

  const embed = new EmbedBuilder()
    .setColor(0x7B1FA2)
    .setTitle('<:4241:1512227610254508082>  TICKET SUPPORT')
    .setDescription(
      'Créez un ticket pour contacter le staff en choisissant la catégorie correspondant à votre demande.\n\n' +
      'Nous ferons de notre mieux pour vous répondre dans les plus brefs délais.'
    );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_category_select')
      .setPlaceholder('Choisir une option...')
      .addOptions([
        {
          label: 'Devenir Staff',
          description: 'Tu veux devenir Staff ?',
          value: 'tickets-staff',
          emoji: {
            id: '1512228826090967133',
            name: 'gun',
            animated: true
          },
        },
        {
          label: 'Partenariat',
          description: 'Demande de partenariat',
          value: 'partenariat',
          emoji: {
            id: '1512230805768765491',
            name: 'firepixel',
            animated: true
          },
        },
        {
          label: 'Support',
          description: 'Support ou débanissement',
          value: 'support',
          emoji: {
            id: '1508252581850382336',
            name: 'SOR4',
            animated: false
          },
        },
        {
          label: 'Autre',
          description: 'Autres questions',
          value: 'autre',
          emoji: {
            id: '1507897808685105274',
            name: 'purpleeventna',
            animated: false
          },
        }
      ])
  );

  await target.send({
    embeds: [embed],
    components: [row]
  });

  if (target.id !== message.channel.id) {
    await message.reply(`✅ Panel envoyé dans <#${target.id}>`);
  }

  break;
}

    case 'enable': {
      db.tickets.enabled = true;
      saveData(db);
      await message.reply({ embeds: [successEmbed('Système de tickets activé.')] });
      break;
    }

    case 'disable': {
      db.tickets.enabled = false;
      saveData(db);
      await message.reply({ embeds: [successEmbed('Système de tickets désactivé.')] });
      break;
    }

    default:
      await message.reply({
        embeds: [infoEmbed('🎫 Commande ticket',
          `Sous-commandes : \`setup\`, \`setcategory\`, \`setlog\`, \`setsupport\`, \`close\`, \`add\`, \`remove\`, \`rename\`, \`list\`, \`panel\`, \`enable\`, \`disable\`\n\nUtilisez \`${prefix}help tickets\` pour plus de détails.`
        )]
      });
  }
});


// ══════════════════════════════════════════════════════════════
//  COMMANDES : ACCÈS AUX SALONS
// ══════════════════════════════════════════════════════════════

registerCommand('access', async (message, args) => {
  if (!isAdminOrMod(message.member)) {
    return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  }

  const sub  = args[0];
  const id   = args[1];
  const rest = args.slice(2).join(' ');
  const prefix = db.config.prefix;

  switch (sub) {

    case 'create': {
      const channel = message.mentions.channels.first();
      if (!id || !channel) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}access create <id> <#salon>\``)] });
      db.channelAccess[id] = {
        channelId: channel.id,
        roleId: null,
        type: 'give',
        label: 'Accès',
        createdAt: new Date().toISOString(),
        createdBy: message.author.id,
      };
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Accès \`${id}\` créé pour ${channel}.`)] });
      break;
    }

    case 'setrole': {
      const role = message.mentions.roles.first();
      if (!id || !role) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}access setrole <id> <@role>\``)] });
      if (!db.channelAccess[id]) return message.reply({ embeds: [errorEmbed(`Accès \`${id}\` introuvable.`)] });
      db.channelAccess[id].roleId = role.id;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Rôle de \`${id}\` défini : ${role}`)] });
      break;
    }

    case 'settype': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}access settype <id> <give|toggle|view>\``)] });
      if (!db.channelAccess[id]) return message.reply({ embeds: [errorEmbed(`Accès \`${id}\` introuvable.`)] });
      const validTypes = ['give', 'toggle', 'view'];
      if (!validTypes.includes(rest)) return message.reply({ embeds: [errorEmbed(`Type invalide : \`give\`, \`toggle\`, \`view\``)] });
      db.channelAccess[id].type = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Type de \`${id}\` défini : **${rest}**`)] });
      break;
    }

    case 'setlabel': {
      if (!id || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}access setlabel <id> <texte>\``)] });
      if (!db.channelAccess[id]) return message.reply({ embeds: [errorEmbed(`Accès \`${id}\` introuvable.`)] });
      db.channelAccess[id].label = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Label de \`${id}\` défini : **${rest}**`)] });
      break;
    }

    case 'list': {
      const ids = Object.keys(db.channelAccess);
      if (ids.length === 0) return message.reply({ embeds: [infoEmbed('🔑 Accès', 'Aucun accès créé.')] });
      const desc = ids.map(k => {
        const a = db.channelAccess[k];
        return `**\`${k}\`** — <#${a.channelId}> | Rôle: ${a.roleId ? `<@&${a.roleId}>` : 'Aucun'} | Type: \`${a.type}\``;
      }).join('\n');
      await message.reply({ embeds: [infoEmbed(`🔑 Accès (${ids.length})`, desc)] });
      break;
    }

    case 'delete': {
      if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}access delete <id>\``)] });
      if (!db.channelAccess[id]) return message.reply({ embeds: [errorEmbed(`Accès \`${id}\` introuvable.`)] });
      delete db.channelAccess[id];
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Accès \`${id}\` supprimé.`)] });
      break;
    }

    default:
      await message.reply({
        embeds: [infoEmbed('🔑 Commande access',
          `Sous-commandes : \`create\`, \`setrole\`, \`settype\`, \`setlabel\`, \`list\`, \`delete\`\n\nUtilisez \`${prefix}help access\` pour plus de détails.`
        )]
      });
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : MODÉRATION
// ══════════════════════════════════════════════════════════════

// ─── !warn ────────────────────────────────────────────────────
registerCommand('warn', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const target = message.mentions.members.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
  const reason = args.slice(1).join(' ') || 'Aucune raison';
  if (!db.moderation.warnLogs[target.id]) db.moderation.warnLogs[target.id] = [];
  const warnId = Date.now().toString();
  db.moderation.warnLogs[target.id].push({
    id: warnId,
    reason,
    moderatorId: message.author.id,
    date: new Date().toISOString(),
  });
  saveData(db);
  const count = db.moderation.warnLogs[target.id].length;

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⚠️ Avertissement')
        .addFields(
          { name: 'Utilisateur', value: `${target} (${target.user.tag})`, inline: true },
          { name: 'Modérateur', value: `${message.author}`, inline: true },
          { name: 'Raison', value: reason, inline: false },
          { name: 'Total warns', value: `${count}`, inline: true },
          { name: 'ID', value: `\`${warnId}\``, inline: true },
        )
        .setTimestamp()
    ]
  });

  // Notifier l'utilisateur en DM
  try {
    await target.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`⚠️ Vous avez reçu un avertissement sur ${message.guild.name}`)
          .addFields(
            { name: 'Raison', value: reason },
            { name: 'Modérateur', value: message.author.tag },
            { name: 'Total warns', value: `${count}` }
          )
          .setTimestamp()
      ]
    });
  } catch (_) {}

  await logAction(message.guild, '⚠️ Warn', target.user, message.member, reason);
});

// ─── !warnings ────────────────────────────────────────────────
registerCommand('warnings', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const target = message.mentions.members.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
  const warns = db.moderation.warnLogs[target.id] || [];
  if (warns.length === 0) {
    return message.reply({ embeds: [infoEmbed(`⚠️ Warnings de ${target.user.tag}`, 'Aucun avertissement.')] });
  }
  const desc = warns.map((w, i) =>
    `**${i + 1}.** \`${w.id}\` — ${w.reason}\n> Par <@${w.moderatorId}> le <t:${Math.floor(new Date(w.date).getTime() / 1000)}:D>`
  ).join('\n\n');
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`⚠️ Warnings de ${target.user.tag} (${warns.length})`)
        .setDescription(desc)
        .setThumbnail(target.user.displayAvatarURL())
        .setTimestamp()
    ]
  });
});

// ─── !clearwarns ──────────────────────────────────────────────
registerCommand('clearwarns', async (message, args) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const target = message.mentions.members.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
  db.moderation.warnLogs[target.id] = [];
  saveData(db);
  await message.reply({ embeds: [successEmbed(`Warnings de ${target} effacés.`)] });
});

// ─── !mute ────────────────────────────────────────────────────
registerCommand('mute', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const target = message.mentions.members.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
  if (!target.moderatable) return message.reply({ embeds: [errorEmbed('Impossible de muter cet utilisateur.')] });

  // Durée (ex: 10m, 1h, 2d)
  let duration = null;
  let durationMs = null;
  const durationArg = args[1];
  if (durationArg && /^\d+[smhd]$/.test(durationArg)) {
    const unit = durationArg.slice(-1);
    const val  = parseInt(durationArg);
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    durationMs = val * multipliers[unit];
    duration = durationArg;
  }

  const reason = args.slice(durationMs ? 2 : 1).join(' ') || 'Aucune raison';

  try {
    await target.timeout(durationMs || 600000, reason); // 10min par défaut
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔇 Mute')
          .addFields(
            { name: 'Utilisateur', value: `${target} (${target.user.tag})`, inline: true },
            { name: 'Durée', value: duration || '10 minutes (défaut)', inline: true },
            { name: 'Raison', value: reason, inline: false },
            { name: 'Modérateur', value: `${message.author}`, inline: true },
          )
          .setTimestamp()
      ]
    });

    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`🔇 Vous avez été mute sur ${message.guild.name}`)
            .addFields(
              { name: 'Durée', value: duration || '10 minutes' },
              { name: 'Raison', value: reason }
            )
            .setTimestamp()
        ]
      });
    } catch (_) {}

    await logAction(message.guild, '🔇 Mute', target.user, message.member, reason, `Durée: ${duration || '10min'}`);
  } catch (err) {
    await message.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
  }
});

// ─── !unmute ──────────────────────────────────────────────────
registerCommand('unmute', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const target = message.mentions.members.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
  try {
    await target.timeout(null);
    await message.reply({ embeds: [successEmbed(`${target} a été démute.`)] });
    await logAction(message.guild, '🔊 Unmute', target.user, message.member, 'Démute');
  } catch (err) {
    await message.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
  }
});

// ─── !kick ────────────────────────────────────────────────────
registerCommand('kick', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return message.reply({ embeds: [errorEmbed('Permission `Expulser des membres` requise.')] });
  }
  const target = message.mentions.members.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
  if (!target.kickable) return message.reply({ embeds: [errorEmbed('Impossible d\'expulser cet utilisateur.')] });
  const reason = args.slice(1).join(' ') || 'Aucune raison';
  try {
    await target.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`👢 Vous avez été expulsé de ${message.guild.name}`)
          .addFields({ name: 'Raison', value: reason })
          .setTimestamp()
      ]
    }).catch(() => {});
    await target.kick(reason);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('👢 Expulsion')
          .addFields(
            { name: 'Utilisateur', value: `${target.user.tag}`, inline: true },
            { name: 'Raison', value: reason, inline: false },
            { name: 'Modérateur', value: `${message.author}`, inline: true },
          )
          .setTimestamp()
      ]
    });
    await logAction(message.guild, '👢 Kick', target.user, message.member, reason);
  } catch (err) {
    await message.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
  }
});

// ─── !ban ─────────────────────────────────────────────────────
registerCommand('ban', async (message, args) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return message.reply({ embeds: [errorEmbed('Permission `Bannir des membres` requise.')] });
  }
  const target = message.mentions.members.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur.')] });
  if (!target.bannable) return message.reply({ embeds: [errorEmbed('Impossible de bannir cet utilisateur.')] });
  const reason = args.slice(1).join(' ') || 'Aucune raison';
  try {
    await target.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`🔨 Vous avez été banni de ${message.guild.name}`)
          .addFields({ name: 'Raison', value: reason })
          .setTimestamp()
      ]
    }).catch(() => {});
    await target.ban({ reason, deleteMessageSeconds: 86400 });
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔨 Bannissement')
          .addFields(
            { name: 'Utilisateur', value: target.user.tag, inline: true },
            { name: 'Raison', value: reason, inline: false },
            { name: 'Modérateur', value: `${message.author}`, inline: true },
          )
          .setTimestamp()
      ]
    });
    await logAction(message.guild, '🔨 Ban', target.user, message.member, reason);
  } catch (err) {
    await message.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
  }
});

// ─── !unban ───────────────────────────────────────────────────
registerCommand('unban', async (message, args) => {
  if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const userId = args[0];
  if (!userId) return message.reply({ embeds: [errorEmbed('Fournissez un ID utilisateur.')] });
  try {
    const ban = await message.guild.bans.fetch(userId);
    await message.guild.members.unban(userId);
    await message.reply({ embeds: [successEmbed(`${ban.user.tag} a été débanni.`)] });
    await logAction(message.guild, '✅ Unban', ban.user, message.member, 'Déban');
  } catch (err) {
    await message.reply({ embeds: [errorEmbed(`Impossible de débannir : ${err.message}`)] });
  }
});

// ─── !purge ───────────────────────────────────────────────────
registerCommand('purge', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return message.reply({ embeds: [errorEmbed('Permission `Gérer les messages` requise.')] });
  }
  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount < 1 || amount > 100) {
    return message.reply({ embeds: [errorEmbed('Nombre entre 1 et 100.')] });
  }
  try {
    await message.delete();
    const deleted = await message.channel.bulkDelete(amount, true);
    const reply = await message.channel.send({ embeds: [successEmbed(`${deleted.size} message(s) supprimé(s).`)] });
    setTimeout(() => reply.delete().catch(() => {}), 3000);
  } catch (err) {
    await message.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
  }
});

// ─── !slowmode ────────────────────────────────────────────────
registerCommand('slowmode', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const seconds = parseInt(args[0]);
  if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
    return message.reply({ embeds: [errorEmbed('Entrez une valeur entre 0 et 21600 secondes.')] });
  }
  await message.channel.setRateLimitPerUser(seconds);
  await message.reply({ embeds: [successEmbed(`Slowmode défini à **${seconds}s** dans ce salon.`)] });
});

// ─── !lock ────────────────────────────────────────────────────
registerCommand('lock', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const target = message.mentions.channels.first() || message.channel;
  await target.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
  await message.reply({ embeds: [successEmbed(`${target} verrouillé. 🔒`)] });
});

// ─── !unlock ──────────────────────────────────────────────────
registerCommand('unlock', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const target = message.mentions.channels.first() || message.channel;
  await target.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
  await message.reply({ embeds: [successEmbed(`${target} déverrouillé. 🔓`)] });
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : GESTION DES RÔLES
// ══════════════════════════════════════════════════════════════

registerCommand('role', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const sub = args[0];

  switch (sub) {
    case 'add': {
      const target = message.mentions.members.first();
      const role   = message.mentions.roles.first();
      if (!target || !role) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur et un rôle.')] });
      await target.roles.add(role);
      await message.reply({ embeds: [successEmbed(`Rôle ${role} donné à ${target}.`)] });
      break;
    }
    case 'remove': {
      const target = message.mentions.members.first();
      const role   = message.mentions.roles.first();
      if (!target || !role) return message.reply({ embeds: [errorEmbed('Mentionnez un utilisateur et un rôle.')] });
      await target.roles.remove(role);
      await message.reply({ embeds: [successEmbed(`Rôle ${role} retiré de ${target}.`)] });
      break;
    }
    case 'create': {
      const name  = args[1];
      const color = args[2] || '#99AAB5';
      if (!name) return message.reply({ embeds: [errorEmbed('Fournissez un nom de rôle.')] });
      const newRole = await message.guild.roles.create({
        name,
        color: color.replace('#', ''),
        reason: `Créé par ${message.author.tag}`,
      });
      await message.reply({ embeds: [successEmbed(`Rôle ${newRole} créé.`)] });
      break;
    }
    case 'delete': {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Mentionnez un rôle.')] });
      await role.delete(`Supprimé par ${message.author.tag}`);
      await message.reply({ embeds: [successEmbed(`Rôle **${role.name}** supprimé.`)] });
      break;
    }
    case 'color': {
      const role  = message.mentions.roles.first();
      const color = args[2];
      if (!role || !color) return message.reply({ embeds: [errorEmbed('Mentionnez un rôle et fournissez une couleur.')] });
      await role.setColor(color.replace('#', ''));
      await message.reply({ embeds: [successEmbed(`Couleur de ${role} changée.`)] });
      break;
    }
    case 'info': {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Mentionnez un rôle.')] });
      const embed = new EmbedBuilder()
        .setColor(role.color || 0x5865F2)
        .setTitle(`🎭 Rôle — ${role.name}`)
        .addFields(
          { name: '🆔 ID', value: role.id, inline: true },
          { name: '🎨 Couleur', value: role.hexColor, inline: true },
          { name: '📋 Mentionnable', value: role.mentionable ? '✅' : '❌', inline: true },
          { name: '📌 Épinglé', value: role.hoist ? '✅' : '❌', inline: true },
          { name: '👥 Membres', value: `${role.members.size}`, inline: true },
          { name: '🏆 Position', value: `${role.position}`, inline: true },
          { name: '📅 Créé le', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
        )
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      break;
    }
    case 'members': {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Mentionnez un rôle.')] });
      const members = role.members.map(m => m.toString()).join(', ') || 'Aucun membre';
      const embed = new EmbedBuilder()
        .setColor(role.color || 0x5865F2)
        .setTitle(`👥 Membres avec ${role.name} (${role.members.size})`)
        .setDescription(members.length > 2000 ? members.slice(0, 1997) + '...' : members)
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      break;
    }
    default:
      await message.reply({
        embeds: [infoEmbed('🎭 Commande role',
          `Sous-commandes : \`add\`, \`remove\`, \`create\`, \`delete\`, \`color\`, \`info\`, \`members\``
        )]
      });
  }
});

// ─── !reactionrole ────────────────────────────────────────────
registerCommand('reactionrole', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const sub = args[0];

  switch (sub) {
    case 'set': {
      const msgId = args[1];
      const emoji = args[2];
      const role  = message.mentions.roles.first();
      if (!msgId || !emoji || !role) {
        return message.reply({ embeds: [errorEmbed('Usage : `reactionrole set <msg_id> <emoji> <@role>`')] });
      }
      // Essayer de retrouver le message dans le canal courant
      try {
        const msg = await message.channel.messages.fetch(msgId);
        if (!db.reactionRoles[msgId]) db.reactionRoles[msgId] = {};
        db.reactionRoles[msgId][emoji] = role.id;
        saveData(db);
        await msg.react(emoji);
        await message.reply({ embeds: [successEmbed(`Rôle de réaction défini : ${emoji} → ${role}`)] });
      } catch (err) {
        await message.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
      }
      break;
    }
    case 'remove': {
      const msgId = args[1];
      const emoji = args[2];
      if (!msgId || !emoji) return message.reply({ embeds: [errorEmbed('Usage : `reactionrole remove <msg_id> <emoji>`')] });
      if (db.reactionRoles[msgId]) {
        delete db.reactionRoles[msgId][emoji];
        if (Object.keys(db.reactionRoles[msgId]).length === 0) delete db.reactionRoles[msgId];
        saveData(db);
        await message.reply({ embeds: [successEmbed(`Rôle de réaction supprimé : ${emoji}`)] });
      }
      break;
    }
    case 'list': {
      const entries = Object.entries(db.reactionRoles);
      if (entries.length === 0) return message.reply({ embeds: [infoEmbed('💫 Rôles de réaction', 'Aucun rôle de réaction.')] });
      const desc = entries.map(([msgId, emojis]) =>
        `**Message \`${msgId}\`**\n${Object.entries(emojis).map(([e, r]) => `${e} → <@&${r}>`).join('\n')}`
      ).join('\n\n');
      await message.reply({ embeds: [infoEmbed('💫 Rôles de réaction', desc)] });
      break;
    }
    default:
      await message.reply({ embeds: [infoEmbed('💫 Commande reactionrole', 'Sous-commandes : `set`, `remove`, `list`')] });
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : COMMANDES PERSONNALISÉES
// ══════════════════════════════════════════════════════════════

registerCommand('cc', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const sub  = args[0];
  const name = args[1];
  const rest = args.slice(2).join(' ');
  const prefix = db.config.prefix;

  switch (sub) {
    case 'create': {
      if (!name || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}cc create <nom> <réponse>\``)] });
      if (db.customCommands[name]) return message.reply({ embeds: [errorEmbed(`La commande \`${name}\` existe déjà.`)] });
      db.customCommands[name] = {
        response: rest,
        embedId: null,
        uses: 0,
        createdAt: new Date().toISOString(),
        createdBy: message.author.id,
      };
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Commande \`${prefix}${name}\` créée.`)] });
      break;
    }
    case 'edit': {
      if (!name || !rest) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}cc edit <nom> <réponse>\``)] });
      if (!db.customCommands[name]) return message.reply({ embeds: [errorEmbed(`Commande \`${name}\` introuvable.`)] });
      db.customCommands[name].response = rest;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Commande \`${prefix}${name}\` modifiée.`)] });
      break;
    }
    case 'delete': {
      if (!name) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}cc delete <nom>\``)] });
      if (!db.customCommands[name]) return message.reply({ embeds: [errorEmbed(`Commande \`${name}\` introuvable.`)] });
      delete db.customCommands[name];
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Commande \`${prefix}${name}\` supprimée.`)] });
      break;
    }
    case 'list': {
      const keys = Object.keys(db.customCommands);
      if (keys.length === 0) return message.reply({ embeds: [infoEmbed('⚡ Commandes personnalisées', 'Aucune commande créée.')] });
      const desc = keys.map(k => `\`${prefix}${k}\` — Utilisations : ${db.customCommands[k].uses}`).join('\n');
      await message.reply({ embeds: [infoEmbed(`⚡ Commandes personnalisées (${keys.length})`, desc)] });
      break;
    }
    case 'info': {
      if (!name) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}cc info <nom>\``)] });
      if (!db.customCommands[name]) return message.reply({ embeds: [errorEmbed(`Commande \`${name}\` introuvable.`)] });
      const cmd = db.customCommands[name];
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`⚡ CC — ${prefix}${name}`)
            .addFields(
              { name: 'Réponse', value: cmd.response, inline: false },
              { name: 'Embed', value: cmd.embedId || 'Aucun', inline: true },
              { name: 'Utilisations', value: `${cmd.uses}`, inline: true },
              { name: 'Créé par', value: `<@${cmd.createdBy}>`, inline: true },
            )
            .setTimestamp()
        ]
      });
      break;
    }
    case 'setembed': {
      const embedId = args[2];
      if (!name || !embedId) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}cc setembed <nom> <embed_id>\``)] });
      if (!db.customCommands[name]) return message.reply({ embeds: [errorEmbed(`Commande \`${name}\` introuvable.`)] });
      if (!db.embeds[embedId]) return message.reply({ embeds: [errorEmbed(`Embed \`${embedId}\` introuvable.`)] });
      db.customCommands[name].embedId = embedId;
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Embed \`${embedId}\` défini pour la commande \`${prefix}${name}\`.`)] });
      break;
    }
    default:
      await message.reply({
        embeds: [infoEmbed('⚡ Commande cc',
          `Sous-commandes : \`create\`, \`edit\`, \`delete\`, \`list\`, \`info\`, \`setembed\`\n\nUtilisez \`${prefix}help custom\` pour plus de détails.`
        )]
      });
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : SONDAGES
// ══════════════════════════════════════════════════════════════

registerCommand('poll', async (message, args) => {
  if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
  const sub = args[0];

  switch (sub) {
    case 'create': {
      const question = args.slice(1).join(' ');
      if (!question) return message.reply({ embeds: [errorEmbed('Fournissez une question.')] });
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Sondage')
        .setDescription(question)
        .addFields(
          { name: '👍 Pour', value: '0 vote', inline: true },
          { name: '👎 Contre', value: '0 vote', inline: true }
        )
        .setFooter({ text: `Sondage par ${message.author.tag}` })
        .setTimestamp();
      const msg = await message.channel.send({ embeds: [embed] });
      await msg.react('👍');
      await msg.react('👎');
      db.polls[msg.id] = {
        question,
        type: 'yesno',
        channelId: message.channel.id,
        authorId: message.author.id,
        createdAt: new Date().toISOString(),
        active: true,
      };
      saveData(db);
      await message.delete().catch(() => {});
      break;
    }
    case 'multichoice': {
      const full = args.slice(1).join(' ');
      const parts = full.split('|').map(p => p.trim());
      if (parts.length < 3) return message.reply({ embeds: [errorEmbed('Fournissez une question et au moins 2 options séparées par `|`')] });
      const question = parts[0];
      const options  = parts.slice(1);
      const emojis   = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const desc = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Sondage — Multi-choix')
        .setDescription(`**${question}**\n\n${desc}`)
        .setFooter({ text: `Sondage par ${message.author.tag}` })
        .setTimestamp();
      const msg = await message.channel.send({ embeds: [embed] });
      for (let i = 0; i < Math.min(options.length, emojis.length); i++) {
        await msg.react(emojis[i]);
      }
      db.polls[msg.id] = {
        question,
        type: 'multichoice',
        options,
        channelId: message.channel.id,
        authorId: message.author.id,
        createdAt: new Date().toISOString(),
        active: true,
      };
      saveData(db);
      await message.delete().catch(() => {});
      break;
    }
    case 'end': {
      const msgId = args[1];
      if (!msgId) return message.reply({ embeds: [errorEmbed('Fournissez l\'ID du message du sondage.')] });
      if (!db.polls[msgId]) return message.reply({ embeds: [errorEmbed('Sondage introuvable.')] });
      const poll = db.polls[msgId];
      if (!poll.active) return message.reply({ embeds: [errorEmbed('Ce sondage est déjà terminé.')] });
      poll.active = false;
      poll.endedAt = new Date().toISOString();
      saveData(db);
      try {
        const channel = await client.channels.fetch(poll.channelId);
        const msg = await channel.messages.fetch(msgId);
        const embed = EmbedBuilder.from(msg.embeds[0])
          .setTitle('📊 Sondage — TERMINÉ')
          .setColor(0xED4245)
          .setFooter({ text: 'Sondage terminé' });
        await msg.edit({ embeds: [embed] });
      } catch (_) {}
      await message.reply({ embeds: [successEmbed('Sondage terminé.')] });
      break;
    }
    default:
      await message.reply({ embeds: [infoEmbed('📊 Commande poll', 'Sous-commandes : `create`, `multichoice`, `end`')] });
  }
});

// ══════════════════════════════════════════════════════════════
//  COMMANDES : INVITATIONS
// ══════════════════════════════════════════════════════════════

registerCommand('invite', async (message, args) => {
  const sub = args[0];
  const prefix = db.config.prefix;

  if (sub === 'create') {
    if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
    const id     = args[1];
    const target = args[2]; // guild id cible
    if (!id) return message.reply({ embeds: [errorEmbed(`Usage : \`${prefix}invite create <id> [guild_id]\``)] });
    try {
      const inv = await message.channel.createInvite({
        maxAge: 0,
        maxUses: 0,
        reason: `Invitation créée par ${message.author.tag}`,
      });
      db.inviteLinks[id] = {
        code: inv.code,
        url: inv.url,
        targetGuildId: target || null,
        createdAt: new Date().toISOString(),
        createdBy: message.author.id,
      };
      saveData(db);
      await message.reply({ embeds: [successEmbed(`Invitation \`${id}\` créée : ${inv.url}`)] });
    } catch (err) {
      await message.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
    }
  } else if (sub === 'list') {
    if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
    const ids = Object.keys(db.inviteLinks);
    if (ids.length === 0) return message.reply({ embeds: [infoEmbed('📨 Invitations', 'Aucune invitation.')] });
    const desc = ids.map(k => `**\`${k}\`** — ${db.inviteLinks[k].url}`).join('\n');
    await message.reply({ embeds: [infoEmbed(`📨 Invitations (${ids.length})`, desc)] });
  } else if (sub === 'delete') {
    if (!isAdminOrMod(message.member)) return message.reply({ embeds: [errorEmbed('Permission refusée.')] });
    const id = args[1];
    if (!id || !db.inviteLinks[id]) return message.reply({ embeds: [errorEmbed('Invitation introuvable.')] });
    try {
      const inv = await message.guild.invites.fetch(db.inviteLinks[id].code);
      await inv.delete();
    } catch (_) {}
    delete db.inviteLinks[id];
    saveData(db);
    await message.reply({ embeds: [successEmbed(`Invitation \`${id}\` supprimée.`)] });
  } else {
    // Afficher le lien d'invitation du serveur
    try {
      const inv = await message.guild.invites.fetch();
      const first = inv.first();
      if (first) {
        await message.reply({ embeds: [infoEmbed('📨 Invitation', `**Lien :** ${first.url}`)] });
      } else {
        await message.reply({ embeds: [infoEmbed('📨 Invitation', 'Aucune invitation active. Utilisez `invite create <id>` pour en créer une.')] });
      }
    } catch (_) {}
  }
});

// ══════════════════════════════════════════════════════════════
//  UTILITAIRE : CRÉER UN TICKET
// ══════════════════════════════════════════════════════════════

/**
 * Crée un nouveau ticket pour un membre.
 * @param {Guild} guild
 * @param {GuildMember} member
 * @param {string} [topic]
 */
async function createTicket(guild, member, topic = 'Support') {
  if (!db.tickets.enabled) {
    return null;
  }

  // Vérifier si l'utilisateur a déjà un ticket ouvert
  const existing = Object.values(db.tickets.openTickets || {}).find(t => t.userId === member.id);
  if (existing) {
    return { existing: true, channelId: existing.channelId };
  }

  db.tickets.counter = (db.tickets.counter || 0) + 1;
  const ticketNumber = db.tickets.counter;
  const channelName  = `ticket-${String(ticketNumber).padStart(4, '0')}`;

  // Permissions du salon
  const permOverwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  // Ajouter le rôle de support si défini
  if (db.tickets.supportRoleIds && db.tickets.supportRoleIds.length > 0) {

  db.tickets.supportRoleIds.forEach(roleId => {
    permOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  });

}

  const channelOptions = {
    name: channelName,
    type: ChannelType.GuildText,
    topic: `Ticket de ${member.user.tag} — ${topic}`,
    permissionOverwrites: permOverwrites,
    reason: `Ticket créé par ${member.user.tag}`,
  };

  if (db.tickets.categoryId) {
  const category = await guild.channels.fetch(db.tickets.categoryId).catch(() => null);

  if (category?.type === ChannelType.GuildCategory) {
    channelOptions.parent = category.id;
  } else {
    console.log("⚠️ Catégorie tickets invalide !");
  }
  }

  const channel = await guild.channels.create(channelOptions);

  // Enregistrer le ticket
  db.tickets.openTickets[ticketNumber] = {
    number: ticketNumber,
    userId: member.id,
    channelId: channel.id,
    topic,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  saveData(db);

  // Message de bienvenue dans le ticket
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🎫 Ticket #${String(ticketNumber).padStart(4, '0')}`)
    .setDescription(
      `Bonjour ${member} !\nMerci d'avoir ouvert un ticket. Notre équipe vous répondra dans les plus brefs délais.\n\n**Sujet :** ${topic}`
    )
    .addFields(
      { name: '👤 Membre', value: `${member} (${member.user.tag})`, inline: true },
      { name: '📅 Ouvert le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: 'Utilisez les boutons ci-dessous pour gérer le ticket' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticketNumber}`)
      .setLabel('🔒 Fermer le ticket')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_transcript_${ticketNumber}`)
      .setLabel('📋 Transcript')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketNumber}`)
      .setLabel('✋ Prendre en charge')
      .setStyle(ButtonStyle.Success),
  );

  await channel.send({
    content: `${member} ${db.tickets.supportRoleId ? `<@&${db.tickets.supportRoleId}>` : ''}`,
    embeds: [embed],
    components: [row],
  });

  // Log
  if (db.tickets.logChannelId) {
    try {
      const logChannel = await guild.channels.fetch(db.tickets.logChannelId);
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎫 Nouveau ticket ouvert')
            .addFields(
              { name: 'Numéro', value: `#${ticketNumber}`, inline: true },
              { name: 'Membre', value: `${member} (${member.user.tag})`, inline: true },
              { name: 'Salon', value: `${channel}`, inline: true },
              { name: 'Sujet', value: topic, inline: false },
            )
            .setTimestamp()
        ]
      });
    } catch (_) {}
  }

  return { channel, ticketNumber };
}

// ══════════════════════════════════════════════════════════════
//  UTILITAIRE : FERMER UN TICKET
// ══════════════════════════════════════════════════════════════

/**
 * Ferme un ticket.
 * @param {Guild} guild
 * @param {TextChannel} channel
 * @param {GuildMember} closedBy
 * @param {string} reason
 * @param {Object} ticketData
 */
async function closeTicket(guild, channel, closedBy, reason, ticketData) {
  const num = ticketData.number;

  // Générer un transcript simple
  let transcriptText = `TICKET #${num} — TRANSCRIPT\n`;
  transcriptText += `Ouvert par : ${ticketData.userId}\n`;
  transcriptText += `Fermé par : ${closedBy.user.tag}\n`;
  transcriptText += `Raison : ${reason}\n`;
  transcriptText += `Date : ${new Date().toISOString()}\n`;
  transcriptText += `${'─'.repeat(50)}\n\n`;

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    sorted.forEach(msg => {
      transcriptText += `[${new Date(msg.createdTimestamp).toISOString()}] ${msg.author.tag}: ${msg.content}\n`;
      if (msg.embeds.length > 0) transcriptText += `  [EMBED: ${msg.embeds[0].title || 'Sans titre'}]\n`;
    });
  } catch (_) {}

  // Enregistrer le ticket fermé
  const closedData = {
    ...ticketData,
    status: 'closed',
    closedAt: new Date().toISOString(),
    closedBy: closedBy.id,
    reason,
    transcript: transcriptText,
  };
  if (!db.tickets.closedTickets) db.tickets.closedTickets = {};
  db.tickets.closedTickets[num] = closedData;
  delete db.tickets.openTickets[num];
  saveData(db);

  // Embed de fermeture
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔒 Ticket fermé')
    .setDescription(`Ce ticket sera supprimé dans **5 secondes**.\nRaison : ${reason}`)
    .addFields(
      { name: 'Fermé par', value: `${closedBy}`, inline: true },
      { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });

  // Log
  if (db.tickets.logChannelId) {
    try {
      const logChannel = await guild.channels.fetch(db.tickets.logChannelId);
      // Envoyer le transcript comme fichier
      const buffer = Buffer.from(transcriptText, 'utf-8');
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🔒 Ticket fermé')
            .addFields(
              { name: 'Numéro', value: `#${num}`, inline: true },
              { name: 'Membre', value: `<@${ticketData.userId}>`, inline: true },
              { name: 'Fermé par', value: `${closedBy}`, inline: true },
              { name: 'Raison', value: reason, inline: false },
            )
            .setTimestamp()
        ],
        files: [{
          attachment: buffer,
          name: `transcript-ticket-${num}.txt`,
        }]
      });
    } catch (_) {}
  }

  // Notifier le créateur du ticket en DM
  try {
    const ticketOwner = await guild.members.fetch(ticketData.userId);
    await ticketOwner.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`🔒 Votre ticket #${num} a été fermé`)
          .addFields(
            { name: 'Serveur', value: guild.name, inline: true },
            { name: 'Fermé par', value: closedBy.user.tag, inline: true },
            { name: 'Raison', value: reason, inline: false },
          )
          .setTimestamp()
      ],
      files: [{
        attachment: Buffer.from(transcriptText, 'utf-8'),
        name: `transcript-ticket-${num}.txt`,
      }]
    });
  } catch (_) {}

  setTimeout(() => channel.delete(`Ticket #${num} fermé`).catch(() => {}), 5000);
}

// ══════════════════════════════════════════════════════════════
//  UTILITAIRE : LOGS D'ACTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Envoie un log d'action dans le salon de logs.
 * @param {Guild} guild
 * @param {string} action
 * @param {User} target
 * @param {GuildMember} moderator
 * @param {string} reason
 * @param {string} [extra]
 */
async function logAction(guild, action, target, moderator, reason, extra = '') {
  if (!db.config.logChannelId) return;
  try {
    const logChannel = await guild.channels.fetch(db.config.logChannelId);
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`📋 ${action}`)
      .addFields(
        { name: '🎯 Cible', value: `${target} (${target.tag})`, inline: true },
        { name: '👮 Modérateur', value: `${moderator}`, inline: true },
        { name: '📝 Raison', value: reason, inline: false },
      )
      .setTimestamp();
    if (extra) embed.addFields({ name: 'ℹ️ Info', value: extra, inline: false });
    embed.setThumbnail(target.displayAvatarURL());
    await logChannel.send({ embeds: [embed] });
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════════
//  UTILITAIRE : MESSAGE DE BIENVENUE
// ══════════════════════════════════════════════════════════════

/**
 * Envoie le message de bienvenue.
 * @param {GuildMember} member
 * @param {TextChannel|null} [overrideChannel]
 */
async function handleWelcome(member, overrideChannel = null) {
  const cfg = db.welcomeConfig;
  if (!cfg.enabled && !overrideChannel) return;

  let channel;
  try {
    channel = overrideChannel || await member.guild.channels.fetch(cfg.channelId);
  } catch (_) { return; }

  if (!channel) return;

  if (cfg.embedEnabled) {
    const embed = new EmbedBuilder()
      .setColor(parseColor(cfg.embedColor || '#5865F2'))
      .setTitle(replacePlaceholders(cfg.embedTitle, member))
      .setDescription(replacePlaceholders(cfg.embedDescription, member))
      .setTimestamp();

    if (cfg.embedImage) embed.setImage(cfg.embedImage);
    if (cfg.embedThumbnail) embed.setThumbnail(cfg.embedThumbnail);
    if (!cfg.embedThumbnail) embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

    await channel.send({
      content: cfg.message ? replacePlaceholders(cfg.message, member) : undefined,
      embeds: [embed],
    });
  } else {
    await channel.send(replacePlaceholders(cfg.message || `Bienvenue {user} !`, member));
  }
}

// ══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DES INTERACTIONS (BOUTONS)
// ══════════════════════════════════════════════════════════════

/**
 * Gère les interactions de type bouton.
 * @param {ButtonInteraction} interaction
 */
async function handleButtonInteraction(interaction) {
  const { customId, member, guild } = interaction;

  // ─── Bouton : Ouvrir un ticket (panneau) ──────────────────
  if (customId === 'btn_ticket_open') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await createTicket(guild, member, 'Support général');
      if (!result) {
        return interaction.editReply({ embeds: [errorEmbed('Le système de tickets est désactivé.')] });
      }
      if (result.existing) {
        return interaction.editReply({
          embeds: [errorEmbed(`Vous avez déjà un ticket ouvert : <#${result.channelId}>`)]
        });
      }
      return interaction.editReply({
        embeds: [successEmbed(`Votre ticket a été créé : <#${result.channel.id}>`)]
      });
    } catch (err) {
      console.error('[TICKET ERROR]', err);
      return interaction.editReply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
    }
  }

  // ─── Bouton : FAQ ─────────────────────────────────────────
  if (customId === 'btn_ticket_faq') {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('❓ FAQ — Questions fréquentes')
          .setDescription(
            '**Q: Comment créer un ticket ?**\nCliquez sur "Ouvrir un ticket".\n\n' +
            '**Q: Combien de temps pour une réponse ?**\nNotre équipe répond dans les 24h.\n\n' +
            '**Q: Puis-je ouvrir plusieurs tickets ?**\nNon, un seul ticket par utilisateur.\n\n' +
            '**Q: Comment fermer mon ticket ?**\nUtilisez le bouton "Fermer le ticket" dans votre salon.'
          )
          .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // ─── Boutons de gestion de ticket ─────────────────────────
  if (customId.startsWith('ticket_close_')) {
    const num = parseInt(customId.replace('ticket_close_', ''));
    const ticketData = db.tickets.openTickets[num];
    if (!ticketData) return interaction.reply({ embeds: [errorEmbed('Ticket introuvable.')], ephemeral: true });
    if (!isAdminOrMod(member) && member.id !== ticketData.userId) {
      return interaction.reply({ embeds: [errorEmbed('Permission refusée.')], ephemeral: true });
    }
    await interaction.deferReply();
    await closeTicket(guild, interaction.channel, member, 'Fermé via bouton', ticketData);
    return;
  }

  if (customId.startsWith('ticket_claim_')) {
    const num = parseInt(customId.replace('ticket_claim_', ''));
    const ticketData = db.tickets.openTickets[num];
    if (!ticketData) return interaction.reply({ embeds: [errorEmbed('Ticket introuvable.')], ephemeral: true });
    if (!isAdminOrMod(member)) return interaction.reply({ embeds: [errorEmbed('Permission refusée.')], ephemeral: true });
    ticketData.claimedBy = member.id;
    saveData(db);
    await interaction.reply({
      embeds: [successEmbed(`Ticket pris en charge par ${member}.`)]
    });
    return;
  }

  if (customId.startsWith('ticket_transcript_')) {
    const num = parseInt(customId.replace('ticket_transcript_', ''));
    if (!isAdminOrMod(member)) return interaction.reply({ embeds: [errorEmbed('Permission refusée.')], ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    let transcriptText = `TICKET #${num} — TRANSCRIPT (${new Date().toISOString()})\n${'─'.repeat(50)}\n\n`;
    try {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      sorted.forEach(msg => {
        transcriptText += `[${new Date(msg.createdTimestamp).toISOString()}] ${msg.author.tag}: ${msg.content}\n`;
      });
      const buffer = Buffer.from(transcriptText, 'utf-8');
      await interaction.editReply({
        embeds: [successEmbed('Transcript généré.')],
        files: [{ attachment: buffer, name: `transcript-${num}.txt` }]
      });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
    }
    return;
  }

  // ─── Boutons personnalisés (btn_<id>) ─────────────────────
  if (customId.startsWith('btn_')) {
    const btnId = customId.replace('btn_', '');
    const btnData = db.buttons[btnId];
    if (!btnData) return;

    const isEphemeral = btnData.ephemeral !== false;

    switch (btnData.action) {

      // ── Action : message ──────────────────────────────────
      case 'message': {
        const replyPayload = { ephemeral: isEphemeral };
        if (btnData.responseEmbed && db.embeds[btnData.responseEmbed]) {
          replyPayload.embeds = [buildEmbedFromData(db.embeds[btnData.responseEmbed], member)];
        } else {
          replyPayload.content = btnData.responseMessage || 'Bouton cliqué !';
        }
        await interaction.reply(replyPayload);
        break;
      }

      // ── Action : ticket ───────────────────────────────────
      case 'ticket': {
        await interaction.deferReply({ ephemeral: true });
        const topic = btnData.target || 'Support';
        try {
          const result = await createTicket(guild, member, topic);
          if (!result) {
            return interaction.editReply({ embeds: [errorEmbed('Le système de tickets est désactivé.')] });
          }
          if (result.existing) {
            return interaction.editReply({
              embeds: [errorEmbed(`Vous avez déjà un ticket ouvert : <#${result.channelId}>`)]
            });
          }
          return interaction.editReply({
            embeds: [successEmbed(`Votre ticket a été créé : <#${result.channel.id}>`)]
          });
        } catch (err) {
          return interaction.editReply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
        }
      }

      // ── Action : access ───────────────────────────────────
      case 'access': {
        const accessId = btnData.target;
        const accessData = db.channelAccess[accessId];
        if (!accessData) {
          return interaction.reply({ embeds: [errorEmbed('Configuration d\'accès introuvable.')], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          if (accessData.roleId) {
            // Donner/retirer le rôle
            if (accessData.type === 'toggle') {
              if (member.roles.cache.has(accessData.roleId)) {
                await member.roles.remove(accessData.roleId);
                return interaction.editReply({ embeds: [infoEmbed('🔑 Accès', `Rôle retiré.`)] });
              } else {
                await member.roles.add(accessData.roleId);
              }
            } else {
              await member.roles.add(accessData.roleId);
            }
          }

          if (accessData.channelId) {
            // Donner accès au salon
            const targetChannel = await guild.channels.fetch(accessData.channelId).catch(() => null);
            if (targetChannel) {
              await targetChannel.permissionOverwrites.edit(member, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
              });
            }
          }

          return interaction.editReply({
            embeds: [successEmbed(`✅ Accès accordé !${accessData.channelId ? ` Vous pouvez maintenant accéder à <#${accessData.channelId}>` : ''}`)]
          });
        } catch (err) {
          return interaction.editReply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
        }
      }

      // ── Action : role ─────────────────────────────────────
      case 'role': {
        const roleId = btnData.target;
        if (!roleId) {
          return interaction.reply({ embeds: [errorEmbed('Aucun rôle défini pour ce bouton.')], ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            return interaction.editReply({ embeds: [successEmbed(`Rôle <@&${roleId}> retiré.`)] });
          } else {
            await member.roles.add(roleId);
            return interaction.editReply({ embeds: [successEmbed(`Rôle <@&${roleId}> donné.`)] });
          }
        } catch (err) {
          return interaction.editReply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
        }
      }

      // ── Action : invite ───────────────────────────────────
      case 'invite': {
        const inviteId = btnData.target;
        let inviteUrl = null;

        if (inviteId && db.inviteLinks[inviteId]) {
          inviteUrl = db.inviteLinks[inviteId].url;
        } else {
          // Créer une invitation temporaire
          try {
            const inv = await interaction.channel.createInvite({ maxAge: 300, maxUses: 1 });
            inviteUrl = inv.url;
          } catch (_) {}
        }

        if (!inviteUrl) {
          return interaction.reply({ embeds: [errorEmbed('Impossible de créer une invitation.')], ephemeral: true });
        }

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('📨 Invitation')
              .setDescription(`Voici votre lien d'invitation : ${inviteUrl}`)
              .setTimestamp()
          ],
          ephemeral: isEphemeral,
        });
      }

      // ── Action : dm ───────────────────────────────────────
      case 'dm': {
        await interaction.deferReply({ ephemeral: true });
        try {
          const dmEmbed = btnData.responseEmbed && db.embeds[btnData.responseEmbed]
            ? buildEmbedFromData(db.embeds[btnData.responseEmbed], member)
            : null;

          await member.send(dmEmbed
            ? { embeds: [dmEmbed] }
            : { content: btnData.responseMessage || 'Message du serveur.' }
          );
          return interaction.editReply({ embeds: [successEmbed('Message envoyé en DM !')] });
        } catch (err) {
          return interaction.editReply({ embeds: [errorEmbed(`Impossible d'envoyer le DM : ${err.message}`)] });
        }
      }

      // ── Action : modal ────────────────────────────────────
      case 'modal': {
        const modal = new ModalBuilder()
          .setCustomId(`modal_${btnId}`)
          .setTitle(btnData.label || 'Formulaire');

        const titleInput = new TextInputBuilder()
          .setCustomId('modal_title')
          .setLabel('Titre / Sujet')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Entrez un titre...');

        const descInput = new TextInputBuilder()
          .setCustomId('modal_description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Décrivez votre demande...');

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(descInput),
        );

        await interaction.showModal(modal);
        break;
      }

      default:
        await interaction.reply({ content: '⚠️ Action inconnue.', ephemeral: true });
    }
    return;
  }
}

// ══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DES MODALS
// ══════════════════════════════════════════════════════════════

/**
 * Gère les soumissions de modals.
 * @param {ModalSubmitInteraction} interaction
 */
async function handleModalSubmit(interaction) {
  const { customId, member, guild } = interaction;

  if (customId.startsWith('modal_')) {
    const btnId = customId.replace('modal_', '');
    const btnData = db.buttons[btnId];

    const title = interaction.fields.getTextInputValue('modal_title');
    const desc  = interaction.fields.getTextInputValue('modal_description');

    // Si le bouton est configuré pour créer un ticket avec le sujet du modal
    if (btnData && btnData.action === 'modal') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await createTicket(guild, member, `${title}: ${desc}`);
        if (!result) return interaction.editReply({ embeds: [errorEmbed('Système de tickets désactivé.')] });
        if (result.existing) return interaction.editReply({ embeds: [errorEmbed(`Ticket déjà ouvert : <#${result.channelId}>`)] });
        return interaction.editReply({ embeds: [successEmbed(`Ticket créé : <#${result.channel.id}>`)] });
      } catch (err) {
        return interaction.editReply({ embeds: [errorEmbed(`Erreur : ${err.message}`)] });
      }
    }

    // Par défaut : afficher la soumission dans le salon de logs
    const logEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📝 Formulaire soumis — ${title}`)
      .setDescription(desc)
      .addFields(
        { name: 'Soumis par', value: `${member} (${member.user.tag})`, inline: true },
        { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      )
      .setTimestamp();

    if (db.config.logChannelId) {
      try {
        const logChannel = await guild.channels.fetch(db.config.logChannelId);
        await logChannel.send({ embeds: [logEmbed] });
      } catch (_) {}
    }

    return interaction.reply({ embeds: [successEmbed('Formulaire soumis avec succès !')], ephemeral: true });
  }
}

// ══════════════════════════════════════════════════════════════
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = db.config.prefix;
  const msgRaw = message.content; // texte exact
  const msgLower = message.content.toLowerCase(); // pour comparer

  // ─────────────── COMMANDE !lien ───────────────
  if (msgLower === `${prefix}lien`) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("🌐 Rejoindre le serveur")
        .setURL("https://discord.gg/GEhgWcyM")
        .setStyle(ButtonStyle.Link)
    );

    return message.channel.send({
      content: "🔗 **Clique ici pour rejoindre le serveur :**",
      components: [row]
    });
  }

  // ─────────────── COMMANDE !pay ───────────────
  if (msgLower === `${prefix}pay`) {
    const embed = new EmbedBuilder()
      .setTitle("💰 Moyens de paiement")
      .setColor(0x00AE86)
      .setDescription("Voici tous les moyens pour soutenir :")
      .addFields(
        { name: "💳 PayPal", value: "paypal.me/tonlien", inline: false },
        { name: "⭐ Patreon", value: "patreon.com/tonprojet", inline: false },
        { name: "☕ Ko-fi", value: "ko-fi.com/tonprojet", inline: false },
        { name: "💰 Revolut", value: "+33 XX XX XX XX XX", inline: false },
        { name: "₿ Bitcoin (BTC)", value: "TON_ADRESSE_BTC_ICI", inline: false },
        { name: "Ł Litecoin (LTC)", value: "TON_ADRESSE_LTC_ICI", inline: false },
        { name: "Ξ Ethereum (ETH)", value: "TON_ADRESSE_ETH_ICI", inline: false },
        { name: "ɱ Monero (XMR)", value: "TON_ADRESSE_XMR_ICI", inline: false }
      )
      .setFooter({ text: "Merci pour le soutien ❤️" })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // ─────────────── COMMANDE !say ───────────────
  if (msgLower.startsWith(`${prefix}say`)) {
    const raw = msgRaw.slice(prefix.length + 3).trim(); // texte EXACT
    const separatorIndex = raw.indexOf('--');

    if (separatorIndex === -1) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ Utilisation : `-say #salon -- message`")
        ]
      });
    }

    const targetsPart = raw.slice(0, separatorIndex).trim();
    const text = raw.slice(separatorIndex + 2).trim();

    if (!text) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ Vous devez écrire un message.")
        ]
      });
    }

    const channelsToSend = new Set();

    for (const channel of message.mentions.channels.values()) {
      if (channel.isTextBased()) channelsToSend.add(channel);
    }

    const ids = targetsPart.match(/\d{17,20}/g) || [];
    for (const id of ids) {
      const target = message.guild.channels.cache.get(id);
      if (!target) continue;

      if (target.type === 4) {
        const childChannels = message.guild.channels.cache.filter(
          c => c.parentId === target.id && c.isTextBased()
        );
        for (const ch of childChannels.values()) channelsToSend.add(ch);
      } else if (target.isTextBased()) {
        channelsToSend.add(target);
      }
    }

    if (channelsToSend.size === 0) channelsToSend.add(message.channel);

    for (const channel of channelsToSend) {
      try {
        await channel.send({
          content: text,
          allowedMentions: { parse: ['users', 'roles'] }
        });
      } catch (err) {
        console.error(`[SAY] erreur ${channel.name}`, err);
      }
    }

    return message.react('✅');
  }

  // ─────────────── CUSTOM COMMANDS ───────────────
  if (!message.content.startsWith(prefix)) {
    const cmdName = message.content.trim().toLowerCase().split(/\s+/)[0];
    if (db.customCommands[cmdName]) {
      const cc = db.customCommands[cmdName];
      cc.uses = (cc.uses || 0) + 1;
      saveData(db);

      const payload = {};
      if (cc.embedId && db.embeds[cc.embedId]) {
        payload.embeds = [buildEmbedFromData(db.embeds[cc.embedId], message.member)];
      }
      if (cc.response) payload.content = replacePlaceholders(cc.response, message.member);

      if (Object.keys(payload).length > 0) await message.reply(payload);
    }
    return;
  }

  // ─────────────── COMMANDES PREFIX (HANDLER) ───────────────
  const args = msgRaw.slice(prefix.length).trim().split(/\s+/);
  const cmdName = args.shift().toLowerCase();
  const handler = commands.get(cmdName);
  if (!handler) return;

  try {
    await handler(message, args);
  } catch (err) {
    console.error(`[COMMANDE ERROR] ${cmdName}:`, err);
    try {
      await message.reply({
        embeds: [errorEmbed(`Une erreur est survenue : \`${err.message}\``)]
      });
    } catch (_) {}
  }
});

// ─── Interactions ──────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (err) {
    console.error('[INTERACTION ERROR]', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed(`Erreur : ${err.message}`)], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed(`Erreur : ${err.message}`)], ephemeral: true });
      }
    } catch (_) {}
  }
});

// ─── Nouveau membre ───────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  // Message de bienvenue
  await handleWelcome(member);

  // Rôle automatique
  if (db.autoRole.enabled && db.autoRole.roleId) {
    try {
      await member.roles.add(db.autoRole.roleId);
    } catch (err) {
      console.error('[AUTOROLE ERROR]', err.message);
    }
  }
});

// ─── Départ d'un membre ───────────────────────────────────────
client.on(Events.GuildMemberRemove, async (member) => {
  if (!db.config.logChannelId) return;
  try {
    const logChannel = await member.guild.channels.fetch(db.config.logChannelId);
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('👋 Membre parti')
          .setDescription(`${member.user.tag} a quitté le serveur.`)
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: 'ID', value: member.user.id, inline: true },
            { name: 'Rejoint le', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Inconnu', inline: true },
          )
          .setTimestamp()
      ]
    });
  } catch (_) {}
});

// ─── Réactions (Reaction Roles) ────────────────────────────────
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (_) { return; }
  }

  const msgId = reaction.message.id;
  if (!db.reactionRoles[msgId]) return;

  const emojiName = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
  const roleId = db.reactionRoles[msgId][emojiName] || db.reactionRoles[msgId][reaction.emoji.name];
  if (!roleId) return;

  try {
    const guild  = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    await member.roles.add(roleId);
  } catch (err) {
    console.error('[REACTION ROLE ADD]', err.message);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (_) { return; }
  }

  const msgId = reaction.message.id;
  if (!db.reactionRoles[msgId]) return;

  const emojiName = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
  const roleId = db.reactionRoles[msgId][emojiName] || db.reactionRoles[msgId][reaction.emoji.name];
  if (!roleId) return;

  try {
    const guild  = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    await member.roles.remove(roleId);
  } catch (err) {
    console.error('[REACTION ROLE REMOVE]', err.message);
  }
});

// ─── Suppression de message (log) ─────────────────────────────
client.on(Events.MessageDelete, async (message) => {
  if (!db.config.logChannelId) return;
  if (message.author?.bot) return;
  if (!message.content) return;
  try {
    const logChannel = await message.guild.channels.fetch(db.config.logChannelId);
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🗑️ Message supprimé')
          .setDescription(message.content.slice(0, 1024))
          .addFields(
            { name: 'Auteur', value: `${message.author} (${message.author.tag})`, inline: true },
            { name: 'Salon', value: `${message.channel}`, inline: true },
          )
          .setTimestamp()
      ]
    });
  } catch (_) {}
});

// ─── Modification de message (log) ────────────────────────────
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!db.config.logChannelId) return;
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  try {
    const logChannel = await oldMessage.guild.channels.fetch(db.config.logChannelId);
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('✏️ Message modifié')
          .addFields(
            { name: 'Avant', value: (oldMessage.content || 'Vide').slice(0, 1024), inline: false },
            { name: 'Après', value: (newMessage.content || 'Vide').slice(0, 1024), inline: false },
            { name: 'Auteur', value: `${oldMessage.author} (${oldMessage.author.tag})`, inline: true },
            { name: 'Salon', value: `${oldMessage.channel}`, inline: true },
            { name: '🔗 Lien', value: `[Voir le message](${newMessage.url})`, inline: true },
          )
          .setTimestamp()
      ]
    });
  } catch (_) {}
});

// ─── Erreurs non gérées ───────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

// ══════════════════════════════════════════════════════════════
//  DÉMARRAGE DU BOT
// ══════════════════════════════════════════════════════════════

const token = process.env.DISCORD_TOKEN || db.config.token;
if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ TOKEN MANQUANT !');
  console.error('Définissez votre token dans data.json (config.token) ou via la variable d\'environnement DISCORD_TOKEN.');
  process.exit(1);
}

client.login(token).then(() => {
  console.log('✅ Connexion au token réussie.');
}).catch(err => {
  console.error('❌ Erreur de connexion :', err.message);
  process.exit(1);
});

client.on('interactionCreate', async (interaction) => {
  try {

    // =========================
    // TICKET MENU
    // =========================
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category_select') {

      const selectedCategory = interaction.values[0];
      const user = interaction.user;
      const guild = interaction.guild;

      await interaction.deferReply({ ephemeral: true });

      if (!db.tickets.enabled) {
        return interaction.editReply('❌ Les tickets sont désactivés.');
      }

      const categoryId = db.tickets.categories?.[selectedCategory];
      if (!categoryId) return interaction.editReply(`❌ Aucune catégorie configurée pour : ${selectedCategory}`);

      const categoryChannel = guild.channels.cache.get(categoryId);
      if (!categoryChannel) return interaction.editReply('❌ Catégorie introuvable.');

      if (!db.tickets.openTickets) db.tickets.openTickets = {};

      const existing = Object.values(db.tickets.openTickets)
        .find(t => t.userId === user.id);

      if (existing) return interaction.editReply(`❌ Vous avez déjà un ticket : <#${existing.channelId}>`);

      const ticketNumber = (db.tickets.counter || 0) + 1;
      db.tickets.counter = ticketNumber;

      const channel = await guild.channels.create({
        name: `ticket-${ticketNumber}`,
        type: 0,
        parent: categoryChannel.id,
        permissionOverwrites: [
          { id: guild.id, deny: ['ViewChannel'] },
          { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          { id: "1505993873200250891", allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          ...(db.tickets.supportRoleIds || []).map(roleId => ({
            id: roleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          })),
        ],
      });

      db.tickets.openTickets[ticketNumber] = {
        number: ticketNumber,
        userId: user.id,
        channelId: channel.id,
        category: selectedCategory,
        claimedBy: null,
      };

      saveData(db);

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription(`👤 <@${user.id}>\n📂 ${selectedCategory}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${ticketNumber}`)
          .setLabel('Claim')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketNumber}`)
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@${user.id}>`,
        embeds: [ticketEmbed],
        components: [row],
      });

      return interaction.editReply(`✅ Ticket créé : <#${channel.id}>`);
    }

  } catch (err) {
    console.error('❌ Erreur interactionCreate :', err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        ephemeral: true,
      });
    }
  }
});