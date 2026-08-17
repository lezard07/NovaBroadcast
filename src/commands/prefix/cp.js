const { MessageFlags, SectionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ThumbnailBuilder } = require('discord.js');
const config = require('../../../config');
const { buildContainer, txt, sep } = require('../../core/Toolkit');

module.exports = {
    name: 'cp',
    async run(message) {
        const guild = message.guild;
        const e = config.emojis;

        const header = new SectionBuilder()
            .addTextDisplayComponents(
                txt(`**## ${e.dot} Control Panel**`),
                txt('- Welcome to the broadcast control panel. Use the buttons below to send DM broadcasts to your server members or check system status.')
        );
        if (guild?.iconURL()) {
            header.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(guild.iconURL({ dynamic: true, size: 512 }))
            );
        }

        const container = buildContainer(config.colors.main,
            header,
            txt(`**${e.right} Broadcast**\n- Launch a direct message broadcast campaign to your entire server or a targeted subset of members. You can send to __all members__ at once, or filter by status: __online (including idle and dnd)__, or __offline members only__. Choose between __normal text messages__ or __rich embeds__ with custom titles and colors. The system automatically distributes the workload across all active bot clients for maximum speed and reliability.`),
            sep(false),
            txt(`**${e.right} Status**\n- View real-time system statistics including __total member count__, __active bot clients__, __estimated broadcast completion time__, and __current processing speed__. This helps you plan large-scale broadcasts efficiently before launching them.`),
            sep(),

            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('cp_bc')
                    .setEmoji(e.broadcast)
                    .setLabel('Broadcast')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('cp_NovaCodes')
                    .setEmoji(e.search)
                    .setLabel('Status')
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};