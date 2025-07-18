const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const { VM } = require('vm2');
const redisClient = require('../lib/redis_client');
const geminiClient = require('./gemini_client');

class ConversationOrchestrator {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.state = {};
        this.configs = {};
    }

    async initialize() {
        const loadedState = await redisClient.loadData(this.sessionId);
        this.state = loadedState || {
            collected_params: {},
            context: {},
            current_flow: null,
            current_parameter: null,
            status: 'AWAITING_INTENT' // NEW: Explicit status
        };

        const configPath = path.join(__dirname, '..', 'config');
        this.configs = {
            parameters: JSON.parse(await fs.readFile(path.join(configPath, "parameters_config.json"), "utf8")),
            apis: JSON.parse(await fs.readFile(path.join(configPath, "apis_config.json"), "utf8")),
            validations: JSON.parse(await fs.readFile(path.join(configPath, "validations_config.json"), "utf8")),
            flows: JSON.parse(await fs.readFile(path.join(configPath, "flows_config.json"), "utf8")),
            scripts: JSON.parse(await fs.readFile(path.join(configPath, "scripts_config.json"), "utf8")),
            intents: JSON.parse(await fs.readFile(path.join(configPath, "intents_config.json"), "utf8")),
        };
    }

    async saveState() {
        await redisClient.saveData(this.sessionId, this.state);
    }

    async runScript(scriptName, inputData) {
        const scriptConfig = this.configs.scripts.scripts.find(s => s.name === scriptName);
        if (!scriptConfig) throw new Error(`Script '${scriptName}' not found.`);

        const vm = new VM({
            timeout: 1000,
            sandbox: { input: inputData }
        });

        const functionBody = scriptConfig.function_body.replace(/cities|branches|specialities|available_times/g, 'input');
        return vm.run(`(function(input) { ${functionBody} })(input)`);
    }

    async callApi(apiName, inputData) {
        const api = this.configs.apis.apis.find(a => a.name === apiName);
        if (!api) throw new Error(`API '${apiName}' not found.`);

        const mockApiPort = process.env.MOCK_API_PORT || 3001;
        let endpoint = api.endpoint.replace("http://127.0.0.1:3001", `http://127.0.0.1:${mockApiPort}`);
        const options = { method: api.method, headers: api.headers };

        if (api.method === "POST") {
            options.body = JSON.stringify(inputData);
        } else if (api.method === "GET" && Object.keys(inputData).length > 0) {
            endpoint += `?${new URLSearchParams(inputData)}`;
        }

        const response = await fetch(endpoint, options);
        if (!response.ok) throw new Error(`API call to ${apiName} failed with status ${response.status}`);
        return response.json();
    }

    async executeStep(step, userInput = null) {
        switch (step.tool) {
            case 'api':
                const apiInputs = {};
                if (step.input_keys) {
                    for (const key in step.input_keys) {
                        const contextKey = step.input_keys[key].split('.')[1];
                        apiInputs[key] = this.state.context[contextKey];
                    }
                }
                const apiResult = await this.callApi(step.name, apiInputs);
                if (step.output_key) this.state.context[step.output_key] = apiResult;
                break;

            case 'script':
                if(this.state.context[step.input_key]){
                    const scriptInput = this.state.context[step.input_key];
                    const scriptResult = await this.runScript(step.name, scriptInput);
                    if (step.output_key) this.state.context[step.output_key] = scriptResult;
                }
                break;

            case 'ai':
                const aiResult = await geminiClient.extractParameter(step.prompt, userInput, this.state.context);
                if (aiResult) {
                    for (const key in aiResult) {
                        if (aiResult[key] !== null) {
                            this.state.collected_params[key] = aiResult[key];
                            this.state.context[key] = aiResult[key];
                        }
                    }
                }
                break;

            case 'validate':
                // Implement validation logic here
                break;

            default:
                throw new Error(`Unknown tool: ${step.tool}`);
        }
    }

    async processUserInput(userInput) {
        await this.initialize();

        if (this.state.status === 'AWAITING_INTENT') {
            const intent = await this.detectIntent(userInput);
            if (intent && this.configs.flows.flows[intent]) {
                this.state.current_flow = intent;
                this.state.status = 'COLLECTING_PARAMS';
                this.state.collected_params['intent'] = intent;
                this.state.context['intent'] = intent;

                if (intent === 'talk_to_agent') {
                    await this.saveState();
                    return { final_message: "Entendido. Le transferiré con un agente humano." };
                }
                // Set the first parameter of the detected flow
                this.state.current_parameter = this.configs.flows.flows[intent].initial_parameter;
            } else {
                 await this.saveState();
                 return { next_prompt: "No he podido entender tu solicitud. Por favor, intenta de nuevo." };
            }
        } else { // status === 'COLLECTING_PARAMS'
            const currentParamConfig = this.configs.parameters[this.state.current_parameter];
            if (currentParamConfig && currentParamConfig.post_ask_steps) {
                for (const step of currentParamConfig.post_ask_steps) {
                    await this.executeStep(step, userInput);
                }
            }
            this.moveToNextParameter();
        }

        if (!this.state.current_parameter) {
            await this.saveState();
            return { final_message: "Todos los parámetros han sido recolectados. Gracias." };
        }

        return this.prepareNextQuestion();
    }

    async prepareNextQuestion() {
        const nextParamConfig = this.configs.parameters[this.state.current_parameter];

        if (nextParamConfig.pre_ask_steps) {
            for (const step of nextParamConfig.pre_ask_steps) {
                await this.executeStep(step);
            }
        }

        let question = nextParamConfig.question;
        const placeholders = question.match(/\{(\w+)\}/g);
        if (placeholders) {
            placeholders.forEach(placeholder => {
                const key = placeholder.slice(1, -1);
                question = question.replace(placeholder, this.state.context[key] || `[${key}]`);
            });
        }

        await this.saveState();
        return { next_prompt: question, collected_params: this.state.collected_params };
    }

    moveToNextParameter() {
        const flow = this.configs.flows.flows[this.state.current_flow];
        let current = flow.initial_parameter;
        while(current && this.state.collected_params[current]){
            current = flow.parameters[current].next_parameter;
        }
        this.state.current_parameter = current;
    }

    async detectIntent(userInput) {
        const promptConfig = this.configs.intents;
        const prompt = `
            Por favor, analiza el siguiente texto y determina la intención del usuario.
            Las intenciones posibles son: ${promptConfig.intents.map(i => i.name).join(', ')}.
            Descripción de las intenciones:
            ${promptConfig.intents.map(i => `${i.name}: ${i.description}`).join('\n')}
            Basado en el texto, responde únicamente con un objeto JSON que contenga la clave "intent" y el valor de la intención detectada.
            Si no puedes determinar la intención, responde con un objeto JSON con la clave "intent" y el valor "unknown".
        `;
        const result = await geminiClient.extractParameter(prompt, userInput, this.state.context);
        return result ? result.intent : null;
    }

    async startConversation() {
        await this.initialize();
        this.state.status = 'AWAITING_INTENT';
        await this.saveState();
        return { next_prompt: "Hola, soy tu asistente virtual. ¿Cómo puedo ayudarte hoy?", collected_params: {} };
    }
}

module.exports = ConversationOrchestrator;
