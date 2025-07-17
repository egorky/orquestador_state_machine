# Orquestador de Conversaciones Inteligente

Este proyecto implementa un orquestador de conversaciones inteligente capaz de guiar a un usuario a través de un flujo predefinido, como agendar una cita médica. El orquestador se integra con la API de Google Gemini para el procesamiento de lenguaje natural, utiliza Redis para mantener el estado de la conversación y puede ser expuesto como una API REST o un cliente ARI para Asterisk.

## Características

- **Flujo de Conversación Configurable**: El flujo de la conversación, los parámetros a recolectar y las herramientas a utilizar se definen en archivos JSON, lo que permite una fácil personalización.
- **Integración con Google Gemini**: Utiliza el modelo Gemini para extraer información relevante de las respuestas del usuario.
- **Persistencia de Estado con Redis**: Guarda el estado de cada conversación en Redis, permitiendo que el sistema sea escalable y sin estado.
- **Exposición Dual (API/ARI)**: Puede funcionar como un servidor API REST o como un cliente ARI para integrarse con una central telefónica Asterisk.
- **API Simulada para Pruebas**: Incluye una API simulada para probar el flujo de conversación sin necesidad de servicios externos reales.

## Estructura del Proyecto

```
.
├── .env.example
├── package.json
├── Readme.md
├── src
│   ├── config
│   │   ├── apis_config.json
│   │   ├── execution_order_config.json
│   │   ├── parameters_config.json
│   │   └── validations_config.json
│   ├── lib
│   │   └── redis_client.js
│   ├── services
│   │   ├── ari_client.js
│   │   ├── gemini_client.js
│   │   └── orchestrator.js
│   ├── mock_api.js
│   └── server.js
└── docs
    ├── genai.md
    ├── genaijs.txt
    └── README_old.md
```

## Instalación

1.  Clona el repositorio:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  Instala las dependencias:
    ```bash
    npm install
    ```

3.  Crea un archivo `.env` a partir del ejemplo y configúralo con tus credenciales:
    ```bash
    cp .env.example .env
    ```
    Edita el archivo `.env` con tu clave de API de Google Gemini y la configuración de Redis, API y ARI.

## Uso

### Ejecutar el Servidor Principal

Para iniciar el servidor (que a su vez puede levantar la API, el cliente ARI y la API simulada, según la configuración en `.env`):

```bash
npm start
```

### Ejecutar la API Simulada de forma independiente

Si deseas ejecutar solo la API simulada para pruebas:

```bash
npm run mock:api
```

### Probar con `curl`

Puedes probar la API del orquestador utilizando `curl`.

1.  **Iniciar una conversación**:
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123"}' http://localhost:3000/start_conversation
    ```
    Esto devolverá la primera pregunta del flujo.

2.  **Enviar la respuesta del usuario**:
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123", "userInput": "Mi cédula es 0987654321"}' http://localhost:3000/conversation
    ```
    Esto procesará la respuesta y devolverá la siguiente pregunta o el resultado final.

## Configuración

-   **`src/config/parameters_config.json`**: Define los parámetros que el orquestador debe recolectar.
-   **`src/config/apis_config.json`**: Define las APIs externas que el sistema puede llamar.
-   **`src/config/execution_order_config.json`**: Especifica el orden de ejecución de las herramientas (API, IA, validación) para cada parámetro.
-   **`src/config/validations_config.json`**: Define las reglas de validación para los datos extraídos.
