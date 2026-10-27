const { setTimeout: delay } = require('node:timers/promises');

const transientCodes = new Set([
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH',
    'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT'
]);

const isTransientConnectionError = error => Boolean(error && (
    transientCodes.has(error.code) ||
    /opening handshake has timed out|timed?\s*out|timeout/i.test(error.message || '') ||
    (error.cause && isTransientConnectionError(error.cause))
));

async function loginWithRetry(client, token, logger, wait = delay) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await client.login(token);
        } catch (error) {
            await client.destroy();
            if (!isTransientConnectionError(error) || attempt === maxAttempts) throw error;
            const waitMs = 5000 * 2 ** (attempt - 1);
            logger.warn(`Temporary gateway connection failure. Retrying login in ${waitMs / 1000}s (${attempt + 1}/${maxAttempts}).`);
            await wait(waitMs);
        }
    }
}

module.exports = { loginWithRetry, isTransientConnectionError };
