require("dotenv").config({ path: "./dmall-noctur/.env" });
console.log("TOKEN =", process.env.TOKEN);

// ============================================================
//  DMAll Bot v3 — Système de DM Massif Professionnel
//  Fichier unique • Architecture modulaire interne
//  +4000 lignes • Commandes préfixe &
// ============================================================

'use strict';

const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ActivityType,
    EmbedBuilder,
    Collection,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ============================================================
//  SECTION 1 — CONFIGURATION & ÉTAT GLOBAL
// ============================================================

const DATA_PATH = path.join(__dirname, 'data.json');
const LOG_DIR = path.join(__dirname, 'logs');

let CONFIG = {
    token: '',
    prefix: '&',
    ownerIds: [],
    optout: [],
    guilds: {},
    global: {
        cooldowns: {},
        startupCount: 0,
    },
    templates: {},
    schedules: [],
    blacklists: {},
    whitelists: {},
    stats: {},
    settings: {},
};

function loadConfig() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf8');
            const loaded = JSON.parse(raw);
            CONFIG = deepMerge(CONFIG, loaded);
            if (!CONFIG.token) {
                console.error('[ERREUR] Token manquant dans data.json');
                process.exit(1);
            }
        } else {
            fs.writeFileSync(DATA_PATH, JSON.stringify(CONFIG, null, 4), 'utf8');
            console.log('[INFO] data.json cree avec les valeurs par defaut. Ajoutez votre token.');
            process.exit(0);
        }
    } catch (err) {
        console.error('[ERREUR] Lecture data.json:', err.message);
        process.exit(1);
    }
}

function saveConfig() {
    try {
        const tmp = DATA_PATH + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(CONFIG, null, 4), 'utf8');
        fs.renameSync(tmp, DATA_PATH);
    } catch (err) {
        console.error('[ERREUR] Sauvegarde data.json:', err.message);
    }
}

function deepMerge(target, source) {
    const output = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            output[key] = source[key];
        }
    }
    return output;
}

// ============================================================
//  SECTION 2 — LOGGER
// ============================================================

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

let currentLogFile = '';

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFile() {
    const now = new Date();
    return path.join(
        LOG_DIR,
        `dmall_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.log`
    );
}

function ts() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function writeLog(level, message) {
    ensureLogDir();
    const file = getLogFile();
    const line = `[${ts()}] [${level}] ${message}\n`;
    fs.appendFileSync(file, line, 'utf8');
    if (currentLogFile !== file) {
        currentLogFile = file;
        const files = fs.readdirSync(LOG_DIR);
        const cutoff = Date.now() - 7 * 86400000;
        for (const f of files) {
            const p = path.join(LOG_DIR, f);
            if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
        }
    }
}

const logger = {
    info: (m) => { console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.green}[INFO]${COLORS.reset} ${m}`); writeLog('INFO', m); },
    warn: (m) => { console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.yellow}[WARN]${COLORS.reset} ${m}`); writeLog('WARN', m); },
    error: (m) => { console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.red}[ERROR]${COLORS.reset} ${m}`); writeLog('ERROR', m); },
    debug: (m) => { console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.cyan}[DEBUG]${COLORS.reset} ${m}`); writeLog('DEBUG', m); },
    dm: (m) => { writeLog('DM', m); },
};

// ============================================================
//  SECTION 3 — COOLDOWN MANAGER
// ============================================================

const cooldownMap = new Map();

const cooldown = {
    check(userId, cmd, ms) {
        const key = `${userId}:${cmd}`;
        const entry = cooldownMap.get(key);
        if (entry && Date.now() < entry.expires) {
            return { active: true, remaining: Math.ceil((entry.expires - Date.now()) / 1000) };
        }
        return { active: false, remaining: 0 };
    },
    set(userId, cmd, ms) {
        cooldownMap.set(`${userId}:${cmd}`, { expires: Date.now() + ms });
    },
    sweep() {
        const now = Date.now();
        for (const [k, v] of cooldownMap) {
            if (now >= v.expires) cooldownMap.delete(k);
        }
    },
};

setInterval(() => cooldown.sweep(), 300000);

// ============================================================
//  SECTION 4 — RATE LIMITER (Token Bucket)
// ============================================================

class RateLimiter {
    constructor(maxTokens = 45, refillMs = 11000) {
        this.maxTokens = maxTokens;
        this.refillMs = refillMs;
        this.tokens = maxTokens;
        this.lastRefill = Date.now();
        this.consecutive429 = 0;
    }

    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        if (elapsed >= this.refillMs) {
            this.tokens = this.maxTokens;
            this.lastRefill = now;
        }
    }

    async acquire() {
        this.refill();
        if (this.tokens > 0) {
            this.tokens--;
            return;
        }
        const wait = this.refillMs - (Date.now() - this.lastRefill) + 200;
        await new Promise((r) => setTimeout(r, wait));
        this.refill();
        this.tokens = Math.max(0, this.tokens - 1);
    }

    hit429(retryAfter) {
        this.consecutive429++;
        this.tokens = 0;
        return Math.min(retryAfter + this.consecutive429 * 2000, 60000);
    }

    success() {
        this.consecutive429 = Math.max(0, this.consecutive429 - 1);
    }
}

async function processBatch(items, fn, opts = {}) {
    const { batchSize = 90, delayMs = 4000, onTick = null, cancelFn = null } = opts;
    const limiter = new RateLimiter(batchSize, delayMs);
    let ok = 0, fail = 0, blocked = 0, done = 0;
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
        if (cancelFn && cancelFn()) break;
        await limiter.acquire();

        try {
            const res = await fn(items[i], i);
            if (res === 'success') { ok++; limiter.success(); }
            else if (res === 'blocked') { blocked++; limiter.success(); }
            else { fail++; }
        } catch (err) {
            if (err.code === 429 || err.httpStatus === 429) {
                const backoff = limiter.hit429((err.retryAfter || 5) * 1000);
                await new Promise((r) => setTimeout(r, backoff));
                try {
                    const r2 = await fn(items[i], i);
                    if (r2 === 'success') ok++; else if (r2 === 'blocked') blocked++; else fail++;
                    done++;
                    if (onTick) onTick(done, total, ok, fail, blocked);
                    continue;
                } catch (_) { fail++; }
            } else {
                if (err.code === 50007) blocked++; else fail++;
            }
        }
        done++;
        if (onTick && done % 10 === 0) onTick(done, total, ok, fail, blocked);
    }
    if (onTick) onTick(done, total, ok, fail, blocked);
    return { ok, fail, blocked, done, total };
}

// ============================================================
//  SECTION 5 — TEMPLATE ENGINE
// ============================================================

