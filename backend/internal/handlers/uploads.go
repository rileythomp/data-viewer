package handlers

import (
	"encoding/csv"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"finance-tracker/internal/models"
	"finance-tracker/internal/repository"

	"github.com/gorilla/mux"
)

const maxUploadSize = 50 * 1024 * 1024 // 50MB (increased from 10MB)
const batchSize = 100                  // Number of rows to process per batch

type UploadHandler struct {
	repo *repository.UploadRepository
}

func NewUploadHandler(repo *repository.UploadRepository) *UploadHandler {
	return &UploadHandler{repo: repo}
}

func (h *UploadHandler) GetAll(w http.ResponseWriter, r *http.Request) {
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

func (h *UploadHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid upload ID", http.StatusBadRequest)
		return
	}

	upload, err := h.repo.GetByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if upload == nil {
		http.Error(w, "Upload not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(upload)
}

func (h *UploadHandler) GetData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid upload ID", http.StatusBadRequest)
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

	response, err := h.repo.GetData(id, page, pageSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if response == nil {
		http.Error(w, "Upload not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *UploadHandler) Create(w http.ResponseWriter, r *http.Request) {
	// Limit upload size
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "File too large. Maximum size is 50MB.", http.StatusBadRequest)
		return
	}

	// Get form values
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}
	description := strings.TrimSpace(r.FormValue("description"))

	// Get the uploaded file
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Determine file type
	fileName := header.Filename
	fileSize := int(header.Size)
	var fileType string

	lowerName := strings.ToLower(fileName)
	if strings.HasSuffix(lowerName, ".csv") {
		fileType = "csv"
	} else if strings.HasSuffix(lowerName, ".json") {
		fileType = "json"
	} else {
		http.Error(w, "Invalid file type. Only CSV and JSON files are supported.", http.StatusBadRequest)
		return
	}

	// For smaller files (< 5MB), process synchronously for faster response
	if fileSize < 5*1024*1024 {
		// Read file content
		content, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, "Failed to read file", http.StatusInternalServerError)
			return
		}

		// Parse file based on type
		var columns []string
		var data [][]any

		if fileType == "csv" {
			columns, data, err = parseCSV(content)
		} else {
			columns, data, err = parseJSON(content)
		}
		if err != nil {
			http.Error(w, "Failed to parse file: "+err.Error(), http.StatusBadRequest)
			return
		}

		// Create upload request
		req := &models.CreateUploadRequest{
			Name:        name,
			Description: description,
			FileName:    fileName,
			FileType:    fileType,
			FileSize:    fileSize,
			Columns:     columns,
			Data:        data,
		}

		upload, err := h.repo.Create(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(upload)
		return
	}

	// For larger files, process asynchronously
	// Read file content into memory (we need it for background processing)
	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	// Create upload metadata with 'processing' status
	metadataReq := &models.CreateUploadMetadataRequest{
		Name:        name,
		Description: description,
		FileName:    fileName,
		FileType:    fileType,
		FileSize:    fileSize,
		Columns:     []string{}, // Will be populated during processing
		Status:      "processing",
	}

	upload, err := h.repo.CreateMetadata(metadataReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Process file in background
	go h.processFileAsync(upload.ID, fileType, content)

	// Return 202 Accepted with upload metadata
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(upload)
}

// processFileAsync handles file parsing and row insertion in the background
func (h *UploadHandler) processFileAsync(uploadID int, fileType string, content []byte) {
	var columns []string
	var rowCount int
	var err error

	if fileType == "csv" {
		columns, rowCount, err = h.streamParseCSV(uploadID, content)
	} else {
		columns, rowCount, err = h.streamParseJSON(uploadID, content)
	}

	if err != nil {
		log.Printf("Failed to process upload %d: %v", uploadID, err)
		h.repo.UpdateStatus(uploadID, "failed", err.Error())
		return
	}

	// Update columns if needed
	if len(columns) > 0 {
		if err := h.repo.UpdateColumns(uploadID, columns); err != nil {
			log.Printf("Failed to update columns for upload %d: %v", uploadID, err)
		}
	}

	// Update row count
	if err := h.repo.UpdateRowCount(uploadID, rowCount); err != nil {
		log.Printf("Failed to update row count for upload %d: %v", uploadID, err)
	}

	// Mark as completed
	if err := h.repo.UpdateStatus(uploadID, "completed", ""); err != nil {
		log.Printf("Failed to update status for upload %d: %v", uploadID, err)
	}
}

// streamParseCSV parses CSV content and inserts rows in batches
func (h *UploadHandler) streamParseCSV(uploadID int, content []byte) ([]string, int, error) {
	reader := csv.NewReader(strings.NewReader(string(content)))

	// Read header row
	headers, err := reader.Read()
	if err != nil {
		return nil, 0, err
	}

	// Create sorted column order for consistent ordering across file types
	sortedHeaders := make([]string, len(headers))
	copy(sortedHeaders, headers)
	sort.Strings(sortedHeaders)

	// Build index mapping from sorted position to original position
	originalIndex := make(map[string]int)
	for i, h := range headers {
		originalIndex[h] = i
	}

	var batch [][]any
	rowIndex := 0

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, 0, err
		}

		// Convert and reorder to match sorted column order
		row := make([]any, len(record))
		for i, col := range sortedHeaders {
			row[i] = record[originalIndex[col]]
		}
		batch = append(batch, row)

		// Insert batch when full
		if len(batch) >= batchSize {
			if err := h.repo.InsertRowsBatch(uploadID, rowIndex, batch); err != nil {
				return nil, 0, err
			}
			rowIndex += len(batch)
			batch = nil
		}
	}

	// Insert remaining rows
	if len(batch) > 0 {
		if err := h.repo.InsertRowsBatch(uploadID, rowIndex, batch); err != nil {
			return nil, 0, err
		}
		rowIndex += len(batch)
	}

	return sortedHeaders, rowIndex, nil
}

