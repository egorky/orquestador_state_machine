const ari = require('ari-client');
const ConversationOrchestrator = require('./orchestrator');
const logger = require('../lib/logger');
require('dotenv').config();

const ARI_URL = process.env.ARI_URL;
const ARI_USERNAME = process.env.ARI_USERNAME;
const ARI_PASSWORD = process.env.ARI_PASSWORD;
const ARI_APP_NAME = process.env.ARI_APP_NAME || 'conversation-orchestrator';

// Helper function to wait for a channel variable
function waitForChannelVar(channel, varName) {
    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            try {
                const response = await channel.getChannelVar({ variable: varName });
                if (response && response.value) {
                    clearInterval(interval);
                    // Clear the variable after reading it
                    await channel.setChannelVar({ variable: varName, value: '' });
                    resolve(response.value);
                }
            } catch (error) {
                // Ignore errors if the variable doesn't exist yet
            }
        }, 500); // Check every 500ms
    });
}


async function handleStasisStart(event, channel) {
    const sessionId = event.channel.id;
    const callerId = event.channel.caller.number;
    const logContext = { sessionId, callerId };

    logger.info(`New call session started.`, logContext);
    const orchestrator = new ConversationOrchestrator(sessionId, { callerId });

    try {
        await channel.answer();
        logger.info(`Channel answered.`, logContext);

        let response = await orchestrator.startConversation();
        logger.info(`Initial response: ${JSON.stringify(response)}`, logContext);

        while (response && response.next_prompt) {
            await channel.setChannelVar({ variable: 'RESPONSE_TEXT', value: response.next_prompt });
            logger.info(`Set RESPONSE_TEXT: ${response.next_prompt}`, logContext);

            await channel.setChannelVar({ variable: 'ORCHESTRATOR_READY', value: '1' });

            logger.info(`Waiting for USER_INPUT...`, logContext);
            const userInput = await waitForChannelVar(channel, 'USER_INPUT');
            logger.info(`Received USER_INPUT: ${userInput}`, logContext);

            await channel.setChannelVar({ variable: 'ORCHESTRATOR_READY', value: '0' });

            response = await orchestrator.processUserInput(userInput);
            logger.info(`Response after user input: ${JSON.stringify(response)}`, logContext);
        }

        if (response && response.final_message) {
            logger.info(`Sending final message: ${response.final_message}`, logContext);
            await channel.setChannelVar({ variable: 'RESPONSE_TEXT', value: response.final_message });
            await channel.setChannelVar({ variable: 'CONVERSATION_DONE', value: '1' });
        }

    } catch (error) {
        logger.error(`Error in conversation handler: ${error.message}`, logContext);
    } finally {
        try {
            logger.info(`Hanging up channel.`, logContext);
            await channel.hangup();
        } catch (hangupError) {
            logger.warn(`Could not hang up channel, it might have been hung up already: ${hangupError.message}`, logContext);
        }
    }
}

async function start() {
    try {
        const client = await ari.connect(ARI_URL, ARI_USERNAME, ARI_PASSWORD);
        logger.info(`Connected to ARI at ${ARI_URL}`);

        client.on('StasisStart', handleStasisStart);

        await client.start(ARI_APP_NAME);
        logger.info(`ARI application '${ARI_APP_NAME}' started.`);

    } catch (err) {
        logger.error(`Error connecting to or starting ARI client: ${err.message}`);
        process.exit(1);
    }
}

module.exports = {
    start,
};
