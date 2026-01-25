package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"finance-tracker/internal/models"
	"finance-tracker/internal/repository"

	"github.com/gorilla/mux"
)

type InstitutionHandler struct {
	groupRepo *repository.AccountGroupRepository
}

func NewInstitutionHandler(groupRepo *repository.AccountGroupRepository) *InstitutionHandler {
	return &InstitutionHandler{groupRepo: groupRepo}
}

func (h *InstitutionHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	institutions, err := h.groupRepo.GetAllInstitutions()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if institutions == nil {
		institutions = []models.InstitutionWithAccounts{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(institutions)
}

func (h *InstitutionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid institution ID", http.StatusBadRequest)
		return
	}

	institution, err := h.groupRepo.GetInstitutionWithAccounts(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if institution == nil {
		http.Error(w, "Institution not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(institution)
}

func (h *InstitutionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateInstitutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Institution name is required", http.StatusBadRequest)
		return
	}

	institution, err := h.groupRepo.CreateInstitution(&req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(institution)
}

func (h *InstitutionHandler) Update(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid institution ID", http.StatusBadRequest)
		return
	}

	var req models.UpdateInstitutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Institution name is required", http.StatusBadRequest)
		return
	}

	institution, err := h.groupRepo.UpdateInstitution(id, &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(institution)
}

func (h *InstitutionHandler) Archive(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid institution ID", http.StatusBadRequest)
		return
	}

	institution, err := h.groupRepo.ArchiveInstitution(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(institution)
}

func (h *InstitutionHandler) Unarchive(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid institution ID", http.StatusBadRequest)
		return
	}

	institution, err := h.groupRepo.UnarchiveInstitution(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(institution)
}

func (h *InstitutionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid institution ID", http.StatusBadRequest)
		return
	}

	err = h.groupRepo.DeleteInstitution(id)
	if err != nil {
		if err.Error() == "institution not found" {
			http.Error(w, "Institution not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *InstitutionHandler) GetAllIncludingArchived(w http.ResponseWriter, r *http.Request) {
	institutions, err := h.groupRepo.GetAllInstitutionsIncludingArchived()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if institutions == nil {
		institutions = []models.Institution{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(institutions)
}

func (h *InstitutionHandler) UpdateAccountPositionsInInstitution(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	institutionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid institution ID", http.StatusBadRequest)
		return
	}

	var req models.UpdateAccountPositionsInGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Positions) == 0 {
		http.Error(w, "Positions array is required", http.StatusBadRequest)
		return
	}

	if err := h.groupRepo.UpdateAccountPositionsInInstitution(institutionID, req.Positions); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *InstitutionHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid institution ID", http.StatusBadRequest)
		return
	}

	history, err := h.groupRepo.GetInstitutionHistory(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if history == nil {
		history = []models.GroupBalanceHistory{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}
