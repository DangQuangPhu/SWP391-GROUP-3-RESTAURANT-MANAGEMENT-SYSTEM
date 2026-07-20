import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Gem, Clock, Ticket, TrendingUp, CheckCircle2, AlertTriangle, Loader2, Star } from 'lucide-react';
import { getLoyaltyBalance, getLoyaltyCatalog, redeemVoucher, getMyVouchers } from '../services/loyaltyApi.js';
import { format } from 'date-fns';
import { useAuth } from '@/features/auth/context/AuthContext';
import '../styles/loyalty.css';

// ─── Design tokens (matching profile.css) ─────────────────────────────────────
const T = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  primary: '#7A2E2E',
  primaryLight: '#FDF3E7',
  gold: '#C9A227',
  goldLight: '#FEF3C7',
  olive: '#8B7355',
  success: '#5B8C5A',
  danger: '#C1440E',
  textMain: '#2B2118',
  textMuted: '#8A7F73',
  border: '#ECE5DA',
  shadow: '0 2px 10px rgba(43,33,24,0.06)',
  shadowHover: '0 8px 24px rgba(43,33,24,0.12)',
  radius: '16px',
  radiusSm: '10px',
};

// ─── Animated counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ value }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = count;
    const end = parseInt(value, 10) || 0;
    if (start === end) return;
    const duration = 800;
    const increment = (end - start) / (duration / 16);
    let timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{count.toLocaleString()}</span>;
}