const TEMPLATE_VARS = [
    { key: '{user}', desc: 'Mention du membre' },
    { key: '{username}', desc: 'Nom d\'utilisateur' },
    { key: '{displayname}', desc: 'Nom d\'affichage sur le serveur' },
    { key: '{server}', desc: 'Nom du serveur' },
    { key: '{membercount}', desc: 'Nombre de membres' },
    { key: '{date}', desc: 'Date actuelle (JJ/MM/AAAA)' },
    { key: '{time}', desc: 'Heure actuelle (HH:MM:SS)' },
    { key: '{datetime}', desc: 'Date + heure' },
    { key: '{ownername}', desc: 'Nom du proprietaire' },
    { key: '{guildid}', desc: 'ID du serveur' },
    { key: '{userid}', desc: 'ID de l\'utilisateur' },
    { key: '{joindate}', desc: 'Date d\'arrivee du membre' },
    { key: '{random}', desc: 'Nombre aleatoire (1000-9999)' },
];

function renderTemplate(tmpl, member, guild) {
    const now = new Date();
    const d = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const jd = member.joinedAt
        ? `${String(member.joinedAt.getDate()).padStart(2, '0')}/${String(member.joinedAt.getMonth() + 1).padStart(2, '0')}/${member.joinedAt.getFullYear()}`
        : 'Inconnue';
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    const owner = guild.members.cache.get(guild.ownerId)?.user?.username || 'Inconnu';

    const reps = {
        '{user}': member.toString(),
        '{username}': member.user.username,
        '{displayname}': member.displayName,
        '{server}': guild.name,
        '{membercount}': String(guild.memberCount),
        '{date}': d,
        '{time}': t,
        '{datetime}': `${d} ${t}`,
        '{ownername}': owner,
        '{guildid}': guild.id,
        '{userid}': member.user.id,
        '{joindate}': jd,
        '{random}': String(rnd),
    };

    let out = tmpl;
    for (const [k, v] of Object.entries(reps)) {
        out = out.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v);
    }
    return out;
}

function previewTemplate(tmpl, guild) {
    const dummy = {
        toString: () => '@Exemple',
        user: { username: 'Exemple', id: '123456789' },
        displayName: 'Exemple Display',
        joinedAt: new Date(),
    };
    return renderTemplate(tmpl, dummy, guild);
}

function validateTemplate(tmpl) {
    const errs = [];
    if (!tmpl || !tmpl.trim()) errs.push('Le message est vide.');
    if (tmpl && tmpl.length > 2000) errs.push('Le message depasse 2000 caracteres (limite Discord).');
    return { valid: errs.length === 0, errors: errs };
}

// ============================================================
//  SECTION 6 — STATISTICS
// ============================================================

function getGuildStats(guildId) {
    if (!CONFIG.stats[guildId]) {
        CONFIG.stats[guildId] = {
            totalSent: 0,
            totalFailed: 0,
            totalBlocked: 0,
            totalCampaigns: 0,
            campaigns: [],
        };
    }
    return CONFIG.stats[guildId];
}

function recordCampaign(guildId, data) {
    const st = getGuildStats(guildId);
    const camp = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: Date.now(),
        total: data.total || 0,
        ok: data.ok || 0,
        fail: data.fail || 0,
        blocked: data.blocked || 0,
        duration: data.duration || 0,
        cancelled: data.cancelled || false,
        targetType: data.targetType || 'all',
        roleName: data.roleName || null,
        by: data.by || 'Unknown',
        template: data.template || null,
    };
    st.totalSent += camp.ok;
    st.totalFailed += camp.fail;
    st.totalBlocked += camp.blocked;
    st.totalCampaigns++;
    st.campaigns.unshift(camp);
    if (st.campaigns.length > 50) st.campaigns = st.campaigns.slice(0, 50);
    saveConfig();
    return camp;
}

function getFilteredStats(guildId, period) {
    const st = getGuildStats(guildId);
    const now = Date.now();
    const windows = { '24h': 86400000, '7d': 604800000, '30d': 2592000000, all: Infinity };
    const cutoff = now - (windows[period] || Infinity);
    const filtered = st.campaigns.filter((c) => c.timestamp >= cutoff);
    const total = filtered.length;
    const sent = filtered.reduce((s, c) => s + c.ok, 0);
    const fail = filtered.reduce((s, c) => s + c.fail, 0);
    const blk = filtered.reduce((s, c) => s + c.blocked, 0);
    const attempts = sent + fail + blk;
    return {
        period,
        totalCampaigns: total,
        totalSent: sent,
        totalFailed: fail,
        totalBlocked: blk,
        avgSuccessRate: attempts > 0 ? ((sent / attempts) * 100).toFixed(1) : '0.0',
        allTimeSent: st.totalSent,
        allTimeFailed: st.totalFailed,
        allTimeBlocked: st.totalBlocked,
        allTimeCampaigns: st.totalCampaigns,
        recent: filtered.slice(0, 5),
    };
}

// ============================================================
//  SECTION 7 — HELPERS GUILD DATA
// ============================================================

function guildKey(guildId) {
    if (!CONFIG.guilds[guildId]) {
        CONFIG.guilds[guildId] = {
            optouts: [],
            blacklist: [],
            whitelist: [],
            whitelistMode: false,
            enabled: true,
            templates: {},
            schedules: [],
        };
    }
    return CONFIG.guilds[guildId];
}

function ensureGuild(guildId) {
    guildKey(guildId);
    if (!CONFIG.stats[guildId]) getGuildStats(guildId);
}

// ============================================================
//  SECTION 8 — DMALL CORE ENGINE
// ============================================================

const activeTasks = new Map();

