const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SectionBuilder,
    ActionRowBuilder,
    ThumbnailBuilder
} = require('discord.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createLogger = (context) => {
    const getTimestamp = () => {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    };

    const formatMessage = (message) => {
        return `[${getTimestamp()}] [${context}] ${message}`;
    };

    return {
        info: (message, ...args) => {
            console.log('\x1b[32m%s\x1b[0m', formatMessage(message), ...args);
        },
        warn: (message, ...args) => {
            console.log('\x1b[33m%s\x1b[0m', formatMessage(message), ...args);
        },
        error: (message, ...args) => {
            console.error('\x1b[31m%s\x1b[0m', formatMessage(message), ...args);
        },
        debug: (message, ...args) => {
            const DEBUG_MODE = false;
            if (DEBUG_MODE) {
                console.log('\x1b[36m%s\x1b[0m', formatMessage(message), ...args);
            }
        }
    };
};


const createProgressBar = (percent, size = 10) => {
    const filledCount = Math.floor((percent / 100) * size);
    return '█'.repeat(filledCount) + '░'.repeat(size - filledCount);
};

const buildContainer = (color, ...components) => {
    const container = new ContainerBuilder().setAccentColor(parseInt(color.replace('#', ''), 16));

    for (const c of components) {
        if (c instanceof TextDisplayBuilder) container.addTextDisplayComponents(c);
        else if (c instanceof SeparatorBuilder) container.addSeparatorComponents(c);
        else if (c instanceof SectionBuilder) container.addSectionComponents(c);
        else if (c instanceof ActionRowBuilder) container.addActionRowComponents(c);
    }

    return container;
};

const txt = (content) => new TextDisplayBuilder().setContent(content);
const sep = (divider = true) => new SeparatorBuilder().setDivider(divider).setSpacing(1);

const headerSection = (guild, title, description = null) => {
    const components = [txt(title)];
    if (description) components.push(txt(description));
    const section = new SectionBuilder()
        .addTextDisplayComponents(...components);
    if (guild?.iconURL()) {
        section.setThumbnailAccessory(
            new ThumbnailBuilder().setURL(guild.iconURL({ dynamic: true, size: 512 }))
        );
    }
    return section;
};

module.exports = {
    sleep,
    createLogger,
    createProgressBar,
    buildContainer,
    txt,
    sep,
    headerSection
};