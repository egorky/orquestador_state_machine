#!/bin/bash

# Escenario 2: Agendamiento exitoso con parámetros en desorden

SESSION_ID="test-session-$(date +%s)"
BASE_URL="http://localhost:3010"

echo "----------------------------------------------------"
echo "Iniciando Escenario 2: Agendamiento Desordenado"
echo "Session ID: $SESSION_ID"
echo "----------------------------------------------------"
echo ""

read -p "Presiona Enter para iniciar la conversación..."

echo "PASO 1: Iniciar Conversación"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\"}" $BASE_URL/start_conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 2: Enviar Intención, Ciudad y Número de Identificación"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"Hola, quiero agendar una cita en Quito. Mi número de cédula es 0987654321.\"}" $BASE_URL/conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 3: Enviar Especialidad y Sucursal"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"Quisiera para Dermatología en la sucursal La Carolina\"}" $BASE_URL/conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 4: Enviar Fecha y Hora"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"Puede ser el 2025-07-17 10:00\"}" $BASE_URL/conversation
echo ""
echo ""

echo "----------------------------------------------------"
echo "Fin del Escenario 2"
echo "----------------------------------------------------"
