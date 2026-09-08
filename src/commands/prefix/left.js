const { MessageFlags } = require('discord.js');
const config = require('../../../config');
const { buildContainer, txt, sep, headerSection, createLogger } = require('../../core/Toolkit');

const logger = createLogger('LeftCommand');

module.exports = {
    name: 'left',

    async run(message) {
        const engine = require('../../core/BroadcastEngine');

        if (!message.member?.roles?.cache?.has(config.server.bcRoleId)) return;

        const clients = engine.clients;
        const guildId = message.guild.id;

        const results = [];

        for (const client of clients) {
            try {
                const guild = client.guilds.cache.get(guildId)
                    ?? await client.guilds.fetch(guildId).catch(() => null);

                if (!guild) {
                    results.push({ tag: client.user.tag, status: '⚠️ Not in server' });
                    continue;
                }

                await guild.leave();
                results.push({ tag: client.user.tag, status: '✅ Left' });
                logger.info(`${client.user.tag} left guild ${guildId}`);
            } catch (e) {
                results.push({ tag: client.user.tag, status: `❌ Failed: ${e.message.slice(0, 50)}` });
                logger.error(`${client.user.tag} failed to leave: ${e.message}`);
            }
        }

        const lines = results.map(r => `${config.emojis.dot} **${r.tag}** — ${r.status}`).join('\n');

        return message.reply({
            components: [buildContainer(config.colors.error,
                headerSection(message.guild,
                    `**## ${config.emojis.dot} Bots Left Server**`,
                    `- All bots have been instructed to leave the server.`
                ),
                sep(false),
                txt(`**${config.emojis.right} Results:**\n${lines}`),
                sep()
            )],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
