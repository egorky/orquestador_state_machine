# Arquitectura del Sistema

Este documento describe la arquitectura del Orquestador de Conversaciones Inteligente.

## Componentes Principales

El sistema se compone de los siguientes módulos principales:

-   **Servidor (API/ARI)**: El punto de entrada para las interacciones.
-   **Orquestador**: El cerebro del sistema. Gestiona el flujo de la conversación, el estado y la lógica de recolección de parámetros.
-   **Cliente de Redis**: Se encarga de la persistencia del estado de la conversación.
-   **Cliente de Gemini**: Interactúa con la API de Google Gemini.
-   **Archivos de Configuración**: Definen el comportamiento del orquestador.
-   **API Simulada**: Un servidor para pruebas.

## Diagrama de Flujo de Datos

```mermaid
sequenceDiagram
    participant User
    participant External Program (API/ARI)
    participant Orchestrator API
    participant Orchestrator
    participant Redis
    participant Gemini API
    participant Mock API

    User->>External Program (API/ARI): "Quiero agendar una cita"
    External Program (API/ARI)->>Orchestrator API: POST /conversation (userInput, sessionId)
    Orchestrator API->>Orchestrator: processUserInput(userInput)
    Orchestrator->>Redis: loadData(sessionId)
    Redis-->>Orchestrator: Conversation State
    Orchestrator->>Orchestrator: getNextParameter()
    Orchestrator->>Gemini API: extractParameter(prompt, userInput)
    Gemini API-->>Orchestrator: Extracted Data
    Orchestrator->>Redis: saveData(sessionId, newState)
    Orchestrator-->>Orchestrator API: { next_prompt: "..." }
    Orchestrator API-->>External Program (API/ARI): JSON Response
    External Program (API/ARI)-->>User: "¿En qué ciudad...?"
```

## Diagrama de Componentes

```mermaid
graph TD
    subgraph "Entrada/Salida"
        A[API REST]
        B[Cliente ARI]
    end

    subgraph "Núcleo de la Aplicación"
        C[Servidor Principal]
        D[Orquestador]
        E[Archivos de Configuración]
        E --> F[flows_config.json]
        E --> G[parameters_config.json]
        E --> H[apis_config.json]
        E --> I[execution_order_config.json]
        E --> J[validations_config.json]
    end

    subgraph "Servicios Externos"
        K[Cliente de Redis]
        L[Cliente de Gemini]
        M[API Simulada]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    D --> K
    D --> L
    D --> M
```
