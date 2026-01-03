#!/bin/bash
cd "$(dirname "$0")/backend"
go run cmd/server/main.go
