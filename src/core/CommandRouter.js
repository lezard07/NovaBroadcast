const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    SectionBuilder,
    ThumbnailBuilder
} = require('discord.js');

const config = require('../../config');
const engine = require('./BroadcastEngine');
const { createLogger, buildContainer, txt, sep, headerSection } = require('./Toolkit');

const logger = createLogger('CommandRouter');
const MAX_BC_LEN = 2000;
const MAX_PREV_LEN = 200;
const SESSION_TTL = 10 * 60 * 1000;

class CommandRouter {
    constructor() {
        this.broadcasts = new Map();
        this.sessions = new Map();
        this._timers = new Map();
        setInterval(() => logger.debug(`Active sessions: ${this.broadcasts.size}`), 5 * 60 * 1000);
    }

    setBroadcastSession(userId, text, data = {}) {
        this.broadcasts.set(userId, text);
        this.sessions.set(userId, data);
        clearTimeout(this._timers.get(userId));
        this._timers.set(userId, setTimeout(() => {
            this.broadcasts.delete(userId);
            this.sessions.delete(userId);
            this._timers.delete(userId);
            logger.debug(`Session auto-expired: ${userId}`);
        }, SESSION_TTL));
    }

    clearBroadcastSession(userId) {
        this.broadcasts.delete(userId);
        this.sessions.delete(userId);
        clearTimeout(this._timers.get(userId));
        this._timers.delete(userId);
    }

    getBroadcastText(userId) {
        return this.broadcasts.get(userId);
    }

    getSession(userId) {
        return this.sessions.get(userId);
    }

