const fs = require('fs').promises;
const fetch = require('node-fetch');

class ConversationOrchestrator {
    constructor() {
        this.state = {
            collected: {}, // Stores validated parameters
            currentFlow: "scheduling",
            context: {} // Temporary data (e.g., API results)
        };
        this.parameters = null;
        this.apisConfig = null;
        this.validationsConfig = null;
        this.executionSequences = null;
        this.finalAction = null;
    }

    async initialize() {
        // Load JSON configurations
        this.parametersConfig = JSON.parse(await fs.readFile("parameters_config.json", "utf8"));
        this.apisConfig = JSON.parse(await fs.readFile("apis_config.json", "utf8"));
        this.validationsConfig = JSON.parse(await fs.readFile("validations_config.json", "utf8"));
        this.executionSequences = JSON.parse(await fs.readFile("execution_order_config.json", "utf8"));

        this.parameters = this.parametersConfig.parameters;
        this.finalAction = this.parametersConfig.final_action;
    }

    getNextParameter() {
        // Find the next parameter that hasn't been collected and has all dependencies met
        for (const param of this.parameters) {
            if (!(param.name in this.state.collected)) {
                const dependenciesMet = param.dependencies.every(dep => dep in this.state.collected);
                if (dependenciesMet) {
                    return param;
                }
            }
        }
        return null;
    }

    async applyValidation(extracted, rules, context) {
        // Apply validation rules to extracted data
        for (const rule of rules) {
            if (rule.type === "regex") {
                const value = Object.values(extracted)[0];
                if (!new RegExp(rule.pattern).test(String(value))) {
                    console.log(`Validation failed: ${rule.error_message}`);
                    return { valid: false, message: rule.error_message };
                }
            } else if (rule.type === "in_list") {
                const sourceData = context[rule.source] || [];
                const key = rule.key;
                const value = extracted[key];
                if (!sourceData.some(item => item[key] === value)) {
                    console.log(`Validation failed: ${rule.error_message}`);
                    return { valid: false, message: rule.error_message };
                }
            }
        }
        return { valid: true };
    }