async function executeDmAll(client, message, templateText, targetType, roleOrUser, templateName) {
    const guild = message.guild;
    const gd = guildKey(guild.id);
    const prefix = CONFIG.prefix;

    // Validation
    const v = validateTemplate(templateText);
    if (!v.valid) return message.reply('Erreur template:\n' + v.errors.map((e) => '- ' + e).join('\n'));

    // Options désactivé
    if (gd.enabled === false) {
        return message.reply('DMAll desactive sur ce serveur. `' + prefix + 'dmsettings enable` pour reactiver.');
    }

    // Chargement membres
    const statMsg = await message.channel.send('Chargement des membres...');
    try {
        await guild.members.fetch();
    } catch (err) {
        return statMsg.edit('Erreur chargement membres: ' + err.message);
    }

    // Filtrage
    const optouts = new Set(gd.optouts || []);
    const bl = new Set(gd.blacklist || []);
    const wl = new Set(gd.whitelist || []);
    const wlMode = gd.whitelistMode || false;

    let pool;
    if (targetType === 'role' && roleOrUser) {
        pool = roleOrUser.members.filter((m) => {
            if (m.user.bot) return false;
            if (optouts.has(m.user.id)) return false;
            if (wlMode && !wl.has(m.user.id)) return false;
            if (!wlMode && bl.has(m.user.id)) return false;
            return true;
        });
    } else if (targetType === 'user' && roleOrUser) {
        pool = [roleOrUser];
    } else {
        pool = guild.members.cache.filter((m) => {
            if (m.user.bot) return false;
            if (optouts.has(m.user.id)) return false;
            if (wlMode && !wl.has(m.user.id)) return false;
            if (!wlMode && bl.has(m.user.id)) return false;
            return true;
        });
    }
    const members = Array.from(pool.values ? pool.values() : pool);

    if (members.length === 0) {
        return statMsg.edit('Aucun membre eligible (bots, optouts, blacklist/whitelist filtres).');
    }

    // Tâche active
    const task = {
        cancelled: false,
        total: members.length,
        startTime: Date.now(),
        completed: 0,
        ok: 0,
        fail: 0,
        blocked: 0,
        by: message.author.tag,
    };
    activeTasks.set(guild.id, task);

    const label = targetType === 'role'
        ? `Role @${roleOrUser.name}`
        : targetType === 'user'
            ? `Test vers ${roleOrUser.user.username}`
            : 'Tous les membres';

    await statMsg.edit(
        `DMAll lance vers **${members.length}** membres\n` +
        `Cible: ${label}${templateName ? '\nTemplate: ' + templateName : ''}`
    );

    let progMsg = await message.channel.send('Initialisation...');

    const updateTick = async (done, total, ok, fail, blocked) => {
        task.completed = done;
        task.ok = ok;
        task.fail = fail;
        task.blocked = blocked;
        const pct = ((done / total) * 100).toFixed(1);
        try {
            await progMsg.edit(`Progression ${done}/${total} (${pct}%) | OK: ${ok} | Echec: ${fail} | Bloque: ${blocked}`);
        } catch (_) {}
    };

    const start = Date.now();
    const result = await processBatch(
        members,
        async (member) => {
            if (task.cancelled) return 'cancelled';
            const msgText = renderTemplate(templateText, member, guild);
            try {
                await member.send(msgText);
                logger.dm(`OK -> ${member.user.tag} (${guild.name})`);
                return 'success';
            } catch (err) {
                logger.dm(`FAIL -> ${member.user.tag}: ${err.code || err.message}`);
                if (err.code === 50007) return 'blocked';
                return 'failed';
            }
        },
        {
            batchSize: 90,
            delayMs: 4000,
            onTick: updateTick,
            cancelFn: () => task.cancelled,
        }
    );

    const dur = ((Date.now() - start) / 1000).toFixed(1);

    recordCampaign(guild.id, {
        total: result.total,
        ok: result.ok,
        fail: result.fail,
        blocked: result.blocked,
        duration: parseFloat(dur),
        cancelled: task.cancelled,
        targetType,
        roleName: targetType === 'role' ? roleOrUser?.name : null,
        by: message.author.tag,
        template: templateName,
    });

    activeTasks.delete(guild.id);

    const emb = new EmbedBuilder()
        .setColor(task.cancelled ? 0xe74c3c : result.fail === 0 && result.blocked === 0 ? 0x2ecc71 : 0xe67e22)
        .setTitle(task.cancelled ? 'DMAll Annule' : 'DMAll Termine')
        .addFields(
            { name: 'Duree', value: dur + 's', inline: true },
            { name: 'Envoyes', value: String(result.ok), inline: true },
            { name: 'Echoues', value: String(result.fail), inline: true },
            { name: 'Bloques', value: String(result.blocked), inline: true },
            { name: 'Total', value: String(result.total), inline: true },
            { name: 'Succes', value: result.total > 0 ? ((result.ok / result.total) * 100).toFixed(1) + '%' : 'N/A', inline: true },
        )
        .setFooter({ text: `Initie par ${message.author.tag} | ${prefix}stats pour historique` })
        .setTimestamp();

    await progMsg.edit({ content: '', embeds: [emb] }).catch(() => {});
}

// ============================================================
//  SECTION 9 — COMMAND HANDLER
// ============================================================

const commands = new Collection();

function registerCommand(cmd) {
    commands.set(cmd.name, cmd);
    if (cmd.aliases) cmd.aliases.forEach((a) => commands.set(a, cmd));
}

// ----- &dmhelp --------------------------------------------------

registerCommand({
    name: 'dmhelp',
    aliases: ['help', 'dmh'],
    cooldown: 2,
    description: 'Affiche la liste des commandes du bot.',
    usage: ['&dmhelp', '&dmhelp <commande>'],
    async execute(client, message, args) {
        const prefix = CONFIG.prefix;
        const cmdName = args[0]?.toLowerCase();

        // Aide détaillée d'une commande
        if (cmdName) {
            const cmd = commands.get(cmdName);
            if (!cmd) return message.reply(`Commande \`${cmdName}\` introuvable. Faites \`${prefix}dmhelp\` pour la liste.`);
            const emb = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`Aide : ${prefix}${cmd.name}`)
                .setDescription(cmd.description || 'Aucune description.')
                .addFields(
                    { name: 'Usage', value: (cmd.usage || [`${prefix}${cmd.name}`]).map((u) => `\`${u}\``).join('\n') },
                    { name: 'Alias', value: cmd.aliases ? cmd.aliases.map((a) => `\`${a}\``).join(', ') : 'Aucun', inline: true },
                    { name: 'Cooldown', value: cmd.cooldown ? `${cmd.cooldown}s` : 'Aucun', inline: true },
                    { name: 'Permission', value: cmd.permissions ? 'Administrateur' : 'Aucune', inline: true },
                )
                .setFooter({ text: `Prefix: ${prefix}` });
            return message.channel.send({ embeds: [emb] });
        }

        // Aide générale paginée
        const pages = [
            {
                title: 'Commandes Principales',
                color: 0x3498db,
                cmds: [
                    ['dmall', 'Envoi DM massif'],
                    ['cancel', 'Annuler DMAll en cours'],
                    ['status', 'Progression DMAll en cours'],
                    ['optout', 'Ne plus recevoir de DMs'],
                    ['optin', 'Reactivation des DMs'],
                ],
            },
            {
                title: 'Templates',
                color: 0x2ecc71,
                cmds: [
                    ['template create', 'Creer un template'],
                    ['template list', 'Lister les templates'],
                    ['template delete', 'Supprimer un template'],
                    ['template edit', 'Modifier un template'],
                    ['template preview', 'Apercu d\'un template'],
                ],
            },
            {
                title: 'Ciblage',
                color: 0xe67e22,
                cmds: [
                    ['blacklist add', 'Ajouter a la blacklist'],
                    ['blacklist remove', 'Retirer de la blacklist'],
                    ['blacklist list', 'Voir la blacklist'],
                    ['whitelist add', 'Ajouter a la whitelist'],
                    ['whitelist remove', 'Retirer de la whitelist'],
                    ['whitelist list', 'Voir la whitelist'],
                    ['whitelist toggle', 'Activer/desactiver le mode whitelist'],
                ],
            },
            {
                title: 'Planification & Stats',
                color: 0x9b59b6,
                cmds: [
                    ['schedule', 'Planifier un DMAll'],
                    ['schedule list', 'Voir les plannifications'],
                    ['schedule delete', 'Supprimer une planification'],
                    ['stats', 'Statistiques'],
                    ['dmsettings', 'Parametres du bot sur le serveur'],
                ],
            },
        ];

        let pageIdx = 0;
        if (args[0] && !isNaN(args[0])) pageIdx = Math.max(0, Math.min(pages.length - 1, parseInt(args[0]) - 1));

        const page = pages[pageIdx];
        const emb = new EmbedBuilder()
            .setColor(page.color)
            .setTitle(`DMAll Bot — ${page.title}`)
            .setDescription(page.cmds.map(([n, d]) => `\`${prefix}${n}\` — ${d}`).join('\n'))
            .addFields({
                name: 'Navigation',
                value: `Page ${pageIdx + 1}/${pages.length} • \`${prefix}dmhelp <page>\` pour naviguer\n` +
                       `\`${prefix}dmhelp <commande>\` pour le detail d'une commande`,
            })
            .setFooter({ text: `Prefix: ${prefix} | Variables: {user} {username} {server} {membercount} {date} {time} ...` });

        return message.channel.send({ embeds: [emb] });
    },
});

