# Ejemplos de cURL

Estos ejemplos muestran cómo interactuar con el orquestador a través de la API REST.

## Iniciar una Conversación

Para iniciar una conversación, envía una solicitud POST a `/start_conversation`.

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123"}' http://localhost:3010/start_conversation
```

**Respuesta Esperada:**

```json
{
    "next_prompt": "Hola, soy tu asistente virtual. ¿Cómo puedo ayudarte hoy?"
}
```

## Detección de Intención y Extracción de Parámetros

Envía la respuesta del usuario a `/conversation`. El sistema detectará la intención y extraerá los parámetros.

### Ejemplo 1: Intención de Agendamiento

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123", "userInput": "Quiero agendar una cita"}' http://localhost:3010/conversation
```

**Respuesta Esperada:**

```json
{
    "next_prompt": "Por favor, deme su número de identificación.",
    "collected_params": {}
}
```

### Ejemplo 2: Parámetros Fuera de Orden

En este ejemplo, el usuario proporciona la ciudad y el número de identificación en la misma frase.

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123", "userInput": "Quiero agendar en Guayaquil, mi cédula es 0987654321"}' http://localhost:3010/conversation
```

**Respuesta Esperada:**

El sistema debería extraer ambos parámetros y luego preguntar por el siguiente parámetro que falta en el flujo (en este caso, la sucursal).

```json
{
    "next_prompt": "¿En qué sucursal de Guayaquil desea su cita?",
    "collected_params": {
        "id_number": "0987654321",
        "city": "Guayaquil"
    }
}
```

## Continuar la Conversación

Continúa enviando las respuestas del usuario a `/conversation` hasta que se recopilen todos los parámetros.

### Paso 1: Proporcionar la Sucursal

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123", "userInput": "En la Kennedy"}' http://localhost:3010/conversation
```

**Respuesta Esperada:**

```json
{
    "next_prompt": "¿Para qué especialidad desea su cita?",
    "collected_params": {
        "id_number": "0987654321",
        "city": "Guayaquil",
        "branch": "Kennedy"
    }
}
```

### Paso 2: Proporcionar la Especialidad

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123", "userInput": "Medicina General"}' http://localhost:3010/conversation
```

**Respuesta Esperada:**

```json
{
    "next_prompt": "Por favor, elija una fecha y hora de las siguientes opciones: 2025-07-15 10:00, 2025-07-15 14:00.",
    "collected_params": {
        "id_number": "0987654321",
        "city": "Guayaquil",
        "branch": "Kennedy",
        "speciality": "Medicina General"
    }
}
```

### Paso 3: Proporcionar la Fecha y Hora

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "test-session-123", "userInput": "2025-07-15 10:00"}' http://localhost:3010/conversation
```

**Respuesta Esperada:**

```json
{
    "final_message": "Todos los parámetros han sido recolectados. Gracias.",
    "collected_params": {
        "id_number": "0987654321",
        "city": "Guayaquil",
        "branch": "Kennedy",
        "speciality": "Medicina General",
        "date_time": "2025-07-15 10:00"
    }
}
```
