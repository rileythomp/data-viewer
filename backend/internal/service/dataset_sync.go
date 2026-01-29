package service

import (
	"database/sql"
	"fmt"
	"sync"
	"time"

	"finance-tracker/internal/datasource"
	"finance-tracker/internal/git"
	"finance-tracker/internal/storage"
)

// DatasetInfo contains the dataset information needed for sync operations
type DatasetInfo struct {
	ID             int
	Name           string
	TableName      string
	FolderPath     string
	LastCommitHash sql.NullString
	Status         string
}

// DatasetSyncService handles syncing datasets from their source folders
type DatasetSyncService struct {
	gitManager   *git.Manager
	folderReader *datasource.FolderReader
	storage      storage.DatasetStorage
	db           *sql.DB

	// Track datasets currently being synced to prevent concurrent syncs
	syncingMu sync.Mutex
	syncing   map[int]bool
}

// NewDatasetSyncService creates a new sync service
func NewDatasetSyncService(db *sql.DB, storage storage.DatasetStorage) *DatasetSyncService {
	return &DatasetSyncService{
		gitManager:   git.NewManager(),
		folderReader: datasource.NewFolderReader(),
		storage:      storage,
		db:           db,
		syncing:      make(map[int]bool),
	}
}

// IsSyncing checks if a dataset is currently being synced
func (s *DatasetSyncService) IsSyncing(datasetID int) bool {
	s.syncingMu.Lock()
	defer s.syncingMu.Unlock()
	return s.syncing[datasetID]
}

// NeedsSync checks if a dataset needs to be synced based on git changes
func (s *DatasetSyncService) NeedsSync(dataset *DatasetInfo) (bool, error) {
	if dataset.FolderPath == "" {
		return false, fmt.Errorf("dataset has no folder path configured")
	}

	// If no previous commit hash, we need initial sync
	if !dataset.LastCommitHash.Valid || dataset.LastCommitHash.String == "" {
		return true, nil
	}

	// Check if there are changes since last sync
	hasChanges, err := s.gitManager.HasChangesSince(dataset.FolderPath, dataset.LastCommitHash.String)
	if err != nil {
		return false, fmt.Errorf("failed to check for changes: %w", err)
	}

	return hasChanges, nil
}

// SyncDataset syncs the dataset from its source folder
// Returns the new commit hash and row count, or an error
func (s *DatasetSyncService) SyncDataset(dataset *DatasetInfo) (commitHash string, rowCount int, err error) {
	// Mark as syncing
	s.syncingMu.Lock()
	if s.syncing[dataset.ID] {
		s.syncingMu.Unlock()
		return "", 0, fmt.Errorf("dataset is already being synced")
	}
	s.syncing[dataset.ID] = true
	s.syncingMu.Unlock()

	defer func() {
		s.syncingMu.Lock()
		delete(s.syncing, dataset.ID)
		s.syncingMu.Unlock()
	}()

	// Update status to syncing
	if err := s.updateStatus(dataset.ID, "syncing", ""); err != nil {
		return "", 0, fmt.Errorf("failed to update status: %w", err)
	}

	// Commit any uncommitted changes in the folder
	commitHash, err = s.gitManager.CommitAll(dataset.FolderPath, fmt.Sprintf("Dataset sync at %s", time.Now().Format(time.RFC3339)))
	if err != nil {
		s.updateStatus(dataset.ID, "error", fmt.Sprintf("Git commit failed: %v", err))
		return "", 0, fmt.Errorf("failed to commit changes: %w", err)
	}

	// Read all CSV data from folder
	folderData, err := s.folderReader.ReadFolder(dataset.FolderPath)
	if err != nil {
		s.updateStatus(dataset.ID, "error", fmt.Sprintf("Failed to read folder: %v", err))
		return "", 0, fmt.Errorf("failed to read folder data: %w", err)
	}

	// Store data using the storage interface
	if err := s.storage.StoreData(dataset.ID, dataset.TableName, folderData.Columns, folderData.Rows); err != nil {
		s.updateStatus(dataset.ID, "error", fmt.Sprintf("Failed to store data: %v", err))
		return "", 0, fmt.Errorf("failed to store data: %w", err)
	}

	rowCount = len(folderData.Rows)

	// Update dataset with new sync info
	if err := s.updateSyncInfo(dataset.ID, commitHash, rowCount); err != nil {
		return "", 0, fmt.Errorf("failed to update sync info: %w", err)
	}

	return commitHash, rowCount, nil
}

// SyncIfNeeded checks if sync is needed and performs it if so
// Returns true if a sync was performed
func (s *DatasetSyncService) SyncIfNeeded(dataset *DatasetInfo) (synced bool, err error) {
	needsSync, err := s.NeedsSync(dataset)
	if err != nil {
		return false, err
	}

	if !needsSync {
		return false, nil
	}

	_, _, err = s.SyncDataset(dataset)
	if err != nil {
		return false, err
	}

	return true, nil
}

// InitializeDataset initializes git tracking for a new dataset
// Returns the initial commit hash
func (s *DatasetSyncService) InitializeDataset(folderPath string) (string, error) {
	// Validate folder first
	if err := s.folderReader.ValidateFolder(folderPath); err != nil {
		return "", err
	}

	// Initialize git repo
	commitHash, err := s.gitManager.InitRepo(folderPath)
	if err != nil {
		return "", fmt.Errorf("failed to initialize git repo: %w", err)
	}

	return commitHash, nil
}

// updateStatus updates the dataset status in the database
func (s *DatasetSyncService) updateStatus(datasetID int, status, errorMessage string) error {
	var err error
	if errorMessage != "" {
		_, err = s.db.Exec(`
			UPDATE datasets
			SET status = $1, error_message = $2, updated_at = NOW()
			WHERE id = $3
		`, status, errorMessage, datasetID)
	} else {
		_, err = s.db.Exec(`
			UPDATE datasets
			SET status = $1, error_message = NULL, updated_at = NOW()
			WHERE id = $2
		`, status, datasetID)
	}
	return err
}

// updateSyncInfo updates the dataset with sync results
func (s *DatasetSyncService) updateSyncInfo(datasetID int, commitHash string, rowCount int) error {
	_, err := s.db.Exec(`
		UPDATE datasets
		SET status = 'ready',
		    error_message = NULL,
		    last_commit_hash = $1,
		    last_synced_at = NOW(),
		    row_count = $2,
		    updated_at = NOW()
		WHERE id = $3
	`, commitHash, rowCount, datasetID)
	return err
}
