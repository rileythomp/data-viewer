# Finance Tracker

A web application for tracking account balances over time. Built with React frontend and Go backend, storing data in PostgreSQL.

## Features

- Add accounts with name and initial balance
- Edit account names
- Update account balances (each update is recorded with timestamp)
- View balance history for each account
- Archive accounts (soft delete, preserves history)
- Total balance overview

## Prerequisites

- Go 1.21+
- Node.js 18+
- Docker (for PostgreSQL)

## Setup

### 1. Start PostgreSQL (if not already running)

The database should already be running via Docker Compose:

```bash
docker-compose up -d
```

### 2. Run Database Migration

```bash
docker exec -i metabase-postgres psql -U metabase -d finances < migrations/001_create_tables.sql
```

### 3. Start the Go Backend

```bash
./backend.sh
```

The API will be available at http://localhost:8080

### 4. Start the React Frontend

In a new terminal:

```bash
./frontend.sh
```

The app will be available at http://localhost:5173

### Running on Custom Ports

To run multiple worktrees against the same database, you can specify custom ports:

```bash
# Terminal 1: Backend on port 8081, expecting frontend on port 5174
./backend.sh 8081 5174

# Terminal 2: Frontend on port 5174, connecting to backend on port 8081
./frontend.sh 5174 8081
```

The scripts accept the following arguments:
- `backend.sh [BACKEND_PORT] [FRONTEND_PORT]` - defaults to 8080 and 5173
- `frontend.sh [FRONTEND_PORT] [BACKEND_PORT]` - defaults to 5173 and 8080

## Project Structure

```
.
├── backend/                    # Go backend
│   ├── cmd/server/main.go     # Entry point
│   └── internal/
│       ├── config/            # Configuration
│       ├── database/          # DB connection
│       ├── handlers/          # HTTP handlers
│       ├── models/            # Data models
│       ├── repository/        # DB operations
│       └── router/            # Routes setup
├── frontend/                   # React frontend
│   └── src/
│       ├── components/        # React components
│       └── services/          # API client
└── migrations/                 # SQL migrations
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/accounts | List all active accounts |
| POST | /api/accounts | Create new account |
| PATCH | /api/accounts/:id/name | Update account name |
| PATCH | /api/accounts/:id/balance | Update balance (creates history) |
| PATCH | /api/accounts/:id/archive | Archive account |
| GET | /api/accounts/:id/history | Get balance history |

## Database Schema

### account_balances
- `id` - Primary key
- `account_name` - Account name (unique)
- `current_balance` - Current balance
- `is_archived` - Soft delete flag
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### balance_history
- `id` - Primary key
- `account_id` - Foreign key to account_balances
- `account_name_snapshot` - Account name at time of update
- `balance` - Balance value
- `recorded_at` - Timestamp of record

## Environment Variables

The backend supports these environment variables (with defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| DB_HOST | localhost | PostgreSQL host |
| DB_PORT | 5500 | PostgreSQL port |
| DB_USER | metabase | Database user |
| DB_PASSWORD | mysecretpassword | Database password |
| DB_NAME | finances | Database name |
| SERVER_PORT | 8080 | API server port |
| CORS_ORIGINS | - | Comma-separated list of additional allowed origins |
| CORS_ORIGIN | - | Single additional allowed origin (for Railway) |
| VITE_BACKEND_PORT | 8080 | Backend port for frontend proxy (frontend only) |

## Metabase Integration

The data is stored in the same PostgreSQL database used by Metabase (port 3300), so you can create dashboards and visualizations directly from your balance history data.
