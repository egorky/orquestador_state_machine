# Estructura de Archivos

Este documento detalla la estructura de archivos y directorios del proyecto del Orquestador de Conversaciones.

```
.
├── .env.example        # Plantilla para variables de entorno
├── .gitignore          # Archivos y directorios ignorados por Git
├── Readme.md           # Documentación principal del proyecto
├── demo/
│   └── mock_api.js     # Servidor de API simulada para pruebas
├── docs/               # Directorio para toda la documentación
│   ├── ARCHITECTURE.md # Descripción de la arquitectura del sistema
│   ├── CONFIGURATION.md# Guía de los archivos de configuración
│   ├── FILE_STRUCTURE.md# Este archivo
│   ├── LIBRARIES.md    # Documentación de las librerías internas
│   └── USAGE.md        # Cómo usar la API y el cliente ARI
├── package.json        # Dependencias y scripts del proyecto
├── src/                # Código fuente de la aplicación
│   ├── config/         # Archivos de configuración JSON
│   │   ├── apis_config.json
│   │   ├── flows_config.json
│   │   ├── intents_config.json
│   │   ├── parameters_config.json
│   │   ├── scripts_config.json
│   │   └── validations_config.json
│   ├── lib/            # Librerías reutilizables
│   │   └── redis_client.js
│   ├── services/       # Lógica de negocio y clientes de servicios
│   │   ├── ari_client.js
│   │   ├── gemini_client.js
│   │   └── orchestrator.js
│   └── server.js       # Punto de entrada de la aplicación
└── test_scripts/       # Scripts de prueba para diferentes escenarios
    ├── escenario_1_agendamiento_ordenado.sh
    ├── escenario_2_agendamiento_desordenado.sh
    └── escenario_3_cambio_de_flujo.sh
```

## Descripción de Archivos y Directorios Clave

### Directorio Raíz

-   `.env.example`: Una plantilla que debe ser copiada a `.env` y llenada con los valores correspondientes (claves de API, URLs, etc.).
-   `package.json`: Define los metadatos del proyecto, las dependencias de Node.js y los scripts de ejecución (como `start`, `dev`).
-   `Readme.md`: La guía principal para empezar a usar el proyecto.

### `demo/`

-   `mock_api.js`: Un simple servidor Express que simula las APIs externas que el orquestador necesita consumir (ej. para obtener listas de ciudades, sucursales, etc.). Es muy útil para el desarrollo y las pruebas sin depender de los servicios reales.

### `docs/`

-   Contiene toda la documentación del proyecto, incluyendo este mismo archivo.

### `src/`

-   **`server.js`**: El punto de entrada principal. Inicia los servidores API y/o ARI según la configuración en `.env`.
-   **`config/`**: Contiene todos los archivos de configuración en formato JSON. Estos archivos definen el comportamiento de los flujos de conversación de manera declarativa.
    -   `apis_config.json`: Define las APIs externas que el sistema puede llamar.
    -   `flows_config.json`: Define los diferentes flujos de conversación (ej. agendamiento, cancelación) y el orden de los parámetros en cada uno.
    -   `intents_config.json`: Define las posibles intenciones del usuario y palabras clave asociadas.
    -   `parameters_config.json`: El corazón de la configuración. Define cada parámetro, la pregunta para solicitarlo, y los pasos a ejecutar antes (`pre_ask_steps`) y después (`post_ask_steps`) de solicitarlo.
    -   `scripts_config.json`: Contiene pequeños scripts de JavaScript para la transformación de datos.
    -   `validations_config.json`: Define las reglas de validación para los datos recolectados.
-   **`lib/`**: Librerías de bajo nivel.
    -   `redis_client.js`: Abstrae la conexión y la comunicación con la base de datos Redis.
-   **`services/`**: Contiene la lógica de negocio principal.
    -   `orchestrator.js`: El orquestador de la conversación. Gestiona el estado y el flujo del diálogo.
    -   `gemini_client.js`: Cliente para interactuar con la API de Google Gemini.
    -   `ari_client.js`: Cliente para interactuar con la Asterisk REST Interface (ARI).

### `test_scripts/`

-   Contiene scripts de shell (`.sh`) que simulan conversaciones completas a través de la API, utilizando `curl`. Son útiles para realizar pruebas de integración y verificar que los flujos funcionan como se espera.
