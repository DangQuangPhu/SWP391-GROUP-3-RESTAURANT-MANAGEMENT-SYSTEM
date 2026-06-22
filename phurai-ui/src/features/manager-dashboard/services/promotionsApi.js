import { request, loadAuthUser, profileRequestHeaders } from '@/core/api/httpClient.js';

// Helper to inject auth headers for Manager operations
async function managerAuthRequest(path, options = {}) {
  const user = loadAuthUser();
  const uid = user?.user_id || user?.id;
  return request(path, {
    ...options,
    headers: profileRequestHeaders(uid, options.headers),
  });
}
export const fetchPromotions = async () => {
  return await managerAuthRequest('/manager/promotions');
};

export const createPromotion = async (promotionData) => {
  return await managerAuthRequest('/manager/promotions', {
    method: 'POST',
    body: JSON.stringify(promotionData),
  });
};

export const togglePromotionStatus = async (id) => {
  return await managerAuthRequest(`/manager/promotions/${id}/toggle`, {
    method: 'PATCH',
  });
};

export const deletePromotion = async (id) => {
  return await managerAuthRequest(`/manager/promotions/${id}`, {
    method: 'DELETE',
  });
};
