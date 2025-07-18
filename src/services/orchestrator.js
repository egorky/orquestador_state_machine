const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const { VM } = require('vm2');
const redisClient = require('../lib/redis_client');
const geminiClient = require('./gemini_client');
const logger = require('../lib/logger');

class ConversationOrchestrator {
    constructor(sessionId, initialContext = {}) {
        this.sessionId = sessionId;
        this.state = {};
        this.configs = {};
        this.initialContext = initialContext;
        this.logContext = { sessionId, callerId: initialContext.callerId };
    }

    async initialize() {
        const loadedState = await redisClient.loadData(this.sessionId);
        this.state = loadedState || {
            collected_params: {},
            context: { ...this.initialContext },
            current_flow: null,
            current_parameter: null,
            status: 'AWAITING_INTENT'
        };
        const configPath = path.join(__dirname, '..', 'config');
        this.configs = {
            parameters: JSON.parse(await fs.readFile(path.join(configPath, "parameters_config.json"), "utf8")),
            apis: JSON.parse(await fs.readFile(path.join(configPath, "apis_config.json"), "utf8")),
            validations: JSON.parse(await fs.readFile(path.join(configPath, "validations_config.json"), "utf8")),
            flows: JSON.parse(await fs.readFile(path.join(configPath, "flows_config.json"), "utf8")),
            scripts: JSON.parse(await fs.readFile(path.join(configPath, "scripts_config.json"), "utf8")),
            intents: JSON.parse(await fs.readFile(path.join(configPath, "intents_config.json"), "utf8")),
            prompts: JSON.parse(await fs.readFile(path.join(configPath, "prompts_config.json"), "utf8")),
        };
    }

    async saveState() {
        await redisClient.saveData(this.sessionId, this.state);
    }

    async runScript(scriptName, context) {
        const scriptConfig = this.configs.scripts.scripts.find(s => s.name === scriptName);
        if (!scriptConfig) throw new Error(`Script '${scriptName}' not found.`);
        const vm = new VM({ timeout: 1000, sandbox: { context: context } });
        return vm.run(`(function(context) { ${scriptConfig.function_body} })(context)`);
    }

    async callApi(apiName, inputData) {
        const api = this.configs.apis.apis.find(a => a.name === apiName);
        if (!api) throw new Error(`API '${apiName}' not found.`);
        logger.debug(`Calling API: ${apiName} with input: ${JSON.stringify(inputData)}`, this.logContext);
        const mockApiPort = process.env.MOCK_API_PORT || 3001;
        let endpoint = api.endpoint.replace("http://127.0.0.1:3001", `http://127.0.0.1:${mockApiPort}`);
        const options = { method: api.method, headers: api.headers };
        if (api.method === "POST") options.body = JSON.stringify(inputData);
        else if (api.method === "GET" && Object.keys(inputData).length > 0) endpoint += `?${new URLSearchParams(inputData)}`;
        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API call to ${apiName} failed with status ${response.status}: ${errorBody}`);
        }
        const responseData = await response.json();
        logger.debug(`API ${apiName} response: ${JSON.stringify(responseData)}`, this.logContext);
        return responseData;
    }

    async executeStep(step, userInput) {
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
                logger.debug(`Executing script: ${step.name}`, this.logContext);
                const scriptResult = await this.runScript(step.name, this.state.context);
                if (step.output_key) {
                    this.state.context[step.output_key] = scriptResult;
                    logger.debug(`Script ${step.name} output [${step.output_key}]: ${JSON.stringify(scriptResult)}`, this.logContext);
                }
                break;
            case 'ai':
                const promptTemplate = this.configs.prompts.main_prompt_template.join('\n');
                const availableIntents = this.configs.intents.intents.map(i => i.name).join(', ');
                const prompt = promptTemplate
                    .replace('{current_flow}', this.state.current_flow)
                    .replace('{current_parameter}', this.state.current_parameter)
                    .replace('{available_intents}', availableIntents)
                    .replace('{collected_params}', JSON.stringify(this.state.collected_params))
                    .replace('{context}', JSON.stringify(this.state.context))
                    .replace('{user_input}', userInput);
                const aiResult = await geminiClient.extractParameter(prompt, userInput, this.state.context);
                return aiResult;
        }
    }

    invalidateDependentParams(changedParam) {
        const flow = this.configs.flows.flows[this.state.current_flow];
        let params_to_clear = [];
        let found_changed = false;
        let current = flow.initial_parameter;
        while(current) {
            if(found_changed) {
                params_to_clear.push(current);
            }
            if(current === changedParam) {
                found_changed = true;
            }
            current = flow.parameters[current].next_parameter;
        }

        logger.debug(`Invalidating dependent parameters: ${params_to_clear.join(', ')}`, this.logContext);
        for(const param of params_to_clear) {
            // This is a simplification. A more robust solution would track all keys
            // a parameter adds to the context and clear them.
            delete this.state.collected_params[param];
            delete this.state.collected_params[`${param}_id`];
            delete this.state.context[param];
            delete this.state.context[`${param}_id`];
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
                this.state.current_parameter = this.configs.flows.flows[intent].initial_parameter;
            } else {
                 await this.saveState();
                 return { next_prompt: "No he podido entender tu solicitud. Por favor, intenta de nuevo." };
            }
        } else {
            const currentParamConfig = this.configs.parameters[this.state.current_parameter];
            if (currentParamConfig && currentParamConfig.post_ask_steps) {
                for (const step of currentParamConfig.post_ask_steps) {
                    if(step.tool === 'ai') {
                        const ai_result = await this.executeStep(step, userInput);
                        logger.debug(`AI Result: ${JSON.stringify(ai_result)}`, this.logContext);

                        if(ai_result.new_intent) {
                            this.state.current_flow = ai_result.new_intent;
                            this.state.status = 'AWAITING_INTENT'; // Reset status
                            return await this.processUserInput(userInput); // Re-process for the new intent
                        }

                        if(ai_result.changed_params && Object.keys(ai_result.changed_params).length > 0) {
                            const changedParamName = Object.keys(ai_result.changed_params)[0].replace('_id','');
                            this.invalidateDependentParams(changedParamName);
                            Object.assign(this.state.collected_params, ai_result.changed_params);
                            Object.assign(this.state.context, ai_result.changed_params);
                        }

                        if(ai_result.extracted_param && Object.keys(ai_result.extracted_param).length > 0) {
                            Object.assign(this.state.collected_params, ai_result.extracted_param);
                            Object.assign(this.state.context, ai_result.extracted_param);
                        }

                    } else {
                        await this.executeStep(step, userInput);
                    }
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
        const flowConfig = this.configs.flows.flows[this.state.current_flow];
        const parametersConfig = this.configs.parameters;
        let nextParam = flowConfig.initial_parameter;
        while (nextParam) {
            const expectedOutputKey = `${nextParam}_id`;
            if (!this.state.collected_params[nextParam] && !this.state.collected_params[expectedOutputKey]) {
                this.state.current_parameter = nextParam;
                return;
            }
            nextParam = flowConfig.parameters[nextParam].next_parameter;
        }
        this.state.current_parameter = null;
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
