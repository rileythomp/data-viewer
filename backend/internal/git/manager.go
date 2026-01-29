package git

import (
	"fmt"
	"os/exec"
	"strings"
)

// Manager handles git operations for dataset folders
type Manager struct{}

// NewManager creates a new git manager
func NewManager() *Manager {
	return &Manager{}
}

// InitRepo initializes a git repository in the given folder if not already initialized
// Returns the initial commit hash
func (m *Manager) InitRepo(folderPath string) (string, error) {
	// Check if already a git repo
	cmd := exec.Command("git", "-C", folderPath, "rev-parse", "--git-dir")
	if err := cmd.Run(); err != nil {
		// Not a git repo, initialize it
		cmd = exec.Command("git", "-C", folderPath, "init")
		if err := cmd.Run(); err != nil {
			return "", fmt.Errorf("failed to init git repo: %w", err)
		}
	}

	// Add all files
	cmd = exec.Command("git", "-C", folderPath, "add", "-A")
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to add files: %w", err)
	}

	// Create initial commit (or get current HEAD if no changes)
	cmd = exec.Command("git", "-C", folderPath, "commit", "-m", "Initial dataset commit", "--allow-empty")
	cmd.Run() // Ignore error if nothing to commit

	// Get current commit hash
	return m.GetHeadCommit(folderPath)
}

// GetHeadCommit returns the current HEAD commit hash
func (m *Manager) GetHeadCommit(folderPath string) (string, error) {
	cmd := exec.Command("git", "-C", folderPath, "rev-parse", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get HEAD commit: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}

// HasChangesSince checks if there are any changes since the given commit
func (m *Manager) HasChangesSince(folderPath, commitHash string) (bool, error) {
	// First check for uncommitted changes
	cmd := exec.Command("git", "-C", folderPath, "status", "--porcelain")
	output, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to check git status: %w", err)
	}
	if len(strings.TrimSpace(string(output))) > 0 {
		return true, nil
	}

	// Check if HEAD is different from the given commit
	currentHash, err := m.GetHeadCommit(folderPath)
	if err != nil {
		return false, err
	}

	return currentHash != commitHash, nil
}

// CommitAll stages and commits all changes in the folder
// Returns the new commit hash
func (m *Manager) CommitAll(folderPath, message string) (string, error) {
	// Add all changes
	cmd := exec.Command("git", "-C", folderPath, "add", "-A")
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to add files: %w", err)
	}

	// Commit
	cmd = exec.Command("git", "-C", folderPath, "commit", "-m", message, "--allow-empty")
	if err := cmd.Run(); err != nil {
		// If no changes, that's okay
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return m.GetHeadCommit(folderPath)
		}
		return "", fmt.Errorf("failed to commit: %w", err)
	}

	return m.GetHeadCommit(folderPath)
}
