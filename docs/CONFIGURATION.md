# Guía de Configuración

Este documento proporciona una explicación detallada de todos los archivos de configuración JSON que se encuentran en el directorio `src/config/`. Estos archivos le permiten definir y personalizar los flujos de conversación de forma declarativa, sin necesidad de modificar el código fuente del orquestador.

## 1. `flows_config.json`

Define los diferentes flujos de conversación que el orquestador puede manejar.

-   **`flows`**: Un objeto donde cada clave es el nombre de un flujo (ej. "scheduling", "cancellation").
    -   **`initial_parameter`**: El nombre del primer parámetro que se debe recolectar en este flujo.
    -   **`parameters`**: Un objeto que define el orden secuencial de los parámetros. Cada clave es el nombre de un parámetro, y su valor contiene:
        -   `next_parameter`: El nombre del siguiente parámetro en el flujo. Si es `null`, indica que es el último parámetro.

**Ejemplo:**

```json
{
    "flows": {
        "scheduling": {
            "initial_parameter": "id_number",
            "parameters": {
                "id_number": { "next_parameter": "city" },
                "city": { "next_parameter": "branch" },
                "branch": { "next_parameter": "speciality" },
                "speciality": { "next_parameter": "date_time" },
                "date_time": { "next_parameter": null }
            }
        }
    }
}
```

## 2. `parameters_config.json`

Este es el archivo de configuración central. Define los detalles de cada parámetro que puede ser recolectado.

-   Cada clave de alto nivel es el **nombre del parámetro** (ej. "city").
    -   **`question`**: La plantilla de la pregunta que se le hará al usuario. Puede incluir placeholders como `{variable}` que serán reemplazados por datos del contexto de la conversación.
    -   **`pre_ask_steps`** (Opcional): Un array de acciones a ejecutar **antes** de hacer la pregunta. Útil para obtener datos necesarios para formular la pregunta (ej. obtener una lista de opciones de una API).
    -   **`post_ask_steps`** (Opcional): Un array de acciones a ejecutar **después** de que el usuario ha respondido. Útil para procesar la respuesta del usuario (ej. extraer información con IA, validar, etc.).

### Estructura de un Paso (`step`)

Cada elemento en `pre_ask_steps` y `post_ask_steps` es un objeto "paso" con la siguiente estructura:

-   **`tool`**: La herramienta a utilizar. Valores posibles: `"api"`, `"script"`, `"ai"`, `"validate"`.
-   **Propiedades adicionales**: Dependen de la herramienta seleccionada.

#### Herramienta `api`

-   **`name`**: El nombre de la API a llamar (debe coincidir con un nombre en `apis_config.json`).
-   **`input_keys`** (Opcional): Un objeto que mapea los nombres de los parámetros de la API a sus valores, que se toman del contexto de la conversación.
-   **`output_key`**: La clave bajo la cual se guardará la respuesta de la API en el contexto de la conversación.

#### Herramienta `script`

-   **`name`**: El nombre del script a ejecutar (debe coincidir con un nombre en `scripts_config.json`).
-   **`input_key`**: La clave del contexto que se pasará como entrada al script.
-   **`output_key`**: La clave bajo la cual se guardará el resultado del script en el contexto.

#### Herramienta `ai`

-   **`prompt`**: El prompt que se enviará a Gemini. El orquestador añadirá automáticamente la respuesta del usuario y el contexto actual.

#### Herramienta `validate`

-   **`parameter`**: El nombre del parámetro a validar (debe coincidir con un nombre en `validations_config.json`).

**Ejemplo (`city`):**

```json
"city": {
    "question": "¿En qué ciudad desea agendar su cita? Tenemos disponibles en: {cities_list}",
    "pre_ask_steps": [
        {
            "tool": "api",
            "name": "fetch_cities_api",
            "output_key": "cities_data"
        },
        {
            "tool": "script",
            "name": "format_cities_list",
            "input_key": "cities_data",
            "output_key": "cities_list"
        }
    ],
    "post_ask_steps": [
        {
            "tool": "ai",
            "prompt": "De la respuesta del usuario, y de la lista de ciudades en el contexto, extrae el ID de la ciudad. Responde en un JSON con la clave 'city_id'."
        }
    ]
}
```

## 3. `apis_config.json`

Define los detalles de las APIs externas que el orquestador puede invocar.

-   **`apis`**: Un array de objetos, donde cada objeto representa una API.
    -   `name`: Un nombre único para la API.
    -   `endpoint`: La URL del endpoint de la API.
    -   `method`: El método HTTP (`GET`, `POST`, etc.).
    -   `headers`: Un objeto con las cabeceras HTTP a enviar.

## 4. `scripts_config.json`

Define pequeños fragmentos de código JavaScript para la transformación de datos.

-   **`scripts`**: Un array de objetos, donde cada objeto representa un script.
    -   `name`: Un nombre único para el script.
    -   `function_body`: El cuerpo de la función JavaScript. La función recibe un argumento `data` (que corresponde al `input_key` del paso del script) y debe devolver el valor transformado. **Nota**: El `return` es implícito.

**Ejemplo:**

```json
{
    "scripts": [
        {
            "name": "format_cities_list",
            "function_body": "return cities.map(c => c.city_name).join(', ');"
        }
    ]
}
```

## 5. `intents_config.json`

Define las intenciones que el sistema puede detectar.

-   **`intents`**: Un array de objetos, donde cada objeto representa una intención.
    -   `name`: Un nombre único para la intención.
    -   `description`: Una descripción de lo que representa la intención, usada en el prompt de Gemini.
    -   `keywords` (Opcional): Palabras clave que pueden ayudar a la detección (actualmente no se usan en el prompt, pero son útiles para referencia).

## 6. `validations_config.json`

Define las reglas para validar los datos extraídos. (La lógica de validación aún no está completamente implementada en `orchestrator.js`).

-   **`validations`**: Un array de objetos, uno por cada parámetro que requiere validación.
    -   `parameter`: El nombre del parámetro.
    -   `rules`: Un array de reglas de validación.
        -   `type`: El tipo de validación (ej. "regex", "in_list").
        -   `pattern`, `source`, etc.: Propiedades específicas del tipo de regla.
        -   `error_message`: El mensaje a devolver si la validación falla.