// ─── Countdown for active vouchers ────────────────────────────────────────────
function VoucherCountdown({ expiryDate, onExpired }) {
  const calcLeft = () => {
    const diff = new Date(expiryDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return {
      hours: Math.floor(diff / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      diff,
    };
  };
  const [timeLeft, setTimeLeft] = useState(calcLeft());
  useEffect(() => {
    const id = setInterval(() => {
      const r = calcLeft();
      setTimeLeft(r);
      if (!r) { clearInterval(id); onExpired?.(); }
    }, 1000);
    return () => clearInterval(id);
  }, [expiryDate]);

  if (!timeLeft) return <span className="voucher-countdown__expired">Expired</span>;
  const { hours, minutes, seconds, diff } = timeLeft;
  const pct = Math.min((diff / (24 * 3600000)) * 100, 100);
  const barColor = pct < 20 ? T.danger : pct < 50 ? '#D97706' : T.success;

  return (
    <div className="voucher-countdown__wrapper">
      <div className="voucher-countdown__header">
        <span className="voucher-countdown__label-wrap">
          <Clock size={11} /> Expires in:
        </span>
        <span className="voucher-countdown__timer" style={{ color: barColor }}>
          {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="voucher-countdown__track">
        <div className="voucher-countdown__bar" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="loyalty-section-header">
      <Icon size={18} className="loyalty-section-header__icon" />
      <h3 className="loyalty-section-header__title">{title}</h3>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function LoyaltyPointsPage() {
  const [balanceData, setBalanceData] = useState({ balance: 0, totalEarned: 0, totalRedeemed: 0 });
  const [catalog, setCatalog] = useState([]);
  const [myVouchers, setMyVouchers] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const { currentUser } = useAuth();
  const userId = currentUser?.user_id || currentUser?.userId || currentUser?.id;

  const loadLoyaltyData = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [balRes, catRes, vouchRes] = await Promise.all([
        getLoyaltyBalance(userId),
        getLoyaltyCatalog(userId),
        getMyVouchers(userId),
      ]);
      if (balRes?.success) setBalanceData(balRes);
      if (catRes?.success) setCatalog(catRes.catalog || []);
      if (vouchRes?.success) setMyVouchers(vouchRes.vouchers || []);
    } catch (err) {
      console.error('[LoyaltyPointsPage] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLoyaltyData(); }, [userId]);

  const handleRedeem = async () => {
    if (!selectedVoucher || !userId) return;
    setExchanging(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await redeemVoucher(userId, selectedVoucher.promotion_id);
      if (res?.success) {
        setActionSuccess(`Redeemed! Your voucher code: ${res.voucher.code}`);
        setSelectedVoucher(null);
        await loadLoyaltyData();
        setTimeout(() => setActionSuccess(''), 6000);
      } else {
        setActionError(res?.message || 'Failed to redeem voucher.');
        setTimeout(() => setActionError(''), 5000);
      }
    } catch (err) {
      setActionError(err?.message || 'An error occurred.');
      setTimeout(() => setActionError(''), 5000);
    } finally {
      setExchanging(false);
    }
  };

  const filteredVouchers = useMemo(() => myVouchers.filter(v => v.status === activeTab), [myVouchers, activeTab]);

  if (loading) {
    return (
      <div className="loyalty-page__loading">
        <Loader2 size={36} className="loyalty-page__loader" />
        <p>Loading loyalty points and rewards…</p>
      </div>
    );
  }

  return (
    <div className="loyalty-page">

      {/* ── Toast messages ── */}
      {actionSuccess && (
        <div className="loyalty-toast loyalty-toast--success">
          <CheckCircle2 size={18} className="loyalty-toast__icon--success" />
          <div className="loyalty-toast__body">
            <p className="loyalty-toast__title">Redemption Successful</p>
            <p className="loyalty-toast__msg">{actionSuccess}</p>
          </div>
          <button onClick={() => setActionSuccess('')} className="loyalty-toast__close loyalty-toast__close--success">×</button>
        </div>
      )}
      {actionError && (
        <div className="loyalty-toast loyalty-toast--error">
          <AlertTriangle size={18} className="loyalty-toast__icon--error" />
          <div className="loyalty-toast__body">
            <p className="loyalty-toast__title">Redemption Failed</p>
            <p className="loyalty-toast__msg">{actionError}</p>
          </div>
          <button onClick={() => setActionError('')} className="loyalty-toast__close loyalty-toast__close--error">×</button>
        </div>
      )}

      {/* ── Balance + Stats ── */}
      <section className="loyalty-balance">
        {/* Balance card */}
        <div className="loyalty-balance__card">
          {/* Decorative circles */}
          <div className="loyalty-balance__deco-1" />
          <div className="loyalty-balance__deco-2" />

          <div>
            <span className="loyalty-balance__label">Point Balance</span>
            <h2 className="loyalty-balance__value">
              <AnimatedCounter value={balanceData.balance} />
              <span className="loyalty-balance__unit">pts</span>
            </h2>
          </div>

          <div className="loyalty-balance__desc">
            <Star size={11} className="loyalty-balance__desc-icon" />
            1 Loyalty Point earned for every 10,000 VND paid at Phūrai checkout
          </div>
        </div>

        {/* Stats card */}
        <div className="loyalty-stats">
          <p className="loyalty-stats__title">Point Statistics</p>

          <div className="loyalty-stats__list">
            <div className="loyalty-stats__row loyalty-stats__row--border">
              <div className="loyalty-stats__label-wrap">
                <TrendingUp size={14} className="loyalty-stats__label-icon--success" />
                <span className="loyalty-stats__label">Total earned</span>
              </div>
              <span className="loyalty-stats__value">+{(balanceData.totalEarned || 0).toLocaleString()}</span>
            </div>

            <div className="loyalty-stats__row">
              <div className="loyalty-stats__label-wrap">
                <Gem size={14} className="loyalty-stats__label-icon--danger" />
                <span className="loyalty-stats__label">Total redeemed</span>
              </div>
              <span className="loyalty-stats__value">-{(balanceData.totalRedeemed || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rewards Catalog ── */}
      <section>
        <SectionHeader icon={Ticket} title="Exchange Rewards Catalog" />

        {catalog.length === 0 ? (
          <p className="loyalty-catalog__empty">No rewards available at the moment. Check back soon!</p>
        ) : (
          <div className="loyalty-catalog__grid">
            {catalog.map((promo) => {
              const userPoints = balanceData.balance || 0;
              const canRedeem = userPoints >= promo.points_required;
              const outOfStock = promo.remaining_quantity !== null && promo.remaining_quantity <= 0;

              return (
                <div key={promo.promotion_id} className="loyalty-catalog__card">
                  {outOfStock && (
                    <span className="loyalty-catalog__soldout">
                      Sold out
                    </span>
                  )}

                  <div className="loyalty-catalog__info">
                    <span className="loyalty-catalog__tag">
                      {promo.points_required} Points
                    </span>
                    <h4 className="loyalty-catalog__name">{promo.promotion_name}</h4>
                    <p className="loyalty-catalog__desc">
                      {promo.description || 'Redeem points for exclusive restaurant benefits.'}
                    </p>
                  </div>

                  <div className="loyalty-catalog__meta">
                    <span>Target: {promo.applicable_to === 'Both' ? 'All checkouts' : `${promo.applicable_to} only`}</span>
                    {promo.remaining_quantity !== null && <span>Stock: {promo.remaining_quantity} left</span>}
                  </div>

                  <button
                    onClick={() => setSelectedVoucher(promo)}
                    disabled={!canRedeem || outOfStock}
                    className="loyalty-catalog__btn"
                  >
                    {!canRedeem ? 'Insufficient Points' : outOfStock ? 'Sold Out' : 'Redeem Now'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── My Vouchers ── */}
      <section>
        <div className="loyalty-section-header loyalty-section-header--vouchers">
          <div className="loyalty-section-header__title-wrap">
            <Ticket size={18} className="loyalty-section-header__icon" />
            <h3 className="loyalty-section-header__title">My Vouchers</h3>
          </div>

          {/* Tab switcher */}
          <div className="loyalty-tabs">
            {['active', 'used', 'expired'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`loyalty-tabs__btn ${activeTab === tab ? 'loyalty-tabs__btn--active' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredVouchers.length === 0 ? (
          <p className="loyalty-vouchers__empty">No {activeTab} vouchers found.</p>
        ) : (
          <div className="loyalty-vouchers__grid">
            {filteredVouchers.map(voucher => (
              <div key={voucher.customer_voucher_id} className="loyalty-vouchers__card">
                {/* Decorative circle */}
                <div className="loyalty-vouchers__deco" />

                <div className="loyalty-vouchers__header">
                  <div className="loyalty-vouchers__title-wrap">
                    <h5 className="loyalty-vouchers__name">{voucher.promotion_name}</h5>
                    <p className="loyalty-vouchers__desc">{voucher.description}</p>
                  </div>
                  <span className="loyalty-vouchers__code">
                    {voucher.voucher_code}
                  </span>
                </div>

                <div className="loyalty-vouchers__footer">
                  {voucher.status === 'active' ? (
                    <VoucherCountdown expiryDate={voucher.expires_at} onExpired={() => loadLoyaltyData()} />
                  ) : voucher.status === 'used' ? (
                    <span className="loyalty-vouchers__status-used">
                      <CheckCircle2 size={12} className="loyalty-vouchers__status-used-icon" />
                      Used on {voucher.used_at ? format(new Date(voucher.used_at), 'MMM d, yyyy') : 'checkout'}
                    </span>
                  ) : (
                    <span className="loyalty-vouchers__status-expired">
                      Expired {format(new Date(voucher.expires_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Confirmation Modal ── */}
      {selectedVoucher && createPortal(
        <div className="loyalty-confirm-overlay">
          <div className="loyalty-confirm-card">
            {/* Header */}
            <div className="loyalty-confirm-card__header">
              <div className="loyalty-confirm-card__icon-wrapper">
                <Gem size={24} className="loyalty-confirm-card__icon" />
              </div>
              <h3 className="loyalty-confirm-card__title">Confirm Points Exchange</h3>
              <p className="loyalty-confirm-card__desc">This action cannot be undone. Your points will be deducted immediately.</p>
            </div>

            {/* Summary */}
            <div className="loyalty-confirm-card__summary">
              <div className="loyalty-confirm-card__row">
                <span>Current balance</span>
                <span className="loyalty-confirm-card__row--bold">{(balanceData.balance || 0).toLocaleString()} pts</span>
              </div>
              <div className="loyalty-confirm-card__row loyalty-confirm-card__row--danger">
                <span>Points to deduct</span>
                <span>−{selectedVoucher.points_required} pts</span>
              </div>
              <div className="loyalty-confirm-card__row loyalty-confirm-card__row--total">
                <span>Remaining balance</span>
                <span className="loyalty-confirm-card__row--success"><AnimatedCounter value={(balanceData.balance || 0) - selectedVoucher.points_required} /> pts</span>
              </div>
            </div>

            {/* Actions */}
            <div className="loyalty-confirm-card__actions">
              <button
                onClick={() => setSelectedVoucher(null)}
                disabled={exchanging}
                className="loyalty-confirm-card__btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={exchanging}
                className="loyalty-confirm-card__btn-confirm"
              >
                {exchanging ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Exchanging…</> : 'Confirm Exchange'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
