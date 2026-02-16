#!/bin/bash

# Script para iniciar el servidor backend

echo "🚀 Iniciando Restaurant Cost Control Backend..."
echo ""

cd "$(dirname "$0")/backend"

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instala Node.js primero."
    exit 1
fi

# Verificar que npm esté instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado. Por favor instala npm primero."
    exit 1
fi

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Verificar configuración
echo "🔍 Verificando configuración..."
npm run verify

if [ $? -ne 0 ]; then
    echo "⚠️  Advertencias en la verificación, pero continuando..."
fi

# Iniciar servidor
echo ""
echo "✅ Iniciando servidor en http://localhost:8000"
echo "📊 Health check: http://localhost:8000/api/healthz"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

npm start
