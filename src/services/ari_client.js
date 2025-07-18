const ari = require('ari-client');
const ConversationOrchestrator = require('./orchestrator');
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
    console.log(`[ARI] New call session started: ${sessionId}`);
    const orchestrator = new ConversationOrchestrator(sessionId);

    try {
        await channel.answer();
        console.log(`[ARI] Channel ${sessionId} answered.`);

        // Start the conversation and get the first prompt
        let response = await orchestrator.startConversation();
        console.log(`[ARI] Initial response for ${sessionId}:`, response);

        while (response && response.next_prompt) {
            // Set the response text for the dialplan (e.g., for TTS)
            await channel.setChannelVar({ variable: 'RESPONSE_TEXT', value: response.next_prompt });
            console.log(`[ARI] [${sessionId}] Set RESPONSE_TEXT: ${response.next_prompt}`);

            // Signal to the dialplan that we are ready for user input
            await channel.setChannelVar({ variable: 'ORCHESTRATOR_READY', value: '1' });

            // Wait for the user's input from the dialplan (e.g., from an AGI script with STT)
            console.log(`[ARI] [${sessionId}] Waiting for USER_INPUT...`);
            const userInput = await waitForChannelVar(channel, 'USER_INPUT');
            console.log(`[ARI] [${sessionId}] Received USER_INPUT: ${userInput}`);

            // We got input, so we are no longer ready for more.
            await channel.setChannelVar({ variable: 'ORCHESTRATOR_READY', value: '0' });

            // Process the user's input
            response = await orchestrator.processUserInput(userInput);
            console.log(`[ARI] [${sessionId}] Response after user input:`, response);
        }

        if (response && response.final_message) {
            console.log(`[ARI] [${sessionId}] Sending final message: ${response.final_message}`);
            await channel.setChannelVar({ variable: 'RESPONSE_TEXT', value: response.final_message });
             // Signal that the conversation is over.
            await channel.setChannelVar({ variable: 'CONVERSATION_DONE', value: '1' });
        }

    } catch (error) {
        console.error(`[ARI] [${sessionId}] Error in conversation handler:`, error);
    } finally {
        // Ensure the channel is hung up if it's still active
        try {
            console.log(`[ARI] [${sessionId}] Hanging up channel.`);
            await channel.hangup();
        } catch (hangupError) {
            // The channel might have already been hung up, which is fine.
            console.warn(`[ARI] [${sessionId}] Could not hang up channel, it might have been hung up already.`, hangupError.message);
        }
    }
}

async function start() {
    try {
        const client = await ari.connect(ARI_URL, ARI_USERNAME, ARI_PASSWORD);
        console.log(`[ARI] Connected to ARI at ${ARI_URL}`);

        client.on('StasisStart', handleStasisStart);

        await client.start(ARI_APP_NAME);
        console.log(`[ARI] ARI application '${ARI_APP_NAME}' started.`);

    } catch (err) {
        console.error('[ARI] Error connecting to or starting ARI client:', err);
        process.exit(1); // Exit if we can't connect to ARI
    }
}

module.exports = {
    start,
};
