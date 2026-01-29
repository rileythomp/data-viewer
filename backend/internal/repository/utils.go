package repository

import (
	"fmt"
	"strings"
)

// sanitizeColumnName sanitizes a column name for use in SQL.
// It wraps the name in double quotes to preserve the original column name
// exactly as stored in the database.
func sanitizeColumnName(name string) string {
	escaped := strings.ReplaceAll(name, "\"", "\"\"")
	return fmt.Sprintf("\"%s\"", escaped)
}
