import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function NavBar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Finance Tracker
      </Link>
      <ThemeToggle />
    </nav>
  );
}
