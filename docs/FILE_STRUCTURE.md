# Estructura de Archivos

Este documento describe la estructura del proyecto y el propósito de cada archivo.

```
.
├── .env.example
├── .gitignore
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
└── test_scripts
    ├── escenario_1_agendamiento_ordenado.sh
    ├── escenario_2_agendamiento_desordenado.sh
    └── escenario_3_cambio_de_flujo.sh
```

## Archivos Principales

-   `.env.example`: Archivo de ejemplo para las variables de entorno.
-   `.gitignore`: Especifica los archivos que Git debe ignorar.
-   `package.json`: Define los metadatos del proyecto y las dependencias.
-   `Readme.md`: Documentación principal del proyecto.

## Directorios

-   `demo`: Contiene la API simulada para pruebas.
-   `docs`: Contiene toda la documentación del proyecto.
-   `src`: Contiene el código fuente de la aplicación.
-   `test_scripts`: Contiene scripts de prueba ejecutables para simular diferentes escenarios.

### `src/config`

-   Contiene todos los archivos de configuración JSON que definen el comportamiento del orquestador.

### `src/lib`

-   Contiene las librerías de bajo nivel, como el cliente de Redis.

### `src/services`

-   Contiene los servicios principales de la aplicación, como el orquestador y los clientes de API.
