package router

import (
	"database/sql"
	"os"

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
	settingsRepo := repository.NewSettingsRepository(db)
	dashboardRepo := repository.NewDashboardRepository(db)
	chartRepo := repository.NewChartRepository(db)
	uploadRepo := repository.NewUploadRepository(db)
	datasetRepo := repository.NewDatasetRepository(db)
	accountHandler := handlers.NewAccountHandler(accountRepo, membershipRepo)
	groupHandler := handlers.NewAccountGroupHandler(groupRepo)
	institutionHandler := handlers.NewInstitutionHandler(groupRepo)
	settingsHandler := handlers.NewSettingsHandler(settingsRepo)
	dashboardHandler := handlers.NewDashboardHandler(dashboardRepo)
	chartHandler := handlers.NewChartHandler(chartRepo)
	uploadHandler := handlers.NewUploadHandler(uploadRepo)
	datasetHandler := handlers.NewDatasetHandler(datasetRepo)

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	api.HandleFunc("/health", handlers.HealthCheck).Methods("GET")

	// Unified list endpoint for main page
	api.HandleFunc("/list", groupHandler.GetGroupedList).Methods("GET")

	// Account routes - /all must come before /{id} routes
	api.HandleFunc("/accounts/all", accountHandler.GetAllIncludingArchived).Methods("GET")
	api.HandleFunc("/accounts", accountHandler.GetAll).Methods("GET")
	api.HandleFunc("/accounts", accountHandler.Create).Methods("POST")
	api.HandleFunc("/accounts/positions", accountHandler.UpdatePositions).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/unarchive", accountHandler.Unarchive).Methods("PATCH")
	api.HandleFunc("/accounts/{id}", accountHandler.GetByID).Methods("GET")
	api.HandleFunc("/accounts/{id}", accountHandler.Delete).Methods("DELETE")
	api.HandleFunc("/accounts/{id}/name", accountHandler.UpdateName).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/info", accountHandler.UpdateInfo).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/balance", accountHandler.UpdateBalance).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/archive", accountHandler.Archive).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/history", accountHandler.GetHistory).Methods("GET")
	api.HandleFunc("/accounts/{id}/membership", accountHandler.ModifyGroupMembership).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/groups", accountHandler.SetGroupMemberships).Methods("PUT")
	api.HandleFunc("/accounts/{id}/formula", accountHandler.UpdateFormula).Methods("PATCH")
	api.HandleFunc("/accounts/{id}/institution", accountHandler.SetInstitution).Methods("PATCH")

	// Group routes - /all must come before /{id} routes
	api.HandleFunc("/groups/all", groupHandler.GetAllIncludingArchived).Methods("GET")
	api.HandleFunc("/groups", groupHandler.GetAll).Methods("GET")
	api.HandleFunc("/groups", groupHandler.Create).Methods("POST")
	api.HandleFunc("/groups/positions", groupHandler.UpdatePositions).Methods("PATCH")
	api.HandleFunc("/groups/{id}/unarchive", groupHandler.Unarchive).Methods("PATCH")
	api.HandleFunc("/groups/{id}", groupHandler.GetByID).Methods("GET")
	api.HandleFunc("/groups/{id}", groupHandler.Update).Methods("PATCH")
	api.HandleFunc("/groups/{id}", groupHandler.Delete).Methods("DELETE")
	api.HandleFunc("/groups/{id}/archive", groupHandler.Archive).Methods("PATCH")
	api.HandleFunc("/groups/{id}/account-positions", groupHandler.UpdateAccountPositionsInGroup).Methods("PATCH")
	api.HandleFunc("/groups/{id}/history", groupHandler.GetHistory).Methods("GET")

	// Institution routes - /all must come before /{id} routes
	api.HandleFunc("/institutions/all", institutionHandler.GetAllIncludingArchived).Methods("GET")
	api.HandleFunc("/institutions", institutionHandler.GetAll).Methods("GET")
	api.HandleFunc("/institutions", institutionHandler.Create).Methods("POST")
	api.HandleFunc("/institutions/{id}/unarchive", institutionHandler.Unarchive).Methods("PATCH")
	api.HandleFunc("/institutions/{id}", institutionHandler.GetByID).Methods("GET")
	api.HandleFunc("/institutions/{id}", institutionHandler.Update).Methods("PATCH")
	api.HandleFunc("/institutions/{id}", institutionHandler.Delete).Methods("DELETE")
	api.HandleFunc("/institutions/{id}/archive", institutionHandler.Archive).Methods("PATCH")
	api.HandleFunc("/institutions/{id}/account-positions", institutionHandler.UpdateAccountPositionsInInstitution).Methods("PATCH")
	api.HandleFunc("/institutions/{id}/history", institutionHandler.GetHistory).Methods("GET")

	// Settings routes
	api.HandleFunc("/settings/total-formula", settingsHandler.GetTotalFormula).Methods("GET")
	api.HandleFunc("/settings/total-formula", settingsHandler.UpdateTotalFormula).Methods("PATCH")

	// Dashboard routes
	api.HandleFunc("/dashboards", dashboardHandler.GetAll).Methods("GET")
	api.HandleFunc("/dashboards", dashboardHandler.Create).Methods("POST")
	api.HandleFunc("/dashboards/{id}", dashboardHandler.GetByID).Methods("GET")
	api.HandleFunc("/dashboards/{id}", dashboardHandler.Update).Methods("PATCH")
	api.HandleFunc("/dashboards/{id}", dashboardHandler.Delete).Methods("DELETE")

	// Chart routes
	api.HandleFunc("/charts", chartHandler.GetAll).Methods("GET")
	api.HandleFunc("/charts", chartHandler.Create).Methods("POST")
	api.HandleFunc("/charts/{id}", chartHandler.GetByID).Methods("GET")
	api.HandleFunc("/charts/{id}", chartHandler.Update).Methods("PATCH")
	api.HandleFunc("/charts/{id}", chartHandler.Delete).Methods("DELETE")
	api.HandleFunc("/charts/{id}/history", chartHandler.GetHistory).Methods("GET")

	// Upload routes
	api.HandleFunc("/uploads", uploadHandler.GetAll).Methods("GET")
	api.HandleFunc("/uploads", uploadHandler.Create).Methods("POST")
	api.HandleFunc("/uploads/{id}", uploadHandler.GetByID).Methods("GET")
	api.HandleFunc("/uploads/{id}", uploadHandler.Delete).Methods("DELETE")
	api.HandleFunc("/uploads/{id}/data", uploadHandler.GetData).Methods("GET")
	api.HandleFunc("/uploads/{id}/datasets", datasetHandler.GetBySourceUploadID).Methods("GET")

	// Dataset routes
	api.HandleFunc("/datasets", datasetHandler.GetAll).Methods("GET")
	api.HandleFunc("/datasets", datasetHandler.Create).Methods("POST")
	api.HandleFunc("/datasets/{id}", datasetHandler.GetByID).Methods("GET")
	api.HandleFunc("/datasets/{id}", datasetHandler.Delete).Methods("DELETE")
	api.HandleFunc("/datasets/{id}/data", datasetHandler.GetData).Methods("GET")
	api.HandleFunc("/datasets/{id}/sources", datasetHandler.AddSource).Methods("POST")
	api.HandleFunc("/datasets/{id}/sources/{sourceId}", datasetHandler.RemoveSource).Methods("DELETE")
	api.HandleFunc("/datasets/{id}/rebuild", datasetHandler.Rebuild).Methods("POST")

	return r
}

func WithCORS(r *mux.Router) *cors.Cors {
	allowedOrigins := []string{"http://localhost:5173", "http://localhost:3000"}

	// Add CORS_ORIGIN from environment if set (for Railway deployment)
	if origin := os.Getenv("CORS_ORIGIN"); origin != "" {
		allowedOrigins = append(allowedOrigins, origin)
	}

	return cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
}
