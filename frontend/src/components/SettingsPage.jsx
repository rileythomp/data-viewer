import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Settings</h1>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Appearance</h2>
        <div className="settings-option">
          <div className="settings-option-info">
            <span className="settings-option-label">Theme</span>
            <span className="settings-option-description">
              Switch between light and dark mode
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="btn-secondary settings-theme-btn"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
}
