# Documentación de Servicios

Este documento detalla la funcionalidad de cada servicio dentro del directorio `src/services`.

## `orchestrator.js`

Este es el servicio principal que gestiona la lógica de la conversación.

### `ConversationOrchestrator`

#### `constructor(sessionId, initialContext = {})`
Inicializa el orquestador con un ID de sesión y un contexto inicial.

#### `async initialize()`
Carga el estado de la conversación desde Redis o crea un nuevo estado si no existe. También carga todos los archivos de configuración.

#### `async saveState()`
Guarda el estado actual de la conversación en Redis.

#### `async runScript(scriptName, context)`
Ejecuta un script definido en `scripts_config.json`.

#### `async handleApiAuth(apiConfig)`
Maneja la autenticación para una llamada a la API. Comprueba si se necesita un token, si hay uno válido en caché, o si necesita obtener uno nuevo.

#### `async callApi(apiName, inputData)`
Realiza una llamada a una API definida en `apis_config.json`. Utiliza `handleApiAuth` para gestionar la autenticación.

#### `async executeStep(step, userInput)`
Ejecuta un único paso en el flujo de la conversación, que puede ser una llamada a la API, la ejecución de un script o una llamada a la IA de Gemini.

#### `invalidateDependentParams(changedParam)`
Invalida los parámetros que dependen del que se acaba de cambiar.

#### `async processUserInput(userInput)`
Procesa la entrada del usuario. Este es el punto de entrada principal para cada turno de la conversación. Detecta la intención, extrae parámetros y gestiona los cambios de flujo.

#### `async prepareNextQuestion()`
Prepara la siguiente pregunta para el usuario, incluyendo la gestión de mensajes de error para entradas no válidas.

#### `moveToNextParameter()`
Avanza al siguiente parámetro en el flujo de la conversación.

#### `async detectIntent(userInput)`
Utiliza Gemini para detectar la intención del usuario al principio de la conversación.

#### `async startConversation()`
Inicia una nueva conversación, estableciendo el estado inicial.

## `ari_client.js`

Este servicio gestiona la conexión con Asterisk a través de ARI (Asterisk REST Interface).

### `waitForChannelVar(channel, varName)`
Es una función de ayuda que espera a que una variable de canal específica se establezca en Asterisk.

### `async handleStasisStart(event, channel)`
El manejador de eventos principal para nuevas llamadas. Se activa cuando una nueva llamada entra en la aplicación Stasis. Gestiona todo el ciclo de vida de la llamada, desde la respuesta hasta el final.

### `async start()`
Inicia el cliente ARI, se conecta a Asterisk y registra el manejador de eventos `StasisStart`.

## `gemini_client.js`

Este servicio es un cliente para la API de Google Gemini.

### `async extractParameter(prompt, userInput, context)`
Envía un prompt a Gemini y devuelve la respuesta en formato JSON. Se utiliza para la detección de intenciones y la extracción de parámetros.
