# Orquestador de Conversaciones Inteligente

Este proyecto es un orquestador de conversaciones altamente configurable, diseñado para gestionar diálogos interactivos a través de múltiples canales. Utiliza Google Gemini para el procesamiento de lenguaje natural, Redis para la gestión de estado y puede operar simultáneamente como una API REST y un cliente ARI para Asterisk.

## Características Principales

-   **Motor de Flujo Dinámico**: Define flujos de conversación complejos, incluyendo llamadas a APIs, ejecución de scripts y procesamiento de IA, todo a través de archivos de configuración JSON.
-   **Procesamiento de Lenguaje Natural**: Integrado con Google Gemini para una robusta detección de intenciones y extracción de parámetros.
-   **Persistencia de Estado**: Utiliza Redis para mantener el estado de cada conversación, lo que permite diálogos largos y resilientes.
-   **Doble Interfaz (API y ARI)**: Funciona como un servidor API REST para integraciones con chatbots y aplicaciones, y como un cliente ARI para manejar llamadas telefónicas a través de Asterisk.
-   **Logging Concurrente**: Sistema de logs enriquecido con Timestamps, Session IDs y Caller IDs para facilitar la depuración en entornos con múltiples conversaciones simultáneas.
-   **Entorno de Pruebas**: Incluye un servidor de API simulado y un script de prueba interactivo para un desarrollo y depuración eficientes.

## Requisitos

-   Node.js (v18 o superior)
-   Redis
-   (Opcional) Un servidor Asterisk para la funcionalidad de ARI

## Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar el entorno:**
    Copia el archivo de ejemplo `.env.example` a un nuevo archivo llamado `.env`.
    ```bash
    cp .env.example .env
    ```
    Abre el archivo `.env` y edita las siguientes variables:

    -   `GEMINI_API_KEY`: Tu clave de API para Google Gemini.
    -   `API_ENABLED` / `ARI_ENABLED`: Pon en `true` la interfaz que desees activar.
    -   `API_PORT`: El puerto para el servidor API (ej. 3010).
    -   `REDIS_URL`: La URL de conexión a tu servidor Redis.
    -   `LOG_LEVEL`: La variable más importante para la depuración.
        -   `info` (o si se deja en blanco): Muestra solo los logs operativos estándar.
        -   `debug`: **Recomendado para desarrollo.** Muestra logs muy detallados, incluyendo los prompts enviados a Gemini y las respuestas crudas de las APIs.

## Uso

### Iniciar el Servidor

Para iniciar el servidor con logs de depuración (recomendado):
```bash
LOG_LEVEL=debug npm start
```

O, para desarrollo con reinicio automático:
```bash
LOG_LEVEL=debug npm run dev
```

### Probar con el Script Interactivo

La mejor manera de probar el sistema es con el script interactivo. Asegúrate de que el servidor esté corriendo y ejecuta en otra terminal:

```bash
# Asegúrate de que el puerto coincida con el de tu .env
API_PORT=3010 node test_scripts/interactive_test.mjs
```
El script te guiará a través de la conversación, permitiéndote escribir las respuestas del "humano" en cada paso.

## Documentación Detallada

Para una comprensión más profunda de la arquitectura, la estructura de archivos y la configuración de flujos, por favor consulta la carpeta `/docs`:

-   **`docs/ARCHITECTURE.md`**: Visión general de la arquitectura del sistema.
-   **`docs/FILE_STRUCTURE.md`**: Explicación de cada archivo y directorio.
-   **`docs/CONFIGURATION.md`**: **Lectura obligatoria.** Guía detallada de todos los archivos de configuración JSON para crear tus propios flujos.
-   **`docs/USAGE.md`**: Ejemplos de uso de la API REST y directrices para la integración con el dialplan de Asterisk.
-   **`docs/LIBRARIES.md`**: Documentación de las librerías internas.
