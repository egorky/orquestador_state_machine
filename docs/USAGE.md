# Guía de Uso

Este documento explica cómo interactuar con el Orquestador de Conversaciones a través de sus dos interfaces principales: la API REST y el cliente ARI para Asterisk.

## 1. Uso de la API REST

La API REST es ideal para integraciones con aplicaciones web, chatbots de texto u otros servicios que puedan comunicarse vía HTTP.

### Requisitos Previos

-   Asegúrese de que `API_ENABLED=true` en su archivo `.env`.
-   Inicie el servidor con `npm start`.

### Endpoints

#### `POST /start_conversation`

Inicia una nueva conversación. Es útil cuando se desea que el asistente inicie el diálogo.

-   **Body (JSON):**
    ```json
    {
        "sessionId": "una-id-unica-de-sesion"
    }
    ```
-   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "next_prompt": "Hola, soy tu asistente virtual. ¿Cómo puedo ayudarte hoy?",
        "collected_params": {}
    }
    ```

#### `POST /conversation`

Procesa la entrada del usuario y avanza en el flujo de la conversación.

-   **Body (JSON):**
    ```json
    {
        "sessionId": "la-misma-id-unica-de-sesion",
        "userInput": "Quiero agendar una cita"
    }
    ```
-   **Respuesta Exitosa (200 OK):**
    -   Si se necesita el siguiente parámetro:
        ```json
        {
            "next_prompt": "Por favor, deme su número de identificación.",
            "collected_params": {
                "intent": "scheduling"
            }
        }
        ```
    -   Si la conversación ha terminado:
        ```json
        {
            "final_message": "Todos los parámetros han sido recolectados. Gracias.",
            "collected_params": { ... }
        }
        ```

### Ejemplo de Flujo con `curl`

1.  **Iniciar la conversación:**
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{
      "sessionId": "test-session-123"
    }' http://localhost:3000/start_conversation
    ```

2.  **Responder a la primera pregunta (detectar intención):**
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{
      "sessionId": "test-session-123",
      "userInput": "Quiero reservar una cita médica"
    }' http://localhost:3000/conversation
    ```

3.  **Proporcionar el número de identificación:**
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{
      "sessionId": "test-session-123",
      "userInput": "Mi cédula es 0987654321"
    }' http://localhost:3000/conversation
    ```
    ... y así sucesivamente.

## 2. Uso con Asterisk (ARI)

La integración con ARI permite al orquestador manejar conversaciones telefónicas. El sistema está diseñado para interactuar con un dialplan de Asterisk que maneje la reproducción de audio (Text-To-Speech, TTS) y el reconocimiento de voz (Speech-To-Text, STT).

### Requisitos Previos

-   Asegúrese de que `ARI_ENABLED=true` en su archivo `.env`.
-   Configure las credenciales de ARI (`ARI_URL`, `ARI_USERNAME`, `ARI_PASSWORD`).
-   Configure una aplicación Stasis en `ari.conf` y `extensions.conf` en su servidor de Asterisk. El nombre de la aplicación debe coincidir con `ARI_APP_NAME` en su archivo `.env`.

### Flujo de Interacción Dialplan <-> Orquestador

El orquestador y el dialplan de Asterisk se comunican a través de **variables de canal**.

1.  **Llamada Entrante**: El dialplan de Asterisk recibe una llamada y la dirige a la aplicación Stasis registrada por el orquestador. `same => n,Stasis(conversation-orchestrator)`

2.  **Inicio de la Conversación**: El `ari_client.js` recibe el evento `StasisStart`, responde la llamada e inicia el orquestador.

3.  **Bucle de Conversación**:
    a.  **Orquestador -> Dialplan**: El orquestador establece la variable de canal `RESPONSE_TEXT` con la pregunta que se debe formular al usuario.
        -   `RESPONSE_TEXT`: "Por favor, deme su número de identificación."
    b.  **Orquestador -> Dialplan**: El orquestador establece la variable `ORCHESTRATOR_READY` a `1` para indicar que está esperando la entrada del usuario.
    c.  **Dialplan**: El dialplan debe estar en un bucle, esperando a que `ORCHESTRATOR_READY` sea `1`. Cuando lo es, lee el contenido de `RESPONSE_TEXT` y lo reproduce al usuario usando una aplicación de TTS (como UniMRCP, Google TTS, etc.).
    d.  **Dialplan**: Inmediatamente después de reproducir el audio, el dialplan debe usar una aplicación de STT para escuchar la respuesta del usuario y transcribirla a texto.
    e.  **Dialplan -> Orquestador**: El dialplan establece la variable de canal `USER_INPUT` con el texto transcrito de la respuesta del usuario.
    f.  **Orquestador**: El `ari_client.js` ha estado esperando a que la variable `USER_INPUT` se establezca. Cuando la detecta, la lee, la envía al `orchestrator.js` para ser procesada y el ciclo comienza de nuevo.

4.  **Fin de la Conversación**:
    a.  **Orquestador -> Dialplan**: Cuando la conversación termina, el orquestador establece el `final_message` en la variable `RESPONSE_TEXT` y adicionalmente establece la variable `CONVERSATION_DONE` a `1`.
    b.  **Dialplan**: El dialplan detecta que `CONVERSATION_DONE` es `1`, reproduce el mensaje final y cuelga la llamada.

### Ejemplo de Dialplan (extensions.conf)

Este es un ejemplo simplificado de cómo podría ser la lógica en el dialplan. La implementación real dependerá de las aplicaciones de TTS/STT que utilice.

```
[contexto-orquestador]
exten => s,1,NoOp(Iniciando llamada con el orquestador)
    ; Iniciar la aplicación Stasis que escucha nuestro cliente ARI
    same => n,Stasis(conversation-orchestrator)
    same => n,NoOp(La aplicación Stasis ha tomado el control)

    ; Bucle principal para la interacción TTS/STT
    same => n,Set(LOOP_COUNT=0)
    same => n,While($[${LOOP_COUNT} < 10]) ; Evitar bucles infinitos
        ; Esperar a que el orquestador esté listo
        same => n,WaitWhile($["${CHANNEL(ORCHESTRATOR_READY)}" != "1"])

        ; Leer y reproducir la respuesta del orquestador
        same => n,NoOp(Orquestador dice: ${CHANNEL(RESPONSE_TEXT)})
        ; Aquí iría la llamada a su motor de TTS, por ejemplo:
        ; same => n,AGI(googletts.agi,"${CHANNEL(RESPONSE_TEXT)}")

        ; Comprobar si la conversación ha terminado
        same => n,GotoIf($["${CHANNEL(CONVERSATION_DONE)}" = "1"]?fin_conversacion)

        ; Escuchar y transcribir la respuesta del usuario
        ; Aquí iría la llamada a su motor de STT, por ejemplo:
        ; same => n,AGI(googlespeech.agi)
        ; Suponiendo que el AGI de STT guarda el resultado en la variable STT_RESULT

        ; Enviar la respuesta del usuario al orquestador
        same => n,Set(CHANNEL(USER_INPUT)=${STT_RESULT})

        same => n,Set(LOOP_COUNT=$[${LOOP_COUNT} + 1])
    same => n,EndWhile()

    same => n(fin_conversacion),NoOp(Conversación terminada por el orquestador)
    same => n,Hangup()
```
