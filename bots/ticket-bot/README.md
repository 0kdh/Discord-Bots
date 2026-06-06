# 🤖 Discord Bot Ultra-Complet

> Bot Discord v14 avec gestion des **Embeds**, **Annonces**, **Boutons interactifs**, **Tickets**, **Permissions** et bien plus encore.

---

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Fichiers du projet](#fichiers-du-projet)
- [Commandes](#commandes)
  - [Utilitaires](#-utilitaires)
  - [Configuration](#️-configuration)
  - [Embeds](#-embeds)
  - [Annonces](#-annonces)
  - [Boutons](#-boutons)
  - [Tickets](#-tickets)
  - [Accès aux salons](#-accès-aux-salons)
  - [Modération](#️-modération)
  - [Rôles](#-rôles)
  - [Commandes personnalisées](#-commandes-personnalisées)
  - [Sondages](#-sondages)
- [Système de boutons interactifs](#système-de-boutons-interactifs)
- [Données persistantes](#données-persistantes)
- [Variables d'environnement](#variables-denvironnement)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Dépannage](#dépannage)

---

## Prérequis

- **Node.js** v18.0.0 ou supérieur
- **NPM** v8.0.0 ou supérieur
- Un **bot Discord** créé sur le [Developer Portal](https://discord.com/developers/applications)
- Les **intents privileged** activés :
  - `GUILD_MEMBERS`
  - `MESSAGE_CONTENT`
  - `PRESENCE_INTENT`

---

## Installation

### 1. Cloner ou télécharger les fichiers

Placez les fichiers suivants dans un dossier :
```
mon-bot/
├── bot.cjs
├── data.json
├── package.json
└── README.md
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer le bot

Éditez `data.json` et remplacez les valeurs :

```json
{
  "config": {
    "prefix": "!",
    "token": "VOTRE_TOKEN_ICI",
    "guildId": "ID_DE_VOTRE_SERVEUR"
  }
}
```

> ⚠️ **Ne partagez jamais votre token !**

---

## Configuration

### Créer un bot Discord

1. Allez sur https://discord.com/developers/applications
2. Cliquez **New Application** → donnez un nom
3. Allez dans **Bot** → **Add Bot**
4. Copiez le **Token** → collez dans `data.json`
5. Activez les **Privileged Gateway Intents** :
   - ✅ `PRESENCE INTENT`
   - ✅ `SERVER MEMBERS INTENT`
   - ✅ `MESSAGE CONTENT INTENT`

### Inviter le bot sur votre serveur

Générez un lien d'invitation dans **OAuth2 → URL Generator** :
- Scopes : `bot`, `applications.commands`
- Permissions bot recommandées :
  - Administrator *(ou les permissions individuelles)*

---

## Démarrage

```bash
# Démarrage normal
npm start

# Démarrage avec rechargement automatique (développement)
npm run dev

# Avec variable d'environnement (plus sécurisé)
DISCORD_TOKEN=votre_token node bot.cjs
```

---

## Fichiers du projet

| Fichier | Description |
|---------|-------------|
| `bot.cjs` | Code principal du bot (3000+ lignes) |
| `data.json` | Base de données persistante (JSON) |
| `package.json` | Dépendances et scripts NPM |
| `README.md` | Documentation complète |

---

## Commandes

> Le préfixe par défaut est `!`. Il peut être changé avec `!setprefix`.

### 🔧 Utilitaires

| Commande | Description |
|----------|-------------|
| `!ping` | Affiche la latence du bot et de l'API |
| `!uptime` | Durée en ligne du bot |
| `!botinfo` | Informations complètes sur le bot |
| `!serverinfo` | Informations sur le serveur |
| `!userinfo [@user]` | Informations sur un utilisateur |
| `!avatar [@user]` | Affiche l'avatar d'un utilisateur |
| `!help [catégorie]` | Aide complète ou par catégorie |

### ⚙️ Configuration

| Commande | Description |
|----------|-------------|
| `!setprefix <prefix>` | Change le préfixe du bot |
| `!setlogchannel <#salon>` | Définit le salon de logs |
| `!setadminrole <@role>` | Ajoute/retire un rôle admin |
| `!setmodrole <@role>` | Ajoute/retire un rôle modérateur |
| `!autorole <@role>` | Rôle automatique à l'arrivée |
| `!autorole disable` | Désactive le rôle auto |
| `!setwelcome channel <#salon>` | Salon de bienvenue |
| `!setwelcome message <texte>` | Message de bienvenue |
| `!setwelcome title <texte>` | Titre de l'embed de bienvenue |
| `!setwelcome description <texte>` | Description de l'embed |
| `!setwelcome color <#hex>` | Couleur de l'embed |
| `!setwelcome image <url>` | Image de l'embed |
| `!setwelcome thumbnail <url>` | Miniature de l'embed |
| `!setwelcome embedon/embedoff` | Active/désactive l'embed |
| `!setwelcome disable` | Désactive le système |
| `!setwelcome status` | Affiche la configuration |
| `!welcometest` | Teste le message de bienvenue |

> Variables disponibles : `{user}`, `{username}`, `{server}`, `{membercount}`, `{id}`

### 📝 Embeds

Créez des embeds Discord entièrement personnalisables.

| Commande | Description |
|----------|-------------|
| `!embed create <id>` | Crée un nouvel embed |
| `!embed title <id> <titre>` | Définit le titre |
| `!embed description <id> <texte>` | Définit la description |
| `!embed color <id> <#HEX>` | Définit la couleur (ex: `#FF5733`) |
| `!embed image <id> <url>` | Image principale (grande) |
| `!embed thumbnail <id> <url>` | Miniature (petite image en haut à droite) |
| `!embed footer <id> <texte>` | Texte du footer |
| `!embed footericon <id> <url>` | Icône du footer |
| `!embed author <id> <nom>` | Nom de l'auteur |
| `!embed authoricon <id> <url>` | Icône de l'auteur |
| `!embed authorurl <id> <url>` | URL de l'auteur (lien cliquable) |
| `!embed url <id> <url>` | URL du titre (rend le titre cliquable) |
| `!embed timestamp <id>` | Active/désactive le timestamp |
| `!embed addfield <id> <nom> \| <valeur>` | Ajoute un champ normal |
| `!embed addinlinefield <id> <nom> \| <valeur>` | Ajoute un champ inline |
| `!embed clearfields <id>` | Supprime tous les champs |
| `!embed preview <id>` | Prévisualise l'embed |
| `!embed send <id> [#salon]` | Envoie l'embed dans un salon |
| `!embed list` | Liste tous les embeds créés |
| `!embed delete <id>` | Supprime un embed |
| `!embed clone <id> <nouvel_id>` | Clone un embed existant |
| `!embed info <id>` | Informations sur un embed |

**Exemple complet :**
```
!embed create regles
!embed title regles 📜 Règles du serveur
!embed description regles Veuillez respecter les règles suivantes :
!embed color regles #5865F2
!embed addfield regles Règle 1 | Soyez respectueux
!embed addfield regles Règle 2 | Pas de spam
!embed footer regles Dernière mise à jour
!embed timestamp regles
!embed send regles #règles
```

### 📢 Annonces

Créez des annonces riches avec boutons interactifs.

| Commande | Description |
|----------|-------------|
| `!announce create <id>` | Crée une annonce |
| `!announce title <id> <titre>` | Titre de l'annonce |
| `!announce description <id> <texte>` | Description |
| `!announce color <id> <#hex>` | Couleur |
| `!announce image <id> <url>` | Image principale |
| `!announce thumbnail <id> <url>` | Miniature |
| `!announce footer <id> <texte>` | Footer |
| `!announce timestamp <id>` | Active le timestamp |
| `!announce content <id> <texte>` | Texte brut avant l'embed |
| `!announce addfield <id> <nom> \| <valeur>` | Ajoute un champ |
| `!announce addbutton <id> <btn_id>` | Attache un bouton |
| `!announce removebutton <id> <btn_id>` | Détache un bouton |
| `!announce preview <id>` | Prévisualise l'annonce |
| `!announce send <id> [#salon]` | Envoie l'annonce |
| `!announce edit <id> <msg_id> [#salon]` | Modifie une annonce envoyée |
| `!announce list` | Liste toutes les annonces |
| `!announce delete <id>` | Supprime une annonce |

**Exemple complet :**
```
!announce create event-noel
!announce title event-noel 🎄 Événement de Noël !
!announce description event-noel Rejoignez-nous pour notre grand événement de fin d'année !
!announce color event-noel #ED4245
!announce addfield event-noel 📅 Date | 25 Décembre 2024
!announce addfield event-noel 🏆 Prix | 50€ de bons cadeaux
!announce timestamp event-noel
!announce addbutton event-noel btn-participer
!announce send event-noel #annonces
```

### 🔘 Boutons

Créez des boutons interactifs entièrement personnalisables.

| Commande | Description |
|----------|-------------|
| `!button create <id> <label>` | Crée un bouton |
| `!button label <id> <texte>` | Modifie le label |
| `!button style <id> <style>` | Style : `primary`, `secondary`, `success`, `danger` |
| `!button emoji <id> <emoji>` | Ajoute un emoji |
| `!button action <id> <type>` | Type d'action (voir tableau) |
| `!button settarget <id> <valeur>` | Cible de l'action |
| `!button setmessage <id> <texte>` | Message de réponse |
| `!button setembed <id> <embed_id>` | Embed de réponse |
| `!button setephemeral <id>` | Réponse visible uniquement par l'auteur |
| `!button addrole <id> <@role>` | Rôle requis pour utiliser le bouton |
| `!button disable <id>` | Désactive un bouton |
| `!button enable <id>` | Active un bouton |
| `!button list` | Liste tous les boutons |
| `!button delete <id>` | Supprime un bouton |
| `!button info <id>` | Informations détaillées |
| `!button test <id>` | Teste un bouton |

**Types d'actions disponibles :**

| Action | Description |
|--------|-------------|
| `message` | Répond avec un message/embed |
| `ticket` | Crée un ticket de support |
| `access` | Donne accès à un salon/catégorie |
| `role` | Donne ou retire un rôle (toggle) |
| `invite` | Envoie un lien d'invitation |
| `dm` | Envoie un DM à l'utilisateur |
| `modal` | Ouvre un formulaire interactif |

**Exemples :**

```
# Bouton de ticket
!button create btn-ticket 🎫 Ouvrir un ticket
!button style btn-ticket primary
!button action btn-ticket ticket
!button emoji btn-ticket 🎫

# Bouton de rôle
!button create btn-gamer 🎮 Rôle Gamer
!button style btn-gamer success
!button action btn-gamer role
!button settarget btn-gamer @Gamer

# Bouton d'accès au salon
!button create btn-acces 🔑 Accès VIP
!button action btn-acces access
!button settarget btn-acces acces-vip
```

### 🎫 Tickets

Système de tickets de support complet.

| Commande | Description |
|----------|-------------|
| `!ticket setup` | Affiche la configuration actuelle |
| `!ticket setcategory <#catégorie>` | Catégorie pour les tickets |
| `!ticket setlog <#salon>` | Salon de logs des tickets |
| `!ticket setsupport <@role>` | Rôle de support |
| `!ticket close [raison]` | Ferme le ticket actuel |
| `!ticket add <@user>` | Ajoute un utilisateur au ticket |
| `!ticket remove <@user>` | Retire un utilisateur du ticket |
| `!ticket rename <nom>` | Renomme le ticket |
| `!ticket list` | Liste les tickets ouverts |
| `!ticket panel [#salon]` | Crée un panneau de tickets |
| `!ticket enable` | Active le système |
| `!ticket disable` | Désactive le système |

**Configuration recommandée :**
```
!ticket setcategory #📩-tickets
!ticket setlog #🗂️-logs-tickets
!ticket setsupport @Support
!ticket panel #📩-support
```

### 🔑 Accès aux salons

Gérez l'accès aux salons via des boutons.

| Commande | Description |
|----------|-------------|
| `!access create <id> <#salon>` | Crée un accès à un salon |
| `!access setrole <id> <@role>` | Rôle à donner avec l'accès |
| `!access settype <id> <type>` | Type : `give`, `toggle`, `view` |
| `!access setlabel <id> <texte>` | Label du bouton |
| `!access list` | Liste les accès |
| `!access delete <id>` | Supprime un accès |

**Types d'accès :**
- `give` — Donne l'accès (ne le retire pas)
- `toggle` — Donne si absent, retire si présent
- `view` — Donne uniquement la lecture

**Exemple :**
```
!access create acces-vip #salon-vip
!access setrole acces-vip @VIP
!access settype acces-vip toggle
!access setlabel acces-vip 👑 Accès VIP

# Créer le bouton lié
!button create btn-vip 👑 Devenir VIP
!button action btn-vip access
!button settarget btn-vip acces-vip
```

### 🔨 Modération

| Commande | Description |
|----------|-------------|
| `!warn <@user> [raison]` | Avertit un utilisateur |
| `!warnings <@user>` | Affiche les avertissements |
| `!clearwarns <@user>` | Efface tous les warnings |
| `!mute <@user> [durée] [raison]` | Mute (timeout) un utilisateur |
| `!unmute <@user>` | Démute un utilisateur |
| `!kick <@user> [raison]` | Expulse un utilisateur |
| `!ban <@user> [raison]` | Bannit un utilisateur |
| `!unban <user_id>` | Débannit un utilisateur |
| `!purge <1-100>` | Supprime des messages en masse |
| `!slowmode <secondes>` | Définit le mode lent |
| `!lock [#salon]` | Verrouille un salon |
| `!unlock [#salon]` | Déverrouille un salon |

**Durées pour mute :** `10s`, `5m`, `2h`, `3d`

### 🎭 Rôles

| Commande | Description |
|----------|-------------|
| `!role add <@user> <@role>` | Donne un rôle |
| `!role remove <@user> <@role>` | Retire un rôle |
| `!role create <nom> [couleur]` | Crée un rôle |
| `!role delete <@role>` | Supprime un rôle |
| `!role color <@role> <#hex>` | Change la couleur |
| `!role info <@role>` | Informations sur un rôle |
| `!role members <@role>` | Liste les membres |
| `!reactionrole set <msg_id> <emoji> <@role>` | Rôle par réaction |
| `!reactionrole remove <msg_id> <emoji>` | Retire un rôle de réaction |
| `!reactionrole list` | Liste les rôles de réaction |

### ⚡ Commandes personnalisées

| Commande | Description |
|----------|-------------|
| `!cc create <nom> <réponse>` | Crée une commande personnalisée |
| `!cc edit <nom> <réponse>` | Modifie la réponse |
| `!cc delete <nom>` | Supprime la commande |
| `!cc list` | Liste toutes les CC |
| `!cc info <nom>` | Informations sur une CC |
| `!cc setembed <nom> <embed_id>` | Associe un embed |

**Exemple :**
```
!cc create discord Rejoignez notre serveur Discord !
!cc create règles Consultez nos règles dans #règles.
!cc setembed règles embed-regles
```

### 📊 Sondages

| Commande | Description |
|----------|-------------|
| `!poll create <question>` | Sondage oui/non |
| `!poll multichoice <question> \| <opt1> \| <opt2> ...` | Sondage multi-choix |
| `!poll end <msg_id>` | Termine un sondage |

**Exemples :**
```
!poll create Aimez-vous ce bot ?

!poll multichoice Quelle couleur préférez-vous ? | Rouge | Bleu | Vert | Jaune
```

---

## Système de boutons interactifs

### Architecture

```
Bouton (button create)
    ↓
Action configurée (button action)
    ↓
┌─────────────────────────────────────────┐
│  ticket  → Crée un salon privé          │
│  access  → Donne accès à un salon       │
│  role    → Donne/retire un rôle         │
│  invite  → Envoie un lien d'invitation  │
│  message → Répond avec texte/embed      │
│  dm      → Envoie un DM                 │
│  modal   → Ouvre un formulaire          │
└─────────────────────────────────────────┘
    ↓
Associé à une annonce (announce addbutton)
    ↓
Envoyé dans un salon (announce send)
```

### Exemple complet — Panneau de rôles

```bash
# 1. Créer les boutons
!button create btn-gamer 🎮 Gamer
!button style btn-gamer success
!button action btn-gamer role
!button settarget btn-gamer @Gamer

!button create btn-artiste 🎨 Artiste
!button style btn-artiste primary
!button action btn-artiste role
!button settarget btn-artiste @Artiste

!button create btn-musicien 🎵 Musicien
!button style btn-musicien secondary
!button action btn-musicien role
!button settarget btn-musicien @Musicien

# 2. Créer l'annonce
!announce create roles-panel
!announce title roles-panel 🎭 Choisissez vos rôles
!announce description roles-panel Cliquez sur les boutons pour obtenir vos rôles !
!announce color roles-panel #5865F2
!announce addbutton roles-panel btn-gamer
!announce addbutton roles-panel btn-artiste
!announce addbutton roles-panel btn-musicien

# 3. Envoyer
!announce send roles-panel #choisir-rôles
```

---

## Données persistantes

Toutes les données sont sauvegardées dans `data.json` :

```json
{
  "config": {
    "prefix": "!",           // Préfixe du bot
    "token": "...",          // Token du bot
    "logChannelId": "...",   // Salon de logs
    "adminRoles": [],        // Rôles administrateurs
    "modRoles": []           // Rôles modérateurs
  },
  "embeds": {                // Embeds créés
    "mon-embed": { "title": "...", "description": "..." }
  },
  "announcements": {         // Annonces créées
    "mon-annonce": { ... }
  },
  "buttons": {               // Boutons créés
    "mon-bouton": { "action": "ticket", ... }
  },
  "tickets": {               // Configuration tickets
    "enabled": true,
    "counter": 0,
    "openTickets": {},
    "closedTickets": {}
  },
  "channelAccess": {},       // Configurations d'accès
  "reactionRoles": {},       // Rôles de réaction
  "customCommands": {},      // Commandes personnalisées
  "welcomeConfig": {},       // Configuration bienvenue
  "moderation": {            // Logs de modération
    "warnLogs": {},
    "muteLogs": {},
    "banLogs": {}
  }
}
```

---

## Variables d'environnement

Pour plus de sécurité, utilisez une variable d'environnement :

```bash
# Linux / macOS
export DISCORD_TOKEN=votre_token_ici
node bot.cjs

# Windows CMD
set DISCORD_TOKEN=votre_token_ici
node bot.cjs

# Windows PowerShell
$env:DISCORD_TOKEN="votre_token_ici"
node bot.cjs
```

Ou créez un fichier `.env` :
```
DISCORD_TOKEN=votre_token_ici
```

---

## Exemples d'utilisation

### Scénario 1 — Configuration initiale

```bash
# Définir le préfixe
!setprefix !

# Définir le salon de logs
!setlogchannel #📋-logs

# Définir le rôle admin
!setadminrole @Administrateur

# Configurer la bienvenue
!setwelcome channel #👋-bienvenue
!setwelcome title 🎉 Bienvenue sur {server} !
!setwelcome description Salut {user} ! Bienvenue parmi nous, nous sommes maintenant {membercount} membres !
!setwelcome color #5865F2
!setwelcome embedon
!welcometest
```

### Scénario 2 — Système de tickets complet

```bash
# Créer la catégorie "Tickets" sur Discord, puis :
!ticket setcategory #🎫-tickets
!ticket setlog #📋-logs-tickets
!ticket setsupport @Support

# Créer le panneau
!ticket panel #📩-créer-un-ticket
```

### Scénario 3 — Annonce avec boutons

```bash
# Créer le bouton de participation
!button create btn-event 🎯 Participer
!button style btn-event success
!button action btn-event role
!button settarget btn-event @Participant
!button setmessage btn-event ✅ Vous avez été inscrit à l'événement !

# Créer l'annonce
!announce create event-jan
!announce title event-jan 🏆 Tournoi de Janvier
!announce description event-jan Rejoignez notre tournoi mensuel et gagnez des prix !
!announce color event-jan #FEE75C
!announce addfield event-jan 📅 Date | 15 Janvier 2025
!announce addfield event-jan 🎁 Prix | 100€ de bon cadeau
!announce addfield event-jan 👥 Places | Limité à 50 participants
!announce timestamp event-jan
!announce addbutton event-jan btn-event
!announce send event-jan #📢-annonces
```

---

## Dépannage

### Le bot ne répond pas

1. Vérifiez que le token est correct dans `data.json`
2. Vérifiez que les intents sont activés sur le Developer Portal
3. Vérifiez que le bot a les permissions nécessaires

### Erreur "Missing Permissions"

Le bot doit avoir les permissions appropriées dans le serveur :
- **Administrateur** (recommandé) ou permissions granulaires
- Le rôle du bot doit être **au-dessus** des rôles qu'il gère

### Les tickets ne se créent pas

1. Exécutez `!ticket setup` pour vérifier la configuration
2. Définissez une catégorie : `!ticket setcategory #catégorie`
3. Vérifiez que le bot peut créer des salons dans cette catégorie

### Les boutons ne répondent pas

- Vérifiez que le bot est en ligne
- Vérifiez que l'action du bouton est bien configurée : `!button info <id>`
- Les boutons Discord expirent après 15 minutes d'inactivité (redémarrez le bot si nécessaire)

### `data.json` corrompu

Si le fichier `data.json` est endommagé, supprimez-le et recréez-le :
```json
{
  "config": { "prefix": "!", "token": "VOTRE_TOKEN" },
  "embeds": {}, "announcements": {}, "buttons": {},
  "tickets": { "enabled": true, "counter": 0, "openTickets": {}, "closedTickets": {} },
  "channelAccess": {}, "reactionRoles": {}, "customCommands": {},
  "welcomeConfig": { "enabled": false }, "moderation": { "warnLogs": {} }
}
```

---

## Structure du code (`bot.cjs`)

```
bot.cjs
├── Imports & Configuration
├── Chargement des données (loadData / saveData)
├── Initialisation du client Discord
├── Utilitaires globaux
│   ├── parseColor()
│   ├── isAdminOrMod()
│   ├── buildEmbedFromData()
│   ├── buildButtonRows()
│   └── replacePlaceholders()
├── Commandes (registerCommand)
│   ├── Utilitaires (ping, uptime, botinfo, serverinfo, userinfo, avatar, help)
│   ├── Configuration (setprefix, setlogchannel, setadminrole, setwelcome...)
│   ├── Embeds (create, title, description, color, image, send, preview...)
│   ├── Annonces (create, send, edit, addbutton...)
│   ├── Boutons (create, action, settarget, style...)
│   ├── Tickets (setup, setcategory, close, panel...)
│   ├── Accès (create, setrole, settype...)
│   ├── Modération (warn, mute, kick, ban, purge...)
│   ├── Rôles (add, remove, create, reactionrole...)
│   ├── Commandes personnalisées (cc create, edit, delete...)
│   └── Sondages (poll create, multichoice, end)
├── Utilitaires avancés
│   ├── createTicket()
│   ├── closeTicket()
│   ├── logAction()
│   └── handleWelcome()
├── Gestionnaires d'interactions
│   ├── handleButtonInteraction()
│   └── handleModalSubmit()
└── Événements Discord
    ├── ClientReady
    ├── MessageCreate
    ├── InteractionCreate
    ├── GuildMemberAdd
    ├── GuildMemberRemove
    ├── MessageReactionAdd/Remove
    ├── MessageDelete
    └── MessageUpdate
```

---

## Licence

MIT License — Libre d'utilisation, de modification et de distribution.

---

## Support

Si vous avez des questions ou des problèmes, consultez :
- [Documentation Discord.js](https://discord.js.org)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Discord.js Guide](https://discordjs.guide)
