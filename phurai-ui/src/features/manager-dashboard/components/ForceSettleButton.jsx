import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { request, authHeaders } from '@/core/api/httpClient';

export default function ForceSettleButton({ orderId, onSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [methodId, setMethodId] = useState(3); // Default to Bank Card (3)

  const handleForceSettle = async () => {
    setIsLoading(true);
    try {
      const res = await request(`/manager/orders/${orderId}/force-settle`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ payment_method_id: methodId })
      });
      if (res.success) {
        setIsOpen(false);
        if (onSuccess) onSuccess();
      } else {
        alert(res.message || 'Thất bại');
      }
    } catch (error) {
      console.error('Force Settle Error:', error);
      alert('Lỗi hệ thống khi Force Settle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full mt-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm border border-red-200 dark:border-red-800"
      >
        <AlertTriangle className="w-4 h-4" />
        Force Settle Payment
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-red-50 dark:bg-red-900/20">
              <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                CẢNH BÁO: GHI ĐÈ THANH TOÁN
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                Bạn đang thực hiện thao tác <strong className="text-red-600 dark:text-red-400">Force Settle</strong> cho Order #{orderId}. 
                Hành động này sẽ ghi đè hệ thống và đánh dấu đơn hàng là đã thanh toán. <br/><br/>
                <span className="italic font-medium text-gray-500 dark:text-gray-400">
                  Are you sure? This manual override is permanently recorded in the Audit Logs.
                </span>
              </p>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Xác nhận phương thức thanh toán:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600">
                    <input type="radio" name="method" value={1} checked={methodId === 1} onChange={() => setMethodId(1)} className="w-4 h-4 text-red-600" />
                    <span className="text-sm dark:text-gray-200">Tiền mặt (Cash)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600">
                    <input type="radio" name="method" value={2} checked={methodId === 2} onChange={() => setMethodId(2)} className="w-4 h-4 text-red-600" />
                    <span className="text-sm dark:text-gray-200">Chuyển khoản / QR Code</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600">
                    <input type="radio" name="method" value={3} checked={methodId === 3} onChange={() => setMethodId(3)} className="w-4 h-4 text-red-600" />
                    <span className="text-sm dark:text-gray-200">Thẻ ngân hàng (Bank Card)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-medium rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleForceSettle}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-red-400"
                >
                  {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <CheckCircle className="w-4 h-4" />}
                  Xác nhận Settle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
