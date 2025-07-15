const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

async function extractParameter(prompt, textToAnalyze, context = {}) {
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  const fullPrompt = `
    ${prompt}

    Texto a analizar: "${textToAnalyze}"

    Contexto adicional: ${JSON.stringify(context)}

    Responde únicamente con un objeto JSON.
  `;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    // A veces, Gemini devuelve el JSON dentro de un bloque de código markdown.
    // Esta expresión regular lo extrae.
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1].trim());
    }
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Error al llamar a la API de Gemini:", error);
    return null;
  }
}

module.exports = {
  extractParameter,
};
