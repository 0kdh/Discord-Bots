# 🎉 Giveaway Bot — Ultra Complet

Bot Discord complet pour gérer des **giveaways** entièrement personnalisables, avec système de templates, requirements, blacklist, stats, et bien plus.

---

## 📦 Installation

```bash
npm install
```

Puis éditez `data.json` et remplacez `TON_TOKEN_ICI` par votre token Discord.

```bash
node bot.js
# ou en dev :
npm run dev
```

---

## ⚙️ Configuration (`data.json`)

| Clé | Description |
|-----|-------------|
| `prefix` | Préfixe des commandes (modifiable via `!setprefix`) |
| `token` | Token du bot Discord |
| `managers` | Liste des IDs autorisés à gérer les giveaways |
| `logChannel` | ID du salon de logs |
| `defaultColor` | Couleur par défaut des embeds |
| `defaultFooter` | Footer par défaut |
| `dmWinners` | DM les gagnants automatiquement |
| `winAnnouncement` | Annonce les gagnants dans le salon |
| `timezone` | Fuseau horaire (ex: Europe/Paris) |
| `language` | Langue (fr / en) |
| `maxWinners` | Nombre maximum de gagnants par giveaway |
| `maxDuration` | Durée maximale d'un giveaway (ms) |
| `minDuration` | Durée minimale d'un giveaway (ms) |

---

## 🎮 Commandes

### 🟢 Giveaways

| Commande | Description |
|----------|-------------|
| `!gcreate` | Créer un giveaway en mode interactif (wizard) |
| `!gstart <durée> <gagnants> <#salon> <prix>` | Créer un giveaway rapide |
| `!gend <messageID>` | Terminer un giveaway immédiatement |
| `!greroll <messageID> [gagnants]` | Relancer le tirage au sort |
| `!gpause <messageID>` | Mettre en pause un giveaway |
| `!gresume <messageID>` | Reprendre un giveaway mis en pause |
| `!gdelete <messageID>` | Supprimer un giveaway |
| `!gedit <messageID> <champ> <valeur>` | Modifier un giveaway en cours |
| `!glist [#salon]` | Lister les giveaways actifs |
| `!ginfo <messageID>` | Infos détaillées sur un giveaway |
| `!gparticipants <messageID>` | Voir les participants |

### 🎨 Templates

| Commande | Description |
|----------|-------------|
| `!gtemplate create <nom>` | Créer un template |
| `!gtemplate list` | Lister les templates |
| `!gtemplate use <nom> <durée> <gagnants> <#salon> <prix>` | Utiliser un template |
| `!gtemplate delete <nom>` | Supprimer un template |
| `!gtemplate info <nom>` | Voir les détails d'un template |

### 🔧 Configuration

| Commande | Description |
|----------|-------------|
| `!setprefix <nouveau>` | Changer le préfixe du bot |
| `!gconfig` | Voir la config actuelle |
| `!gconfig set <clé> <valeur>` | Modifier une config |
| `!gconfig embed` | Configurer le template d'embed |
| `!gconfig color <hex>` | Changer la couleur par défaut |
| `!gconfig footer <texte>` | Changer le footer par défaut |
| `!gconfig button <label>` | Changer le label du bouton |
| `!gconfig dmwinners <on/off>` | Activer/désactiver les DM |
| `!gconfig logchannel <#salon>` | Définir le salon de logs |
| `!gconfig manager add/remove <@user/@role>` | Gérer les managers |

### ⛔ Blacklist

| Commande | Description |
|----------|-------------|
| `!gblacklist add <@user>` | Blacklister un utilisateur |
| `!gblacklist remove <@user>` | Retirer de la blacklist |
| `!gblacklist list` | Voir la blacklist |

### 📊 Stats

| Commande | Description |
|----------|-------------|
| `!gstats` | Stats globales du bot |
| `!gstats user <@user>` | Stats d'un utilisateur |

### ℹ️ Aide

| Commande | Description |
|----------|-------------|
| `!ghelp` | Aide complète |
| `!ghelp <commande>` | Aide sur une commande |
| `!gping` | Latence du bot |

---

## ⏱️ Format de durée

| Format | Signification |
|--------|--------------|
| `30s` | 30 secondes |
| `10m` | 10 minutes |
| `2h` | 2 heures |
| `1d` | 1 jour |
| `1w` | 1 semaine |

---

## ✅ Requirements (conditions d'entrée)

Lors de la création d'un giveaway, vous pouvez définir :

- **Rôles requis** : l'utilisateur doit avoir un ou plusieurs rôles
- **Rôles blacklistés** : l'utilisateur ne doit pas avoir ces rôles
- **Ancienneté de compte** : compte Discord minimum en jours
- **Ancienneté dans le serveur** : durée minimum en jours
- **Nombre d'invitations** : minimum d'invitations requis (si bot d'invitations compatible)

---

## 🧩 Template d'embed (Photo de référence)

```
┌─────────────────────────────┐
│  nitro boost                │
│                             │
│  Time left: 46m 58s         │
│  Ends: dans 47 minutes ...  │
│  Hosted by: @as you want    │
│  Entries: 55                │
│  Winners: 5                 │
│                             │
│  [ 🎉 Participer ]          │
└─────────────────────────────┘
```

---

## 🛡️ Permissions

- Les **managers** (définis dans `data.json` ou via commande) peuvent gérer les giveaways
- Les membres avec la permission `ManageGuild` sont automatiquement managers
- Le propriétaire du serveur a tous les droits

---

## 📝 Notes

- Les giveaways sont sauvegardés dans `data.json` — aucune base de données externe requise
- Le bot reprend tous les giveaways actifs au redémarrage
- Les logs sont envoyés dans le salon défini via `!gconfig logchannel`
- Les templates sont sauvegardés par serveur

---

## 🔒 Intents Discord requis

Activez dans le **Developer Portal** :
- `MESSAGE CONTENT INTENT`
- `SERVER MEMBERS INTENT`
- `PRESENCE INTENT`

---

## 📄 Licence

MIT — Libre d'utilisation et de modification.
