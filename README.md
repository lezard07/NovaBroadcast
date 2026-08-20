# NovaBroadcast v3.0

Advanced multi-client Discord broadcast system built with discord.js v14.  
Send DM broadcasts to your server members — fast, clean, and fully button-driven.

---

## Features

- **Multi-client support** — run multiple bots in parallel for maximum speed
- **Normal & Embed** message types — pick your style before sending
- **Target filtering** — broadcast to All / Online / Offline members
- **Live progress UI** — real-time updates with ETA, speed, and success rate
- **Auto report** — detailed report sent to a dedicated channel after each broadcast
- **Server thumbnail** — embed broadcasts automatically include your server icon
- **Fully button-driven** — no slash command arguments, everything runs through panels

---

## Getting Started

### Requirements

- Node.js v18+
- One or more Discord bot tokens
- A Discord server where the bots are members

### Installation

```bash
git clone https://github.com/youruser/novabroadcast.git
cd novabroadcast
npm install
```

### Configuration

Edit `config.json` before starting:

```json
{
    "bot": {
        "tokens": [
          "",
          "",
          "",
          "",
          ""
        ],
    "activity": {
        "name": "Powered By NovaCodes™",
        "type": "STREAMING",
        "url": "https://www.twitch.tv/nochannel",
        "status": "idle"
        }
    },
    "server": {
        "guildId": "1373311613465268284",
        "bcRoleId": "1378835197633626264",
        "reportChannelId": "1385068365504053310"
    },
    "colors": {
        "main": "#FFFFFF",
        "success": "#57F287",
        "warning": "#FEE75C",
        "error": "#ED4245",
        "canceled": "#5D5D5D"
    },
    "emojis": {
        "dot": "<:wdot:1524131703482876004>",
        "bot": "<:bot:1538926828201451530>",
        "time": "<:time:1538927187636264990>",
        "speed": "<a:fast:1524191150486065250>",
        "right": "<:right:1524196722056626217>",
        "less": "<:less:1524194424303783976>",
        "cancel": "<:can:1524196158958997514>",
        "msg": "<:msg:1538676123968213083>",
        "emmsg": "<:emmsg:1538676168679489619>",
        "members": "<:members:1524191804151431378>",
        "online": "<a:true_:1538681829509300274>",
        "offline": "<a:False:1538681929056911491>",
        "done": "<:done:1524196922963918858>",
        "broadcast": "<:ann:1538640733404143826>",
        "search": "<:search:1538640773690560635>"
},
    "prefix": "+"
}
```

| Field | Description |
|-------|-------------|
| `tokens` | Bot tokens — add up to 5 for faster broadcasts |
| `guildId` | Your server ID |
| `broadcastRoleId` | Only members with this role can use the broadcast |
| `reportChannelId` | Channel where the post-broadcast report is sent |
| `emojis` | Your emojis ID |

### Running

```bash
npm start
```

---

## Usage

### `/cp` or `+cp`
Opens the main control panel with all commands as buttons.

### `/help` or `+help`
Shows available commands and system info.

### How to broadcast

1. Use `/cp` or `+cp` to open the control panel
2. Click **Broadcast**
3. Type your message in the modal
4. Choose message type: **Normal** or **Embed**
5. Select your target: **All Members**, **Online**, or **Offline**
6. Confirm — the broadcast starts immediately

---

## Project Structure

```
novabroadcast/
├── src/
│   ├── commands/
│   │   ├── prefix/       # +cp, +help
│   │   └── slash/        # /cp, /help
│   └── core/
│       ├── BroadcastEngine.js   # DM sending logic
│       ├── CommandRouter.js     # Button/modal handler
│       └── Toolkit.js           # Shared utilities
├── config.json
├── package.json
└── index.js
```

---

## Support

Join our Discord server for help, updates, and more:  
**[discord.gg/XrEGeZQFDP](https://discord.gg/XrEGeZQFDP)**
