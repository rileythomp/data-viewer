import {
  ChevronLeft,
  ChevronRight,
  Database,
  Home,
  LayoutDashboard,
  Settings,
  Wallet
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/accounts', icon: Wallet, label: 'Accounts' },
  { path: '/dashboards', icon: LayoutDashboard, label: 'Dashboards' },
  { path: '/datasets', icon: Database, label: 'Datasets' },
];

export default function Sidebar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }, [isCollapsed]);

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-top">
        <div className="sidebar-logo">
          {!isCollapsed && <span className="logo-text">Finances</span>}
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${active ? 'nav-item-active' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-divider" />
        <Link
          to="/settings"
          className={`nav-item ${isActive('/settings') ? 'nav-item-active' : ''}`}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings size={20} />
          {!isCollapsed && <span className="nav-label">Settings</span>}
        </Link>
        <div className="sidebar-actions">
          <button
            className="btn-collapse"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