// ----- &dmall ---------------------------------------------------

registerCommand({
    name: 'dmall',
    aliases: ['dm', 'sendall', 'massdm'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 15,
    description: 'Envoi massif de DMs. Supporte role, template, preview, test.',
    usage: [
        '&dmall <message>',
        '&dmall role <@role> <message>',
        '&dmall template <nom>',
        '&dmall preview <message>',
        '&dmall test <@user> <message>',
    ],
    async execute(client, message, args) {
        if (args.length === 0) {
            const prefix = CONFIG.prefix;
            const emb = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('Commande DMAll')
                .setDescription('Envoie un DM personnalise a tous les membres.')
                .addFields(
                    {
                        name: 'Usages',
                        value: [
                            `\`${prefix}dmall <message>\` — Envoi a tous`,
                            `\`${prefix}dmall role <@role> <message>\` — Par role`,
                            `\`${prefix}dmall template <nom>\` — Template sauvegarde`,
                            `\`${prefix}dmall preview <message>\` — Apercu`,
                            `\`${prefix}dmall test <@user> <message>\` — Test sur 1 membre`,
                        ].join('\n'),
                    },
                    {
                        name: 'Variables',
                        value: TEMPLATE_VARS.map((v) => `\`${v.key}\` ${v.desc}`).join('\n'),
                    },
                )
                .setFooter({ text: `${prefix}dmhelp dmall pour plus de details` });
            return message.channel.send({ embeds: [emb] });
        }

        const sub = args[0].toLowerCase();

        if (sub === 'preview') {
            const tmpl = args.slice(1).join(' ');
            if (!tmpl) return message.reply('Usage: `&dmall preview <message>`');
            const v = validateTemplate(tmpl);
            if (!v.valid) return message.reply('Erreurs:\n' + v.errors.map((e) => '- ' + e).join('\n'));
            const prev = previewTemplate(tmpl, message.guild);
            const emb = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Apercu du message')
                .setDescription(prev.length > 2000 ? prev.slice(0, 1997) + '...' : prev)
                .setFooter({ text: 'Donnees factices pour la preview' });
            return message.channel.send({ embeds: [emb] });
        }

        if (sub === 'test') {
            if (args.length < 3) return message.reply('Usage: `&dmall test <@user> <message>`');
            const uid = args[1].replace(/[<@!>]/g, '');
            const member = await message.guild.members.fetch(uid).catch(() => null);
            if (!member) return message.reply('Utilisateur introuvable.');
            if (member.user.bot) return message.reply('Impossible avec un bot.');
            const tmpl = args.slice(2).join(' ');
            return executeDmAll(client, message, tmpl, 'user', member, null);
        }

        if (sub === 'role') {
            if (args.length < 3) return message.reply('Usage: `&dmall role <@role> <message>`');
            const rid = args[1].replace(/[<@&>]/g, '');
            const role = message.guild.roles.cache.get(rid);
            if (!role) return message.reply('Role introuvable.');
            const tmpl = args.slice(2).join(' ');
            return executeDmAll(client, message, tmpl, 'role', role, null);
        }

        if (sub === 'template') {
            const name = args[1]?.toLowerCase();
            if (!name) return message.reply('Usage: `&dmall template <nom>`');
            const gd = guildKey(message.guild.id);
            const t = gd.templates[name];
            if (!t) {
                const list = Object.keys(gd.templates).join(', ') || 'aucun';
                return message.reply(`Template \`${name}\` introuvable. Disponibles: ${list}`);
            }
            return executeDmAll(client, message, t.content, 'all', null, name);
        }

        // DMAll classique
        const tmpl = args.join(' ');
        return executeDmAll(client, message, tmpl, 'all', null, null);
    },
});

// ----- &cancel --------------------------------------------------

registerCommand({
    name: 'cancel',
    aliases: ['stop', 'abort'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 3,
    description: 'Annule le DMAll en cours.',
    usage: ['&cancel'],
    async execute(client, message) {
        const task = activeTasks.get(message.guild.id);
        if (!task || task.cancelled) return message.reply('Aucun DMAll en cours.');
        task.cancelled = true;
        task.cancelledAt = Date.now();
        task.cancelledBy = message.author.tag;
        const emb = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('Annulation demandee')
            .setDescription('Le DMAll en cours va s\'arreter.')
            .addFields(
                { name: 'Progression', value: `${task.completed || 0}/${task.total}`, inline: true },
                { name: 'Par', value: message.author.tag, inline: true },
            );
        return message.channel.send({ embeds: [emb] });
    },
});

// ----- &status --------------------------------------------------

registerCommand({
    name: 'status',
    aliases: ['progress', 'dmstatus'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 3,
    description: 'Progression du DMAll en cours.',
    usage: ['&status'],
    async execute(client, message) {
        const task = activeTasks.get(message.guild.id);
        if (!task || task.cancelled) return message.reply('Aucun DMAll en cours.');
        const elapsed = ((Date.now() - task.startTime) / 1000).toFixed(1);
        const done = task.completed || 0;
        const total = task.total;
        const pct = ((done / total) * 100).toFixed(1);
        const eta = done > 0 ? (((Date.now() - task.startTime) / done) * (total - done) / 1000).toFixed(0) : '...';
        const emb = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('DMAll en cours')
            .addFields(
                { name: 'Progression', value: `${done}/${total} (${pct}%)`, inline: true },
                { name: 'Ecoule', value: `${elapsed}s`, inline: true },
                { name: 'Estimation', value: `${eta}s`, inline: true },
                { name: 'OK', value: String(task.ok || 0), inline: true },
                { name: 'Echec', value: String(task.fail || 0), inline: true },
                { name: 'Bloque', value: String(task.blocked || 0), inline: true },
            )
            .setFooter({ text: `Lance par ${task.by}` });
        return message.channel.send({ embeds: [emb] });
    },
});

// ----- &optout --------------------------------------------------

registerCommand({
    name: 'optout',
    aliases: ['unsubscribe'],
    cooldown: 5,
    description: 'Ne plus recevoir les DMs massifs.',
    usage: ['&optout'],
    async execute(client, message) {
        const gd = guildKey(message.guild.id);
        if (!gd.optouts) gd.optouts = [];
        if (gd.optouts.includes(message.author.id)) {
            return message.reply('Vous etes deja en opt-out.');
        }
        gd.optouts.push(message.author.id);
        saveConfig();
        return message.reply('Vous ne recevrez plus les DMs massifs de ce serveur. `&optin` pour annuler.');
    },
});

// ----- &optin ---------------------------------------------------

registerCommand({
    name: 'optin',
    aliases: ['subscribe'],
    cooldown: 5,
    description: 'Reactivation des DMs massifs.',
    usage: ['&optin'],
    async execute(client, message) {
        const gd = guildKey(message.guild.id);
        if (!gd.optouts) gd.optouts = [];
        const idx = gd.optouts.indexOf(message.author.id);
        if (idx === -1) return message.reply('Vous recevez deja les DMs.');
        gd.optouts.splice(idx, 1);
        saveConfig();
        return message.reply('Vous recevrez de nouveau les DMs massifs.');
    },
});

// ----- &template -------------------------------------------------

registerCommand({
    name: 'template',
    aliases: ['tmpl', 'tpl'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 2,
    description: 'Gestion des templates de messages.',
    usage: [
        '&template create <nom> <contenu>',
        '&template list',
        '&template delete <nom>',
        '&template edit <nom> <contenu>',
        '&template preview <nom>',
    ],
    async execute(client, message, args) {
        const prefix = CONFIG.prefix;
        const gd = guildKey(message.guild.id);
        if (!gd.templates) gd.templates = {};
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'list') {
            const names = Object.keys(gd.templates);
            if (names.length === 0) {
                return message.reply(`Aucun template. Creez-en un: \`${prefix}template create <nom> <contenu>\``);
            }
            const emb = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle(`Templates (${names.length})`)
                .setDescription(names.map((n) => {
                    const t = gd.templates[n];
                    return `\`${n}\` — ${t.content.slice(0, 60)}${t.content.length > 60 ? '...' : ''} (${t.created || '?'})`;
                }).join('\n'))
                .setFooter({ text: `${prefix}template preview <nom> pour apercu` });
            return message.channel.send({ embeds: [emb] });
        }

        const name = args[1]?.toLowerCase();

        if (sub === 'create') {
            if (!name) return message.reply(`Usage: \`${prefix}template create <nom> <contenu>\``);
            if (gd.templates[name]) return message.reply(`Le template \`${name}\` existe deja. Utilisez \`${prefix}template edit ${name} <contenu>\`.`);
            const content = args.slice(2).join(' ');
            if (!content) return message.reply('Fournissez le contenu du template.');
            const v = validateTemplate(content);
            if (!v.valid) return message.reply('Erreurs:\n' + v.errors.map((e) => '- ' + e).join('\n'));
            gd.templates[name] = { content, created: new Date().toISOString().slice(0, 10), createdBy: message.author.tag };
            saveConfig();
            return message.reply(`Template \`${name}\` cree. Usage: \`${prefix}dmall template ${name}\``);
        }

        if (sub === 'delete' || sub === 'remove') {
            if (!name) return message.reply(`Usage: \`${prefix}template delete <nom>\``);
            if (!gd.templates[name]) return message.reply(`Template \`${name}\` introuvable.`);
            delete gd.templates[name];
            saveConfig();
            return message.reply(`Template \`${name}\` supprime.`);
        }

        if (sub === 'edit') {
            if (!name) return message.reply(`Usage: \`${prefix}template edit <nom> <nouveau contenu>\``);
            if (!gd.templates[name]) return message.reply(`Template \`${name}\` introuvable.`);
            const content = args.slice(2).join(' ');
            if (!content) return message.reply('Fournissez le nouveau contenu.');
            const v = validateTemplate(content);
            if (!v.valid) return message.reply('Erreurs:\n' + v.errors.map((e) => '- ' + e).join('\n'));
            gd.templates[name] = { ...gd.templates[name], content, updated: new Date().toISOString().slice(0, 10) };
            saveConfig();
            return message.reply(`Template \`${name}\` mis a jour.`);
        }

        if (sub === 'preview') {
            if (!name) return message.reply(`Usage: \`${prefix}template preview <nom>\``);
            const t = gd.templates[name];
            if (!t) return message.reply(`Template \`${name}\` introuvable.`);
            const prev = previewTemplate(t.content, message.guild);
            const v = validateTemplate(t.content);
            const emb = new EmbedBuilder()
                .setColor(v.valid ? 0x2ecc71 : 0xe74c3c)
                .setTitle(`Apercu: ${name}`)
                .setDescription(prev.length > 2000 ? prev.slice(0, 1997) + '...' : prev)
                .addFields(
                    { name: 'Longueur', value: `${t.content.length} car.`, inline: true },
                    { name: 'Cree', value: t.created || '?', inline: true },
                )
                .setFooter({ text: `Usage: ${prefix}dmall template ${name}` });
            return message.channel.send({ embeds: [emb] });
        }

        return message.reply(`Sous-commande inconnue. Usage: \`${prefix}template <create|list|delete|edit|preview>\``);
    },
});

// ----- &schedule -------------------------------------------------

registerCommand({
    name: 'schedule',
    aliases: ['sched', 'plan'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 2,
    description: 'Planifier un DMAll pour plus tard.',
    usage: [
        '&schedule <timestamp_unix> <message>',
        '&schedule list',
        '&schedule delete <id>',
    ],
    async execute(client, message, args) {
        const prefix = CONFIG.prefix;
        const gd = guildKey(message.guild.id);
        if (!gd.schedules) gd.schedules = [];
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'list') {
            const now = Date.now();
            const pending = gd.schedules.filter((s) => s.status === 'pending' && s.executeAt > now);
            if (pending.length === 0) {
                return message.reply(`Aucune planification active.\n\`${prefix}schedule <timestamp> <message>\` pour en creer une.`);
            }
            const emb = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle(`Planifications (${pending.length})`)
                .setDescription(pending.map((s) => {
                    const dt = new Date(s.executeAt);
                    return `ID: \`${s.id}\` | ${dt.toLocaleString('fr-FR')} | \`${s.template || s.msg.slice(0, 30)}...\``;
                }).join('\n'))
                .setFooter({ text: `${prefix}schedule delete <id> pour supprimer` });
            return message.channel.send({ embeds: [emb] });
        }

        if (sub === 'delete' || sub === 'remove') {
            const id = args[1];
            if (!id) return message.reply(`Usage: \`${prefix}schedule delete <id>\``);
            const idx = gd.schedules.findIndex((s) => s.id === id);
            if (idx === -1) return message.reply('Planification introuvable.');
            const s = gd.schedules[idx];
            if (s.timeout) clearTimeout(s.timeout);
            gd.schedules.splice(idx, 1);
            saveConfig();
            return message.reply(`Planification \`${id}\` supprimee.`);
        }

        // Création: &schedule <timestamp> <message>
        const ts = parseInt(args[0]);
        if (isNaN(ts) || ts <= Date.now()) {
            return message.reply(
                'Fournissez un timestamp Unix valide (futur).\n' +
                `Exemple: \`${prefix}schedule ${Math.floor(Date.now() / 1000) + 3600} Bonjour {user} !\`\n` +
                `Utilisez <t:${Math.floor(Date.now() / 1000) + 3600}:F> pour voir la date.`
            );
        }
        const msgContent = args.slice(1).join(' ');
        if (!msgContent) return message.reply('Fournissez le message a envoyer.');
        const v = validateTemplate(msgContent);
        if (!v.valid) return message.reply('Erreurs:\n' + v.errors.map((e) => '- ' + e).join('\n'));

        const scheduleId = Date.now().toString(36);
        const delay = ts - Date.now();

        const schedule = {
            id: scheduleId,
            executeAt: ts,
            msg: msgContent,
            status: 'pending',
            createdBy: message.author.tag,
            createdAt: Date.now(),
            timeout: null,
        };

        schedule.timeout = setTimeout(async () => {
            try {
                await message.guild.members.fetch();
                const members = message.guild.members.cache
                    .filter((m) => !m.user.bot)
                    .map((m) => m);
                const task = {
                    cancelled: false,
                    total: members.length,
                    startTime: Date.now(),
                    completed: 0,
                    ok: 0,
                    fail: 0,
                    blocked: 0,
                    by: 'Schedule #' + scheduleId,
                };
                activeTasks.set(message.guild.id, task);

                const result = await processBatch(
                    members,
                    async (member) => {
                        if (task.cancelled) return 'cancelled';
                        const rendered = renderTemplate(schedule.msg, member, message.guild);
                        try {
                            await member.send(rendered);
                            logger.dm(`SCHEDULE OK -> ${member.user.tag}`);
                            return 'success';
                        } catch (err) {
                            logger.dm(`SCHEDULE FAIL -> ${member.user.tag}: ${err.code || err.message}`);
                            if (err.code === 50007) return 'blocked';
                            return 'failed';
                        }
                    },
                    { batchSize: 45, delayMs: 11000, cancelFn: () => task.cancelled },
                );

                recordCampaign(message.guild.id, {
                    total: result.total,
                    ok: result.ok,
                    fail: result.fail,
                    blocked: result.blocked,
                    duration: parseFloat(((Date.now() - task.startTime) / 1000).toFixed(1)),
                    cancelled: task.cancelled,
                    targetType: 'all',
                    by: 'Schedule #' + scheduleId,
                });

                activeTasks.delete(message.guild.id);
                schedule.status = 'completed';
                saveConfig();
                logger.info(`Schedule ${scheduleId} completed: ${result.ok}/${result.total}`);
            } catch (err) {
                logger.error(`Schedule ${scheduleId} failed: ${err.message}`);
                schedule.status = 'failed';
                saveConfig();
            }
        }, delay);

        gd.schedules.push(schedule);
        // Nettoyer les schedules terminés (max 100)
        gd.schedules = gd.schedules.filter((s) => s.status === 'pending' || s.executeAt > Date.now() - 86400000).slice(-100);
        saveConfig();

        const dt = new Date(ts);
        const emb = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Planification creee')
            .setDescription(`ID: \`${scheduleId}\`\nDate: ${dt.toLocaleString('fr-FR')}\nMessage: \`${msgContent.slice(0, 100)}${msgContent.length > 100 ? '...' : ''}\``)
            .addFields(
                { name: 'Timestamp', value: `<t:${Math.floor(ts / 1000)}:F>`, inline: true },
                { name: 'Dans', value: `<t:${Math.floor(ts / 1000)}:R>`, inline: true },
            )
            .setFooter({ text: `${prefix}schedule delete ${scheduleId} pour annuler` });
        return message.channel.send({ embeds: [emb] });
    },
});

// ----- &blacklist ------------------------------------------------

registerCommand({
    name: 'blacklist',
    aliases: ['bl'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 1,
    description: 'Gerer la blacklist des membres exclus des DMs.',
    usage: [
        '&blacklist add <@user> [@user...]',
        '&blacklist remove <@user> [@user...]',
        '&blacklist list',
        '&blacklist clear',
    ],
    async execute(client, message, args) {
        const prefix = CONFIG.prefix;
        const gd = guildKey(message.guild.id);
        if (!gd.blacklist) gd.blacklist = [];
        const sub = args[0]?.toLowerCase();

        if (sub === 'add') {
            const mentions = message.mentions.users;
            if (mentions.size === 0) return message.reply(`Mentionnez au moins un utilisateur: \`${prefix}blacklist add @user1 @user2\``);
            let added = 0;
            for (const [id] of mentions) {
                if (!gd.blacklist.includes(id)) {
                    gd.blacklist.push(id);
                    added++;
                }
            }
            saveConfig();
            return message.reply(`${added} utilisateur(s) ajoute(s) a la blacklist. (Total: ${gd.blacklist.length})`);
        }

        if (sub === 'remove') {
            const mentions = message.mentions.users;
            if (mentions.size === 0) return message.reply(`Mentionnez au moins un utilisateur: \`${prefix}blacklist remove @user\``);
            let removed = 0;
            for (const [id] of mentions) {
                const idx = gd.blacklist.indexOf(id);
                if (idx !== -1) { gd.blacklist.splice(idx, 1); removed++; }
            }
            saveConfig();
            return message.reply(`${removed} utilisateur(s) retires de la blacklist. (Total: ${gd.blacklist.length})`);
        }

        if (sub === 'list') {
            if (gd.blacklist.length === 0) return message.reply('Blacklist vide.');
            const members = await Promise.all(
                gd.blacklist.map((id) => message.guild.members.fetch(id).catch(() => null))
            );
            const names = members.filter(Boolean).map((m) => `- ${m.user.tag} (\`${m.user.id}\`)`);
            const emb = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle(`Blacklist (${gd.blacklist.length})`)
                .setDescription(names.length > 0 ? names.join('\n').slice(0, 2000) : 'Membres introuvables (ont quitte le serveur)')
                .setFooter({ text: `${prefix}blacklist add/remove pour modifier` });
            return message.channel.send({ embeds: [emb] });
        }

        if (sub === 'clear') {
            const count = gd.blacklist.length;
            gd.blacklist = [];
            saveConfig();
            return message.reply(`${count} entrees supprimees. Blacklist vide.`);
        }

        return message.reply(`Usage: \`${prefix}blacklist <add|remove|list|clear>\``);
    },
});

// ----- &whitelist ------------------------------------------------

registerCommand({
    name: 'whitelist',
    aliases: ['wl'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 1,
    description: 'Gerer la whitelist (mode restreint aux membres listes).',
    usage: [
        '&whitelist add <@user> [@user...]',
        '&whitelist remove <@user> [@user...]',
        '&whitelist list',
        '&whitelist clear',
        '&whitelist toggle',
    ],
    async execute(client, message, args) {
        const prefix = CONFIG.prefix;
        const gd = guildKey(message.guild.id);
        if (!gd.whitelist) gd.whitelist = [];
        const sub = args[0]?.toLowerCase();

        if (sub === 'add') {
            const mentions = message.mentions.users;
            if (mentions.size === 0) return message.reply(`Mentionnez au moins un utilisateur: \`${prefix}whitelist add @user\``);
            let added = 0;
            for (const [id] of mentions) {
                if (!gd.whitelist.includes(id)) {
                    gd.whitelist.push(id);
                    added++;
                }
            }
            saveConfig();
            return message.reply(`${added} utilisateur(s) ajoutes a la whitelist. (Total: ${gd.whitelist.length})${gd.whitelistMode ? '' : '\nActivez le mode whitelist avec `' + prefix + 'whitelist toggle`.'}`);
        }

        if (sub === 'remove') {
            const mentions = message.mentions.users;
            if (mentions.size === 0) return message.reply(`Mentionnez au moins un utilisateur: \`${prefix}whitelist remove @user\``);
            let removed = 0;
            for (const [id] of mentions) {
                const idx = gd.whitelist.indexOf(id);
                if (idx !== -1) { gd.whitelist.splice(idx, 1); removed++; }
            }
            saveConfig();
            return message.reply(`${removed} utilisateur(s) retires de la whitelist. (Total: ${gd.whitelist.length})`);
        }

        if (sub === 'list') {
            if (gd.whitelist.length === 0) return message.reply('Whitelist vide.');
            const members = await Promise.all(
                gd.whitelist.map((id) => message.guild.members.fetch(id).catch(() => null))
            );
            const names = members.filter(Boolean).map((m) => `- ${m.user.tag} (\`${m.user.id}\`)`);
            const emb = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle(`Whitelist (${gd.whitelist.length}) — Mode: ${gd.whitelistMode ? 'ACTIF' : 'INACTIF'}`)
                .setDescription(names.length > 0 ? names.join('\n').slice(0, 2000) : 'Membres introuvables')
                .setFooter({ text: `${prefix}whitelist toggle pour activer/desactiver` });
            return message.channel.send({ embeds: [emb] });
        }

        if (sub === 'clear') {
            const count = gd.whitelist.length;
            gd.whitelist = [];
            saveConfig();
            return message.reply(`${count} entrees supprimees. Whitelist vide.`);
        }

        if (sub === 'toggle') {
            gd.whitelistMode = !gd.whitelistMode;
            saveConfig();
            const status = gd.whitelistMode ? 'ACTIF — seuls les membres whitelistes recevront les DMs.' : 'INACTIF — tous les membres (sauf blacklist/optout) recevront les DMs.';
            return message.reply(`Mode whitelist: **${status}**`);
        }

        return message.reply(`Usage: \`${prefix}whitelist <add|remove|list|clear|toggle>\``);
    },
});

// ----- &stats ---------------------------------------------------

registerCommand({
    name: 'stats',
    aliases: ['dmstats', 'report'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 5,
    description: 'Statistiques des campagnes DMAll.',
    usage: ['&stats', '&stats <24h|7d|30d|all>'],
    async execute(client, message, args) {
        const period = ['24h', '7d', '30d', 'all'].includes(args[0]) ? args[0] : 'all';
        const st = getFilteredStats(message.guild.id, period);
        const prefix = CONFIG.prefix;
        const gd = guildKey(message.guild.id);

        const emb = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`Statistiques DMAll — ${period === 'all' ? 'Total' : period}`)
            .addFields(
                { name: 'Campagnes', value: String(st.totalCampaigns), inline: true },
                { name: 'Envoyes', value: String(st.totalSent), inline: true },
                { name: 'Echoues', value: String(st.totalFailed), inline: true },
                { name: 'Bloques', value: String(st.totalBlocked), inline: true },
                { name: 'Taux succes', value: st.avgSuccessRate + '%', inline: true },
                { name: 'Opt-outs actuels', value: String((gd.optouts || []).length), inline: true },
            )
            .setFooter({ text: `${prefix}stats <24h|7d|30d|all> pour filtrer | All-time: ${st.allTimeSent} DMs` });

        if (st.recent.length > 0) {
            emb.addFields({
                name: 'Dernieres campagnes',
                value: st.recent.map((c) => {
                    const dt = new Date(c.timestamp).toLocaleString('fr-FR').slice(0, 16);
                    return `\`${dt}\` — ${c.ok}/${c.total} OK (${c.duration}s)${c.cancelled ? ' [ANNULE]' : ''}`;
                }).join('\n').slice(0, 1024),
            });
        }

        return message.channel.send({ embeds: [emb] });
    },
});

// ----- &dmsettings -----------------------------------------------

registerCommand({
    name: 'dmsettings',
    aliases: ['dmconfig', 'dmset'],
    permissions: PermissionFlagsBits.Administrator,
    cooldown: 2,
    description: 'Configurer les parametres du bot sur le serveur.',
    usage: [
        '&dmsettings',
        '&dmsettings enable',
        '&dmsettings disable',
        '&dmsettings prefix <nouveau_prefix>',
    ],
    async execute(client, message, args) {
        const prefix = CONFIG.prefix;
        const gd = guildKey(message.guild.id);
        if (gd.enabled === undefined) gd.enabled = true;
        const sub = args[0]?.toLowerCase();

        if (sub === 'enable') {
            gd.enabled = true;
            saveConfig();
            return message.reply('DMAll active sur ce serveur.');
        }
        if (sub === 'disable') {
            gd.enabled = false;
            saveConfig();
            return message.reply('DMall desactive sur ce serveur. `&dmsettings enable` pour reactiver.');
        }

        // Affichage
        const emb = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Parametres DMAll')
            .addFields(
                { name: 'Statut', value: gd.enabled ? 'Active' : 'Desactive', inline: true },
                { name: 'Mode Whitelist', value: gd.whitelistMode ? 'Actif' : 'Inactif', inline: true },
                { name: 'Prefix global', value: `\`${prefix}\``, inline: true },
                { name: 'Opt-outs', value: String((gd.optouts || []).length), inline: true },
                { name: 'Blacklist', value: String((gd.blacklist || []).length), inline: true },
                { name: 'Whitelist', value: String((gd.whitelist || []).length), inline: true },
                { name: 'Templates', value: String(Object.keys(gd.templates || {}).length), inline: true },
                { name: 'Planifications', value: String((gd.schedules || []).filter((s) => s.status === 'pending').length), inline: true },
            )
            .setFooter({ text: `${prefix}dmsettings <enable|disable> pour modifier` });
        return message.channel.send({ embeds: [emb] });
    },
});

// ============================================================
//  SECTION 10 — CLIENT SETUP & EVENT HANDLERS
// ============================================================

loadConfig();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
    ],
    partials: ['CHANNEL'],
    rest: { timeout: 15000, retries: 3 },
});

// État partagé accessible aux commandes
client._dmallTasks = activeTasks;
client._config = CONFIG;
client._logger = logger;
client._saveConfig = saveConfig;
client._guildKey = guildKey;
client._ensureGuild = ensureGuild;
client._renderTemplate = renderTemplate;
client._validateTemplate = validateTemplate;
client._previewTemplate = previewTemplate;
client._recordCampaign = recordCampaign;
client._processBatch = processBatch;
client._activeTasks = activeTasks;

// ----- READY ----------------------------------------------------
client.once('clientReady', async () => {
    logger.info(`Connecte en tant que ${client.user.tag} (${client.user.id})`);

    client.user.setPresence({
        status: 'online',
    });

    // Rattrapage des schedules
    let recovered = 0;
    for (const guild of client.guilds.cache.values()) {
        ensureGuild(guild.id);
        const gd = guildKey(guild.id);
        if (!gd.schedules) gd.schedules = [];
        const now = Date.now();
        const pending = gd.schedules.filter((s) => s.status === 'pending' && s.executeAt > now);
        for (const s of pending) {
            const delay = s.executeAt - now;
            logger.info(`Re-scheduling ${s.id} for guild ${guild.name} in ${(delay / 1000).toFixed(0)}s`);
            s.timeout = setTimeout(async () => {
                try {
                    await guild.members.fetch();
                    const members = guild.members.cache.filter((m) => !m.user.bot).map((m) => m);
                    const task = {
                        cancelled: false,
                        total: members.length,
                        startTime: Date.now(),
                        completed: 0,
                        ok: 0,
                        fail: 0,
                        blocked: 0,
                        by: 'Schedule-Recover #' + s.id,
                    };
                    activeTasks.set(guild.id, task);

                    const result = await processBatch(
                        members,
                        async (member) => {
                            if (task.cancelled) return 'cancelled';
                            const rendered = renderTemplate(s.msg, member, guild);
                            try {
                                await member.send(rendered);
                                logger.dm(`SCHEDULE-RECOVER OK -> ${member.user.tag}`);
                                return 'success';
                            } catch (err) {
                                logger.dm(`SCHEDULE-RECOVER FAIL -> ${member.user.tag}: ${err.code || err.message}`);
                                if (err.code === 50007) return 'blocked';
                                return 'failed';
                            }
                        },
                        { batchSize: 45, delayMs: 11000, cancelFn: () => task.cancelled },
                    );

                    recordCampaign(guild.id, {
                        total: result.total,
                        ok: result.ok,
                        fail: result.fail,
                        blocked: result.blocked,
                        duration: parseFloat(((Date.now() - task.startTime) / 1000).toFixed(1)),
                        cancelled: task.cancelled,
                        targetType: 'all',
                        by: 'Schedule-Recover #' + s.id,
                    });

                    activeTasks.delete(guild.id);
                    s.status = 'completed';
                    saveConfig();
                    logger.info(`Schedule recovery ${s.id} completed: ${result.ok}/${result.total}`);
                } catch (err) {
                    logger.error(`Schedule recovery ${s.id} failed: ${err.message}`);
                    s.status = 'failed';
                    saveConfig();
                }
            }, delay);
            recovered++;
        }
        // Nettoyer les vieux schedules
        gd.schedules = gd.schedules.filter((s) => s.status === 'pending' || s.executeAt > now - 86400000);
    }
    if (recovered > 0) {
        saveConfig();
        logger.info(`Recovered ${recovered} scheduled task(s)`);
    }

    const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    logger.info(`Pret: ${client.guilds.cache.size} serveurs, ${totalMembers} membres | Prefix: ${CONFIG.prefix}`);
});

// ----- MESSAGE CREATE ------------------------------------------
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild || message.webhookId) return;
    if (!message.content.startsWith(CONFIG.prefix)) return;

    const args = message.content.slice(CONFIG.prefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    if (!cmdName) return;

    const cmd = commands.get(cmdName);
    if (!cmd) return;

    // Vérifier permissions
    if (cmd.permissions) {
        if (!message.member.permissions.has(cmd.permissions)) {
            return message.reply('Permission insuffisante. Commande reservee aux administrateurs.').catch(() => {});
        }
    }

    // Vérifier cooldown
    if (cmd.cooldown) {
        const cd = cooldown.check(message.author.id, cmd.name, cmd.cooldown * 1000);
        if (cd.active) {
            return message.reply(`Patientez ${cd.remaining} seconde(s) avant de reutiliser \`${CONFIG.prefix}${cmd.name}\`.`).catch(() => {});
        }
    }

    // S'assurer que les donnees guild existent
    ensureGuild(message.guild.id);

    // Exécuter
    try {
        await cmd.execute(client, message, args);
        if (cmd.cooldown) cooldown.set(message.author.id, cmd.name, cmd.cooldown * 1000);
    } catch (err) {
        logger.error(`Command ${cmdName}: ${err.stack}`);
        message.reply('Erreur interne lors de l\'execution.').catch(() => {});
    }
});

// ----- GLOBAL ERROR HANDLING -----------------------------------
process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason?.stack || reason}`);
});
process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.stack}`);
    if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) return;
    process.exit(1);
});

// ============================================================
//  SECTION 11 — STARTUP
// ============================================================

client.login(CONFIG.token).catch((err) => {
    logger.error(`Login failed: ${err.message}`);
    process.exit(1);
});

module.exports = { client, CONFIG, commands };
