# Documentación de Librerías Internas

Este documento describe las librerías y módulos reutilizables que se encuentran en el directorio `src/lib`.

## 1. Cliente de Redis (`src/lib/redis_client.js`)

Este módulo encapsula toda la lógica de comunicación con la base de datos Redis. Su propósito es abstraer la gestión de la conexión y proporcionar métodos simples para guardar y cargar el estado de la conversación.

### Configuración

El cliente se configura a través de las siguientes variables de entorno en el archivo `.env`:

-   `REDIS_URL`: La URL de conexión a Redis, incluyendo el host, puerto y, si es necesario, la contraseña. Ejemplo: `redis://:password@localhost:6379`.
-   `REDIS_KEY_PREFIX`: Un prefijo que se añade a todas las claves de Redis. Esto es crucial para evitar colisiones si la misma base de datos de Redis es utilizada por múltiples aplicaciones. Ejemplo: `orchestrator:`.

### Métodos

#### `saveData(key, data)`

Guarda datos en Redis.

-   **Parámetros:**
    -   `key` (String): La clave única para los datos. En el orquestador, esto corresponde al `sessionId` de la conversación.
    -   `data` (Object): El objeto de JavaScript que se desea guardar. El objeto es serializado a una cadena JSON antes de ser almacenado.
-   **Retorna:** `Promise<void>`
-   **Uso:**
    ```javascript
    const redisClient = require('./redis_client');
    const conversationState = { current_parameter: 'city', collected: { 'id_number': '123' } };
    await redisClient.saveData('session-123', conversationState);
    ```
-   **Nota:** La clave real almacenada en Redis será `[REDIS_KEY_PREFIX][key]`, por ejemplo, `orchestrator:session-123`.

#### `loadData(key)`

Carga datos desde Redis.

-   **Parámetros:**
    -   `key` (String): La clave única de los datos que se desean recuperar (el `sessionId`).
-   **Retorna:** `Promise<Object|null>` - Un objeto de JavaScript si la clave existe, o `null` si la clave no se encuentra.
-   **Uso:**
    ```javascript
    const redisClient = require('./redis_client');
    const state = await redisClient.loadData('session-123');
    if (state) {
        console.log(state.current_parameter); // 'city'
    }
    ```
-   **Nota:** El método se encarga de parsear la cadena JSON recuperada de Redis para devolver un objeto JavaScript.