    async aiExtractParameter(response, context, prompt) {
        // Call Google Gemini API for NLP
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Set in environment variables
        const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

        try {
            const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${prompt}\nUser response: ${response}\nContext: ${JSON.stringify(context)}`
                        }]
                    }],
                    generationConfig: {
                        maxOutputTokens: 100,
                        temperature: 0.7
                    }
                })
            });

            const data = await res.json();
            if (data.candidates && data.candidates[0].content) {
                const extracted = JSON.parse(data.candidates[0].content.parts[0].text.trim());
                return extracted || null;
            }
            return null;
        } catch (error) {
            console.error(`Gemini API error: ${error.message}`);
            return null;
        }
    }

    async callApi(endpoint, method, parameters, headers) {
        try {
            // Map placeholder endpoints to local mock API
            const mockEndpoint = endpoint.replace("https://api.medicalsystem.com/v1", "http://localhost:3000");
            const options = { method, headers };
            if (method === "POST") options.body = JSON.stringify(parameters);
            else if (method === "GET" && Object.keys(parameters).length) {
                mockEndpoint += `?${new URLSearchParams(parameters)}`;
            }
            const response = await fetch(mockEndpoint, options);
            if (![200, 201].includes(response.status)) {
                throw new Error(`API call failed: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed: ${error.message}`);
            return {};
        }
    }

    async validateResponse(param, response) {
        // Validate the user's response using the execution sequence
        const sequence = this.executionSequences.find(seq => seq.parameter === param.name);
        if (!sequence) return null;

        let context = { ...this.state.context, parameter: param.name };
        let extracted = null;

        for (const step of sequence.steps) {
            if (step.tool === "api_call") {
                const api = this.apisConfig.apis.find(api => api.name === step.api);
                const inputData = step.input_keys ? Object.fromEntries(
                    step.input_keys.map(key => [key, this.state.collected[key]])
                ) : {};
                const result = await this.callApi(api.endpoint, api.method, inputData, api.headers);
                context[step.output_key] = result;
            } else if (step.tool === "ai_extract") {
                extracted = await this.aiExtractParameter(response, context, step.prompt);
                if (!extracted) return null;
            } else if (step.tool === "validate") {
                const validation = this.validationsConfig.validations.find(val => val.parameter === step.validation);
                const validationResult = await this.applyValidation(extracted, validation.rules, context);
                if (!validationResult.valid) {
                    return { error: validationResult.message };
                }
            }
        }

        this.state.context = context; // Update context with API results
        return extracted;
    }

    async processFinalAction() {
        // Execute the final action (e.g., create appointment)
        const sequence = this.executionSequences.find(seq => seq.parameter === "final_action");
        for (const step of sequence.steps) {
            if (step.tool === "api_call") {
                const api = this.apisConfig.apis.find(api => api.name === step.api);
                const inputData = Object.fromEntries(
                    step.input_keys.map(key => [key, this.state.collected[key]])
                );
                const result = await this.callApi(api.endpoint, api.method, inputData, api.headers);
                return `Appointment created successfully! Appointment ID: ${result.appointmentId}`;
            }
        }
        return "Error: Final action failed.";
    }

    async processUserInput(response) {
        // Process the user's response and return the next question or action
        const extractedIntent = await this.aiExtractParameter(response, { parameter: "intent" }, "Check if the user wants to transfer to a human agent.");
        if (extractedIntent && extractedIntent.intent === "transfer_to_human") {
            this.state.collected = {};
            this.state.currentFlow = "transfer_to_human";
            return "Transferring you to a human agent. Please wait.";
        }

        if (this.state.currentFlow === "transfer_to_human") {
            return "You are in the process of being transferred to a human agent.";
        }

        // Try to extract any parameter from the response
        for (const param of this.parameters) {
            const result = await this.validateResponse(param, response);
            if (result && result.error) {
                return result.error; // Return validation error to user
            } else if (result) {
                Object.assign(this.state.collected, result);
                break;
            }
        }

        // Check if all parameters are collected
        if (this.finalAction.required_parameters.every(param => param in this.state.collected)) {
            return await this.processFinalAction();
        }

        // Get the next parameter to ask about
        const nextParam = this.getNextParameter();
        if (!nextParam) {
            return "All parameters collected, but something went wrong. Please try again.";
        }

        // Prepare the next question
        let question = nextParam.question;
        if (question.includes("{city_name}")) {
            question = question.replace("{city_name}", this.state.collected.city_name || "the city");
        }
        if (question.includes("{available_times}")) {
            const times = this.state.context.available_times || [];
            question = question.replace("{available_times}", times.join(", ") || "available times");
        }
        return question;
    }

    async startConversation() {
        // Start the conversation by asking the first question
        await this.initialize();
        this.state.collected = {};
        this.state.currentFlow = "scheduling";
        const nextParam = this.getNextParameter();
        if (nextParam) {
            return nextParam.question;
        }
        return "Error: No parameters defined.";
    }
}

// Example usage (simulated API endpoint)
async function handleConversationRequest(userInput, orchestrator) {
    return await orchestrator.processUserInput(userInput);
}

// Simulated conversation loop
async function main() {
    const orchestrator = new ConversationOrchestrator();
    console.log(await orchestrator.startConversation());
    // Simulated user inputs
    const inputs = [
        "My ID is 12345678", // Valid ID number
        "I want to schedule in New York", // City
        "Downtown Clinic", // Branch
        "2025-07-15 10:00", // Date and time
        "Transfer to human", // Intent to transfer
        "Chicago" // Ignored due to transfer
    ];
    for (const userInput of inputs) {
        console.log(`User: ${userInput}`);
        const response = await handleConversationRequest(userInput, orchestrator);
        console.log(`Bot: ${response}`);
    }
}

main().catch(console.error);