#!/bin/bash

# Escenario 1: Agendamiento exitoso con parámetros en orden

SESSION_ID="test-session-$(date +%s)"
BASE_URL="http://localhost:3010"

echo "----------------------------------------------------"
echo "Iniciando Escenario 1: Agendamiento Ordenado"
echo "Session ID: $SESSION_ID"
echo "----------------------------------------------------"
echo ""

read -p "Presiona Enter para iniciar la conversación..."

echo "PASO 1: Iniciar Conversación"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\"}" $BASE_URL/start_conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 2: Enviar Intención de Agendamiento"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"Quiero agendar una cita\"}" $BASE_URL/conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 3: Enviar Número de Identificación"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"Mi cédula es 1234567890\"}" $BASE_URL/conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 4: Enviar Ciudad"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"En Guayaquil\"}" $BASE_URL/conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 5: Enviar Sucursal"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"Quiero en la sucursal Kennedy\"}" $BASE_URL/conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 6: Enviar Especialidad"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"Medicina General\"}" $BASE_URL/conversation
echo ""
echo ""

read -p "Presiona Enter para el siguiente paso..."

echo "PASO 7: Enviar Fecha y Hora"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"2025-07-15 10:00\"}" $BASE_URL/conversation
echo ""
echo ""

echo "----------------------------------------------------"
echo "Fin del Escenario 1"
echo "----------------------------------------------------"
