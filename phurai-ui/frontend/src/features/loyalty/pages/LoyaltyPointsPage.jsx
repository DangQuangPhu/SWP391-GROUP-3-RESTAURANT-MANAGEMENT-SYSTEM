import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Gem, Award, Clock, Ticket, TrendingUp, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { getLoyaltyBalance, getLoyaltyCatalog, redeemVoucher, getMyVouchers } from '../services/loyaltyApi.js';
import { format } from 'date-fns';
import { useAuth } from '@/features/auth/context/AuthContext';

// Simple self-contained animated counter component
function AnimatedCounter({ value }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = count;
    const end = parseInt(value, 10);
    if (start === end) return;

    const duration = 800; // ms
    const increment = (end - start) / (duration / 16); // ~60fps
    
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

// Countdown timer component for individual active voucher cards
function VoucherCountdown({ expiryDate, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const diff = new Date(expiryDate).getTime() - Date.now();
    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const totalHours = new Date(expiryDate).getTime() - new Date().getTime();
    return { hours, minutes, seconds, diff };
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      if (!remaining) {
        clearInterval(interval);
        setTimeLeft(null);
        if (onExpired) onExpired();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryDate]);

  if (!timeLeft) {
    return <span className="text-red-500 font-semibold">Expired</span>;
  }

  const { hours, minutes, seconds, diff } = timeLeft;
  // Calculate percentage of time left assuming validity of 24h (86400000ms) as base limit
  const maxLimit = 24 * 60 * 60 * 1000;
  const percentage = Math.min((diff / maxLimit) * 100, 100);

  let colorClass = "bg-green-500";
  let textClass = "text-green-500";
  if (percentage < 20) {
    colorClass = "bg-red-500 animate-pulse";
    textClass = "text-red-500 font-medium";
  } else if (percentage < 50) {
    colorClass = "bg-yellow-500";
    textClass = "text-yellow-500";
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="flex items-center gap-1 font-medium">
          <Clock size={12} /> Expiries in:
        </span>
        <span className={`${textClass} font-semibold tabular-nums`}>
          {hours.toString().padStart(2, '0')}:
          {minutes.toString().padStart(2, '0')}:
          {seconds.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function LoyaltyPointsPage() {
  const [balanceData, setBalanceData] = useState({ balance: 0, totalEarned: 0, totalRedeemed: 0 });
  const [catalog, setCatalog] = useState([]);
  const [myVouchers, setMyVouchers] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'used' | 'expired'
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null); // for confirmation modal
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const { currentUser } = useAuth();
  const userId = currentUser?.user_id || currentUser?.userId || currentUser?.id;

  const loadLoyaltyData = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [balRes, catRes, vouchRes] = await Promise.all([
        getLoyaltyBalance(userId),
        getLoyaltyCatalog(userId),
        getMyVouchers(userId)
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

  useEffect(() => {
    loadLoyaltyData();
  }, [userId]);

  // Determine membership levels based on total earned points
  const pointsInfo = useMemo(() => {
    const pts = balanceData.balance || 0;
    let tier = 'Bronze';
    let minPts = 0;
    let maxPts = 500;
    let iconColor = 'text-amber-700';

    if (pts >= 1500) {
      tier = 'Gold';
      minPts = 1500;
      maxPts = 5000;
      iconColor = 'text-yellow-500';
    } else if (pts >= 500) {
      tier = 'Silver';
      minPts = 500;
      maxPts = 1500;
      iconColor = 'text-gray-400';
    }

    const currentTierProgress = Math.min(((pts - minPts) / (maxPts - minPts)) * 100, 100);
    return { tier, nextTierPoints: maxPts - pts, currentTierProgress, iconColor, maxPts };
  }, [balanceData]);

  // Handle points exchange
  const handleRedeem = async () => {
    if (!selectedVoucher || !userId) return;
    setExchanging(true);
    setActionError('');
    setActionSuccess('');

    try {
      const res = await redeemVoucher(userId, selectedVoucher.promotion_id);
      if (res?.success) {
        setActionSuccess(`Successfully exchanged! Your code is: ${res.voucher.code}`);
        setSelectedVoucher(null);
        await loadLoyaltyData(); // reload
        setTimeout(() => setActionSuccess(''), 5000);
      } else {
        setActionError(res?.message || 'Failed to redeem voucher.');
        setTimeout(() => setActionError(''), 5000);
      }
    } catch (err) {
      setActionError(err?.message || 'An error occurred during redemption.');
      setTimeout(() => setActionError(''), 5000);
    } finally {
      setExchanging(false);
    }
  };

  // Filter user vouchers by status
  const filteredVouchers = useMemo(() => {
    return myVouchers.filter(v => v.status === activeTab);
  }, [myVouchers, activeTab]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={40} />
        <p>Loading loyalty points and rewards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-8 pb-1 px-1 relative">
      {/* Messages */}
      {actionSuccess && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl shadow-sm animate-fade-in">
          <CheckCircle2 className="text-green-500 shrink-0" />
          <div>
            <p className="font-semibold">Redemption Successful</p>
            <p className="text-sm">{actionSuccess}</p>
          </div>
          <button onClick={() => setActionSuccess('')} className="ml-auto text-green-500 hover:text-green-700 font-bold">&times;</button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-sm animate-fade-in">
          <AlertTriangle className="text-red-500 shrink-0" />
          <div>
            <p className="font-semibold">Redemption Failed</p>
            <p className="text-sm">{actionError}</p>
          </div>
          <button onClick={() => setActionError('')} className="ml-auto text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {/* Gold Card Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tier Card */}
        <div className="md:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 p-6 text-white shadow-xl flex flex-col justify-between min-h-[200px]">
          <div className="absolute top-0 right-0 transform translate-x-6 -translate-y-6 w-48 h-48 bg-white/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs uppercase tracking-widest text-white/80 font-medium">Point Balance</span>
              <h2 className="text-4xl font-extrabold flex items-center gap-2 mt-1">
                <AnimatedCounter value={balanceData.balance} />
                <span className="text-xl font-medium text-white/90">Pts</span>
              </h2>
            </div>
            <div className="flex flex-col items-end">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm flex items-center gap-1.5">
                <Award size={14} className={pointsInfo.iconColor} /> {pointsInfo.tier} Member
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <div className="flex justify-between items-center text-xs text-white/90">
              <span>Tier progress to next level</span>
              {pointsInfo.tier !== 'Gold' ? (
                <span>{pointsInfo.nextTierPoints} points needed</span>
              ) : (
                <span>Max tier achieved!</span>
              )}
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: `${pointsInfo.currentTierProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Stats Summary Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Point Statistics</h4>
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-50 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Total points earned</span>
              </div>
              <span className="font-bold text-gray-800 dark:text-white">+{balanceData.totalEarned.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center pb-1">
              <div className="flex items-center gap-2">
                <Gem size={16} className="text-red-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Total points redeemed</span>
              </div>
              <span className="font-bold text-gray-800 dark:text-white">-{balanceData.totalRedeemed.toLocaleString()}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            * 1 Loyalty Point is earned for every 10,000 VND paid at Phūrai checkout.
          </p>
        </div>
      </section>

      {/* Rewards Catalog */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
          <Ticket className="text-yellow-500" />
          <h3 className="text-lg font-bold text-black">Exchange Rewards Catalog</h3>
        </div>

        {catalog.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm py-4">No rewards available at the moment. Check back soon!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {catalog.map((promo) => {
              const userPoints = balanceData.balance || 0;
              const hasEnoughPoints = userPoints >= promo.points_required;
              const isOutOfStock = promo.remaining_quantity !== null && promo.remaining_quantity <= 0;
              
              return (
                <div key={promo.promotion_id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 relative">
                  {isOutOfStock && (
                    <span className="absolute top-3 right-3 bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      Sold out
                    </span>
                  )}
                  
                  <div className="space-y-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400">
                      {promo.points_required} Points
                    </span>
                    <h4 className="font-bold text-gray-800 dark:text-white text-base mt-2">{promo.promotion_name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{promo.description || 'Redeem points for exclusive restaurant benefits.'}</p>
                  </div>

                  <div className="pt-2 flex justify-between items-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-50 dark:border-gray-700/60">
                    <span>Target: {promo.applicable_to === 'Both' ? 'All checkouts' : `${promo.applicable_to} only`}</span>
                    {promo.remaining_quantity !== null && (
                      <span>Stock: {promo.remaining_quantity} left</span>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedVoucher(promo)}
                    disabled={!hasEnoughPoints || isOutOfStock}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                      hasEnoughPoints && !isOutOfStock
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm hover:shadow'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {!hasEnoughPoints ? 'Insufficient Points' : isOutOfStock ? 'Sold Out' : 'Redeem Now'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* User Vouchers List */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <Ticket className="text-yellow-500" />
            <h3 className="text-lg font-bold text-black">My Vouchers</h3>
          </div>
          
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-xs self-start sm:self-auto">
            {['active', 'used', 'expired'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md font-semibold capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredVouchers.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm py-4">No {activeTab} vouchers found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredVouchers.map((voucher) => (
              <div key={voucher.customer_voucher_id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full pointer-events-none translate-x-8 -translate-y-8" />
                
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h5 className="font-bold text-gray-800 dark:text-white text-sm">{voucher.promotion_name}</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{voucher.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 px-2.5 py-1 rounded text-xs font-bold border border-yellow-100 dark:border-yellow-900/30">
                      {voucher.voucher_code}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-50 dark:border-gray-700/60 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  {voucher.status === 'active' ? (
                    <VoucherCountdown 
                      expiryDate={voucher.expires_at} 
                      onExpired={() => {
                        // reload
                        loadLoyaltyData();
                      }}
                    />
                  ) : voucher.status === 'used' ? (
                    <span className="text-gray-500 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={12} className="text-gray-500" /> Used on {voucher.used_at ? format(new Date(voucher.used_at), 'MMM d, yyyy') : 'checkout'}
                    </span>
                  ) : (
                    <span className="text-red-500 font-medium">
                      Expired on {format(new Date(voucher.expires_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirmation Modal */}
      {selectedVoucher && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-6 animate-scale-up text-gray-800 dark:text-white">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-500 rounded-full flex items-center justify-center mx-auto">
                <Gem size={24} />
              </div>
              <h3 className="text-lg font-bold">Confirm Points Exchange</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Are you sure you want to exchange points for this voucher?</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                <span>Current points balance</span>
                <span className="font-semibold">{(balanceData.balance || 0).toLocaleString()} Pts</span>
              </div>
              
              <div className="flex justify-between items-center text-red-500">
                <span>Points to deduct</span>
                <span className="font-semibold">-{selectedVoucher.points_required} Pts</span>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between items-center text-sm font-bold">
                <span>Remaining balance</span>
                <span className="text-green-500">
                  <AnimatedCounter value={(balanceData.balance || 0) - selectedVoucher.points_required} /> Pts
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setSelectedVoucher(null)}
                disabled={exchanging}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={exchanging}
                className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-400 text-white text-xs font-bold shadow-md shadow-yellow-500/10 flex items-center justify-center gap-1.5 transition"
              >
                {exchanging ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Exchanging...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
