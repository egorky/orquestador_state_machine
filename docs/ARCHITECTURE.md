# Arquitectura del Sistema

Este documento describe la arquitectura del Orquestador de Conversaciones, un sistema diseñado para gestionar diálogos interactivos a través de múltiples canales como API REST y Asterisk (ARI).

## Componentes Principales

El sistema se compone de los siguientes componentes principales:

1.  **Servidor Principal (`server.js`)**: Es el punto de entrada de la aplicación. Se encarga de:
    *   Cargar la configuración del entorno desde el archivo `.env`.
    *   Iniciar el servidor de API REST (basado en Express) si está habilitado (`API_ENABLED=true`).
    *   Iniciar el cliente ARI (Asterisk REST Interface) si está habilitado (`ARI_ENABLED=true`).
    *   Iniciar un servidor de API mock para pruebas si está habilitado (`MOCK_API_ENABLED=true`).

2.  **Orquestador de Conversación (`orchestrator.js`)**: Es el cerebro del sistema. Cada conversación (ya sea por API o ARI) crea una nueva instancia del orquestador. Sus responsabilidades son:
    *   **Gestión de Estado**: Carga y guarda el estado de la conversación en Redis, utilizando un `sessionId` único para cada diálogo. El estado incluye los parámetros ya recolectados, el flujo actual y cualquier dato de contexto relevante.
    *   **Motor de Flujo**: Sigue la lógica definida en los archivos de configuración para determinar qué parámetro solicitar a continuación.
    *   **Ejecución de Pasos**: Orquesta la ejecución de una secuencia de pasos (`pre_ask_steps` y `post_ask_steps`) para cada parámetro. Estos pasos pueden incluir llamadas a APIs externas, ejecución de scripts de transformación de datos o llamadas a la IA de Gemini.
    *   **Detección de Intención**: Utiliza Gemini para determinar la intención inicial del usuario (por ejemplo, agendar o cancelar una cita).

3.  **Cliente de API REST (`server.js`)**: Expone dos endpoints principales:
    *   `POST /start_conversation`: Inicia una nueva conversación y devuelve la primera pregunta.
    *   `POST /conversation`: Procesa la respuesta del usuario y devuelve la siguiente pregunta o un mensaje final.

4.  **Cliente ARI (`ari_client.js`)**: Se conecta a Asterisk y maneja las llamadas entrantes.
    *   **Manejo de Llamadas**: Responde a las llamadas entrantes y las coloca en una aplicación Stasis.
    *   **Interacción con Dialplan**: Se comunica con el dialplan de Asterisk a través de variables de canal para reproducir mensajes (TTS) y recibir la entrada del usuario (STT).
    *   **Ciclo de Conversación**: Gestiona el bucle de pregunta-respuesta con el orquestador hasta que la conversación finaliza.

5.  **Cliente de Gemini (`gemini_client.js`)**: Abstrae la comunicación con la API de Google Gemini.
    *   **Extracción de Parámetros**: Envía prompts a Gemini para extraer información estructurada (en formato JSON) del texto no estructurado del usuario.

6.  **Cliente de Redis (`redis_client.js`)**: Gestiona la conexión y las operaciones con la base de datos Redis.
    *   **Persistencia**: Guarda y recupera el estado de la conversación, asegurando que los diálogos puedan ser largos y resilientes a reinicios del sistema.

7.  **Archivos de Configuración (`src/config/`)**: Una serie de archivos JSON que definen el comportamiento del orquestador de forma declarativa, permitiendo modificar los flujos de conversación sin cambiar el código.

## Flujo de una Conversación (Ejemplo)

1.  **Inicio**: Una solicitud llega a través de la API o una llamada entra en Asterisk. Se crea una instancia del `ConversationOrchestrator` con un `sessionId` único.
2.  **Detección de Intención**: El orquestador pide al usuario su intención ("¿Cómo puedo ayudarte?"). La respuesta se envía a Gemini para clasificar la intención (ej. "agendamiento").
3.  **Bucle de Parámetros**: El orquestador entra en un bucle para recolectar los parámetros definidos en el flujo de configuración. Para cada parámetro:
    a.  **Pasos Previos (`pre_ask_steps`)**: El orquestador ejecuta los pasos previos. Esto puede implicar llamar a una API para obtener una lista de opciones (ej. una lista de ciudades). El resultado se guarda en el contexto de la conversación.
    b.  **Formulación de la Pregunta**: Se construye la pregunta, posiblemente utilizando datos del contexto (ej. "¿En qué ciudad desea su cita? Tenemos disponibles en: Guayaquil, Quito...").
    c.  **Envío al Usuario**: La pregunta se envía al usuario a través del canal correspondiente (respuesta API o TTS en Asterisk).
    d.  **Recepción de la Respuesta**: El sistema espera la respuesta del usuario (entrada de texto en la API o STT en Asterisk).
    e.  **Pasos Posteriores (`post_ask_steps`)**: La respuesta del usuario se procesa a través de los pasos posteriores. Típicamente, esto implica:
        i.  **Llamada a IA**: La respuesta se envía a Gemini junto con el contexto relevante (ej. la lista de ciudades obtenida anteriormente) para extraer el valor del parámetro (ej. el `city_id`).
        ii. **Validación y Almacenamiento**: El valor extraído se valida y se guarda en el estado de la conversación en Redis.
4.  **Finalización**: Una vez que todos los parámetros del flujo han sido recolectados, el orquestador puede ejecutar una acción final (como llamar a una API para crear la cita) y enviar un mensaje de confirmación al usuario. La conversación termina.
