const { GoogleGenAI } = require("@google/genai");
const logger = require('../lib/logger');
require('dotenv').config();

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

/**
 * @description Replaces dynamic placeholders in a string with their actual values.
 * @param {string} text - The string containing placeholders.
 * @returns {string} The string with placeholders replaced.
 */
function replaceDynamicPlaceholders(text) {
    return text.replace(/{{CURRENT_DATETIME}}/g, new Date().toISOString());
}

/**
 * @description Extracts a parameter from a user's response using the Gemini API.
 * @param {string} prompt - The prompt to guide the AI.
 * @param {string} textToAnalyze - The user's text to be analyzed.
 * @param {object} [context={}] - Additional context to provide to the AI.
 * @returns {Promise<object|null>} The extracted parameter as a JSON object, or null if an error occurs.
 */
async function extractParameter(prompt, textToAnalyze, context = {}) {

  const processedPrompt = replaceDynamicPlaceholders(prompt);

  const fullPrompt = `
    ${processedPrompt}

    Texto a analizar: "${textToAnalyze}"

    Contexto adicional: ${JSON.stringify(context)}

    Responde únicamente con un objeto JSON.
  `;

  logger.debug(`Enviando a Gemini: ${fullPrompt}`);

  try {
    const result = await ai.getGenerativeModel({ model: modelName }).generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    logger.debug(`Respuesta de Gemini (raw): ${text}`);

    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    let parsedJson;
    if (jsonMatch && jsonMatch[1]) {
        parsedJson = JSON.parse(jsonMatch[1].trim());
    } else {
        parsedJson = JSON.parse(text.trim());
    }
    logger.debug(`JSON parseado: ${JSON.stringify(parsedJson)}`);
    return parsedJson;
  } catch (error) {
    logger.error(`Error al llamar a la API de Gemini: ${error.message}`);
    return null;
  }
}

module.exports = {
  extractParameter,
};
