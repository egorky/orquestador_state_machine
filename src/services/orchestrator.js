const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const redisClient = require('../lib/redis_client');
const geminiClient = require('./gemini_client');

/**
 * @class ConversationOrchestrator
 * @description Manages the conversation flow, state, and interactions with external services.
 */
class ConversationOrchestrator {
    /**
     * @param {string} sessionId - The unique identifier for the conversation session.
     */
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.state = {};
        this.parameters = null;
        this.apisConfig = null;
        this.validationsConfig = null;
        this.executionSequences = null;
        this.flowsConfig = null;
        this.scriptsConfig = null;
        this.intentsConfig = null;
        this.finalAction = null;
    }

    /**
     * @description Initializes the orchestrator by loading the conversation state from Redis and all JSON configurations.
     */
    async initialize() {
        // Load state from Redis or create a new one
        const loadedState = await redisClient.loadData(this.sessionId);
        if (loadedState) {
            this.state = loadedState;
        } else {
            this.state = {
                collected: {},
                context: {},
                currentFlow: 'scheduling', // Default flow
                currentParameter: null,
            };
        }

        // Load JSON configurations
        const configPath = path.join(__dirname, '..', 'config');
        this.parametersConfig = JSON.parse(await fs.readFile(path.join(configPath, "parameters_config.json"), "utf8"));
        this.apisConfig = JSON.parse(await fs.readFile(path.join(configPath, "apis_config.json"), "utf8"));
        this.validationsConfig = JSON.parse(await fs.readFile(path.join(configPath, "validations_config.json"), "utf8"));
        this.executionSequences = JSON.parse(await fs.readFile(path.join(configPath, "execution_order_config.json"), "utf8")).execution_sequences;
        this.flowsConfig = JSON.parse(await fs.readFile(path.join(configPath, "flows_config.json"), "utf8"));
        this.scriptsConfig = JSON.parse(await fs.readFile(path.join(configPath, "scripts_config.json"), "utf8"));
        this.intentsConfig = JSON.parse(await fs.readFile(path.join(configPath, "intents_config.json"), "utf8"));

        this.parameters = this.parametersConfig.parameters;
        this.finalAction = this.parametersConfig.final_action;

        if (!this.state.currentParameter) {
            this.state.currentParameter = this.flowsConfig.flows[this.state.currentFlow].initial_parameter;
        }
    }

    /**
     * @description Saves the current conversation state to Redis.
     */
    async saveState() {
        await redisClient.saveData(this.sessionId, this.state);
    }

    /**
     * @description Determines the next parameter to be collected based on the current flow.
     * @returns {object|null} The next parameter object or null if all parameters are collected.
     */
    getNextParameter() {
        if (!this.state.currentParameter) {
            return null;
        }
        return this.parameters.find(p => p.name === this.state.currentParameter);
    }

    /**
     * @description Applies validation rules to the extracted data.
     * @param {object} extracted - The data extracted by the AI.
     * @param {Array<object>} rules - The validation rules to apply.
     * @param {object} context - The current conversation context.
     * @returns {{valid: boolean, message?: string}} The validation result.
     */
    async applyValidation(extracted, rules, context) {
        for (const rule of rules) {
            if (rule.type === "regex") {
                const value = Object.values(extracted)[0];
                if (!new RegExp(rule.pattern).test(String(value))) {
                    console.log(`Validation failed: ${rule.error_message}`);
                    return { valid: false, message: rule.error_message };
                }
            } else if (rule.type === "in_list") {
                const sourceKey = Object.keys(context).find(k => k.includes(rule.source));
                const sourceData = context[sourceKey] || [];
                if (!Array.isArray(sourceData)) {
                    console.log(`Validation failed: source data for ${rule.source} is not an array.`);
                    return { valid: false, message: "Error interno de validación." };
                }
                const key = rule.key;
                const value = extracted[key];

                if (!sourceData.some(item => String(item[key]) === String(value))) {
                    console.log(`Validation failed: ${rule.error_message}`);
                    return { valid: false, message: rule.error_message };
                }
            } else if (rule.type === "in_list_simple") {
                const sourceKey = Object.keys(context).find(k => k.includes(rule.source));
                const sourceData = context[sourceKey] || [];
                 if (!Array.isArray(sourceData)) {
                    console.log(`Validation failed: source data for ${rule.source} is not an array.`);
                    return { valid: false, message: "Error interno de validación." };
                }
                const value = Object.values(extracted)[0];
                if (!sourceData.includes(value)) {
                    console.log(`Validation failed: ${rule.error_message}`);
                    return { valid: false, message: rule.error_message };
                }
            }
        }
        return { valid: true };
    }

    /**
     * @description Calls an external API.
     * @param {string} apiName - The name of the API to call.
     * @param {object} inputData - The data to send to the API.
     * @returns {Promise<object>} The JSON response from the API.
     */
    async callApi(apiName, inputData) {
        const api = this.apisConfig.apis.find(a => a.name === apiName);
        if (!api) {
            throw new Error(`API '${apiName}' not found in configuration.`);
        }

        try {
            const mockApiPort = process.env.MOCK_API_PORT || 3001;
            let endpoint = api.endpoint.replace("http://127.0.0.1:3001", `http://127.0.0.1:${mockApiPort}`);

            const options = {
                method: api.method,
                headers: api.headers,
            };

            if (api.method === "POST") {
                options.body = JSON.stringify(inputData);
            } else if (api.method === "GET" && Object.keys(inputData).length > 0) {
                endpoint += `?${new URLSearchParams(inputData)}`;
            }

            console.log(`Calling API ${apiName} at ${endpoint} with options:`, JSON.stringify(options, null, 2));
            const response = await fetch(endpoint, options);
            const responseData = await response.json();
            console.log(`Response from API ${apiName}:`, JSON.stringify(responseData, null, 2));

            if (![200, 201].includes(response.status)) {
                throw new Error(`API call failed with status ${response.status}: ${JSON.stringify(responseData)}`);
            }
            return responseData;
        } catch (error) {
            console.error(`API call to ${apiName} failed: ${error.message}`);
            return {};
        }
    }

    /**
     * @description Processes a single step in the execution sequence for a parameter.
     * @param {object} step - The step to process.
     * @param {string} response - The user's response.
     * @param {object} context - The current conversation context.
     * @returns {Promise<object>} The updated context or an error object.
     */
    async processStep(step, response, context) {
        if (step.tool === "api_call") {
            const inputData = step.input_keys ? Object.fromEntries(
                step.input_keys.map(key => [key, this.state.context[key]])
            ) : {};
            const result = await this.callApi(step.api, inputData);
            context[step.output_key] = result;
        } else if (step.tool === "ai_extract") {
            const extracted = await geminiClient.extractParameter(step.prompt, response, context);
            context.extracted = extracted;
            if (!extracted) return null;
            return extracted;
        } else if (step.tool === "validate") {
            const validation = this.validationsConfig.validations.find(val => val.parameter === step.validation);
            if (validation) {
                const validationResult = await this.applyValidation(context.extracted, validation.rules, context);
                if (!validationResult.valid) {
                    return { error: validationResult.message };
                }
            }
        } else if (step.tool === 'decision') {
            const value = this.state.context[step.on];
            const decisionCase = step.cases.find(c => c.equals === value);
            if (decisionCase) {
                this.state.currentParameter = decisionCase.next_parameter;
            } else {
                this.state.currentParameter = step.default;
            }
        } else if (step.tool === 'script') {
            const script = this.scriptsConfig.scripts.find(s => s.name === step.script);
            if (script) {
                const args = step.input_keys.map(key => this.state.context[key]);
                const func = new Function(...step.input_keys, script.function_body);
                const result = func(...args);
                context[step.output_key] = result;
            }
        }
        return context;
    }

    /**
     * @description Detects the user's intent using Gemini.
     * @param {string} userInput - The user's input.
     * @returns {Promise<string|null>} The detected intent name or null.
     */
    async detectIntent(userInput) {
        const prompt = `
            Por favor, analiza el siguiente texto y determina la intención del usuario.
            Las intenciones posibles son: ${this.intentsConfig.intents.map(i => i.name).join(', ')}.
            Descripción de las intenciones:
            ${this.intentsConfig.intents.map(i => `${i.name}: ${i.description}`).join('\n')}
            Basado en el texto, responde únicamente con un objeto JSON que contenga la clave "intent" y el valor de la intención detectada.
            Si no puedes determinar la intención, responde con un objeto JSON con la clave "intent" y el valor "unknown".
        `;

        const result = await geminiClient.extractParameter(prompt, userInput);
        return result ? result.intent : null;
    }

    /**
     * @description Extracts all possible parameters from the user's response.
     * @param {string} userInput - The user's input.
     * @returns {Promise<object|null>} An object containing the extracted parameters.
     */
    async extractAllParameters(userInput) {
        const uncollectedParams = this.parameters.filter(p => !this.state.collected[p.name]);
        const prompt = `
            Por favor, analiza el siguiente texto y extrae cualquiera de los siguientes parámetros: ${uncollectedParams.map(p => p.name).join(', ')}.
            Texto a analizar: "${userInput}"
            Contexto adicional: ${JSON.stringify(this.state.context)}
            Responde únicamente con un objeto JSON que contenga los parámetros extraídos.
            Por ejemplo: { "city": "Guayaquil", "id_number": "0987654321" }
            Si no puedes extraer ningún parámetro, responde con un objeto JSON vacío.
        `;

        return await geminiClient.extractParameter(prompt, userInput, this.state.context);
    }

    /**
     * @description Performs a lookup based on the parameter configuration.
     * @param {string} paramName - The name of the parameter.
     * @param {string} extractedValue - The value extracted by the AI.
     * @param {object} lookupConfig - The lookup configuration from parameters_config.json.
     */
    async performLookup(paramName, extractedValue, lookupConfig) {
        let sourceData;

        if (lookupConfig.from_api) {
            sourceData = await this.callApi(lookupConfig.from_api, {});
            this.state.context[lookupConfig.in] = sourceData;
        } else if (lookupConfig.from_context) {
            sourceData = this.state.context[lookupConfig.from_context];
        }

        if (sourceData && Array.isArray(sourceData)) {
            const matchObject = sourceData.find(item => String(item[lookupConfig.match]).toLowerCase() === String(extractedValue).toLowerCase());
            if (matchObject) {
                for (const key in lookupConfig.output) {
                    this.state.context[key] = matchObject[lookupConfig.output[key]];
                }
            }
        }
    }

    /**
     * @description Processes the user's input, orchestrating the collection of the next parameter.
     * @param {string} response - The user's input.
     * @returns {Promise<object>} An object containing the next prompt or the final message.
     */
    async processUserInput(response) {
        await this.initialize();

        // If intent is not set, detect it
        if (!this.state.collected.intent) {
            const intent = await this.detectIntent(response);
            if (intent && this.flowsConfig.flows[intent]) {
                this.state.currentFlow = intent;
                this.state.collected.intent = true; // Mark intent as collected
                if (intent === 'talk_to_agent') {
                    return { final_message: "Entendido. Le transferiré con un agente humano." };
                }
            } else {
                // Try to extract parameters even if intent is not clear
                const extractedParams = await this.extractAllParameters(response);
                if (extractedParams && Object.keys(extractedParams).length > 0) {
                    this.state.currentFlow = 'scheduling'; // Assume scheduling if params are detected
                    this.state.collected.intent = true; // Mark intent as collected
                } else {
                    return { next_prompt: "No he podido entender tu solicitud. Por favor, intenta de nuevo." };
                }
            }
        }

        // Extract all possible parameters from the user's response
        const extractedParams = await this.extractAllParameters(response);

        if (extractedParams) {
            for (const paramName in extractedParams) {
                if (this.parameters.find(p => p.name === paramName) && !this.state.collected[paramName]) {
                    this.state.collected[paramName] = true;
                    this.state.context[paramName] = extractedParams[paramName];

                    const paramConfig = this.parameters.find(p => p.name === paramName);
                    if (paramConfig && paramConfig.lookup) {
                        await this.performLookup(paramName, extractedParams[paramName], paramConfig.lookup);
                    }
                }
            }
        }

        // --- Chaining Logic ---
        if (this.state.context.city_id && !this.state.context.branches) {
            this.state.context.branches = await this.callApi('fetch_branches_api', { city_id: this.state.context.city_id });
        }
        if (this.state.context.branch_id && !this.state.context.specialities) {
            this.state.context.specialities = await this.callApi('fetch_specialities_api', { branch_id: this.state.context.branch_id });
        }
        if (this.state.context.speciality_id && !this.state.context.available_times) {
            this.state.context.available_times = await this.callApi('fetch_available_times_api', { speciality_id: this.state.context.speciality_id });
        }

        // Determine the next parameter to ask for
        const nextParamName = this.flowsConfig.flows[this.state.currentFlow].initial_parameter;
        let currentParam = this.parameters.find(p => p.name === nextParamName);
        while (currentParam && this.state.collected[currentParam.name]) {
            const nextParamNameInFlow = this.flowsConfig.flows[this.state.currentFlow].parameters[currentParam.name].next_parameter;
            currentParam = this.parameters.find(p => p.name === nextParamNameInFlow);
        }

        this.state.currentParameter = currentParam ? currentParam.name : null;

        await this.saveState();

        if (!this.state.currentParameter) {
            return { final_message: "Todos los parámetros han sido recolectados. Gracias." };
        }

        const nextParam = this.getNextParameter();

        // Pre-fetch data for the next question if needed
        const nextSequence = this.executionSequences.find(seq => seq.parameter === nextParam.name);
        if (nextSequence) {
            for (const step of nextSequence.steps) {
                if (step.tool === 'api_call') {
                    await this.processStep(step, '', this.state.context);
                }
            }
        }

        let question = nextParam.question;
        // Replace placeholders in the question
        const placeholders = question.match(/\{(\w+)\}/g);
        if (placeholders) {
            placeholders.forEach(placeholder => {
                const key = placeholder.slice(1, -1);
                const value = this.state.context[key] || `[${key} no encontrado]`;
                question = question.replace(placeholder, value);
            });
        }


        return { next_prompt: question, collected_params: this.state.context };
    }

    /**
     * @description Starts a new conversation and returns the first prompt.
     * @returns {Promise<object>} An object containing the first prompt.
     */
    async startConversation() {
        await this.initialize();
        // The first message from the user will determine the intent.
        // So, we just return a generic welcome message.
        return { next_prompt: "Hola, soy tu asistente virtual. ¿Cómo puedo ayudarte hoy?" };
    }
}

module.exports = ConversationOrchestrator;