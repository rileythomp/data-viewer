package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"finance-tracker/internal/models"
	"finance-tracker/internal/repository"

	"github.com/gorilla/mux"
)

type ChartHandler struct {
	repo *repository.ChartRepository
}

func NewChartHandler(repo *repository.ChartRepository) *ChartHandler {
	return &ChartHandler{repo: repo}
}

func (h *ChartHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	// Parse pagination params
	page := 1
	pageSize := 20

	if p := r.URL.Query().Get("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if ps := r.URL.Query().Get("page_size"); ps != "" {
		if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 && parsed <= 100 {
			pageSize = parsed
		}
	}

	response, err := h.repo.GetAll(page, pageSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *ChartHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid chart ID", http.StatusBadRequest)
		return
	}

	chart, err := h.repo.GetWithItems(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if chart == nil {
		http.Error(w, "Chart not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chart)
}

func (h *ChartHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateChartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Chart name is required", http.StatusBadRequest)
		return
	}

	// Validate mutual exclusivity
	hasDatasetConfig := req.DatasetConfig != nil
	hasAccountsGroups := len(req.AccountIDs) > 0 || len(req.GroupIDs) > 0

	if hasDatasetConfig && hasAccountsGroups {
		http.Error(w, "Cannot specify both dataset config and accounts/groups", http.StatusBadRequest)
		return
	}

	// Validate dataset config if provided
	if hasDatasetConfig {
		if req.DatasetConfig.DatasetID == 0 {
			http.Error(w, "Dataset ID is required", http.StatusBadRequest)
			return
		}
		if req.DatasetConfig.ChartType != "line" && req.DatasetConfig.ChartType != "pie" {
			http.Error(w, "Chart type must be 'line' or 'pie'", http.StatusBadRequest)
			return
		}
		if req.DatasetConfig.ChartType == "line" {
			if req.DatasetConfig.XColumn == "" || len(req.DatasetConfig.YColumns) == 0 {
				http.Error(w, "Line charts require x_column and y_columns", http.StatusBadRequest)
				return
			}
		}
		if req.DatasetConfig.ChartType == "pie" {
			if req.DatasetConfig.AggregationField == "" || req.DatasetConfig.AggregationValue == "" {
				http.Error(w, "Pie charts require aggregation_field and aggregation_value", http.StatusBadRequest)
				return
			}
			if req.DatasetConfig.AggregationOperator == "" {
				req.DatasetConfig.AggregationOperator = "SUM" // Default
			}
			if req.DatasetConfig.AggregationOperator != "SUM" && req.DatasetConfig.AggregationOperator != "COUNT" {
				http.Error(w, "Aggregation operator must be 'SUM' or 'COUNT'", http.StatusBadRequest)
				return
			}
		}
	}

	chart, err := h.repo.Create(&req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(chart)
}

func (h *ChartHandler) Update(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid chart ID", http.StatusBadRequest)
		return
	}

	var req models.UpdateChartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Chart name is required", http.StatusBadRequest)
		return
	}

	// Validate mutual exclusivity
	hasDatasetConfig := req.DatasetConfig != nil
	hasAccountsGroups := len(req.AccountIDs) > 0 || len(req.GroupIDs) > 0

	if hasDatasetConfig && hasAccountsGroups {
		http.Error(w, "Cannot specify both dataset config and accounts/groups", http.StatusBadRequest)
		return
	}

	// Validate dataset config if provided
	if hasDatasetConfig {
		if req.DatasetConfig.DatasetID == 0 {
			http.Error(w, "Dataset ID is required", http.StatusBadRequest)
			return
		}
		if req.DatasetConfig.ChartType != "line" && req.DatasetConfig.ChartType != "pie" {
			http.Error(w, "Chart type must be 'line' or 'pie'", http.StatusBadRequest)
			return
		}
		if req.DatasetConfig.ChartType == "line" {
			if req.DatasetConfig.XColumn == "" || len(req.DatasetConfig.YColumns) == 0 {
				http.Error(w, "Line charts require x_column and y_columns", http.StatusBadRequest)
				return
			}
		}
		if req.DatasetConfig.ChartType == "pie" {
			if req.DatasetConfig.AggregationField == "" || req.DatasetConfig.AggregationValue == "" {
				http.Error(w, "Pie charts require aggregation_field and aggregation_value", http.StatusBadRequest)
				return
			}
			if req.DatasetConfig.AggregationOperator == "" {
				req.DatasetConfig.AggregationOperator = "SUM" // Default
			}
			if req.DatasetConfig.AggregationOperator != "SUM" && req.DatasetConfig.AggregationOperator != "COUNT" {
				http.Error(w, "Aggregation operator must be 'SUM' or 'COUNT'", http.StatusBadRequest)
				return
			}
		}
	}

	chart, err := h.repo.Update(id, &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if chart == nil {
		http.Error(w, "Chart not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chart)
}

func (h *ChartHandler) Delete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid chart ID", http.StatusBadRequest)
		return
	}

	err = h.repo.Delete(id)
	if err != nil {
		if err.Error() == "chart not found" {
			http.Error(w, "Chart not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *ChartHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid chart ID", http.StatusBadRequest)
		return
	}

	history, err := h.repo.GetChartHistory(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}
