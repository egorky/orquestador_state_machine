const ari = require('ari-client');
const ConversationOrchestrator = require('./orchestrator');
require('dotenv').config();

const ARI_URL = process.env.ARI_URL;
const ARI_USERNAME = process.env.ARI_USERNAME;
const ARI_PASSWORD = process.env.ARI_PASSWORD;

/**
 * @description Starts the ARI client and handles incoming calls.
 * @returns {Promise<void>}
 */
async function start() {
    try {
        const client = await ari.connect(ARI_URL, ARI_USERNAME, ARI_PASSWORD);
        console.log('Connected to ARI');

        /**
         * @description Handles the StasisStart event, which is triggered when a new channel enters the Stasis application.
         * @param {object} event - The StasisStart event object.
         * @param {import('ari-client').Channel} channel - The channel that entered Stasis.
         */
        client.on('StasisStart', async (event, channel) => {
            const sessionId = event.channel.id;
            const orchestrator = new ConversationOrchestrator(sessionId);

            // Answer the channel
            await channel.answer();

            // Start the conversation
            let response = await orchestrator.startConversation();

            while (response.next_prompt) {
                // Play the prompt to the user
                // This is a simplified example. In a real scenario, you'd use TTS
                // or play a pre-recorded audio file.
                await channel.setChannelVar({ variable: 'RESPONSE_TEXT', value: response.next_prompt });

                // Here you would typically wait for user input, e.g., via AGI script
                // that captures speech-to-text and sends it back.
                // For this example, we'll simulate a user response.
                const userInput = "Simulated user input"; // Replace with actual user input mechanism

                response = await orchestrator.processUserInput(userInput);
            }

            if (response.final_message) {
                await channel.setChannelVar({ variable: 'RESPONSE_TEXT', value: response.final_message });
            }

            // Hang up the channel
            await channel.hangup();
        });

        client.start('conversation-orchestrator');
    } catch (err) {
        console.error('Error connecting to ARI:', err);
    }
}

module.exports = {
    start,
};
