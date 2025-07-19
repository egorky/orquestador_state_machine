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

-   **`tool`**: La herramienta a utilizar. Valores posibles: `"api"`, `"script"`, `"ai"`.
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

-   **`prompt_id`** (Opcional): El ID de la plantilla de prompt a utilizar de `prompts_config.json`. Si se omite, se usará la plantilla con ID `"default"`.
-   **`prompt_append`** (Opcional): Una cadena de texto o un array de cadenas que se añadirá al final de la plantilla de prompt seleccionada. Útil para añadir instrucciones específicas para un paso concreto.

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

Define pequeños fragmentos de código JavaScript que pueden ser ejecutados por el orquestador para realizar transformaciones de datos, cálculos o lógica condicional simple.

### Estructura

-   **`scripts`**: Un array de objetos, donde cada objeto representa un script.
    -   `name`: Un nombre único para el script.
    -   `function_body`: Una cadena de texto que contiene el cuerpo de una función JavaScript.

### Contexto de Ejecución

-   Cada script se ejecuta en un entorno de sandbox seguro (usando `vm2`).
-   El script tiene acceso a un objeto global llamado `context`, que es una referencia directa al objeto `state.context` de la conversación actual.
-   Esto significa que puedes leer cualquier dato que se haya guardado previamente en el contexto (desde llamadas a API, extracciones de IA, etc.) y también puedes modificarlo, aunque se recomienda que los scripts devuelvan valores y que el resultado se asigne a una nueva clave del contexto mediante el `output_key` en el paso del `parameters_config.json`.
-   La última expresión evaluada en el `function_body` es el valor de retorno del script.

### Ejemplos de Uso

#### Ejemplo 1: Formatear una Lista para Presentación

Útil para tomar un array de objetos de una API y convertirlo en una cadena legible para el usuario.

-   **`function_body`**:
    ```javascript
    "return context.cities_data.map(c => c.city_name).join(', ');"
    ```
-   **Uso**: En `parameters_config.json`, un `pre_ask_step` para `city` podría usar este script para generar la lista de ciudades a mostrar en la pregunta.

#### Ejemplo 2: Encontrar un Valor Específico en un Array

Después de que la IA extrae un ID, este script puede encontrar el objeto completo correspondiente y extraer un dato específico (como el nombre).

-   **`function_body`**:
    ```javascript
    "const city = context.cities_data.find(c => c.city_id === context.city_id); return city ? city.city_name : '';"
    ```
-   **Uso**: En `parameters_config.json`, un `post_ask_step` para `city` lo usaría para guardar `city_name` en el contexto, permitiendo que la siguiente pregunta sea personalizada (ej. "Perfecto. ¿En qué sucursal de **Quito**...?").

#### Ejemplo 3: Realizar un Cálculo Simple

Puedes realizar cálculos basados en los datos recolectados.

-   **`function_body`**:
    ```javascript
    "const subtotal = context.product_price * context.quantity; return subtotal;"
    ```
-   **Uso**: Para un flujo de e-commerce, después de recolectar `product_price` y `quantity`, un script podría calcular el `subtotal` y guardarlo en el contexto.

#### Ejemplo 4: Lógica Condicional Simple

Puedes devolver diferentes valores basados en una condición.

-   **`function_body`**:
    ```javascript
    "const birth_year = parseInt(context.id_number.substring(0, 4)); const current_year = new Date().getFullYear(); const age = current_year - birth_year; return age < 18 ? 'menor_de_edad' : 'mayor_de_edad';"
    ```
-   **Uso**: Podría usarse para determinar si un usuario es menor de edad y dirigir el flujo de la conversación en consecuencia (aunque la lógica de ramificación más compleja debería manejarse en el orquestador).

#### Ejemplo 5: Transformación de Datos Compleja

Combinar varios datos del contexto para crear una nueva estructura.

-   **`function_body`**:
    ```javascript
    "const userProfile = { nombre_completo: `${context.nombres} ${context.apellidos}`, telefono: context.numero_telefono, ciudad: context.ciudad_residencia }; return JSON.stringify(userProfile);"
    ```
-   **Uso**: Al final de un flujo de recolección de datos, un script podría ensamblar un objeto de perfil de usuario y prepararlo para ser enviado a una API.

## 5. `intents_config.json`

Define las intenciones que el sistema puede detectar.

-   **`intents`**: Un array de objetos, donde cada objeto representa una intención.
    -   `name`: Un nombre único para la intención.
    -   `description`: Una descripción de lo que representa la intención, usada en el prompt de Gemini.
    -   `keywords` (Opcional): Palabras clave que pueden ayudar a la detección (actualmente no se usan en el prompt, pero son útiles para referencia).

