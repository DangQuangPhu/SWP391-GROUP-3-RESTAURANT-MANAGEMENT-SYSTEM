import { NavLink, Outlet } from 'react-router-dom';
import './AdminLayout.css';

const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [{ to: '/admin', icon: 'ti-layout-dashboard', label: 'Dashboard', end: true }],
  },
  {
    label: 'ACCOUNTS',
    items: [
      { to: '/admin/accounts', icon: 'ti-users', label: 'Accounts' },
      { to: '/admin/roles', icon: 'ti-shield-check', label: 'Roles & permissions' },
      { to: '/admin/audit-logs', icon: 'ti-file-text', label: 'Audit logs' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { to: '/admin/analytics/reservations', icon: 'ti-calendar-stats', label: 'Reservations' },
      { to: '/admin/analytics/revenue', icon: 'ti-chart-bar', label: 'Revenue' },
      { to: '/admin/analytics/orders', icon: 'ti-receipt', label: 'Orders' },
      { to: '/admin/analytics/reviews', icon: 'ti-star', label: 'Customer reviews' },
      { to: '/admin/analytics/staff-performance', icon: 'ti-trophy', label: 'Staff performance' },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { to: '/admin/settings/restaurant', icon: 'ti-building-store', label: 'Restaurant info' },
      { to: '/admin/settings/system', icon: 'ti-adjustments', label: 'System settings' },
      { to: '/admin/settings/floor-plan', icon: 'ti-layout-grid', label: 'Floor Plan Config' },
    ],
  },
];

export default function AdminLayout({ currentUser }) {
  return (
    <div className="al-shell">
      <aside className="al-sidebar">
        <div className="al-brand">
          <div className="al-brand-mark">P</div>
          <div>
            <p className="al-brand-name">Phūrai</p>
            <p className="al-brand-sub">ADMIN CONSOLE</p>
          </div>
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="al-nav-group">
            <p className="al-nav-label">{group.label}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `al-nav-item ${isActive ? 'al-nav-item-active' : ''}`}
              >
                <i className={`ti ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <div className="al-main">
        <header className="al-header">
          <div>
            <p className="al-header-title">Admin console</p>
          </div>
          <div className="al-header-user">
            <span>{currentUser?.fullName || 'Admin'}</span>
          </div>
        </header>
        <main className="al-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
