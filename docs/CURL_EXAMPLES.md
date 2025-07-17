# Ejemplos de `curl` para Probar el Flujo de Conversación

Esta guía proporciona una serie de comandos `curl` para probar el flujo completo de agendamiento de citas a través de la API del orquestador.

**Prerrequisitos**:
- El servidor principal debe estar en ejecución (`npm start`).
- La API del orquestador y la API simulada deben estar habilitadas en tu archivo `.env`.

## Flujo de Prueba

### 1. Iniciar la Conversación

Este comando inicia una nueva sesión de conversación y obtiene la primera pregunta.

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "curl-test-01"}' http://localhost:3000/start_conversation
```

**Respuesta Esperada:**
```json
{
    "next_prompt": "Por favor, deme su número de identificación."
}
```

### 2. Enviar el Número de Identificación

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "curl-test-01", "userInput": "Mi cédula es 0987654321"}' http://localhost:3000/conversation
```

**Respuesta Esperada:**
```json
{
    "next_prompt": "¿En qué ciudad desea agendar su cita?",
    "collected_params": {
        "id_number": "0987654321"
    }
}
```

### 3. Enviar la Ciudad

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "curl-test-01", "userInput": "Quiero mi cita en Guayaquil"}' http://localhost:3000/conversation
```

**Respuesta Esperada:**
```json
{
    "next_prompt": "¿En qué sucursal de Guayaquil desea su cita?",
    "collected_params": {
        "id_number": "0987654321",
        "city_id": 1,
        "city_name": "Guayaquil"
    }
}
```

### 4. Enviar la Sucursal

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "curl-test-01", "userInput": "En la sucursal Kennedy"}' http://localhost:3000/conversation
```

**Respuesta Esperada:**
```json
{
    "next_prompt": "¿Para qué especialidad desea su cita?",
    "collected_params": {
        "id_number": "0987654321",
        "city_id": 1,
        "city_name": "Guayaquil",
        "branch_id": 101,
        "branch_name": "Kennedy"
    }
}
```

### 5. Enviar la Especialidad

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "curl-test-01", "userInput": "Para pediatría"}' http://localhost:3000/conversation
```

**Respuesta Esperada:**
```json
{
    "next_prompt": "Por favor, elija una fecha y hora de las siguientes opciones: 2025-07-15 11:00, 2025-07-15 15:00.",
    "collected_params": {
        "id_number": "0987654321",
        "city_id": 1,
        "city_name": "Guayaquil",
        "branch_id": 101,
        "branch_name": "Kennedy",
        "speciality_id": 2,
        "speciality_name": "Pediatría"
    }
}
```

### 6. Enviar la Fecha y Hora

```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId": "curl-test-01", "userInput": "el 15 de julio a las 3 de la tarde"}' http://localhost:3000/conversation
```

**Respuesta Esperada:**
```json
{
    "final_message": "Cita agendada exitosamente (simulado)."
}
```
