# Guía de Configuración

Este documento explica cómo configurar el comportamiento del orquestador a través de los archivos JSON ubicados en la carpeta `src/config`.

## `parameters_config.json`

Este archivo define los parámetros que el orquestador intentará recolectar del usuario.

-   `parameters`: Un array de objetos, donde cada objeto representa un parámetro.
    -   `name`: El nombre único del parámetro.
    -   `question`: La pregunta que se le hará al usuario para obtener este parámetro. Puede incluir placeholders como `{city_name}` que se reemplazarán con datos del contexto.
    -   `dependencies`: Un array de nombres de parámetros que deben ser recolectados *antes* de que se pueda solicitar este parámetro.
-   `final_action`: Define la acción a tomar una vez que todos los parámetros requeridos han sido recolectados.
    -   `api`: El nombre de la API a llamar (debe coincidir con un nombre en `apis_config.json`).
    -   `required_parameters`: Un array con los nombres de todos los parámetros necesarios para completar el flujo.

**Ejemplo:**
```json
{
    "parameters": [
        {
            "name": "city",
            "question": "¿En qué ciudad desea agendar su cita?",
            "dependencies": ["id_number"]
        }
    ]
}
```

## `apis_config.json`

Este archivo define las APIs externas que el orquestador puede llamar.

-   `apis`: Un array de objetos, donde cada objeto representa una API.
    -   `name`: El nombre único de la API.
    -   `endpoint`: La URL del endpoint de la API.
    -   `method`: El método HTTP a utilizar (`GET`, `POST`, etc.).
    -   `headers`: Un objeto con las cabeceras a enviar en la petición.

## `execution_order_config.json`

Este archivo es crucial, ya que define la secuencia de pasos a seguir para cada parámetro.

-   `execution_sequences`: Un array de objetos, donde cada objeto define la secuencia para un parámetro.
    -   `parameter`: El nombre del parámetro al que se aplica esta secuencia.
    -   `steps`: Un array de objetos, donde cada objeto es un paso a ejecutar en orden.
        -   `tool`: La herramienta a utilizar en este paso. Puede ser `api_call`, `ai_extract`, o `validate`.
        -   `api` (si `tool` es `api_call`): El nombre de la API a llamar.
        -   `input_keys` (si `tool` es `api_call`): Un array de claves del contexto que se enviarán como parámetros a la API.
        -   `output_key` (si `tool` es `api_call`): La clave bajo la cual se guardará la respuesta de la API en el contexto.
        -   `prompt` (si `tool` es `ai_extract`): El prompt que se enviará a la IA.
        -   `validation` (si `tool` es `validate`): El nombre del parámetro de validación a utilizar (debe coincidir con uno en `validations_config.json`).

## `validations_config.json`

Este archivo define las reglas de validación para los datos extraídos.

-   `validations`: Un array de objetos, donde cada objeto define las reglas para un parámetro.
    -   `parameter`: El nombre del parámetro al que se aplican estas reglas.
    -   `rules`: Un array de objetos, donde cada objeto es una regla de validación.
        -   `type`: El tipo de validación. Puede ser `regex`, `in_list`, o `in_list_simple`.
        -   `pattern` (si `type` es `regex`): La expresión regular a aplicar.
        -   `source` (si `type` es `in_list` o `in_list_simple`): La clave del contexto que contiene la lista de valores válidos.
        -   `key` (si `type` es `in_list`): La clave del objeto a comparar dentro de la lista.
        -   `error_message`: El mensaje de error a mostrar si la validación falla.

## Cómo Crear un Nuevo Flujo

1.  **Define los Parámetros**: En `parameters_config.json`, añade los nuevos parámetros que necesitas recolectar, sus preguntas y dependencias.
2.  **Configura las APIs**: Si tu nuevo flujo necesita llamar a nuevas APIs, añádelas en `apis_config.json`.
3.  **Crea las Secuencias de Ejecución**: En `execution_order_config.json`, crea una nueva secuencia para cada nuevo parámetro, definiendo los pasos de llamadas a API, extracción con IA y validación.
4.  **Añade Reglas de Validación**: En `validations_config.json`, añade las reglas de validación necesarias para tus nuevos parámetros.
5.  **Ajusta la API Simulada**: Si estás trabajando en modo de prueba, no olvides añadir los nuevos endpoints y datos a `demo/mock_api.js`.
