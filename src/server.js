require('dotenv').config();
const express = require('express');
const ConversationOrchestrator = require('./services/orchestrator');
const ariClient = require('./services/ari_client');

const app = express();
app.use(express.json());

const apiEnabled = process.env.API_ENABLED === 'true';
const ariEnabled = process.env.ARI_ENABLED === 'true';

if (apiEnabled) {
    app.post('/conversation', async (req, res) => {
        const { sessionId, userInput } = req.body;
        if (!sessionId || !userInput) {
            return res.status(400).json({ error: 'sessionId and userInput are required' });
        }

        try {
            const orchestrator = new ConversationOrchestrator(sessionId);
            const response = await orchestrator.processUserInput(userInput);
            res.json(response);
        } catch (error) {
            console.error('Error processing conversation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/start_conversation', async (req, res) => {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        try {
            const orchestrator = new ConversationOrchestrator(sessionId);
            const response = await orchestrator.startConversation();
            res.json(response);
        } catch (error) {
            console.error('Error starting conversation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    const port = process.env.API_PORT || 3000;
    app.listen(port, () => {
        console.log(`API server listening on port ${port}`);
    });
}

if (ariEnabled) {
    ariClient.start();
}

if (process.env.MOCK_API_ENABLED === 'true') {
    require('../demo/mock_api');
}
