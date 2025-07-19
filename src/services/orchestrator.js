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
            flows: JSON.parse(await fs.readFile(path.join(configPath, "flows_config.json"), "utf8")),
            scripts: JSON.parse(await fs.readFile(path.join(configPath, "scripts_config.json"), "utf8")),
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

    async handleApiAuth(apiConfig) {
        if (!apiConfig.auth) {
            return apiConfig.headers || {};
        }

        const authConfig = apiConfig.auth;
        const tokenKey = `api_token:${apiConfig.name}`;
        const tokenData = await redisClient.loadData(tokenKey);

        if (tokenData && tokenData.expires_at > Date.now()) {
            logger.debug(`Using cached API token for ${apiConfig.name}`, this.logContext);
            return { ...apiConfig.headers, "Authorization": `Bearer ${tokenData.access_token}` };
        }

        logger.info(`Requesting new API token for ${apiConfig.name}`, this.logContext);
        if (authConfig.type === 'oauth2_client_credentials') {
            const tokenUrl = authConfig.token_url.replace("http://127.0.0.1:3001", `http://127.0.0.1:${process.env.MOCK_API_PORT || 3001}`);
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: authConfig.client_id,
                    client_secret: authConfig.client_secret,
                    scope: authConfig.scope
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to get API token for ${apiConfig.name}: ${response.statusText}`);
            }

            const newToken = await response.json();
            const expires_at = Date.now() + (newToken.expires_in * 1000);
            await redisClient.saveData(tokenKey, { ...newToken, expires_at }, newToken.expires_in);

            logger.info(`Successfully obtained new API token for ${apiConfig.name}`, this.logContext);
            return { ...apiConfig.headers, "Authorization": `Bearer ${newToken.access_token}` };
        }

        throw new Error(`Unsupported auth type: ${authConfig.type}`);
    }

    async callApi(apiName, urlParams, bodyParams) {
        const api = this.configs.apis.apis.find(a => a.name === apiName);
        if (!api) throw new Error(`API '${apiName}' not found.`);

        const headers = await this.handleApiAuth(api);

        logger.debug(`Calling API: ${apiName} with URL params: ${JSON.stringify(urlParams)} and body: ${JSON.stringify(bodyParams)}`, this.logContext);
        const mockApiPort = process.env.MOCK_API_PORT || 3001;
        let endpoint = api.endpoint.replace("http://127.0.0.1:3001", `http://127.0.0.1:${mockApiPort}`);

        if (urlParams && Object.keys(urlParams).length > 0) {
            endpoint += `?${new URLSearchParams(urlParams)}`;
        }

        const options = { method: api.method, headers: headers };
        if (bodyParams && Object.keys(bodyParams).length > 0 && ['POST', 'PUT', 'PATCH'].includes(api.method)) {
            options.body = JSON.stringify(bodyParams);
        }

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
                let urlParams = {};
                let bodyParams = {};

                if (step.input_keys) {
                    // New structure: { url_params: {...}, body_params: {...} }
                    if (step.input_keys.url_params || step.input_keys.body_params) {
                        if (step.input_keys.url_params) {
                            for (const key in step.input_keys.url_params) {
                                const contextKey = step.input_keys.url_params[key].split('.')[1];
                                urlParams[key] = this.state.context[contextKey];
                            }
                        }
                        if (step.input_keys.body_params) {
                            for (const key in step.input_keys.body_params) {
                                const contextKey = step.input_keys.body_params[key].split('.')[1];
                                bodyParams[key] = this.state.context[contextKey];
                            }
                        }
                    } else { // Legacy structure for backward compatibility
                        const tempParams = {};
                        for (const key in step.input_keys) {
                            const contextKey = step.input_keys[key].split('.')[1];
                            tempParams[key] = this.state.context[contextKey];
                        }

                        const api = this.configs.apis.apis.find(a => a.name === step.name);
                        if (api && ['POST', 'PUT', 'PATCH'].includes(api.method)) {
                            bodyParams = tempParams;
                        } else {
                            urlParams = tempParams;
                        }
                    }
                }
                const apiResult = await this.callApi(step.name, urlParams, bodyParams);
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
                const promptId = step.prompt_id || 'default';
                const promptTemplateText = this.configs.prompts.prompts[promptId];
                if (!promptTemplateText) {
                    throw new Error(`Prompt with id '${promptId}' not found in prompts_config.json`);
                }

                let promptTemplate = promptTemplateText.join('\n');
                if (step.prompt_append) {
                    promptTemplate += "\n\n" + step.prompt_append;
                }

                const now = new Date();
                const currentDate = now.toISOString().split('T')[0];
                const currentTime = now.toTimeString().split(' ')[0];

                const availableIntents = Object.keys(this.configs.flows.flows).join(', ');
                const prompt = promptTemplate
                    .replace(/\{current_date\}/g, currentDate)
                    .replace(/\{current_time\}/g, currentTime)
                    .replace(/\{current_flow\}/g, this.state.current_flow)
                    .replace(/\{current_parameter\}/g, this.state.current_parameter)
                    .replace(/\{available_intents\}/g, availableIntents)
                    .replace(/\{collected_params\}/g, JSON.stringify(this.state.collected_params))
                    .replace(/\{context\}/g, JSON.stringify(this.state.context))
                    .replace(/\{user_input\}/g, userInput);

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

                const newFlow = this.configs.flows.flows[intent];
                if (!newFlow.initial_parameter) {
                    await this.saveState();
                    return {
                        final_message: newFlow.final_message || "Entendido.",
                        collected_params: this.state.collected_params
                    };
                }

                this.state.current_parameter = newFlow.initial_parameter;
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

                        if (ai_result.new_intent) {
                            this.state.current_flow = ai_result.new_intent;
                            logger.info(`User changed intent to: ${this.state.current_flow}`, this.logContext);

                            const newFlow = this.configs.flows.flows[this.state.current_flow];

                            // Reset context for the new flow
                            this.state.collected_params = { intent: this.state.current_flow };
                            this.state.context = { ...this.initialContext, intent: this.state.current_flow };

                            if (!newFlow.initial_parameter) {
                                // This is a single-shot intent like "talk_to_agent"
                                // We can define a final message in the flow config itself
                                return {
                                    final_message: newFlow.final_message || "Entendido.",
                                    collected_params: this.state.collected_params
                                };
                            }

                            this.moveToNextParameter();
                            break;
                        }

                        if (ai_result.changed_params && Object.keys(ai_result.changed_params).length > 0) {
                            const changedParamName = Object.keys(ai_result.changed_params)[0].replace('_id','');
                            this.invalidateDependentParams(changedParamName);
                            Object.assign(this.state.collected_params, ai_result.changed_params);
                            Object.assign(this.state.context, ai_result.changed_params);
                        }

                        if (ai_result.extracted_param && Object.keys(ai_result.extracted_param).length > 0) {
                            const paramName = Object.keys(ai_result.extracted_param)[0];
                            const paramValue = ai_result.extracted_param[paramName];

                            // If the extracted parameter is an object, it's a complex response (e.g., with id and name)
                            if (typeof paramValue === 'object' && paramValue !== null && paramValue.id) {
                                this.state.collected_params[`${paramName}_id`] = paramValue.id;
                                this.state.collected_params[paramName] = paramValue.name;
                                this.state.context[`${paramName}_id`] = paramValue.id;
                                this.state.context[paramName] = paramValue.name;
                            } else if (typeof paramValue === 'object' && paramValue !== null && !paramValue.id) {
                                // AI returned a value but couldn't find a valid ID
                                const unmatchedKey = Object.keys(paramValue)[0];
                                const unmatchedValue = paramValue[unmatchedKey];
                                this.state.context.unmatched_input = unmatchedValue;
                                this.state.context.unmatched_parameter = this.state.current_parameter;
                                logger.warn(`No valid ID found for ${this.state.current_parameter}. User provided: '${unmatchedValue}'`, this.logContext);

                            } else {
                                // Simple parameter (e.g., text input)
                                this.state.collected_params[paramName] = paramValue;
                                this.state.context[paramName] = paramValue;
                            }
                        }

                    } else {
                        await this.executeStep(step, userInput);
                    }
                }
            }

            // Only move to the next parameter if the current one was successfully collected
            if (!this.state.context.unmatched_input) {
                this.moveToNextParameter();
            }
        }

        if (!this.state.current_parameter) {
            await this.saveState();
            return {
                final_message: "Todos los parámetros han sido recolectados. Gracias.",
                collected_params: this.state.collected_params
            };
        }
        return this.prepareNextQuestion();
    }

    async prepareNextQuestion() {
        // Check if there was an unmatched input from the previous turn
        if (this.state.context.unmatched_input) {
            const errorMessage = `Lo siento, no he podido encontrar '${this.state.context.unmatched_input}' como una opción válida para ${this.state.context.unmatched_parameter}. Por favor, intenta de nuevo.`;

            // Clear the unmatched input to avoid repeating the error
            delete this.state.context.unmatched_input;
            delete this.state.context.unmatched_parameter;

            // Get the original question again
            const nextParamConfig = this.configs.parameters[this.state.current_parameter];
            let original_question = nextParamConfig.question;
            const placeholders = original_question.match(/\{(\w+)\}/g);
            if (placeholders) {
                placeholders.forEach(placeholder => {
                    const key = placeholder.slice(1, -1);
                    original_question = original_question.replace(placeholder, this.state.context[key] || `[${key}]`);
                });
            }

            await this.saveState();
            return { next_prompt: `${errorMessage} ${original_question}`, collected_params: this.state.collected_params };
        }


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
        const flows = this.configs.flows.flows;
        const possibleIntents = Object.keys(flows);
        const intentDescriptions = possibleIntents.map(name => `${name}: ${flows[name].description}`).join('\n');

        const prompt = `
            Por favor, analiza el siguiente texto y determina la intención del usuario.
            Las intenciones posibles son: ${possibleIntents.join(', ')}.
            Descripción de las intenciones:
            ${intentDescriptions}
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
