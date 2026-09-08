const { Client, GatewayIntentBits, Partials, REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
config.bot.tokens = config.bot.tokens.filter(t => t && !t.startsWith('TOKEN_'));
const { createLogger } = require('./src/core/Toolkit');
const router = require('./src/core/CommandRouter');
const logger  = createLogger('Main');
const PREFIX  = config.prefix;
const clients = [];
const ACTIVITY_TYPES = { PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, COMPETING: 5 };
const slashCommands = new Collection();
const prefixCommands = new Collection();

const loadCommands = (dir, collection) => {
    const cmdPath = path.join(__dirname, 'src', 'commands', dir);
    if (!fs.existsSync(cmdPath)) return;
    const files = fs.readdirSync(cmdPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
        const cmd = require(path.join(cmdPath, file));
        if (cmd.name) collection.set(cmd.name, cmd);
        logger.info(`Loaded ${dir} command: ${cmd.name}`);
    }
};

loadCommands('slash', slashCommands);
loadCommands('prefix', prefixCommands);

const registerSlash = async (client) => {
    const body = [];
    for (const [, cmd] of slashCommands) {
        if (cmd.data) body.push(cmd.data);
    }
    if (!body.length) return;
    try {
        const rest = new REST({ version: '10' }).setToken(config.bot.tokens[0]);
        await rest.put(Routes.applicationGuildCommands(client.user.id, config.server.guildId), { body });
        logger.info(`✅ Registered ${body.length} slash command(s)`);
    } catch (e) {
        logger.error(`Slash registration failed: ${e.message}`);
    }
};

const initClients = async () => {
    logger.info('Initializing clients...');
    if (!config.bot.tokens?.length) {
        logger.error('No tokens in config.json');
        process.exit(1);
    }

    for (const token of config.bot.tokens) {
        if (!token) { logger.warn('Empty token skipped'); continue; }
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Channel]
        });
        attachListeners(client);
        try {
            await client.login(token);
            clients.push(client);
            logger.info(`Logged in: ${client.user.tag}  (${clients.length}/${config.bot.tokens.filter(Boolean).length})`);
        } catch (e) {
            logger.error(`Login failed for ${token.slice(0, 8)}...: ${e.message}`);
        }
    }

    if (!clients.length) { logger.error('No clients logged in.'); process.exit(1); }

    const engine = require('./src/core/BroadcastEngine');
    await engine.initialize(clients);
    await registerSlash(clients[0]);
    logger.info(`${clients.length} client(s) ready`);
};

const hasBcPermission = async (guild, member, userId) => {
    if (!guild || guild.id !== config.server.guildId) return false;
    let targetMember = member;
    if (!targetMember && guild && userId) {
        targetMember = await guild.members.fetch(userId).catch(() => null);
    }
    if (!targetMember) return false;

    if (targetMember.roles?.cache) {
        return targetMember.roles.cache.has(config.server.bcRoleId);
    }
    if (Array.isArray(targetMember.roles)) {
        return targetMember.roles.includes(config.server.bcRoleId);
    }
    return false;
};

const attachListeners = (client) => {
    client.once('ready', () => {
        logger.info(`Ready: ${client.user.tag}`);
        client.user.setPresence({
            activities: [{
                name: config.bot.activity.name,
                type: ACTIVITY_TYPES[config.bot.activity.type] ?? 0,
                url:  config.bot.activity.url
            }],
            status: config.bot.activity.status
        });
    });

    client.on('error', (e) => logger.error(`[${client.user?.tag}] error:`, e));
    client.on('warn',  (w) => logger.warn(`[${client.user?.tag}] warn: ${w}`));

    client.on('messageCreate', async (msg) => {
        if (clients[0] && client !== clients[0]) return;
        if (msg.author.bot) return;
        if (!msg.content.startsWith(PREFIX)) return;

        const authorized = await hasBcPermission(msg.guild, msg.member, msg.author?.id);
        if (!authorized) return;

        const args    = msg.content.slice(PREFIX.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();
        const cmd = prefixCommands.get(command);
        if (cmd) {
            try { await cmd.run(msg, args); }
            catch (e) { logger.error(`Prefix command ${command} failed: ${e.message}`); }
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (clients[0] && client !== clients[0]) return;

        const authorized = await hasBcPermission(interaction.guild, interaction.member, interaction.user?.id);
        if (!authorized) return;

        if (interaction.isChatInputCommand()) {
            const cmd = slashCommands.get(interaction.commandName);
            if (cmd) {
                try { await cmd.run(interaction); }
                catch (e) { logger.error(`Slash command ${interaction.commandName} failed: ${e.message}`); }
            }
            return;
        }

        if (interaction.isButton())           await router.handleButton(interaction);
        if (interaction.isStringSelectMenu()) await router.handleSelect(interaction);
        if (interaction.isModalSubmit())      await router.handleModal(interaction);
    });
};

process.on('uncaughtException',  (e) => logger.error('UncaughtException:', e));
process.on('unhandledRejection', (r) => logger.error('UnhandledRejection:', r));

(async () => {
    logger.info('Starting NovaCodes™ Broadcast v3.0...');
    try {
        await initClients();
        const engine = require('./src/core/BroadcastEngine');

        const bots  = clients.length;
        const speed = engine.requestsPerSecond * bots;

        console.log(`
┌─[ NovaCodes™ // BROADCAST CORE ]────────────────────────────────────────────┐
│                                                                             │
│   ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗  ██████╗ ██████╗ ██████╗ ███████╗™    │
│   ████╗  ██║██╔═══██╗██║   ██║██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝      │
│   ██╔██╗ ██║██║   ██║██║   ██║███████║██║     ██║  ██║██║  ██║█████╗        │
│   ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║██║     ██║  ██║██║  ██║██╔══╝        │
│   ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║╚██████╗██████╔╝██████╔╝███████╗      │
│   ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝ ╚═════╝╚═════╝ ╚═════╝ ╚══════╝      │
│                                                                             │
│                   STATUS       : ONLINE                                     │
│                   SYSTEM       : BROADCAST v3.0                             │
│          ────────────────────────────────────────────────────────           │
│                   🤖 BOTS     : ${String(bots).padEnd(35)}         │
│                   ⚡ SPEED    : ~${String(speed).padEnd(34)}         │   
│                   📨 PREFIX   : ${PREFIX}cp │ ${PREFIX}help │ ${PREFIX}join │ ${PREFIX}left                 │
│                   🔷 SLASH    : /cp │ /help │ /join │ /left                 │
│                   💻 ENGINE   : discord.js v14                              │   
│                                                                             │
│                   [ NovaCodes™ ] :: BROADCAST CORE ACTIVE                   │   
└─────────────────────────────────────────────────────────────────────────────┘
        `);
    } catch (e) {
        logger.error('Boot failed:', e);
        process.exit(1);
    }
})();
