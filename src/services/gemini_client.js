const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

async function extractParameter(prompt, textToAnalyze, context = {}) {

  const fullPrompt = `
    ${prompt}

    Texto a analizar: "${textToAnalyze}"

    Contexto adicional: ${JSON.stringify(context)}

    Responde únicamente con un objeto JSON.
  `;

  console.log("Enviando a Gemini:", JSON.stringify({ model: "gemini-1.5-flash", contents: fullPrompt }, null, 2));

  try {
    const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
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
