import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, TrendingUp, Calendar, User } from 'lucide-react';
import { SectionHead, Toolbar, ContentPanel, EmptyState } from '../components/ManagerUI.jsx';
import DashboardDateRangePicker from '../components/shared/DashboardDateRangePicker.jsx';

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
  
  // Date range filter
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/manager?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setReviews(data.data || []);
        setMetrics(data.metrics || null);
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
    <div className="sfx-page">
      <SectionHead
        title="Customer Ratings"
        subtitle="Monitor feedback and reviews from your customers"
      />

      <Toolbar>
        <div className="flex items-center gap-4 flex-1">
          <DashboardDateRangePicker 
            value={dateRange}
            onChange={(range) => {
              if (range.startDate !== "all") {
                setDateRange({
                  startDate: new Date(range.startDate).toISOString().slice(0, 10),
                  endDate: new Date(range.endDate).toISOString().slice(0, 10)
                });
              }
            }}
          />
        </div>
      </Toolbar>

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1">Total Reviews</span>
            <span className="text-3xl font-bold text-gray-900">{metrics.total_reviews}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1">Avg. Overall</span>
            <span className="text-3xl font-bold text-amber-500 flex items-center gap-1">
              {Number(metrics.avg_overall || 0).toFixed(1)} <Star size={20} className="fill-amber-500" />
            </span>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1">Avg. Food</span>
            <span className="text-2xl font-bold text-gray-800">{Number(metrics.avg_food || 0).toFixed(1)}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1">Avg. Service</span>
            <span className="text-2xl font-bold text-gray-800">{Number(metrics.avg_service || 0).toFixed(1)}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1">Avg. Ambiance</span>
            <span className="text-2xl font-bold text-gray-800">{Number(metrics.avg_ambiance || 0).toFixed(1)}</span>
          </div>
        </div>
      )}

      <ContentPanel>
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
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Order Ref</th>
                  <th>Food</th>
                  <th>Service</th>
                  <th>Ambiance</th>
                  <th>Overall</th>
                  <th style={{ width: '30%' }}>Comment</th>
                </tr>
              </thead>
              <motion.tbody
                variants={listContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {reviews.map((r) => (
                  <motion.tr key={r.review_id} variants={listItemVariants}>
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
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </ContentPanel>
    </div>
  );
}
