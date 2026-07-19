import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, TrendingUp, Calendar, User } from 'lucide-react';
import { SectionHead, Toolbar, ContentPanel, EmptyState } from '../components/ManagerUI.jsx';
import DashboardDateRangePicker from '../components/shared/DashboardDateRangePicker.jsx';
import { format, isSameDay } from 'date-fns';

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function RatingDashboard() {
  const [reviews, setReviews] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(reviews.length / itemsPerPage);
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return reviews.slice(startIndex, startIndex + itemsPerPage);
  }, [reviews, currentPage]);

  // Date range filter
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(() => {
    const today = new Date();
    const start = new Date(new Date().setDate(today.getDate() - 30));
    return { startDate: start, endDate: today, key: "selection" };
  });
  const [activePresetId, setActivePresetId] = useState("allDates");

  const closePicker = () => setPickerOpen(false);
  const openPicker = () => {
    setDraftRange({
      startDate: dateRange.startDate ? new Date(dateRange.startDate) : new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate: dateRange.endDate ? new Date(dateRange.endDate) : new Date(),
      key: "selection"
    });
    setPickerOpen(true);
  };

  const handleApplyDate = (range) => {
    setCurrentPage(1);
    if (range.startDate) {
      setDateRange({
        startDate: range.startDate.toISOString().slice(0, 10),
        endDate: range.endDate.toISOString().slice(0, 10)
      });
    } else {
      // All Dates
      setDateRange({
        startDate: "",
        endDate: ""
      });
    }
    closePicker();
  };

  const handlePresetSelect = (preset) => {
    const range = preset.range || { startDate: preset.startDate, endDate: preset.endDate, key: "selection" };
    setActivePresetId(preset.id);
    setDraftRange(range);
  };

  const selectedDateLabel = useMemo(() => {
    if (!dateRange.startDate) return "All Dates";
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    if (isSameDay(start, end)) return format(start, "dd/MM/yyyy");
    return `${format(start, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`;
  }, [dateRange]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("phurai_token") || sessionStorage.getItem("phurai_token") || localStorage.getItem("token");
      const url = dateRange.startDate
        ? `/api/reviews/manager?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        : `/api/reviews/manager`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setReviews(data.data || []);
        setMetrics(data.metrics || null);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Failed to fetch reviews", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [dateRange]);

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}
          />
        ))}
        <span className="text-xs font-semibold ml-1 text-gray-700">{Number(rating).toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="sfx-stack">


      {/* Metrics Row */}
      {metrics && (
        <div className="sfx-kpis mb-6">
          <article className="sfx-kpi sfx-kpi--blue">
            <div className="sfx-kpi__top">
              <span className="sfx-kpi__icon">
                <MessageSquare size={18} />
              </span>
            </div>
            <p className="sfx-kpi__value">{metrics.total_reviews}</p>
            <p className="sfx-kpi__label">Total Reviews</p>
          </article>

          <article className="sfx-kpi sfx-kpi--amber">
            <div className="sfx-kpi__top">
              <span className="sfx-kpi__icon">
                <Star size={18} className="fill-amber-500 text-amber-500 sfx-star--amber" />
              </span>
            </div>
            <p className="sfx-kpi__value">{Number(metrics.avg_overall || 0).toFixed(1)}</p>
            <p className="sfx-kpi__label">Avg. Overall</p>
          </article>

          <article className="sfx-kpi sfx-kpi--green">
            <div className="sfx-kpi__top">
              <span className="sfx-kpi__icon">
                <Star size={18} className="sfx-star--green" />
              </span>
            </div>
            <p className="sfx-kpi__value">{Number(metrics.avg_food || 0).toFixed(1)}</p>
            <p className="sfx-kpi__label">Avg. Food</p>
          </article>

          <article className="sfx-kpi sfx-kpi--purple">
            <div className="sfx-kpi__top">
              <span className="sfx-kpi__icon">
                <Star size={18} className="sfx-star--purple" />
              </span>
            </div>
            <p className="sfx-kpi__value">{Number(metrics.avg_service || 0).toFixed(1)}</p>
            <p className="sfx-kpi__label">Avg. Service</p>
          </article>

          <article className="sfx-kpi sfx-kpi--blue">
            <div className="sfx-kpi__top">
              <span className="sfx-kpi__icon">
                <Star size={18} className="sfx-star--blue" />
              </span>
            </div>
            <p className="sfx-kpi__value">{Number(metrics.avg_ambiance || 0).toFixed(1)}</p>
            <p className="sfx-kpi__label">Avg. Ambiance</p>
          </article>
        </div>
      )}

      <div className="sfx-card sfx-card--overflow-visible sfx-card--featured-dashboard">
        <header className="sfx-card__head sfx-card__head--dashboard">
          <div>
            <h3 className="sfx-card__title sfx-card__title--dashboard">Customer Reviews</h3>
            <p className="sfx-muted sfx-card__subtitle--dashboard">
              {`Reviews for ${selectedDateLabel}`}
            </p>
          </div>
          <span className="sfx-muted sfx-card__counter--dashboard">{reviews.length} reviews</span>
        </header>

        <Toolbar>
          <div className="flex items-center gap-4 flex-1">
            <div className="sfx-picker__container">
              <button
                type="button"
                className="staff-reservations-toolbar__date-trigger sfx-picker__trigger"
                onClick={openPicker}
              >
                <span className="sfx-picker__trigger-label">
                  {selectedDateLabel}
                </span>
                <span className="sfx-picker__trigger-icon">
                  <Calendar size={16} />
                </span>
              </button>
              {pickerOpen && (
                <div className="sfx-picker__popover">
                  <DashboardDateRangePicker
                    inline={true}
                    allowFuture={false}
                    draftRange={draftRange}
                    activePresetId={activePresetId}
                    onDraftChange={(selection) => { setDraftRange(selection); setActivePresetId("custom"); }}
                    onPresetSelect={handlePresetSelect}
                    onApply={handleApplyDate}
                    onCancel={closePicker}
                  />
                </div>
              )}
            </div>
          </div>
        </Toolbar>
        {loading ? (
          <div className="p-10 flex justify-center text-gray-400">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            hint="Customers haven't submitted any reviews for this period."
          />
        ) : (
          <div className="sfx-table-wrap">
            <table className="sfx-table">
              <thead>
                <tr>
                  <th className="sfx-th--w50">#</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Order Ref</th>
                  <th>Food</th>
                  <th>Service</th>
                  <th>Ambiance</th>
                  <th>Overall</th>
                  <th className="sfx-th--w30p">Comment</th>
                </tr>
              </thead>
              <motion.tbody
                variants={listContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {paginatedReviews.map((r, index) => {
                  const stt = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <motion.tr key={r.review_id} variants={listItemVariants}>
                      <td className="sfx-td--grey-bold">{stt}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                            {r.customer_name ? r.customer_name.charAt(0).toUpperCase() : 'G'}
                          </div>
                          <span className="font-medium text-gray-900">{r.customer_name}</span>
                        </div>
                      </td>
                      <td className="text-gray-500 text-sm">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="font-mono text-xs text-gray-400">#{r.order_id}</td>
                      <td>{renderStars(r.food_rating)}</td>
                      <td>{renderStars(r.service_rating)}</td>
                      <td>{renderStars(r.ambiance_rating)}</td>
                      <td>
                        <div className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg inline-flex items-center gap-1 font-bold">
                          {r.overall_rating} <Star size={12} className="fill-amber-500 text-amber-500" />
                        </div>
                      </td>
                      <td>
                        {r.comment ? (
                          <p className="text-sm text-gray-600 italic line-clamp-2" title={r.comment}>
                            "{r.comment}"
                          </p>
                        ) : (
                          <span className="text-gray-300 italic text-sm">No comment</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, reviews.length)} of {reviews.length} entries
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${currentPage === 1 ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'}`}
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm font-semibold text-gray-700">{currentPage} / {totalPages}</span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${currentPage === totalPages ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
