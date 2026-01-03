package repository

import (
	"database/sql"
	"encoding/json"

	"finance-tracker/internal/models"
)

type SettingsRepository struct {
	db *sql.DB
}

func NewSettingsRepository(db *sql.DB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

func (r *SettingsRepository) GetTotalFormula() (*models.TotalFormulaConfig, error) {
	query := `SELECT value FROM app_settings WHERE key = 'total_formula'`
	var valueJSON []byte
	err := r.db.QueryRow(query).Scan(&valueJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return default config if not found
			return &models.TotalFormulaConfig{
				IsEnabled: false,
				Formula:   []models.TotalFormulaItem{},
			}, nil
		}
		return nil, err
	}

	var config models.TotalFormulaConfig
	if err := json.Unmarshal(valueJSON, &config); err != nil {
		return nil, err
	}

	// Ensure formula is not nil
	if config.Formula == nil {
		config.Formula = []models.TotalFormulaItem{}
	}

	return &config, nil
}

func (r *SettingsRepository) UpdateTotalFormula(config *models.TotalFormulaConfig) error {
	valueJSON, err := json.Marshal(config)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO app_settings (key, value, updated_at)
		VALUES ('total_formula', $1, NOW())
		ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
	`
	_, err = r.db.Exec(query, valueJSON)
	return err
}
