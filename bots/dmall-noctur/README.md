# DMAll Bot v3

Bot Discord de DM massif professionnel.

## Commandes

| Commande | Description |
|---|---|
| `&dmall <message>` | Envoi massif a tous les membres |
| `&dmall role <@role> <message>` | Envoi cible par role |
| `&dmall template <nom>` | Utilise un template sauvegarde |
| `&dmall preview <message>` | Apercu du rendu des variables |
| `&dmall test <@user> <message>` | Test sur un seul membre |
| `&cancel` | Annuler le DMAll en cours |
| `&status` | Progression du DMAll |
| `&optout` / `&optin` | Gerer la reception des DMs |
| `&template create/list/delete/edit/preview` | Gestion des templates |
| `&schedule <timestamp> <message>` | Planifier un DMAll |
| `&schedule list` / `&schedule delete` | Gerer les plannifications |
| `&blacklist add/remove/list/clear` | Blacklist de membres |
| `&whitelist add/remove/list/clear/toggle` | Whitelist et mode restreint |
| `&stats [24h|7d|30d|all]` | Statistiques |
| `&dmsettings [enable|disable]` | Parametres |
| `&dmhelp [commande|page]` | Aide complete |

## Variables disponibles

`{user}` `{username}` `{displayname}` `{server}` `{membercount}` `{date}` `{time}` `{datetime}` `{ownername}` `{guildid}` `{userid}` `{joindate}` `{random}`

## Installation

```bash
npm install
