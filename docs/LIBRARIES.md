# Documentación de Librerías

Este documento explica las funciones de las librerías principales del sistema.

## Orquestador (`src/services/orchestrator.js`)

Esta es la clase principal que gestiona la lógica de la conversación.

### `initialize()`

-   **Propósito**: Inicializa el orquestador.
-   **Descripción**: Carga el estado de la conversación desde Redis (si existe) y carga todos los archivos de configuración JSON.
-   **Parámetros**: Ninguno.
-   **Retorna**: `Promise<void>`

### `saveState()`

-   **Propósito**: Guarda el estado de la conversación.
-   **Descripción**: Guarda el objeto `this.state` en Redis, utilizando el `sessionId` como clave.
-   **Parámetros**: Ninguno.
-   **Retorna**: `Promise<void>`

### `detectIntent(userInput)`

-   **Propósito**: Detecta la intención del usuario.
-   **Descripción**: Envía el input del usuario a Gemini con un prompt específico para la detección de intención.
-   **Parámetros**:
    -   `userInput` (string): El texto introducido por el usuario.
-   **Retorna**: `Promise<string|null>` - El nombre de la intención detectada o `null`.

### `extractAllParameters(userInput)`

-   **Propósito**: Extrae todos los parámetros posibles de la respuesta del usuario.
-   **Descripción**: Envía el input del usuario a Gemini con un prompt dinámico que le pide que extraiga cualquier parámetro que aún no se haya recolectado.
-   **Parámetros**:
    -   `userInput` (string): El texto introducido por el usuario.
-   **Retorna**: `Promise<object|null>` - Un objeto con los parámetros extraídos o `null`.

### `processUserInput(response)`

-   **Propósito**: Procesa la respuesta del usuario.
-   **Descripción**: Este es el método principal que orquesta el turno de la conversación. Detecta la intención (si es necesario), extrae todos los parámetros posibles, actualiza el estado y determina la siguiente pregunta.
-   **Parámetros**:
    -   `response` (string): El texto introducido por el usuario.
-   **Retorna**: `Promise<object>` - Un objeto con la siguiente pregunta (`next_prompt`) o el mensaje final (`final_message`).

### `startConversation()`

-   **Propósito**: Inicia una nueva conversación.
-   **Descripción**: Devuelve un mensaje de bienvenida genérico. La detección de la intención y la primera pregunta se manejan en la primera llamada a `processUserInput`.
-   **Parámetros**: Ninguno.
-   **Retorna**: `Promise<object>` - Un objeto con el mensaje de bienvenida.

## Cliente de Gemini (`src/services/gemini_client.js`)

### `extractParameter(prompt, textToAnalyze, context)`

-   **Propósito**: Extrae información de un texto utilizando Gemini.
-   **Descripción**: Envía un prompt, el texto a analizar y un contexto adicional a la API de Gemini. Parsea la respuesta para devolver un objeto JSON.
-   **Parámetros**:
    -   `prompt` (string): El prompt que guía a la IA.
    -   `textToAnalyze` (string): El texto del usuario.
    -   `context` (object, opcional): Contexto adicional.
-   **Retorna**: `Promise<object|null>` - El objeto JSON extraído o `null`.

## Cliente de Redis (`src/lib/redis_client.js`)

### `saveData(key, data)`

-   **Propósito**: Guarda datos en Redis.
-   **Descripción**: Serializa y guarda un objeto en Redis con una clave específica.
-   **Parámetros**:
    -   `key` (string): La clave para guardar los datos.
    -   `data` (object): El objeto a guardar.
-   **Retorna**: `Promise<void>`

### `loadData(key)`

-   **Propósito**: Carga datos desde Redis.
-   **Descripción**: Carga y deserializa un objeto desde Redis usando una clave específica.
-   **Parámetros**:
    -   `key` (string): La clave de los datos a cargar.
-   **Retorna**: `Promise<object|null>` - El objeto cargado o `null` si no se encuentra.
