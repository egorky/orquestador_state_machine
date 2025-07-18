import fetch from 'node-fetch';
import readline from 'readline';

// Create an interface for reading from the console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify the question method of readline
const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

const API_PORT = process.env.API_PORT || 3000;
const API_URL = `http://localhost:${API_PORT}`;

async function postToApi(endpoint, body) {
  console.log(`Enviando a: ${API_URL}${endpoint}`); // Log para depuración
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Response Body:', errorBody);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('Failed to connect to the API:', error.message);
    return null;
  }
}

async function run() {
  console.log('--- Iniciando Prueba Interactiva ---');
  const sessionId = `interactive-session-${Date.now()}`;
  console.log(`ID de Sesión: ${sessionId}\n`);

  // 1. Iniciar la conversación
  let response = await postToApi('/start_conversation', { sessionId });

  if (!response) {
    rl.close();
    return;
  }

  // Bucle principal de la conversación
  while (response && response.next_prompt) {
    console.log('\n----------------------------------');
    console.log(`Asistente: ${response.next_prompt}`);
    console.log(`(Parámetros recolectados: ${JSON.stringify(response.collected_params)})`);

    const userInput = await question('Tu Respuesta: ');

    response = await postToApi('/conversation', { sessionId, userInput });
  }

  // Mensaje final
  if (response && response.final_message) {
    console.log('\n----------------------------------');
    console.log(`Asistente: ${response.final_message}`);
    console.log(`(Parámetros finales: ${JSON.stringify(response.collected_params)})`);
  } else {
    console.log('\n--- La conversación terminó de forma inesperada ---');
  }

  rl.close();
}

run();
