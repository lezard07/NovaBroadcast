const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,

    async execute(client, config, logger) {

        logger.info(`Ready: ${client.user.tag}`);

        const updatePresence = () => {
            if (!client.user) return;

            client.user.setPresence({
                status: config.bot.activity.status || 'online',

                activities: [
                    {
                        name: config.bot.activity.name || 'NovaCodes™',
                        type: ActivityType.Streaming,
                        url:
                            config.bot.activity.url ||
                            'https://www.twitch.tv/novacodes'
                    }
                ]
            });
        };

        updatePresence();

        if (client.presenceInterval) {
            clearInterval(client.presenceInterval);
        }

        client.presenceInterval = setInterval(() => {
            try {
                updatePresence();
            } catch (error) {
                logger.error(
                    `[${client.user?.tag}] Presence error: ${error.message}`
                );
            }
        }, 10_000);
    }
};
