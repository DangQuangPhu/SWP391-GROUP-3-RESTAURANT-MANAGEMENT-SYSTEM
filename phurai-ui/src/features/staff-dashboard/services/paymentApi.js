import { apiGet } from "@/core/api/httpClient";

export const checkPaymentStatus = async (orderId) => {
  const response = await apiGet(`/payments/orders/${orderId}/status`);
  return response.data; // Expected: { success: true, data: { status: 'Paid' } }
};
