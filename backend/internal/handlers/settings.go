package handlers

import (
	"encoding/json"
	"net/http"

	"finance-tracker/internal/models"
	"finance-tracker/internal/repository"
)

type SettingsHandler struct {
	repo *repository.SettingsRepository
}

func NewSettingsHandler(repo *repository.SettingsRepository) *SettingsHandler {
	return &SettingsHandler{repo: repo}
}

func (h *SettingsHandler) GetTotalFormula(w http.ResponseWriter, r *http.Request) {
	config, err := h.repo.GetTotalFormula()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func (h *SettingsHandler) UpdateTotalFormula(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateTotalFormulaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Ensure formula is not nil
	if req.Formula == nil {
		req.Formula = []models.TotalFormulaItem{}
	}

	config := &models.TotalFormulaConfig{
		IsEnabled: req.IsEnabled,
		Formula:   req.Formula,
	}

	if err := h.repo.UpdateTotalFormula(config); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}
