import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Gem, Clock, Ticket, TrendingUp, CheckCircle2, AlertTriangle, Loader2, Star } from 'lucide-react';
import { getLoyaltyBalance, getLoyaltyCatalog, redeemVoucher, getMyVouchers } from '../services/loyaltyApi.js';
import { format } from 'date-fns';
import { useAuth } from '@/features/auth/context/AuthContext';

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

  if (!timeLeft) return <span style={{ color: T.danger, fontWeight: 600, fontSize: '0.8rem' }}>Expired</span>;
  const { hours, minutes, seconds, diff } = timeLeft;
  const pct = Math.min((diff / (24 * 3600000)) * 100, 100);
  const barColor = pct < 20 ? T.danger : pct < 50 ? '#D97706' : T.success;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: T.textMuted, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> Expires in:
        </span>
        <span style={{ fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
          {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div style={{ width: '100%', height: 4, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99, transition: 'width 1s linear' }} />
      </div>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
      <Icon size={18} style={{ color: T.gold }} />
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: T.textMain }}>{title}</h3>
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: T.textMuted, gap: 12 }}>
        <Loader2 size={36} style={{ color: T.gold, animation: 'spin 1s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading loyalty points and rewards…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '28px 0 16px 0' }}>

      {/* ── Toast messages ── */}
      {actionSuccess && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F0FDF4', border: `1px solid #BBF7D0`, color: '#166534', padding: '12px 16px', borderRadius: T.radiusSm }}>
          <CheckCircle2 size={18} style={{ color: T.success, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>Redemption Successful</p>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>{actionSuccess}</p>
          </div>
          <button onClick={() => setActionSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: T.success, lineHeight: 1 }}>×</button>
        </div>
      )}
      {actionError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFF5F5', border: `1px solid #FECACA`, color: '#991B1B', padding: '12px 16px', borderRadius: T.radiusSm }}>
          <AlertTriangle size={18} style={{ color: T.danger, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>Redemption Failed</p>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>{actionError}</p>
          </div>
          <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: T.danger, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Balance + Stats ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Balance card */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: T.radius,
          background: `linear-gradient(135deg, #92400E 0%, ${T.gold} 60%, #D97706 100%)`,
          padding: '28px 28px 24px',
          color: '#fff',
          boxShadow: '0 8px 32px rgba(201,162,39,0.25)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 180,
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -32, right: -32, width: 160, height: 160, background: 'rgba(255,255,255,0.08)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -48, right: 60, width: 100, height: 100, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, fontWeight: 600 }}>Point Balance</span>
            <h2 style={{ margin: '6px 0 0', fontSize: '3rem', fontWeight: 800, display: 'flex', alignItems: 'baseline', gap: 8, lineHeight: 1 }}>
              <AnimatedCounter value={balanceData.balance} />
              <span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.9 }}>pts</span>
            </h2>
          </div>

          <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: 16 }}>
            <Star size={11} style={{ display: 'inline', marginRight: 4 }} />
            1 Loyalty Point earned for every 10,000 VND paid at Phūrai checkout
          </div>
        </div>

        {/* Stats card */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 20px 16px', boxShadow: T.shadow, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: T.textMuted }}>Point Statistics</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} style={{ color: T.success }} />
                <span style={{ fontSize: '0.82rem', color: T.textMuted }}>Total earned</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: T.textMain }}>+{(balanceData.totalEarned || 0).toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gem size={14} style={{ color: T.danger }} />
                <span style={{ fontSize: '0.82rem', color: T.textMuted }}>Total redeemed</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: T.textMain }}>-{(balanceData.totalRedeemed || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rewards Catalog ── */}
      <section>
        <SectionHeader icon={Ticket} title="Exchange Rewards Catalog" />

        {catalog.length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: '0.875rem', margin: '12px 0' }}>No rewards available at the moment. Check back soon!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {catalog.map((promo) => {
              const userPoints = balanceData.balance || 0;
              const canRedeem = userPoints >= promo.points_required;
              const outOfStock = promo.remaining_quantity !== null && promo.remaining_quantity <= 0;

              return (
                <div key={promo.promotion_id} style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radius,
                  padding: 20,
                  boxShadow: T.shadow,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                  position: 'relative',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = T.shadowHover; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = T.shadow; e.currentTarget.style.transform = 'none'; }}
                >
                  {outOfStock && (
                    <span style={{ position: 'absolute', top: 12, right: 12, background: '#FEE2E2', color: T.danger, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 99 }}>
                      Sold out
                    </span>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ display: 'inline-block', background: T.goldLight, color: '#92400E', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                      {promo.points_required} Points
                    </span>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: T.textMain }}>{promo.promotion_name}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: T.textMuted, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {promo.description || 'Redeem points for exclusive restaurant benefits.'}
                    </p>
                  </div>

                  <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: T.textMuted }}>
                    <span>Target: {promo.applicable_to === 'Both' ? 'All checkouts' : `${promo.applicable_to} only`}</span>
                    {promo.remaining_quantity !== null && <span>Stock: {promo.remaining_quantity} left</span>}
                  </div>

                  <button
                    onClick={() => setSelectedVoucher(promo)}
                    disabled={!canRedeem || outOfStock}
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      border: 'none',
                      borderRadius: T.radiusSm,
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: canRedeem && !outOfStock ? 'pointer' : 'not-allowed',
                      background: canRedeem && !outOfStock
                        ? `linear-gradient(135deg, #92400E, ${T.gold})`
                        : T.border,
                      color: canRedeem && !outOfStock ? '#fff' : T.textMuted,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => { if (canRedeem && !outOfStock) e.currentTarget.style.opacity = '0.88'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: `1px solid ${T.border}`, marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ticket size={18} style={{ color: T.gold }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: T.textMain }}>My Vouchers</h3>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 3, gap: 2 }}>
            {['active', 'used', 'expired'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '5px 14px',
                  border: 'none',
                  borderRadius: 7,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s',
                  background: activeTab === tab ? T.surface : 'transparent',
                  color: activeTab === tab ? T.textMain : T.textMuted,
                  boxShadow: activeTab === tab ? T.shadow : 'none',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredVouchers.length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: '0.875rem', margin: '8px 0' }}>No {activeTab} vouchers found.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filteredVouchers.map(voucher => (
              <div key={voucher.customer_voucher_id} style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.radius,
                padding: 20,
                boxShadow: T.shadow,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Decorative circle */}
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: `${T.gold}0A`, borderRadius: '50%', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: T.textMain }}>{voucher.promotion_name}</h5>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: T.textMuted }}>{voucher.description}</p>
                  </div>
                  <span style={{ fontFamily: 'monospace', background: T.goldLight, color: '#92400E', padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, border: `1px solid #FDE68A`, flexShrink: 0 }}>
                    {voucher.voucher_code}
                  </span>
                </div>

                <div style={{ paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  {voucher.status === 'active' ? (
                    <VoucherCountdown expiryDate={voucher.expires_at} onExpired={() => loadLoyaltyData()} />
                  ) : voucher.status === 'used' ? (
                    <span style={{ fontSize: '0.78rem', color: T.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={12} style={{ color: T.success }} />
                      Used on {voucher.used_at ? format(new Date(voucher.used_at), 'MMM d, yyyy') : 'checkout'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: T.danger, fontWeight: 500 }}>
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
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(43,33,24,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            maxWidth: 400,
            width: '100%',
            padding: 28,
            boxShadow: '0 20px 60px rgba(43,33,24,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 52, height: 52, background: T.goldLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Gem size={24} style={{ color: T.gold }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: T.textMain }}>Confirm Points Exchange</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: T.textMuted }}>This action cannot be undone. Your points will be deducted immediately.</p>
            </div>

            {/* Summary */}
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: T.textMuted }}>
                <span>Current balance</span>
                <span style={{ fontWeight: 600, color: T.textMain }}>{(balanceData.balance || 0).toLocaleString()} pts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: T.danger }}>
                <span>Points to deduct</span>
                <span style={{ fontWeight: 600 }}>−{selectedVoucher.points_required} pts</span>
              </div>
              <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, color: T.textMain }}>
                <span>Remaining balance</span>
                <span style={{ color: T.success }}><AnimatedCounter value={(balanceData.balance || 0) - selectedVoucher.points_required} /> pts</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setSelectedVoucher(null)}
                disabled={exchanging}
                style={{ flex: 1, padding: '11px 0', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, background: T.surface, color: T.textMuted, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bg; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.surface; }}
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={exchanging}
                style={{
                  flex: 1, padding: '11px 0', border: 'none', borderRadius: T.radiusSm,
                  background: `linear-gradient(135deg, #92400E, ${T.gold})`,
                  color: '#fff', fontSize: '0.85rem', fontWeight: 700,
                  cursor: exchanging ? 'not-allowed' : 'pointer',
                  opacity: exchanging ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'opacity 0.15s',
                }}
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
