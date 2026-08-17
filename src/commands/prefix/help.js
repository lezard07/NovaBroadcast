const { MessageFlags, SectionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ThumbnailBuilder } = require('discord.js');
const config = require('../../../config');
const engine = require('../../core/BroadcastEngine');
const { buildContainer, txt, sep } = require('../../core/Toolkit');

module.exports = {
    name: 'help',
    async run(message) {
        const bots = engine.clients.length;
        const speed = engine.requestsPerSecond * bots;
        const guild = message.guild;
        const p = config.prefix;
        const e = config.emojis;

        const header = new SectionBuilder()
            .addTextDisplayComponents(
                txt(`**## ${e.dot} Help**`),
                txt('- Welcome to the help panel. Here you will find everything you need to know about using the Broadcast system, including available commands, system capabilities, and how to get started with your first broadcast campaign.')
            );
        if (guild?.iconURL()) {
            header.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(guild.iconURL({ dynamic: true, size: 512 }))
            );
        }

        const container = buildContainer(config.colors.main,
            header,
            txt(`**${e.less} Control Panel**\n- Use \`${p}cp\` or \`/cp\` to open the main control panel. From there you can launch broadcasts and check system status with a single button click.\n**${e.right} Broadcast**\n- Send direct message broadcasts to your entire server or filter by member status (all, online, or offline). Choose between normal text messages or rich embeds with custom titles and colors.\n**${e.right} Status**\n- View real-time statistics including total member count, active bot clients, estimated broadcast completion time, and current processing speed.\n**${e.less} System Info**\n- ${bots} active bots | ~${speed} members/sec | Engine: discord.js v14.`),
            sep()
        );

        await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};