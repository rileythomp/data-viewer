package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"finance-tracker/internal/config"
	"finance-tracker/internal/database"
	"finance-tracker/internal/router"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "./migrations"
	}
	if err := database.RunMigrations(db, migrationsPath); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	r := router.New(db)
	c := router.WithCORS(r)

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("Server starting on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, c.Handler(r)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
