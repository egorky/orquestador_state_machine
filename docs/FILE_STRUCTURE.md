# Estructura de Archivos

Este documento describe la estructura del proyecto y el propósito de cada archivo.

```
.
├── .env.example
├── package.json
├── Readme.md
├── demo
│   └── mock_api.js
├── docs
│   ├── ARCHITECTURE.md
│   ├── CONFIGURATION.md
│   ├── CURL_EXAMPLES.md
│   ├── FILE_STRUCTURE.md
│   ├── LIBRARIES.md
│   └── README_old.md
├── src
│   ├── config
│   │   ├── apis_config.json
│   │   ├── execution_order_config.json
│   │   ├── flows_config.json
│   │   ├── intents_config.json
│   │   ├── parameters_config.json
│   │   ├── scripts_config.json
│   │   └── validations_config.json
│   ├── lib
│   │   └── redis_client.js
│   ├── services
│   │   ├── ari_client.js
│   │   ├── gemini_client.js
│   │   └── orchestrator.js
│   └── server.js
```

## Archivos Principales

-   `.env.example`: Archivo de ejemplo para las variables de entorno. Copia este archivo a `.env` y configúralo con tus credenciales.
-   `package.json`: Define los metadatos del proyecto y las dependencias de Node.js.
-   `Readme.md`: Documentación principal del proyecto.

## Directorio `demo`

-   `mock_api.js`: Un servidor Express que simula las APIs externas necesarias para el flujo de agendamiento de citas. Es muy útil para el desarrollo y las pruebas.

## Directorio `docs`

-   Contiene toda la documentación del proyecto.

## Directorio `src`

### `src/config`

-   `apis_config.json`: Define las APIs externas que el sistema puede llamar.
-   `execution_order_config.json`: Especifica el orden de ejecución de las herramientas (API, validación, etc.) para cada parámetro.
-   `flows_config.json`: Define los diferentes flujos de conversación (por ejemplo, agendamiento, cancelación).
-   `intents_config.json`: Define las posibles intenciones del usuario y las palabras clave asociadas.
-   `parameters_config.json`: Define los parámetros que el orquestador debe recolectar.
-   `scripts_config.json`: Define scripts personalizados que se pueden ejecutar como parte del flujo.
-   `validations_config.json`: Define las reglas de validación para los datos extraídos.

### `src/lib`

-   `redis_client.js`: Cliente para interactuar con Redis. Se encarga de guardar y cargar el estado de la conversación.

### `src/services`

-   `ari_client.js`: Cliente para interactuar con Asterisk a través de ARI (Asterisk REST Interface).
-   `gemini_client.js`: Cliente para interactuar con la API de Google Gemini.
-   `orchestrator.js`: El cerebro del sistema. Gestiona el flujo de la conversación, el estado y la lógica de recolección de parámetros.

### `src/server.js`

-   Punto de entrada de la aplicación. Inicia el servidor Express para la API REST y el cliente ARI, según la configuración en el archivo `.env`.
