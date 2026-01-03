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

	// Initialize repositories and handlers
	accountRepo := repository.NewAccountRepository(db)
	groupRepo := repository.NewAccountGroupRepository(db)
	membershipRepo := repository.NewMembershipRepository(db)
	accountHandler := handlers.NewAccountHandler(accountRepo, membershipRepo)
	groupHandler := handlers.NewAccountGroupHandler(groupRepo)

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	api.HandleFunc("/health", handlers.HealthCheck).Methods("GET")

	// Unified list endpoint for main page
	api.HandleFunc("/list", groupHandler.GetGroupedList).Methods("GET")

	// Account routes
	api.HandleFunc("/accounts", accountHandler.GetAll).Methods("GET")
	api.HandleFunc("/accounts", accountHandler.Create).Methods("POST")
	api.HandleFunc("/accounts/positions", accountHandler.UpdatePositions).Methods("PATCH")
	api.HandleFunc("/accounts/{id}", accountHandler.GetByID).Methods("GET")
	api.HandleFunc("/accounts/{id}/name", accountHandler.UpdateName).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/info", accountHandler.UpdateInfo).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/balance", accountHandler.UpdateBalance).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/archive", accountHandler.Archive).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/history", accountHandler.GetHistory).Methods("GET")
	api.HandleFunc("/accounts/{id}/membership", accountHandler.ModifyGroupMembership).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/groups", accountHandler.SetGroupMemberships).Methods("PUT")
	api.HandleFunc("/accounts/{id}/formula", accountHandler.UpdateFormula).Methods("PATCH")

	// Group routes
	api.HandleFunc("/groups", groupHandler.GetAll).Methods("GET")
	api.HandleFunc("/groups", groupHandler.Create).Methods("POST")
	api.HandleFunc("/groups/positions", groupHandler.UpdatePositions).Methods("PATCH")
	api.HandleFunc("/groups/{id}", groupHandler.GetByID).Methods("GET")
	api.HandleFunc("/groups/{id}", groupHandler.Update).Methods("PATCH")
	api.HandleFunc("/groups/{id}/archive", groupHandler.Archive).Methods("PATCH")
	api.HandleFunc("/groups/{id}/account-positions", groupHandler.UpdateAccountPositionsInGroup).Methods("PATCH")

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
