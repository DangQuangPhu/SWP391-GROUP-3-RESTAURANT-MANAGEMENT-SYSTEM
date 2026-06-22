import { useNavigate } from 'react-router-dom';
import { MOCK_KPI, MOCK_AUDIT_LOGS } from '../data/adminMockData';
import './AdminDashboardPage.css';

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const kpiCards = [
    { label: 'Total accounts', value: MOCK_KPI.totalAccounts, hint: '+3 this month' },
    { label: 'Active staff', value: `${MOCK_KPI.activeStaff} / ${MOCK_KPI.totalAccounts}`, hint: `${Math.round((MOCK_KPI.activeStaff / MOCK_KPI.totalAccounts) * 100)}% active` },
    { label: 'Pending role requests', value: MOCK_KPI.pendingRoleRequests, hint: 'Awaiting approval', tone: 'warning' },
    { label: 'Audit entries today', value: MOCK_KPI.auditEntriesToday, hint: 'Across all staff' },
    { label: 'Reservations (30d)', value: MOCK_KPI.reservations30d.toLocaleString('en-US'), hint: '+12% vs prior period' },
    { label: 'Revenue (30d)', value: `${(MOCK_KPI.revenue30d / 1_000_000).toFixed(1)}M đ`, hint: 'System-wide total' },
    { label: 'Reviews needing reply', value: MOCK_KPI.reviewsNeedingReply, hint: 'Rating ≤ 3 stars', tone: 'danger' },
    { label: 'Staff performance flags', value: MOCK_KPI.staffPerformanceFlags, hint: 'Below target this week' },
  ];

  return (
    <div>
      <div className="adp-toolbar">
        <p className="adp-subtitle">System-wide overview · Today's snapshot</p>
        <button className="adp-btn-primary" onClick={() => navigate('/admin/accounts')}>
          <i className="ti ti-user-plus" aria-hidden="true" /> New account
        </button>
      </div>

      <div className="adp-kpi-grid">
        {kpiCards.map((card) => (
          <div className="adp-kpi-card" key={card.label}>
            <p className="adp-kpi-label">{card.label}</p>
            <p className={`adp-kpi-value ${card.tone ? `adp-tone-${card.tone}` : ''}`}>{card.value}</p>
            <p className="adp-kpi-hint">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="adp-panel">
        <div className="adp-panel-header">
          <p className="adp-panel-title">Recent audit log activity</p>
          <button className="adp-link-btn" onClick={() => navigate('/admin/audit-logs')}>
            View all
          </button>
        </div>
        <table className="adp-table">
          <tbody>
            {MOCK_AUDIT_LOGS.map((log, i) => (
              <tr key={i}>
                <td className="adp-table-time">{log.time}</td>
                <td className="adp-table-action">{log.action}</td>
                <td className="adp-table-actor">{log.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="adp-section-title">Quick actions</p>
      <div className="adp-quick-actions">
        <button onClick={() => navigate('/admin/accounts')}>
          <i className="ti ti-user-plus" aria-hidden="true" /> Create account
        </button>
        <button onClick={() => navigate('/admin/roles')}>
          <i className="ti ti-shield-check" aria-hidden="true" /> Configure roles
        </button>
        <button onClick={() => navigate('/admin/audit-logs')}>
          <i className="ti ti-file-text" aria-hidden="true" /> View audit logs
        </button>
        <button onClick={() => navigate('/admin/settings/system')}>
          <i className="ti ti-adjustments" aria-hidden="true" /> System settings
        </button>
      </div>
    </div>
  );
}
