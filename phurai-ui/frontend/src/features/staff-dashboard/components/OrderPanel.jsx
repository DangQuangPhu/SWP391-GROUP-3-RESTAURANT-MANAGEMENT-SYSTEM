import React from 'react';
import { useStaffStore } from '../store/staffStore';
import '../styles/staff-order-tab.css';
import ForceSettleButton from '../../manager-dashboard/components/ForceSettleButton';

export default function OrderPanel({ onSelectOrder }) {
  const orderTables = useStaffStore(state => state.orderTables);
  const staffRole = useStaffStore(state => state.staffRole);

  if (!orderTables || orderTables.length === 0) {
    return (
      <div className="staff-order-intro">
        <p className="sfx-note">Không có đơn hàng nào đang hoạt động</p>
      </div>
    );
  }

  return (
    <div className="staff-order-layout">
      <div className="staff-order-main">
        {orderTables.map(order => {
          const isPaid = order.order_status === 'Paid';
          const statusClass = isPaid ? 'staff-order-status--served' : 'staff-order-status--cooking';

          return (
            <div key={order.order_id} className={`sfx-card staff-order-wrap ${isPaid ? 'is-paid' : ''}`}>
              <div className="staff-order-main__head" style={{ padding: '16px' }}>
                <div>
                  <h3 className="staff-order-main__title">Order #{order.order_id}</h3>
                  <p className="staff-order-main__sub">Table {order.table_number || '?'}</p>
                </div>
                <div className={`staff-order-status ${statusClass}`}>
                  {order.order_status}
                </div>
              </div>

              <div className="sfx-card__body" style={{ padding: '0 16px 16px' }}>
                <div className="staff-order-field">
                  <span>Bắt đầu: {new Date(order.created_at).toLocaleTimeString('vi-VN')}</span>
                  <span>Tổng tiền: <strong style={{ color: 'var(--sfx-text)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.total_amount)}</strong></span>
                </div>

                <div className="staff-order-actions" style={{ marginTop: '16px' }}>
                  <button
                    onClick={() => onSelectOrder && onSelectOrder(order)}
                    className="staff-order-action"
                  >
                    Chi tiết
                  </button>
                  {!isPaid && (
                    <button
                      onClick={() => onSelectOrder && onSelectOrder(order, 'pay')}
                      className="staff-order-action staff-order-action--primary"
                    >
                      Checkout
                    </button>
                  )}
                  {!isPaid && (staffRole === 'manager' || staffRole === 'admin') && (
                    <ForceSettleButton
                      orderId={order.order_id}
                      onSuccess={() => window.location.reload()}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
