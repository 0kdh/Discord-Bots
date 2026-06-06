# 🤖 ModerationBot — Bot Discord Modération Avancée

Bot Discord de modération **complet** avec plus de **80 commandes** dédiées à la modération de serveur.

---

## 🚀 Installation

```bash
npm install
```

### Configuration

Ouvrez `bot.js` et modifiez la section `DEFAULT_CONFIG` :

```js
TOKEN    : 'VOTRE_TOKEN_ICI',      // Token du bot Discord
PREFIX   : '-',                    // Préfixe par défaut
OWNER_IDS: ['VOTRE_ID_ICI'],       // Votre ID Discord
```

Ou utilisez une variable d'environnement :
```bash
BOT_TOKEN=votre_token node bot.js
```

### Démarrage

```bash
npm start
# ou en développement (auto-reload)
npm run dev
```

---

## ⚙️ Configuration dans Discord

Toute la configuration se fait **directement dans Discord** grâce à la commande `-config` :

| Commande | Description |
|---|---|
| `-config` | Ouvre le panneau de configuration (formulaire Discord) |
| `-setprefix <préfixe>` | Change le préfixe |
| `-setlogchannel [#salon]` | Définit le salon de logs |
| `-setmuterole <@rôle>` | Définit le rôle Muted |
| `-setbotdelete <off\|5s\|30s>` | Suppression automatique des réponses du bot |
| `-setcmddelete <off\|on\|5s>` | Suppression automatique des commandes utilisateur |
| `-anticonfig` | Configure les seuils des anti-systèmes |
| `-automod <warn\|mute\|kick\|ban> <seuil>` | Configure l'automod progressif |

---

## 📋 Toutes les commandes

### 🔨 Modération Membres
| Commande | Description |
|---|---|
| `-ban <@membre\|ID> [raison]` | Bannit définitivement |
| `-tempban <@membre\|ID> <durée> [raison]` | Bannit temporairement |
| `-unban <ID> [raison]` | Débannit |
| `-kick <@membre> [raison]` | Expulse |
| `-softban <@membre> [raison]` | Softban (supprime les messages + kick) |
| `-massban <ID1> <ID2> ... [--reason]` | Bannit plusieurs utilisateurs |
| `-masskick <@m1> <@m2> ...` | Expulse plusieurs membres |
| `-unbanall` | Débannit tous les membres bannis |
| `-checkban <ID>` | Vérifie si un utilisateur est banni |
| `-listbans [page]` | Liste les membres bannis |

### 🔇 Mute / Timeout
| Commande | Description |
|---|---|
| `-mute <@membre> [durée] [raison]` | Mute via rôle Muted |
| `-tempmute <@membre> <durée> [raison]` | Mute temporaire (durée obligatoire) |
| `-unmute <@membre>` | Unmute |
| `-timeout <@membre> <durée> [raison]` | Timeout natif Discord (max 28j) |
| `-untimeout <@membre>` | Retire le timeout |
| `-massmute <@m1> <@m2> ... [durée]` | Mute plusieurs membres |
| `-massunmute <@m1> <@m2> ...` | Unmute plusieurs membres |
| `-masstimeout <@m1> ... <durée>` | Timeout plusieurs membres |
| `-listmutes` | Liste les membres mutés |

### ⚠️ Avertissements
| Commande | Description |
|---|---|
| `-warn <@membre\|ID> [raison]` | Avertit un membre |
| `-warnings <@membre\|ID>` | Affiche les avertissements |
| `-delwarn <@membre\|ID> <ID_warn>` | Supprime un warn spécifique |
| `-clearwarns <@membre\|ID>` | Supprime tous les warns |

### 💬 Messages
| Commande | Description |
|---|---|
| `-clear <1-1000> [@membre]` | Supprime des messages |
| `-clearall` | Supprime tous les messages récents |
| `-clearuser <@membre> [nb]` | Supprime les messages d'un utilisateur |
| `-clearbot [nb]` | Supprime les messages des bots |
| `-clearlinks [nb]` | Supprime les messages avec liens |
| `-clearcontaining <mot> [nb]` | Supprime les messages contenant un mot |
| `-clearembed [nb]` | Supprime les messages avec embeds |
| `-say [#salon] <message>` | Fait parler le bot |
| `-edit <messageID> <contenu>` | Modifie un message du bot |
| `-embed` | Crée un embed via formulaire |

