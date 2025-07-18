#!/bin/bash

# Escenario 3: Cambio de flujo a "hablar con un agente"

SESSION_ID="test-session-$(date +%s)"
BASE_URL="http://localhost:3010"

echo "----------------------------------------------------"
echo "Iniciando Escenario 3: Cambio de Flujo"
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

echo "PASO 4: Solicitar Hablar con un Agente"
curl -X POST -H "Content-Type: application/json" -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"No, mejor quiero hablar con una persona\"}" $BASE_URL/conversation
echo ""
echo ""

echo "----------------------------------------------------"
echo "Fin del Escenario 3"
echo "----------------------------------------------------"
