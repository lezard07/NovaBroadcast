const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../../config');
const { buildContainer, txt, sep, headerSection } = require('../../core/Toolkit');
const { createLogger } = require('../../core/Toolkit');

const logger = createLogger('AddCommand');

const ADMIN_PERMISSIONS = '8';

module.exports = {
    name: 'add',

    async run(message) {
        const engine = require('../../core/BroadcastEngine');

        if (!message.member.roles.cache.has(config.server.bcRoleId)) {
            return message.reply({ content: '❌ You do not have the required role.' });
        }

        const clients = engine.clients;

        if (!clients || clients.length < 2) {
            return message.reply({
                components: [buildContainer(config.colors.warning,
                    headerSection(message.guild, `**## ${config.emojis.dot} No Secondary Bots**`,
                        '- There are no secondary bots loaded. Make sure you have added more tokens to `config.json`.')
                )],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const secondaryClients = clients.slice(1);

        const lines = secondaryClients.map((client, i) => {
            const link = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=${ADMIN_PERMISSIONS}`;
            return `${config.emojis.dot} **Bot ${i + 2}:** [${client.user.tag}](${link})`;
        });

        const buttons = secondaryClients.map((client, i) => {
            const link = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=${ADMIN_PERMISSIONS}`;
            return new ButtonBuilder()
                .setLabel(`Add Bot ${i + 2}`)
                .setURL(link)
                .setStyle(ButtonStyle.Link);
        });

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
        }

        const container = buildContainer(config.colors.main,
            headerSection(message.guild,
                `**## ${config.emojis.dot} Bot Invite Links**`,
                `- Click the buttons below to add the secondary bots to your server with **Administrator** permission. Make sure to add them to the correct server.`
            ),
            sep(false),
            txt(`**${config.emojis.right} Secondary Bots (${secondaryClients.length}):**\n${lines.join('\n')}`),
            sep(),
            ...rows
        );

        logger.info(`+add used by ${message.author.tag} — ${secondaryClients.length} bot(s) listed`);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