## 6. `prompts_config.json`

Define las diferentes plantillas de prompts que la herramienta `ai` puede utilizar.

-   **`prompts`**: Un objeto donde cada clave es un ID de prompt único (ej. "default", "date_time_extraction").
    -   El valor de cada clave es un array de cadenas de texto, que juntas forman la plantilla del prompt.

### Placeholders Automáticos

Dentro de cualquier plantilla de prompt, puedes usar los siguientes placeholders, que el orquestador reemplazará automáticamente antes de enviar el prompt a la IA:

-   `{current_date}`: La fecha actual en formato `YYYY-MM-DD`.
-   `{current_time}`: La hora actual en formato `HH:MM:SS`.
-   `{current_flow}`: El nombre del flujo de conversación actual.
-   `{current_parameter}`: El nombre del parámetro que se está pidiendo actualmente.
-   `{available_intents}`: Una lista de todas las intenciones posibles, separadas por comas.
-   `{collected_params}`: Un objeto JSON con todos los parámetros que ya han sido recolectados.
-   `{context}`: Un objeto JSON con todo el contexto de la conversación (incluyendo datos de API, resultados de scripts, etc.).
-   `{user_input}`: La respuesta literal que dio el usuario en el último turno.

## 6. Guía Avanzada para Llamadas a API

Esta sección detalla cómo configurar diferentes tipos de llamadas a API en `parameters_config.json`.

### Caso 1: API `GET` con Parámetros en la URL

Este es el caso más común para obtener datos.

-   **`apis_config.json`**:
    ```json
    {
        "name": "fetch_branches_api",
        "endpoint": "http://127.0.0.1:3001/branches",
        "method": "GET",
        "headers": { "Content-Type": "application/json" }
    }
    ```
-   **`parameters_config.json`**:
    En un `pre_ask_step` (o `post_ask_step`), se define la llamada. La clave `input_keys` mapea los parámetros que irán en la URL a los valores del contexto.
    ```json
    {
        "tool": "api",
        "name": "fetch_branches_api",
        "input_keys": { "city_id": "context.city_id" },
        "output_key": "branches_data"
    }
    ```
    El orquestador construirá la URL de la siguiente manera: `http://127.0.0.1:3001/branches?city_id=123` (suponiendo que `context.city_id` es `123`).

### Caso 2: API `POST` con Cuerpo (Body) JSON

Se utiliza para enviar datos al servidor.

-   **`apis_config.json`**:
    ```json
    {
        "name": "create_appointment_api",
        "endpoint": "http://127.0.0.1:3001/appointments",
        "method": "POST",
        "headers": { "Content-Type": "application/json" }
    }
    ```
-   **`parameters_config.json`**:
    La configuración es idéntica al caso `GET`. El orquestador detecta que el método es `POST` y construye un cuerpo JSON en lugar de parámetros de URL.
    ```json
    {
        "tool": "api",
        "name": "create_appointment_api",
        "input_keys": {
            "patient_id": "context.id_number",
            "branch_id": "context.branch_id",
            "speciality_id": "context.speciality_id"
        },
        "output_key": "appointment_confirmation"
    }
    ```
    El orquestador enviará una solicitud `POST` con un cuerpo como este:
    ```json
    {
        "patient_id": "123456789",
        "branch_id": 301,
        "speciality_id": 405
    }
    ```

### Caso 3: API `POST` con Parámetros en URL y Cuerpo (Híbrido)

El sistema soporta llamadas a API que requieren parámetros tanto en la URL como en el cuerpo de la solicitud. Para ello, se utiliza una estructura específica en `input_keys`.

-   **`apis_config.json`**:
    No se necesita ninguna configuración especial. Se define como una API `POST` normal.
    ```json
    {
        "name": "update_appointment_details",
        "endpoint": "http://127.0.0.1:3001/appointments",
        "method": "POST",
        "headers": { "Content-Type": "application/json" }
    }
    ```
-   **`parameters_config.json`**:
    Dentro de `input_keys`, se deben crear dos objetos: `url_params` para los parámetros de la URL y `body_params` para los del cuerpo.
    ```json
    {
        "tool": "api",
        "name": "update_appointment_details",
        "input_keys": {
            "url_params": {
                "appointment_id": "context.appointment_to_update_id"
            },
            "body_params": {
                "new_time": "context.new_date_time",
                "reason": "context.update_reason"
            }
        },
        "output_key": "update_confirmation"
    }
    ```
    El orquestador construirá la URL como `http://.../appointments?appointment_id=456` y enviará una solicitud `POST` con un cuerpo JSON que contiene `new_time` y `reason`.
