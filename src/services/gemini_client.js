const { GoogleGenAI } = require("@google/genai");
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

  console.log("Enviando a Gemini:", JSON.stringify({ model: modelName, contents: fullPrompt }, null, 2));

  try {
    const response = await ai.models.generateContent({
        model: modelName,
        contents: fullPrompt,
    });

    console.log("Respuesta de Gemini (raw):", JSON.stringify(response, null, 2));

    const text = response.text;
    console.log("Texto extraído de Gemini:", text);

    // A veces, Gemini devuelve el JSON dentro de un bloque de código markdown.
    // Esta expresión regular lo extrae.
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        const parsedJson = JSON.parse(jsonMatch[1].trim());
        console.log("JSON parseado (from markdown):", parsedJson);
        return parsedJson;
    }
    const parsedJson = JSON.parse(text.trim());
    console.log("JSON parseado:", parsedJson);
    return parsedJson;
  } catch (error) {
    console.error("Error al llamar a la API de Gemini:", error);
    return null;
  }
}

module.exports = {
  extractParameter,
};