### 🔒 Salons
| Commande | Description |
|---|---|
| `-lock [#s1] [#s2] ...` | Verrouille un/plusieurs salons |
| `-unlock [#s1] [#s2] ...` | Déverrouille un/plusieurs salons |
| `-lockall [raison]` | Verrouille tous les salons |
| `-unlockall` | Déverrouille tous les salons verrouillés |
| `-hide [#s1] [#s2] ...` | Cache un/plusieurs salons |
| `-unhide [#s1] [#s2] ...` | Affiche un/plusieurs salons |
| `-hideall` | Cache tous les salons |
| `-unhideall` | Affiche tous les salons |
| `-slowmode <sec> [#s1] ...` | Mode lent sur plusieurs salons |
| `-recreate [#salon]` | Nuke un salon |
| `-clone [#salon]` | Clone un salon |
| `-renamechannel [#salon] <nom>` | Renomme un salon |
| `-topic [#salon] <topic>` | Change le topic |
| `-createchannel <nom> [type]` | Crée un salon |
| `-deletechannel [#salon]` | Supprime un salon |

### 🎭 Rôles
| Commande | Description |
|---|---|
| `-role <@membre> <@rôle>` | Ajoute un rôle |
| `-removerole <@membre> <@rôle>` | Retire un rôle |
| `-roleall <@rôle> [--bots\|--humans]` | Donne un rôle à tous |
| `-removeroleall <@rôle>` | Retire un rôle à tous |
| `-createrole <nom> [#couleur]` | Crée un rôle |
| `-deleterole <@rôle>` | Supprime un rôle |
| `-rolecolor <@rôle> <#hex>` | Change la couleur d'un rôle |
| `-rolename <@rôle> <nom>` | Renomme un rôle |
| `-hoist <@rôle>` | Toggle l'affichage séparé |
| `-mentionable <@rôle>` | Toggle la mentionnabilité |

### 👤 Membres
| Commande | Description |
|---|---|
| `-nick <@membre> [surnom]` | Change le surnom |
| `-massnick <surnom>` | Change tous les surnoms |
| `-note <@membre> <note>` | Ajoute une note privée |
| `-notes <@membre>` | Affiche les notes |
| `-clearnotes <@membre>` | Supprime les notes |
| `-verify <@membre>` | Donne le rôle Membre |
| `-unverify <@membre>` | Retire le rôle Membre |

### 📋 Cas de Modération
| Commande | Description |
|---|---|
| `-case <numéro>` | Affiche un cas |
| `-modlog <@membre> [page]` | Historique avec pagination |
| `-editcase <numéro> <raison>` | Modifie une raison |
| `-clearcase <@membre>` | Supprime l'historique |

### 🛡️ Anti-Systèmes
| Commande | Description |
|---|---|
| `-antilink <on\|off>` | Anti-lien |
| `-antispam <on\|off>` | Anti-spam |
| `-antiinvite <on\|off>` | Anti-invitation |
| `-antibot <on\|off>` | Anti-bot |
| `-antiraid <on\|off>` | Anti-raid |
| `-anticaps <on\|off>` | Anti-majuscules |
| `-antimention <on\|off>` | Anti-mass-mention |
| `-antizalgo <on\|off>` | Anti-zalgo |
| `-antiflood <on\|off>` | Anti-flood |
| `-antistatus` | État de tous les anti-systèmes |
| `-blacklist <add\|remove\|list> [mot]` | Blacklist de mots |
| `-whitelist <add\|remove\|list> <role\|channel> [@\|#]` | Whitelist |
| `-anticonfig` | Configure les seuils (formulaire) |
| `-automod <warn\|mute\|kick\|ban> <seuil>` | Automod progressif |