    buildTypePicker(text, guild) {
        const preview = text.length > MAX_PREV_LEN ? text.slice(0, MAX_PREV_LEN) + '…' : text;
        return buildContainer(config.colors.main,
            headerSection(guild, `**## ${config.emojis.dot} Choose Message Type**`, '- Choose how you want to deliver your broadcast message. You can send it as a simple normal text message that appears clean and direct in the member\'s DMs, or as a rich embed with a custom title, accent color, and formatted layout for a more professional and eye-catching appearance.'),
            sep(false),
            txt(`**${config.emojis.right} Message Preview**\n\`\`\`${preview}\`\`\``),
            sep(),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bc_type_normal').setEmoji(config.emojis.msg).setLabel('Normal').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('bc_type_embed').setEmoji(config.emojis.emmsg).setLabel('Embed').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('bc_cancel').setEmoji(config.emojis.cancel).setLabel('Cancel').setStyle(ButtonStyle.Danger)
            )
        );
    }

    buildBcPanel(text, msgType = 'normal', guild) {
        const preview = text.length > MAX_PREV_LEN ? text.slice(0, MAX_PREV_LEN) + '…' : text;
        const typeLabel = msgType === 'embed' ? `${config.emojis.emmsg} Embed` : `${config.emojis.msg} Normal`;
        return buildContainer(config.colors.main,
            headerSection(guild, `**## ${config.emojis.dot} Broadcast Control**`, '- Choose which members will receive your broadcast. You can target __all members__ in the server, only those currently __online (including idle and do-not-disturb)__, or only __offline members__. Review your message preview and broadcast settings below before proceeding to confirmation.'),
            sep(false),
            txt(`**${config.emojis.right} Message Preview**\n\`\`\`${preview}\`\`\``),
            txt(`**${config.emojis.less} Info:** ${text.length} / ${MAX_BC_LEN} chars · Type: **${typeLabel}**`),
            sep(),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('target_all').setEmoji(config.emojis.members).setLabel('All Members').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('target_online').setEmoji(config.emojis.online).setLabel('Online').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('target_offline').setEmoji(config.emojis.offline).setLabel('Offline').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('bc_cancel').setEmoji(config.emojis.cancel).setLabel('Cancel').setStyle(ButtonStyle.Danger)
            )
        );
    }

    buildConfirmPanel(text, targetLabel, count, msgType = 'normal', guild) {
        const preview = text.length > MAX_PREV_LEN ? text.slice(0, MAX_PREV_LEN) + '…' : text;
        const typeLabel = msgType === 'embed' ? `${config.emojis.emmsg} Embed` : `${config.emojis.msg} Normal`;
        return buildContainer(config.colors.main,
            headerSection(guild, `**## ${config.emojis.dot} Broadcast Control**`, '- Double-check everything before launching. Review your message preview, confirm the target audience and member count, and verify the message type. Once you click Confirm, the broadcast will begin immediately and cannot be stopped. Make sure all details are correct before proceeding.'),
            sep(false),
            txt(`**${config.emojis.right} Message Preview**\n\`\`\`${preview}\`\`\``),
            txt(`**${config.emojis.right} Target:** ${targetLabel} — **${count}** members · Type: **${typeLabel}**`),
            sep(),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bc_confirm').setEmoji(config.emojis.done).setLabel('Confirm').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('bc_cancel').setEmoji(config.emojis.cancel).setLabel('Cancel').setStyle(ButtonStyle.Danger)
            )
        );
    }

    async handleButton(interaction) {
        try {
            const id     = interaction.customId;
            const userId = interaction.user.id;

            if (id === 'cp_bc') {
                if (!interaction.member.roles.cache.has(config.server.bcRoleId))
                    return interaction.reply({ content: '❌ You do not have the required role.', flags: MessageFlags.Ephemeral });

                return interaction.showModal(
                    new ModalBuilder()
                        .setCustomId('modal_bc')
                        .setTitle('Broadcast Message')
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('bc_text')
                                    .setLabel('Your message')
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setPlaceholder('Type your broadcast message here...')
                                    .setMaxLength(MAX_BC_LEN)
                                    .setRequired(true)
                            )
                        )
                );
            }

            if (id === 'cp_NovaCodes') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                if (interaction.guild?.id !== config.server.guildId)
                    return interaction.editReply({ content: '❌ This command is not available here.' });

                await interaction.guild.members.fetch();
                const members = interaction.guild.members.cache.filter(m => !m.user.bot);
                const bots    = engine.clients.length;
                const speed   = engine.requestsPerSecond * bots;
                const eta     = Math.ceil(members.size / speed);

                 return interaction.editReply({
                    components: [buildContainer(config.colors.main,
                        headerSection(interaction.guild, `**## ${config.emojis.dot} System Status**`, `${config.emojis.members} **Members Found:** ${members.size}\n${config.emojis.bot} **Active Bots:** ${bots}\n${config.emojis.speed} **Broadcast Speed:** ~${speed} members/sec\n${config.emojis.time} **Estimated Time:** ~${eta} seconds`),
                        sep()
                    )],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            if (id === 'bc_cancel') {
                this.clearBroadcastSession(userId);
                return interaction.update({
                    components: [buildContainer(config.colors.canceled,
                        headerSection(interaction.guild, `**## ${config.emojis.dot} Broadcast Canceled**`, '- The broadcast has been canceled successfully. Your session has been cleared and no messages were sent. You can start a new broadcast at any time by returning to the control panel and clicking the Broadcast button again.')
                    )],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const broadcastText = this.getBroadcastText(userId);
            if (!broadcastText)
                return interaction.reply({ content: '❌ Session expired. Please start over.', flags: MessageFlags.Ephemeral });

            if (id === 'bc_type_normal') {
                const prev = this.getSession(userId) || {};
                this.setBroadcastSession(userId, broadcastText, { ...prev, msgType: 'normal' });
                return interaction.update({
                    components: [this.buildBcPanel(broadcastText, 'normal', interaction.guild)],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            if (id === 'bc_type_embed') {
                return interaction.showModal(
                    new ModalBuilder()
                        .setCustomId('modal_embed_opts')
                        .setTitle('Embed Options')
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('embed_title')
                                    .setLabel('Embed Title')
                                    .setStyle(TextInputStyle.Short)
                                    .setPlaceholder('e.g. Announcement')
                                    .setMaxLength(256)
                                    .setRequired(true)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('embed_footer')
                                    .setLabel('Footer Text (optional)')
                                    .setStyle(TextInputStyle.Short)
                                    .setPlaceholder('e.g. NovaCodes™ Broadcast • 2026')
                                    .setMaxLength(256)
                                    .setRequired(false)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('embed_link')
                                    .setLabel('Button Link (optional)')
                                    .setStyle(TextInputStyle.Short)
                                    .setPlaceholder('e.g. https://discord.gg/z77Akyq2EE')
                                    .setMaxLength(512)
                                    .setRequired(false)
                            )
                        )
                );
            }

            if (id.startsWith('target_')) {
                await this._handleTargetSelect(interaction, id.replace('target_', ''), broadcastText);
                return;
            }

            if (id === 'bc_confirm') {
                await this._handleConfirm(interaction);
                return;
            }

        } catch (e) {
            logger.error(`handleButton: ${e.message}`, e);
            if (!interaction.replied && !interaction.deferred)
                interaction.reply({ content: '❌ An error occurred. Please try again.', flags: MessageFlags.Ephemeral });
        }
    }

    async handleModal(interaction) {
        try {
            if (interaction.customId === 'modal_bc') {
                const text   = interaction.fields.getTextInputValue('bc_text').trim();
                const userId = interaction.user.id;

                if (!text)
                    return interaction.reply({ content: '❌ Message cannot be empty.', flags: MessageFlags.Ephemeral });
                if (text.length > MAX_BC_LEN)
                    return interaction.reply({ content: `❌ Message too long! Max is **${MAX_BC_LEN}** chars. Yours is **${text.length}**.`, flags: MessageFlags.Ephemeral });

                this.setBroadcastSession(userId, text, { guildId: interaction.guild?.id });

                await interaction.reply({ components: [this.buildTypePicker(text, interaction.guild)], flags: MessageFlags.IsComponentsV2 });
                logger.info(`Modal bc by ${interaction.user.tag}`);
                return;
            }

            if (interaction.customId === 'modal_embed_opts') {
                const userId      = interaction.user.id;
                const embedTitle  = interaction.fields.getTextInputValue('embed_title').trim();
                const embedFooter = interaction.fields.getTextInputValue('embed_footer').trim() || null;
                const embedLink   = interaction.fields.getTextInputValue('embed_link').trim() || null;
                const embedColor  = config.colors.main;

                if (embedLink && !/^https?:\/\/.+/.test(embedLink)) {
                    return interaction.reply({ content: '❌ Invalid link. Must start with `https://` or `http://`.', flags: MessageFlags.Ephemeral });
                }

                const broadcastText = this.getBroadcastText(userId);
                if (!broadcastText)
                    return interaction.reply({ content: '❌ Session expired. Please start over.', flags: MessageFlags.Ephemeral });

                const prev = this.getSession(userId) || {};
                this.setBroadcastSession(userId, broadcastText, {
                    ...prev,
                    msgType:    'embed',
                    embedTitle,
                    embedColor,
                    embedFooter,
                    embedLink
                });

                await interaction.deferUpdate();
                await interaction.message.edit({
                    components: [this.buildBcPanel(broadcastText, 'embed', interaction.guild)],
                    flags: MessageFlags.IsComponentsV2
                });
                logger.info(`Embed opts set by ${interaction.user.tag}: "${embedTitle}" footer="${embedFooter}" link="${embedLink}"`);
                return;
            }

        } catch (e) { logger.error(`handleModal: ${e.message}`, e); }
    }

    async handleSelect(interaction) {
        logger.debug(`Select menu: ${interaction.customId}`);
    }

    async _handleTargetSelect(interaction, target, broadcastText) {
        await interaction.guild.members.fetch({ withPresences: true });
        const all = interaction.guild.members.cache.filter(m => !m.user.bot);

        let targetMembers, targetLabel;
        switch (target) {
            case 'all':
                targetMembers = all;
                targetLabel   = `${config.emojis.members} All Members`;
                break;
            case 'online':
                targetMembers = all.filter(m => m.presence && ['online', 'idle', 'dnd'].includes(m.presence.status));
                targetLabel   = `${config.emojis.online} Online Members`;
                break;
            case 'offline':
                targetMembers = all.filter(m => !m.presence || m.presence.status === 'offline');
                targetLabel   = `${config.emojis.offline} Offline Members`;
                break;
            default: return;
        }

        const prev    = this.getSession(interaction.user.id) || {};
        const msgType = prev.msgType || 'normal';
        this.setBroadcastSession(interaction.user.id, broadcastText, { ...prev, targetMembers });

        await interaction.update({
            components: [this.buildConfirmPanel(broadcastText, targetLabel, targetMembers.size, msgType, interaction.guild)],
            flags: MessageFlags.IsComponentsV2
        });
        logger.info(`Target: ${targetLabel} (${targetMembers.size}) by ${interaction.user.tag}`);
    }

    async _handleConfirm(interaction) {
        const userId  = interaction.user.id;
        const text    = this.getBroadcastText(userId);
        const session = this.getSession(userId);

        if (!text || !session?.targetMembers) {
            return interaction.update({
                components: [buildContainer(config.colors.error,
                    headerSection(interaction.guild, `**## ${config.emojis.dot} Session Expired**`, '- Your session has expired. Please start over from the control panel.')
                )],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await interaction.update({
            components: [buildContainer(config.colors.warning,
                headerSection(interaction.guild, `**## ${config.emojis.dot} Processing Broadcast**`, `- Starting broadcast to **${session.targetMembers.size}** members...`)
            )],
            flags: MessageFlags.IsComponentsV2
        });

        const savedText    = text;
        const savedMembers = session.targetMembers;
        const savedType    = session.msgType     || 'normal';
        const embedTitle   = session.embedTitle  || null;
        const embedColor   = session.embedColor  || config.colors.main;
        const embedFooter  = session.embedFooter || null;
        const embedLink    = session.embedLink   || null;
        this.clearBroadcastSession(userId);

        await engine.startBroadcast({
            interaction,
            members: savedMembers,
            message: savedText,
            msgType: savedType,
            embedTitle,
            embedColor,
            embedFooter,
            embedLink
        });
    }
}

module.exports = new CommandRouter();
