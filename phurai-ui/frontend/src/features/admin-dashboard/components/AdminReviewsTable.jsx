import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet } from '@/core/api/httpClient';
import PortalIcon from '@/components/portal/PortalIcon.jsx';
import { useSocket } from '@/core/socket/SocketContext.jsx';

export default function AdminReviewsTable({ startDate, endDate }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRating, setFilterRating] = useState('');
    const { socket } = useSocket();
    
    // Using the requested "calendar" icon (PortalIcon calendar maps to CalendarDays) for a custom filter layout
    // We will place the calendar icon inside a stylized wrapper for visual alignment with the design language.

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
            });
            if (searchTerm) params.append('search', searchTerm);
            if (filterRating) params.append('rating', filterRating);
            if (startDate) params.append('startDate', startDate instanceof Date ? startDate.toISOString() : startDate);
            if (endDate) params.append('endDate', endDate instanceof Date ? endDate.toISOString() : endDate);

            const res = await apiGet(`/admin/reviews?${params.toString()}`);
            if (res.success) {
                setReviews(res.data);
                setPagination(res.pagination);
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, searchTerm, filterRating, startDate, endDate]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    useEffect(() => {
        if (!socket) return;
        const handleNewReview = () => {
            fetchReviews();
        };
        socket.on('review:created', handleNewReview);
        return () => {
            socket.off('review:created', handleNewReview);
        };
    }, [socket, fetchReviews]);

    // Reset page to 1 when dates change to prevent offset errors
    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [startDate, endDate]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleFilterChange = (e) => {
        setFilterRating(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    const renderStars = (rating) => {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <span 
                        key={star} 
                        style={{ 
                            color: star <= (rating || 0) ? '#eab308' : '#e2e8f0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: '14px'
                        }}
                    >
                        ★
                    </span>
                ))}
                <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '4px', color: '#4a4a4a' }}>
                    {Number(rating || 0).toFixed(1)}
                </span>
            </div>
        );
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                marginTop: '24px',
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(31,26,23,0.07)',
                boxShadow: '0 1px 2px rgba(31,26,23,0.04), 0 8px 24px rgba(31,26,23,0.06)',
                overflow: 'hidden'
            }}
        >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(31,26,23,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h3 className="adp-chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PortalIcon name="star" size={20} color="#b7791f" />
                    Review List
                </h3>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Search Field */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8a8175' }}>
                            <PortalIcon name="search" size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search customer or review..."
                            value={searchTerm}
                            onChange={handleSearch}
                            style={{
                                padding: '8px 12px 8px 36px',
                                borderRadius: '8px',
                                border: '1px solid #e2dcd0',
                                outline: 'none',
                                fontSize: '13px',
                                width: '220px',
                                transition: 'all 0.2s',
                            }}
                        />
                    </div>

                    {/* Filter Dropdown */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Using calendar icon as requested for styling/filtering cue */}
                        <div style={{ background: '#f9fafb', padding: '6px', borderRadius: '6px', border: '1px solid #e2dcd0', color: '#5a8bb0', display: 'flex', alignItems: 'center' }}>
                            <PortalIcon name="calendar" size={16} />
                        </div>
                        <select
                            value={filterRating}
                            onChange={handleFilterChange}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e2dcd0',
                                outline: 'none',
                                fontSize: '13px',
                                cursor: 'pointer',
                                background: '#fff',
                            }}
                        >
                            <option value="">All Ratings</option>
                            <option value="5">5 Stars</option>
                            <option value="4">4 Stars</option>
                            <option value="3">3 Stars</option>
                            <option value="2">2 Stars</option>
                            <option value="1">1 Star</option>
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e2dcd0' }}>
                        <tr>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600, width: '60px' }}>#</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Customer</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Order Ref</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Food</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Service</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Ambiance</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Overall</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Review</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="9" style={{ padding: '48px', textAlign: 'center', color: '#8a8175' }}>Loading...</td>
                            </tr>
                        ) : reviews.length === 0 ? (
                            <tr>
                                <td colSpan="9" style={{ padding: '48px', textAlign: 'center', color: '#8a8175' }}>No reviews found.</td>
                            </tr>
                        ) : (
                            reviews.map((review, index) => {
                                // STT is calculated based on page and limit
                                const stt = (pagination.page - 1) * pagination.limit + index + 1;
                                return (
                                    <tr key={review.review_id} style={{ borderBottom: '1px solid #f0f0f0', transition: 'background 0.2s', ':hover': { background: '#faf9f8' } }}>
                                        <td style={{ padding: '16px 24px', fontSize: '13px', color: '#555', fontWeight: 600 }}>
                                            {stt}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#d1fae5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                                    {review.customer_name ? review.customer_name.charAt(0).toUpperCase() : 'G'}
                                                </div>
                                                <span style={{ fontSize: '14px', color: '#1f1a17', fontWeight: 500 }}>
                                                    {review.customer_name || 'Unknown User'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontSize: '13px', color: '#777' }}>
                                            {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '16px 24px', fontSize: '13px', color: '#8a8175', fontFamily: 'monospace' }}>
                                            {review.order_id ? `#${review.order_id}` : '-'}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            {renderStars(review.food_rating)}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            {renderStars(review.service_rating)}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            {renderStars(review.ambiance_rating)}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                                                {review.overall_rating} <PortalIcon name="star" size={12} style={{ fill: '#b45309', color: '#b45309' }} />
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontSize: '13px', color: '#4b5563', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {review.comment ? (
                                                <span style={{ fontStyle: 'italic' }} title={review.comment}>
                                                    "{review.comment}"
                                                </span>
                                            ) : (
                                                <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>No comment</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!loading && pagination.totalPages > 1 && (
                <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(31,26,23,0.07)', background: '#fff' }}>
                    <span style={{ fontSize: '13px', color: '#8a8175' }}>
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => handlePageChange(pagination.page - 1)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2dcd0', background: pagination.page === 1 ? '#f9fafb' : '#fff', color: pagination.page === 1 ? '#ccc' : '#1f1a17', cursor: pagination.page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}
                        >
                            Previous
                        </button>
                        
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, padding: '0 8px' }}>{pagination.page} / {pagination.totalPages}</span>
                        </div>

                        <button
                            disabled={pagination.page === pagination.totalPages}
                            onClick={() => handlePageChange(pagination.page + 1)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2dcd0', background: pagination.page === pagination.totalPages ? '#f9fafb' : '#fff', color: pagination.page === pagination.totalPages ? '#ccc' : '#1f1a17', cursor: pagination.page === pagination.totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