// streamParseJSON parses JSON content and inserts rows in batches
func (h *UploadHandler) streamParseJSON(uploadID int, content []byte) ([]string, int, error) {
	// Try to parse as array of objects
	var objects []map[string]any
	if err := json.Unmarshal(content, &objects); err != nil {
		// Try to parse as single object (wrap in array)
		var singleObject map[string]any
		if err := json.Unmarshal(content, &singleObject); err != nil {
			return nil, 0, err
		}
		objects = []map[string]any{singleObject}
	}

	if len(objects) == 0 {
		return []string{}, 0, nil
	}

	// Extract column names from first object and sort for consistent ordering
	var columns []string
	for key := range objects[0] {
		columns = append(columns, key)
	}
	sort.Strings(columns)

	var batch [][]any
	rowIndex := 0

	for _, obj := range objects {
		row := make([]any, len(columns))
		for i, col := range columns {
			row[i] = obj[col]
		}
		batch = append(batch, row)

		// Insert batch when full
		if len(batch) >= batchSize {
			if err := h.repo.InsertRowsBatch(uploadID, rowIndex, batch); err != nil {
				return nil, 0, err
			}
			rowIndex += len(batch)
			batch = nil
		}
	}

	// Insert remaining rows
	if len(batch) > 0 {
		if err := h.repo.InsertRowsBatch(uploadID, rowIndex, batch); err != nil {
			return nil, 0, err
		}
		rowIndex += len(batch)
	}

	return columns, rowIndex, nil
}

func (h *UploadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid upload ID", http.StatusBadRequest)
		return
	}

	err = h.repo.Delete(id)
	if err != nil {
		if err.Error() == "upload not found" {
			http.Error(w, "Upload not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func parseCSV(content []byte) ([]string, [][]any, error) {
	reader := csv.NewReader(strings.NewReader(string(content)))

	// Read header row
	headers, err := reader.Read()
	if err != nil {
		return nil, nil, err
	}

	// Create sorted column order for consistent ordering across file types
	sortedHeaders := make([]string, len(headers))
	copy(sortedHeaders, headers)
	sort.Strings(sortedHeaders)

	// Build index mapping from sorted position to original position
	originalIndex := make(map[string]int)
	for i, h := range headers {
		originalIndex[h] = i
	}

	// Read all data rows
	var data [][]any
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, err
		}

		// Convert and reorder to match sorted column order
		row := make([]any, len(record))
		for i, col := range sortedHeaders {
			row[i] = record[originalIndex[col]]
		}
		data = append(data, row)
	}

	return sortedHeaders, data, nil
}

func parseJSON(content []byte) ([]string, [][]any, error) {
	// Try to parse as array of objects
	var objects []map[string]any
	if err := json.Unmarshal(content, &objects); err != nil {
		// Try to parse as single object (wrap in array)
		var singleObject map[string]any
		if err := json.Unmarshal(content, &singleObject); err != nil {
			return nil, nil, err
		}
		objects = []map[string]any{singleObject}
	}

	if len(objects) == 0 {
		return []string{}, [][]any{}, nil
	}

	// Extract column names from first object and sort for consistent ordering
	var columns []string
	for key := range objects[0] {
		columns = append(columns, key)
	}
	sort.Strings(columns)

	// Convert objects to rows
	var data [][]any
	for _, obj := range objects {
		row := make([]any, len(columns))
		for i, col := range columns {
			row[i] = obj[col]
		}
		data = append(data, row)
	}

	return columns, data, nil
}
