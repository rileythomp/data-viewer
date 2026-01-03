import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function NavBar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Finance Tracker
      </Link>
      <div className="navbar-actions">
        <Link to="/settings" className="btn-icon" title="Settings">
          <Settings size={18} />
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
