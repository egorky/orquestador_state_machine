# Guía de Configuración

Este documento explica cómo configurar el comportamiento del orquestador a través de los archivos JSON ubicados en la carpeta `src/config`.

## `flows_config.json`

Este archivo define los diferentes flujos de conversación que el orquestador puede manejar.

-   `flows`: Un objeto que contiene todos los flujos disponibles.
    -   `[flow_name]`: Cada clave es el nombre de un flujo (ej. `scheduling`).
        -   `initial_parameter`: El nombre del primer parámetro a recolectar en este flujo.
        -   `parameters`: Un objeto que define las transiciones entre parámetros.
            -   `[parameter_name]`: La clave es el nombre de un parámetro.
                -   `next_parameter`: El nombre del siguiente parámetro a recolectar. Si es `null`, el flujo para este camino ha terminado.

## `parameters_config.json`

Este archivo define los parámetros que el orquestador puede recolectar.

-   `parameters`: Un array de objetos, donde cada objeto representa un parámetro.
    -   `name`: El nombre único del parámetro.
    -   `question`: La pregunta que se le hará al usuario para obtener este parámetro. Puede incluir placeholders como `{city_name}` que se reemplazarán con datos del contexto, o placeholders dinámicos como `{{CURRENT_DATETIME}}`.

## `apis_config.json`

Este archivo define las APIs externas que el orquestador puede llamar.

-   `apis`: Un array de objetos, donde cada objeto representa una API.
    -   `name`: El nombre único de la API.
    -   `endpoint`: La URL del endpoint de la API.
    -   `method`: El método HTTP a utilizar (`GET`, `POST`, etc.).
    -   `headers`: Un objeto con las cabeceras a enviar en la petición.

## `execution_order_config.json`

Este archivo define la secuencia de pasos a seguir para cada parámetro.

-   `execution_sequences`: Un array de objetos, donde cada objeto define la secuencia para un parámetro.
    -   `parameter`: El nombre del parámetro al que se aplica esta secuencia.
    -   `steps`: Un array de objetos, donde cada objeto es un paso a ejecutar en orden.
        -   `tool`: La herramienta a utilizar. Puede ser `api_call`, `ai_extract`, `validate`, o `decision`.
        -   `api` (si `tool` es `api_call`): El nombre de la API a llamar.
        -   `input_keys` (si `tool` es `api_call`): Un array de claves del contexto que se enviarán como parámetros a la API.
        -   `output_key` (si `tool` es `api_call`): La clave bajo la cual se guardará la respuesta de la API en el contexto.
        -   `prompt` (si `tool` es `ai_extract`): El prompt que se enviará a la IA.
        -   `validation` (si `tool` es `validate`): El nombre del parámetro de validación a utilizar.
        -   `on` (si `tool` es `decision`): La clave del contexto sobre la cual se tomará la decisión.
        -   `cases` (si `tool` es `decision`): Un array de casos.
            -   `equals`: El valor a comparar.
            -   `next_parameter`: El siguiente parámetro si el caso coincide.
        -   `default` (si `tool` es `decision`): El siguiente parámetro si ningún caso coincide.

## `validations_config.json`

Este archivo define las reglas de validación para los datos extraídos.

-   `validations`: Un array de objetos, donde cada objeto define las reglas para un parámetro.
    -   `parameter`: El nombre del parámetro al que se aplican estas reglas.
    -   `rules`: Un array de objetos, donde cada objeto es una regla de validación.
        -   `type`: El tipo de validación (`regex`, `in_list`, `in_list_simple`).
        -   `pattern` (si `type` es `regex`): La expresión regular.
        -   `source` (si `type` es `in_list` o `in_list_simple`): La clave del contexto con la lista de valores válidos.
        -   `key` (si `type` es `in_list`): La clave del objeto a comparar en la lista.
        -   `error_message`: El mensaje de error.
