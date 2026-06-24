import React from "react";

export default function QrCartSummary({ orderData }) {
  // Safe extraction of math fields
  const subtotal = Number(orderData?.subtotal || 0);
  const serviceCharge = Number(orderData?.service_charge || 0);
  const vat = Number(orderData?.vat || 0);
  const totalAmount = Number(orderData?.total_amount || 0);
  const amountPaid = Number(orderData?.amount_paid || 0);
  const remainingBalance = Math.max(0, totalAmount - amountPaid);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
        Bill Summary
      </h3>

      <div className="space-y-3 text-sm">
        {/* Subtotal */}
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>

        {/* Service Charge / VAT */}
        {(serviceCharge > 0 || vat > 0) && (
          <div className="flex justify-between text-gray-600">
            <span>Service Charge & VAT</span>
            <span className="font-medium">
              {formatCurrency(serviceCharge + vat)}
            </span>
          </div>
        )}

        {/* Total Amount */}
        <div className="flex justify-between text-gray-800 font-semibold pt-2 border-t border-dashed">
          <span>Total</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>

        {/* Deposit Paid - ONLY shows if > 0 */}
        {amountPaid > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>Deposit Paid</span>
            <span>- {formatCurrency(amountPaid)}</span>
          </div>
        )}

        {/* Remaining Balance (Amount to Pay) */}
        <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-200">
          <span className="text-gray-900 font-bold text-base">
            Amount to Pay
          </span>
          <span className="text-2xl font-bold text-blue-600">
            {formatCurrency(remainingBalance)}
          </span>
        </div>
      </div>
    </div>
  );
}
