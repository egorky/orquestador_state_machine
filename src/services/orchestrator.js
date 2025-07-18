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
            current_flow: 'scheduling',
            current_parameter: null,
            intent_detected: false,
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

        if (!this.state.current_parameter) {
            this.state.current_parameter = this.configs.flows.flows[this.state.current_flow].initial_parameter;
        }
    }

    async saveState() {
        await redisClient.saveData(this.sessionId, this.state);
    }

    async runScript(scriptName, inputKey, inputData) {
        const scriptConfig = this.configs.scripts.scripts.find(s => s.name === scriptName);
        if (!scriptConfig) throw new Error(`Script '${scriptName}' not found.`);

        const sandbox = {};
        // El input_key del script (ej: "cities_data") se convierte en el nombre de la variable dentro del sandbox
        const varName = inputKey.replace('_data', ''); // "cities"
        sandbox[varName] = inputData;

        const vm = new VM({
            timeout: 1000,
            sandbox: sandbox
        });

        return vm.run(scriptConfig.function_body);
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
                        apiInputs[key] = this.state.context[step.input_keys[key].split('.')[1]];
                    }
                }
                const apiResult = await this.callApi(step.name, apiInputs);
                if (step.output_key) this.state.context[step.output_key] = apiResult;
                break;

            case 'script':
                const scriptInput = this.state.context[step.input_key];
                const scriptResult = await this.runScript(step.name, step.input_key, scriptInput);
                if (step.output_key) this.state.context[step.output_key] = scriptResult;
                break;

            case 'ai':
                const aiResult = await geminiClient.extractParameter(step.prompt, userInput, this.state.context);
                if (aiResult) {
                    for (const key in aiResult) {
                        this.state.collected_params[key] = aiResult[key];
                        this.state.context[key] = aiResult[key];
                    }
                }
                break;

            case 'validate':
                // Implement validation logic here if needed
                break;

            default:
                throw new Error(`Unknown tool: ${step.tool}`);
        }
    }

    async processUserInput(userInput) {
        await this.initialize();

        if (!this.state.intent_detected) {
            const intent = await this.detectIntent(userInput);
            if (intent && this.configs.flows.flows[intent]) {
                this.state.current_flow = intent;
                this.state.intent_detected = true;
                if (intent === 'talk_to_agent') {
                    return { final_message: "Entendido. Le transferiré con un agente humano." };
                }
            } else {
                return { next_prompt: "No he podido entender tu solicitud. Por favor, intenta de nuevo." };
            }
        }

        const currentParamConfig = this.configs.parameters[this.state.current_parameter];

        if (currentParamConfig.post_ask_steps) {
            for (const step of currentParamConfig.post_ask_steps) {
                await this.executeStep(step, userInput);
            }
        }

        this.moveToNextParameter();

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
        const flowParams = this.configs.flows.flows[this.state.current_flow].parameters;
        let nextParam = null;

        if(this.state.current_parameter) {
            nextParam = flowParams[this.state.current_parameter].next_parameter;
        } else {
            nextParam = this.configs.flows.flows[this.state.current_flow].initial_parameter;
        }

        while (nextParam && this.state.collected_params[nextParam]) {
            nextParam = flowParams[nextParam].next_parameter;
        }
        this.state.current_parameter = nextParam;
    }


    async detectIntent(userInput) {
        const prompt = `
            Por favor, analiza el siguiente texto y determina la intención del usuario.
            Las intenciones posibles son: ${this.configs.intents.intents.map(i => i.name).join(', ')}.
            Descripción de las intenciones:
            ${this.configs.intents.intents.map(i => `${i.name}: ${i.description}`).join('\n')}
            Basado en el texto, responde únicamente con un objeto JSON que contenga la clave "intent" y el valor de la intención detectada.
            Si no puedes determinar la intención, responde con un objeto JSON con la clave "intent" y el valor "unknown".
        `;
        const result = await geminiClient.extractParameter(prompt, userInput);
        return result ? result.intent : null;
    }

    async startConversation() {
        await this.initialize();
        if (!this.state.current_parameter) {
            this.state.current_parameter = this.configs.flows.flows[this.state.current_flow].initial_parameter;
        }
        return this.prepareNextQuestion();
    }
}

module.exports = ConversationOrchestrator;
