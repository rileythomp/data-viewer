#!/bin/bash
PORT=${1:-5173}
BACKEND_PORT=${2:-8080}
cd "$(dirname "$0")/frontend"
npm install
VITE_BACKEND_PORT=$BACKEND_PORT npm run dev -- --port $PORT
