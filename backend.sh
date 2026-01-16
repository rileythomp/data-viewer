#!/bin/bash
PORT=${1:-8080}
FRONTEND_PORT=${2:-5173}
cd "$(dirname "$0")/backend"
SERVER_PORT=$PORT CORS_ORIGINS="http://localhost:$FRONTEND_PORT" go run cmd/server/main.go
