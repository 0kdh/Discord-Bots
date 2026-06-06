# 🎙️ SORA Voice — The Ultimate Discord Voice Bot

<div align="center">

```
╔══════════════════════════════════════════════════════════╗
║                    SORA Voice v2.0.0                     ║
║         The Most Complete Voice Channel Manager          ║
║                  for Discord Servers                     ║
╚══════════════════════════════════════════════════════════╝
```

[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20LTS-339933?logo=node.js)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord)](https://discord.js.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-purple)]()

</div>

---

## 📋 Table of Contents

1. [Présentation](#-présentation)
2. [Fonctionnalités](#-fonctionnalités)
3. [Arborescence](#-arborescence)
4. [Installation](#-installation)
5. [Configuration du Token](#-configuration-du-token)
6. [Permissions Discord requises](#-permissions-discord-requises)
7. [Intents nécessaires](#-intents-nécessaires)
8. [Commandes détaillées](#-commandes-détaillées)
9. [Système Temp VC](#-système-temp-vc)
10. [Anti-Voice Abuse](#-anti-voice-abuse)
11. [Statistiques vocales](#-statistiques-vocales)
12. [FAQ](#-faq)
13. [Troubleshooting](#-troubleshooting)

---

## 🎯 Présentation

**SORA Voice** est un bot Discord ultra-complet, dédié **exclusivement** à la gestion des salons vocaux.

Il offre :
- 🔧 Modération vocale complète (mute, kick, move, lock, hide...)
- 🏠 Salons temporaires automatiques (Temp VC avancé)
- 🛡️ Protection anti-abus vocal (anti-raid, anti-spam)
- 📋 Logs vocaux détaillés
- 📊 Statistiques vocales persistantes
- ⚙️ Auto-gestion (AFK, cleanup, auto-mute)
- 👑 Système de permissions interne (owner/admin/mod/helper)
- 💾 Configuration 100% persistante via `data.json`
- 🔧 100% configurable depuis Discord (aucune édition de code)

> **Philosophie :** Aucune commande texte inutile. Tout est centré sur le vocal.

---

## ✨ Fonctionnalités

### 🔇 Voice Modération
| Action | Commande |
|--------|----------|
| Mute serveur | `=vc mute @user` |
| Unmute serveur | `=vc unmute @user` |
| Deafen serveur | `=vc deafen @user` |
| Undeafen serveur | `=vc undeafen @user` |
| Expulsion vocale | `=vc kick @user` |
| Déconnecter | `=vc disconnect @user` |
| Déplacer | `=vc move @user #salon` |
| Verrouiller salon | `=vc lock` |
| Déverrouiller | `=vc unlock` |
| Masquer salon | `=vc hide` |
| Démasquer | `=vc unhide` |
| Limiter users | `=vc limit <0-99>` |
| Changer bitrate | `=vc bitrate <8-384>` |
| Renommer | `=vc rename <nom>` |
| Whitelist user | `=vc permit @user` |
| Blacklist user | `=vc reject @user` |
| Effacer perms | `=vc clearperms` |

### 🏠 Salons Temporaires
- Création automatique quand un user rejoint le salon trigger
- Suppression automatique quand le salon est vide
- Ownership complet : claim, transfer
- Whitelist / Blacklist par salon
- Anti-spam création (cooldown 10s)
- Naming template personnalisable

### 🛡️ Anti-Voice Abuse
- Détection mass join/leave
- Détection move spam
- Détection mute spam
- Fenêtre de détection : 60 secondes
- Actions : warn, kick, ban, tempban
- 5 niveaux de sensibilité

### 📋 Logs Vocaux
- Join / Leave / Move
- Server Mute / Unmute
- Server Deafen / Undeafen
- Channel Create / Delete
- Channel Rename
- Bitrate change / Limit change
- Embeds propres et horodatés

### 📊 Statistiques Vocales
- Temps total en vocal par user
- Nombre de connexions
- Session en cours (temps live)
- Leaderboard Top 10
- Reset par user ou global
- Persistant via `data.json`

### ⚙️ Auto Voice Management
- Auto-mute des nouveaux utilisateurs
- Auto-disconnect AFK configurable (0-1440 min)
- Auto-cleanup des salons temporaires vides
- Template de nommage automatique (`{user}`, `{n}`)

### 👑 Permissions Internes
| Rôle | Capacités |
|------|-----------|
| **Owner** (Discord) | Tout |
| **Admin** (perm Discord) | Tout |
| **Mod** | lock, unlock, hide, mute, kick, move, bitrate, rename, config |
| **Helper** | mute, unmute, deafen, permit, reject, lock, unlock, hide |

---

## 📁 Arborescence

```
/
├── bot.cjs        ← Code principal (tout-en-un)
├── data.json      ← Données persistantes (config, stats, temp channels)
├── package.json   ← Dépendances & scripts npm
└── README.md      ← Documentation complète
```

> ⚠️ Aucun autre fichier. Aucun dossier. Architecture volontairement minimaliste.

---

## 🚀 Installation

### Prérequis

- **Node.js** v18 ou supérieur ([télécharger](https://nodejs.org))
- Un **bot Discord** créé sur le [Developer Portal](https://discord.com/developers/applications)

### Étapes

```bash
# 1. Cloner ou télécharger les fichiers
git clone <repo> sora-voice
cd sora-voice

# 2. Installer les dépendances
npm install

# 3. Définir le token (voir section suivante)
export DISCORD_TOKEN=votre_token_ici

# 4. Lancer le bot
node bot.cjs

# Ou via npm start
npm start
```

---

## 🔑 Configuration du Token

Le bot lit le token depuis les **variables d'environnement** :

```bash
# Linux / macOS
export DISCORD_TOKEN=OTk1M...votre_token

# Windows (CMD)
set DISCORD_TOKEN=OTk1M...votre_token

# Windows (PowerShell)
$env:DISCORD_TOKEN="OTk1M...votre_token"
```

### Option .env (recommandé en production)

Créez un fichier `.env` à la racine :

```env
DISCORD_TOKEN=OTk1MTA3NTg2MDY2MDg4NjQ2.G_exemple.token_complet_ici
```

Puis installez `dotenv` et ajoutez au début de `bot.cjs` :

```js
require('dotenv').config();
```

### Où trouver le token ?

1. Allez sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. Sélectionnez votre application
3. Menu **Bot** → **Reset Token** → copiez le token
4. ⚠️ **Ne partagez JAMAIS votre token** (accès total au bot)

---

## 🔐 Permissions Discord requises

Lors de l'invitation du bot, cochez ou utilisez le lien avec ces permissions :

| Permission | Pourquoi |
|-----------|----------|
| `View Channels` | Voir les salons |
| `Send Messages` | Envoyer des réponses embed |
| `Embed Links` | Afficher les embeds |
| `Attach Files` | Envoyer le fichier de backup |
| `Read Message History` | Lire les messages passés |
| `Manage Channels` | Créer/supprimer/modifier les salons vocaux |
| `Move Members` | Déplacer les membres entre salons |
| `Mute Members` | Mute serveur |
| `Deafen Members` | Deafen serveur |
| `Kick Members` | Expulsion (anti-abuse) |
| `Ban Members` | Bannissement (anti-abuse) |
| `Manage Permissions` | Modifier les permissions des salons |

### Lien d'invitation avec permissions complètes

```
https://discord.com/oauth2/authorize?client_id=VOTRE_CLIENT_ID&permissions=1099511627775&scope=bot
```

*(Remplacez `VOTRE_CLIENT_ID` par l'ID de votre application)*

---

## 🎛️ Intents nécessaires

Activez ces intents sur le [Developer Portal](https://discord.com/developers/applications) → **Bot** → **Privileged Gateway Intents** :

| Intent | Obligatoire | Utilisation |
|--------|-------------|-------------|
| `GUILD_MEMBERS` | ✅ Oui | Récupérer les membres |
| `MESSAGE_CONTENT` | ✅ Oui | Lire le contenu des commandes |
| `GUILD_VOICE_STATES` | ✅ Oui | Détecter les événements vocaux |

> ⚠️ Sans ces intents activés, le bot **ne fonctionnera pas**.

---

## 📖 Commandes détaillées

### Préfixe par défaut : `=`

---

### 🔧 Voice Moderation (`=vc`)

#### `=vc mute @user`
Applique un mute **serveur** à l'utilisateur en vocal.
- Permission requise : Helper+
- L'utilisateur doit être dans un salon vocal

#### `=vc unmute @user`
Retire le mute serveur.
- Permission requise : Helper+

#### `=vc deafen @user`
Applique un deafen **serveur** (l'utilisateur n'entend plus rien).
- Permission requise : Helper+

#### `=vc undeafen @user`
Retire le deafen serveur.
- Permission requise : Helper+

#### `=vc kick @user`
**Expulse vocalement** l'utilisateur (le déconnecte du salon).
- Permission requise : Mod+
- Ne bannit pas le membre du serveur

#### `=vc disconnect @user`
**Déconnecte** complètement l'utilisateur de la voix.
- Permission requise : Mod+

#### `=vc move @user #salon-vocal`
**Déplace** l'utilisateur vers un autre salon vocal.
- Permission requise : Mod+
- Mentionner le salon cible

#### `=vc lock`
**Verrouille** le salon vocal (personne ne peut rejoindre).
- Permission requise : Helper+
- Agit sur le salon vocal de l'auteur de la commande

#### `=vc unlock`
**Déverrouille** le salon vocal.
- Permission requise : Helper+

#### `=vc hide`
**Masque** le salon vocal (@everyone ne peut plus le voir).
- Permission requise : Helper+

#### `=vc unhide`
**Démasque** le salon vocal.
- Permission requise : Helper+

#### `=vc limit <nombre>`
Définit la **limite d'utilisateurs** (0 = illimité, max 99).
- Permission requise : Helper+
- Exemple : `=vc limit 5`, `=vc limit 0`

#### `=vc bitrate <kbps>`
Change le **bitrate** du salon (8-384 kbps).
- Permission requise : Mod+
- Exemple : `=vc bitrate 96`, `=vc bitrate 320`
- Note : Le maximum dépend du boost du serveur

#### `=vc rename <nouveau nom>`
**Renomme** le salon vocal.
- Permission requise : Helper+
- Max 100 caractères
- Exemple : `=vc rename 🎮 Gaming Room`

#### `=vc permit @user`
**Autorise** un utilisateur dans le salon (bypasse le lock/hide).
- Permission requise : Helper+
- Ajoute à la whitelist du temp channel si applicable

#### `=vc reject @user`
**Bloque** un utilisateur du salon et le déconnecte s'il y est.
- Permission requise : Helper+
- Ajoute à la blacklist du temp channel si applicable

#### `=vc clearperms`
**Efface toutes les permissions** individuelles du salon.
- Permission requise : Mod+
- Remet les permissions à l'état par défaut

#### `=vc claim`
**Revendique** la propriété d'un salon temporaire dont le propriétaire est parti.
- Vous devez être dans le salon
- Le propriétaire actuel ne doit plus être dans le salon

#### `=vc transfer @user`
**Transfère la propriété** de votre salon temporaire.
- La cible doit être dans le salon
- Seul le propriétaire (ou un Mod) peut transférer

#### `=vc info`
Affiche les **informations complètes** du salon vocal courant.
- Membres, bitrate, limite, région
- Owner, whitelist, blacklist (si temp channel)

---

### 🏠 Système Temp VC

#### `=setup tempvc #salon-vocal [#categorie]`
**Configure** le système de salons temporaires.
- Permission requise : Mod+
- `#salon-vocal` = le salon que les users rejoignent pour créer un room
- `#categorie` (optionnel) = catégorie où créer les salons

**Fonctionnement :**
1. L'admin configure un salon trigger avec `=setup tempvc`
2. Quand un user rejoint ce salon, SORA crée automatiquement un salon privé
3. L'user est déplacé dans son nouveau salon
4. Quand le salon est vide, il est automatiquement supprimé

**Template de nommage** (via `=autoname <template>`) :
- `{user}` → Nom d'affichage du propriétaire
- `{n}` → Numéro séquentiel
- Exemple : `=autoname 🎮 {user}'s Room`

---

### 🛡️ Anti-Voice Abuse

#### `=antivoice on`
Active la protection anti-abus vocal.
- Permission requise : Mod+

#### `=antivoice off`
Désactive la protection.
- Permission requise : Mod+

#### `=antivoice sensitivity <1-5>`
Configure la **sensibilité** de détection.
| Niveau | Joins/60s | Moves/60s | Mutes/60s |
|--------|-----------|-----------|-----------|
| 1 (Très laxiste) | 20 | 15 | 20 |
| 2 | 15 | 10 | 15 |
| 3 (Défaut) | 10 | 7 | 10 |
| 4 | 7 | 5 | 7 |
| 5 (Très strict) | 4 | 3 | 4 |

#### `=antivoice action <warn/kick/ban/tempban>`
Configure l'**action** déclenchée lors d'une détection.
| Action | Effet |
|--------|-------|
| `warn` | Envoie un DM d'avertissement |
| `kick` | Déconnecte du vocal + expulse du serveur |
| `ban` | Bannissement permanent |
| `tempban` | Bannissement temporaire 1 heure |

---

### 📋 Voice Logs

#### `=setlog #channel`
Définit le **salon de logs** vocaux.
- Permission requise : Mod+
- Doit être un salon texte

#### `=logs on`
Active les logs vocaux.
- Permission requise : Mod+

#### `=logs off`
Désactive les logs vocaux.
- Permission requise : Mod+

**Événements loggés :**
- 🟢 Voice Join / 🔴 Voice Leave
- 🔀 Voice Move
- 🔇 Server Muted / 🔊 Server Unmuted
- 🔕 Server Deafened / 🔔 Server Undeafened
- 🆕 Channel Created / 🗑️ Channel Deleted
- ✏️ Channel Renamed
- 👥 Limit Changed / 📡 Bitrate Changed
- 🛡️ Anti-Voice Triggered

---

### 📊 Voice Statistics

#### `=vstats` ou `=vstats @user`
Affiche les **statistiques vocales** d'un utilisateur.
- Temps total en vocal
- Nombre de connexions
- Session en cours (temps live)

#### `=vtop`
Affiche le **leaderboard** des 10 utilisateurs avec le plus de temps en vocal.
- 🥇 🥈 🥉 pour le podium

#### `=vreset [@user]`
**Remet à zéro** les statistiques vocales.
- Permission requise : Mod+
- Sans argument : reset de tout le serveur
- Avec mention : reset uniquement cet utilisateur

---

### ⚙️ Auto Voice Management

#### `=automute on/off`
Active/désactive le **mute automatique** des utilisateurs qui rejoignent un salon vocal.
- Permission requise : Mod+
- Utile pour les events/conférences

#### `=afktime <minutes>`
Configure le **délai AFK** avant déconnexion automatique.
- Permission requise : Mod+
- `0` = désactivé
- Min : 0, Max : 1440 minutes (24h)
- Exemple : `=afktime 30`

#### `=autocleanup on/off`
Active/désactive le **nettoyage automatique** des salons temporaires vides.
- Permission requise : Mod+
- Par défaut : activé

#### `=autoname <template>`
Définit le **template de nommage** pour les salons temporaires.
- Permission requise : Mod+
- Variables : `{user}` (nom), `{n}` (numéro)
- Sans argument : reset au défaut
- Exemple : `=autoname 🎮 Room de {user}`

---

### 👑 Gestion des Permissions

#### `=addmod @user`
Ajoute un **Modérateur SORA Voice**.
- Permission requise : Admin+
- Un Mod peut utiliser toutes les commandes vocales

#### `=removemod @user` / `=remmod @user`
Retire le statut de Modérateur.
- Permission requise : Admin+

#### `=addhelper @user`
Ajoute un **Helper SORA Voice**.
- Permission requise : Mod+
- Un Helper peut utiliser les commandes basiques (mute, lock, hide, permit, reject)

#### `=remhelper @user` / `=removehelper @user`
Retire le statut de Helper.
- Permission requise : Mod+

---

### 🔩 Configuration Générale

#### `=config`
Affiche la **configuration complète** du serveur.
- Préfixe, couleur, logs, temp VC, auto-voice, anti-voice
- Listes des mods et helpers

#### `=prefix <nouveau-préfixe>`
Change le **préfixe** du bot pour ce serveur.
- Permission requise : Mod+
- Max 5 caractères
- Exemple : `=prefix !` → les commandes deviennent `!help`, `!vc`, etc.

#### `=embedcolor #hex`
Change la **couleur** des embeds du bot.
- Permission requise : Mod+
- Format : `#RRGGBB`
- Exemple : `=embedcolor #FF5733`

#### `=language <code>`
Change la **langue** du bot *(placeholder, future feature)*.
- Permission requise : Mod+
- Codes supportés : `en`, `fr`, `es`, `de`, `pt`

#### `=resetconfig`
**Remet à zéro** toute la configuration du serveur.
- Permission requise : Owner / Admin

#### `=backup`
Exporte la **configuration** du serveur en fichier JSON.
- Permission requise : Mod+
- Fichier : `sora-backup-GUILDID.json`
- Contient : config, anti-voice, auto-voice

#### `=restore`
**Importe** une configuration depuis un fichier JSON.
- Permission requise : Owner / Admin
- Joindre le fichier de backup en pièce jointe
- Exemple : `=restore` (avec le fichier .json attaché)

#### `=ping`
Affiche la **latence** du bot en ms.

#### `=invite`
Affiche le **lien d'invitation** du bot.

---

## 🏠 Système Temp VC

### Mise en place complète

```
1. Créer un salon vocal "➕ Créer un salon" dans une catégorie
2. Lancer : =setup tempvc #créer-un-salon
3. C'est tout !
```

### Workflow

```
User rejoint "➕ Créer un salon"
        ↓
SORA crée automatiquement "🎮 Username's Room"
        ↓
User déplacé dans son nouveau salon
        ↓
User peut gérer son salon via =vc lock/hide/limit/rename/etc.
        ↓
Salon vide → SORA le supprime automatiquement
```

### Propriété (Ownership)

- L'utilisateur qui crée le salon en est le **propriétaire**
- Il peut `=vc transfer @user` pour céder sa place
- Si le propriétaire part, n'importe quel membre du salon peut `=vc claim`
- Le propriétaire a automatiquement les permissions ManageChannels, MoveMembers, MuteMembers sur son salon

---

## 🛡️ Anti-Voice Abuse

### Détection automatique

Le système surveille, dans une fenêtre de **60 secondes** :
- **Mass join** : Un utilisateur rejoint massivement des salons
- **Move spam** : Un utilisateur déplace massivement des membres
- **Mute spam** : Un utilisateur mute/unmute massivement

### Configuration recommandée pour les grands serveurs

```
=antivoice on
=antivoice sensitivity 3
=antivoice action kick
=setlog #logs-vocaux
=logs on
```

---

## ❓ FAQ

**Q: Le bot ne répond pas à mes commandes.**
> Vérifiez que : (1) le token est correct, (2) l'intent `MESSAGE_CONTENT` est activé dans le Dev Portal, (3) le bot a les permissions de lire/envoyer des messages dans le salon.

**Q: Le système Temp VC ne crée pas de salon.**
> Vérifiez que : (1) `=setup tempvc #salon` a été configuré, (2) le bot a la permission `Manage Channels` et `Move Members`, (3) le salon trigger est bien un salon vocal.

**Q: Les logs ne s'affichent pas.**
> Vérifiez que : (1) `=setlog #channel` a été configuré, (2) `=logs on` a été exécuté, (3) le bot peut envoyer des embeds dans le salon de logs.

**Q: Je veux changer le préfixe.**
> `=prefix !` (remplace `=` par `!`). Après ça, utilisez `!help`.

**Q: Le bot crash au démarrage.**
> Vérifiez que : (1) Node.js v18+ est installé (`node -v`), (2) `npm install` a été exécuté, (3) le token est correctement défini dans la variable d'environnement.

**Q: Puis-je avoir plusieurs bots SORA sur le même serveur ?**
> Non, mais vous pouvez avoir un seul bot configuré différemment par serveur. Chaque serveur a sa propre config dans `data.json`.

**Q: Comment sauvegarder les données ?**
> Les données sont sauvegardées automatiquement toutes les 30 secondes et à chaque commande de modification. Utilisez `=backup` pour exporter et `=restore` pour importer.

**Q: Le bot peut-il gérer les Stage Channels ?**
> SORA Voice est optimisé pour les `GuildVoice` channels. Les Stage Channels ont une API différente et ne sont pas supportés dans cette version.

**Q: Comment réinitialiser complètement le bot ?**
> Supprimez le contenu de `data.json` (remplacez-le par le contenu par défaut) et redémarrez le bot.

---

## 🛠️ Troubleshooting

### Erreur : "Missing Permissions"
```
❌ Missing Permissions
```
→ Le bot manque de permissions Discord. Vérifiez les permissions dans Paramètres du serveur → Rôles → SORA Voice.

### Erreur : "Used disallowed intents"
```
Error: Used disallowed intents
```
→ Les intents Privileged ne sont pas activés. Allez sur discord.com/developers → votre app → Bot → Privileged Gateway Intents → cochez tout.

### Erreur : "Invalid Token"
```
Error: An invalid token was provided.
```
→ Le token est incorrect ou a expiré. Régénérez un nouveau token dans le Dev Portal.

### Le bot ne voit pas les membres dans les salons vocaux
→ Vérifiez l'intent `GUILD_MEMBERS` et `GUILD_VOICE_STATES`.

### `data.json` corrompu
Si `data.json` est corrompu, le bot utilisera des données par défaut et tentera de recréer le fichier. Vous pouvez aussi le supprimer manuellement et relancer le bot.

### Commandes ignorées (cooldown)
Le bot applique un cooldown de **2 secondes** par utilisateur pour éviter le spam. Attendez 2 secondes entre les commandes.

### Logs console
Le bot affiche des logs détaillés dans la console :
```
[SORA] ✅ data.json loaded successfully.
[SORA][TempVC] Created "Username's Room" for user#1234
[SORA][AntiVoice] kick on spammer#5678 for joins (10x)
[SORA] 💾 Auto-saved data.json
```

---

## 📜 Changelog

### v2.0.0
- Release initiale complète
- Modération vocale complète (16 sous-commandes)
- Système Temp VC avancé avec ownership
- Anti-Voice Abuse avec 4 niveaux d'action
- Logs vocaux ultra-détaillés
- Statistiques vocales persistantes
- Auto-gestion (AFK, cleanup, auto-mute)
- Système de permissions interne (Mod/Helper)
- Backup/Restore de configuration
- Anti-crash et auto-save atomique

---

## 📄 Licence

MIT License — Libre d'utilisation, modification et distribution.

---

<div align="center">

**SORA Voice** — *Because every voice deserves to be managed perfectly.*

Made with ❤️ and Discord.js v14

</div>