### ℹ️ Informations
| Commande | Description |
|---|---|
| `-userinfo [@membre\|ID]` | Infos d'un membre |
| `-serverinfo` | Infos du serveur |
| `-avatar [@membre\|ID]` | Avatar d'un membre |
| `-banner [@membre\|ID]` | Bannière de profil |
| `-roleinfo <@rôle>` | Infos d'un rôle |
| `-ping` | Latence du bot |
| `-botinfo` | Infos sur le bot |
| `-membercount` | Compteur de membres |
| `-permissions [@membre] [#salon]` | Permissions dans un salon |
| `-inviteinfo <code>` | Infos d'une invitation |
| `-listbans [page]` | Liste des bannis |
| `-listmutes` | Liste des mutés |

### 📋 Utilitaires
| Commande | Description |
|---|---|
| `-transcript [#salon] [nb]` | Génère un transcript |
| `-export` | Exporte les données du bot |
| `-dm <@membre\|ID> <message>` | Message privé |
| `-announce [#salon] <message>` | Annonce embed |
| `-poll [#salon] <question> \| <opt1> \| <opt2>` | Sondage |
| `-invites [@membre]` | Liste les invitations |
| `-delinvite <code>` | Supprime une invitation |
| `-delinviteall` | Supprime toutes les invitations |
| `-search <texte> [#salon]` | Recherche dans les messages |
| `-movemsg <messageID> <#salon>` | Déplace un message |
| `-pin <messageID>` | Épingle un message |
| `-unpin <messageID>` | Désépingle un message |
| `-pins [#salon]` | Messages épinglés |
| `-react <messageID> <emoji>` | Fait réagir le bot |
| `-unreact <messageID>` | Supprime les réactions du bot |

### ⚙️ Configuration (Owner)
| Commande | Description |
|---|---|
| `-config` | Panneau de configuration complet |
| `-setprefix <préfixe>` | Change le préfixe |
| `-setlogchannel [#salon]` | Salon de logs |
| `-setmuterole <@rôle>` | Rôle Muted |
| `-addmodrole <@rôle>` | Ajoute un rôle staff |
| `-removemodrole <@rôle>` | Retire un rôle staff |
| `-listmodroles` | Liste les rôles staff |
| `-setbotdelete <off\|5s\|30s>` | Suppression réponses bot |
| `-setcmddelete <off\|on\|5s>` | Suppression cmds utilisateur |
| `-autorole <add\|remove\|list> [@rôle]` | Autoroles |
| `-setup` | Setup automatique du serveur |
| `-setname <nom>` | Renomme le serveur |
| `-seticon <url>` | Change l'icône |
| `-setbanner <url>` | Change la bannière |

---

## 🔐 Permissions requises

Le bot nécessite les permissions suivantes :
- `Administrator` (recommandé pour toutes les fonctionnalités)

Ou au minimum :
- `Manage Roles`, `Kick Members`, `Ban Members`, `Manage Messages`, `Manage Channels`, `View Audit Log`, `Read Message History`, `Send Messages`, `Embed Links`, `Attach Files`, `Manage Nicknames`

---

## 🛡️ Système AutoMod Progressif

Le bot inclut un système d'automod progressif basé sur les avertissements :

| Seuil (défaut) | Action |
|---|---|
| 3 warns | ⚠️ Warn supplémentaire |
| 5 warns | 🔇 Mute automatique |
| 7 warns | 👢 Kick automatique |
| 10 warns | 🔨 Ban automatique |

Configurable via `-automod <action> <seuil>`.

---

## 📊 Persistance des données

Toutes les données sont sauvegardées dans `data.json` :
- Avertissements
- Historique de modération (cas)
- Notes staff
- Configuration par serveur
- Blacklist de mots
- Mutes/bans temporaires (résumés au redémarrage)

---

## 🔧 Durées supportées

| Format | Durée |
|---|---|
| `30s` | 30 secondes |
| `10m` | 10 minutes |
| `2h` | 2 heures |
| `1d` | 1 jour |
| `1w` | 1 semaine |

---

## 📝 Notes importantes

- Le préfixe par défaut est `-` (configurable par serveur)
- Les commandes `ownerOnly` sont réservées aux IDs dans `OWNER_IDS`
- Les commandes `staffOnly` nécessitent un rôle staff (configurable via `-addmodrole`)
- Les systèmes anti-X ignorent automatiquement le staff
- La whitelist permet d'exempter des rôles/salons des anti-systèmes
- Les tempmutes et tempbans survivent aux redémarrages du bot
