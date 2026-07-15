import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiGet, apiDelete, apiPut } from '@/core/api/httpClient';
import { format } from 'date-fns';
import { X, User, Calendar, CreditCard, ShoppingBag, ShieldAlert, Award } from 'lucide-react';
import '../styles/AdminAccountsPage.css';

export default function ReviewCustomerModal({ customerId, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    if (!customerId) return;
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet(`/admin/customers/${customerId}`);
        if (res.success) {
          setData(res.data);
        } else {
          setError(res.message || 'Failed to fetch customer details.');
        }
      } catch (err) {
        setError(err.message || 'Connection error.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [customerId]);

  const handleToggleStatus = async () => {
    if (!data) return;
    if (!window.confirm(`Are you sure you want to ${data.info.is_active ? 'deactivate' : 'activate'} this account?`)) return;
    
    setTogglingStatus(true);
    try {
      const res = await apiPut(`/admin/accounts/${customerId}/status`);
      if (res.success) {
        setData({
          ...data,
          info: { ...data.info, is_active: !data.info.is_active }
        });
        onRefresh();
      } else {
        alert(res.message || 'Failed to toggle status.');
      }
    } catch (err) {
      alert(err.message || 'Connection error.');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteInput('');
  };

  const handleConfirmDelete = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      const res = await apiDelete(`/admin/customers/${customerId}`);
      if (res.success) {
        onRefresh();
        onClose();
      } else {
        alert(res.message || 'Failed to delete customer.');
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      alert(err.message || 'Connection error.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!customerId) return null;

  return (
    <div className="adm-modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div 
        className="adm-modal-content"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: showDeleteConfirm ? '480px' : '800px', maxWidth: '90vw', padding: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', transition: 'width 0.3s ease' }}
      >
        <div className="adm-modal-header" style={{ padding: '24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: showDeleteConfirm ? '#c62828' : '#1a1a1a' }}>
              {showDeleteConfirm ? 'Delete Customer Account' : 'Customer Profile'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>ID: {customerId}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <X size={24} />
          </button>
        </div>

        <div className="adm-modal-body" style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {showDeleteConfirm ? (
            <div style={{ padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '16px', background: '#ffebee', borderRadius: '12px', border: '1px solid #ffcdd2', color: '#c62828' }}>
                <ShieldAlert size={32} />
                <div>
                  <strong style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>WARNING: Irreversible Action</strong>
                  <span style={{ fontSize: '13px' }}>This will permanently delete this customer account and all associated data. This action cannot be undone.</span>
                </div>
              </div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                Type "DELETE" to confirm
              </label>
              <input 
                type="text" 
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                autoFocus
              />
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading customer data...</div>
          ) : error ? (
            <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', borderRadius: '8px' }}>{error}</div>
          ) : data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Top Section: Info & KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                
                {/* Profile Card */}
                <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                      <User size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px' }}>{data.info.full_name}</h3>
                      <span style={{ fontSize: '12px', color: data.info.is_active ? '#3b6d11' : '#c62828', background: data.info.is_active ? '#eaf3de' : '#ffebee', padding: '2px 8px', borderRadius: '99px', display: 'inline-block', marginTop: '4px' }}>
                        {data.info.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#555', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div><strong>Email:</strong> {data.info.email || 'N/A'}</div>
                    <div><strong>Phone:</strong> {data.info.phone || 'N/A'}</div>
                    <div><strong>Registered:</strong> {data.info.created_at ? format(new Date(data.info.created_at), 'dd MMM yyyy') : 'N/A'}</div>
                    <div><strong>Last Login:</strong> {data.info.last_login_at ? format(new Date(data.info.last_login_at), 'dd MMM yyyy, HH:mm') : 'Never'}</div>
                    {data.info.date_of_birth && <div><strong>DOB:</strong> {format(new Date(data.info.date_of_birth), 'dd MMM yyyy')}</div>}
                  </div>
                </div>

                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', marginBottom: '8px' }}>
                      <Calendar size={16} /> <span style={{ fontSize: '13px', fontWeight: '500' }}>Reservations</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{data.stats.total_reservations}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', marginBottom: '8px' }}>
                      <ShoppingBag size={16} /> <span style={{ fontSize: '13px', fontWeight: '500' }}>Orders</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{data.stats.total_orders}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', marginBottom: '8px' }}>
                      <CreditCard size={16} /> <span style={{ fontSize: '13px', fontWeight: '500' }}>Total Spent</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{Number(data.stats.total_spent).toLocaleString('vi-VN')} ₫</div>
                  </div>
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4af37', marginBottom: '8px' }}>
                      <Award size={16} /> <span style={{ fontSize: '13px', fontWeight: '500' }}>Loyalty Points</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d4af37' }}>{data.info.loyalty_points || 0}</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Recent Reservations</h4>
                  {data.recentReservations.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>No reservations found.</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {data.recentReservations.map(res => (
                        <li key={res.reservation_id} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '8px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong>{format(new Date(res.reservation_start_at), 'dd MMM yyyy, HH:mm')}</strong>
                            <span style={{ color: '#666' }}>{res.reservation_status}</span>
                          </div>
                          <div style={{ color: '#888' }}>Guests: {res.guest_count}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Recent Orders</h4>
                  {data.recentOrders.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>No orders found.</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {data.recentOrders.map(order => (
                        <li key={order.order_id} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '8px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong>{format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}</strong>
                            <span style={{ color: '#666' }}>{order.order_status}</span>
                          </div>
                          <div style={{ color: '#888' }}>Total: {Number(order.total_amount).toLocaleString('vi-VN')} ₫</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
          {showDeleteConfirm ? (
            <>
              <div>
                <button 
                  onClick={handleCancelDelete}
                  disabled={deleting}
                  style={{ background: '#fff', color: '#666', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
              </div>
              <div>
                <button 
                  onClick={handleConfirmDelete}
                  disabled={deleting || deleteInput !== 'DELETE'}
                  style={{ background: deleteInput === 'DELETE' ? '#c62828' : '#e57373', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '8px', cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <button 
                  onClick={handleDeleteClick}
                  disabled={loading}
                  style={{ background: '#fff', color: '#c62828', border: '1px solid #ffcdd2', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500' }}
                >
                  <ShieldAlert size={16} />
                  Delete Customer
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={onClose} style={{ background: '#fff', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Close</button>
                <button 
                  onClick={handleToggleStatus}
                  disabled={togglingStatus || loading}
                  style={{ background: data?.info?.is_active ? '#fff' : '#111', color: data?.info?.is_active ? '#c62828' : '#fff', border: data?.info?.is_active ? '1px solid #ffcdd2' : 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                >
                  {togglingStatus ? 'Processing...' : (data?.info?.is_active ? 'Deactivate Account' : 'Activate Account')}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
