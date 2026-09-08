const {
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('../../config');

const COOLDOWN_TIME      = 1000;
const MEMBER_COOLDOWN    = 100;
const REQUESTS_PER_SECOND = 1;
const { sleep, createLogger, createProgressBar, buildContainer, txt, sep, headerSection } = require('./Toolkit');

const logger = createLogger('BroadcastEngine');

class BroadcastEngine {
    constructor() {
        this.clients       = [];
        this.clientLoadMap = new Map();
        this.cooldownTime      = COOLDOWN_TIME;
        this.memberCooldown    = MEMBER_COOLDOWN;
        this.requestsPerSecond = REQUESTS_PER_SECOND;
    }

    async initialize(clients) {
        logger.info(`Initializing BroadcastEngine with ${clients.length} client(s)`);
        const valid = [];

        for (const client of clients) {
            if (!client?.user) { logger.warn('Skipping invalid client'); continue; }
            this.clientLoadMap.set(client.user.id, 0);
            try {
                if (config.server.guildId) await client.guilds.fetch(config.server.guildId);
                valid.push(client);
                logger.info(`Client validated: ${client.user.tag}`);
            } catch (e) {
                logger.warn(`${client.user.tag} guild access issue — keeping anyway`);
                valid.push(client);
            }
        }

        this.clients = valid;
        if (!this.clients.length) logger.error('No valid clients — broadcasting will fail!');
        else logger.info(`BroadcastEngine ready with ${this.clients.length} client(s)`);
        return this;
    }

    _incLoad(client) {
        this.clientLoadMap.set(client.user.id, (this.clientLoadMap.get(client.user.id) || 0) + 1);
    }
    _decLoad(client) {
        const n = this.clientLoadMap.get(client.user.id) || 0;
        if (n > 0) this.clientLoadMap.set(client.user.id, n - 1);
    }

    _distribute(members, count) {
        const chunks = Array.from({ length: count }, () => []);
        members.forEach((m, i) => chunks[i % count].push(m));
        logger.info(`Distributed ${members.length} members → [${chunks.map(c => c.length).join(', ')}]`);
        return chunks;
    }

    _buildPayload(message, msgType, embedTitle, embedColor, embedFooter, guild, embedLink = null) {
        if (msgType === 'embed') {
            const color = parseInt((embedColor || config.colors.main).replace('#', ''), 16);
            const embed = new EmbedBuilder()
                .setTitle(embedTitle || 'Announcement')
                .setDescription(message)
                .setColor(color)
                .setTimestamp();

            if (guild?.iconURL()) {
                embed.setThumbnail(guild.iconURL({ dynamic: true, size: 512 }));
            }

            if (embedFooter) {
                embed.setFooter({ text: embedFooter });
            }

            const payload = { embeds: [embed] };

            if (embedLink) {
                payload.components = [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Link')
                            .setURL(embedLink)
                            .setStyle(ButtonStyle.Link)
                    )
                ];
            }

            return payload;
        }
        return { content: message };
    }

    async startBroadcast({ interaction, members, message, msgType = 'normal', embedTitle = null, embedColor = null, embedFooter = null, embedLink = null }) {
        const totalMembers = members.size;
        const valid        = this.clients.filter(c => c?.user?.id);
        const clientCount  = valid.length;

        if (!clientCount) { logger.error('No clients available'); return null; }

        const results = {
            totalMembers,
            successCount:   0,
            failureCount:   0,
            failedMembers:  [],
            startTime:      Date.now(),
            lastUIUpdate:   Date.now(),
            processedCount: 0
        };

        const rps    = REQUESTS_PER_SECOND * clientCount;
        const etaMs  = ((COOLDOWN_TIME + MEMBER_COOLDOWN) / clientCount) * totalMembers;
        const etaMin = Math.floor(etaMs / 60000);
        const etaSec = Math.floor((etaMs % 60000) / 1000);
        const typeLabel = msgType === 'embed' ? `${config.emojis.emmsg} Embed` : `${config.emojis.msg} Normal`;

        await this._updateUI(interaction, buildContainer(config.colors.main,
            headerSection(interaction.guild, `**## ${config.emojis.dot} Processing Broadcast**`, `- Starting broadcast to **${totalMembers}** members. Please wait while the system delivers your message.`),
            sep(false),
            txt(`**${config.emojis.less} Progress:** ░░░░░░░░░░ 0%`),
            txt([
                `${config.emojis.dot} **Target:** ${totalMembers} members`,
                `${config.emojis.dot} **ETA:** ${etaMin}m ${etaSec}s`,
                `${config.emojis.dot} **Speed:** ~${rps}/sec`,
                `${config.emojis.dot} **Bots:** ${clientCount}`,
                `${config.emojis.dot} **Type:** ${typeLabel}`
            ].join('\n')),
            sep()
        ));

        const chunks = this._distribute([...members.values()], clientCount);

        await Promise.all(chunks.map((chunk, i) =>
            this._processChunk({ client: valid[i % clientCount], chunk, message, results, interaction, msgType, embedTitle, embedColor, embedFooter, embedLink })
        ));

        logger.info(`Broadcast done — ✅ ${results.successCount}  ❌ ${results.failureCount}`);
        return this._finalize({ interaction, results, message, msgType, embedFooter, embedLink });
    }

    async _processChunk({ client, chunk, message, results, interaction, msgType, embedTitle, embedColor, embedFooter, embedLink }) {
        if (!client?.user) {
            chunk.forEach(() => { results.failureCount++; results.processedCount++; });
            return;
        }

        logger.info(`${client.user.tag} → ${chunk.length} members`);

        for (const member of chunk) {
            try {
                this._incLoad(client);

                let user = client.users.cache.get(member.id)
                    ?? await client.users.fetch(member.id, { force: true }).catch(() => null)
                    ?? member.user;

                if (!user) throw Object.assign(new Error('Cannot fetch user'), { code: -1 });

                const guild   = member.guild;
                const payload = this._buildPayload(message, msgType, embedTitle, embedColor, embedFooter, guild, embedLink);
                await user.send(payload);
                results.successCount++;
            } catch (e) {
                results.failureCount++;
                results.failedMembers.push(member.id);
                const reason = { 50007: 'DMs closed', 50013: 'No permission', 10003: 'Unknown user' }[e.code]
                    || e.message?.slice(0, 80);
                logger.error(`${client.user.tag} ✗ ${member.user?.tag ?? member.id}: ${reason}`);
            } finally {
                this._decLoad(client);
                results.processedCount++;

                const pct = Math.floor(results.processedCount / results.totalMembers * 100);
                const now = Date.now();
                if (pct % 5 === 0 || now - results.lastUIUpdate > 3000 || results.processedCount === 1) {
                    results.lastUIUpdate = now;
                    await this._progressUI(interaction, results, pct);
                }

                await sleep(COOLDOWN_TIME / this.clients.length);
            }
        }
    }

    async _progressUI(interaction, results, pct) {
        const elapsed   = Date.now() - results.startTime;
        const processed = results.processedCount;
        const remaining = results.totalMembers - processed;
        const avgMs     = processed > 0 ? elapsed / processed : 0;
        const etaMs     = avgMs * remaining;
        const etaMin    = Math.floor(etaMs / 60000);
        const etaSec    = Math.floor((etaMs % 60000) / 1000);
        const curSpeed  = processed > 0 ? Math.round(processed / (elapsed / 1000)) : 0;
        const bar       = createProgressBar(pct);

        await this._updateUI(interaction, buildContainer(config.colors.main,
            headerSection(interaction.guild, `**## ${config.emojis.dot} Processing Broadcast**`, `- Broadcast is currently in progress. Real-time stats are updated automatically.`),
            sep(false),
            txt(`**${config.emojis.less} ${bar} ${pct}%**`),
            txt([
                `${config.emojis.dot} **Progress:** ${processed} / ${results.totalMembers}`,
                `${config.emojis.dot} **Success:** ${results.successCount}   ${config.emojis.dot} **Failed:** ${results.failureCount}`,
                `${config.emojis.dot} **Time Left:** ${etaMin}m ${etaSec}s`,
                `${config.emojis.dot} **Elapsed:** ${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`,
                `${config.emojis.dot} **Speed:** ~${curSpeed}/sec`,
                `${config.emojis.dot} **Bots:** ${this.clients.length}`
            ].join('\n')),
            sep()
        ));
    }

    async _finalize({ interaction, results, message, msgType = 'normal', embedFooter = null, embedLink = null }) {
        const elapsed   = Date.now() - results.startTime;
        const avgSpeed  = Math.round(results.totalMembers / (elapsed / 1000));
        const pct       = Math.floor(results.successCount / results.totalMembers * 100);
        const bar       = createProgressBar(pct);
        const typeLabel = msgType === 'embed' ? `${config.emojis.emmsg} Embed` : `${config.emojis.msg} Normal`;
        const footerLabel = embedFooter ? `Footer: ${embedFooter}` : '';
        const guild     = interaction.guild;

        if (config.server.reportChannelId) {
            try {
                const ch = await this.clients[0].channels.fetch(config.server.reportChannelId);
                if (ch) await ch.send({
                    components: [this._reportContainer(results, message, msgType, embedFooter, embedLink, guild)],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (e) { logger.error(`Report channel failed: ${e.message}`); }
        }

        await this._updateUI(interaction, buildContainer(config.colors.success,
            headerSection(guild, '**## <:wdot:1524131703482876004> Broadcast Completed**', '- Your broadcast has finished successfully. A detailed report has been sent to the report channel.'),
            sep(false),
            txt([
                `**<:less:1524194424303783976> ${bar} ${pct}%**`,
                `${config.emojis.dot} **Total:** ${results.totalMembers}`,
                `${config.emojis.dot} **Success:** ${results.successCount}`,
                `${config.emojis.dot} **Failed:** ${results.failureCount}`,
                `${config.emojis.dot} **Total Time:** ${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`,
                `${config.emojis.dot} **Avg Speed:** ~${avgSpeed}/sec`,
                `${config.emojis.dot} **Type:** ${typeLabel}`
            ].join('\n')),
            sep()
        ));

        return results;
    }

    _reportContainer(results, message, msgType = 'normal', embedFooter = null, embedLink = null, guild = null) {
        const preview   = message.length > 200 ? message.slice(0, 200) + '…' : message;
        const pct       = Math.floor(results.successCount / results.totalMembers * 100);
        const typeLabel = msgType === 'embed' ? `${config.emojis.emmsg} Embed` : `${config.emojis.msg} Normal`;

        const container = buildContainer(config.colors.warning,
            headerSection(guild, `## ${config.emojis.dot} Broadcast Report`),
            sep(false),
            txt(`**${config.emojis.right} Message:**\n\`\`\`${preview}\`\`\``),
            txt([
                `${config.emojis.dot} **Total:** ${results.totalMembers}`,
                `${config.emojis.dot} **Success:** ${results.successCount}`,
                `${config.emojis.dot} **Failed:** ${results.failureCount}`,
                `${config.emojis.dot} **Rate:** ${pct}%`,
                `${config.emojis.dot} **Type:** ${typeLabel}`
            ].join('\n'))
        );

        if (embedFooter) {
            container.addSeparatorComponents(sep());
            container.addTextDisplayComponents(txt(`**Footer:** ${embedFooter}`));
        }

        if (embedLink) {
            container.addSeparatorComponents(sep());
            container.addTextDisplayComponents(txt(`**Link Button:** ${embedLink}`));
        }

        if (results.failedMembers.length) {
            const PER_CHUNK  = 30;
            const MAX_CHUNKS = 5;
            const names      = results.failedMembers.map(id => {
                const u = this.clients[0].users.cache.get(id);
                return u ? u.tag : `<@${id}>`;
            });

            const chunks = [];
            for (let i = 0; i < names.length; i += PER_CHUNK)
                chunks.push(names.slice(i, i + PER_CHUNK));

            const displayChunks = chunks.slice(0, MAX_CHUNKS);
            const leftover      = names.length - displayChunks.flat().length;

            container.addSeparatorComponents(sep());
            displayChunks.forEach((ch, idx) =>
                container.addTextDisplayComponents(
                    txt(`**Failed Members${idx > 0 ? ` (cont. ${idx + 1})` : ''}:**\n${ch.join(', ')}`)
                )
            );
            if (leftover > 0)
                container.addTextDisplayComponents(txt(`*...and ${leftover} more. Check console logs.*`));
        }

        return container;
    }

    async _updateUI(interaction, container) {
        try {
            await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (e) { logger.error('UI update failed:', e); }
    }
}

module.exports = new BroadcastEngine();
