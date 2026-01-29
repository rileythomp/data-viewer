package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"finance-tracker/internal/models"
	"finance-tracker/internal/repository"

	"github.com/gorilla/mux"
)

type DatasetHandler struct {
	repo *repository.DatasetRepository
}

func NewDatasetHandler(repo *repository.DatasetRepository) *DatasetHandler {
	return &DatasetHandler{repo: repo}
}

func (h *DatasetHandler) GetAll(w http.ResponseWriter, r *http.Request) {
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

func (h *DatasetHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid dataset ID", http.StatusBadRequest)
		return
	}

	dataset, err := h.repo.GetByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if dataset == nil {
		http.Error(w, "Dataset not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dataset)
}

func (h *DatasetHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateDatasetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	if req.FolderPath == "" {
		http.Error(w, "Folder path is required", http.StatusBadRequest)
		return
	}

	dataset, err := h.repo.Create(&req)
	if err != nil {
		if repository.IsValidationError(err) {
			http.Error(w, err.Error(), http.StatusBadRequest)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(dataset)
}

func (h *DatasetHandler) Delete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid dataset ID", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *DatasetHandler) GetData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid dataset ID", http.StatusBadRequest)
		return
	}

	// Parse pagination params
	page := 1
	pageSize := 50

	if p := r.URL.Query().Get("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if ps := r.URL.Query().Get("page_size"); ps != "" {
		if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 && parsed <= 500 {
			pageSize = parsed
		}
	}

	sortColumn := r.URL.Query().Get("sort_column")
	sortDirection := r.URL.Query().Get("sort_direction")

	response, err := h.repo.GetData(id, page, pageSize, sortColumn, sortDirection)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if response == nil {
		http.Error(w, "Dataset not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *DatasetHandler) Sync(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid dataset ID", http.StatusBadRequest)
		return
	}

	if err := h.repo.SyncDataset(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return updated dataset
	dataset, err := h.repo.GetByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dataset)
}

func (h *DatasetHandler) GetSyncStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid dataset ID", http.StatusBadRequest)
		return
	}

	syncing := h.repo.IsSyncing(id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"syncing": syncing})
}
