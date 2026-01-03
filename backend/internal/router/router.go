package router

import (
	"database/sql"

	"finance-tracker/internal/handlers"
	"finance-tracker/internal/repository"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func New(db *sql.DB) *mux.Router {
	r := mux.NewRouter()

	// Initialize repository and handlers
	accountRepo := repository.NewAccountRepository(db)
	accountHandler := handlers.NewAccountHandler(accountRepo)

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	api.HandleFunc("/health", handlers.HealthCheck).Methods("GET")

	api.HandleFunc("/accounts", accountHandler.GetAll).Methods("GET")
	api.HandleFunc("/accounts", accountHandler.Create).Methods("POST")
	api.HandleFunc("/accounts/positions", accountHandler.UpdatePositions).Methods("PATCH")
	api.HandleFunc("/accounts/{id}", accountHandler.GetByID).Methods("GET")
	api.HandleFunc("/accounts/{id}/name", accountHandler.UpdateName).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/info", accountHandler.UpdateInfo).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/balance", accountHandler.UpdateBalance).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/archive", accountHandler.Archive).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/history", accountHandler.GetHistory).Methods("GET")

	return r
}

func WithCORS(r *mux.Router) *cors.Cors {
	return cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
}
