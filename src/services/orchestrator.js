const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const redisClient = require('../lib/redis_client');
const geminiClient = require('./gemini_client');

class ConversationOrchestrator {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.state = {};
        this.parameters = null;
        this.apisConfig = null;
        this.validationsConfig = null;
        this.executionSequences = null;
        this.finalAction = null;
    }

    async initialize() {
        // Load state from Redis or create a new one
        const loadedState = await redisClient.loadData(this.sessionId);
        if (loadedState) {
            this.state = loadedState;
        } else {
            this.state = {
                collected: {},
                currentFlow: "scheduling",
                context: {},
            };
        }

        // Load JSON configurations
        const configPath = path.join(__dirname, '..', 'config');
        this.parametersConfig = JSON.parse(await fs.readFile(path.join(configPath, "parameters_config.json"), "utf8"));
        this.apisConfig = JSON.parse(await fs.readFile(path.join(configPath, "apis_config.json"), "utf8"));
        this.validationsConfig = JSON.parse(await fs.readFile(path.join(configPath, "validations_config.json"), "utf8"));
        this.executionSequences = JSON.parse(await fs.readFile(path.join(configPath, "execution_order_config.json"), "utf8")).execution_sequences;

        this.parameters = this.parametersConfig.parameters;
        this.finalAction = this.parametersConfig.final_action;
    }

    async saveState() {
        await redisClient.saveData(this.sessionId, this.state);
    }

    getNextParameter() {
        for (const param of this.parameters) {
            if (!this.state.collected.hasOwnProperty(param.name)) {
                const dependencies = param.dependencies || [];
                const dependenciesMet = dependencies.every(dep => this.state.collected.hasOwnProperty(dep));
                if (dependenciesMet) {
                    return param;
                }
            }
        }
        return null;
    }

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
                const key = rule.key;
                const value = extracted[key];

                if (!sourceData.some(item => String(item[key]) === String(value))) {
                    console.log(`Validation failed: ${rule.error_message}`);
                    return { valid: false, message: rule.error_message };
                }
            }
        }
        return { valid: true };
    }

    async callApi(apiName, inputData) {
        const api = this.apisConfig.apis.find(a => a.name === apiName);
        if (!api) {
            throw new Error(`API '${apiName}' not found in configuration.`);
        }

        try {
            const mockApiPort = process.env.MOCK_API_PORT || 3001;
            let endpoint = api.endpoint.replace("https://api.medicalsystem.com/v1", `http://localhost:${mockApiPort}`);

            const options = {
                method: api.method,
                headers: api.headers,
            };

            if (api.method === "POST") {
                options.body = JSON.stringify(inputData);
            } else if (api.method === "GET" && Object.keys(inputData).length) {
                endpoint += `?${new URLSearchParams(inputData)}`;
            }

            const response = await fetch(endpoint, options);
            if (![200, 201].includes(response.status)) {
                throw new Error(`API call failed with status ${response.status}: ${await response.text()}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${apiName} failed: ${error.message}`);
            return {};
        }
    }

    async processStep(step, response, context) {
        if (step.tool === "api_call") {
            const inputData = step.input_keys ? Object.fromEntries(
                step.input_keys.map(key => [key, this.state.collected[key]])
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
        }
        return context;
    }

    async processUserInput(response) {
        await this.initialize();

        const paramToProcess = this.getNextParameter();
        if (!paramToProcess) {
            return { final_message: "Todos los parámetros han sido recolectados. Gracias." };
        }

        let extractedData = null;
        const sequence = this.executionSequences.find(seq => seq.parameter === paramToProcess.name);

        if (sequence) {
            let context = { ...this.state.context, parameter: paramToProcess.name };

            for (const step of sequence.steps) {
                const result = await this.processStep(step, response, context);

                if (result && result.error) {
                    return { next_prompt: result.error };
                }

                if (step.tool === "ai_extract") {
                    extractedData = result;
                }
            }

            // Perform validation after AI extraction
            const validationStep = sequence.steps.find(s => s.tool === "validate");
            if (validationStep) {
                const validation = this.validationsConfig.validations.find(val => val.parameter === validationStep.validation);
                if (validation) {
                    const validationResult = await this.applyValidation(extractedData, validation.rules, context);
                    if (!validationResult.valid) {
                        return { next_prompt: validationResult.message };
                    }
                }
            }
        }

        if (extractedData) {
            // Mark the parameter as collected
            this.state.collected[paramToProcess.name] = true;
            // Add the extracted data to the context for future steps
            Object.assign(this.state.context, extractedData);
        }

        await this.saveState();

        if (this.finalAction.required_parameters.every(p => this.state.collected.hasOwnProperty(p))) {
            return { final_message: "Cita agendada exitosamente (simulado)." };
        }

        const nextParam = this.getNextParameter();
        if (!nextParam) {
            return { final_message: "Todos los parámetros han sido recolectados. Gracias." };
        }

        let question = nextParam.question;
        if (question.includes("{city_name}")) {
            question = question.replace("{city_name}", this.state.context.city_name || "la ciudad");
        }

        return { next_prompt: question, collected_params: this.state.context };
    }

    async startConversation() {
        await this.initialize();
        const nextParam = this.getNextParameter();
        if (nextParam) {
            return { next_prompt: nextParam.question };
        }
        return { final_message: "No hay parámetros por recolectar." };
    }
}

module.exports = ConversationOrchestrator;